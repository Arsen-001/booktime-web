'use client';

/**
 * /biz/billing — «Подписка» (F-15-070/071/072/091/058/033/034/036/037/041/044/045/047, F-00-011…018).
 * Карточки: «Срок действия» (F-15-070/091/058), «Тариф» (F-15-071/033/034/045/047, F-00-011…016),
 * «Что входит» / «Что за монеты» (F-00-018, F-15-041), «История лицензии» (F-15-072).
 * Сеть (F-15-044): своя подписка у каждого филиала — переключатель бизнеса сети сверху.
 * Сервер без платёжного провайдера (06.10.2026, `paymentsAvailable: false`) — вместо «Продлить на месяц сейчас»
 * плашка «Оплата картой скоро — напишите нам», «Купить лицензию» ведёт к счёту для фирмы.
 */
import { AlertTriangle, Building2, Check, ChevronRight, Coins, CreditCard, Gift, ShieldCheck } from 'lucide-react';
import {
  getBillingSeats,
  getSavedPaymentMethod,
  getSubscription,
  listPayments,
  payNow,
  INTRO_TRIAL_DAYS,
  cardPaymentsAvailable,
  isPaymentsUnavailable,
} from '@/api/settings';
import { PaymentsSoonNotice } from '@/areas/settings/PaymentsSoonNotice';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useAutoRenewToggle } from '@/areas/settings/useAutoRenewToggle';
import { useCurrent } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { useFormat } from '@/i18n/useFormat';
import { Avatar } from '@/ui/Avatar';
import { Badge } from '@/ui/Badge';
import { Button, LinkButton } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';
import { Skeleton, SkeletonText } from '@/ui/Skeleton';
import { useSkeletonCount } from '@/ui/hooks/useSkeletonCount';
import { usePagedList } from '@/ui/Pagination';
import { Switch } from '@/ui/Switch';
import { useConfirm, useToast } from '@/ui/Toast';

/** Как у демо-салона владельца: строк расчёта, мест в плате, оплат в истории, плашка статуса срока */
const TYPICAL = { breakdown: 1, seats: 8, payments: 3, statusNote: 1 } as const;

const STATUS_TONE = { active: 'success', freeMonth: 'primary', trial: 'primary', endingSoon: 'warning', frozen: 'danger' } as const;

export function SubscriptionScreen() {
  const t = useT('settings');
  const format = useFormat();
  const toast = useToast();
  const { businessId, ready, networkId, activeLocationIds } = useCurrent();
  const isNetwork = Boolean(networkId) && activeLocationIds.length > 1;
  const confirm = useConfirm();

  const subQ = useApiQuery(['settings', 'subscription', businessId], () => getSubscription(businessId ?? ''), {
    enabled: ready && Boolean(businessId),
  });
  const seatsQ = useApiQuery(['settings', 'seats', businessId], () => getBillingSeats(businessId ?? ''), { enabled: ready && Boolean(businessId) });
  const paymentsQ = useApiQuery(['settings', 'payments', businessId], () => listPayments(businessId ?? ''), {
    enabled: ready && Boolean(businessId),
  });
  const savedMethodQ = useApiQuery(['settings', 'savedMethod', businessId], () => getSavedPaymentMethod(businessId ?? ''), {
    enabled: ready && Boolean(businessId),
  });
  // Постранично, как во всех списках (DESIGN.md → Long lists): места в плате и история лицензии
  const { pageItems: seatsPage, pager: seatsPager } = usePagedList(seatsQ.data ?? []);
  const { pageItems: paymentsPage, pager: paymentsPager } = usePagedList(paymentsQ.data ?? []);
  // Скелетоны — столько же строк, сколько было в прошлый раз (иначе как в демо), см. DESIGN.md «The skeleton IS the page»
  const subLoading = subQ.isLoading || !ready;
  const breakdownRows = useSkeletonCount('breakdown', { loading: subLoading, count: subQ.data?.quote.breakdown.length, fallback: TYPICAL.breakdown });
  const seatRows = useSkeletonCount('seats', { loading: seatsQ.isLoading || !ready, count: seatsQ.data ? seatsPage.length : undefined, fallback: TYPICAL.seats });
  const paymentRows = useSkeletonCount('payments', { loading: paymentsQ.isLoading || !ready, count: paymentsQ.data ? paymentsPage.length : undefined, fallback: TYPICAL.payments });
  // Плашка «скоро конец / заморожено / бесплатный месяц» в карточке срока — была ли в прошлый раз (у демо-салона — «скоро конец»)
  const statusNote = useSkeletonCount('status-note', {
    loading: subLoading,
    count: subQ.data ? Number(subQ.data.status !== 'active') : undefined,
    fallback: TYPICAL.statusNote,
  });

  const autoRenew = useAutoRenewToggle(businessId, subQ.data?.paidUntil);
  const pay = useApiMutation(payNow, {
    invalidates: (args) => [
      ['settings', 'subscription', args.businessId],
      ['settings', 'payments', args.businessId],
    ],
  });

  const onPayNow = async () => {
    if (!businessId || !sub) return;
    const ok = await confirm({
      title: t('billing.payConfirmTitle'),
      description: t('billing.payConfirmDescription', { amount: format.money(sub.quote.monthlyTotal) }),
      confirmLabel: t('billing.payConfirmAction'),
    });
    if (!ok) return;
    try {
      await pay.mutate({ businessId, months: 1 });
      toast.success(t('billing.paySuccess'));
    } catch (e) {
      if (isPaymentsUnavailable(e)) {
        toast.error(t('paymentsSoon.unavailableError'));
        void subQ.refetch();
      } else toast.error(t('billing.payFailed'));
    }
  };

  if (subQ.isError) return <ErrorState onRetry={() => subQ.refetch()} />;

  const sub = subQ.data;
  const isLoading = subQ.isLoading || !ready;
  const canPay = cardPaymentsAvailable(sub);

  // Н3: выключение — тот же вопрос с последствиями, что на «Правилах подписки»
  const onToggleAutoRenew = (value: boolean) => void autoRenew.setAutoRenew(value);

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
      <PageHeader
        title={t('billing.title')}
        description={t('billing.description')}
        back={{ href: '/biz/settings' }}
        meta={
          isNetwork ? (
            <Badge tone="info" size="sm" icon={<Building2 aria-hidden />}>
              {t('billing.networkPerLocation')}
            </Badge>
          ) : undefined
        }
      />

      {/* Срок действия — F-15-070/091/058 */}
      <SectionCard title={t('billing.periodTitle')}>
        {isLoading ? (
          // Та же карточка: статус и «оплачено до», плашка срока, автопродление, способ оплаты, две кнопки
          <div aria-busy className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              {/* Ширины — как у «Заканчивается» и «Оплачено до 3 октября 2026»: на телефоне они так же не влезают в строку */}
              <Badge tone="neutral" size="md">
                <SkeletonText width="13ch" />
              </Badge>
              <span className="text-sm text-muted">
                <SkeletonText width="25ch" />
              </span>
            </div>
            {statusNote > 0 && (
              <div className="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2.5 text-sm text-muted">
                <AlertTriangle aria-hidden className="size-4 shrink-0" />
                {/* Текст плашки на телефоне — в две строки, шире — в одну */}
                <span className="min-w-0 flex-1">
                  <Skeleton lines={2} className="sm:hidden" />
                  <SkeletonText width="48ch" className="max-sm:hidden" />
                </span>
              </div>
            )}
            <Switch checked onCheckedChange={() => {}} disabled label={t('billing.autoRenew')} description={t('billing.autoRenewHint')} />
            <p className="text-sm text-muted">
              <SkeletonText width="22ch" />
            </p>
            <div className="flex flex-wrap gap-3">
              <Button variant="primary" leftIcon={<CreditCard aria-hidden />} disabled>
                {t('billing.payNow')}
              </Button>
              <Button variant="ghost" disabled>
                {t('billing.payNowQuick')}
              </Button>
            </div>
          </div>
        ) : sub ? (
          <div data-f="F-15-070 F-15-091 F-15-058 F-15-057 F-00-023 F-15-082" className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <Badge tone={STATUS_TONE[sub.status]} size="md">
                {t(`billing.status.${sub.status}`)}
              </Badge>
              <span className="text-sm text-muted">{t('billing.paidUntil', { date: format.date(sub.paidUntil, 'long') })}</span>
            </div>
            {sub.status === 'freeMonth' && sub.freeMonthUntil && (
              <div data-f="F-15-060" className="flex flex-col gap-1 rounded-lg bg-primary-soft px-3 py-2.5 text-sm text-primary-text">
                <span className="flex items-center gap-2">
                  <Gift aria-hidden className="size-4 shrink-0" />
                  {t('billing.freeMonthLeft', { days: Math.max(sub.daysLeft, 0) })}
                </span>
                <span className="pl-6 text-xs opacity-90">{t('billing.freeMonthEverything')}</span>
              </div>
            )}
            {sub.status === 'trial' && (
              <div data-f="F-00-019" className="flex flex-col gap-1 rounded-lg bg-primary-soft px-3 py-2.5 text-sm text-primary-text">
                <span className="flex items-center gap-2">
                  <Gift aria-hidden className="size-4 shrink-0" />
                  {t('billing.trialLeft', { days: Math.max(sub.daysLeft, 0), total: INTRO_TRIAL_DAYS })}
                </span>
                <span className="pl-6 text-xs opacity-90">{t('billing.trialEverything')}</span>
              </div>
            )}
            {sub.status === 'frozen' && (
              <div
                data-f="F-15-061 F-00-024 F-15-067 F-15-068"
                className="flex items-center gap-2 rounded-lg bg-danger-soft px-3 py-2.5 text-sm text-danger"
              >
                <AlertTriangle aria-hidden className="size-4 shrink-0" />
                {t('billing.frozenHint')}
              </div>
            )}
            {sub.status === 'endingSoon' && (
              <div className="flex items-center gap-2 rounded-lg bg-warning-soft px-3 py-2.5 text-sm text-warning">
                <AlertTriangle aria-hidden className="size-4 shrink-0" />
                {t('billing.endingSoonHint', { days: Math.max(sub.daysLeft, 0) })}
              </div>
            )}
            <Switch
              checked={sub.autoRenew}
              onCheckedChange={onToggleAutoRenew}
              label={t('billing.autoRenew')}
              description={t('billing.autoRenewHint')}
            />
            {/* Способ оплаты читается отдельно — пока его нет, строка на месте с полосой (подписка уже пришла) */}
            {sub.autoRenew && savedMethodQ.isLoading && (
              <p className="text-sm text-muted">
                <SkeletonText width="22ch" />
              </p>
            )}
            {sub.autoRenew && savedMethodQ.data && (
              <p className="text-sm text-muted">
                {t('billing.savedMethod', { label: savedMethodQ.data.label })}
                {savedMethodQ.data.unavailable && <span className="ml-1 text-warning">{t('billing.savedMethodUnavailable')}</span>}
              </p>
            )}
            {(sub.status === 'endingSoon' || sub.status === 'frozen' || sub.status === 'active') &&
              (canPay ? (
                <div className="flex flex-wrap gap-3">
                  <LinkButton href="/biz/billing/manage" variant="primary" leftIcon={<CreditCard aria-hidden />}>
                    {t('billing.payNow')}
                  </LinkButton>
                  <Button variant="ghost" loading={pay.isPending} onClick={onPayNow}>
                    {t('billing.payNowQuick')}
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <PaymentsSoonNotice />
                  <LinkButton href="/biz/billing/manage" variant="ghost" className="self-start" leftIcon={<Building2 aria-hidden />}>
                    {t('checkout.method.invoice')}
                  </LinkButton>
                </div>
              ))}
          </div>
        ) : null}
      </SectionCard>

      {/* Тариф — F-15-071/033/034/045/047, F-00-011…016 */}
      <SectionCard
        title={t('billing.planTitle')}
        description={t(`billing.planKind.${sub?.quote.kind ?? 'salon'}`)}
        actions={
          isLoading ? (
            // Ссылка «Кто в плате» у салона — на месте уже при загрузке (выключена)
            <Button variant="ghost" size="sm" rightIcon={<ChevronRight aria-hidden />} disabled>
              {t('billing.seeSeats')}
            </Button>
          ) : sub && sub.quote.kind === 'salon' ? (
            <LinkButton href="/biz/billing/seats" variant="ghost" size="sm" rightIcon={<ChevronRight aria-hidden />}>
              {t('billing.seeSeats')}
            </LinkButton>
          ) : undefined
        }
      >
        {isLoading ? (
          <div aria-busy className="flex flex-col gap-3">
            <ul className="flex flex-col gap-1.5">
              {Array.from({ length: breakdownRows }, (_, i) => (
                <li key={i} className="flex items-center justify-between text-sm">
                  <span className="text-muted">
                    <SkeletonText width="16ch" />
                  </span>
                  <span className="nums font-medium text-fg">
                    <SkeletonText width="7ch" />
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex items-end justify-between gap-3 border-t border-border pt-3">
              <span className="text-sm font-medium text-muted">{t('billing.monthlyTotal')}</span>
              <span className="nums num-headline text-fg">
                <SkeletonText width="7ch" />
                <span className="ml-1 text-sm font-medium text-muted">/{t('billing.perMonth')}</span>
              </span>
            </div>
          </div>
        ) : sub ? (
          <div
            data-f="F-15-071 F-15-033 F-15-034 F-15-036 F-15-037 F-15-044 F-15-045 F-15-047 F-00-011 F-00-012 F-00-013 F-00-014 F-00-016 F-00-017 F-14-141 F-08-119"
            className="flex flex-col gap-3"
          >
            <ul className="flex flex-col gap-1.5">
              {sub.quote.breakdown.map((line, i) => (
                <li key={i} className="flex items-center justify-between text-sm">
                  <span className="text-muted">{t(line.labelKey, { count: line.count })}</span>
                  <span className="nums font-medium text-fg">{format.money(line.amount)}</span>
                </li>
              ))}
            </ul>
            <div className="flex items-end justify-between gap-3 border-t border-border pt-3">
              <span className="text-sm font-medium text-muted">{t('billing.monthlyTotal')}</span>
              <span className="nums num-headline text-fg">
                {format.money(sub.quote.monthlyTotal)}
                <span className="ml-1 text-sm font-medium text-muted">/{t('billing.perMonth')}</span>
              </span>
            </div>
            {sub.quote.kind === 'salon' &&
              sub.quote.seats.filter((s) => s.role === 'master' && s.paid).length +
                (sub.quote.seats.find((s) => s.role === 'owner' && s.paid) ? 1 : 0) <
                2 && <p className="text-sm text-muted">{t('billing.singleMasterHint')}</p>}
          </div>
        ) : null}
      </SectionCard>

      {/* Кто в плате — F-15-045 (список, полная страница управления — b03) */}
      <SectionCard title={t('billing.seatsTitle')} description={t('billing.seatsDescription')}>
        {seatsQ.isLoading || !ready ? (
          <ul aria-busy className="flex flex-col divide-y divide-border">
            {Array.from({ length: seatRows }, (_, i) => (
              <li key={i} className="flex items-center gap-3 py-2.5">
                <Skeleton variant="circle" className="size-8 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-fg">
                    <SkeletonText width="16ch" />
                  </span>
                  <span className="block text-xs text-muted">
                    <SkeletonText width="20ch" />
                  </span>
                </span>
                <span className="nums text-sm font-medium text-fg">
                  <SkeletonText width="7ch" />
                </span>
              </li>
            ))}
          </ul>
        ) : seatsQ.isError ? (
          <ErrorState compact onRetry={() => seatsQ.refetch()} />
        ) : !seatsQ.data?.length ? (
          <EmptyState compact />
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {seatsPage.map((seat) => (
              <li key={seat.staffId} className="flex items-center gap-3 py-2.5">
                <Avatar name={seat.name} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-fg">{seat.name}</span>
                  <span className="block text-xs text-muted">{t(`billing.seatReason.${seat.reasonKey}`)}</span>
                </span>
                <span className={seat.paid ? 'nums text-sm font-medium text-fg' : 'text-sm text-muted'}>
                  {seat.paid ? format.money(seat.price) : t('billing.free')}
                </span>
              </li>
            ))}
          </ul>
        )}
        {!seatsQ.isError && seatsPager}
      </SectionCard>

      {/* Что входит / что за монеты — F-00-018, F-15-041 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SectionCard title={t('billing.includedTitle')}>
          <ul data-f="F-00-018 F-15-041 F-14-167" className="flex flex-col gap-2">
            {(['prices', 'photos', 'crm', 'journal', 'onlineBooking'] as const).map((key) => (
              <li key={key} className="flex items-start gap-2 text-sm text-fg">
                <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />
                {t(`billing.included.${key}`)}
              </li>
            ))}
          </ul>
        </SectionCard>
        <SectionCard
          title={t('billing.coinsCardTitle')}
          description={t('billing.coinsCardDescription')}
          actions={
            <LinkButton href="/biz/coins" variant="ghost" size="sm" leftIcon={<Coins aria-hidden />}>
              {t('billing.coinsCardLink')}
            </LinkButton>
          }
        >
          <p className="text-sm text-muted">{t('billing.coinsCardHint')}</p>
        </SectionCard>
      </div>

      {/* История лицензии — F-15-072 */}
      <SectionCard title={t('billing.historyTitle')}>
        {paymentsQ.isLoading || !ready ? (
          <ul aria-busy className="flex flex-col divide-y divide-border">
            {Array.from({ length: paymentRows }, (_, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block text-fg">
                    <SkeletonText width="14ch" />
                  </span>
                  <span className="block text-xs text-muted">
                    <SkeletonText width="18ch" />
                  </span>
                </span>
                <span className="nums font-medium text-fg">
                  <SkeletonText width="7ch" />
                </span>
                <Badge tone="neutral" size="sm">
                  <SkeletonText width="7ch" />
                </Badge>
                <Button variant="ghost" size="sm" disabled>
                  {t('billing.openReceipt')}
                </Button>
              </li>
            ))}
          </ul>
        ) : paymentsQ.isError ? (
          <ErrorState compact onRetry={() => paymentsQ.refetch()} />
        ) : !paymentsQ.data?.length ? (
          <EmptyState compact icon={<ShieldCheck aria-hidden />} description={t('billing.historyEmpty')} />
        ) : (
          <ul data-f="F-15-072 F-15-073" className="flex flex-col divide-y divide-border">
            {paymentsPage.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block text-fg">{format.date(p.date, 'long')}</span>
                  <span className="block text-xs text-muted">
                    {t('billing.periodMonths', { count: p.periodMonths })} · {t(`billing.method.${p.method}`)}
                  </span>
                </span>
                <span className="nums font-medium text-fg">{format.money(p.amount)}</span>
                <Badge tone={p.status === 'success' ? 'success' : p.status === 'pending' ? 'warning' : 'danger'} size="sm">
                  {t(`billing.paymentStatus.${p.status}`)}
                </Badge>
                {p.invoiceId && (
                  <LinkButton href={`/biz/billing/invoices/${p.invoiceId}`} variant="ghost" size="sm">
                    {t('billing.openReceipt')}
                  </LinkButton>
                )}
              </li>
            ))}
          </ul>
        )}
        {!paymentsQ.isError && paymentsPager}
      </SectionCard>

      <div className="flex flex-wrap gap-3">
        <LinkButton href="/biz/billing/invoices" variant="secondary">
          {t('billing.goToInvoices')}
        </LinkButton>
        <LinkButton href="/biz/billing/terms" variant="ghost">
          {t('billing.goToTerms')}
        </LinkButton>
      </div>
    </div>
  );
}
