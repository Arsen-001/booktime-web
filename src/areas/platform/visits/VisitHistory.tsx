'use client';

/** История визита словами: создан, статус, «перезвонить», перезвонили, подключён. */
import type { Visit } from '@/domain/platform';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Accordion } from '@/ui/Accordion';
import { Timeline } from '@/ui/Timeline';

export function VisitHistory({ visit }: { visit: Visit }) {
  const t = useT('platform');
  const fmt = useFormat();
  const items = [...visit.history].reverse().map((h) => ({
    id: h.id,
    title:
      h.kind === 'status' && h.status
        ? t('visits.event.status', { status: t(`visits.status.${h.status}`) })
        : h.kind === 'callback' && h.date
          ? t('visits.event.callback', { date: fmt.date(h.date, 'dayMonth') })
          : t(`visits.event.${h.kind}`),
    time: fmt.dateTime(h.at),
  }));
  return <Accordion variant="plain" items={[{ id: 'history', title: t('visits.history'), content: <Timeline items={items} /> }]} />;
}
