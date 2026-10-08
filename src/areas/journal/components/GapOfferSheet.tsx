'use client';

/**
 * «Живой день» (owner 08.10.2026): «Предложить» на свободном окне сетки — шторка для одного окна мастера: те же
 * каналы, что у «Найти окно» и «Свободно сегодня» (SlotOfferConfirm) — лист ожидания и горящее окно подписчикам
 * (сегодня, со скидкой из «Продвижения»). Услуги окна — мастера и помещаются в окно, короткие первыми.
 */
import type { Id, ISODate, Service, Staff } from '@/domain/core';
import type { SlotOfferTarget } from '@/api/journal-offers';
import { SlotOfferConfirm } from '@/areas/journal/components/SlotOfferConfirm';
import { durationText } from '@/areas/journal/components/FreeTodaySheet';
import { useJournalHourFormat } from '@/areas/journal/lib/useJournalHourFormat';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { fromMinutes } from '@/lib/date';
import { EmptyState } from '@/ui/EmptyState';
import { Sheet } from '@/ui/Sheet';

/** Не больше стольких услуг на окно: лист ожидания сверяет услугу, но сообщение человеку — одно */
const SERVICES_PER_GAP = 4;

export interface OfferGap {
  staffId: Id;
  from: number;
  to: number;
}

export interface GapOfferSheetProps {
  gap: OfferGap | null;
  onClose: () => void;
  businessId: Id;
  date: ISODate;
  staff: Staff[];
  services: Service[];
}

export function GapOfferSheet({ gap, onClose, businessId, date, staff, services }: GapOfferSheetProps) {
  const t = useT('journal');
  const format = useFormat({ hourCycle: useJournalHourFormat() });
  const master = gap ? staff.find((s) => s.id === gap.staffId) : undefined;
  const time = (m: number) => format.time(`${date}T${fromMinutes(m)}`);
  const targets: SlotOfferTarget[] =
    gap && master
      ? services
          .filter((sv) => (sv.staffIds.includes(master.id) || master.serviceIds.includes(sv.id)) && sv.durationMin <= gap.to - gap.from)
          .sort((a, b) => a.durationMin - b.durationMin)
          .slice(0, SERVICES_PER_GAP)
          .map((sv) => ({ businessId, staffId: master.id, serviceId: sv.id, date, time: fromMinutes(gap.from), freeMin: gap.to - gap.from }))
      : [];

  return (
    <Sheet
      open={gap !== null}
      onOpenChange={(open) => !open && onClose()}
      title={t('board.live.offerTitle')}
      description={gap && master ? `${master.name} · ${time(gap.from)}–${time(gap.to)} · ${durationText(gap.to - gap.from, t)}` : undefined}
      size="md"
    >
      {gap && master && targets.length > 0 ? (
        <SlotOfferConfirm
          key={`${gap.staffId}-${gap.from}`}
          businessId={businessId}
          date={date}
          serviceId=""
          serviceName=""
          slots={[]}
          staffById={new Map(staff.map((s) => [s.id, s]))}
          targets={targets}
          title={t('board.live.offerWho')}
          subtitle={t('board.freeToday.offerSubtitle')}
          hideBack
          onBack={onClose}
          onSent={onClose}
        />
      ) : (
        <EmptyState compact title={t('board.live.offerNoServices')} />
      )}
    </Sheet>
  );
}
