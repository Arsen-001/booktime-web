'use client';

/**
 * Строка услуги в таблице каталога (У5): название — ссылка на карточку, остальное меняется прямо в строке — онлайн,
 * цена, длительность, перерыв, мастера. Перетаскивание за ⠿ (У10), галочка — для массовых действий.
 */
import Link from 'next/link';
import { memo } from 'react';
import { useLocale } from 'next-intl';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import type { ServiceRow } from '@/api/services';
import type { Staff } from '@/domain/core';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { formatMoneyRange } from '@/lib/money';
import { pickText } from '@/lib/text';
import { TECH_BREAK_MINUTES, techBreakFromValue, techBreakValue } from '@/areas/services/components/techBreak';
import { InlineRangeCell } from '@/areas/services/catalog/InlineRangeCell';
import { StaffCell } from '@/areas/services/catalog/StaffCell';
import type { CatalogActions } from '@/areas/services/catalog/useCatalogActions';
import { Badge } from '@/ui/Badge';
import { Checkbox } from '@/ui/Checkbox';
import { DropdownMenu } from '@/ui/DropdownMenu';
import { IconButton } from '@/ui/IconButton';
import { Select } from '@/ui/Select';
import { Switch } from '@/ui/Switch';

export interface ServiceRowProps {
  row: ServiceRow;
  staffList: Staff[];
  selected: boolean;
  onSelect: (id: string, on: boolean) => void;
  canEdit: boolean;
  actions: CatalogActions;
  /** Сеть4: сеть запретила менять цену этой услуги в филиалах (F-11-082) */
  priceLocked?: boolean;
}

const staffKey = (list: Staff[]) => list.map((s) => `${s.id}:${s.name}:${s.avatarUrl ?? ''}`).join('|');

export function sameRowProps(a: ServiceRowProps, b: ServiceRowProps): boolean {
  return (
    a.row === b.row &&
    a.selected === b.selected &&
    a.onSelect === b.onSelect &&
    a.canEdit === b.canEdit &&
    a.actions === b.actions &&
    Boolean(a.priceLocked) === Boolean(b.priceLocked) &&
    (a.staffList === b.staffList || staffKey(a.staffList) === staffKey(b.staffList))
  );
}

function ServiceRowTableImpl({ row, staffList, selected, onSelect, canEdit, actions, priceLocked }: ServiceRowProps) {
  const t = useT('services');
  const format = useFormat();
  const locale = useLocale() as 'ru' | 'en';
  const s = row.service;
  const name = pickText(s.name, locale);
  const tbOptions = [
    { value: 'shared', label: t('techBreak.shared') },
    { value: 'none', label: t('techBreak.noneShort') },
    ...TECH_BREAK_MINUTES.map((n) => ({
      value: String(n),
      label: t('techBreak.plusShort', { n }),
    })),
  ];

  return (
    <>
      {canEdit ? (
        <Checkbox checked={selected} onCheckedChange={(on) => onSelect(s.id, on)} aria-label={t('list.select', { name })} />
      ) : (
        <span />
      )}
      <span className="flex min-w-0 items-center gap-2">
        <Link href={`/biz/services/${s.id}`} className="truncate font-medium text-fg hover:text-primary-text hover:underline">
          {name}
        </Link>
        {s.kind === 'group' && (
          <Badge tone="info" size="sm">
            {t('badge.group')}
          </Badge>
        )}
        {s.servicePackage && (
          <Badge tone="neutral" size="sm">
            {t('badge.package')}
          </Badge>
        )}
        {!s.active && (
          <Badge tone="warning" size="sm">
            {t('badge.inactive')}
          </Badge>
        )}
      </span>
      <span className="flex justify-center">
        <Switch
          checked={s.onlineBookable}
          onCheckedChange={(on) => void actions.patch(s.id, { onlineBookable: on })}
          disabled={!canEdit}
          aria-label={t('list.onlineFor', { name })}
        />
      </span>
      <InlineRangeCell
        kind="money"
        min={s.priceMin}
        max={s.priceMax}
        display={formatMoneyRange(s.priceMin, s.priceMax)}
        label={t('list.colPrice')}
        canEdit={canEdit && !priceLocked}
        onCommit={(p) => void actions.patch(s.id, 'min' in p ? { priceMin: p.min } : { priceMax: p.max })}
        className="font-semibold"
      />
      <InlineRangeCell
        kind="minutes"
        min={s.durationMin}
        max={s.durationMax}
        display={format.durationRange(s.durationMin, s.durationMax)}
        label={t('list.colDuration')}
        canEdit={canEdit}
        onCommit={(p) => void actions.patch(s.id, 'min' in p ? { durationMin: p.min } : { durationMax: p.max })}
      />
      <Select
        size="sm"
        aria-label={t('list.techBreakFor', { name })}
        options={tbOptions}
        value={techBreakValue(s.bufferAfterMin)}
        onValueChange={(v) => void actions.patch(s.id, { bufferAfterMin: techBreakFromValue(v) })}
        disabled={!canEdit}
      />
      <StaffCell
        staffIds={s.staffIds}
        staffList={staffList}
        canEdit={canEdit}
        onCommit={(ids) => void actions.setStaff(s.id, ids)}
        label={t('list.staffFor', { name })}
      />
      {canEdit ? (
        <DropdownMenu
          label={t('rowActions.label')}
          trigger={(p) => (
            <IconButton {...p} size="sm" icon={<MoreHorizontal aria-hidden />} variant="ghost" label={t('rowActions.label')} />
          )}
          items={[
            {
              id: 'edit',
              label: t('rowActions.edit'),
              icon: <Pencil aria-hidden />,
              href: `/biz/services/${s.id}`,
            },
            { id: 'sep', separator: true },
            {
              id: 'delete',
              label: t('delete.button'),
              icon: <Trash2 aria-hidden />,
              danger: true,
              onSelect: () => void actions.deleteServices([row]),
            },
          ]}
        />
      ) : (
        <span />
      )}
    </>
  );
}

/** Ячейки строки таблицы (без ⠿ и самого <li> — их даёт SortableRow). memo: при правке одной строки остальные не
 * перерисовываются (DESIGN.md «Nothing blinks»); список мастеров сравнивается по составу, а не по ссылке */
export const ServiceRowTable = memo(ServiceRowTableImpl, sameRowProps);
