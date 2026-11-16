import { toLocalDateTime } from '@/lib/date';

/** Перевод времени сервера к местному Еревана — общий помощник в '@/lib/date' (им пользуется и приложение клиента) */
export { toLocalDateTime };

/** Смета с сервера (кабинет или публичная страница): времена — к местному Еревана, остальное как есть */
export function normalizeEstimate<T extends { sentAt: string | null; decidedAt: string | null; remindedAt?: string | null }>(est: T | null): T | null {
  if (!est) return null;
  return {
    ...est,
    sentAt: toLocalDateTime(est.sentAt),
    decidedAt: toLocalDateTime(est.decidedAt),
    ...('remindedAt' in est ? { remindedAt: toLocalDateTime(est.remindedAt) } : {}),
  };
}
