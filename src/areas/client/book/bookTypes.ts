import type { ShadeOption } from '@/api/client';
import type { BookingForWhom, ISODateTime, Workplace } from '@/domain/core';

/** Шаги записи клиента (F-00-092): «Где» — только у услуг с выездом и другим местом (decision-c3 №1) */
export type BookStep = 'service' | 'place' | 'slot' | 'confirm';

/** Черновик записи — состояние экрана, не база (CONVENTIONS §18 п.8) */
export interface BookDraft {
  serviceId?: string;
  slot?: ISODateTime;
  /** Место из окна (дома у мастера / в салоне) или выбранное клиентом (выезд) */
  workplace?: Workplace;
  visitAddress: string;
  shade?: ShadeOption;
  forWhom: BookingForWhom;
  visitorName: string;
  comment: string;
  useMembership: boolean;
  /** ⭐ «Оплатить всё сразу» вместо предоплаты мастера (процентом) */
  payInFull: boolean;
}

export const EMPTY_DRAFT: BookDraft = {
  visitAddress: '',
  forWhom: 'self',
  visitorName: '',
  comment: '',
  useMembership: true,
  payInFull: false,
};
