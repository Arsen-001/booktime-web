'use client';

/**
 * Заявки на сферы (наша сторона): F-00-151 «моей сферы нет»; F-00-152 новая сфера по заказу — год подписки
 * считается с дня готовности сферы. Регистрацию и оплату ведёт раздел settings.
 */
import { isApiMode } from '@/api/http';
import { ApiError, request } from '@/api/request';
import { mutateArea, readArea, readCore } from '@/api/area';
import type { ISODate, Id } from '@/domain/core';
import type { SphereRequest, SphereRequestInput, SphereRequestKind, SphereRequestStatus, SphereRequestView } from '@/domain/platform';
import { nowDateTime } from '@/lib/date';
import { newId } from '@/lib/id';
import { normalizePhone } from '@/lib/phone';
import { AREA, PANEL, businessNameOf } from '@/api/platform/shared';
import * as S from '@/api/platform/sphereRequests.server';

const STATUS_RANK: Record<SphereRequestStatus, number> = { open: 0, agreed: 1, inProgress: 2, done: 3 };

/** Сначала то, что ждёт действия (открытые), потом свежие */
export function listSphereRequests(kind?: SphereRequestKind): Promise<SphereRequestView[]> {
  if (isApiMode()) return S.listSphereRequests(kind);
  return request(() => {
    const core = readCore();
    return readArea(AREA)
      .sphereRequests.filter((r) => !kind || r.kind === kind)
      .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || b.createdAt.localeCompare(a.createdAt))
      .map((r) => ({ ...r, businessName: businessNameOf(core, r.businessId) }));
  }, PANEL);
}

/** Из settings или вручную у нас: заявка попадает в очередь «открыта» */
export function createSphereRequest(input: SphereRequestInput): Promise<SphereRequest> {
  if (isApiMode()) return S.createSphereRequest(input);
  return request(() => {
    const phone = normalizePhone(input.phone);
    if (!input.masterName.trim() || !input.sphereName.trim() || !phone) throw new ApiError('validation');
    const req: SphereRequest = { id: newId('sreq'), ...input, phone, needs: input.needs ?? [], status: 'open', createdAt: nowDateTime() };
    mutateArea(AREA, (s) => {
      s.sphereRequests.unshift(req);
    });
    return req;
  });
}

export interface SphereRequestPatch {
  status?: SphereRequestStatus;
  needs?: string[];
  /** F-00-152: день готовности сферы — с него считается год подписки */
  readyAt?: ISODate;
  note?: string;
}

export function saveSphereRequest(id: Id, patch: SphereRequestPatch): Promise<SphereRequest> {
  if (isApiMode()) return S.saveSphereRequest(id, patch);
  return request(() => {
    let updated: SphereRequest | undefined;
    mutateArea(AREA, (s) => {
      const req = s.sphereRequests.find((r) => r.id === id);
      if (!req) throw new ApiError('not_found');
      Object.assign(req, patch);
      if (patch.status) req.decidedAt = nowDateTime();
      updated = req;
    });
    if (!updated) throw new ApiError('not_found');
    return updated;
  }, PANEL);
}
