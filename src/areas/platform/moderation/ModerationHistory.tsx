'use client';

/** История материала словами: «Отправлено на проверку», «Одобрено», «Отклонено», «Монеты возвращены». */
import { Check, CornerUpLeft, Coins, Send, X, Zap } from 'lucide-react';
import type { ReactNode } from 'react';
import type { ModerationEventKind, ModerationView } from '@/domain/platform';
import type { BadgeTone } from '@/ui/Badge';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { usePagedList } from '@/ui/Pagination';
import { Timeline } from '@/ui/Timeline';

const EVENT_ICON: Record<ModerationEventKind, ReactNode> = {
  submitted: <Send aria-hidden />,
  approved: <Check aria-hidden />,
  rejected: <X aria-hidden />,
  auto: <Zap aria-hidden />,
  refund: <Coins aria-hidden />,
  reopened: <CornerUpLeft aria-hidden />,
};
const EVENT_TONE: Record<ModerationEventKind, BadgeTone> = { submitted: 'neutral', approved: 'success', rejected: 'danger', auto: 'info', refund: 'warning', reopened: 'neutral' };

export function ModerationHistory({ item }: { item: ModerationView }) {
  const t = useT('platform');
  const fmt = useFormat();
  // Постранично, как во всех списках (DESIGN.md → Long lists): свежие события сверху
  const { pageItems, pager } = usePagedList([...item.history].reverse(), { resetKey: item.id });
  return (
    <>
      <Timeline
        items={pageItems.map((h) => ({
          id: h.id,
          title: h.kind === 'refund' && h.coins ? t('moderation.eventRefund', { coins: h.coins }) : t(`moderation.eventKind.${h.kind}`),
          description: h.note,
          time: fmt.dateTime(h.at),
          icon: EVENT_ICON[h.kind],
          tone: EVENT_TONE[h.kind],
        }))}
      />
      {pager}
    </>
  );
}
