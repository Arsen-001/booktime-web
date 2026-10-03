/**
 * Тон и значок статуса — одно место для списка и карточки (статус видно формой, а не только цветом, §0).
 */
import type { BadgeTone } from '@/ui/Badge';
import type { AdState, BookingSystem, IdeaStatus, ModerationStatus, PromoStatus, ProspectStatus, SphereRequestStatus, SupportStatus, VisitStatus } from '@/domain/platform';

export const MODERATION_TONE: Record<ModerationStatus, BadgeTone> = { pending: 'warning', approved: 'success', rejected: 'danger', auto: 'info' };
export const VISIT_TONE: Record<VisitStatus, BadgeTone> = { connected: 'success', thinking: 'warning', refused: 'neutral' };
export const PROMO_TONE: Record<PromoStatus, BadgeTone> = { new: 'neutral', issued: 'info', used: 'success', expired: 'neutral', revoked: 'danger' };
export const SUPPORT_TONE: Record<SupportStatus, BadgeTone> = { open: 'warning', waiting: 'info', closed: 'neutral' };
export const AD_TONE: Record<AdState, BadgeTone> = { scheduled: 'info', running: 'success', paused: 'warning', finished: 'neutral' };
export const IDEA_TONE: Record<IdeaStatus, BadgeTone> = { considering: 'neutral', inProgress: 'warning', done: 'success' };
export const SPHERE_REQUEST_TONE: Record<SphereRequestStatus, BadgeTone> = { open: 'warning', agreed: 'info', inProgress: 'primary', done: 'success' };
/** «Места»: статус из визитов; «работает в BookTime» — главный успех, «не были» — нейтрально */
export const PROSPECT_TONE: Record<ProspectStatus, BadgeTone> = { new: 'neutral', thinking: 'warning', connected: 'info', refused: 'danger', live: 'success' };
/** Система записи: прямые конкуренты-онлайн — акцентом, «без системы» (телефон, Instagram) — проще всего подключить */
/**
 * Группы «Запись сейчас» (макет «Места для продаж»): зелёный — системы нет, подключить проще всего; жёлтый — Emly
 * выключен; синий — уже на чужой онлайн-записи (переманиваем; не красный — это не ошибка); серый — не видно или своё.
 */
export const BOOKING_SYSTEM_TONE: Record<BookingSystem, BadgeTone> = {
  phone_whatsapp: 'success',
  instagram: 'success',
  emly_off: 'warning',
  unknown: 'neutral',
  own_site: 'neutral',
  medical_platform: 'neutral',
  emly: 'info',
  booker: 'info',
  altegio: 'info',
  dikidi: 'info',
  fresha: 'info',
  sonline: 'info',
  booksy: 'info',
  other_online: 'info',
};
