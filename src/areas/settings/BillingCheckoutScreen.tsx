'use client';

/**
 * /biz/billing/checkout — способ оплаты и согласия (F-15-083/084, F-00-022, F-15-090).
 * Только онлайн, без наличных (F-00-022): карта ArCa/Visa/Mastercard, Idram, Telcell, счёт для фирмы
 * (F-15-084 — переводит на печатную форму счёта вместо мок-оплаты). Если сохранённый способ недоступен —
 * предупреждение до оплаты (F-15-090). Итог — /biz/billing/checkout/result.
 */
import { useState, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, Building2, CreditCard, Pencil, Smartphone, Wallet } from 'lucide-react';
import { checkoutPay, getSavedPaymentMethod, getSubscription, quotePrice, saveBillingAddress, useLegalInfo, type BillingPaymentMethod } from '@/api/settings';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Button, LinkButton } from '@/ui/Button';
import { Checkbox } from '@/ui/Checkbox';
import { ChoiceGroup } from '@/ui/ChoiceGroup';
import { ErrorState } from '@/ui/ErrorState';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';
import { SkeletonText } from '@/ui/Skeleton';

const METHODS: { value: BillingPaymentMethod; icon: ReactNode }[] = [
  { value: 'card', icon: <CreditCard aria-hidden /> },
  { value: 'idram', icon: <Wallet aria-hidden /> },
  { value: 'telcell', icon: <Smartphone aria-hidden /> },
  { value: 'invoice', icon: <Building2 aria-hidden /> },
];

export function BillingCheckoutScreen() {
  const t = useT('settings');
  const format = useFormat();
  const router = useRouter();
  const searchParams = useSearchParams();
  const months = Math.max(1, Number(searchParams.get('months') ?? '1'));
  const { businessId, ready } = useCurrent();

  const [method, setMethod] = useState<BillingPaymentMethod>('card');
  const [agree, setAgree] = useState(false);
  const [billingAddress, setBillingAddress] = useState('');
  const [touchedAddress, setTouchedAddress] = useState(false);

  const quoteQ = useApiQuery(['settings', 'quote', businessId, months], () => quotePrice(businessId ?? '', months), { enabled: ready && Boolean(businessId) });
  const subQ = useApiQuery(['settings', 'subscription', businessId], () => getSubscription(businessId ?? ''), { enabled: ready && Boolean(businessId) });
  const savedMethodQ = useApiQuery(['settings', 'savedMethod', businessId], () => getSavedPaymentMethod(businessId ?? ''), { enabled: ready && Boolean(businessId) });
  const legalQ = useLegalInfo(businessId, { enabled: ready });

  const pay = useApiMutation(checkoutPay);
  const saveAddress = useApiMutation(saveBillingAddress);

  if (quoteQ.isError || subQ.isError) return <ErrorState onRetry={() => { quoteQ.refetch(); subQ.refetch(); }} />;

  const isLoading = !ready || quoteQ.isLoading || subQ.isLoading;
  const quote = quoteQ.data;
  const needsAddress = method === 'invoice';
  const addressInvalid = touchedAddress && needsAddress && billingAddress.trim().length < 5;
  const unavailable = savedMethodQ.data?.unavailable && method === 'card';

  const onPay = async () => {
    setTouchedAddress(true);
    if (!businessId || !agree) return;
    if (needsAddress && billingAddress.trim().length < 5) return;
    try {
      if (needsAddress) await saveAddress.mutate({ businessId, billingAddress: billingAddress.trim() });
      const result = await pay.mutate({ businessId, months, method });
      router.push(`/biz/billing/checkout/result?status=${result.status}&invoiceId=${result.invoiceId}`);
    } catch {
      router.push('/biz/billing/checkout/result?status=failed');
    }
  };

  return (
    <div data-f="F-15-083 F-00-022" className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
      <PageHeader title={t('checkout.title')} description={t('checkout.description')} back={{ href: `/biz/billing/manage` }} />

      <SectionCard title={t('checkout.summaryTitle')}>
        {/* Срок известен сразу, сумма — полосой в той же строке, пока считается */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted">{t('manage.months', { count: months })}</span>
          <span className="nums text-lg font-semibold text-fg">{isLoading || !quote ? <SkeletonText width="8ch" /> : format.money(quote.total)}</span>
        </div>
      </SectionCard>

      {/* Данные плательщика в счёте: название юрлица и ՀՎՀՀ из «Реквизитов» (F-15-112, F-15-085). Бразильская
          Nota Fiscal (F-07-179) у нас не показывается — рынок Армения. */}
      <span hidden data-f="F-07-179" />
      <SectionCard title={t('checkout.companyDataTitle')}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5 text-sm">
            <span className="truncate font-medium text-fg">
              {legalQ.isLoading ? <SkeletonText width="20ch" /> : legalQ.data?.companyName || t('checkout.companyDataEmpty')}
            </span>
            <span className="truncate text-muted">
              {legalQ.isLoading ? <SkeletonText width="14ch" /> : t('checkout.companyDataTaxId', { value: legalQ.data?.taxId || '—' })}
            </span>
          </div>
          <LinkButton href="/biz/settings/legal" variant="ghost" size="sm" leftIcon={<Pencil aria-hidden />}>
            {t('checkout.companyDataEdit')}
          </LinkButton>
        </div>
      </SectionCard>

      <SectionCard title={t('checkout.methodTitle')}>
        {/* Способы оплаты от данных не зависят — видны сразу */}
        <div className="flex flex-col gap-3">
          <ChoiceGroup
            aria-label={t('checkout.methodTitle')}
            options={METHODS.map((m) => ({ value: m.value, title: t(`checkout.method.${m.value}`), icon: m.icon }))}
            value={method}
            onValueChange={(v) => setMethod(v as BillingPaymentMethod)}
            columns={2}
          />
          {unavailable && (
            <div data-f="F-15-090" className="flex items-center gap-2 rounded-lg bg-warning-soft px-3 py-2.5 text-sm text-warning">
              <AlertTriangle aria-hidden className="size-4 shrink-0" />
              {t('checkout.methodUnavailable', { label: savedMethodQ.data?.label ?? '' })}
            </div>
          )}
        </div>
      </SectionCard>

      {needsAddress && (
        <SectionCard title={t('checkout.invoiceTitle')} description={t('checkout.invoiceDescription')}>
          <div data-f="F-15-084 F-15-088" className="flex flex-col gap-3">
            <FormField label={t('checkout.billingAddress')} error={addressInvalid ? t('checkout.billingAddressError') : undefined} required>
              <Input value={billingAddress} onChange={(e) => setBillingAddress(e.target.value)} onBlur={() => setTouchedAddress(true)} placeholder={t('checkout.billingAddressPlaceholder')} />
            </FormField>
          </div>
        </SectionCard>
      )}

      <SectionCard title={t('checkout.consentsTitle')}>
        <Checkbox
          checked={agree}
          onCheckedChange={setAgree}
          label={t('checkout.agree')}
        />
      </SectionCard>

      <div className="flex flex-wrap gap-3">
        <Button variant="primary" leftIcon={<CreditCard aria-hidden />} disabled={!agree || isLoading} loading={pay.isPending} onClick={onPay}>
          {t(method === 'invoice' ? 'checkout.createInvoice' : 'checkout.pay')}
        </Button>
        <Button variant="ghost" onClick={() => router.push('/biz/billing/manage')}>{t('manage.back')}</Button>
      </div>
    </div>
  );
}
