'use client';

import { useQueryClient } from '@tanstack/react-query';
import { AtSign, CalendarPlus, CircleCheck, Clock3, CreditCard, ExternalLink, Hourglass, MapPin, MessageCircle, Phone, Send, Smartphone, Star } from 'lucide-react';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  addReview,
  bookAlternativeTime,
  cancelOnlineBooking,
  getBookingStatusLog,
  getCancelWindow,
  getOnlineBooking,
  getVisitParts,
  hasReviewed,
  markPrepaymentPaid,
  rescheduleOnlineBooking,
  reschedulesByLink,
} from '@/api/online';
import { ApiError, useApiMutation, useApiQuery } from '@/api/request';
import { CancelBookingDialog } from '@/areas/online/booking/CancelBookingDialog';
import { InviteFriendCard } from '@/areas/online/booking/InviteFriendCard';
import { TelegramRemindersCard } from '@/areas/online/booking/TelegramRemindersCard';
import { googleCalendarHref, icsHref, type CalendarEventInput } from '@/areas/online/booking/calendarFile';
import { RescheduleSheet } from '@/areas/online/booking/RescheduleSheet';
import { useBookingDecisionBroadcast, type BookingDecisionMessage } from '@/areas/online/lib/bookingDecisionChannel';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { addMinutes, nowDateTime, nowYerevan, parse } from '@/lib/date';
import { telLink } from '@/lib/phone';
import { pickText } from '@/lib/text';
import { Avatar } from '@/ui/Avatar';
import { Badge } from '@/ui/Badge';
import { Button, LinkButton, buttonClasses } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { Skeleton } from '@/ui/Skeleton';
import { useToast } from '@/ui/Toast';

const STATUS_TONE = {
  awaiting_confirmation: 'warning',
  awaiting_prepayment: 'warning',
  scheduled: 'success',
  client_confirmed: 'success',
  arrived: 'success',
  no_show: 'danger',
  cancelled_by_client: 'danger',
  cancelled_by_master: 'danger',
} as const;

/** «Вы записаны» / управление записью по ссылке без входа (F-03-097, F-03-098) */
export function BookingConfirmedScreen({ slug, bookingId, hash }: { slug: string; bookingId: string; hash: string | undefined }) {
  const t = useT('online');
  const tc = useT('common');
  const locale = useLocale();
  const toast = useToast();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);

  const q = useApiQuery(['online-booking', bookingId, hash], () => getOnlineBooking(bookingId, hash ?? ''), { enabled: Boolean(hash) });
  const historyQ = useApiQuery(['online-booking-status-log', bookingId], () => getBookingStatusLog(bookingId), { enabled: Boolean(hash) });
  // F-03-116: время показывается в формате, который бизнес выбрал в «Правилах записи»
  const format = useFormat({ hourCycle: q.data?.hourCycle });
  const windowQ = useApiQuery(['online-cancel-window', bookingId, hash], () => getCancelWindow(bookingId, hash ?? ''), { enabled: Boolean(hash) });
  // О4: разные мастера подряд — все части визита вместе
  const partsQ = useApiQuery(['online', 'visit-parts', bookingId, hash], () => getVisitParts(bookingId, hash ?? ''), { enabled: Boolean(hash) });
  // В api публичная страница читает сервер напрямую — после действия перечитываем запись, окно отмены и историю
  const bookingKeys = [['online-booking', bookingId], ['online-cancel-window', bookingId], ['online-booking-status-log', bookingId]];
  const cancelMutation = useApiMutation((args: { id: string; h: string; reason?: string }) => cancelOnlineBooking(args.id, args.h, args.reason), {
    invalidates: bookingKeys,
  });
  const rescheduleMutation = useApiMutation((args: { id: string; h: string; start: string }) => rescheduleOnlineBooking(args.id, args.h, args.start), {
    invalidates: bookingKeys,
  });
  const payMutation = useApiMutation((args: { id: string; h: string }) => markPrepaymentPaid(args.id, args.h), { invalidates: bookingKeys });
  const reviewMutation = useApiMutation(addReview, { invalidates: [['online-reviewed', bookingId]] });
  // ⭐ В-03/О28: окно из «мастер не ответил» / «другое время» — запись одним нажатием (в api —
  // POST /v1/public/bookings/:id/alternative?h=, бэкенд 01.10.2026)
  const altMutation = useApiMutation((start: string) => bookAlternativeTime(bookingId, hash ?? '', start));
  const oneTapAlt = true;
  const router = useRouter();
  // Пока идёт запись в новое окно, карточка с окнами не пропадает (исходная заявка тут же снимается и перерисуется
  // «отменённой») — иначе кнопка размонтируется и переход на новую запись теряется
  const [altFrozen, setAltFrozen] = useState<string[]>();
  const reviewedQ = useApiQuery(['online-reviewed', bookingId, hash], () => hasReviewed(bookingId, 'business', hash ?? ''), { enabled: Boolean(hash) });
  const [now, setNow] = useState(() => Date.now());

  const prepaymentInfo = q.data?.booking.prepayment;
  const paymentReported = Boolean(q.data?.meta?.prepaymentReportedAt);
  const awaitingPrepayment = q.data?.booking.status === 'awaiting_prepayment' && Boolean(prepaymentInfo) && !prepaymentInfo?.paid;
  // holdUntil — местное время Еревана без пояса: переводим в настоящее время через сдвиг «Ереван − устройство»,
  // иначе у клиента в другом поясе таймер оплаты врёт на часы
  const [yerevanShiftMs] = useState(() => nowYerevan().valueOf() - Date.now());
  const holdUntilMs = prepaymentInfo?.holdUntil ? parse(prepaymentInfo.holdUntil).valueOf() - yerevanShiftMs : undefined;
  const secondsLeft = holdUntilMs ? Math.max(0, Math.round((holdUntilMs - now) / 1000)) : undefined;

  useEffect(() => {
    if (!awaitingPrepayment || paymentReported) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [awaitingPrepayment, paymentReported]);

  // F-00-067: решение мастера из другой вкладки приходит через BroadcastChannel — патчим кэш, без похода в базу
  // (подробности — src/areas/online/lib/bookingDecisionChannel.ts). Опрос ниже остаётся резервом.
  const queryClient = useQueryClient();
  const onBookingDecision = useCallback(
    (msg: BookingDecisionMessage) => {
      if (msg.bookingId !== bookingId) return;
      queryClient.setQueriesData({ queryKey: ['online-booking', bookingId] }, (old: typeof q.data) =>
        old ? { ...old, booking: { ...old.booking, status: msg.status } } : old,
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bookingId, queryClient],
  );
  useBookingDecisionBroadcast(onBookingDecision);

  const awaitingDecision = q.data?.booking.status === 'awaiting_confirmation' || (awaitingPrepayment && paymentReported);
  useEffect(() => {
    if (!awaitingDecision || !hash) return;
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      void Notification.requestPermission();
    }
    const id = setInterval(() => q.refetch(), 15_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [awaitingDecision, hash]);

  const prevStatusRef = useRef(q.data?.booking.status);
  useEffect(() => {
    const prev = prevStatusRef.current;
    const current = q.data?.booking.status;
    // В-03: заявку сняло время (мастер не успел ответить) — это не отказ: вместо «Мастер отклонил» ниже карточка с 3 окнами
    const expired = q.data?.booking.cancelReason === 'confirmation_expired';
    if (prev === 'awaiting_confirmation' && current && (current === 'scheduled' || (current === 'cancelled_by_master' && !expired))) {
      const title = current === 'scheduled' ? t('confirmed.pushDecisionConfirmed') : t('confirmed.pushDecisionDeclined');
      toast[current === 'scheduled' ? 'success' : 'error'](title);
      try {
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          new Notification(title);
        }
      } catch {
        /* Notification недоступен — тост выше уже показан */
      }
    }
    prevStatusRef.current = current;
  }, [q.data?.booking.status, q.data?.booking.cancelReason, t, toast]);

  if (!hash) {
    return <EmptyState title={t('public.notFound')} description={t('public.notFoundHint')} />;
  }
  if (q.isLoading) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton variant="rect" className="h-40 rounded-2xl" />
        <Skeleton variant="rect" className="h-11 rounded-lg" />
        <Skeleton variant="rect" className="h-32 rounded-2xl" />
      </div>
    );
  }
  if (q.isError || !q.data) {
    const notFound = (q.error as { code?: string } | undefined)?.code === 'not_found';
    return notFound ? <EmptyState title={t('confirmed.notFound')} description={t('confirmed.notFoundHint')} /> : <ErrorState onRetry={q.refetch} />;
  }

  const { booking, business, location, staff, services, meta } = q.data;
  const end = addMinutes(booking.start, booking.durationMin);
  const cancelled = booking.status === 'cancelled_by_client' || booking.status === 'cancelled_by_master';
  // Визит уже начался или прошёл (пришёл / неявка) — отменять и переносить нечего (как ядро: clientCancelOutcome)
  const finished = booking.status === 'arrived' || booking.status === 'no_show' || booking.start <= nowDateTime();
  const alternatives =
    altFrozen ??
    (booking.status === 'awaiting_confirmation' || booking.status === 'cancelled_by_master'
      ? (booking.alternativeStarts ?? []).filter((x) => x > nowDateTime())
      : []);
  const altHref = (start: string) =>
    `/b/${business.slug}/book?${new URLSearchParams({
      s: booking.services.map((l) => l.serviceId).join(','),
      m: booking.staffId,
      d: start.slice(0, 10),
      t: start,
      ta: booking.staffId,
      step: 'details',
    }).toString()}`;
  const STATUS_LABEL: Record<typeof booking.status, string> = {
    awaiting_confirmation: t('confirmed.status.awaitingConfirmation'),
    awaiting_prepayment: t('confirmed.status.awaitingPrepayment'),
    scheduled: t('confirmed.status.confirmed'),
    client_confirmed: t('confirmed.status.confirmed'),
    arrived: t('confirmed.status.arrived'),
    no_show: t('confirmed.status.noShow'),
    cancelled_by_client: t('confirmed.status.cancelled'),
    cancelled_by_master: t('confirmed.status.cancelled'),
  };
  // О6: после «Я оплатил» — «Оплата на проверке», а не «Вы записаны»: деньги проверяет салон
  const statusLabel = awaitingPrepayment && paymentReported ? t('confirmed.status.paymentReview') : STATUS_LABEL[booking.status];
  const parts = partsQ.data && partsQ.data.length > 1 ? partsQ.data : [];
  const visitEnd = parts.length ? addMinutes(parts[parts.length - 1].start, parts[parts.length - 1].durationMin) : end;
  const manageUrl = typeof window !== 'undefined' ? window.location.href : `/b/${slug}/booking/${bookingId}?h=${hash}`;
  const address = location ? pickText(location.address, locale) : undefined;
  const serviceNames = services.map((s) => pickText(s.name, locale)).join(', ');
  const calendarEvent: CalendarEventInput = {
    uid: `${booking.id}@booktime`,
    start: booking.start,
    end: visitEnd,
    title: `${serviceNames || t('confirmed.services')} — ${business.name}`,
    location: address,
    description: [serviceNames, staff ? t('confirmed.calendar.master', { name: staff.name }) : '', t('confirmed.calendar.manage', { url: manageUrl })]
      .filter(Boolean)
      .join('\n'),
    url: manageUrl,
    reminderMinutes: meta?.reminderMinutesBefore ?? 60,
    stampUtc: new Date(now).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''),
  };
  // Визит из нескольких мастеров подряд переносом одной части не сдвинуть — перенос по ссылке только у одиночной записи
  const canRescheduleByLink = reschedulesByLink() && parts.length === 0;
  const rescheduleAllowed = canRescheduleByLink && Boolean(windowQ.data?.canReschedule);
  const rescheduleUntil = windowQ.data ? addMinutes(booking.start, -windowQ.data.rescheduleWindowHours * 60) : undefined;
  const againHref = `/b/${slug}/book?s=${booking.services.map((l) => l.serviceId).join(',')}&m=${booking.staffId}`;

  return (
    <div data-f="F-03-098 F-10-153">
      <div className="flex flex-col gap-4" data-f="F-03-097 F-14-077">
        <Card padding="lg" className="flex flex-col items-center gap-3 text-center" data-f="F-00-068">
          {!cancelled ? (
            <Badge tone={STATUS_TONE[booking.status]} icon={booking.status === 'awaiting_prepayment' || booking.status === 'awaiting_confirmation' ? <Hourglass aria-hidden /> : <CircleCheck aria-hidden />} size="md">
              {statusLabel}
            </Badge>
          ) : (
            // Сняла система (не пришла предоплата / мастер не успел ответить) — не «отказ»: жёлтая метка и причина словами
            <Badge tone={booking.cancelReason === 'rescheduled' ? 'neutral' : booking.cancelReason ? 'warning' : 'danger'}>
              {booking.cancelReason === 'rescheduled' ? t('confirmed.status.rescheduled') : t('confirmed.status.cancelled')}
            </Badge>
          )}
          {cancelled && booking.cancelReason && (
            <p className="text-sm text-muted">
              {booking.cancelReason === 'rescheduled' && booking.rescheduledTo
                ? tc('bookingCancelReason.rescheduledTo', { date: format.dateTime(booking.rescheduledTo) })
                : tc(`bookingCancelReason.${booking.cancelReason}`)}
            </p>
          )}
          <p className="text-lg font-semibold text-fg first-letter:uppercase">{format.date(booking.start, 'weekdayLong')}</p>
          <p className="flex items-center gap-1.5 text-muted">
            <Clock3 aria-hidden className="size-4" />
            {format.time(parts[0]?.start ?? booking.start)} – {format.time(visitEnd)}
          </p>
          {staff && parts.length === 0 && (
            <div className="flex items-center gap-2">
              <Avatar name={staff.name} src={staff.avatarUrl} colorIndex={staff.colorIndex} size="sm" />
              <span className="text-sm font-medium text-fg">{staff.name}</span>
            </div>
          )}
          {parts.length > 0 && (
            <ul className="flex w-full flex-col gap-1.5 border-t border-border pt-3 text-left" data-f="F-03-130">
              {parts.map((p) => (
                <li key={p.bookingId} className="flex items-start justify-between gap-3 text-sm">
                  <span className="text-fg">
                    {p.serviceNames.map((n) => pickText(n, locale)).join(', ')}
                    <span className="block text-muted">{p.staffName}</span>
                  </span>
                  <span className="shrink-0 text-muted tabular-nums">
                    {format.time(p.start)} – {format.time(addMinutes(p.start, p.durationMin))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* ⭐ В-03/О28: мастер не успел ответить или предложил другое время — окна кнопками, запись в одно нажатие
            (мастер, услуги и время уже выбраны — клиенту остаются только свои данные) */}
        {alternatives.length > 0 && (
          <Card padding="md" className="flex flex-col gap-3 border-primary/30 bg-primary-soft/50" data-f="F-00-067">
            <p className="text-sm font-medium text-fg">
              {booking.cancelReason === 'confirmation_expired' ? t('confirmed.alt.expired') : t('confirmed.alt.offered')}
            </p>
            <div className="flex flex-wrap gap-2">
              {alternatives.map((start) => {
                const label = <span className="first-letter:uppercase">{`${format.date(start, 'weekdayShort')}, ${format.time(start)}`}</span>;
                return oneTapAlt ? (
                  <Button
                    key={start}
                    size="sm"
                    variant="secondary"
                    disabled={altMutation.isPending || Boolean(altFrozen)}
                    onClick={async () => {
                      setAltFrozen(alternatives);
                      try {
                        const r = await altMutation.mutate(start);
                        toast.success(r.booking.status === 'scheduled' ? t('confirmed.alt.booked') : t('confirmed.alt.sent'));
                        router.push(`/b/${business.slug}/booking/${r.booking.id}?h=${r.accessHash}`);
                      } catch (e) {
                        setAltFrozen(undefined);
                        const code = (e as { code?: string } | undefined)?.code;
                        toast.error(code === 'slot_taken' ? t('confirmed.alt.taken') : t('confirmed.alt.failed'));
                      }
                    }}
                  >
                    {label}
                  </Button>
                ) : (
                  <LinkButton key={start} size="sm" variant="secondary" href={altHref(start)}>
                    {label}
                  </LinkButton>
                );
              })}
            </div>
          </Card>
        )}

        {/* О28: клиент перешёл в окно, которое предложил мастер, — старая ссылка ведёт к новой записи */}
        {cancelled && meta?.replacedBy && (
          <Card padding="md" className="flex flex-col gap-3 border-primary/30 bg-primary-soft/50">
            <p className="text-sm font-medium text-fg">
              {t('confirmed.alt.movedTo', { date: `${format.date(meta.replacedBy.start, 'weekdayShort')}, ${format.time(meta.replacedBy.start)}` })}
            </p>
            {meta.replacedBy.hash && (
              <LinkButton size="sm" variant="secondary" href={`/b/${business.slug}/booking/${meta.replacedBy.bookingId}?h=${meta.replacedBy.hash}`}>
                {t('confirmed.alt.openNew')}
              </LinkButton>
            )}
          </Card>
        )}

        {/* О5: блок оплаты — сразу под статусом, а не под кнопками «Перенести/Отменить» */}
        {awaitingPrepayment && !paymentReported && (
          <Card padding="md" className="flex flex-col gap-2 border-warning/40 bg-warning-soft" data-f="F-03-094">
            <h2 className="inline-flex items-center gap-1.5 text-sm font-semibold text-fg">
              <CreditCard aria-hidden className="size-4" />
              {booking.prepayment?.full ? t('confirmed.prepayment.titleFull') : t('confirmed.prepayment.title')}
            </h2>
            <p className="text-2xl font-bold text-fg tabular-nums">{format.money(booking.prepayment?.amount ?? staff?.prepayment?.amount ?? 0)}</p>
            {staff?.prepayment?.requisites && <p className="text-sm text-fg">{t('confirmed.prepayment.requisites', { requisites: staff.prepayment.requisites })}</p>}
            {booking.prepayment?.reason === 'no_shows' && (
              <p className="text-sm text-muted" data-f="F-00-071">
                {t('confirmed.prepayment.noShowsWhy', { count: booking.prepayment.noShows ?? 2, months: booking.prepayment.months ?? 12 })}
              </p>
            )}
            {secondsLeft !== undefined && secondsLeft > 0 ? (
              <p className="text-sm font-medium text-warning">{t('confirmed.prepayment.timeLeft', { minutes: Math.floor(secondsLeft / 60), seconds: secondsLeft % 60 })}</p>
            ) : (
              <p className="text-sm text-danger">{t('confirmed.prepayment.expired')}</p>
            )}
            <Button
              fullWidth
              disabled={secondsLeft === 0}
              loading={payMutation.isPending}
              onClick={async () => {
                try {
                  await payMutation.mutate({ id: bookingId, h: hash });
                  toast.success(t('confirmed.prepayment.paidDone'));
                } catch {
                  toast.error(t('confirmed.prepayment.expired'));
                }
              }}
            >
              {t('confirmed.prepayment.iPaid')}
            </Button>
          </Card>
        )}
        {awaitingPrepayment && paymentReported && (
          <Card padding="md" className="flex items-start gap-3" data-f="F-03-094">
            <Hourglass aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
            <p className="text-sm text-fg">{t('confirmed.prepayment.reportedHint', { amount: format.money(booking.prepayment?.amount ?? 0) })}</p>
          </Card>
        )}

        {!cancelled ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Link href={againHref} className="flex min-h-11 flex-col items-center justify-center rounded-lg bg-surface-2 px-2 py-2 text-center text-xs font-medium text-fg hover:bg-surface-3">
              {t('confirmed.bookAgain')}
            </Link>
            <a
              data-f="F-13-077"
              href={icsHref(calendarEvent)}
              download="booking.ics"
              className="flex min-h-11 flex-col items-center justify-center gap-1 rounded-lg bg-surface-2 px-2 py-2 text-center text-xs font-medium text-fg hover:bg-surface-3"
            >
              <CalendarPlus aria-hidden className="size-4" />
              {t('confirmed.addToCalendar')}
            </a>
            {canRescheduleByLink && !finished && (
              <button
                type="button"
                disabled={!rescheduleAllowed}
                onClick={() => setRescheduleOpen(true)}
                data-f="F-03-099"
                className={`flex min-h-11 flex-col items-center justify-center rounded-lg bg-surface-2 px-2 py-2 text-center text-xs font-medium hover:bg-surface-3 ${
                  rescheduleAllowed ? 'text-fg' : 'cursor-not-allowed text-muted opacity-60'
                }`}
              >
                {t('confirmed.reschedule')}
              </button>
            )}
            {!finished && (
              <button
                type="button"
                onClick={() => setCancelOpen(true)}
                data-f="F-03-100 F-01-123"
                className="flex min-h-11 flex-col items-center justify-center rounded-lg bg-danger-soft px-2 py-2 text-center text-xs font-medium text-danger hover:opacity-90"
              >
                {t('confirmed.cancel')}
              </button>
            )}
          </div>
        ) : (
          // О20: после отмены — «Записаться на другое время» с теми же услугами и мастером
          <div data-f="F-03-100">
            <Link href={againHref} className={buttonClasses({ fullWidth: true })}>
              {t('confirmed.bookOtherTime')}
            </Link>
          </div>
        )}

        {/* ⭐ Напоминания в Telegram — для будущей активной записи с клиентом */}
        {!cancelled && hash && booking.clientId && booking.start > nowDateTime() && <TelegramRemindersCard bookingId={bookingId} hash={hash} />}

        {!cancelled && (
          <a
            href={googleCalendarHref(calendarEvent)}
            target="_blank"
            rel="noreferrer"
            className="-mt-2 inline-flex min-h-10 items-center justify-center gap-1.5 text-sm font-medium text-primary-text hover:underline"
          >
            {t('confirmed.calendar.google')}
            <ExternalLink aria-hidden className="size-3.5" />
          </a>
        )}

        {!cancelled && !finished && windowQ.data && (
          <div className="flex flex-col gap-1 text-center text-xs text-muted">
            {canRescheduleByLink && rescheduleUntil && (
              <p data-f="F-03-066">
                {windowQ.data.canReschedule
                  ? t('confirmed.rescheduleUntil', { date: format.dateTime(rescheduleUntil) })
                  : (windowQ.data.prepaidAmount ?? 0) > 0 && rescheduleUntil > nowDateTime()
                    ? t('confirmed.reschedulePrepaidLocked')
                    : t('confirmed.rescheduleTooLate')}
              </p>
            )}
            <p data-f="F-03-067">
              {windowQ.data.canCancelFree
                ? t('confirmed.cancelDialog.free', { date: format.dateTime(addMinutes(booking.start, -windowQ.data.cancelWindowHours * 60)) })
                : t('confirmed.cancelWindowPassed', { hours: windowQ.data.cancelWindowHours })}
            </p>
          </div>
        )}

        <Card padding="md" className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-fg">{t('confirmed.services')}</h2>
          <ul className="flex flex-col gap-1">
            {services.map((s) => (
              <li key={s.id} className="flex justify-between gap-3 text-sm text-muted">
                <span>{pickText(s.name, locale)}</span>
                <span className="shrink-0 tabular-nums">{format.moneyRange(s.priceMin, s.priceMax)}</span>
              </li>
            ))}
            {/* ⭐ Допродажа: товары, взятые к визиту, — оплата на месте */}
            {(q.data.goods ?? []).map((g, i) => (
              <li key={`g${i}`} className="flex justify-between gap-3 text-sm text-muted">
                <span>
                  {pickText(g.name, locale)}
                  {g.qty > 1 ? ` × ${g.qty}` : ''} · {t('confirmed.goodsAtVisit')}
                </span>
                <span className="shrink-0 tabular-nums">{format.money(g.price * g.qty)}</span>
              </li>
            ))}
          </ul>
        </Card>

        {(historyQ.data ?? []).length > 1 && (
          <Card padding="md" className="flex flex-col gap-1">
            <p className="text-xs font-medium text-muted">{t('confirmed.statusHistory.title')}</p>
            <ul className="flex flex-col gap-1">
              {(historyQ.data ?? [])
                .slice()
                .reverse()
                .map((h, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-fg">
                      {h.status === 'prepayment_reported'
                        ? t('confirmed.status.paymentReview')
                        : h.status === 'time_offered'
                          ? t('confirmed.status.timeOffered')
                          : h.status === 'rescheduled'
                            ? t('confirmed.status.rescheduled')
                          : (STATUS_LABEL[h.status as keyof typeof STATUS_LABEL] ?? h.status)}
                    </span>
                    <span className="shrink-0 text-xs text-muted">{format.dateTime(h.at)}</span>
                  </li>
                ))}
            </ul>
          </Card>
        )}

        <Card padding="md" className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-fg">{t('confirmed.contacts')}</h2>
          <div className="flex items-center gap-3">
            <Avatar name={business.name} size="md" />
            <span className="font-medium text-fg">{business.name || t('public.unnamedBusiness')}</span>
          </div>
          {location?.yandexMapsUrl && (
            <a href={location.yandexMapsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm text-primary-text hover:underline">
              <MapPin aria-hidden className="size-4" />
              {pickText(location.address, locale)}
              <ExternalLink aria-hidden className="size-3.5" />
            </a>
          )}
          <a href={telLink(business.phone)} className="inline-flex items-center gap-1.5 text-sm text-primary-text hover:underline">
            <Phone aria-hidden className="size-4" />
            {format.phone(business.phone)}
          </a>

          {staff?.contacts && (staff.contacts.whatsapp || staff.contacts.telegram || staff.contacts.instagram) && (
            <div className="flex flex-wrap gap-2 pt-1" data-f="F-03-044">
              {staff.contacts.whatsapp && (
                <a
                  href={`https://wa.me/${staff.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(t('confirmed.whatsappText', { business: business.name }))}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-success-soft px-3 text-sm font-medium text-success"
                >
                  <MessageCircle aria-hidden className="size-4" />
                  WhatsApp
                </a>
              )}
              {staff.contacts.telegram && (
                <a
                  href={`https://t.me/${staff.contacts.telegram}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-info-soft px-3 text-sm font-medium text-info"
                >
                  <Send aria-hidden className="size-4" />
                  Telegram
                </a>
              )}
              {staff.contacts.instagram && (
                <a
                  href={`https://instagram.com/${staff.contacts.instagram}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-accent-soft px-3 text-sm font-medium text-accent-text"
                >
                  <AtSign aria-hidden className="size-4" />
                  Instagram
                </a>
              )}
            </div>
          )}
        </Card>

        {booking.status === 'arrived' && (
          <Card padding="md" className="flex flex-col items-center gap-2 text-center" data-f="F-03-105">
            <p className="text-sm font-medium text-fg">{t('confirmed.review.title')}</p>
            {reviewedQ.data ? (
              <Badge tone="success" icon={<Star aria-hidden />} size="sm">
                {t('confirmed.review.thanks')}
              </Badge>
            ) : (
              <button
                type="button"
                disabled={reviewMutation.isPending}
                onClick={async () => {
                  if (!booking.clientId) return;
                  try {
                    await reviewMutation.mutate({ businessId: business.id, target: 'business', targetId: business.id, bookingId: booking.id, clientId: booking.clientId, hash });
                    toast.success(t('confirmed.review.thanks'));
                  } catch {
                    toast.error(t('confirmed.review.failed'));
                  }
                }}
                className="inline-flex min-h-11 items-center gap-1 text-2xl text-warning"
                aria-label={t('confirmed.review.title')}
              >
                {'★★★★★'}
              </button>
            )}
          </Card>
        )}

        {/* ⭐ «Пригласи подругу»: личная ссылка клиента этой записи (если у салона включена программа) */}
        {!cancelled && hash && booking.clientId && <InviteFriendCard bookingId={bookingId} hash={hash} />}

        <Card padding="md" className="flex items-center justify-between gap-3" data-f="F-03-049">
          <div className="min-w-0">
            <p className="text-sm font-medium text-fg">{t('confirmed.appPromo.title')}</p>
            <p className="text-sm text-muted">{t('confirmed.appPromo.hint')}</p>
          </div>
          <Link href={`/b/${slug}/me`} className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg bg-surface-2 px-3 text-sm font-medium text-fg hover:bg-surface-3">
            <Smartphone aria-hidden className="size-4" />
            {t('confirmed.appPromo.open')}
          </Link>
        </Card>

        <CancelBookingDialog
          open={cancelOpen}
          onOpenChange={setCancelOpen}
          start={booking.start}
          cancelWindowHours={windowQ.data?.cancelWindowHours}
          canCancelFree={windowQ.data?.canCancelFree}
          prepaidAmount={windowQ.data?.prepaidAmount}
          keepPrepaymentOnLateCancel={windowQ.data?.keepPrepaymentOnLateCancel}
          allowCancelPrepaid={windowQ.data?.allowCancelPrepaid}
          pending={cancelMutation.isPending}
          hourCycle={q.data.hourCycle}
          onConfirm={async (reason) => {
            try {
              await cancelMutation.mutate({ id: bookingId, h: hash, reason });
              setCancelOpen(false);
              toast.success(t('confirmed.cancelDone'));
            } catch (e) {
              // Мастер запретил отменять оплаченные записи самим — понятная причина, а не «не получилось»
              toast.error(e instanceof ApiError && e.code === 'prepaid_locked' ? tc('bookingErrors.prepaid_locked') : t('confirmed.cancelFailed'));
            }
          }}
        />

        {rescheduleAllowed && (
          <RescheduleSheet
            open={rescheduleOpen}
            onOpenChange={setRescheduleOpen}
            booking={booking}
            slug={business.slug}
            rescheduleUntil={rescheduleUntil}
            pending={rescheduleMutation.isPending}
            hourCycle={q.data.hourCycle}
            onConfirm={async (start) => {
              try {
                await rescheduleMutation.mutate({ id: bookingId, h: hash, start });
                toast.success(t('confirmed.rescheduleDone'));
                setRescheduleOpen(false);
              } catch (e) {
                const code = (e as { code?: string } | undefined)?.code;
                toast.error(code === 'too_late' ? t('confirmed.rescheduleTooLate') : t('confirmed.rescheduleFailed'));
              }
            }}
          />
        )}
      </div>
    </div>
  );
}
