'use client';

/** Группа «По клиентам» (F-04-026…034): пол, приложение, категории, суммы, рассылки, уровень, день рождения, возраст */
import type { ClientsFilterState, ImportanceFilterValue } from '@/domain/clients';
import { IMPORTANCE_FILTER_VALUES } from '@/domain/clients';
import { ChipMultiSelect } from '@/areas/clients/components/filters/ChipMultiSelect';
import { FilterField } from '@/areas/clients/components/filters/FilterField';
import { GroupLogic } from '@/areas/clients/components/filters/GroupLogic';
import { RangeInputs } from '@/areas/clients/components/filters/RangeInputs';
import { useT } from '@/i18n/useT';
import { DateRangePicker } from '@/ui/DateRangePicker';
import { SegmentedControl } from '@/ui/SegmentedControl';

export interface ClientsGroupProps {
  draft: ClientsFilterState;
  setDraft: (fn: (d: ClientsFilterState) => ClientsFilterState) => void;
  categoryOptions: string[];
}

export function ClientsGroup({ draft, setDraft, categoryOptions }: ClientsGroupProps) {
  const t = useT('clients');
  const tc = useT('common');
  const c = draft.clients;
  const set = (patch: Partial<ClientsFilterState['clients']>) => setDraft((d) => ({ ...d, clients: { ...d.clients, ...patch } }));
  return (
    <div
      data-f="F-04-026 F-04-027 F-04-028 F-04-029 F-04-030 F-04-031 F-04-032 F-04-033 F-04-034 F-14-161 F-14-071 F-14-072 F-15-131"
      className="flex flex-col gap-5"
    >
      <GroupLogic value={draft.logic.clients} onChange={(logic) => setDraft((d) => ({ ...d, logic: { ...d.logic, clients: logic } }))} />
      <FilterField label={t('filters.gender')}>
        <ChipMultiSelect
          options={[
            { value: 'female' as const, label: tc('gender.female') },
            { value: 'male' as const, label: tc('gender.male') },
            { value: 'unset' as const, label: tc('gender.unknown') },
          ]}
          value={c.gender}
          onChange={(gender) => set({ gender })}
        />
      </FilterField>
      <FilterField label={t('filters.mobileApp')}>
        <SegmentedControl
          size="sm"
          fullWidth
          value={c.hasMobileApp ?? ''}
          onValueChange={(x) => set({ hasMobileApp: x ? (x as 'yes' | 'no') : undefined })}
          options={[
            { value: '', label: t('filters.any') },
            { value: 'yes', label: t('filters.yes') },
            { value: 'no', label: t('filters.no') },
          ]}
        />
      </FilterField>
      <FilterField label={t('filters.category')}>
        <ChipMultiSelect
          options={categoryOptions.map((x) => ({ value: x, label: x }))}
          value={c.categoryTags}
          onChange={(categoryTags) => set({ categoryTags })}
        />
      </FilterField>
      <FilterField label={t('filters.sold')}>
        <RangeInputs value={c.sold} onChange={(sold) => set({ sold })} />
      </FilterField>
      <FilterField label={t('filters.balance')}>
        <RangeInputs value={c.balance} onChange={(balance) => set({ balance })} />
      </FilterField>
      <FilterField label={t('filters.broadcast')}>
        <DateRangePicker value={c.broadcastPeriod} onValueChange={(r) => set({ broadcastPeriod: !r.from && !r.to ? undefined : r })} />
      </FilterField>
      <FilterField label={t('filters.importance')}>
        <ChipMultiSelect
          options={IMPORTANCE_FILTER_VALUES.map((x) => ({ value: x, label: t(`importance.${x}`) }))}
          value={c.importance}
          onChange={(importance) => set({ importance: importance as ImportanceFilterValue[] | undefined })}
        />
      </FilterField>
      <FilterField label={t('filters.birthday')}>
        <DateRangePicker value={c.birthdayPeriod} onValueChange={(r) => set({ birthdayPeriod: !r.from && !r.to ? undefined : r })} />
      </FilterField>
      <FilterField label={t('filters.age')}>
        <RangeInputs kind="count" value={c.age} onChange={(age) => set({ age })} />
      </FilterField>
    </div>
  );
}
