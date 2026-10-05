'use client';

/**
 * /biz/billing/terms — «Правила подписки» (F-15-048/056/066/179/065/089/043/042/081, b06).
 * Новые цены объявляются заранее и действуют только с новой покупки (F-15-048); история изменений — ниже
 * (F-15-056); пока повышение не наступило — можно продлить по старой цене (F-15-066). Отмена = выключить
 * автопродление, просрочка → заморозка, возврат — «решается с бухгалтером» (F-15-179). Скидка — только
 * личным промокодом при регистрации, других скидок нет (F-15-065, ⭐ Снято 16). Оплата через поддержку
 * (F-15-089), одна линия поддержки на армянском для всех (F-15-043, уровни не решены), особые условия для
 * сетей от 5 филиалов и НКО — по обращению (F-15-042). Продление — только в веб-кабинете, в iPhone-приложении
 * помечено «через Apple» (F-15-081, предл.).
 */
import { AlertTriangle, Building2, CreditCard, MessageCircle, ShieldCheck, Smartphone } from 'lucide-react';
import {
  cardPaymentsAvailable,
  createHelpRequest,
  getSubscription,
  isPaymentsUnavailable,
  lockInOldPrice,
  listPriceRuleChanges,
} from '@/api/settings';
import { useAutoRenewToggle } from '@/areas/settings/useAutoRenewToggle';
import { dayjs } from '@/lib/date';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { ErrorState } from '@/ui/ErrorState';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';
import { Skeleton, SkeletonText } from '@/ui/Skeleton';
import { usePagedList } from '@/ui/Pagination';
import { useConfirm, useToast } from '@/ui/Toast';

export function BillingTermsScreen() {
  const t = useT('settings');
  const format = useFormat();
  const toast = useToast();
  const confirm = useConfirm();
  const { businessId, staffId, networkId, activeLocationIds, ready } = useCurrent();
  const isNetwork = Boolean(networkId) && activeLocationIds.length > 1;

  const subQ = useApiQuery(['settings', 'subscription', businessId], () => getSubscription(businessId ?? ''), { enabled: ready && Boolean(businessId) });
  const pricesQ = useApiQuery(['settings', 'priceRuleChanges'], () => listPriceRuleChanges(), { enabled: ready });

  const autoRenew = useAutoRenewToggle(businessId, subQ.data?.paidUntil);
  const lockPrice = useApiMutation(lockInOldPrice, {
    invalidates: (args) => [['settings', 'subscription', args.businessId], ['settings', 'payments', args.businessId]],
  });
  const contactSupport = useApiMutation(createHelpRequest);
  const history = (pricesQ.data ?? []).filter((p) => !p.upcoming);
  // Постранично, как во всех списках (DESIGN.md → Long lists)
  const { pageItems: historyPage, pager: historyPager } = usePagedList(history);

  if (subQ.isError) return <ErrorState onRetry={() => subQ.refetch()} />;
  const isLoading = subQ.isLoading || pricesQ.isLoading || !ready;
  const sub = subQ.data;
  const upcoming = (pricesQ.data ?? []).find((p) => p.upcoming);

  // Н3: тот же вопрос с последствиями, что у переключателя на «Подписке»
  const onCancelAutoRenew = () => void autoRenew.setAutoRenew(false);

  // Н2: «Продлить на 12 месяцев по старой цене» списывает год разом — сначала сумма, срок и способ оплаты
  const onLockOldPrice = async () => {
    if (!businessId || !sub) return;
    const months = 12;
    const amount = sub.quote.monthlyTotal * months;
    const base = dayjs(sub.paidUntil).isAfter(dayjs()) ? dayjs(sub.paidUntil) : dayjs();
    const until = base.add(months, 'month').format('YYYY-MM-DD');
    const ok = await confirm({
      title: t('terms.lockConfirmTitle'),
      description: (
        <span className="flex flex-col gap-2">
          <span className="nums text-lg font-semibold text-fg">{format.money(amount)}</span>
          <span>
            {t('terms.lockConfirmText', {
              monthly: format.money(sub.quote.monthlyTotal),
              months,
              until: format.date(until, 'long'),
            })}
          </span>
        </span>
      ),
      confirmLabel: t('terms.lockConfirmAction', { amount: format.money(amount) }),
    });
    if (!ok) return;
    try {
      await lockPrice.mutate({ businessId, months });
      toast.success(t('terms.lockedIn'));
    } catch (e) {
      if (isPaymentsUnavailable(e)) {
        toast.error(t('paymentsSoon.unavailableError'));
        void subQ.refetch();
      } else toast.error(t('terms.lockFailed'));
    }
  };

  const onContactSupport = async () => {
    if (!businessId || !staffId) return;
    try {
      await contactSupport.mutate({
        businessId,
        authorStaffId: staffId,
        topic: 'billing',
        message: t('terms.supportPayMessage'),
      });
      toast.success(t('terms.supportSent'));
    } catch {
      toast.error(t('terms.supportFailed'));
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
      <PageHeader title={t('terms.title')} description={t('terms.description')} back={{ href: '/biz/billing' }} />

      {/* Карточки видны сразу — до ответа сервера в них полосы на месте цен и дат (DESIGN.md «The skeleton IS the page») */}
      <>
          {/* F-15-048/056: новые цены объявляются заранее, действуют с новой покупки; история */}
          <SectionCard title={t('terms.priceRuleTitle')} description={t('terms.priceRuleDescription')}>
            <div data-f="F-15-048" className="flex flex-col gap-4">
              {isLoading ? (
                <>
                  {/* Объявленное повышение (в демо есть) — та же плашка с кнопкой; строка истории цен */}
                  <div className="flex flex-col gap-2 rounded-lg bg-warning-soft px-3 py-2.5 text-sm text-warning">
                    <span className="flex items-center gap-2">
                      <AlertTriangle aria-hidden className="size-4 shrink-0" />
                      {/* Фраза о повышении на телефоне — в три строки, шире — в одну */}
                      <span className="min-w-0 flex-1">
                        <Skeleton lines={3} className="sm:hidden" />
                        <SkeletonText width="40ch" className="max-sm:hidden" />
                      </span>
                    </span>
                    <Button variant="secondary" size="sm" className="self-start" disabled>
                      {t('terms.lockOldPrice')}
                    </Button>
                  </div>
                  <ul className="flex flex-col divide-y divide-border">
                    <li className="flex items-center justify-between gap-3 py-2.5 text-sm">
                      <span className="min-w-0 flex-1 text-fg">
                        <SkeletonText width="16ch" />
                        <span className="block text-xs text-muted">
                          <SkeletonText width="18ch" />
                        </span>
                      </span>
                      <span className="nums text-muted line-through">
                        <SkeletonText width="6ch" />
                      </span>
                      <span className="nums font-medium text-fg">
                        <SkeletonText width="6ch" />
                      </span>
                    </li>
                  </ul>
                </>
              ) : null}
              {!isLoading && upcoming && (
                <div data-f="F-15-066" className="flex flex-col gap-2 rounded-lg bg-warning-soft px-3 py-2.5 text-sm text-warning">
                  <span className="flex items-center gap-2">
                    <AlertTriangle aria-hidden className="size-4 shrink-0" />
                    {t('terms.upcomingChange', {
                      key: t(`terms.priceChange.${upcoming.descriptionKey}` as never),
                      date: format.date(upcoming.effectiveFrom, 'long'),
                      old: format.money(upcoming.oldPrice),
                      next: format.money(upcoming.newPrice),
                    })}
                  </span>
                  {/* Без платёжного провайдера (06.10.2026) списать год нечем — продлить по старой цене поможет поддержка (ниже) */}
                  {cardPaymentsAvailable(sub) && (
                    <Button variant="secondary" size="sm" className="self-start" loading={lockPrice.isPending} onClick={() => void onLockOldPrice()}>
                      {t('terms.lockOldPrice')}
                    </Button>
                  )}
                </div>
              )}
              {isLoading ? null : history.length === 0 ? (
                <p className="text-sm text-muted">{t('terms.priceRuleEmpty')}</p>
              ) : (
                <ul data-f="F-15-056" className="flex flex-col divide-y divide-border">
                  {historyPage.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                      <span className="min-w-0 flex-1 text-fg">
                        {t(`terms.priceChange.${p.descriptionKey}` as never)}
                        <span className="block text-xs text-muted">{t('terms.effectiveFrom', { date: format.date(p.effectiveFrom, 'long') })}</span>
                      </span>
                      <span className="nums text-muted line-through">{format.money(p.oldPrice)}</span>
                      <span className="nums font-medium text-fg">{format.money(p.newPrice)}</span>
                    </li>
                  ))}
                </ul>
              )}
              {historyPager}
            </div>
          </SectionCard>

          {/* F-15-179: отмена, возврат, просрочка */}
          <SectionCard title={t('terms.cancelTitle')}>
            <div data-f="F-15-179" className="flex flex-col gap-3">
              <p className="text-sm text-muted">{t('terms.cancelHint')}</p>
              <p className="text-sm text-muted">{t('terms.overdueHint')}</p>
              <p className="text-sm text-muted">{t('terms.refundHint')}</p>
              {isLoading ? (
                <Button variant="danger" size="sm" className="self-start" disabled>
                  {t('terms.cancelButton')}
                </Button>
              ) : sub?.autoRenew && (
                <Button variant="danger" size="sm" className="self-start" loading={autoRenew.isPending} onClick={onCancelAutoRenew}>
                  {t('terms.cancelButton')}
                </Button>
              )}
            </div>
          </SectionCard>

          {/* F-15-065: других скидок нет */}
          <SectionCard title={t('terms.discountsTitle')}>
            <p data-f="F-15-065" className="text-sm text-muted">{t('terms.discountsHint')}</p>
          </SectionCard>

          {/* F-15-089: оплата с помощью поддержки */}
          <SectionCard title={t('terms.payViaSupportTitle')} description={t('terms.payViaSupportDescription')}>
            <Button
              data-f="F-15-089"
              variant="secondary"
              leftIcon={<MessageCircle aria-hidden />}
              loading={contactSupport.isPending}
              onClick={() => void onContactSupport()}
              className="self-start"
            >
              {t('terms.payViaSupportButton')}
            </Button>
          </SectionCard>

          {/* F-15-043: приоритетная поддержка — одна линия для всех */}
          <SectionCard title={t('terms.supportLevelTitle')}>
            <div data-f="F-15-043" className="flex items-center gap-2 text-sm text-muted">
              <ShieldCheck aria-hidden className="size-4 shrink-0" />
              {t('terms.supportLevelHint')}
            </div>
          </SectionCard>

          {/* F-15-042: особые условия для сетей от 5 филиалов и НКО */}
          {isNetwork && (
            <SectionCard title={t('terms.specialTermsTitle')} description={t('terms.specialTermsDescription')}>
              <Button
                data-f="F-15-042"
                variant="secondary"
                leftIcon={<Building2 aria-hidden />}
                loading={contactSupport.isPending}
                onClick={async () => {
                  if (!businessId || !staffId) return;
                  try {
                    await contactSupport.mutate({ businessId, authorStaffId: staffId, topic: 'billing', message: t('terms.specialTermsMessage') });
                    toast.success(t('terms.supportSent'));
                  } catch {
                    toast.error(t('terms.supportFailed'));
                  }
                }}
                className="self-start"
              >
                {t('terms.specialTermsButton')}
              </Button>
            </SectionCard>
          )}

          {/* F-15-081: продление только в веб-версии */}
          <SectionCard title={t('terms.webOnlyTitle')}>
            <div data-f="F-15-081" className="flex items-center gap-2 text-sm text-muted">
              <Smartphone aria-hidden className="size-4 shrink-0" />
              {t('terms.webOnlyHint')}
              <CreditCard aria-hidden className="size-4 shrink-0" />
            </div>
          </SectionCard>
      </>
    </div>
  );
}
