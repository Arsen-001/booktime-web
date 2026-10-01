'use client';

import { useState } from 'react';
import { useLocale } from 'next-intl';
import { CalendarClock, CalendarPlus, Check, ChevronRight, Info, MapPin, Navigation, RotateCcw, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { cancelBookingByClient, confirmBookingByClient, type BookingDetail } from '@/api/client';
import { getBusinessRules } from '@/api/online';
import { useApiMutation, useApiQuery } from '@/api/request';
import { LocationReviewForm } from '@/areas/client/bookings/LocationReviewForm';
import { PrepaymentCard } from '@/areas/client/bookings/PrepaymentCard';
import { StaffReviewForm } from '@/areas/client/bookings/StaffReviewForm';
import { StarRatingBlock } from '@/areas/client/bookings/StarRatingBlock';
import { ClientStatusBadge } from '@/areas/client/ui/ClientStatusBadge';
import { clientKeys } from '@/areas/client/ui/clientKeys';
import { useClientFormat } from '@/areas/client/useClientFormat';
import type { Id } from '@/domain/core';
import { reviewModeOf } from '@/domain/online';
import { isActiveBooking } from '@/domain/rules/booking-status';
import { useDisplayName } from '@/areas/client/useDisplayName';
import { useT } from '@/i18n/useT';
import { addMinutes, nowDateTime } from '@/lib/date';
import { pickText } from '@/lib/text';
import { Avatar } from '@/ui/Avatar';
import { Button, LinkButton, buttonClasses } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { PageHeader } from '@/ui/PageHeader';
import { StickyActionBar } from '@/ui/StickyActionBar';
import { useToast } from '@/ui/Toast';

/**
 * Запись глазами клиента (ux-r2 улучшение 2): заголовок — услуга, крупно дата и время «с–до»; кто, где и как
 * добраться; сколько стоит и сколько платить в салоне (без выдуманных «Оплачено», e2e-q2…q4 block); срок бесплатной
 * отмены ДО нажатия. Главное действие — «Подтвердить, что приду», опасное — последней тихой кнопкой.
 */
export function BookingDetailBody({ detail, appUserId }: { detail: BookingDetail; appUserId: Id }) {
  const { booking, staff, business, service, location, shade } = detail;
  const t = useT('client');
  const nameOf = useDisplayName();
  const tc = useT('common');
  const fmt = useClientFormat();
  const locale = useLocale();
  const toast = useToast();
  const [cancelOpen, setCancelOpen] = useState(false);
  // Режим api: экраны читают сервер напрямую — после действия перечитываем запись и списки (code-review 30.09)
  const refreshKeys = [clientKeys.booking(booking.id, appUserId), clientKeys.myBookings(appUserId), clientKeys.upcoming(appUserId)];
  const confirm = useApiMutation((id: Id) => confirmBookingByClient(id, appUserId), { invalidates: refreshKeys });
  const cancel = useApiMutation((id: Id) => cancelBookingByClient(id, appUserId), { invalidates: refreshKeys });
  // В-24: бизнес решает — только звёздочка (по умолчанию) или оценка 1–5 + текст (1:1 с Altegio)
  const reviewRulesQ = useApiQuery(['online-business-rules', business.id], () => getBusinessRules(business.id));
  const reviewMode = reviewRulesQ.data ? reviewModeOf(reviewRulesQ.data) : 'star';

  const active = isActiveBooking(booking);
  const serviceName = service ? pickText(service.name, locale) : t('bookings.serviceRemoved');
  const when = `${fmt.relativeDay(booking.start)}, ${fmt.time(booking.start)}–${fmt.time(addMinutes(booking.start, booking.durationMin))}`;
  // Внутри фразы («до завтра, 07:00», «к Эрику, завтра, 10:00») — со строчной (relativeDay отдаёт «Завтра»)
  const whenInline = lowerFirst(when);
  const canConfirm = booking.status === 'awaiting_confirmation' || booking.status === 'scheduled';
  const seats = booking.services[0]?.qty ?? 1;
  const perSeat = booking.services[0]?.price ?? 0;
  const prepaid = booking.prepayment?.paid ? booking.prepayment.amount : 0;
  // Ещё не оплаченная предоплата — без неё окно не держится, поэтому «на визите» считаем уже без неё (qa 30.09)
  const prepayDue = booking.status === 'awaiting_prepayment' && booking.prepayment && !booking.prepayment.paid ? booking.prepayment.amount : 0;
  const cancelled = booking.status === 'cancelled_by_client' || booking.status === 'cancelled_by_master';
  const refundDue = booking.prepayment?.paid ? (booking.prepayment.refundDue ?? 0) : 0;
  const keepOnLate = detail.keepPrepaymentOnLateCancel ?? true;
  const repeatHref = `/book?staff=${staff.id}&service=${booking.services[0]?.serviceId ?? ''}`;
  // Предложенные окна — пока запись ждёт мастера или уже снята; прошедшие не показываем
  const alternatives =
    booking.status === 'awaiting_confirmation' || booking.status === 'cancelled_by_master'
      ? (booking.alternativeStarts ?? []).filter((x) => x > nowDateTime())
      : [];
  const isHome = booking.workplace === 'home';
  const address =
    booking.workplace === 'visit'
      ? detail.visitAddress
      : isHome
        ? (staff.homeAddress ?? (staff.homeDistrict ? tc(`districts.${staff.homeDistrict}`) : undefined))
        : location
          ? pickText(location.address, locale)
          : undefined;

  const handleConfirm = async () => {
    try {
      await confirm.mutate(booking.id);
      toast.success(t('bookingDetail.confirmed'));
    } catch {
      toast.error(t('bookingDetail.actionFailed'));
    }
  };

  const handleCancel = async () => {
    try {
      const updated = await cancel.mutate(booking.id);
      toast.success(
        updated.cancelledLate
          ? updated.prepayment?.paid && !updated.prepayment.refundDue
            ? t('bookingDetail.cancelledLateKept')
            : t('bookingDetail.cancelledLate')
          : t('bookingDetail.cancelled'),
      );
    } catch {
      toast.error(t('bookingDetail.actionFailed'));
    }
  };

  // «Мастер не ответил» уже сказано значком — вторая строка «Снята: мастер не ответил…» не нужна (qa 30.09)
  // «Перенесена на …» (решение 01.10): клиент взял окно, предложенное мастером — с новым временем
  const statusNote =
    booking.cancelReason === 'rescheduled' && booking.rescheduledTo
      ? tc('bookingCancelReason.rescheduledTo', { date: `${fmt.relativeDay(booking.rescheduledTo)}, ${fmt.time(booking.rescheduledTo)}` })
      : booking.cancelReason && booking.cancelReason !== 'confirmation_expired'
        ? tc(`bookingCancelReason.${booking.cancelReason}`)
        : undefined;

  return (
    <div data-f="F-14-011 F-14-026" className="flex flex-col gap-5">
      <PageHeader
        back={{ href: '/bookings', label: t('bookings.title') }}
        title={serviceName}
        meta={
          <div className="flex flex-col gap-2">
            <p className="flex items-center gap-2 text-lg font-semibold text-fg first-letter:uppercase">
              <CalendarClock aria-hidden className="size-5 text-muted" />
              {when}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <ClientStatusBadge
                status={booking.status}
                reason={booking.cancelReason}
                paymentReported={Boolean(booking.prepayment && !booking.prepayment.paid && (detail.prepaymentReported || booking.prepayment.clientMarkedPaidAt))}
              />
              {statusNote && <span className="text-sm text-muted">{statusNote}</span>}
            </div>
            {booking.status === 'cancelled_by_master' && booking.cancelReason !== 'confirmation_expired' && (
              <p data-f="F-00-100" className="text-sm text-muted">
                {t('bookingDetail.cancelledByMasterHint')}
              </p>
            )}
            {/* ⭐ В-03/О28: мастер не ответил вовремя или предложил другое время — окна кнопками, запись в одно нажатие */}
            {alternatives.length > 0 && (
              <div data-f="F-00-067" className="flex flex-col gap-2 rounded-xl bg-primary-soft/60 p-3">
                <p className="text-sm font-medium text-fg">
                  {booking.cancelReason === 'confirmation_expired' ? t('bookingDetail.altExpired') : t('bookingDetail.altOffered')}
                </p>
                <div className="flex flex-wrap gap-2">
                  {alternatives.map((start) => (
                    <LinkButton key={start} size="sm" variant="secondary" href={`${repeatHref}&slot=${start}`}>
                      <span className="first-letter:uppercase">{`${fmt.relativeDay(start)}, ${fmt.time(start)}`}</span>
                    </LinkButton>
                  ))}
                </div>
              </div>
            )}
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card padding="md" className="flex items-center gap-3">
          <Avatar name={staff.name} src={staff.avatarUrl} colorIndex={staff.colorIndex} size="lg" />
          <div className="min-w-0 flex-1">
            <Link href={`/masters/${staff.id}`} className="inline-flex min-h-11 items-center font-semibold text-fg hover:underline">
              {nameOf(staff.name)}
            </Link>
            {business.kind !== 'individual' && (
              <Link href={`/places/${business.id}`} className="-mt-2 flex min-h-11 items-center gap-1 text-sm text-primary-text hover:underline">
                <span className="truncate">{nameOf(business.name)}</span>
                <ChevronRight aria-hidden className="size-4 shrink-0" />
              </Link>
            )}
          </div>
        </Card>

        <Card padding="md" className="flex flex-col gap-2">
          <p className="flex items-start gap-2 text-fg">
            <MapPin aria-hidden className="mt-0.5 size-5 shrink-0 text-muted" />
            <span>
              {booking.workplace !== 'salon' && <span className="block text-sm text-muted">{tc(`workplace.${booking.workplace}`)}</span>}
              {address ?? t('bookingDetail.addressAfterConfirm')}
            </span>
          </p>
          {location?.yandexMapsUrl && booking.workplace === 'salon' && (
            <a
              href={location.yandexMapsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 w-fit items-center gap-2 rounded-lg px-2 text-sm font-medium text-primary-text hover:bg-surface-2"
            >
              <Navigation aria-hidden className="size-4" />
              {t('bookingDetail.route')}
            </a>
          )}
        </Card>
      </div>

      <Card data-f="F-14-018" padding="md" className="flex flex-col gap-2 text-sm">
        <Row label={t('bookingDetail.price')} value={service ? fmt.moneyRange(service.priceMin, service.priceMax) : fmt.money(booking.total)} />
        <Row label={t('bookingDetail.duration')} value={fmt.duration(booking.durationMin)} />
        {shade && (
          <Row
            label={t('book.shadeTitle')}
            value={shade.mode === 'master' ? t('book.shadeMaster') : shade.mode === 'own' ? t('book.shadeOwn') : (shade.material ?? '')}
          />
        )}
        {booking.forWhom !== 'self' && (
          <Row
            label={t('book.forWhomTitle')}
            value={`${booking.forWhom === 'child' ? t('book.forWhomChild') : t('book.forWhomPet')}${booking.visitorName ? ` · ${booking.visitorName}` : ''}`}
          />
        )}
        {booking.groupEventId && seats > 1 && (
          <Row
            data-f="F-14-023 F-16-092"
            label={t('bookingDetail.seatsLabel')}
            value={`${t('bookingDetail.groupPrice', { price: fmt.money(perSeat) })} × ${seats}`}
          />
        )}
        {detail.byMembership && <Row label={t('bookingDetail.payment')} value={t('bookings.paidByMembership')} />}
        {detail.payment.membershipSavings !== undefined && (
          <Row data-f="F-14-020 F-06-161" label={t('bookingDetail.membershipSavings')} value={fmt.money(detail.payment.membershipSavings)} />
        )}
        {detail.payment.lines.map((line, i) => (
          <Row key={i} data-f="F-14-019 F-06-161" label={t(`bookingDetail.paymentLine.${line.kind}`)} value={`− ${fmt.money(line.amount)}`} />
        ))}
        {prepaid > 0 && !cancelled && <Row label={t('bookingDetail.prepaymentSent')} value={`− ${fmt.money(prepaid)}`} />}
        {prepayDue > 0 && active && (
          <Row
            label={detail.prepaymentReported || booking.prepayment?.clientMarkedPaidAt ? t('bookingDetail.prepaymentSent') : t('bookingDetail.prepaymentDueRow')}
            value={`− ${fmt.money(prepayDue)}`}
          />
        )}
        {cancelled &&
          (prepaid > 0 ? (
            <Row
              data-f="F-14-022 F-00-098"
              label={
                // «Вернул» у мастера обнуляет refundDue и ставит refundedAt — сначала смотрим на него
                booking.prepayment?.refundedAt
                  ? t('bookingDetail.prepaymentRefunded')
                  : refundDue > 0
                    ? t('bookingDetail.prepaymentRefundPending')
                    : t('bookingDetail.prepaymentKeptRow')
              }
              value={fmt.money(refundDue > 0 ? refundDue : prepaid)}
            />
          ) : (
            !detail.byMembership && <Row data-f="F-14-022" label={t('bookingDetail.paidLabel')} value={fmt.money(0)} />
          ))}
        {!detail.byMembership && active && (
          <div className="mt-1 flex items-center justify-between border-t border-border pt-2">
            <span className="text-fg">{t('bookingDetail.toPayAtVisit')}</span>
            <span data-f="F-14-022" className="text-base font-semibold text-fg tabular-nums">
              {fmt.money(Math.max(0, detail.payment.total - prepaid - prepayDue))}
            </span>
          </div>
        )}
        {detail.payment.cashbackEarned > 0 && (
          <Row data-f="F-14-021 F-06-161" label={t('bookingDetail.cashbackEarned')} value={`+ ${fmt.money(detail.payment.cashbackEarned)}`} />
        )}
      </Card>

      {detail.payment.products.length > 0 && (
        <Card data-f="F-14-024 F-08-137" padding="md" className="flex flex-col gap-2 text-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">{t('bookingDetail.productsTitle')}</p>
          {detail.payment.products.map((p, i) => (
            <Row key={i} label={t(`bookingDetail.product.${p.nameKey}`)} value={fmt.money(p.price)} />
          ))}
        </Card>
      )}

      {booking.status === 'awaiting_prepayment' && booking.prepayment && !booking.prepayment.paid && (
        <PrepaymentCard
          bookingId={booking.id}
          appUserId={appUserId}
          amount={booking.prepayment.amount}
          full={booking.prepayment.full}
          reported={detail.prepaymentReported || Boolean(booking.prepayment.clientMarkedPaidAt)}
          requisites={detail.prepaymentRequisites}
          deadline={detail.prepaymentDeadline}
          noShowReason={
            booking.prepayment.reason === 'no_shows' ? { noShows: booking.prepayment.noShows ?? 2, months: booking.prepayment.months ?? 12 } : undefined
          }
        />
      )}

      {active && (
        <p className={`flex items-start gap-2 text-sm ${detail.canCancelFree ? 'text-muted' : 'text-warning'}`}>
          {detail.canCancelFree ? (
            <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
          ) : (
            <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          )}
          {detail.canCancelFree
            ? t('bookingDetail.freeCancelUntil', { when: lowerFirst(`${fmt.relativeDay(detail.freeCancelUntil)}, ${fmt.time(detail.freeCancelUntil)}`) })
            : t('bookingDetail.lateCancelWarning')}
        </p>
      )}

      {booking.status === 'arrived' &&
        (reviewMode === 'text' ? (
          <>
            <StaffReviewForm appUserId={appUserId} staffId={staff.id} businessId={business.id} bookingId={booking.id} />
            {business.kind !== 'individual' && <LocationReviewForm appUserId={appUserId} businessId={business.id} bookingId={booking.id} />}
          </>
        ) : (
          <StarRatingBlock appUserId={appUserId} staffId={staff.id} bookingId={booking.id} />
        ))}

      {active && detail.canCancel === false && (
        <p data-f="F-00-098" className="text-sm text-muted">
          {t('bookingDetail.cancelNotAllowed')}
        </p>
      )}

      {active && detail.canCancel !== false && (
        <div data-f="F-00-098 F-14-015 F-01-123">
          {/* F-16-091: у записи на групповое событие — та же отмена, по одной брони */}
          <span data-f="F-16-091" className="contents">
            <Button variant="ghost" className="-ml-2 text-danger hover:bg-danger-soft" onClick={() => setCancelOpen(true)}>
              {t('bookingDetail.cancel')}
            </Button>
          </span>
        </div>
      )}

      {active ? (
        <StickyActionBar desktop="inline" aria-label={t('bookingDetail.actions')}>
          {detail.canReschedule && (
            <LinkButton
              data-f={booking.groupEventId ? 'F-00-099 F-14-016 F-16-091' : 'F-00-099 F-14-016'}
              href={`/bookings/${booking.id}/reschedule`}
              variant="secondary"
              leftIcon={<CalendarPlus aria-hidden />}
            >
              {t('bookingDetail.reschedule')}
            </LinkButton>
          )}
          {canConfirm ? (
            <Button
              data-f="F-14-057 F-01-089"
              className="h-auto min-h-11 min-w-0 py-2 leading-tight whitespace-normal"
              leftIcon={<Check aria-hidden />}
              onClick={() => void handleConfirm()}
              loading={confirm.isPending}
            >
              {t('bookingDetail.confirmComing')}
            </Button>
          ) : location?.yandexMapsUrl && booking.workplace === 'salon' ? (
            <a href={location.yandexMapsUrl} target="_blank" rel="noreferrer" className={buttonClasses()}>
              <Navigation aria-hidden className="size-5" />
              {t('bookingDetail.route')}
            </a>
          ) : null}
        </StickyActionBar>
      ) : (
        <StickyActionBar desktop="inline" aria-label={t('bookingDetail.actions')}>
          <LinkButton data-f="F-00-118 F-14-012 F-14-029 F-02-095" href={repeatHref} leftIcon={<RotateCcw aria-hidden />}>
            {booking.status === 'arrived' ? t('bookingDetail.repeat') : t('bookingDetail.bookOtherTime')}
          </LinkButton>
        </StickyActionBar>
      )}

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        tone="danger"
        title={t('bookingDetail.cancelConfirmTitle')}
        description={
          <>
            {t('bookingDetail.cancelWhat', { service: serviceName, master: nameOf(staff.name), when: whenInline })}
            <br />
            {detail.canCancelFree ? t('bookingDetail.cancelConfirmFree') : t('bookingDetail.cancelConfirmLate')}
            {prepaid > 0 && (
              <>
                <br />
                <b className="font-semibold text-fg">
                  {!detail.canCancelFree && keepOnLate
                    ? t('bookingDetail.cancelPrepaidKept', { amount: fmt.money(prepaid) })
                    : t('bookingDetail.cancelPrepaidRefund', { amount: fmt.money(prepaid) })}
                </b>
              </>
            )}
          </>
        }
        confirmLabel={t('bookingDetail.cancelConfirmAction')}
        cancelLabel={t('bookingDetail.cancelConfirmKeep')}
        onConfirm={handleCancel}
      />
    </div>
  );
}

function lowerFirst(text: string): string {
  return text ? text[0].toLocaleLowerCase() + text.slice(1) : text;
}

function Row({ label, value, 'data-f': dataF }: { label: string; value: string; 'data-f'?: string }) {
  return (
    <div data-f={dataF} className="flex items-baseline justify-between gap-3">
      <span className="text-muted">{label}</span>
      <span className="text-right text-fg">{value}</span>
    </div>
  );
}
