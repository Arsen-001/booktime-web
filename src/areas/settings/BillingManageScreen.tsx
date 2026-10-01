'use client';

/**
 * /biz/billing/manage — «Управление лицензией» (F-15-074/075/076/077/059/062/063/035/039).
 * Выбор срока (1/3/6/12 месяцев, помесячно с автопродлением вместо рассрочки — F-15-039), панель
 * «Детализация» (F-15-075: период с–по, месяцев, цена в месяц, скидка по промокоду, итог), кнопки
 * «Перейти к оплате» / «Задать вопрос по лицензии» / «Назад» (F-15-076). Продление раньше срока начинает
 * новый период с даты окончания текущего (F-15-077) — считает quotePrice()/getSubscription() на сервере.
 * Скидка — только личный промокод с регистрации, общих кодов «для всех» (HELLO30) нет (F-15-062/063,
 * Снято 16); после скидочной оплаты дальше — обычная цена (F-00-021).
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Gift, MessageCircleQuestion, Tag } from 'lucide-react';
import { createHelpRequest, getSubscription, quotePrice } from '@/api/settings';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { ChoiceGroup } from '@/ui/ChoiceGroup';
import { ErrorState } from '@/ui/ErrorState';
import { Modal } from '@/ui/Modal';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';
import { SkeletonText } from '@/ui/Skeleton';
import { useSkeletonCount } from '@/ui/hooks/useSkeletonCount';
import { Textarea } from '@/ui/Textarea';
import { useToast } from '@/ui/Toast';

const MONTH_OPTIONS = [1, 3, 6, 12];

export function BillingManageScreen() {
  const t = useT('settings');
  const format = useFormat();
  const toast = useToast();
  const router = useRouter();
  const { businessId, staffId, ready } = useCurrent();
  const [months, setMonths] = useState(1);
  const [askOpen, setAskOpen] = useState(false);
  const [askMessage, setAskMessage] = useState('');

  const subQ = useApiQuery(['settings', 'subscription', businessId], () => getSubscription(businessId ?? ''), { enabled: ready && Boolean(businessId) });
  const quoteQ = useApiQuery(['settings', 'quote', businessId, months], () => quotePrice(businessId ?? '', months), { enabled: ready && Boolean(businessId) });

  const ask = useApiMutation(createHelpRequest);

  const sub = subQ.data;
  const quote = quoteQ.data;
  const isLoading = !ready || subQ.isLoading || quoteQ.isLoading;
  // Строк расчёта — столько же, сколько было (иначе как в демо: одна строка «мастеров в плате»)
  const breakdownRows = useSkeletonCount('breakdown', { loading: isLoading, count: quote?.breakdown.length, fallback: 1 });

  if (subQ.isError || quoteQ.isError) return <ErrorState onRetry={() => { subQ.refetch(); quoteQ.refetch(); }} />;

  const monthOptions = MONTH_OPTIONS.map((m) => ({
    value: String(m),
    title: t('manage.months', { count: m }),
  }));

  const onAsk = async () => {
    if (!businessId || !staffId || askMessage.trim().length < 5) return;
    try {
      await ask.mutate({ businessId, authorStaffId: staffId, topic: 'billing', message: askMessage.trim() });
      toast.success(t('help.sent'));
      setAskOpen(false);
      setAskMessage('');
    } catch {
      toast.error(t('help.sendFailed'));
    }
  };

  return (
    <div data-f="F-15-074 F-15-076" className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
      <PageHeader title={t('manage.title')} description={t('manage.description')} back={{ href: '/biz/billing' }} />

      <SectionCard title={t('manage.periodChoiceTitle')} description={t('manage.periodChoiceDescription')}>
        {/* Выбор срока от данных не зависит — виден сразу */}
        <div data-f="F-15-035 F-15-039" className="flex flex-col gap-3">
          <ChoiceGroup options={monthOptions} value={String(months)} onValueChange={(v) => setMonths(Number(v))} columns={2} aria-label={t('manage.periodChoiceTitle')} />
          <p className="text-sm text-muted">{t('manage.autoRenewNote')}</p>
        </div>
      </SectionCard>

      <SectionCard title={t('manage.breakdownTitle')}>
        {isLoading || !quote || !sub ? (
          // Тот же расчёт: период, строки мест, «× месяцев», промокод, итог, налоги — полосы на месте чисел
          <div aria-busy className="flex flex-col gap-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">{t('manage.periodFrom')}</span>
              <span className="nums font-medium text-fg">
                <SkeletonText width="26ch" />
              </span>
            </div>
            <ul className="flex flex-col gap-1.5">
              {Array.from({ length: breakdownRows }, (_, i) => (
                <li key={i} className="flex items-center justify-between text-sm">
                  <span className="text-muted">
                    <SkeletonText width="14ch" />
                  </span>
                  <span className="nums text-fg">
                    <SkeletonText width="7ch" />
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">{t('manage.monthsCount', { count: months })}</span>
              <span className="nums text-fg">
                <SkeletonText width="10ch" />
              </span>
            </div>
            {/* Промокода в демо нет — та же фраза (переносится так же, как с данными) */}
            <p className="text-sm text-muted">{t('manage.noPromo')}</p>
            <div className="flex items-center justify-between border-t border-border pt-3">
              <span className="text-base font-semibold text-fg">{t('manage.total')}</span>
              <span className="nums text-lg font-semibold text-fg">
                <SkeletonText width="8ch" />
              </span>
            </div>
            <p className="text-xs text-muted">{t('manage.taxNote')}</p>
          </div>
        ) : (
          <div data-f="F-15-075 F-15-077 F-15-059" className="flex flex-col gap-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">{t('manage.periodFrom')}</span>
              <span className="nums font-medium text-fg">
                {format.date(sub.freeMonthUntil ?? sub.paidUntil, 'long')} → {format.date(quoteToDate(sub, months), 'long')}
              </span>
            </div>
            {sub.freeMonthUntil && (
              <div className="flex items-center gap-2 rounded-lg bg-primary-soft px-3 py-2.5 text-sm text-primary-text">
                <Gift aria-hidden className="size-4 shrink-0" />
                {t('manage.freeMonthCarried', { days: quote.freeMonthDaysCarried ?? 0 })}
              </div>
            )}
            <ul className="flex flex-col gap-1.5">
              {quote.breakdown.map((line, i) => (
                <li key={i} className="flex items-center justify-between text-sm">
                  <span className="text-muted">{t(line.labelKey, { count: line.count })}</span>
                  <span className="nums text-fg">{format.money(line.unitPrice)}</span>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">{t('manage.monthsCount', { count: months })}</span>
              <span className="nums text-fg">{format.money(quote.monthlyTotal)} × {months}</span>
            </div>
            {quote.discountPercent ? (
              <div data-f="F-15-062 F-15-063 F-00-021" className="flex items-center justify-between text-sm text-success">
                <span className="flex items-center gap-1.5"><Tag aria-hidden className="size-4" />{t('manage.promoLine', { code: sub.promoApplied ?? '', percent: quote.discountPercent })}</span>
                <span className="nums">−{format.money(quote.discountAmount ?? 0)}</span>
              </div>
            ) : (
              <p data-f="F-15-062 F-15-063" className="text-sm text-muted">{t('manage.noPromo')}</p>
            )}
            <div className="flex items-center justify-between border-t border-border pt-3">
              <span className="text-base font-semibold text-fg">{t('manage.total')}</span>
              <span className="nums text-lg font-semibold text-fg">{format.money(quote.total)}</span>
            </div>
            {quote.discountPercent ? (
              <p className="text-xs text-muted">{t('manage.thenRegular', { amount: format.money(quote.monthlyTotal) })}</p>
            ) : null}
            <p data-f="F-15-038 F-15-040" className="text-xs text-muted">{t('manage.taxNote')}</p>
          </div>
        )}
      </SectionCard>

      <div className="flex flex-wrap gap-3">
        <Button
          variant="primary"
          rightIcon={<ArrowRight aria-hidden />}
          disabled={isLoading}
          onClick={() => router.push(`/biz/billing/checkout?months=${months}`)}
        >
          {t('manage.goToCheckout')}
        </Button>
        <Button variant="secondary" leftIcon={<MessageCircleQuestion aria-hidden />} onClick={() => setAskOpen(true)}>
          {t('manage.askQuestion')}
        </Button>
        <Button variant="ghost" onClick={() => router.push('/biz/billing')}>
          {t('manage.back')}
        </Button>
      </div>

      <Modal
        open={askOpen}
        onOpenChange={setAskOpen}
        title={t('manage.askQuestion')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAskOpen(false)}>{t('manage.cancel')}</Button>
            <Button variant="primary" loading={ask.isPending} disabled={askMessage.trim().length < 5} onClick={onAsk}>{t('help.send')}</Button>
          </>
        }
      >
        <Textarea value={askMessage} onChange={(e) => setAskMessage(e.target.value)} placeholder={t('manage.askPlaceholder')} rows={4} />
      </Modal>
    </div>
  );
}

function quoteToDate(sub: { paidUntil: string; freeMonthUntil?: string }, months: number): string {
  const base = new Date(sub.freeMonthUntil ?? sub.paidUntil);
  base.setMonth(base.getMonth() + months);
  return base.toISOString().slice(0, 10);
}
