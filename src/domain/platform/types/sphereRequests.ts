/** Типы раздела «platform»: sphereRequests. */
import type { ISODate, ISODateTime, Id } from '@/domain/core';

// ─────────────────────────── Заявки на сферы (F-00-151, F-00-152) ───────────────────────────
// Хозяин функций — settings (регистрация «моей сферы нет», подписка); наша сторона — очередь заявок.

export type SphereRequestKind = 'noSphere' | 'newSphere';
export type SphereRequestStatus = 'open' | 'agreed' | 'inProgress' | 'done';

export interface SphereRequest {
  id: Id;
  kind: SphereRequestKind;
  businessId?: Id;
  masterName: string;
  phone: string;
  /** Профессия/сфера своими словами («мойщик», «тату-мастер») */
  sphereName: string;
  /** Список «что нужно» — согласован письменно заранее (F-00-152, только newSphere) */
  needs: string[];
  status: SphereRequestStatus;
  createdAt: ISODateTime;
  /** День, когда сфера готова — год подписки считается с него, а не с оплаты (F-00-152) */
  readyAt?: ISODate;
  note?: string;
  decidedAt?: ISODateTime;
}

/** Заявка для экрана: с названием бизнеса, если заявка от бизнеса */
export interface SphereRequestView extends SphereRequest {
  businessName?: string;
}

export interface SphereRequestInput {
  kind: SphereRequestKind;
  businessId?: Id;
  masterName: string;
  phone: string;
  sphereName: string;
  needs?: string[];
  note?: string;
}
