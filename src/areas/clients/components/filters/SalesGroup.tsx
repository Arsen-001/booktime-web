'use client';

/** Группа «По продажам» (F-04-035): товары, сертификаты, абонементы */
import type { ClientsFilterState } from '@/domain/clients';
import { FilterField } from '@/areas/clients/components/filters/FilterField';
import { GroupLogic } from '@/areas/clients/components/filters/GroupLogic';
import { RangeInputs } from '@/areas/clients/components/filters/RangeInputs';
import { useT } from '@/i18n/useT';
import { Checkbox } from '@/ui/Checkbox';
import { DateRangePicker } from '@/ui/DateRangePicker';
import { Input } from '@/ui/Input';
import { SegmentedControl } from '@/ui/SegmentedControl';

export interface SalesGroupProps {
  draft: ClientsFilterState;
  setDraft: (fn: (d: ClientsFilterState) => ClientsFilterState) => void;
}

export function SalesGroup({ draft, setDraft }: SalesGroupProps) {
  const t = useT('clients');
  const cert = draft.sales.certificate;
  const sub = draft.sales.subscription;
  const setCert = (patch: NonNullable<ClientsFilterState['sales']['certificate']>) =>
    setDraft((d) => ({ ...d, sales: { ...d.sales, certificate: { ...d.sales.certificate, ...patch } } }));
  const setSub = (patch: NonNullable<ClientsFilterState['sales']['subscription']>) =>
    setDraft((d) => ({ ...d, sales: { ...d.sales, subscription: { ...d.sales.subscription, ...patch } } }));
  const usedOptions = [
    { value: '', label: t('filters.any') },
    { value: 'yes', label: t('filters.used') },
    { value: 'no', label: t('filters.notUsed') },
  ];
  return (
    <div data-f="F-04-035" className="flex flex-col gap-5">
      <GroupLogic value={draft.logic.sales} onChange={(logic) => setDraft((d) => ({ ...d, logic: { ...d.logic, sales: logic } }))} />
      <FilterField label={t('filters.products')}>
        <Input
          value={draft.sales.productNames?.[0] ?? ''}
          onChange={(e) => setDraft((d) => ({ ...d, sales: { ...d.sales, productNames: e.target.value ? [e.target.value] : undefined } }))}
          placeholder={t('filters.productsPlaceholder')}
        />
      </FilterField>
      <FilterField label={t('filters.certificate')}>
        <div className="flex flex-col gap-3 rounded-xl border border-border p-3">
          <SegmentedControl
            size="sm"
            fullWidth
            value={cert?.used ?? ''}
            onValueChange={(v) => setCert({ used: v ? (v as 'yes' | 'no') : undefined })}
            options={usedOptions}
          />
          <RangeInputs value={cert?.balance} onChange={(balance) => setCert({ balance })} />
          <DateRangePicker value={cert?.soldAt} onValueChange={(r) => setCert({ soldAt: !r.from && !r.to ? undefined : r })} />
          <Checkbox
            label={t('filters.expiringSoon')}
            checked={cert?.expiringSoon ?? false}
            onCheckedChange={(on) => setCert({ expiringSoon: on || undefined })}
          />
        </div>
      </FilterField>
      <FilterField label={t('filters.subscription')}>
        <div className="flex flex-col gap-3 rounded-xl border border-border p-3">
          <SegmentedControl
            size="sm"
            fullWidth
            value={sub?.used ?? ''}
            onValueChange={(v) => setSub({ used: v ? (v as 'yes' | 'no') : undefined })}
            options={usedOptions}
          />
          <SegmentedControl
            size="sm"
            fullWidth
            value={sub?.status ?? ''}
            onValueChange={(v) => setSub({ status: v ? (v as 'active' | 'expired') : undefined })}
            options={[
              { value: '', label: t('filters.any') },
              { value: 'active', label: t('filters.subActive') },
              { value: 'expired', label: t('filters.subExpired') },
            ]}
          />
          <Checkbox label={t('filters.frozen')} checked={sub?.frozen ?? false} onCheckedChange={(on) => setSub({ frozen: on || undefined })} />
          <Checkbox
            label={t('filters.expiringSoon')}
            checked={sub?.expiringSoon ?? false}
            onCheckedChange={(on) => setSub({ expiringSoon: on || undefined })}
          />
          <DateRangePicker value={sub?.soldAt} onValueChange={(r) => setSub({ soldAt: !r.from && !r.to ? undefined : r })} />
          <RangeInputs kind="count" value={sub?.remainingVisits} onChange={(remainingVisits) => setSub({ remainingVisits })} />
        </div>
      </FilterField>
    </div>
  );
}
