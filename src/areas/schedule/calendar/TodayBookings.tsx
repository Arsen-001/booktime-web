'use client';

/**
 * «Сегодня: записи» (F-00-058 «Закончить раньше», F-00-059 «Задерживаюсь»): одна строка на запись и «⋯» с действиями —
 * без обрезанного Select минут и служебной подсказки (ux-r5 №3.4). «Закончить раньше» — только у идущего визита.
 */
import { AlarmClock, CheckCircle2, MoreHorizontal } from 'lucide-react';
import type { Id } from '@/domain/core';
import { finishEarly, getMasterToday, sendDelayNotice, type MasterTodayBooking } from '@/api/schedule';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { addMinutes } from '@/lib/date';
import { Badge } from '@/ui/Badge';
import { DropdownMenu } from '@/ui/DropdownMenu';
import { IconButton } from '@/ui/IconButton';
import { SectionCard } from '@/ui/SectionCard';
import { Skeleton } from '@/ui/Skeleton';
import { useToast } from '@/ui/Toast';

const DELAY_OPTIONS = [5, 10, 15, 30];

export function TodayBookings({ staffId }: { staffId: Id }) {
  const t = useT('schedule');
  const format = useFormat();
  const toast = useToast();
  const query = useApiQuery(['schedule', 'master-today', staffId], () => getMasterToday(staffId));
  const delay = useApiMutation((a: { id: Id; minutes: number }) => sendDelayNotice(a.id, a.minutes));
  const finish = useApiMutation((id: Id) => finishEarly(id));

  const doDelay = async (b: MasterTodayBooking, minutes: number) => {
    try {
      const r = await delay.mutate({ id: b.id, minutes });
      if (!r.notice.nextBookingId) toast.success(t('actions.delaySentNoOne'));
      else if (r.notified) toast.success(t('actions.delayNotified', { n: minutes }));
      else if (r.callPhone) toast.info(t('actions.delayCallClient', { phone: format.phone(r.callPhone) }));
      else toast.info(t('actions.delayNoApp'));
    } catch {
      toast.error(t('calendar.actionFailed'));
    }
  };

  const doFinish = async (b: MasterTodayBooking) => {
    try {
      const updated = await finish.mutate(b.id);
      toast.success(
        t('actions.finishedEarlyDoneAt', { time: format.time(addMinutes(updated.start, updated.durationMin)), end: format.time(b.end) }),
      );
    } catch {
      toast.error(t('actions.finishFailed'));
    }
  };

  if (query.isLoading) return <Skeleton lines={2} />;
  const list = query.data ?? [];
  if (list.length === 0) return <p className="text-sm text-muted">{t('actions.emptyToday')}</p>;

  return (
    <SectionCard title={t('actions.title')} padding="sm">
      <ul data-f="F-00-058 F-00-059" className="flex flex-col divide-y divide-border" data-tour="schedule-actions">
        {list.map((b) => (
          <li key={b.id} className="flex min-h-12 items-center gap-3 py-1.5">
            <span className="w-12 shrink-0 font-semibold text-fg tabular-nums">{format.time(b.start)}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-fg">{b.clientName || t('actions.noClient')}</p>
            </div>
            {b.ongoing && <Badge tone="success">{t('actions.now')}</Badge>}
            {b.delayMin && <Badge tone="warning">{t('actions.delayedBy', { n: b.delayMin })}</Badge>}
            <DropdownMenu
              label={b.clientName || t('actions.noClient')}
              trigger={(p) => (
                <IconButton
                  {...p}
                  icon={<MoreHorizontal aria-hidden />}
                  label={t('actions.menuFor', { time: format.time(b.start) })}
                  variant="ghost"
                />
              )}
              items={[
                ...(b.ongoing
                  ? [
                      {
                        id: 'finish',
                        label: t('actions.finishEarlyButton'),
                        icon: <CheckCircle2 aria-hidden />,
                        onSelect: () => void doFinish(b),
                      },
                    ]
                  : []),
                { id: 'delay', groupLabel: t('actions.delayGroup') },
                ...DELAY_OPTIONS.map((m) => ({
                  id: `delay-${m}`,
                  label: t('actions.delayBy', { n: m }),
                  icon: <AlarmClock aria-hidden />,
                  onSelect: () => void doDelay(b, m),
                })),
              ]}
            />
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
