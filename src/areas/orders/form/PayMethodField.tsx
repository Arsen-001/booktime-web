'use client';

/**
 * Способ оплаты денег заказа (ответ 12 владельца 17.11.2026): те же «Способы оплаты», что в окне визита (наличные,
 * карта, свои способы — у каждого своя касса), без рассрочки. Сумма уходит операцией в кассу этого способа.
 */
import { useEffect } from 'react';
import { listBookingPaymentTiles } from '@/api/finance';
import { useApiQuery } from '@/api/request';
import { useT } from '@/i18n/useT';
import { FormField } from '@/ui/FormField';
import { Select } from '@/ui/Select';

export function usePayMethods(businessId: string | undefined) {
  const q = useApiQuery(['finance', 'paymentTiles', businessId], () => listBookingPaymentTiles(businessId!), { enabled: Boolean(businessId) });
  const methods = (q.data ?? []).filter((m) => m.kind !== 'installment' && m.accountId);
  return { methods, loading: q.isLoading, failed: q.isError };
}

export function PayMethodField({ businessId, value, onChange, label }: { businessId: string | undefined; value: string | undefined; onChange: (key: string) => void; label?: string }) {
  const t = useT('orders');
  const { methods, loading } = usePayMethods(businessId);
  // Первый способ (обычно «Наличные») — сразу выбран: деньги не уходят «без способа»
  useEffect(() => {
    if (!value && methods.length) onChange(methods[0]!.key);
  }, [value, methods, onChange]);
  return (
    <FormField label={label ?? t('form.payMethod')}>
      <Select
        value={value}
        onValueChange={onChange}
        disabled={loading}
        placeholder={loading ? '…' : t('form.payMethodNone')}
        options={methods.map((m) => ({ value: m.key, label: m.label }))}
      />
    </FormField>
  );
}
