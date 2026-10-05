'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { CalendarPlus, ChevronRight, LogOut, Ticket, User } from 'lucide-react';
import { getCabinetData, type OnlineCodeChannel, type OnlineCodeSent } from '@/api/online';
import { getPublicBusinessData, sendOnlineBookingCode } from '@/api/online-public';
import { useApiMutation, useApiQuery, type QueryResult } from '@/api/request';
import { CodeChannelPicker, CodeSentVia } from '@/areas/online/booking/wizard/CodeChannelChoice';
import { rememberClient, useRememberedClient } from '@/areas/online/booking/wizard/rememberedClient';
import { useBookingDecisionBroadcast, type BookingDecisionMessage } from '@/areas/online/lib/bookingDecisionChannel';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { normalizePhone } from '@/lib/phone';
import { pickText } from '@/lib/text';
import { Avatar } from '@/ui/Avatar';
import { Badge } from '@/ui/Badge';
import { Button, buttonClasses } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { CodeInput } from '@/ui/CodeInput';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { FormField } from '@/ui/FormField';
import { PhoneInput } from '@/ui/PhoneInput';
import { Skeleton } from '@/ui/Skeleton';

/** Личный кабинет клиента в виджете (F-03-109…112) — вход по номеру и коду, «Мои записи», лояльность */
export function CabinetScreen({ slug }: { slug: string }) {
  const t = useT('online');
  const businessQ = useApiQuery(['online-cabinet-business', slug], () => getPublicBusinessData(slug));
  // F-03-116: время показывается в формате, который бизнес выбрал в «Правилах записи»
  const format = useFormat({ hourCycle: businessQ.data?.hourCycle });

  const [phone, setPhone] = useState('');
  const [codeFor, setCodeFor] = useState<string | undefined>();
  const [demoCode, setDemoCode] = useState<string | undefined>();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [codeWrong, setCodeWrong] = useState(false);
  // Куда прислать код (Telegram / WhatsApp) и куда он ушёл на самом деле
  const [channel, setChannel] = useState<OnlineCodeChannel>('telegram');
  const [sentVia, setSentVia] = useState<{ via: OnlineCodeSent; requested: OnlineCodeChannel } | undefined>();
  // Вход помним как «клиент этого браузера» — тот же номер подставится в записи без кода (О14)
  const remembered = useRememberedClient();
  const loggedPhone = remembered?.phone;
  const codeMutation = useApiMutation(sendOnlineBookingCode);

  const businessId = businessQ.data?.business.id;
  const dataQ = useApiQuery(['online-cabinet-data', businessId, loggedPhone], () => getCabinetData(businessId ?? '', loggedPhone ?? ''), {
    enabled: Boolean(businessId && loggedPhone),
  });

  if (businessQ.isLoading) return <Skeleton variant="rect" className="h-48 rounded-2xl" />;
  if (businessQ.isError || !businessQ.data) return <ErrorState onRetry={businessQ.refetch} />;

  const normalized = normalizePhone(phone);
  const codeSent = Boolean(codeFor && codeFor === normalized);

  const verify = (value: string) => {
    if (!codeFor) return;
    // Мок сверяет с кодом, который ушёл на этот номер; на сервере вход клиента проверит код сам
    const ok = demoCode ? value === demoCode : /^\d{4}$/.test(value);
    if (!ok) {
      setCodeWrong(true);
      setCode('');
      return;
    }
    rememberClient({ phone: codeFor });
  };

  const send = async (via: OnlineCodeChannel) => {
    if (!normalized) {
      setError(t('booking.details.phoneInvalid'));
      return;
    }
    try {
      const { demoCode: demo, ...sent } = await codeMutation.mutate({ slug, phone: normalized, channel: via });
      setCodeFor(normalized);
      setDemoCode(demo);
      setSentVia({ via: sent, requested: via });
      setCode('');
    } catch {
      setError(t('booking.details.codeSendFailed'));
    }
  };

  if (!loggedPhone) {
    return (
      <div className="flex flex-col gap-5" data-f="F-03-109 F-14-078">
        <h1 className="inline-flex items-center gap-2 text-xl font-semibold text-fg">
          <User aria-hidden className="size-5" />
          {t('cabinet.title')}
        </h1>
        <Card padding="lg" className="flex flex-col gap-4">
          <FormField label={t('booking.details.phone')} required error={error || undefined}>
            <PhoneInput
              value={phone}
              onValueChange={(v) => {
                setPhone(v);
                setError('');
              }}
            />
          </FormField>
          {codeSent && (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted">{t('booking.details.codeEnterHint')}</p>
              <CodeInput
                length={4}
                value={code}
                onValueChange={(v) => {
                  setCode(v);
                  setCodeWrong(false);
                }}
                onComplete={verify}
                invalid={codeWrong}
                autoFocus
                aria-label={t('booking.details.codeLabel')}
              />
              {demoCode && <p className="text-sm text-muted">{t('cabinet.demoCode', { code: demoCode })}</p>}
              {codeWrong && <p className="text-sm text-danger">{t('booking.details.codeWrong')}</p>}
            </div>
          )}
          {!codeSent && <CodeChannelPicker value={channel} onChange={setChannel} />}
          {codeSent && sentVia && <CodeSentVia sent={sentVia.via} requested={sentVia.requested} pending={codeMutation.isPending} onSendVia={(c) => void send(c)} />}
          <Button variant={codeSent ? 'secondary' : 'primary'} loading={codeMutation.isPending} onClick={() => void send(codeSent && sentVia ? sentVia.via.channel : channel)}>
            {codeSent ? t('booking.details.resendCode') : t('booking.details.sendCode')}
          </Button>
        </Card>
      </div>
    );
  }

  return <CabinetBody slug={slug} onLogout={() => rememberClient(undefined)} dataQ={dataQ} format={format} />;
}

function CabinetBody({
  slug,
  onLogout,
  dataQ,
  format,
}: {
  slug: string;
  onLogout: () => void;
  dataQ: QueryResult<Awaited<ReturnType<typeof getCabinetData>>>;
  format: ReturnType<typeof useFormat>;
}) {
  const t = useT('online');
  const upcomingStatuses = dataQ.data?.upcoming.map((b) => b.status).join(',');
  const hasPending = dataQ.data?.upcoming.some((b) => b.status === 'awaiting_confirmation') ?? false;

  // F-00-067: решение мастера из другой вкладки — через BroadcastChannel прямо в кэш (см. BookingConfirmedScreen.tsx)
  const queryClient = useQueryClient();
  const onBookingDecision = useCallback(
    (msg: BookingDecisionMessage) => {
      queryClient.setQueriesData({ queryKey: ['online-cabinet-data'] }, (old: typeof dataQ.data) =>
        old ? { ...old, upcoming: old.upcoming.map((b) => (b.id === msg.bookingId ? { ...b, status: msg.status } : b)) } : old,
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dataQ только для типа updater'а, не для значения
    [queryClient],
  );
  useBookingDecisionBroadcast(onBookingDecision);
  useEffect(() => {
    if (!hasPending) return;
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      void Notification.requestPermission();
    }
    const id = setInterval(() => dataQ.refetch(), 15_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasPending]);

  const prevStatusesRef = useRef<Record<string, string>>({});
  useEffect(() => {
    const upcoming = dataQ.data?.upcoming;
    if (!upcoming) return;
    for (const b of upcoming) {
      const prev = prevStatusesRef.current[b.id];
      if (prev === 'awaiting_confirmation' && (b.status === 'scheduled' || b.status === 'cancelled_by_master')) {
        try {
          const title = b.status === 'scheduled' ? t('confirmed.pushDecisionConfirmed') : t('confirmed.pushDecisionDeclined');
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') new Notification(title);
        } catch {
          /* см. BookingConfirmedScreen.tsx */
        }
      }
      prevStatusesRef.current[b.id] = b.status;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upcomingStatuses]);

  const header = (
    <div className="flex items-center justify-between gap-2">
      <h1 className="text-xl font-semibold text-fg">{t('cabinet.myBookings')}</h1>
      <button
        type="button"
        onClick={onLogout}
        data-f="F-03-112"
        className="inline-flex size-10 items-center justify-center rounded-lg text-muted hover:bg-surface-2"
        aria-label={t('cabinet.logout')}
      >
        <LogOut aria-hidden className="size-4" />
      </button>
    </div>
  );

  if (dataQ.isLoading) {
    return (
      <div className="flex flex-col gap-5" aria-busy="true">
        {header}
        <Skeleton variant="rect" className="h-40 rounded-xl" />
      </div>
    );
  }
  // О18: с этим номером записей ещё нет — это не обрыв связи, а пустой кабинет с «Записаться»
  if ((dataQ.error as { code?: string } | undefined)?.code === 'not_found') {
    return (
      <div className="flex flex-col gap-5" data-f="F-03-110">
        {header}
        <EmptyState
          icon={<CalendarPlus aria-hidden />}
          title={t('cabinet.emptyTitle')}
          description={t('cabinet.emptyDescription')}
          action={
            <Link href={`/b/${slug}/book`} className={buttonClasses({})}>
              {t('cabinet.book')}
            </Link>
          }
        />
      </div>
    );
  }
  if (dataQ.isError || !dataQ.data) return <ErrorState onRetry={dataQ.refetch} />;

  const { upcoming, past, services, staffNames, loyalty, accessHashes } = dataQ.data;

  return (
    <div className="flex flex-col gap-5" data-f="F-03-110">
      {header}

      <Link href={`/b/${slug}/book`} className={buttonClasses({ variant: 'secondary', fullWidth: true })} data-f="F-03-112">
        {t('cabinet.newBooking')}
      </Link>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted">{t('cabinet.upcoming')}</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted">{t('cabinet.noUpcoming')}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {upcoming.map((b) => (
              <BookingCard key={b.id} booking={b} services={services} staffName={staffNames[b.staffId]} format={format} slug={slug} hash={accessHashes[b.id]} />
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted">{t('cabinet.past')}</h2>
        {past.length === 0 ? (
          <p className="text-sm text-muted">{t('cabinet.noPast')}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {past.slice(0, 10).map((b) => (
              <BookingCard key={b.id} booking={b} services={services} staffName={staffNames[b.staffId]} format={format} slug={slug} past />
            ))}
          </ul>
        )}
      </section>

      {(loyalty.subscriptions.length > 0 || loyalty.certificates.length > 0) && (
        <section className="flex flex-col gap-2" data-f="F-03-111 F-06-163">
          <h2 className="text-sm font-semibold text-muted">{t('cabinet.loyalty')}</h2>
          {loyalty.subscriptions.map((s) => (
            <Card key={s.id} padding="sm" className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-sm text-fg">
                <Ticket aria-hidden className="size-4 text-muted" />
                {s.name}
              </span>
              <Badge tone={s.status === 'active' ? 'success' : 'neutral'} size="sm">
                {t('cabinet.visitsLeft', { count: s.remainingVisits })}
              </Badge>
            </Card>
          ))}
          {loyalty.certificates.map((c) => (
            <Card key={c.id} padding="sm" className="flex items-center justify-between gap-2">
              <span className="text-sm text-fg">{c.name}</span>
              <Badge tone="neutral" size="sm">
                {format.money(c.balance)}
              </Badge>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
}

/**
 * Запись в кабинете. О20: отмена и перенос — на странице записи, где видны правила (до какого срока бесплатно),
 * а не кнопкой «Отменить» прямо в списке без предупреждения.
 */
function BookingCard({
  booking,
  services,
  staffName,
  format,
  slug,
  past,
  hash,
}: {
  booking: Awaited<ReturnType<typeof getCabinetData>>['upcoming'][number];
  services: Awaited<ReturnType<typeof getCabinetData>>['services'];
  staffName: string | undefined;
  format: ReturnType<typeof useFormat>;
  slug: string;
  past?: boolean;
  hash?: string;
}) {
  const t = useT('online');
  const locale = useLocale();
  const names = booking.services
    .map((l) => (services[l.serviceId] ? pickText(services[l.serviceId].name, locale) : ''))
    .filter(Boolean)
    .join(', ');
  const STATUS_LABEL: Partial<Record<typeof booking.status, string>> = {
    awaiting_confirmation: t('confirmed.status.awaitingConfirmation'),
    awaiting_prepayment: t('confirmed.status.awaitingPrepayment'),
    cancelled_by_master: t('confirmed.status.cancelled'),
  };
  const STATUS_TONE: Partial<Record<typeof booking.status, 'warning' | 'danger'>> = {
    awaiting_confirmation: 'warning',
    awaiting_prepayment: 'warning',
    cancelled_by_master: 'danger',
  };
  const statusLabel = !past ? STATUS_LABEL[booking.status] : undefined;
  const body = (
    <>
      <Avatar name={staffName ?? '?'} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-fg">{names || t('confirmed.services')}</p>
        <p className="text-sm text-muted">
          {format.dateTime(booking.start)} · {staffName}
        </p>
        {statusLabel && (
          <Badge tone={STATUS_TONE[booking.status] ?? 'neutral'} size="sm" className="mt-1">
            {statusLabel}
          </Badge>
        )}
      </div>
    </>
  );
  if (past) {
    return (
      <Card padding="sm" className="flex items-center gap-3">
        {body}
        <Link
          href={`/b/${slug}/book?s=${booking.services.map((l) => l.serviceId).join(',')}&m=${booking.staffId}`}
          className="inline-flex min-h-10 shrink-0 items-center text-sm font-medium text-primary-text hover:underline"
          data-f="F-03-110"
        >
          {t('cabinet.repeat')}
        </Link>
      </Card>
    );
  }
  return hash ? (
    <Link href={`/b/${slug}/booking/${booking.id}?h=${hash}`} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3 transition-colors hover:bg-surface-2">
      {body}
      <span className="inline-flex shrink-0 items-center gap-0.5 text-sm font-medium text-primary-text">
        {t('cabinet.manage')}
        <ChevronRight aria-hidden className="size-4" />
      </span>
    </Link>
  ) : (
    <Card padding="sm" className="flex items-center gap-3">
      {body}
    </Card>
  );
}
