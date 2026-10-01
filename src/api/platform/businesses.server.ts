'use client';

/** Раздел «platform»: бизнесы на настоящем сервере (booktime-backend, PLAN.md §7, этап 19; docs/backend/02 §19, 06 §6). */
import { http } from '@/api/http';
import { trackRead } from '@/api/request';
import { notifyDbChange } from '@/mock/db';
import type { Id } from '@/domain/core';
import type { BackupCopy, BizMeta, BusinessOverviewRow, ExportFile, ExportWhat } from '@/domain/platform';

function read<T>(fn: () => Promise<T>): Promise<T> {
  trackRead('areas.platform');
  return fn();
}
async function write<T>(fn: () => Promise<T>): Promise<T> {
  const res = await fn();
  notifyDbChange('areas.platform');
  return res;
}

export const listBusinessesOverview = () => read(() => http<BusinessOverviewRow[]>('GET', '/v1/platform/businesses'));

export const setAdsOptIn = (businessId: Id, optIn: boolean) => write(() => http<void>('POST', `/v1/platform/businesses/${businessId}/ads-opt-in`, { optIn }));

export const listBackupCopies = (businessId: Id) => read(() => http<BackupCopy[]>('GET', `/v1/platform/businesses/${businessId}/backups`));

export const makeBackupCopy = (businessId: Id) => write(() => http<BackupCopy>('POST', `/v1/platform/businesses/${businessId}/backups`));

export const exportBusinessData = (businessId: Id, what: ExportWhat, headers: string[]) =>
  write(() => http<ExportFile>('POST', `/v1/platform/businesses/${businessId}/export`, { headers }, { query: { what } }));

export const setBusinessBlocked = (businessId: Id, blocked: boolean) => write(() => http<void>('POST', `/v1/platform/businesses/${businessId}/block`, { blocked }));

export const markBusinessLeft = (businessId: Id, dataHanded: boolean) => write(() => http<void>('POST', `/v1/platform/businesses/${businessId}/leave`, { dataHanded }));

/** listBizMeta мока (Record<Id,BizMeta>) — на сервере то же значение уже лежит в каждой строке overview (meta) */
export const listBizMeta = () =>
  read(() =>
    http<BusinessOverviewRow[]>('GET', '/v1/platform/businesses').then((rows) =>
      rows.reduce<Record<Id, BizMeta>>((acc, r) => {
        if (r.meta) acc[r.id] = r.meta;
        return acc;
      }, {}),
    ),
  );
