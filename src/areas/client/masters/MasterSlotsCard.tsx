'use client';

import { useState } from 'react';
import { BellPlus, BellRing, CalendarX } from 'lucide-react';
import { useLocale } from 'next-intl';
import { listMyWaitlist, type MasterCard } from '@/api/client';
import { useApiQuery } from '@/api/request';
import { WaitlistModal } from '@/areas/client/book/WaitlistModal';
import { SlotsByDay } from '@/areas/client/ui/SlotsByDay';
import { clientKeys } from '@/areas/client/ui/clientKeys';
import { useCurrent } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { pickText } from '@/lib/text';
import { Button, LinkButton } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { EmptyState } from '@/ui/EmptyState';

/**
 * Ближайшее свободное время — сразу под шапкой (ux-r1 улучшение 1, ux-best-c2 №1): день один раз, время кнопками;
 * окна посчитаны под самую короткую услугу и подписаны, для чего (demo-q3/q4). Тап — запись в это время на эту услугу.
 * «Сообщить, когда освободится» — заметной кнопкой, а не подписью (ux-r2 №39).
 */
export function MasterSlotsCard({ card, className }: { card: MasterCard; className?: string }) {
  const t = useT('client');
  const locale = useLocale();
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const { staff, nearestSlots, slotService, services } = card;
  const { ready, appUserId } = useCurrent();
  // Уже в очереди к этому мастеру — видно сразу, без повторной «Сообщить…» (qa 30.09, F-00-102)
  const waitQ = useApiQuery(clientKeys.waitlist(appUserId ?? ''), () => listMyWaitlist(appUserId!), { enabled: ready && Boolean(appUserId) });
  const inQueue = waitQ.data?.some((e) => e.staffId === staff.id && !e.notifiedAt);
  const href = (start: string) =>
    `/book?staff=${staff.id}&slot=${encodeURIComponent(start)}${slotService ? `&service=${slotService.id}` : ''}`;

  return (
    <Card data-f="F-00-101 F-00-102 F-00-108" padding="md" className={className}>
      <div className="flex flex-col gap-3">
        <div>
          <h2 className="font-semibold text-fg">{t('master.nearestSlotsTitle')}</h2>
          {slotService && services.length > 1 && (
            <p className="text-sm text-muted">{t('master.slotsForService', { service: pickText(slotService.name, locale) })}</p>
          )}
        </div>
        {nearestSlots.length ? (
          <SlotsByDay slots={nearestSlots} hrefFor={(s) => href(s.start)} showWorkplace={staff.workplaces.length > 1} />
        ) : (
          <EmptyState variant="inline" icon={<CalendarX />} title={t('master.noSlots')} />
        )}
        {inQueue ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="inline-flex items-center gap-1.5 text-sm font-medium text-success">
              <BellRing aria-hidden className="size-4" />
              {t('master.waitlistInQueue')}
            </p>
            <LinkButton href="/bookings" variant="ghost" size="sm">
              {t('master.waitlistManage')}
            </LinkButton>
          </div>
        ) : services.length > 0 && (
          <Button variant="secondary" size="sm" className="w-fit" leftIcon={<BellPlus aria-hidden />} onClick={() => setWaitlistOpen(true)}>
            {t('master.waitlistCta')}
          </Button>
        )}
      </div>
      <WaitlistModal open={waitlistOpen} onOpenChange={setWaitlistOpen} staffId={staff.id} services={services} />
    </Card>
  );
}
