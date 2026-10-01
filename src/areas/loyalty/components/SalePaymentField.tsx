'use client';

/**
 * 01.10.2026: «Чем оплатили» в продаже абонемента/сертификата и пополнении счёта. Плитка способа оплаты finance
 * задаёт и кассу (как в окне «Оплата» визита) — подпись «Наличные · Основная касса». Первый способ выбирается
 * сам, чтобы продажа в один клик шла в кассу; нет ни одного способа — подсказка настроить оплату в финансах.
 */
import { useEffect } from 'react';
import { listAccounts, listBookingPaymentTiles } from '@/api/finance';
import { useApiQuery } from '@/api/request';
import type { Id } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { FormField } from '@/ui/FormField';
import { Select } from '@/ui/Select';

export function SalePaymentField({ businessId, value, onChange, enabled = true }: { businessId: Id; value: string; onChange: (methodKey: string) => void; enabled?: boolean }) {
  const t = useT('loyalty');
  const tilesQ = useApiQuery(['finance', 'paymentTiles', businessId], () => listBookingPaymentTiles(businessId), { enabled });
  const desksQ = useApiQuery(['finance', 'accounts', businessId], () => listAccounts(businessId), { enabled });
  const tiles = (tilesQ.data ?? []).filter((tile) => tile.accountId);
  const deskName = (id: Id | null) => (desksQ.data ?? []).find((a) => a.id === id)?.name;
  const first = tiles[0]?.key;

  useEffect(() => {
    if (!value && first) onChange(first);
  }, [value, first, onChange]);

  return (
    <FormField label={t('sell.paymentLabel')} hint={tilesQ.data && tiles.length === 0 ? t('sell.paymentNone') : t('sell.paymentHint')}>
      <Select
        options={tiles.map((tile) => ({ value: tile.key, label: deskName(tile.accountId) ? `${tile.label} · ${deskName(tile.accountId)}` : tile.label }))}
        value={value}
        onValueChange={onChange}
        placeholder={t('sell.paymentPlaceholder')}
      />
    </FormField>
  );
}
