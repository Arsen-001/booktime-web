'use client';

/** Импорт из Excel, выгрузка и журнал выгрузок. */
import type { ClientRow, ExportLogEntry, ImportColumnTarget, ImportRowErrorCode, ImportRowResult, ImportRunSummary } from '@/domain/clients';
import { emptyProfile } from '@/domain/clients';
import type { Client, Id } from '@/domain/core';
import * as C from '@/api/clients/clients.server';
import { isApiMode } from '@/api/http';
import { readArea, readCore, mutateArea } from '@/api/area';
import { assertCan, coreTx, currentActor } from '@/api/core';
import { ApiError, request } from '@/api/request';
import { newId } from '@/lib/id';
import { dayjs, nowDateTime, today } from '@/lib/date';
import { normalizePhone } from '@/lib/phone';
import { businessIdsFor, rowsFor } from '@/api/clients/shared';

// ─────────────────────────── Импорт из Excel (F-04-126…129, 177) ───────────────────────────

export interface ParsedImportSheet {
  headers: string[];
  rows: string[][];
}

export const IMPORT_MAX_ROWS = 500;

/** Разбирает вставленный текст или содержимое .csv (F-04-126): авто-определяет разделитель `,`/`;`/Tab */
export function parseImportText(text: string): ParsedImportSheet {
  const lines = text.split(/\r\n|\n|\r/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) throw new ApiError('empty_import', 'Нет данных для загрузки');
  const sep = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ',';
  const table = lines.map((l) => l.split(sep).map((c) => c.trim().replace(/^"(.*)"$/, '$1')));
  const headers = table[0];
  const rows = table.slice(1);
  if (rows.length > IMPORT_MAX_ROWS) throw new ApiError('too_many_rows', `За раз можно загрузить не больше ${IMPORT_MAX_ROWS} строк`);
  return { headers, rows };
}

function parseImportGender(v: string): Client['gender'] | undefined {
  const s = v.trim().toUpperCase();
  if (s === 'M' || s === '1') return 'male';
  if (s === 'F' || s === '2') return 'female';
  return undefined;
}

/** «ДД-ММ» или «ДД-ММ-ГГГГ» → ISODate; без года подставляется текущий (F-04-128) */
function parseImportBirthday(v: string): string | undefined {
  const m = v.trim().match(/^(\d{2})-(\d{2})(?:-(\d{4}))?$/);
  if (!m) return undefined;
  const [, dd, mm, yyyy] = m;
  const year = yyyy ?? String(dayjs(today()).year());
  const candidate = `${year}-${mm}-${dd}`;
  return dayjs(candidate, 'YYYY-MM-DD', true).isValid() ? candidate : undefined;
}

/**
 * Применяет одну сопоставленную строку (F-04-127/128): создаёт клиента или, если номер уже есть в базе,
 * ПРИБАВЛЯЕТ «Продано»/«Оплачено» к существующей карточке (F-04-129) — не создаёт дубль (F-00-128).
 */
async function applyImportRow(
  businessId: Id,
  headers: ImportColumnTarget[],
  values: string[],
): Promise<{ ok: boolean; error?: string; errorCode?: ImportRowErrorCode; created?: boolean; clientId?: Id }> {
  const get = (target: ImportColumnTarget): string | undefined => {
    const i = headers.indexOf(target);
    return i >= 0 ? values[i]?.trim() : undefined;
  };
  const name = get('name');
  const phoneRaw = get('phone');
  if (!name) return { ok: false, errorCode: 'noName', error: 'Не заполнено имя' };
  if (!phoneRaw) return { ok: false, errorCode: 'noPhone', error: 'Не заполнен телефон' };
  if (!/^\d{7,15}$/.test(phoneRaw))
    return {
      ok: false,
      errorCode: 'phoneFormat',
      error: 'Телефон должен быть числом без «+», тире и пробелов',
    };

  const emailRaw = get('email');
  if (emailRaw && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) return { ok: false, errorCode: 'emailFormat', error: 'Неверный формат email' };

  const genderRaw = get('gender');
  const gender = genderRaw ? parseImportGender(genderRaw) : undefined;
  if (genderRaw && !gender) return { ok: false, errorCode: 'genderFormat', error: 'Пол должен быть M/F или 1/2' };

  const birthdayRaw = get('birthday');
  const birthday = birthdayRaw ? parseImportBirthday(birthdayRaw) : undefined;
  if (birthdayRaw && !birthday)
    return {
      ok: false,
      errorCode: 'birthdayFormat',
      error: 'Дата рождения должна быть ДД-ММ или ДД-ММ-ГГГГ',
    };

  const soldRaw = get('sold');
  const paidRaw = get('paid');
  const balanceRaw = get('balance');
  const discountRaw = get('discount');
  const card = get('card');
  const additionalPhoneRaw = get('additionalPhone');
  const comment = get('comment');
  const lastName = get('lastName');

  const core = readCore();
  const normalizedImportPhone = normalizePhone(`+${phoneRaw}`);
  const existing = core.clients.find((c) => {
    if (c.businessId !== businessId || c.deletedAt) return false;
    return normalizedImportPhone ? normalizePhone(c.phone) === normalizedImportPhone : c.phone === `+${phoneRaw}`;
  });

  const addSold = (Number(soldRaw) || 0) + (Number(balanceRaw) || 0);
  const addPaid = (Number(paidRaw) || 0) + (Number(balanceRaw) || 0);

  if (existing) {
    mutateArea('clients', (s) => {
      const prev = s.profiles[existing.id] ?? emptyProfile();
      s.profiles[existing.id] = {
        ...prev,
        importedSold: (prev.importedSold ?? 0) + addSold,
        paidAmount: prev.paidAmount + addPaid,
        cardNumber: card || prev.cardNumber,
        discountPercent: discountRaw !== undefined && discountRaw !== '' ? Number(discountRaw) : prev.discountPercent,
        additionalPhone: additionalPhoneRaw || prev.additionalPhone,
      };
    });
    if (comment)
      coreTx.update('clients', existing.id, {
        note: existing.note ? `${existing.note}\n${comment}` : comment,
      });
    return { ok: true, created: false, clientId: existing.id };
  }

  const client = coreTx.create('clients', {
    businessId,
    phone: `+${phoneRaw}`,
    name,
    gender: gender ?? 'unknown',
    birthday,
    tags: [],
    note: comment || undefined,
    noShowCount: 0,
    createdAt: nowDateTime(),
  });
  mutateArea('clients', (s) => {
    s.profiles[client.id] = {
      discountPercent: discountRaw !== undefined && discountRaw !== '' ? Number(discountRaw) : 0,
      paidAmount: addPaid,
      importedSold: addSold,
      cardNumber: card || undefined,
      lastName: lastName || undefined,
      additionalPhone: additionalPhoneRaw || undefined,
    };
  });
  return { ok: true, created: true, clientId: client.id };
}

/**
 * Запускает импорт (F-04-126…129): построчно валидирует и применяет; пишет прогон в свой журнал раздела
 * и в общий журнал «Операции с данными» (`coreTx.logDataOperation`, core-k3 №2).
 */
export function runImport(
  businessId: Id,
  authorName: string,
  mapping: ImportColumnTarget[],
  rows: string[][],
  method: ImportRunSummary['method'] = 'paste',
): Promise<{ results: ImportRowResult[]; summary: ImportRunSummary }> {
  if (isApiMode()) return C.runImport(businessId, authorName, mapping, rows, method);
  return request(async () => {
    assertCan('clients.edit');
    const results: ImportRowResult[] = [];
    let created = 0;
    let updated = 0;
    for (let i = 0; i < rows.length; i++) {
      const outcome = await applyImportRow(businessId, mapping, rows[i]);
      results.push({
        rowIndex: i,
        raw: rows[i],
        ok: outcome.ok,
        error: outcome.error,
        errorCode: outcome.errorCode,
        clientId: outcome.clientId,
        created: outcome.created,
      });
      if (outcome.ok && outcome.created) created++;
      else if (outcome.ok) updated++;
    }
    const summary: ImportRunSummary = {
      id: newId('import'),
      businessId,
      at: nowDateTime(),
      authorName,
      method,
      totalRows: rows.length,
      createdCount: created,
      updatedCount: updated,
      rejectedCount: rows.length - created - updated,
    };
    mutateArea('clients', (s) => {
      s.importRuns = [summary, ...s.importRuns].slice(0, 50);
    });
    coreTx.logDataOperation({
      businessId,
      kind: 'import',
      area: 'clients',
      entity: 'clients',
      count: created + updated,
      failed: summary.rejectedCount,
    });
    return { results, summary };
  });
}

export function listImportRuns(): Promise<ImportRunSummary[]> {
  if (isApiMode()) return C.listImportRuns(C.bizOf());
  return request(() => {
    const businessId = currentActor().businessId;
    return readArea('clients').importRuns.filter((r) => r.businessId === businessId);
  });
}

// ─────────────────────────── Выгрузка (F-04-130) и журнал выгрузок ───────────────────────────

/** Записывает выгрузку в журнал (F-04-130 «попадает в журнал выгрузок»); сама выгрузка — на экране */
export function logExport(authorName: string, count: number): Promise<ExportLogEntry> {
  return request(() => {
    const entry: ExportLogEntry = {
      id: newId('exp'),
      at: nowDateTime(),
      authorName,
      count,
      method: 'download',
    };
    mutateArea('clients', (s) => {
      s.exportLog = [entry, ...s.exportLog].slice(0, 50);
    });
    return entry;
  });
}

/**
 * Выгрузка клиентов (F-04-009, F-04-130): право clients.export проверяет api (decision-c1 №1 — у администратора
 * по умолчанию его нет), строки отдаются по id выборки, выгрузка пишется в журнал выгрузок и общий журнал операций.
 */
export function exportClients(input: { businessId: Id; locationIds?: Id[]; ids: Id[]; authorName: string; fileName: string }): Promise<ClientRow[]> {
  if (isApiMode()) return C.exportClients(input);
  return request(() => {
    assertCan('clients.export');
    const wanted = new Set(input.ids);
    const rows = rowsFor(businessIdsFor(input.businessId, input.locationIds)).filter((r) => wanted.has(r.id));
    const entry: ExportLogEntry = { id: newId('exp'), at: nowDateTime(), authorName: input.authorName, count: rows.length, method: 'download' };
    mutateArea('clients', (s) => {
      s.exportLog = [entry, ...s.exportLog].slice(0, 50);
    });
    coreTx.logDataOperation({ businessId: input.businessId, kind: 'export', area: 'clients', entity: 'clients', count: rows.length, fileName: input.fileName });
    return rows;
  });
}

export function listExportLog(): Promise<ExportLogEntry[]> {
  if (isApiMode()) return C.listExportLog(C.bizOf());
  return request(() => readArea('clients').exportLog);
}
