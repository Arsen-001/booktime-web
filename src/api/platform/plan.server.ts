'use client';

/**
 * Раздел «platform»: заметки основателя на настоящем сервере (booktime-backend, PLAN.md §7, этап 19 продолжение;
 * docs/backend/02 §19: «…/notes, одним документом», 01 §8). Рабочий документ, не продуктовая функция конечных
 * пользователей — сервер хранит его целиком, каждая правка здесь читает документ и шлёт обратно изменённое поле
 * (read-modify-write на клиенте панели: один активный редактор, гонка не имеет практического веса).
 */
import { ApiError } from '@/api/request';
import { http } from '@/api/http';
import { trackRead } from '@/api/request';
import { notifyDbChange } from '@/mock/db';
import { nowDateTime } from '@/lib/date';
import type { Id } from '@/domain/core';
import type { BrandState, DomainStatus, NameCandidate, PaybackInputs, PayingNow, PrelaunchItem, PrelaunchStatus, WaveItem, WaveItemStatus } from '@/domain/platform';

interface LaunchNotesDoc {
  waveItems: WaveItem[];
  prelaunchItems: PrelaunchItem[];
  paybackInputs: PaybackInputs;
  nameCandidates: NameCandidate[];
  brand: BrandState;
}

function read<T>(fn: () => Promise<T>): Promise<T> {
  trackRead('areas.platform');
  return fn();
}
async function write<T>(fn: () => Promise<T>): Promise<T> {
  const res = await fn();
  notifyDbChange('areas.platform');
  return res;
}

const getDoc = () => http<LaunchNotesDoc>('GET', '/v1/platform/notes');
const putDoc = (patch: Partial<LaunchNotesDoc>) => http<LaunchNotesDoc>('PUT', '/v1/platform/notes', patch);

export const listWaveItems = () => read(() => getDoc().then((d) => d.waveItems));

export const setWaveItemStatus = (id: Id, status: WaveItemStatus) =>
  write(async () => {
    const doc = await getDoc();
    if (!doc.waveItems.some((w) => w.id === id)) throw new ApiError('not_found');
    await putDoc({ waveItems: doc.waveItems.map((w) => (w.id === id ? { ...w, status } : w)) });
  });

export const listPrelaunchItems = () => read(() => getDoc().then((d) => [...d.prelaunchItems].sort((a, b) => a.order - b.order)));

export const savePrelaunchItem = (id: Id, patch: { status?: PrelaunchStatus; decision?: string; note?: string }) =>
  write(async () => {
    const doc = await getDoc();
    if (!doc.prelaunchItems.some((p) => p.id === id)) throw new ApiError('not_found');
    const updatedAt = nowDateTime();
    await putDoc({ prelaunchItems: doc.prelaunchItems.map((p) => (p.id === id ? { ...p, ...patch, updatedAt } : p)) });
  });

export const getPaybackInputs = () => read(() => getDoc().then((d) => d.paybackInputs));

export const savePaybackInputs = (inputs: PaybackInputs) =>
  write(async () => {
    if (Object.values(inputs).some((v) => !Number.isFinite(v) || v < 0)) throw new ApiError('validation');
    await putDoc({ paybackInputs: inputs });
  });

export const getPayingNow = () => read(() => http<PayingNow>('GET', '/v1/platform/notes/paying-now'));

export const listNameCandidates = () => read(() => getDoc().then((d) => d.nameCandidates));

export const saveNameCandidate = (id: Id, patch: Partial<{ domainStatus: DomainStatus; note: string }>) =>
  write(async () => {
    const doc = await getDoc();
    if (!doc.nameCandidates.some((n) => n.id === id)) throw new ApiError('not_found');
    await putDoc({ nameCandidates: doc.nameCandidates.map((n) => (n.id === id ? { ...n, ...patch } : n)) });
  });

export const chooseBrand = (id: Id | undefined) => write(() => putDoc({ brand: { chosenId: id, decidedAt: id ? nowDateTime() : undefined } }).then(() => undefined));

export const getBrand = () => read(() => getDoc().then((d) => d.brand));
