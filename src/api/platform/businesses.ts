'use client';

/** Бизнесы на платформе: сведения, копии данных и выгрузка при уходе (F-00-183), согласие на рекламу (F-00-164). */
import { isApiMode } from '@/api/http';
import { ApiError, request } from '@/api/request';
import { mutateArea, readArea, readCore } from '@/api/area';
import { coreTx } from '@/api/core';
import type { Id } from '@/domain/core';
import type { BackupCopy, BizMeta, BusinessOverviewRow, ExportFile, ExportWhat } from '@/domain/platform';
import { nowDateTime, today } from '@/lib/date';
import { toCsv } from '@/lib/csv';
import { newId } from '@/lib/id';
import { AREA, PANEL } from '@/api/platform/shared';
import * as S from '@/api/platform/businesses.server';

export function listBusinessesOverview(): Promise<BusinessOverviewRow[]> {
  if (isApiMode()) return S.listBusinessesOverview();
  return request(() => {
    const core = readCore();
    const meta = readArea(AREA).bizMeta;
    return core.businesses
      .map((b): BusinessOverviewRow => {
        const m = meta[b.id];
        return {
          id: b.id,
          name: b.name,
          kind: b.kind,
          sphereIds: b.sphereIds,
          district: core.locations.find((l) => l.businessId === b.id)?.district,
          status: m?.leftAt ? 'left' : b.status === 'frozen' ? 'frozen' : 'active',
          staffCount: core.staff.filter((s) => s.businessId === b.id && s.status !== 'fired').length,
          meta: m,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, PANEL);
}

export function listBizMeta(): Promise<Record<Id, BizMeta>> {
  if (isApiMode()) return S.listBizMeta();
  return request(() => readArea(AREA).bizMeta, PANEL);
}

/** F-00-164: получать ли бизнесу предложения поставщиков (пока переключаем мы) */
export function setAdsOptIn(businessId: Id, optIn: boolean): Promise<void> {
  if (isApiMode()) return S.setAdsOptIn(businessId, optIn);
  return request(() => {
    mutateArea(AREA, (s) => {
      const meta = s.bizMeta[businessId] ?? { businessId, source: 'self' as const };
      s.bizMeta[businessId] = { ...meta, adsOptIn: optIn };
    });
  }, PANEL);
}

export function listBackupCopies(businessId: Id): Promise<BackupCopy[]> {
  if (isApiMode()) return S.listBackupCopies(businessId);
  return request(() => readArea(AREA).backupCopies.filter((b) => b.businessId === businessId).sort((a, b) => b.at.localeCompare(a.at)), PANEL);
}

export function makeBackupCopy(businessId: Id): Promise<BackupCopy> {
  if (isApiMode()) return S.makeBackupCopy(businessId);
  return request(() => {
    const core = readCore();
    const counts = {
      clients: core.clients.filter((c) => c.businessId === businessId).length,
      bookings: core.bookings.filter((b) => b.businessId === businessId).length,
      services: core.services.filter((s) => s.businessId === businessId).length,
      staff: core.staff.filter((s) => s.businessId === businessId).length,
    };
    const copy: BackupCopy = { id: newId('backup'), businessId, at: nowDateTime(), kind: 'manual', counts, sizeKb: 40 + Math.ceil((counts.clients + counts.bookings) / 5) };
    mutateArea(AREA, (s) => {
      s.backupCopies.unshift(copy);
    });
    return copy;
  }, PANEL);
}

/**
 * Выгрузка при уходе (F-00-183). Заголовки CSV передаёт экран уже переведёнными — api не зовёт хуки перевода.
 * Порядок заголовков совпадает с порядком значений.
 */
export function exportBusinessData(businessId: Id, what: ExportWhat, headers: string[]): Promise<ExportFile> {
  if (isApiMode()) return S.exportBusinessData(businessId, what, headers);
  return request(() => {
    const core = readCore();
    const rows =
      what === 'clients'
        ? core.clients.filter((c) => c.businessId === businessId).map((c) => [c.name, c.phone, c.gender, c.tags.join(', '), c.noShowCount])
        : core.bookings.filter((b) => b.businessId === businessId).map((b) => [b.start.replace('T', ' '), b.status, b.total, b.source]);
    mutateArea(AREA, (s) => {
      s.exportLog.unshift({ id: newId('exp'), businessId, what, rows: rows.length, at: nowDateTime() });
    });
    return { fileName: `${what}-${businessId}-${today()}.csv`, csv: toCsv(rows, headers), rows: rows.length };
  }, PANEL);
}

/** «Бизнес ушёл, данные выданы» — пропадает из каталога, отменить нельзя */
export function markBusinessLeft(businessId: Id, dataHanded: boolean): Promise<void> {
  if (isApiMode()) return S.markBusinessLeft(businessId, dataHanded);
  return request(() => {
    if (!readCore().businesses.some((b) => b.id === businessId)) throw new ApiError('not_found');
    mutateArea(AREA, (s) => {
      const meta = s.bizMeta[businessId] ?? { businessId, source: 'self' as const };
      s.bizMeta[businessId] = { ...meta, leftAt: today(), dataHandedAt: dataHanded ? nowDateTime() : meta.dataHandedAt };
    });
  }, PANEL);
}

/**
 * Приостановить бизнес (нарушение, жалобы, неоплата): статус «frozen» — в каталоге не виден, онлайн-запись закрыта
 * (canBookOnline → business_inactive), данные и кабинет остаются. Вернуть — «active». Ушедший (leftAt) не трогаем.
 * Сервер: POST /v1/platform/businesses/{id}/block (этап 21).
 */
export function setBusinessBlocked(businessId: Id, blocked: boolean): Promise<void> {
  if (isApiMode()) return S.setBusinessBlocked(businessId, blocked);
  return request(() => {
    coreTx.get('businesses', businessId); // нет такого — not_found
    if (readArea(AREA).bizMeta[businessId]?.leftAt) throw new ApiError('conflict');
    coreTx.update('businesses', businessId, { status: blocked ? 'frozen' : 'active' });
  }, PANEL);
}

/** Есть ли «Приостановить / Вернуть» в этой сборке — с этапа 21 есть в обоих режимах */
export function canBlockBusinesses(): boolean {
  return true;
}
