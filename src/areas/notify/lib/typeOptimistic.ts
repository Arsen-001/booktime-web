/**
 * Оптимистичная правка типа уведомления (Ув4): и список типов (['notify','types',biz]), и страница типа
 * (['notify','type',biz,code]) получают патч сразу, до ответа — тумблер/сценарий/условия срабатывают мгновенно,
 * без перечитывания всей страницы; при ошибке useApiMutation откатывает кэш сам.
 */
import type { TypePatch } from '@/api/notify';
import { optimistic, type Optimistic } from '@/api/request';
import type { Id, LocalizedText } from '@/domain/core';
import type { NotificationType, NotifyChannel } from '@/domain/notify';

interface TypeArgs {
  businessId: Id;
  code: number;
  patch: TypePatch;
}

export function applyTypePatch(type: NotificationType, patch: TypePatch): NotificationType {
  const next: NotificationType = { ...type };
  if (patch.enabled !== undefined) next.enabled = patch.enabled;
  if (patch.channels) next.channels = patch.channels;
  if (patch.emailExtra) next.emailExtra = patch.emailExtra;
  if (patch.conditions) next.conditions = { ...type.conditions, ...patch.conditions };
  if (patch.templates) {
    const templates = { ...type.templates };
    for (const [channel, p] of Object.entries(patch.templates) as [NotifyChannel, Partial<LocalizedText>][]) {
      const current = templates[channel] ?? { ru: '' };
      templates[channel] = { ...current, ...p, ru: p.ru ?? current.ru };
    }
    next.templates = templates;
  }
  return next;
}

export const typeOptimistic: Optimistic<TypeArgs>[] = [
  optimistic<NotificationType[] | undefined, TypeArgs>(
    (args) => ['notify', 'types', args.businessId],
    (old, args) => (Array.isArray(old) ? old.map((t) => (t.code === args.code ? applyTypePatch(t, args.patch) : t)) : old),
  ),
  optimistic<NotificationType | undefined, TypeArgs>(
    (args) => ['notify', 'type', args.businessId, args.code],
    (old, args) => (old && old.code === args.code ? applyTypePatch(old, args.patch) : old),
  ),
];
