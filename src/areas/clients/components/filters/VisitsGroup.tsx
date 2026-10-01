'use client';

/** Группа «По визитам» (F-04-018…025): записи, статусы, число визитов, период, мастера, услуги, сумма */
import { useLocale } from 'next-intl';
import type { ClientsFilterState } from '@/domain/clients';
import type { Id, LocaleCode, LocalizedText } from '@/domain/core';
import { BOOKING_STATUSES } from '@/domain/rules';
import { ChipMultiSelect } from '@/areas/clients/components/filters/ChipMultiSelect';
import { FilterField } from '@/areas/clients/components/filters/FilterField';
import { GroupLogic } from '@/areas/clients/components/filters/GroupLogic';
import { RangeInputs } from '@/areas/clients/components/filters/RangeInputs';
import { useT } from '@/i18n/useT';
import { pickText } from '@/lib/text';
import { useBookingStatusLabel } from '@/ui/BookingStatusBadge';
import { DateRangePicker } from '@/ui/DateRangePicker';
import { SegmentedControl } from '@/ui/SegmentedControl';

export interface VisitsGroupProps {
  draft: ClientsFilterState;
  setDraft: (fn: (d: ClientsFilterState) => ClientsFilterState) => void;
  staffOptions: { value: Id; label: string }[];
  serviceOptions: { value: Id; label: LocalizedText }[];
}

export function VisitsGroup({ draft, setDraft, staffOptions, serviceOptions }: VisitsGroupProps) {
  const t = useT('clients');
  const locale = useLocale();
  const statusLabel = useBookingStatusLabel();
  const v = draft.visits;
  const set = (patch: Partial<ClientsFilterState['visits']>) => setDraft((d) => ({ ...d, visits: { ...d.visits, ...patch } }));
  return (
    <div data-f="F-04-018 F-04-019 F-04-020 F-04-021 F-04-022 F-04-023 F-04-024 F-04-025" className="flex flex-col gap-5">
      <GroupLogic value={draft.logic.visits} onChange={(logic) => setDraft((d) => ({ ...d, logic: { ...d.logic, visits: logic } }))} />
      <FilterField label={t('filters.presence')}>
        <SegmentedControl
          size="sm"
          fullWidth
          value={v.presence ?? ''}
          onValueChange={(x) => set({ presence: x ? (x as 'has' | 'none') : undefined })}
          options={[
            { value: '', label: t('filters.any') },
            { value: 'has', label: t('filters.hasBookings') },
            { value: 'none', label: t('filters.noBookings') },
          ]}
        />
        <DateRangePicker value={v.presenceRange} onValueChange={(r) => set({ presenceRange: !r.from && !r.to ? undefined : r })} />
      </FilterField>
      <FilterField label={t('filters.status')}>
        <ChipMultiSelect options={BOOKING_STATUSES.map((s) => ({ value: s, label: statusLabel(s) }))} value={v.status} onChange={(status) => set({ status })} />
      </FilterField>
      <FilterField label={t('filters.visitsCount')}>
        <RangeInputs kind="count" value={v.visitsCount} onChange={(visitsCount) => set({ visitsCount })} />
      </FilterField>
      <FilterField label={t('filters.period')}>
        <DateRangePicker value={v.period} onValueChange={(r) => set({ period: !r.from && !r.to ? undefined : r })} />
      </FilterField>
      <FilterField label={t('filters.staff')}>
        <ChipMultiSelect options={staffOptions} value={v.staffIds} onChange={(staffIds) => set({ staffIds })} />
      </FilterField>
      <FilterField label={t('filters.services')}>
        <ChipMultiSelect
          options={serviceOptions.map((s) => ({ value: s.value, label: pickText(s.label, locale as LocaleCode) }))}
          value={v.serviceIds}
          onChange={(serviceIds) => set({ serviceIds })}
        />
      </FilterField>
      <FilterField label={t('filters.serviceAmount')}>
        <RangeInputs value={v.serviceAmount} onChange={(serviceAmount) => set({ serviceAmount })} />
      </FilterField>
    </div>
  );
}
