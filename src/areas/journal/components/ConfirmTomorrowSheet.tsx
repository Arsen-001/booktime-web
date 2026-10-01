'use client';

/**
 * ⭐ «Подтвердить завтра» (29.09.2026, контроль рабочего дня; F-00-121 из «Приложений» — теперь в журнале): все
 * записи на завтра, которые клиент ещё не подтвердил. У каждой — WhatsApp с готовым текстом из телефона
 * администратора (бесплатно, без провайдера), «Позвонить» и «Подтвердил» (статус «Клиент подтвердил» сразу).
 * У клиента с нашим приложением — пометка «придёт уведомление», у подключившего Telegram-бота — «напомнит Telegram»:
 * им можно не писать.
 */
import { useLocale } from 'next-intl';
import { Check, MessageCircle, Phone, Send, Smartphone } from 'lucide-react';
import type { Booking, BookingStatus, Client, Id, Service, Staff } from '@/domain/core';
import { changeBookingStatus, listBookings } from '@/api/core';
import { listTelegramLinkedClients } from '@/api/journal';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useDayListActions } from '@/areas/journal/components/DayListActions';
import { shortClientName } from '@/areas/journal/lib/clientName';
import { useJournalHourFormat } from '@/areas/journal/lib/useJournalHourFormat';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { addDays } from '@/lib/date';
import { useTodayYerevan } from '@/areas/journal/lib/lateness';
import { waLink } from '@/lib/phone';
import { pickText } from '@/lib/text';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { IconButton } from '@/ui/IconButton';
import { Sheet } from '@/ui/Sheet';
import { Skeleton } from '@/ui/Skeleton';
import { useToast } from '@/ui/Toast';

/** Журнал открывает шторку по этому событию (панель «Требует внимания», «⋯ Ещё») */
export const CONFIRM_TOMORROW_EVENT = 'journal:confirm-tomorrow';

/** Ждут подтверждения от клиента: записан, но «Клиент подтвердил» ещё нет */
const TO_CONFIRM: BookingStatus[] = ['scheduled'];

/** Записи на завтра — общий ключ для панели (счётчик) и шторки (список) */
export function useTomorrowBookings(businessIds: Id[], onlyStaffId?: Id) {
  // Тикающая дата, а не today(): React Compiler запомнил бы её — после полуночи «завтра» было бы уже сегодня
  const tomorrow = addDays(useTodayYerevan(), 1);
  const q = useApiQuery(['journal', 'bookings', 'tomorrow', businessIds.join(','), tomorrow], () => listBookings({ businessIds, from: tomorrow, to: tomorrow }), {
    enabled: businessIds.length > 0,
  });
  // Мастер без права видеть чужих — только свои записи (владелец 01.10.2026)
  const live = (q.data ?? []).filter((b) => !b.deletedAt && !b.groupEventId && (!onlyStaffId || b.staffId === onlyStaffId));
  // Без клиента подтверждать некому (запись-блок, «Без клиента»)
  const toConfirm = live.filter((b) => TO_CONFIRM.includes(b.status) && Boolean(b.clientId)).sort((a, b) => a.start.localeCompare(b.start));
  const confirmed = live.filter((b) => b.status === 'client_confirmed').length;
  return { ...q, toConfirm, confirmed };
}

export function ConfirmTomorrowSheet({
  open,
  onOpenChange,
  businessIds,
  onlyStaffId,
  businessName,
  clientsById,
  staff,
  services,
  onOpenBooking,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessIds: Id[];
  /** Только записи этого сотрудника (мастер без права видеть чужих) */
  onlyStaffId?: Id;
  businessName: string;
  clientsById: Record<Id, Client>;
  staff: Staff[];
  services: Service[];
  onOpenBooking: (id: Id) => void;
}) {
  const t = useT('journal');
  const tc = useT('common');
  const toast = useToast();
  const locale = useLocale();
  const format = useFormat({ hourCycle: useJournalHourFormat() });
  const list = useTomorrowBookings(businessIds, onlyStaffId);
  const actions = useDayListActions();
  const confirm = useApiMutation((id: Id) => changeBookingStatus(id, 'client_confirmed', 'business'));
  // Клиенты без приложения, которым напомнит Telegram-бот (за сутки и за 2 часа) — каждый бизнес своих
  const noAppIds = list.toConfirm.map((b) => b.clientId).filter((id): id is Id => Boolean(id && !clientsById[id]?.appUserId));
  const tgQuery = useApiQuery(['journal', 'telegramLinked', businessIds.join(','), noAppIds.join(',')], async () => {
    const parts = await Promise.all(businessIds.map((biz) => listTelegramLinkedClients(biz, noAppIds.filter((id) => clientsById[id]?.businessId === biz))));
    return new Set(parts.flat());
  }, { enabled: open && noAppIds.length > 0 });

  const client = (b: Booking) => (b.clientId ? clientsById[b.clientId] : undefined);
  const name = (b: Booking) => {
    const c = client(b);
    return (c?.name ? shortClientName(c.name) : undefined) || b.visitorName || t('block.noClient');
  };
  const service = (b: Booking) => {
    const s = services.find((x) => x.id === b.services[0]?.serviceId);
    return s ? pickText(s.name, locale) : '';
  };
  const master = (b: Booking) => staff.find((s) => s.id === b.staffId)?.name ?? '';

  const message = (b: Booking) =>
    t('board.confirmTomorrow.message', {
      name: client(b)?.name?.split(' ')[0] || name(b),
      time: format.time(b.start),
      service: service(b) || '—',
      master: master(b).split(' ')[0] || '—',
      business: businessName,
    });

  const markConfirmed = async (b: Booking) => {
    try {
      await confirm.mutate(b.id);
      toast.success(t('board.confirmTomorrow.done', { name: name(b) }), {
        action: {
          label: t('board.list.undo'),
          onClick: () => void changeBookingStatus(b.id, 'scheduled', 'business').catch(() => toast.error(tc('states.actionFailed'))),
        },
      });
    } catch {
      toast.error(tc('states.actionFailed'));
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('board.confirmTomorrow.title')}
      description={
        list.isLoading
          ? undefined
          : t('board.confirmTomorrow.subtitle', { n: list.toConfirm.length, confirmed: list.confirmed })
      }
      size="md"
    >
      <div data-f="F-00-121" className="flex flex-col gap-2">
        {list.isLoading ? (
          <Skeleton lines={4} />
        ) : list.toConfirm.length === 0 ? (
          <EmptyState compact icon={<Check aria-hidden className="size-8 text-success" />} title={t('board.confirmTomorrow.empty')} />
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {list.toConfirm.map((b) => {
              const c = client(b);
              const phone = c?.phone;
              return (
                <li key={b.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
                  <button type="button" onClick={() => onOpenBooking(b.id)} className="flex min-w-[13rem] flex-1 items-baseline gap-3 text-left">
                    <b className="w-11 shrink-0 text-sm font-bold text-fg tabular-nums">{format.time(b.start)}</b>
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-semibold text-fg">{name(b)}</span>
                      <span className="truncate text-xs text-muted">{[service(b), master(b).split(' ')[0]].filter(Boolean).join(' · ')}</span>
                      {c?.appUserId ? (
                        <Badge tone="neutral" size="sm" className="mt-1 w-fit">
                          <Smartphone aria-hidden className="size-3" />
                          {t('board.confirmTomorrow.hasApp')}
                        </Badge>
                      ) : (
                        b.clientId &&
                        tgQuery.data?.has(b.clientId) && (
                          <Badge tone="neutral" size="sm" className="mt-1 w-fit">
                            <Send aria-hidden className="size-3" />
                            {t('board.confirmTomorrow.hasTelegram')}
                          </Badge>
                        )
                      )}
                    </span>
                  </button>
                  <div className="flex shrink-0 items-center gap-1.5 sm:ml-14">
                    {phone && (
                      <Button
                        size="sm"
                        variant="secondary"
                        leftIcon={<MessageCircle aria-hidden />}
                        onClick={() => window.open(waLink(phone, message(b)), '_blank', 'noopener,noreferrer')}
                      >
                        WhatsApp
                      </Button>
                    )}
                    {phone && <IconButton size="sm" variant="ghost" icon={<Phone aria-hidden />} label={t('board.list.call')} onClick={() => void actions.call(phone)} />}
                    <Button size="sm" variant="ghost" leftIcon={<Check aria-hidden className="text-success" />} onClick={() => void markConfirmed(b)}>
                      {t('board.confirmTomorrow.confirm')}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-xs text-muted">{t('board.confirmTomorrow.hint')}</p>
      </div>
    </Sheet>
  );
}
