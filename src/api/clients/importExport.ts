'use client';

/** Импорт клиентов пачками, выгрузка и журнал выгрузок. */
import type {
  ClientProfile,
  ClientRow,
  ExportLogEntry,
  ImportableClientFields,
  ImportBatchInput,
  ImportBatchResult,
  ImportBatchRowResult,
  ImportClientInput,
  ImportRunSummary,
} from '@/domain/clients';
import { emptyProfile, fillEmptyPatch, IMPORT_BATCH_MAX, isImportEmail, normalizeImportPhone } from '@/domain/clients';
import type { Client, Id } from '@/domain/core';
import * as C from '@/api/clients/clients.server';
import { isApiMode } from '@/api/http';
import { readArea, readCore, mutateArea } from '@/api/area';
import { assertCan, coreTx, currentActor } from '@/api/core';
import { ApiError, request } from '@/api/request';
import { newId } from '@/lib/id';
import { nowDateTime } from '@/lib/date';
import { normalizePhone } from '@/lib/phone';
import { businessIdsFor, rowsFor } from '@/api/clients/shared';

// ─────────────────────────── Импорт клиентов (F-04-126…129, 177; ⭐ переезд за минуту, 04.10.2026) ───────────────────────────
// Экран сам разбирает файл и проверяет строки (prepareImport из domain) и шлёт готовые строки пачками до
// IMPORT_BATCH_MAX. Номер уже в базе: «пропустить» или «дополнить пустые поля» — повтор того же файла ничего не
// удваивает и не плодит дублей (было у Altegio: «Продано/Оплачено» складывались, F-04-129 — заменено решением 04.10).

/** Карточка мока в общей форме правила fillEmptyPatch */
function importableOf(c: Client, p: ClientProfile): ImportableClientFields {
  return {
    name: c.name,
    lastName: p.lastName,
    email: c.email,
    note: c.note,
    birthday: c.birthday,
    gender: c.gender,
    tags: c.tags,
    additionalPhone: p.additionalPhone,
    discountPercent: p.discountPercent,
    cardNumber: p.cardNumber,
    importedSold: p.importedSold ?? 0,
    paidAmount: p.paidAmount,
  };
}

/** Тот же номер у разных записей: '+374…' сравниваем нормализованным, иностранный — как есть */
const phoneKey = (phone: string) => normalizePhone(phone) ?? phone.replace(/[^\d+]/g, '');

/** Одна пачка импорта: проверка (dryRun) или запись. Строка — создан / дополнен / пропущен / ошибка */
export function importClientsBatch(businessId: Id, input: ImportBatchInput): Promise<ImportBatchResult> {
  if (isApiMode()) return C.importClientsBatch(businessId, input);
  return request(() => {
    assertCan('clients.edit');
    if (input.rows.length > IMPORT_BATCH_MAX) throw new ApiError('too_many_rows', `Не больше ${IMPORT_BATCH_MAX} строк за вызов`);
    const core = readCore();
    const byPhone = new Map<string, Client>();
    core.clients.filter((c) => c.businessId === businessId && !c.deletedAt).forEach((c) => byPhone.set(phoneKey(c.phone), c));
    const seen = new Set<string>();
    const results: ImportBatchRowResult[] = [];

    for (const row of input.rows) {
      // Сервер проверяет строки сам — мок повторяет ту же проверку телефона, а не верит экрану
      const phone = normalizeImportPhone(row.phone);
      if (!phone) {
        results.push({
          rowIndex: row.rowIndex,
          status: 'error',
          code: row.phone ? 'phoneFormat' : 'noPhone',
        });
        continue;
      }
      const key = phoneKey(phone.phone);
      if (seen.has(key)) {
        results.push({
          rowIndex: row.rowIndex,
          status: 'skipped',
          code: 'duplicateInFile',
        });
        continue;
      }
      seen.add(key);
      const clean: ImportClientInput = {
        ...row,
        phone: phone.phone,
        name: (row.name || phone.phone).trim().slice(0, 160),
        email: row.email && isImportEmail(row.email) ? row.email : undefined,
      };
      const existing = byPhone.get(key);

      if (existing) {
        if (input.onExisting === 'skip') {
          results.push({
            rowIndex: row.rowIndex,
            status: 'skipped',
            code: 'exists',
            clientId: existing.id,
          });
          continue;
        }
        const profile = readArea('clients').profiles[existing.id] ?? emptyProfile();
        const patch = fillEmptyPatch(importableOf(existing, profile), clean);
        if (Object.keys(patch).length === 0) {
          results.push({
            rowIndex: row.rowIndex,
            status: 'skipped',
            code: 'nothingToFill',
            clientId: existing.id,
          });
          continue;
        }
        if (!input.dryRun) {
          const corePatch: Partial<Client> = {};
          if (patch.email) corePatch.email = patch.email;
          if (patch.note) corePatch.note = patch.note;
          if (patch.birthday) corePatch.birthday = patch.birthday;
          if (patch.gender && patch.gender !== 'unknown') corePatch.gender = patch.gender;
          if (patch.tags) corePatch.tags = patch.tags;
          if (Object.keys(corePatch).length) coreTx.update('clients', existing.id, corePatch);
          mutateArea('clients', (s) => {
            const prev = s.profiles[existing.id] ?? emptyProfile();
            s.profiles[existing.id] = {
              ...prev,
              ...(patch.lastName ? { lastName: patch.lastName } : {}),
              ...(patch.additionalPhone ? { additionalPhone: patch.additionalPhone } : {}),
              ...(patch.discountPercent ? { discountPercent: patch.discountPercent } : {}),
              ...(patch.cardNumber ? { cardNumber: patch.cardNumber } : {}),
              ...(patch.importedSold ? { importedSold: patch.importedSold } : {}),
              ...(patch.paidAmount ? { paidAmount: patch.paidAmount } : {}),
            };
          });
        }
        results.push({
          rowIndex: row.rowIndex,
          status: 'updated',
          clientId: existing.id,
        });
        continue;
      }

      if (input.dryRun) {
        results.push({ rowIndex: row.rowIndex, status: 'created' });
        continue;
      }
      const client = coreTx.create('clients', {
        businessId,
        phone: clean.phone,
        name: clean.name,
        gender: clean.gender ?? 'unknown',
        birthday: clean.birthday,
        email: clean.email,
        tags: clean.tags ?? [],
        note: clean.note || undefined,
        noShowCount: 0,
        createdAt: nowDateTime(),
      });
      byPhone.set(key, client);
      mutateArea('clients', (s) => {
        s.profiles[client.id] = {
          discountPercent: clean.discountPercent ?? 0,
          paidAmount: clean.paid ?? 0,
          importedSold: clean.sold ?? 0,
          cardNumber: clean.cardNumber,
          lastName: clean.lastName,
          additionalPhone: clean.additionalPhone,
        };
      });
      results.push({
        rowIndex: row.rowIndex,
        status: 'created',
        clientId: client.id,
      });
    }

    if (input.dryRun) return { results };

    // Журнал загрузок: один прогон = одна строка, пачки прибавляются к ней
    const count = (st: ImportBatchRowResult['status']) => results.filter((r) => r.status === st).length;
    const runId = input.runId ?? newId('import');
    const before = input.runId ? 0 : (input.rejectedBeforeSend ?? 0);
    const prev = readArea('clients').importRuns.find((r) => r.id === runId && r.businessId === businessId);
    const total: ImportRunSummary = {
      id: runId,
      businessId,
      at: prev?.at ?? nowDateTime(),
      authorName: input.authorName,
      method: input.method,
      totalRows: (prev?.totalRows ?? 0) + results.length + before,
      createdCount: (prev?.createdCount ?? 0) + count('created'),
      updatedCount: (prev?.updatedCount ?? 0) + count('updated'),
      rejectedCount: (prev?.rejectedCount ?? 0) + count('error') + before,
      skippedCount: (prev?.skippedCount ?? 0) + count('skipped'),
    };
    mutateArea('clients', (s) => {
      s.importRuns = [total, ...s.importRuns.filter((r) => r.id !== runId)].slice(0, 50);
    });
    if (input.final) {
      coreTx.logDataOperation({
        businessId,
        kind: 'import',
        area: 'clients',
        entity: 'clients',
        count: total.createdCount + total.updatedCount,
        failed: total.rejectedCount,
      });
    }
    return { runId, results };
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
