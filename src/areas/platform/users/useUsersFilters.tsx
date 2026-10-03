'use client';

/** Фильтры «Пользователей» для FilterBar: порядок — главный (в строке на компьютере), остальное — в панели «Фильтры». */
import type { PlatformUserRoleFilter, PlatformUserSort, PlatformUserStatus } from '@/domain/platform/types/users';
import { useT } from '@/i18n/useT';
import type { DateRange } from '@/ui/Calendar';
import { DateRangePicker } from '@/ui/DateRangePicker';
import type { FilterBarFilter } from '@/ui/FilterBar';
import { Select } from '@/ui/Select';

export interface UsersFilterState {
  role: PlatformUserRoleFilter | '';
  status: PlatformUserStatus | '';
  activeDays: '' | '1' | '7' | '30' | '90';
  telegram: '' | 'yes' | 'no';
  google: '' | 'yes' | 'no';
  range: DateRange;
}

type SortState = { sort: PlatformUserSort; dir: 'asc' | 'desc' };

const ROLES: PlatformUserRoleFilter[] = ['client', 'owner', 'admin', 'master', 'multiple'];
const STATUSES: PlatformUserStatus[] = ['active', 'blocked', 'delete_requested', 'deleted'];
const ACTIVE_DAYS = ['1', '7', '30', '90'] as const;
const SORTS = ['registered_desc', 'registered_asc', 'last_login_desc', 'last_login_asc', 'bookings_desc', 'bookings_asc'] as const;

export function useUsersFilters(
  f: UsersFilterState,
  change: (patch: Partial<UsersFilterState>) => void,
  sort: SortState,
  changeSort: (s: SortState) => void,
): FilterBarFilter[] {
  const t = useT('platform');
  const yesNo = (kind: 'telegram' | 'google') => [
    { value: 'yes', label: t(kind === 'telegram' ? 'users.filters.telegramYes' : 'users.filters.googleYes') },
    { value: 'no', label: t(kind === 'telegram' ? 'users.filters.telegramNo' : 'users.filters.googleNo') },
  ];
  return [
    {
      id: 'sort',
      label: t('users.filters.sort'),
      primary: true,
      node: (
        <Select
          aria-label={t('users.filters.sort')}
          options={SORTS.map((s) => ({ value: s, label: t(`users.sort.${s}`) }))}
          value={`${sort.sort}_${sort.dir}`}
          onValueChange={(v) => {
            const at = v.lastIndexOf('_');
            changeSort({ sort: v.slice(0, at) as PlatformUserSort, dir: v.slice(at + 1) as 'asc' | 'desc' });
          }}
        />
      ),
    },
    {
      id: 'role',
      label: t('users.filters.role'),
      node: (
        <Select
          placeholder={t('users.filters.anyRole')}
          options={ROLES.map((r) => ({ value: r, label: t(`users.roleFilter.${r}`) }))}
          value={f.role}
          onValueChange={(v) => change({ role: v as UsersFilterState['role'] })}
        />
      ),
    },
    {
      id: 'status',
      label: t('users.filters.status'),
      node: (
        <Select
          placeholder={t('users.filters.anyStatus')}
          options={STATUSES.map((s) => ({ value: s, label: t(`users.status.${s}`) }))}
          value={f.status}
          onValueChange={(v) => change({ status: v as UsersFilterState['status'] })}
        />
      ),
    },
    {
      id: 'active',
      label: t('users.filters.active'),
      node: (
        <Select
          placeholder={t('users.filters.anyTime')}
          options={ACTIVE_DAYS.map((d) => ({ value: d, label: t('users.filters.activeDays', { n: Number(d) }) }))}
          value={f.activeDays}
          onValueChange={(v) => change({ activeDays: v as UsersFilterState['activeDays'] })}
        />
      ),
    },
    {
      id: 'registered',
      label: t('users.filters.registered'),
      node: <DateRangePicker value={f.range} onValueChange={(r) => change({ range: r })} presets />,
    },
    {
      id: 'telegram',
      label: t('users.filters.telegram'),
      node: <Select placeholder={t('users.filters.any')} options={yesNo('telegram')} value={f.telegram} onValueChange={(v) => change({ telegram: v as UsersFilterState['telegram'] })} />,
    },
    {
      id: 'google',
      label: t('users.filters.google'),
      node: <Select placeholder={t('users.filters.any')} options={yesNo('google')} value={f.google} onValueChange={(v) => change({ google: v as UsersFilterState['google'] })} />,
    },
  ];
}
