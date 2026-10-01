'use client';

/**
 * «Все мастера ⌄» (DESIGN.md → Journal A2): стопка аватаров + подпись; внутри — фильтры, которые раньше стояли рядом
 * селектов над сеткой: колонки «мастера / ресурсы» и должность (F-01-012), выбор мастеров дня, ресурс; в виде
 * «Неделя» — чья неделя: мастер или ресурс (F-01-013, F-16-020). Внутри только кнопки и флажки — без вложенных
 * выпадающих списков (второй слой поверх поповера закрывал бы его).
 */
import { Plus } from 'lucide-react';
import { useLocale } from 'next-intl';
import { useState } from 'react';
import type { Id, Resource, Staff } from '@/domain/core';
import type { JournalGroupBy } from '@/domain/journal';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { pickText } from '@/lib/text';
import type { JournalView } from '@/areas/journal/components/JournalToolbar';
import { useStaffSets } from '@/areas/journal/lib/staffSets';
import { Button } from '@/ui/Button';
import { Avatar } from '@/ui/Avatar';
import { Skeleton } from '@/ui/Skeleton';
import { Checkbox } from '@/ui/Checkbox';
import { Chip } from '@/ui/Chip';
import { DropdownChevron } from '@/ui/DropdownChevron';
import { Input } from '@/ui/Input';
import { Popover } from '@/ui/Popover';
import { SegmentedControl } from '@/ui/SegmentedControl';

export interface WeekResourceOption {
  resource: Resource;
  instanceId: Id;
  instanceName: string;
}

export interface MastersPickerProps {
  view: JournalView;
  /** Мастера с графиком на день — из них стопка аватаров и список выбора */
  staff: Staff[];
  hiddenStaffIds: Id[];
  onHiddenStaffChange: (ids: Id[]) => void;
  canSeeOthers: boolean;
  groupBy: JournalGroupBy;
  onGroupByChange: (g: JournalGroupBy) => void;
  positions: string[];
  positionFilter: string;
  onPositionFilterChange: (position: string) => void;
  resources: Resource[];
  resourceFilter: string;
  onResourceFilterChange: (resourceId: string) => void;
  /** Неделя */
  allStaff: Staff[];
  weekStaffId: Id;
  onWeekStaffChange: (id: Id) => void;
  weekSubjectKind: 'staff' | 'resource';
  onWeekSubjectKindChange: (kind: 'staff' | 'resource') => void;
  weekResourceOptions: WeekResourceOption[];
  weekResourceInstanceId: string;
  onWeekResourceInstanceChange: (value: string) => void;
  /** «Работают сейчас» — мастера, у кого сейчас рабочие часы (только когда в журнале сегодня) */
  workingNowIds?: Id[];
  /** Чьи «Мои наборы» — сотрудник, который сейчас в журнале */
  setsStaffId: Id | undefined;
  /** Первая загрузка: на месте аватаров — столько же кружков-заглушек, подпись «Все мастера» */
  loading?: boolean;
  className?: string;
}

/** Сколько аватаров в кнопке при загрузке — типичный день демо (4 мастера; кнопка показывает не больше 4) */
const LOADING_STACK = 4;

function SectionTitle({ children }: { children: string }) {
  return <p className="px-1 text-xs font-semibold tracking-wide text-muted uppercase">{children}</p>;
}

export function MastersPicker(props: MastersPickerProps) {
  const {
    view,
    staff,
    hiddenStaffIds,
    onHiddenStaffChange,
    canSeeOthers,
    groupBy,
    onGroupByChange,
    positions,
    positionFilter,
    onPositionFilterChange,
    resources,
    resourceFilter,
    onResourceFilterChange,
    allStaff,
    weekStaffId,
    onWeekStaffChange,
    weekSubjectKind,
    onWeekSubjectKindChange,
    weekResourceOptions,
    weekResourceInstanceId,
    onWeekResourceInstanceChange,
    workingNowIds,
    setsStaffId,
    loading,
    className,
  } = props;
  const { sets, add: addSet, remove: removeSet } = useStaffSets(setsStaffId);
  const [naming, setNaming] = useState(false);
  const [setName, setSetName] = useState('');
  const t = useT('journal');
  const locale = useLocale();
  const visible = staff.filter((s) => !hiddenStaffIds.includes(s.id));
  const weekStaff = allStaff.find((s) => s.id === weekStaffId);
  const weekResource = weekResourceOptions.find((o) => `${o.resource.id}:${o.instanceId}` === weekResourceInstanceId);
  const resourceLabel = (o: WeekResourceOption) =>
    o.resource.instances.length > 1 ? `${pickText(o.resource.name, locale)} ${o.instanceName}`.trim() : pickText(o.resource.name, locale);

  const label =
    view === 'week'
      ? weekSubjectKind === 'resource'
        ? (weekResource ? resourceLabel(weekResource) : t('board.masters.weekResource'))
        : (weekStaff?.name ?? t('board.masters.all'))
      : groupBy === 'resource'
        ? (() => {
            const r = resourceFilter === 'all' ? undefined : resources.find((x) => x.id === resourceFilter);
            return r ? pickText(r.name, locale) : t('toolbar.allResources');
          })()
        : visible.length === staff.length && positionFilter === 'all'
          ? t('board.masters.all')
          : positionFilter !== 'all' && visible.length === staff.length
            ? positionFilter
            : t('board.masters.some', { n: visible.length, total: staff.length });
  const stack = view === 'week' ? (weekStaff ? [weekStaff] : []) : visible.slice(0, 4);

  // Показать ровно этих мастеров (из тех, кто работает в этот день); никого из них нет — ничего не меняем
  const showOnly = (ids: Id[]) => {
    const keep = new Set(ids);
    if (!staff.some((s) => keep.has(s.id))) return;
    onHiddenStaffChange(staff.filter((s) => !keep.has(s.id)).map((s) => s.id));
    onPositionFilterChange('all');
  };
  const isShowingOnly = (ids: Id[]) => {
    const keep = new Set(ids);
    return positionFilter === 'all' && staff.every((s) => keep.has(s.id) === !hiddenStaffIds.includes(s.id));
  };
  const saveSet = () => {
    if (!setName.trim() || visible.length === 0) return;
    addSet(setName, visible.map((s) => s.id));
    setSetName('');
    setNaming(false);
  };

  const toggleStaff = (id: Id, checked: boolean) => {
    const next = checked ? hiddenStaffIds.filter((x) => x !== id) : [...hiddenStaffIds, id];
    // Скрыть всех нельзя — пустая сетка без объяснения; последний флажок снимать не даём
    if (next.length >= staff.length) return;
    onHiddenStaffChange(next);
  };

  return (
    <Popover
      align="end"
      label={t('board.masters.title')}
      mobile="sheet"
      trigger={(p) => (
        <button
          {...p}
          type="button"
          disabled={loading}
          data-f="F-01-012 F-01-013"
          className={cn(
            'flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm text-fg transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-focus',
            className,
          )}
        >
          {loading ? (
            <span className="flex -space-x-2">
              {Array.from({ length: LOADING_STACK }, (_, i) => (
                <Skeleton key={i} variant="circle" className="size-8 ring-2 ring-surface" />
              ))}
            </span>
          ) : stack.length > 0 && (
            <span className="flex -space-x-2">
              {stack.map((s) => (
                <Avatar key={s.id} name={s.name} src={s.avatarUrl} colorIndex={s.colorIndex} size="sm" className="ring-2 ring-surface" />
              ))}
            </span>
          )}
          {/* Уже 1400px — только аватары: подпись отдаёт место дате в ряду управления (остаётся для чтения с экрана) */}
          <span className="max-w-40 truncate md:max-[1399px]:sr-only">{loading ? t('board.masters.all') : label}</span>
          <DropdownChevron open={p['aria-expanded']} />
        </button>
      )}
    >
      <div className="flex w-full flex-col gap-4 p-2 sm:w-80">
        {view !== 'week' && canSeeOthers && (
          <div className="flex flex-col gap-2">
            <SectionTitle>{t('board.masters.columns')}</SectionTitle>
            <SegmentedControl
              size="sm"
              fullWidth
              aria-label={t('board.masters.columns')}
              value={groupBy}
              onValueChange={(v) => onGroupByChange(v as JournalGroupBy)}
              options={[
                { value: 'staff', label: t('board.masters.byStaff') },
                { value: 'resource', label: t('board.masters.byResource') },
              ]}
            />
          </div>
        )}

        {view !== 'week' && groupBy === 'staff' && (
          <>
            {canSeeOthers && staff.length > 1 && (
              // ⭐ Быстрые наборы (29.09.2026): «Работают сейчас» и свои сохранённые — одним нажатием вместо 15 флажков
              <div className="flex flex-col gap-2">
                <SectionTitle>{t('board.masters.quick')}</SectionTitle>
                <div className="flex flex-wrap gap-1.5">
                  {workingNowIds && (
                    <Chip
                      selected={workingNowIds.length > 0 && isShowingOnly(workingNowIds)}
                      disabled={workingNowIds.length === 0}
                      onClick={() => showOnly(workingNowIds)}
                    >
                      {t('board.masters.workingNow')}
                    </Chip>
                  )}
                  {sets.map((set) => (
                    <Chip
                      key={set.id}
                      selected={isShowingOnly(set.staffIds.filter((id) => staff.some((s) => s.id === id)))}
                      disabled={!set.staffIds.some((id) => staff.some((s) => s.id === id))}
                      onClick={() => showOnly(set.staffIds)}
                      onRemove={() => removeSet(set.id)}
                      removeLabel={t('board.masters.deleteSet', { name: set.name })}
                    >
                      {set.name}
                    </Chip>
                  ))}
                </div>
                {naming ? (
                  <form
                    noValidate
                    className="flex items-center gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      saveSet();
                    }}
                  >
                    <Input
                      size="sm"
                      autoFocus
                      aria-label={t('board.masters.setName')}
                      placeholder={t('board.masters.setNamePlaceholder')}
                      value={setName}
                      onChange={(e) => setSetName(e.target.value)}
                      className="min-w-0 flex-1"
                    />
                    <Button size="sm" type="submit" disabled={!setName.trim()}>
                      {t('board.masters.save')}
                    </Button>
                    <Button size="sm" variant="ghost" type="button" onClick={() => setNaming(false)}>
                      {t('board.masters.cancel')}
                    </Button>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => setNaming(true)}
                    className="flex min-h-9 w-fit items-center gap-1.5 px-1 text-sm font-semibold text-primary-text"
                  >
                    <Plus aria-hidden className="size-4" />
                    {t('board.masters.saveSet')}
                  </button>
                )}
                {sets.length === 0 && !naming && <p className="px-1 text-xs text-muted">{t('board.masters.setsHint')}</p>}
              </div>
            )}
            {canSeeOthers && positions.length > 1 && (
              <div className="flex flex-col gap-2">
                <SectionTitle>{t('board.masters.position')}</SectionTitle>
                <div className="flex flex-wrap gap-1.5">
                  <Chip selected={positionFilter === 'all'} onClick={() => onPositionFilterChange('all')}>
                    {t('board.masters.allPositions')}
                  </Chip>
                  {positions.map((p) => (
                    <Chip key={p} selected={positionFilter === p} onClick={() => onPositionFilterChange(p)}>
                      {p}
                    </Chip>
                  ))}
                </div>
              </div>
            )}
            {staff.length > 1 && (
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <SectionTitle>{t('board.masters.title')}</SectionTitle>
                  {hiddenStaffIds.length > 0 && (
                    <button type="button" onClick={() => onHiddenStaffChange([])} className="min-h-9 px-1 text-sm font-semibold text-primary-text">
                      {t('board.masters.showAll')}
                    </button>
                  )}
                </div>
                {staff.map((s) => (
                  <div key={s.id} className="flex min-h-11 items-center gap-2.5 rounded-md px-1 hover:bg-surface-2">
                    <Checkbox
                      checked={!hiddenStaffIds.includes(s.id)}
                      onCheckedChange={(v) => toggleStaff(s.id, Boolean(v))}
                      label={
                        <span className="flex items-center gap-2">
                          <Avatar name={s.name} src={s.avatarUrl} colorIndex={s.colorIndex} size="xs" />
                          <span className="truncate">{s.name}</span>
                        </span>
                      }
                    />
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {view !== 'week' && groupBy === 'resource' && (
          <div className="flex flex-col gap-2">
            <SectionTitle>{t('board.masters.resource')}</SectionTitle>
            <div className="flex flex-wrap gap-1.5">
              <Chip selected={resourceFilter === 'all'} onClick={() => onResourceFilterChange('all')}>
                {t('board.masters.allResources')}
              </Chip>
              {resources.map((r) => (
                <Chip key={r.id} selected={resourceFilter === r.id} onClick={() => onResourceFilterChange(r.id)}>
                  {pickText(r.name, locale)}
                </Chip>
              ))}
            </div>
          </div>
        )}

        {view === 'week' && (
          <div data-f="F-16-020" className="flex flex-col gap-2">
            <SectionTitle>{t('board.masters.weekOf')}</SectionTitle>
            {weekResourceOptions.length > 0 && (
              <SegmentedControl
                size="sm"
                fullWidth
                aria-label={t('board.masters.weekOf')}
                value={weekSubjectKind}
                onValueChange={(v) => onWeekSubjectKindChange(v as 'staff' | 'resource')}
                options={[
                  { value: 'staff', label: t('board.masters.weekStaff') },
                  { value: 'resource', label: t('board.masters.weekResource') },
                ]}
              />
            )}
            <div role="radiogroup" aria-label={t('board.masters.weekOf')} className="flex max-h-72 flex-col gap-0.5 overflow-y-auto">
              {weekSubjectKind === 'resource'
                ? weekResourceOptions.map((o) => {
                    const value = `${o.resource.id}:${o.instanceId}`;
                    const selected = value === weekResourceInstanceId;
                    return (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => onWeekResourceInstanceChange(value)}
                        className={cn('flex min-h-11 items-center rounded-md px-2 text-left text-sm', selected ? 'bg-primary-soft font-semibold text-primary-text' : 'hover:bg-surface-2')}
                      >
                        {resourceLabel(o)}
                      </button>
                    );
                  })
                : allStaff.map((s) => {
                    const selected = s.id === weekStaffId;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => onWeekStaffChange(s.id)}
                        className={cn(
                          'flex min-h-11 items-center gap-2.5 rounded-md px-2 text-left text-sm',
                          selected ? 'bg-primary-soft font-semibold text-primary-text' : 'hover:bg-surface-2',
                        )}
                      >
                        <Avatar name={s.name} src={s.avatarUrl} colorIndex={s.colorIndex} size="xs" />
                        <span className="truncate">{s.name}</span>
                      </button>
                    );
                  })}
            </div>
          </div>
        )}
      </div>
    </Popover>
  );
}
