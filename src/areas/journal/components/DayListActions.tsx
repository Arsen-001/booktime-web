'use client';

/**
 * Быстрые действия в строке вида «Список» (⭐ наше, 29.09.2026): «Пришёл», «Оплатить», «Позвонить» — не открывая окно записи.
 * Одна заметная кнопка — следующий шаг визита (пришёл → оплатить → «Оплачено»), звонок — значком, остальное — в «⋯».
 * Логика та же, что у всплывающей карточки «Колонок» (BookingHoverCard): смена статуса + последствия «Пришёл» (F-01-081),
 * мгновенная оплата всей суммы (F-01-141). Статус и «оплачено» меняются в списке сразу (оптимистично), до ответа «сервера».
 */
import { Check, FastForward, FlagTriangleRight, MoreHorizontal, Phone, UserCheck, Wallet } from 'lucide-react';
import { useNowMinuteYerevan } from '@/areas/journal/lib/lateness';
import { canFinishEarly, canStartNow, useVisitTiming } from '@/areas/journal/lib/visitTiming';
import { openNextVisit } from '@/areas/journal/lib/nextVisit';
import { useState } from 'react';
import type { Booking, BookingStatus, Id } from '@/domain/core';
import type { BookingPaymentBrief } from '@/api/finance';
import { changeBookingStatus } from '@/api/core';
import { instantPayBooking, syncArrivedConsequences } from '@/api/journal';
import { optimistic, patchInList, useApiMutation } from '@/api/request';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { copyText } from '@/lib/clipboard';
import { Button } from '@/ui/Button';
import { DropdownMenu, type DropdownMenuItem } from '@/ui/DropdownMenu';
import { IconButton } from '@/ui/IconButton';
import { useIsMobile } from '@/ui/hooks/useMediaQuery';
import { useToast } from '@/ui/Toast';

/** Статусы до прихода: из них «Пришёл» — следующий шаг */
const BEFORE_ARRIVAL: BookingStatus[] = ['awaiting_confirmation', 'awaiting_prepayment', 'scheduled', 'client_confirmed'];
/** Визит не состоится — ни прихода, ни оплаты */
const CLOSED: BookingStatus[] = ['no_show', 'cancelled_by_client', 'cancelled_by_master'];

type Busy = Record<Id, 'arrive' | 'pay'>;

/** Ключ запроса «оплачено» по записям дня списка (DayList) — оптимистичная оплата правит его сразу */
export const LIST_EXTRAS_KEY = ['journal', 'list-extras'] as const;

/** Действия списка на весь день: одни мутации на все строки, «занято» — по строке */
export function useDayListActions() {
  const t = useT('journal');
  const tc = useT('common');
  const format = useFormat();
  const toast = useToast();
  const isMobile = useIsMobile();
  const [busy, setBusy] = useState<Busy>({});

  const setStatus = useApiMutation(
    ({ id, status }: { id: Id; status: BookingStatus }) => changeBookingStatus(id, status, 'business'),
    { optimistic: patchInList(['journal', 'bookings'], ({ id, status }: { id: Id; status: BookingStatus }) => ({ id, patch: { status } })) },
  );
  // «Оплачено» в списке — сводка финансов (listBookingPaymentSummaries): оптимистично остаток сразу 0
  const pay = useApiMutation(({ id, total }: { id: Id; total: number }) => instantPayBooking(id, total), {
    optimistic: optimistic<Record<Id, BookingPaymentBrief>, { id: Id; total: number }>(LIST_EXTRAS_KEY, (old, a) => ({
      ...old,
      [a.id]: { ...old[a.id], total: Math.max(a.total, old[a.id]?.total ?? 0), due: 0, paid: Math.max(a.total, old[a.id]?.total ?? 0), status: 'paid' },
    })),
  });

  const mark = (id: Id, what: 'arrive' | 'pay' | null) =>
    setBusy((prev) => {
      const next = { ...prev };
      if (what) next[id] = what;
      else delete next[id];
      return next;
    });

  const changeStatus = async (b: Booking, status: BookingStatus) => {
    await setStatus.mutate({ id: b.id, status });
    // F-01-081: последствия «Клиент пришёл» — и при входе в «Пришёл», и при выходе из него (отмена в тосте)
    if (status === 'arrived' || b.status === 'arrived') await syncArrivedConsequences(b.id, status);
  };

  const arrive = async (b: Booking, name: string) => {
    const prev = b.status;
    mark(b.id, 'arrive');
    try {
      await changeStatus(b, 'arrived');
      toast.success(t('board.list.arrivedToast', { name }), {
        action: {
          label: t('board.list.undo'),
          onClick: () => {
            changeStatus({ ...b, status: 'arrived' }, prev).catch(() => toast.error(tc('states.actionFailed')));
          },
        },
      });
    } catch {
      toast.error(tc('states.actionFailed'));
    } finally {
      mark(b.id, null);
    }
  };

  // F-01-141: вся сумма в один клик; запись ещё «до прихода» — заодно «Пришёл», как во всплывающей карточке
  const payNow = async (b: Booking, name: string, paid: number) => {
    mark(b.id, 'pay');
    // Полученная предоплата уже строка оплаты (F-00-097) — наличными уходит только остаток
    const rest = Math.max(0, b.total - paid);
    try {
      await pay.mutate({ id: b.id, total: b.total });
      if (BEFORE_ARRIVAL.includes(b.status)) await changeStatus(b, 'arrived');
      // ⭐ Перезапись при расчёте: следующий визит одной кнопкой прямо из тоста оплаты
      toast.success(t('board.list.paidToast', { name, sum: format.money(rest) }), {
        ...(b.clientId ? { action: { label: t('board.nextVisit.short'), onClick: () => openNextVisit(b.id) } } : {}),
        durationMs: 8000,
      });
    } catch {
      toast.error(tc('states.actionFailed'));
    } finally {
      mark(b.id, null);
    }
  };

  const dial = (phone: string) => {
    window.location.href = `tel:${phone.replace(/[^\d+]/g, '')}`;
  };
  // Телефон звонит сразу; на компьютере номер копируется (набрать с телефона), «Позвонить» в тосте — через tel:
  const call = async (phone: string) => {
    if (isMobile) {
      dial(phone);
      return;
    }
    if (await copyText(phone)) {
      toast.success(t('board.list.phoneCopied', { phone: format.phone(phone) }), {
        action: { label: t('board.list.call'), onClick: () => dial(phone) },
      });
    } else dial(phone);
  };

  return { busy, arrive, payNow, call, dial };
}

export type DayListActionsApi = ReturnType<typeof useDayListActions>;

/** Следующий шаг визита: до прихода — «Пришёл» (только сегодня и раньше), пришёл без оплаты — «Оплатить» */
function nextStep(b: Booking, paid: number, canArrive: boolean): 'arrive' | 'pay' | 'paid' | null {
  if (CLOSED.includes(b.status)) return null;
  if (BEFORE_ARRIVAL.includes(b.status)) return canArrive ? 'arrive' : null;
  if (b.total <= 0) return null;
  return paid >= b.total ? 'paid' : 'pay';
}

export function DayListRowActions({
  booking: b,
  name,
  phone,
  paid,
  canArrive,
  api,
  onOpen,
}: {
  booking: Booking;
  name: string;
  /** Только при праве видеть телефоны (showPhones) */
  phone?: string;
  paid: number;
  /** День записи — сегодня или прошлый: «Пришёл» на завтра не предлагаем кнопкой (в «⋯» есть) */
  canArrive: boolean;
  api: DayListActionsApi;
  onOpen: () => void;
}) {
  const t = useT('journal');
  const nowMin = useNowMinuteYerevan(b.start.slice(0, 10));
  const timing = useVisitTiming();
  const busy = api.busy[b.id];
  const step = nextStep(b, paid, canArrive);
  const closed = CLOSED.includes(b.status);
  const unpaid = !closed && b.total > 0 && paid < b.total;

  const items: DropdownMenuItem[] = [
    ...(BEFORE_ARRIVAL.includes(b.status) && step !== 'arrive'
      ? [{ id: 'arrive', label: t('board.list.arrive'), icon: <UserCheck aria-hidden />, onSelect: () => void api.arrive(b, name) }]
      : []),
    ...(unpaid && step !== 'pay'
      ? [{ id: 'pay', label: t('board.list.payAll'), icon: <Wallet aria-hidden />, onSelect: () => void api.payNow(b, name, paid) }]
      : []),
    // ⭐ Не по расписанию: клиент уже здесь раньше времени / визит закончили раньше — время в конце освобождается
    ...(canStartNow(b, nowMin)
      ? [{ id: 'start-now', label: t('board.timing.startNow'), icon: <FastForward aria-hidden />, onSelect: () => void timing.startNow(b) }]
      : []),
    ...(canFinishEarly(b, nowMin)
      ? [{ id: 'finish-early', label: t('board.timing.finishEarly'), icon: <FlagTriangleRight aria-hidden />, onSelect: () => void timing.finishNow(b) }]
      : []),
    ...(phone ? [{ id: 'call', label: t('board.list.call'), icon: <Phone aria-hidden />, onSelect: () => api.dial(phone) }] : []),
    { id: 'open', label: t('board.list.open'), onSelect: onOpen },
  ];

  return (
    <div data-f="F-01-077 F-01-141" className="pointer-events-auto flex items-center gap-1.5 md:justify-end">
      {step === 'arrive' && (
        <Button
          size="md"
          variant="outline"
          data-list-action="arrive"
          leftIcon={<UserCheck aria-hidden />}
          loading={busy === 'arrive'}
          disabled={Boolean(busy)}
          onClick={() => void api.arrive(b, name)}
        >
          {t('board.list.arrive')}
        </Button>
      )}
      {step === 'pay' && (
        <Button
          size="md"
          variant="outline"
          data-list-action="pay"
          leftIcon={<Wallet aria-hidden />}
          loading={busy === 'pay'}
          disabled={Boolean(busy)}
          onClick={() => void api.payNow(b, name, paid)}
        >
          {t('board.list.pay')}
        </Button>
      )}
      {step === 'paid' && (
        <span className="inline-flex h-11 items-center gap-1 px-2 text-sm font-semibold text-success md:h-10">
          <Check aria-hidden className="size-4" />
          {t('board.list.paid')}
        </span>
      )}
      {phone && (
        <IconButton
          data-list-action="call"
          variant="ghost"
          icon={<Phone aria-hidden />}
          label={t('board.list.callName', { name })}
          onClick={() => void api.call(phone)}
        />
      )}
      <DropdownMenu
        label={name}
        items={items}
        trigger={(p) => <IconButton {...p} variant="ghost" icon={<MoreHorizontal aria-hidden />} label={t('board.list.more')} />}
      />
    </div>
  );
}
