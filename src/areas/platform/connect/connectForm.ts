/** Форма мастера подключения: что правится на шагах (живёт в состоянии экрана, в черновик уходит на «Далее»). */
import type { ConnectDraft, ConnectIssue } from '@/domain/platform';

export const CONNECT_STEPS = ['salon', 'place', 'photos', 'masters', 'services', 'hours', 'summary'] as const;
export type ConnectStepId = (typeof CONNECT_STEPS)[number];

export type ConnectForm = Pick<
  ConnectDraft,
  | 'kind'
  | 'name'
  | 'sphereId'
  | 'ownerName'
  | 'ownerPhone'
  | 'district'
  | 'address'
  | 'yandexMapsUrl'
  | 'coords'
  | 'coordsAt'
  | 'photos'
  | 'invites'
  | 'services'
  | 'hours'
  | 'calendarMode'
  | 'promoCodeId'
  | 'responsibleId'
>;

export function formOf(d: ConnectDraft): ConnectForm {
  return {
    kind: d.kind,
    name: d.name,
    sphereId: d.sphereId,
    ownerName: d.ownerName,
    ownerPhone: d.ownerPhone,
    district: d.district,
    address: d.address,
    yandexMapsUrl: d.yandexMapsUrl,
    coords: d.coords,
    coordsAt: d.coordsAt,
    photos: d.photos,
    invites: d.invites,
    services: d.services,
    hours: d.hours,
    calendarMode: d.calendarMode,
    promoCodeId: d.promoCodeId,
    responsibleId: d.responsibleId,
  };
}

/** Ошибки полей шага (ключ — поле, значение — код проблемы) */
export type StepErrors = Partial<Record<ConnectIssue, true>>;

/** Минут до конца визита по шагам — ориентир «осталось ≈ N мин» */
export const MINUTES_LEFT = [10, 8, 7, 5, 4, 2, 1] as const;
