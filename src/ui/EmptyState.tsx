'use client';

import type { ReactNode } from 'react';
import { Inbox, RotateCcw, SearchX } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';

/**
 * Где стоит пустое состояние:
 *   page    — весь экран пуст (по умолчанию): крупная иконка, воздух сверху и снизу;
 *   section — внутри карточки, секции, таблицы, вкладки, графика (то же, что compact);
 *   inline  — одна строка с иконкой: выпадающий список, день календаря, маленький блок в боковой панели.
 */
export type EmptyStateVariant = 'page' | 'section' | 'inline';

/** Что пусто: default — данных ещё нет; search — поиск или фильтр дал ноль */
export type EmptyStateKind = 'default' | 'search';

export interface EmptyStateProps {
  icon?: ReactNode;
  /** По умолчанию «Пока пусто» (для kind="search" — «Ничего не нашли») */
  title?: ReactNode;
  description?: ReactNode;
  /** Кнопка действия («Добавить клиента») */
  action?: ReactNode;
  /** Меньше отступов — внутри карточки или списка (то же, что variant="section") */
  compact?: boolean;
  variant?: EmptyStateVariant;
  kind?: EmptyStateKind;
  /** kind="search": показать кнопку «Сбросить фильтры» */
  onReset?: () => void;
  /** Пунктирная рамка вокруг — пустой блок посреди страницы не теряется */
  framed?: boolean;
  className?: string;
}

const PAD: Record<EmptyStateVariant, string> = {
  page: 'gap-3 px-6 py-12 sm:py-16',
  section: 'gap-2 px-4 py-8',
  inline: 'flex-row gap-3 px-3 py-4 text-left',
};

const ICON: Record<EmptyStateVariant, string> = {
  page: 'size-16 ring-8 [&_svg]:size-7',
  section: 'size-12 ring-[6px] [&_svg]:size-5',
  inline: 'size-9 ring-0 [&_svg]:size-[18px]',
};

/** Пустое состояние экрана, секции или списка: иконка, одна фраза по-человечески, кнопка первого действия */
export function EmptyState({
  icon,
  title,
  description,
  action,
  compact = false,
  variant,
  kind = 'default',
  onReset,
  framed = false,
  className,
}: EmptyStateProps) {
  const t = useT('ui');
  const v: EmptyStateVariant = variant ?? (compact ? 'section' : 'page');
  const isSearch = kind === 'search';
  const shownIcon = icon ?? (isSearch ? <SearchX /> : <Inbox />);
  const shownTitle = title ?? (isSearch ? t('emptyState.searchTitle') : t('emptyState.title'));
  const shownDescription = description ?? (isSearch && v !== 'inline' ? t('emptyState.searchText') : undefined);
  const reset =
    isSearch && onReset ? (
      <Button variant="secondary" size="sm" leftIcon={<RotateCcw aria-hidden />} onClick={onReset}>
        {t('emptyState.reset')}
      </Button>
    ) : null;
  const actions = action || reset;

  return (
    <div
      data-empty-state=""
      className={cn(
        'flex flex-col items-center justify-center text-center',
        PAD[v],
        framed && 'rounded-xl border border-dashed border-border-strong/40 bg-surface-2/40',
        className,
      )}
    >
      {/* Иконка на мягкой «подушке» из двух колец — дружелюбно, без картинок; поиск — нейтральнее */}
      <span
        aria-hidden
        className={cn(
          'relative inline-flex shrink-0 items-center justify-center rounded-full',
          isSearch ? 'bg-surface-2 text-muted ring-surface-2/50' : 'bg-primary-soft text-primary-text ring-primary-soft/50',
          v !== 'inline' && 'mb-1',
          ICON[v],
        )}
      >
        {shownIcon}
      </span>
      <div className={cn('flex flex-col', v === 'inline' ? 'min-w-0 flex-1 gap-0.5' : 'items-center gap-1.5')}>
        <p
          className={cn(
            'font-semibold tracking-tight text-fg',
            v === 'page' ? 'text-lg sm:text-xl' : v === 'section' ? 'text-base' : 'text-[0.9375rem]',
          )}
        >
          {shownTitle}
        </p>
        {shownDescription && (
          <p
            className={cn(
              'max-w-md leading-relaxed text-muted',
              v === 'page' ? 'text-base' : 'text-sm',
            )}
          >
            {shownDescription}
          </p>
        )}
      </div>
      {actions && (
        <div
          className={cn(
            'flex flex-wrap justify-center gap-2',
            v === 'page' ? 'mt-3' : v === 'section' ? 'mt-2' : 'shrink-0',
          )}
        >
          {action}
          {reset}
        </div>
      )}
    </div>
  );
}
