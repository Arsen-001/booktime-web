/**
 * Тон и значок статуса — одно место для списка и карточки (статус видно формой, а не только цветом, §0).
 */
import type { BadgeTone } from '@/ui/Badge';
import type { AdState, IdeaStatus, ModerationStatus, PromoStatus, SphereRequestStatus, SupportStatus, VisitStatus } from '@/domain/platform';

export const MODERATION_TONE: Record<ModerationStatus, BadgeTone> = { pending: 'warning', approved: 'success', rejected: 'danger', auto: 'info' };
export const VISIT_TONE: Record<VisitStatus, BadgeTone> = { connected: 'success', thinking: 'warning', refused: 'neutral' };
export const PROMO_TONE: Record<PromoStatus, BadgeTone> = { new: 'neutral', issued: 'info', used: 'success', expired: 'neutral', revoked: 'danger' };
export const SUPPORT_TONE: Record<SupportStatus, BadgeTone> = { open: 'warning', waiting: 'info', closed: 'neutral' };
export const AD_TONE: Record<AdState, BadgeTone> = { scheduled: 'info', running: 'success', paused: 'warning', finished: 'neutral' };
export const IDEA_TONE: Record<IdeaStatus, BadgeTone> = { considering: 'neutral', inProgress: 'warning', done: 'success' };
export const SPHERE_REQUEST_TONE: Record<SphereRequestStatus, BadgeTone> = { open: 'warning', agreed: 'info', inProgress: 'primary', done: 'success' };
