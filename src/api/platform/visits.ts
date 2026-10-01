'use client';

/** Учёт визитов (F-00-177): статус, «перезвонить», причина отказа, ответственный. */
import { isApiMode } from '@/api/http';
import { ApiError, request } from '@/api/request';
import { mutateArea, readArea } from '@/api/area';
import type { DistrictId, Id } from '@/domain/core';
import { callbackOverdueDays, callbackState, sortVisitsForWork, type CallbackItem, type Visit, type VisitInput, type VisitStatus } from '@/domain/platform';
import { nowDateTime, today } from '@/lib/date';
import { newId } from '@/lib/id';
import { normalizePhone } from '@/lib/phone';
import { AREA, PANEL } from '@/api/platform/shared';
import * as S from '@/api/platform/visits.server';

/** Визиты в порядке работы: просроченные перезвоны → сегодня → позже → остальные */
export function listVisits(filter?: { status?: VisitStatus; district?: DistrictId }): Promise<Visit[]> {
  if (isApiMode()) return S.listVisits(filter);
  return request(() => {
    const rows = readArea(AREA).visits.filter((v) => (!filter?.status || v.status === filter.status) && (!filter?.district || v.district === filter.district));
    return sortVisitsForWork(rows, today());
  }, PANEL);
}

/** Счётчики для вкладок статуса — по всем визитам, без фильтра */
export function getVisitCounts(): Promise<Record<VisitStatus | 'all', number>> {
  if (isApiMode()) return S.getVisitCounts();
  return request(() => {
    const counts: Record<VisitStatus | 'all', number> = { all: 0, connected: 0, thinking: 0, refused: 0 };
    readArea(AREA).visits.forEach((v) => {
      counts.all += 1;
      counts[v.status] += 1;
    });
    return counts;
  }, PANEL);
}

/** Кому перезвонить сегодня и кто просрочен — с именем и телефоном, чтобы сразу звонить */
export function listCallbacks(): Promise<CallbackItem[]> {
  if (isApiMode()) return S.listCallbacks();
  return request(() => {
    const t = today();
    return sortVisitsForWork(
      readArea(AREA).visits.filter((v) => {
        const state = callbackState(v, t);
        return state === 'overdue' || state === 'today';
      }),
      t,
    ).map((v) => ({
      visitId: v.id,
      placeName: v.placeName,
      contactName: v.contactName,
      phone: v.phone,
      callbackDate: v.callbackDate ?? t,
      overdueDays: callbackOverdueDays(v.callbackDate ?? t, t),
    }));
  }, PANEL);
}

function cleanInput(input: Partial<VisitInput>): Partial<VisitInput> {
  const out = { ...input };
  if (input.phone !== undefined) out.phone = input.phone ? (normalizePhone(input.phone) ?? input.phone) : undefined;
  if (input.status && input.status !== 'thinking') out.callbackDate = undefined;
  if (input.status && input.status !== 'refused') out.refusalReason = undefined;
  return out;
}

export function createVisit(input: VisitInput): Promise<Visit> {
  if (isApiMode()) return S.createVisit(input);
  return request(() => {
    if (!input.placeName.trim()) throw new ApiError('validation', 'placeName');
    const now = nowDateTime();
    const visit: Visit = {
      ...input,
      ...cleanInput(input),
      placeName: input.placeName.trim(),
      id: newId('visit'),
      history: [{ id: newId('vev'), at: now, kind: 'created', status: input.status }],
      createdAt: now,
      updatedAt: now,
    };
    mutateArea(AREA, (s) => {
      s.visits.unshift(visit);
    });
    return visit;
  }, PANEL);
}

export function updateVisit(id: Id, patch: Partial<VisitInput>): Promise<Visit> {
  if (isApiMode()) return S.updateVisit(id, patch);
  return request(() => {
    const now = nowDateTime();
    let result: Visit | undefined;
    mutateArea(AREA, (s) => {
      const visit = s.visits.find((v) => v.id === id);
      if (!visit) throw new ApiError('not_found');
      const statusChanged = patch.status && patch.status !== visit.status;
      const callbackChanged = patch.callbackDate && patch.callbackDate !== visit.callbackDate;
      Object.assign(visit, cleanInput(patch));
      visit.updatedAt = now;
      if (statusChanged) visit.history.push({ id: newId('vev'), at: now, kind: 'status', status: patch.status });
      if (callbackChanged) visit.history.push({ id: newId('vev'), at: now, kind: 'callback', date: patch.callbackDate });
      result = visit;
    });
    if (!result) throw new ApiError('not_found');
    return result;
  }, PANEL);
}

/** «Перезвонили»: дата перезвона снимается, в историю — отметка */
export function completeCallback(id: Id, note?: string): Promise<Visit> {
  if (isApiMode()) return S.completeCallback(id, note);
  return request(() => {
    const now = nowDateTime();
    let result: Visit | undefined;
    mutateArea(AREA, (s) => {
      const visit = s.visits.find((v) => v.id === id);
      if (!visit) throw new ApiError('not_found');
      visit.callbackDate = undefined;
      if (note) visit.note = note;
      visit.updatedAt = now;
      visit.history.push({ id: newId('vev'), at: now, kind: 'callbackDone' });
      result = visit;
    });
    if (!result) throw new ApiError('not_found');
    return result;
  }, PANEL);
}
