'use client';

/** План запуска: волны (F-00-203…205), окупаемость (F-00-206), до постройки (F-00-207), имя и домен (F-00-208). */
import { isApiMode } from '@/api/http';
import { ApiError, request } from '@/api/request';
import { mutateArea, readArea, readCore } from '@/api/area';
import type { Id } from '@/domain/core';
import type { BrandState, DomainStatus, NameCandidate, PaybackInputs, PayingNow, PrelaunchItem, PrelaunchStatus, WaveItem, WaveItemStatus } from '@/domain/platform';
import { nowDateTime, today } from '@/lib/date';
import { AREA, PANEL } from '@/api/platform/shared';
import * as S from '@/api/platform/plan.server';

export function listWaveItems(): Promise<WaveItem[]> {
  if (isApiMode()) return S.listWaveItems();
  return request(() => readArea(AREA).waveItems, PANEL);
}

export function setWaveItemStatus(id: Id, status: WaveItemStatus): Promise<void> {
  if (isApiMode()) return S.setWaveItemStatus(id, status);
  return request(() => {
    mutateArea(AREA, (s) => {
      const item = s.waveItems.find((w) => w.id === id);
      if (!item) throw new ApiError('not_found');
      item.status = status;
    });
  }, PANEL);
}

export function listPrelaunchItems(): Promise<PrelaunchItem[]> {
  if (isApiMode()) return S.listPrelaunchItems();
  return request(() => [...readArea(AREA).prelaunchItems].sort((a, b) => a.order - b.order), PANEL);
}

export function savePrelaunchItem(id: Id, patch: { status?: PrelaunchStatus; decision?: string; note?: string }): Promise<void> {
  if (isApiMode()) return S.savePrelaunchItem(id, patch);
  return request(() => {
    mutateArea(AREA, (s) => {
      const item = s.prelaunchItems.find((p) => p.id === id);
      if (!item) throw new ApiError('not_found');
      Object.assign(item, patch, { updatedAt: nowDateTime() });
    });
  }, PANEL);
}

export function getPaybackInputs(): Promise<PaybackInputs> {
  if (isApiMode()) return S.getPaybackInputs();
  return request(() => readArea(AREA).paybackInputs, PANEL);
}

export function savePaybackInputs(inputs: PaybackInputs): Promise<void> {
  if (isApiMode()) return S.savePaybackInputs(inputs);
  return request(() => {
    if (Object.values(inputs).some((v) => !Number.isFinite(v) || v < 0)) throw new ApiError('validation');
    mutateArea(AREA, (s) => {
      s.paybackInputs = inputs;
    });
  }, PANEL);
}

/** «Сейчас платят» — бизнесы вне бесплатного периода, не ушедшие и не замороженные */
export function getPayingNow(): Promise<PayingNow> {
  if (isApiMode()) return S.getPayingNow();
  return request(() => {
    const meta = readArea(AREA).bizMeta;
    const t = today();
    let salons = 0;
    let individuals = 0;
    readCore().businesses.forEach((b) => {
      const m = meta[b.id];
      if (b.status !== 'active' || m?.leftAt || (m?.freeUntil && m.freeUntil >= t)) return;
      if (b.kind === 'individual') individuals += 1;
      else salons += 1;
    });
    return { salons, individuals };
  }, PANEL);
}

export function listNameCandidates(): Promise<NameCandidate[]> {
  if (isApiMode()) return S.listNameCandidates();
  return request(() => readArea(AREA).nameCandidates, PANEL);
}

export function saveNameCandidate(id: Id, patch: Partial<{ domainStatus: DomainStatus; note: string }>): Promise<void> {
  if (isApiMode()) return S.saveNameCandidate(id, patch);
  return request(() => {
    mutateArea(AREA, (s) => {
      const item = s.nameCandidates.find((n) => n.id === id);
      if (!item) throw new ApiError('not_found');
      Object.assign(item, patch);
    });
  }, PANEL);
}

export function chooseBrand(id: Id | undefined): Promise<void> {
  if (isApiMode()) return S.chooseBrand(id);
  return request(() => {
    mutateArea(AREA, (s) => {
      s.brand = { chosenId: id, decidedAt: id ? nowDateTime() : undefined };
    });
  }, PANEL);
}

export function getBrand(): Promise<BrandState> {
  if (isApiMode()) return S.getBrand();
  return request(() => readArea(AREA).brand, PANEL);
}
