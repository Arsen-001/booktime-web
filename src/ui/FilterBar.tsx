'use client';

import { SlidersHorizontal } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { Button } from '@/ui/Button';
import type { DateRange } from '@/ui/Calendar';
import { Chip } from '@/ui/Chip';
import { formatDateRange } from '@/ui/DateRangePicker';
import { Popover } from '@/ui/Popover';
import { SearchInput } from '@/ui/SearchInput';
import { Sheet } from '@/ui/Sheet';
import { useIsMobile } from '@/ui/hooks/useMediaQuery';
import { deriveFilterState, type FilterState } from '@/ui/parts/filterState';

export interface FilterBarFilter {
  id: string;
  label: ReactNode;
  node: ReactNode;
  /**
   * Главный фильтр экрана (1–2 на экран, например период): остаётся в строке на компьютере, а не в панели
   * «Фильтры». По умолчанию все фильтры — в панели.
   */
  primary?: boolean;
  /**
   * Включён ли фильтр, текст чипа и как его убрать. Обычно не нужны: Select, DateRangePicker, Input и
   * мультивыбор FilterBar узнаёт сам (parts/filterState). Нужны для нестандартных полей (группа Chip и т. п.).
   */
  active?: boolean;
  chip?: ReactNode;
  onClear?: () => void;
}

export interface FilterBarProps {
  search?: { value: string; onValueChange: (value: string) => void; placeholder?: string; debounceMs?: number };
  /** Дополнительные поля без подписей (старый способ) — попадают в панель «Фильтры» */
  children?: ReactNode;
  /** Фильтры с подписями — в панели «Фильтры» (поповер на компьютере, шторка на телефоне) */
  filters?: FilterBarFilter[];
  /**
   * Сколько фильтров включено — запасной счётчик для кнопки «Фильтры» и «Сбросить», когда FilterBar не может
   * сосчитать сам (есть children или поле, которое он не узнаёт)
   */
  activeCount?: number;
  /** Сбросить всё; без него «Сбросить» убирает по очереди каждый узнанный фильтр */
  onReset?: () => void;
  /** Кнопки справа (например, «Добавить») */
  actions?: ReactNode;
  className?: string;
}

interface Resolved {
  filter: FilterBarFilter;
  state: FilterState | undefined;
}

function resolve(filter: FilterBarFilter, formatRange: (r: DateRange | undefined) => string | null): Resolved {
  const derived = deriveFilterState(filter.node, formatRange);
  if (filter.active === undefined && !filter.onClear) return { filter, state: derived };
  const clear = filter.onClear ?? derived?.clear;
  if (!clear) return { filter, state: undefined };
  return {
    filter,
    state: { active: filter.active ?? derived?.active ?? false, value: filter.chip ?? derived?.value ?? null, clear },
  };
}

/**
 * Строка над списком (DESIGN.md → «Фильтры»): поиск + ОДНА кнопка «Фильтры ⌄ (n)». Все фильтры — в панели
 * (поповер на компьютере, шторка на телефоне); включённые — чипами под строкой (× убирает один, «Сбросить» — все).
 * Главные фильтры экрана (primary, 1–2) остаются в строке на компьютере.
 */
export function FilterBar({ search, children, filters = [], activeCount = 0, onReset, actions, className }: FilterBarProps) {
  const t = useT('ui');
  const format = useFormat();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  const formatRange = (r: DateRange | undefined) => formatDateRange(format, r);
  const resolved = filters.map((f) => resolve(f, formatRange));
  // На телефоне в шторку уходит всё; на компьютере главные остаются в строке
  const inline = isMobile ? [] : resolved.filter((r) => r.filter.primary);
  const hidden = isMobile ? resolved : resolved.filter((r) => !r.filter.primary);
  const hasPanel = hidden.length > 0 || Boolean(children);
  const allKnown = !children && resolved.every((r) => r.state);

  // Главный фильтр (обычно период с периодом по умолчанию) не становится чипом и не входит в счётчик — и на телефоне,
  // где он уезжает в шторку: это рамка списка, а не «включённый фильтр»
  const chips: { filter: FilterBarFilter; state: FilterState }[] = [];
  for (const r of hidden) if (r.state?.active && !r.filter.primary) chips.push({ filter: r.filter, state: r.state });
  const count = allKnown ? chips.length : Math.max(activeCount, chips.length);
  // «Сбросить» видно, когда есть чипы или экран сам говорит, что что-то включено (например, главный период)
  const anyActive = chips.length > 0 || activeCount > 0;
  const reset =
    onReset ??
    (allKnown
      ? () => {
          for (const r of resolved) if (r.state?.active) r.state.clear();
        }
      : undefined);

  const fields = (
    <div className="flex flex-col gap-4">
      {hidden.map(({ filter }) => (
        <div key={filter.id} className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-fg">{filter.label}</span>
          {filter.node}
        </div>
      ))}
      {children}
    </div>
  );

  const badge = count > 0 && (
    <span
      aria-hidden
      className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] leading-5 font-semibold text-primary-contrast"
    >
      {count}
    </span>
  );
  const triggerLabel = count > 0 ? t('filter.active', { count }) : t('filter.title');

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex flex-wrap items-center gap-2">
        {search && (
          <SearchInput
            value={search.value}
            onValueChange={search.onValueChange}
            placeholder={search.placeholder}
            debounceMs={search.debounceMs}
            // Поиск берёт свободное место (подсказки вида «по имени, телефону, email» не обрезаются), но не всю строку
            className="min-w-0 flex-1 md:max-w-xl md:min-w-64"
          />
        )}
        {inline.map(({ filter }) => (
          <div key={filter.id} className="relative w-auto max-w-xs">
            <span className="sr-only">{filter.label}</span>
            {filter.node}
          </div>
        ))}
        {hasPanel && !isMobile && (
          <Popover
            role="dialog"
            label={t('filter.title')}
            open={open}
            onOpenChange={setOpen}
            className="max-h-[min(36rem,calc(100vh-6rem))] w-[22rem] p-4"
            trigger={(p) => (
              <Button
                {...p}
                variant="outline"
                aria-label={triggerLabel}
                leftIcon={<SlidersHorizontal aria-hidden />}
                className={cn(count > 0 && 'border-primary text-primary-text')}
              >
                {t('filter.title')}
                {badge}
              </Button>
            )}
          >
            {fields}
            <div className="sticky -bottom-4 -mx-4 mt-4 -mb-4 flex justify-end gap-2 border-t border-border bg-surface px-4 pt-3 pb-4">
              {reset && (
                <Button variant="ghost" size="sm" onClick={reset} disabled={!anyActive}>
                  {t('filter.reset')}
                </Button>
              )}
              <Button size="sm" onClick={() => setOpen(false)}>
                {t('filter.apply')}
              </Button>
            </div>
          </Popover>
        )}
        {hasPanel && isMobile && (
          // Телефон: рядом с поиском — компактная кнопка, чтобы поле поиска не сжималось до «Имя ил…».
          // Без поиска — полная подпись «Фильтры». Число включённых фильтров — кружком на кнопке.
          <Button
            variant="outline"
            aria-label={triggerLabel}
            aria-haspopup="dialog"
            aria-expanded={open}
            chevron={!search}
            className={cn('relative', search && 'w-11 px-0', count > 0 && 'border-primary text-primary-text')}
            leftIcon={search ? undefined : <SlidersHorizontal aria-hidden />}
            onClick={() => setOpen(true)}
          >
            {search ? <SlidersHorizontal aria-hidden /> : t('filter.title')}
            {search && count > 0 ? (
              <span
                aria-hidden
                className="absolute -top-1.5 -right-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] leading-5 font-semibold text-primary-contrast ring-2 ring-bg"
              >
                {count}
              </span>
            ) : (
              badge
            )}
          </Button>
        )}
        {actions && <div className="ml-auto hidden items-center gap-2 md:flex">{actions}</div>}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 md:hidden [&>a:not([data-icon-button])]:grow [&>button:not([data-icon-button])]:grow">
          {actions}
        </div>
      )}
      {(chips.length > 0 || (anyActive && reset)) && (
        <div role="group" aria-label={t('filter.chips')} className="flex flex-wrap items-center gap-2">
          {chips.map(({ filter, state }) => {
            const name = typeof filter.label === 'string' ? filter.label : typeof state.value === 'string' ? state.value : '';
            return (
              <Chip key={filter.id} selected onRemove={state.clear} removeLabel={t('filter.remove', { name })}>
                {state.value ? (
                  <>
                    <span className="font-normal opacity-75">{filter.label}:</span> {state.value}
                  </>
                ) : (
                  filter.label
                )}
              </Chip>
            );
          })}
          {reset && anyActive && (
            <Button variant="ghost" size="sm" onClick={reset}>
              {t('filter.reset')}
            </Button>
          )}
        </div>
      )}
      {hasPanel && (
        <Sheet
          open={open && isMobile}
          onOpenChange={setOpen}
          side="bottom"
          title={t('filter.title')}
          footer={
            <>
              {reset && (
                <Button variant="outline" onClick={reset} disabled={!anyActive}>
                  {t('filter.reset')}
                </Button>
              )}
              <Button onClick={() => setOpen(false)}>{t('filter.apply')}</Button>
            </>
          }
        >
          {fields}
        </Sheet>
      )}
    </div>
  );
}
