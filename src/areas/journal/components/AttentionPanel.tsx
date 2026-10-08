'use client';

/**
 * «Требует внимания» (DESIGN.md → Journal A2, п. 4): справа от сетки, 292 px; на экранах уже 1440 px — свёрнута в
 * полосу 56 px со значками и счётчиками. Выбор человека помнится (localStorage). Ширина встаёт сразу, содержимое
 * проявляется со сдвигом (transform/opacity) — сетка перестраивается один раз, а не на каждом кадре.
 *
 * Порядок: (1) ждут подтверждения — строка на заявку и ✓ «подтвердить» тем же вызовом, что и очередь заявок
 * (respondToRequest, F-00-067); (2) можно заполнить окно — свободный час+ и лист ожидания на день → «Предложить окно»
 * открывает лист ожидания журнала (F-01-156); (3) «Дальше» — ближайшие три записи.
 *
 * Заявка без ответа дольше REQUEST_REMINDER_AFTER_MIN минут (⭐ 29.09.2026): панель раз в 20 с просит мок поставить
 * повторное напоминание (remindPendingRequests — идемпотентно, как снятие неоплаченных в JournalScreen) — оно уходит в
 * колокольчик, новое показывается тостом, а строка заявки пишет «напомнили в HH:MM».
 */
import { TimeText } from '@/areas/journal/components/TimeText';
import { useEffect, useEffectEvent, useState, type ReactNode } from 'react';
import { useLocale } from 'next-intl';
import { AlarmClock, Banknote, BellRing, Check, ChevronLeft, ChevronRight, Clock, Hourglass, ListOrdered, MessageCircle, MoreHorizontal, Phone, Timer, TimerReset, UserCheck, UserX } from 'lucide-react';
import type { Booking, BookingStatus, Client, DayHours, Id, ISODate, Service, Staff } from '@/domain/core';
import { changeBookingStatus } from '@/api/core';
import { useDayListActions } from '@/areas/journal/components/DayListActions';
import { findOverruns, lateMinutes, useNowMinuteYerevan, useTodayYerevan } from '@/areas/journal/lib/lateness';
import { sendDelayNotice } from '@/api/schedule';
import { CONFIRM_TOMORROW_EVENT, useTomorrowBookings } from '@/areas/journal/components/ConfirmTomorrowSheet';
import { durationText, todayGaps } from '@/areas/journal/components/FreeTodaySheet';
import { OFFER_GAP_EVENT } from '@/areas/journal/lib/visitTiming';
import { useMoveBooking } from '@/areas/journal/lib/moveBooking';
import { DropdownMenu, type DropdownMenuItem } from '@/ui/DropdownMenu';
import { filterWaitlist, useWaitlist } from '@/api/resources';
import { listRequestReminders, remindPendingRequests } from '@/api/journal-offers';
import { confirmPrepaymentReceived, listOnlineRequests, respondToRequest } from '@/api/online';
import { listBookings } from '@/api/core';
import { markPrepaymentRefunded } from '@/api/journal';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useT } from '@/i18n/useT';
import { useFormat } from '@/i18n/useFormat';
import { cn } from '@/lib/cn';
import { addDays, addMinutes, fromMinutes, nowYerevan } from '@/lib/date';
import { pickText } from '@/lib/text';
import { freeGaps, isActiveBooking, startMinutes, type BookingToneInfo } from '@/areas/journal/lib/board';
import { shortClientName } from '@/areas/journal/lib/clientName';
import { confirmDeadlineOf } from '@/areas/journal/lib/confirmDeadline';
import { useJournalHourFormat } from '@/areas/journal/lib/useJournalHourFormat';
import { renderedJournalStyle } from '@/areas/journal/lib/journalStyle';
import styles from '@/areas/journal/board.module.css';
import { WorkdayAttentionCards, WorkdayStrip } from '@/areas/journal/components/workday/WorkdayAttentionCards';
import { Button } from '@/ui/Button';
import { Skeleton, SkeletonText } from '@/ui/Skeleton';
import { IconButton } from '@/ui/IconButton';
import { useIsMobile } from '@/ui/hooks/useMediaQuery';
import { useToast } from '@/ui/Toast';

export interface AttentionData {
  date: ISODate;
  businessId: Id;
  bookings: Booking[];
  clientsById: Record<Id, Client>;
  staff: Staff[];
  hoursByStaff: Record<Id, DayHours>;
  services: Service[];
  toneOf: (booking: Booking) => BookingToneInfo;
  onOpenBooking: (id: Id) => void;
  onOpenWaitlist: () => void;
  /** Мастер без права видеть чужих: bookings уже только его, «Завтра не подтвердили» — тоже только его */
  onlyStaffId?: Id;
}

/** Всё, что панель показывает, — из данных дня; один расчёт на рендер панели, не на кадр */
export function useAttention({
  date,
  businessId,
  bookings,
  staff,
  hoursByStaff,
  clientsById,
  onOpenBooking,
  onlyStaffId,
  pollReminders = true,
}: Pick<AttentionData, 'date' | 'businessId' | 'bookings' | 'staff' | 'hoursByStaff' | 'clientsById' | 'onOpenBooking' | 'onlyStaffId'> & {
  /** Опрос напоминаний о заявках — только в видимом варианте панели (компьютер / шторка телефона), иначе тост дважды */
  pollReminders?: boolean;
}) {
  const t = useT('journal');
  const toast = useToast();
  const format = useFormat({ hourCycle: useJournalHourFormat() });
  // «Сегодня» и «сейчас» — из тикающих хуков: today()/nowYerevan() в теле React Compiler запоминает (через полночь
  // и через час панель считала бы по времени открытия)
  const todayDate = useTodayYerevan();
  const isToday = date === todayDate;
  // ⭐ Опаздывают: началось LATE_AFTER_MIN+ минут назад, «Пришёл» не отмечен; пересчёт раз в полминуты
  const lateNow = useNowMinuteYerevan(date);
  const nowMinute = lateNow ?? nowYerevan().hour() * 60 + nowYerevan().minute();
  // Окно предлагаем с ближайшей четверти часа, а не с 13:37
  const nowMin = isToday ? Math.ceil(nowMinute / 15) * 15 : 0;
  /** «Сейчас» датой-временем — сравнить со сроком ответа на заявку */
  const nowAt = `${todayDate}T${fromMinutes(nowMinute)}`;
  const active = bookings.filter(isActiveBooking);
  // Подтверждённая заявка уходит из панели сразу, не дожидаясь перечитывания дня (на сервере — до ~1 с): иначе
  // повторный клик по ✓ шлёт второй запрос и получает «Не удалось»
  const [answered, setAnswered] = useState<ReadonlySet<Id>>(() => new Set());
  const markAnswered = (id: Id) => setAnswered((prev) => new Set(prev).add(id));
  // В-03: заявки — по сроку ответа мастера (2 ч с создания, не позже чем за час до начала), ближайший срок первым
  const pending = active.filter((b) => b.status === 'awaiting_confirmation' && !answered.has(b.id)).sort((a, b) => confirmDeadlineOf(a).localeCompare(confirmDeadlineOf(b)));
  let gap: { staff: Staff; from: number; to: number } | undefined;
  for (const s of staff) {
    const g = freeGaps(hoursByStaff[s.id] ?? [], active.filter((b) => b.staffId === s.id), 60, nowMin)[0];
    if (g && (!gap || g.from < gap.from)) gap = { staff: s, ...g };
  }
  const next = active
    .filter((b) => startMinutes(b) >= nowMin && b.status !== 'arrived' && b.status !== 'no_show')
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, 3);
  // Один лист ожидания бизнеса (панель журнала и /biz/waitlist) — активные заявки, которые ждут этот день
  const waitlistQuery = useWaitlist(businessId);
  const waitlistCount = filterWaitlist(waitlistQuery.data ?? [], { status: 'active', dateMode: 'selected', selectedDate: date }, todayDate).length;
  // Повторное напоминание о заявке без ответа: опрос раз в 20 с (и сразу при открытии); новое — тостом со ссылкой на заявку.
  // Заявки других дней тоже: remindPendingRequests смотрит все заявки бизнеса, строка — только про свою.
  const remindersQuery = useApiQuery(['journal', 'request-reminders', businessId], () => listRequestReminders(businessId), {
    enabled: Boolean(businessId),
  });
  const remindTick = useEffectEvent(async () => {
    const fresh = await remindPendingRequests(businessId).catch(() => []);
    for (const r of fresh) {
      const b = bookings.find((x) => x.id === r.bookingId);
      if (!b) continue; // заявка другого дня — напоминание в колокольчике, тост тут не к месту
      const c = b.clientId ? clientsById[b.clientId] : undefined;
      const name = (c?.name ? shortClientName(c.name) : undefined) || b.visitorName || t('block.noClient');
      // Срок ответа уже прошёл (заявку ещё не сняли) — не «ответьте до 12:04» в 15:51, а «срок прошёл»
      const text =
        r.deadline > r.at
          ? t('board.attention.reminderToast', { time: format.time(b.start), name, deadline: format.time(r.deadline) })
          : t('board.attention.reminderToastLate', { time: format.time(b.start), name });
      toast.warning(text, {
        action: { label: t('board.attention.reminderOpen'), onClick: () => onOpenBooking(b.id) },
      });
    }
  });
  useEffect(() => {
    if (!businessId || !pollReminders) return;
    void remindTick();
    const timer = setInterval(() => void remindTick(), 20000);
    return () => clearInterval(timer);
  }, [businessId, pollReminders]);
  const late = active
    .map((b) => ({ booking: b, minutes: lateMinutes(b, lateNow) }))
    .filter((x): x is { booking: Booking; minutes: number } => x.minutes !== null)
    .sort((a, b) => a.booking.start.localeCompare(b.booking.start));
  // «Визит затянулся?» — ответ «Закончили» или отправленное «Задерживаюсь» убирает вопрос до конца сеанса
  const [overrunDone, setOverrunDone] = useState<Set<Id>>(() => new Set(readSessionIds(OVERRUN_KEY)));
  const dismissOverrun = (id: Id) =>
    setOverrunDone((prev) => {
      const next = new Set(prev).add(id);
      writeSessionIds(OVERRUN_KEY, [...next]);
      return next;
    });
  const overruns = findOverruns(active, lateNow).filter((o) => !overrunDone.has(o.current.id));
  // «Завтра N не подтвердили» — только когда смотрят сегодня: вечерний обзвон перед завтрашним днём
  const tomorrow = useTomorrowBookings(isToday && businessId ? [businessId] : [], onlyStaffId);
  // ⭐ Деньги (01.10.2026): клиент нажал «Я оплатил» — сверить и «Деньги пришли»; отменённая запись с «Верните
  // клиенту …» — «Вернул». Обе вещи не про выбранный день: в сетке их не видно (заявка ждёт оплаты, запись отменена)
  const reportedQuery = useApiQuery(['journal', 'attention-reported', businessId, onlyStaffId], () => listOnlineRequests(businessId, onlyStaffId), {
    enabled: Boolean(businessId),
  });
  const refundQuery = useApiQuery(
    ['journal', 'attention-refunds', businessId, onlyStaffId, todayDate],
    () =>
      listBookings({
        businessIds: [businessId],
        staffId: onlyStaffId,
        statuses: ['cancelled_by_client', 'cancelled_by_master', 'no_show'],
        from: addDays(todayDate, -60),
      }),
    { enabled: Boolean(businessId) },
  );
  return {
    late,
    overruns,
    tomorrowToConfirm: isToday ? tomorrow.toConfirm.length : 0,
    reported: (reportedQuery.data ?? []).filter((r) => r.prepaymentReported),
    refunds: (refundQuery.data ?? []).filter((b) => b.prepayment?.paid && (b.prepayment.refundDue ?? 0) > 0 && !b.prepayment.refundedAt),
    // ⭐ Сегодня — все пустоты от 30 мин одной суммой (FreeTodaySheet); другой день — прежнее «Можно заполнить окно»
    freeToday: isToday ? todayGaps(date, staff, hoursByStaff, active, lateNow) : [],
    dismissOverrun,
    pending,
    markAnswered,
    nowAt,
    gap,
    next,
    waitlistCount,
    remindedAt: remindersQuery.data ?? {},
  };
}

const PANEL_KEY = 'journal.attention.open';
const OVERRUN_KEY = 'journal.attention.overrunDone';

function readSessionIds(key: string): Id[] {
  try {
    return JSON.parse(window.sessionStorage.getItem(key) ?? '[]') as Id[];
  } catch {
    return [];
  }
}

function writeSessionIds(key: string, ids: Id[]) {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(ids.slice(-100)));
  } catch {
    /* приватное окно — просто не запомним */
  }
}
/** «Сдвинуть» у опаздывающего — на столько минут */
const LATE_SHIFT_MIN = 15;
/** «Задерживаюсь» следующему клиенту — варианты, мин */
const OVERRUN_DELAYS = [10, 15, 20, 30];

function readPref(): boolean | null {
  try {
    const v = window.localStorage.getItem(PANEL_KEY);
    return v === '1' ? true : v === '0' ? false : null;
  } catch {
    return null;
  }
}

export function AttentionPanel({ loading, ...props }: AttentionData & { loading?: boolean }) {
  const t = useT('journal');
  const [pref, setPref] = useState<boolean | null>(() => (typeof window === 'undefined' ? null : readPref()));
  // «Google» и «Календарь iOS»: справа по умолчанию узкая полоса значков, как у них (раскрыть — по нажатию)
  const flat = renderedJournalStyle() !== 'live';
  // Все виды (BookTime «Живой день», Google, iOS): по умолчанию полоса значков — сетке нужна ширина, как в макетах
  const open = pref ?? false;
  // Панель выезжает, только когда её открыли/свернули сейчас; при открытии страницы она уже на месте — без движения
  const [moved, setMoved] = useState(false);
  const desktop = !useIsMobile();
  const attention = useAttention({ ...props, pollReminders: desktop });
  // «3 ждут подтверждения» в итогах дня раскрывает панель (событие шлёт JournalScreen)
  useEffect(() => {
    const onOpen = () => {
      setMoved(true);
      setPref(true);
    };
    window.addEventListener('journal:attention-open', onOpen);
    return () => window.removeEventListener('journal:attention-open', onOpen);
  }, []);
  const toggle = () => {
    const next = !open;
    setMoved(true);
    setPref(next);
    try {
      window.localStorage.setItem(PANEL_KEY, next ? '1' : '0');
    } catch {
      /* приватное окно — просто не запомним */
    }
  };

  // Полоса и панель смонтированы обе, видна одна (`hidden`): раскрытие не пересоздаёт содержимое панели
  // (DESIGN.md → «Nothing blinks»). Вход проигрывается сам — CSS-анимация перезапускается при снятии display:none.
  return (
    <aside aria-label={t('board.attention.title')} className={cn('hidden shrink-0 md:block', open ? 'w-[292px]' : 'w-14')}>
      <div
        hidden={open}
        className={cn(
          moved && styles.stripIn,
          'h-full flex-col items-center gap-4 bg-surface py-3',
          flat ? 'border-l border-border' : 'rounded-2xl border border-border',
          !open && 'flex',
        )}
      >
        <IconButton variant="ghost" size="sm" icon={<ChevronLeft aria-hidden />} label={t('board.attention.expand')} onClick={toggle} />
        {attention.late.length > 0 && (
          <StripButton
            onClick={toggle}
            icon={<AlarmClock aria-hidden />}
            count={attention.late.length}
            tone="bg-danger-soft text-danger"
            label={t('board.attention.lateTitle', { n: attention.late.length })}
          />
        )}
        {attention.overruns.length > 0 && (
          <StripButton
            onClick={toggle}
            icon={<Timer aria-hidden />}
            count={attention.overruns.length}
            tone="bg-warning-soft text-warning"
            label={t('board.attention.overrunTitle')}
          />
        )}
        {attention.reported.length + attention.refunds.length > 0 && (
          <StripButton
            onClick={toggle}
            icon={<Banknote aria-hidden />}
            count={attention.reported.length + attention.refunds.length}
            tone="bg-success-soft text-success"
            label={t('board.attention.moneyTitle')}
          />
        )}
        <StripButton
          onClick={toggle}
          icon={<Clock aria-hidden />}
          count={attention.pending.length}
          tone="bg-warning-soft text-warning"
          label={t('board.attention.pendingTitle', { n: attention.pending.length })}
        />
        <StripButton
          onClick={toggle}
          icon={<Hourglass aria-hidden />}
          count={attention.gap ? attention.waitlistCount : 0}
          tone="bg-primary-soft text-primary-text"
          label={t('board.attention.gapTitle')}
        />
        <StripButton onClick={toggle} icon={<ListOrdered aria-hidden />} tone="text-muted hover:bg-surface-2" label={t('board.attention.nextTitle')} />
        <WorkdayStrip businessId={props.businessId} date={props.date} onlyStaffId={props.onlyStaffId} />
      </div>
      <div hidden={!open} className={cn(moved && styles.panelIn, 'scrollbar-thin h-full flex-col gap-4 overflow-y-auto pb-2', open && 'flex')}>
        <div className="flex items-center justify-between pl-1">
          <h2 className="text-[15px] font-bold text-fg">{t('board.attention.title')}</h2>
          <IconButton variant="ghost" size="sm" icon={<ChevronRight aria-hidden />} label={t('board.attention.collapse')} onClick={toggle} />
        </div>
        {loading ? <AttentionContentSkeleton /> : <AttentionContent {...props} attention={attention} />}
      </div>
    </aside>
  );
}

/**
 * Панель при первой загрузке журнала — те же секции типичного дня (DESIGN.md → «The skeleton IS the page»): «ждут
 * подтверждения» с двумя строками и подсказкой, «Завтра не подтвердили», «Свободно сегодня» с кнопкой, «Дальше» с тремя
 * записями.
 */
function AttentionContentSkeleton() {
  const t = useT('journal');
  return (
    <div aria-busy className="flex flex-col gap-3">
      <section className="rounded-2xl border border-warning/40 bg-warning-soft p-4">
        <h3 className="flex items-center gap-2 text-sm font-bold text-warning">
          <Clock aria-hidden className="size-4" />
          <SkeletonText width="17ch" />
        </h3>
        <ul className="mt-2 flex flex-col">
          {[0, 1].map((i) => (
            <li key={i} className="flex min-h-11 items-center gap-3">
              <span className="flex min-w-0 flex-1 items-baseline gap-3 text-[13px]">
                <b className="font-bold tabular-nums">
                  <SkeletonText width="5ch" />
                </b>
                <SkeletonText width={i ? '15ch' : '17ch'} />
              </span>
              <IconButton variant="secondary" size="sm" icon={<Check aria-hidden className="text-success" />} label={t('board.attention.title')} disabled />
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-warning">
          <Skeleton lines={3} />
        </p>
      </section>
      <section className="rounded-2xl border border-border bg-surface p-4">
        <h3 className="flex items-center gap-2 text-sm font-bold text-fg">
          <MessageCircle aria-hidden className="size-4 text-primary-text" />
          <SkeletonText width="21ch" />
        </h3>
        <p className="mt-2 text-[13px] leading-snug text-muted">{t('board.confirmTomorrow.panelText')}</p>
        <Button variant="secondary" size="sm" className="mt-3" disabled>
          {t('board.confirmTomorrow.panelAction')}
        </Button>
      </section>
      <section className="rounded-2xl border border-border bg-surface p-4">
        <h3 className="flex items-center gap-2 text-sm font-bold text-fg">
          <Hourglass aria-hidden className="size-4 text-primary-text" />
          <SkeletonText width="20ch" />
        </h3>
        <p className="mt-2 text-[13px] leading-snug text-muted">
          <Skeleton lines={3} />
        </p>
        <Button variant="secondary" size="sm" className="mt-3" disabled>
          {t('board.freeToday.panelAction')}
        </Button>
      </section>
      <section className="rounded-2xl border border-border bg-surface p-4">
        <h3 className="text-sm font-bold text-fg">{t('board.attention.nextTitle')}</h3>
        <ul className="mt-2 flex flex-col">
          {[0, 1, 2].map((i) => (
            <li key={i}>
              <span className="-mx-2 flex min-h-12 w-[calc(100%+1rem)] items-center gap-3 px-2">
                <b className="w-11 shrink-0 text-[13px] font-bold tabular-nums">
                  <SkeletonText width="5ch" />
                </b>
                <Skeleton variant="circle" className="size-3 shrink-0" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[13px] font-semibold">
                    <SkeletonText width={i === 1 ? '9ch' : '8ch'} />
                  </span>
                  <span className="truncate text-xs text-muted">
                    <SkeletonText width={i === 1 ? '22ch' : '26ch'} />
                  </span>
                </span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function StripButton({ icon, count, tone, label, onClick }: { icon: ReactNode; count?: number; tone: string; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn('relative grid size-10 place-items-center rounded-xl transition-colors [&_svg]:size-5', tone)}
    >
      {icon}
      {count ? (
        <span className="absolute -top-1.5 -right-1.5 grid min-w-5 place-items-center rounded-full bg-fg px-1 text-[11px] leading-5 font-bold text-surface tabular-nums">
          {count}
        </span>
      ) : null}
    </button>
  );
}

export function AttentionContent({
  date,
  businessId,
  onlyStaffId,
  bookings,
  hoursByStaff,
  clientsById,
  services,
  staff,
  toneOf,
  onOpenBooking,
  onOpenWaitlist,
  attention,
}: AttentionData & { attention: ReturnType<typeof useAttention> }) {
  const t = useT('journal');
  const tc = useT('common');
  const format = useFormat({ hourCycle: useJournalHourFormat() });
  const toast = useToast();
  const locale = useLocale();
  const confirm = useApiMutation((id: Id) => respondToRequest(id, 'confirm'));
  const [confirming, setConfirming] = useState<Id | null>(null);
  const { late, overruns, dismissOverrun, tomorrowToConfirm, freeToday, pending, gap, next, waitlistCount, remindedAt, reported, refunds } = attention;
  const moneyIn = useApiMutation((id: Id) => confirmPrepaymentReceived(id));
  const refunded = useApiMutation((id: Id) => markPrepaymentRefunded(id));
  const [moneyBusy, setMoneyBusy] = useState<Id | null>(null);
  const moneyAction = async (id: Id, run: () => Promise<unknown>, done: string) => {
    setMoneyBusy(id);
    try {
      await run();
      toast.success(done);
    } catch {
      toast.error(tc('states.actionFailed'));
    } finally {
      setMoneyBusy(null);
    }
  };
  const delay = useApiMutation((a: { id: Id; minutes: number }) => sendDelayNotice(a.id, a.minutes));
  const listActions = useDayListActions();
  const mover = useMoveBooking({ date, clientsById });
  const setStatus = useApiMutation(({ id, status }: { id: Id; status: BookingStatus }) => changeBookingStatus(id, status, 'business'));
  const [lateBusy, setLateBusy] = useState<Id | null>(null);
  const staffName = (id: Id) => staff.find((s) => s.id === id)?.name.split(' ')[0] ?? '';
  const clientName = (b: Booking) => {
    const c = b.clientId ? clientsById[b.clientId] : undefined;
    return (c?.name ? shortClientName(c.name) : undefined) || b.visitorName || t('block.noClient');
  };
  const serviceName = (b: Booking) => {
    const s = services.find((x) => x.id === b.services[0]?.serviceId);
    return s ? pickText(s.name, locale) : t('block.service');
  };

  /** +15 мин: та же проверка, что у переноса мышью; занято — причина тостом, запись на месте */
  const shiftLate = async (b: Booking) => {
    const plan = { staffId: b.staffId, resourceIds: b.resourceIds, startMin: startMinutes(b) + LATE_SHIFT_MIN };
    const issue = mover.check(b, plan, bookings, hoursByStaff[b.staffId]);
    if (issue && issue.kind !== 'hours') return mover.refuse(issue);
    setLateBusy(b.id);
    try {
      await mover.move(b, plan);
    } finally {
      setLateBusy(null);
    }
  };

  /** «Не пришёл» с отменой в тосте; с полученной предоплатой — окно записи: там решают, удержать ли её (F-01-146) */
  const markNoShow = async (b: Booking) => {
    if (b.prepayment?.paid) return onOpenBooking(b.id);
    const prev = b.status;
    setLateBusy(b.id);
    try {
      await setStatus.mutate({ id: b.id, status: 'no_show' });
      toast.success(t('board.attention.noShowToast', { name: clientName(b) }), {
        action: {
          label: t('board.list.undo'),
          onClick: () => void setStatus.mutate({ id: b.id, status: prev }).catch(() => toast.error(tc('states.actionFailed'))),
        },
      });
    } catch {
      toast.error(tc('states.actionFailed'));
    } finally {
      setLateBusy(null);
    }
  };

  /** «Задерживаюсь» следующему клиенту (F-00-059): с приложением — уведомление, без — номер, чтобы позвонить */
  const warnNext = async (o: { current: Booking; next: Booking }, minutes: number) => {
    setLateBusy(o.current.id);
    try {
      const r = await delay.mutate({ id: o.current.id, minutes });
      const name = clientName(o.next);
      if (r.notified) toast.success(t('board.attention.overrunNotified', { name, n: minutes }));
      else if (r.callPhone) toast.info(t('board.attention.overrunCall', { name, phone: format.phone(r.callPhone) }));
      else toast.info(t('board.attention.overrunNoApp', { name }));
      dismissOverrun(o.current.id);
    } catch {
      toast.error(tc('states.actionFailed'));
    } finally {
      setLateBusy(null);
    }
  };

  const onConfirm = async (b: Booking) => {
    setConfirming(b.id);
    try {
      await confirm.mutate(b.id);
      attention.markAnswered(b.id);
      toast.success(t('board.attention.confirmed'));
    } catch {
      toast.error(tc('states.actionFailed'));
    } finally {
      setConfirming(null);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* ⭐ Рабочий день: сводка на сегодня и незакрытые визиты (01.10.2026) */}
      <WorkdayAttentionCards businessId={businessId} date={date} onlyStaffId={onlyStaffId} />
      {/* 0 · Опаздывают — только сегодня, пока визит идёт по времени */}
      {late.length > 0 && (
        <section className="rounded-2xl border border-danger/40 bg-danger-soft p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold text-danger">
            <AlarmClock aria-hidden className="size-4" />
            {t('board.attention.lateTitle', { n: late.length })}
          </h3>
          <ul className="mt-2 flex flex-col gap-1">
            {late.map(({ booking: b, minutes }) => {
              const phone = b.clientId ? clientsById[b.clientId]?.phone : undefined;
              const busy = lateBusy === b.id || listActions.busy[b.id] !== undefined;
              const menu: DropdownMenuItem[] = [
                ...(phone ? [{ id: 'call', label: t('board.list.call'), icon: <Phone aria-hidden />, onSelect: () => void listActions.call(phone) }] : []),
                { id: 'shift', label: t('board.attention.lateShift', { n: LATE_SHIFT_MIN }), icon: <TimerReset aria-hidden />, onSelect: () => void shiftLate(b) },
                { id: 'noshow', label: t('board.attention.lateNoShow'), icon: <UserX aria-hidden />, onSelect: () => void markNoShow(b) },
              ];
              return (
                <li key={b.id} className="flex min-h-11 items-center gap-2">
                  <button type="button" onClick={() => onOpenBooking(b.id)} className="flex min-w-0 flex-1 items-baseline gap-3 text-left text-[13px]">
                    <b className="font-bold text-fg tabular-nums">{format.time(b.start)}</b>
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-fg">
                        {clientName(b)} · <span className="text-danger">{staffName(b.staffId)}</span>
                      </span>
                      <span className="text-xs text-danger">{t('board.attention.lateBy', { n: minutes })}</span>
                    </span>
                  </button>
                  <IconButton
                    variant="secondary"
                    size="sm"
                    icon={<UserCheck aria-hidden className="text-success" />}
                    label={t('board.attention.lateArrived', { name: clientName(b) })}
                    disabled={busy}
                    onClick={() => void listActions.arrive(b, clientName(b))}
                  />
                  <DropdownMenu
                    items={menu}
                    trigger={(tp) => (
                      <IconButton {...tp} variant="ghost" size="sm" icon={<MoreHorizontal aria-hidden />} label={t('board.attention.lateMore', { name: clientName(b) })} disabled={busy} />
                    )}
                  />
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* 0б · Визит затянулся? — следующий клиент мастера скоро, а текущий визит по времени уже кончился */}
      {overruns.length > 0 && (
        <section className="rounded-2xl border border-warning/40 bg-warning-soft p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold text-warning">
            <Timer aria-hidden className="size-4" />
            {t('board.attention.overrunTitle')}
          </h3>
          <ul className="mt-2 flex flex-col gap-3">
            {overruns.map((o) => (
              <li key={o.current.id} className="flex flex-col gap-2">
                <button type="button" onClick={() => onOpenBooking(o.current.id)} className="flex min-w-0 flex-col text-left text-[13px]">
                  <span className="truncate text-fg">
                    <b className="font-bold tabular-nums">{format.time(o.current.start)}</b> {clientName(o.current)} ·{' '}
                    <span className="text-warning">{staffName(o.current.staffId)}</span>
                  </span>
                  <span className="text-xs text-muted">
                    {t('board.attention.overrunLine', {
                      end: format.time(addMinutes(o.current.start, o.current.durationMin)),
                      time: format.time(o.next.start),
                      name: clientName(o.next),
                    })}
                  </span>
                </button>
                <div className="flex flex-wrap gap-2">
                  <DropdownMenu
                    align="start"
                    items={OVERRUN_DELAYS.map((m) => ({
                      id: `d${m}`,
                      label: t('board.attention.overrunDelayBy', { n: m }),
                      onSelect: () => void warnNext(o, m),
                    }))}
                    trigger={(tp) => (
                      <Button {...tp} size="sm" variant="secondary" loading={lateBusy === o.current.id}>
                        {t('board.attention.overrunWarn')}
                      </Button>
                    )}
                  />
                  <Button size="sm" variant="ghost" onClick={() => dismissOverrun(o.current.id)}>
                    {t('board.attention.overrunDone')}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 0в · Деньги: клиент сообщил об оплате / вернуть предоплату отменившему */}
      {reported.length > 0 && (
        <section data-f="F-00-097" className="rounded-2xl border border-success/40 bg-success-soft p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold text-fg">
            <Banknote aria-hidden className="size-4 text-success" />
            {t('board.attention.reportedTitle', { n: reported.length })}
          </h3>
          <ul className="mt-2 flex flex-col gap-1">
            {reported.map((r) => (
              <li key={r.bookingId} className="flex min-h-11 items-center gap-2">
                <button type="button" onClick={() => onOpenBooking(r.bookingId)} className="flex min-w-0 flex-1 flex-col text-left text-[13px]">
                  <span className="truncate text-fg">
                    <b className="font-bold tabular-nums">{format.dateTime(r.start)}</b> {shortClientName(r.clientName)} · {staffName(r.staffId)}
                  </span>
                  <span className="text-xs text-muted">
                    {t('board.attention.reportedLine', { amount: format.money(r.prepaymentReported!.amount), when: format.dateTime(r.prepaymentReported!.at) })}
                  </span>
                </button>
                <Button
                  size="sm"
                  variant="secondary"
                  loading={moneyBusy === r.bookingId}
                  onClick={() =>
                    void moneyAction(r.bookingId, () => moneyIn.mutate(r.bookingId), t('board.attention.moneyReceivedToast', { name: shortClientName(r.clientName) }))
                  }
                >
                  {t('board.attention.moneyReceived')}
                </Button>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">{t('board.attention.reportedHint')}</p>
        </section>
      )}
      {refunds.length > 0 && (
        <section data-f="F-00-100" className="rounded-2xl border border-warning/40 bg-warning-soft p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold text-warning">
            <Banknote aria-hidden className="size-4" />
            {t('board.attention.refundTitle', { n: refunds.length })}
          </h3>
          <ul className="mt-2 flex flex-col gap-1">
            {refunds.map((b) => (
              <li key={b.id} className="flex min-h-11 items-center gap-2">
                <button type="button" onClick={() => onOpenBooking(b.id)} className="flex min-w-0 flex-1 flex-col text-left text-[13px]">
                  <span className="truncate text-fg">
                    <b className="font-bold tabular-nums">{format.dateTime(b.start)}</b> {clientName(b)} · {staffName(b.staffId)}
                  </span>
                  <span className="text-xs text-warning">{t('window.policy.refundDue', { amount: format.money(b.prepayment?.refundDue ?? 0) })}</span>
                </button>
                <Button
                  size="sm"
                  variant="secondary"
                  loading={moneyBusy === b.id}
                  onClick={() => void moneyAction(b.id, () => refunded.mutate(b.id), t('window.policy.refundedToast'))}
                >
                  {t('window.policy.refundDone')}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 1 · Ждут подтверждения */}
      {pending.length > 0 ? (
        <section data-f="F-00-067" className="rounded-2xl border border-warning/40 bg-warning-soft p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold text-warning">
            <Clock aria-hidden className="size-4" />
            {t('board.attention.pendingTitle', { n: pending.length })}
          </h3>
          <ul className="mt-2 flex flex-col">
            {pending.map((b) => (
              <li key={b.id} className="flex min-h-11 items-center gap-3">
                <button type="button" onClick={() => onOpenBooking(b.id)} className="flex min-w-0 flex-1 items-baseline gap-3 text-left text-[13px]">
                  <b className="font-bold text-fg tabular-nums">{format.time(b.start)}</b>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-fg">
                      {clientName(b)} · <span className="text-warning">{staffName(b.staffId)}</span>
                    </span>
                    {remindedAt[b.id] && (
                      <span className="flex items-center gap-1 text-xs text-warning">
                        <BellRing aria-hidden className="size-3" />
                        {t('board.attention.reminded', { time: format.time(remindedAt[b.id]) })}
                      </span>
                    )}
                  </span>
                </button>
                <IconButton
                  variant="secondary"
                  size="sm"
                  icon={<Check aria-hidden className="text-success" />}
                  label={t('board.attention.confirm', { name: clientName(b) })}
                  disabled={confirming === b.id}
                  onClick={() => onConfirm(b)}
                />
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-warning">
            {confirmDeadlineOf(pending[0]) <= attention.nowAt
              ? t('board.attention.pendingHintOverdue')
              : t('board.attention.pendingHint', {
                  time: confirmDeadlineOf(pending[0]).startsWith(attention.nowAt.slice(0, 10))
                    ? format.time(confirmDeadlineOf(pending[0]))
                    : format.dateTime(confirmDeadlineOf(pending[0])),
                })}
          </p>
        </section>
      ) : (
        <section className="flex items-center gap-2 rounded-2xl border border-border bg-surface p-4 text-sm text-muted">
          <Check aria-hidden className="size-4 text-success" />
          {t('board.attention.noPending')}
        </section>
      )}

      {/* 1б · Завтра не подтвердили — WhatsApp из телефона администратора, бесплатно (F-00-121) */}
      {tomorrowToConfirm > 0 && (
        <section data-f="F-00-121" className="rounded-2xl border border-border bg-surface p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold text-fg">
            <MessageCircle aria-hidden className="size-4 text-primary-text" />
            {t('board.confirmTomorrow.panelTitle', { n: tomorrowToConfirm })}
          </h3>
          <p className="mt-2 text-[13px] leading-snug text-muted">{t('board.confirmTomorrow.panelText')}</p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={() => window.dispatchEvent(new Event(CONFIRM_TOMORROW_EVENT))}>
            {t('board.confirmTomorrow.panelAction')}
          </Button>
        </section>
      )}

      {/* 2 · Свободно сегодня — все пустоты одним предложением (листу ожидания, «сообщить», подписчикам) */}
      {freeToday.length > 0 && (
        <section data-f="F-00-101 F-00-103" className="rounded-2xl border border-border bg-surface p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold text-fg">
            <Hourglass aria-hidden className="size-4 text-primary-text" />
            {t('board.freeToday.panelTitle', { time: durationText(freeToday.reduce((sum, g) => sum + (g.to - g.from), 0), t) })}
          </h3>
          <p className="mt-2 text-[13px] leading-snug text-muted">
            {t('board.freeToday.panelText', { n: new Set(freeToday.map((g) => g.staff.id)).size })}
          </p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={() => window.dispatchEvent(new Event(OFFER_GAP_EVENT))}>
            {t('board.freeToday.panelAction')}
          </Button>
        </section>
      )}

      {/* 2б · Можно заполнить окно — другой день (сегодня — «Свободно сегодня» выше) */}
      {freeToday.length === 0 && (
      <section data-f="F-01-156" className="rounded-2xl border border-border bg-surface p-4">
        <h3 className="flex items-center gap-2 text-sm font-bold text-fg">
          <Hourglass aria-hidden className="size-4 text-primary-text" />
          {t('board.attention.gapTitle')}
        </h3>
        {gap ? (
          <>
            <p className="mt-2 text-[13px] leading-snug text-muted">
              {t('board.attention.gapText', {
                name: gap.staff.name.split(' ')[0],
                from: format.time(`2000-01-01T${fromMinutes(gap.from)}`),
                to: format.time(`2000-01-01T${fromMinutes(gap.to)}`),
              })}{' '}
              {t('board.attention.waitlist', { n: waitlistCount })}
            </p>
            <Button variant="secondary" size="sm" className="mt-3" onClick={onOpenWaitlist}>
              {t('board.attention.offer')}
            </Button>
          </>
        ) : (
          <p className="mt-2 text-[13px] text-muted">{t('board.attention.noGap')}</p>
        )}
      </section>
      )}

      {/* 3 · Дальше */}
      <section className="rounded-2xl border border-border bg-surface p-4">
        <h3 className="text-sm font-bold text-fg">{t('board.attention.nextTitle')}</h3>
        {next.length === 0 ? (
          <p className="mt-2 text-[13px] text-muted">{t('board.attention.noNext')}</p>
        ) : (
          <ul className="mt-2 flex flex-col">
            {next.map((b) => {
              const tone = toneOf(b);
              return (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => onOpenBooking(b.id)}
                    className="-mx-2 flex min-h-12 w-[calc(100%+1rem)] items-center gap-3 rounded-lg px-2 text-left transition-colors hover:bg-surface-2"
                  >
                    <b className="min-w-11 shrink-0 text-[13px] font-bold text-fg tabular-nums"><TimeText value={format.time(b.start)} suffixClassName="text-[10px]" /></b>
                    <span
                      aria-hidden
                      style={{ ['--tone-drop' as string]: tone.drop, ['--tone-ring' as string]: tone.ring }}
                      className={cn(styles.dot, 'size-3 shrink-0 rounded-full')}
                    />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-[13px] font-semibold text-fg">{clientName(b)}</span>
                      <span className="truncate text-xs text-muted">
                        {t('board.attention.nextLine', { service: serviceName(b), master: staffName(b.staffId) })}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
