/** Типы раздела «platform»: moderation. */
import type { ISODateTime, Id, LocalizedText } from '@/domain/core';

// ─────────────────────────── Проверка (F-00-168…171, F-00-179) ───────────────────────────

export type ModerationKind =
  | 'staffPhoto'
  | 'salonPhoto'
  | 'servicePhoto'
  | 'service'
  | 'text'
  | 'diploma'
  | 'story'
  | 'complaint'
  /** Текст отзыва клиента мастеру, когда бизнес выбрал «оценка и текст» (В-24) */
  | 'review';

/** pending — ждёт; approved — одобрено; rejected — отклонено; auto — показано без проверки (F-00-169) */
export type ModerationStatus = 'pending' | 'approved' | 'rejected' | 'auto';

/** Откуда пришло: бизнес сам, снято нами на визите, шаблон, повтор уже одобренного */
export type ModerationSource = 'user' | 'visit' | 'template' | 'reuse';

export type ModerationEventKind = 'submitted' | 'approved' | 'rejected' | 'auto' | 'refund' | 'reopened';

export interface ModerationEvent {
  id: Id;
  at: ISODateTime;
  kind: ModerationEventKind;
  note?: string;
  /** Для возврата: сколько монет вернули */
  coins?: number;
}

export interface ModerationItem {
  id: Id;
  kind: ModerationKind;
  businessId: Id;
  staffId?: Id;
  serviceId?: Id;
  /** Что именно проверяем: id фото / услуги / текста / документа / сторис / жалобы */
  refId: Id;
  /** Короткая подпись материала (имя документа, название услуги) */
  label?: string;
  /** Текст на проверку (описание, текст сторис, текст жалобы) */
  text?: string;
  /** Картинка (data URL), если загружена */
  imageUrl?: string;
  /** Для моковых фото без картинки — цвет плитки 1..8 */
  tone?: number;
  /** Платный материал: сколько монет списано (место под фото, сторис) */
  paidCoins?: number;
  status: ModerationStatus;
  source: ModerationSource;
  reasonId?: Id;
  reasonNote?: string;
  /** Для жалобы: на какой материал */
  targetItemId?: Id;
  submittedAt: ISODateTime;
  decidedAt?: ISODateTime;
  history: ModerationEvent[];
}

/** Элемент очереди для экрана: с названием бизнеса и подписью причины отказа */
export interface ModerationView extends ModerationItem {
  businessName: string;
  reasonLabel?: LocalizedText;
}

export type ModerationCounts = Record<ModerationStatus, number>;

export interface ModerationSubmitInput {
  kind: ModerationKind;
  businessId: Id;
  refId: Id;
  staffId?: Id;
  serviceId?: Id;
  label?: string;
  text?: string;
  imageUrl?: string;
  paidCoins?: number;
  source?: ModerationSource;
  targetItemId?: Id;
}

/** Причина отказа из справочника */
export interface RejectReason {
  id: Id;
  label: LocalizedText;
  active: boolean;
  order: number;
}

/** Движение монет, которое делает наша панель: возврат при отказе, подарок, списание за сторис */
export type CoinEntryKind = 'refund' | 'gift' | 'charge';
export type CoinEntryReason = 'moderationReject' | 'firstAward' | 'storyPlace' | 'storyCancelled' | 'manual';

export interface CoinEntry {
  id: Id;
  businessId: Id;
  kind: CoinEntryKind;
  /** Монеты: + на баланс, − списано */
  amount: number;
  reason: CoinEntryReason;
  refId?: Id;
  at: ISODateTime;
}
