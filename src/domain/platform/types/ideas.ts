/** Типы раздела «platform»: ideas. */
import type { ISODateTime, Id } from '@/domain/core';

// ─────────────────────────── Идеи (F-00-009, панельная сторона) ───────────────────────────
// Хозяин функции — client («Предложить идею» в кабинете бизнеса); наша сторона — очередь идей,
// голоса, статусы и уведомление автору при «сделано».

export type IdeaStatus = 'considering' | 'inProgress' | 'done';

export interface Idea {
  id: Id;
  businessId: Id;
  authorName: string;
  text: string;
  votes: number;
  /** businessId проголосовавших — против повторного голоса за одну идею */
  voterIds: Id[];
  status: IdeaStatus;
  createdAt: ISODateTime;
  decidedAt?: ISODateTime;
  /** Когда отправлено уведомление автору «сделано по вашей просьбе» */
  notifiedAt?: ISODateTime;
}

export interface IdeaInput {
  businessId: Id;
  authorName: string;
  text: string;
}
