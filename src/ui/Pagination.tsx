'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { IconButton } from '@/ui/IconButton';
import { Select } from '@/ui/Select';
import { SkeletonText } from '@/ui/Skeleton';

export interface PaginationProps {
  /** Текущая страница, с 1 */
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  className?: string;
  /**
   * Список ещё грузится: та же строка на своём месте (под скелетоном таблицы), «1–10 из N» — полосой, кнопки выключены.
   * total — сколько было в прошлый раз (0 — неизвестно: одна страница)
   */
  loading?: boolean;
}

/**
 * Единый выбор «сколько на странице» во всём продукте (owner 29.09.2026: «как в Записях — для всех таких мест»):
 * по умолчанию 10, можно 20, 50, 100.
 */
export const PAGE_SIZES = [10, 20, 50, 100];
export const DEFAULT_PAGE_SIZE = PAGE_SIZES[0];

/** Номера страниц с многоточиями: 1 … 4 5 6 … 20 */
function pageList(page: number, pages: number): (number | 'gap')[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const set = new Set([1, pages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pages));
  const sorted = Array.from(set).sort((a, b) => a - b);
  const out: (number | 'gap')[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push('gap');
    out.push(p);
  });
  return out;
}

/** Постраничный вывод: «1–20 из 124», стрелки, номера (на телефоне — «Страница 1 из 7»). */
export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = PAGE_SIZES,
  className,
  loading = false,
}: PaginationProps) {
  const t = useT('ui');
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, page), pages);
  const from = total === 0 ? 0 : (current - 1) * pageSize + 1;
  const to = Math.min(total, current * pageSize);

  return (
    <nav
      aria-label={t('pagination.label')}
      className={cn('flex flex-wrap items-center justify-between gap-x-4 gap-y-2', className)}
    >
      <p className="text-sm text-muted tabular-nums">
        {loading ? <SkeletonText width="12ch" /> : t('pagination.shown', { from, to, total })}
      </p>
      <div className="flex items-center gap-1">
        {onPageSizeChange && (
          <label className="mr-2 flex items-center gap-2 text-sm text-muted">
            <span className="hidden sm:inline">{t('pagination.perPage')}</span>
            <Select
              size="sm"
              className="w-20"
              value={String(pageSize)}
              disabled={loading}
              onValueChange={(v) => onPageSizeChange(Number(v))}
              options={pageSizeOptions.map((n) => ({ value: String(n), label: String(n) }))}
            />
          </label>
        )}
        <IconButton
          size="sm"
          icon={<ChevronLeft aria-hidden />}
          label={t('pagination.prev')}
          disabled={loading || current <= 1}
          onClick={() => onPageChange(current - 1)}
        />
        <span className="px-2 text-sm tabular-nums sm:hidden">
          {t('pagination.pageOf', { page: current, total: pages })}
        </span>
        <ul className="hidden items-center gap-1 sm:flex">
          {pageList(current, pages).map((p, i) =>
            p === 'gap' ? (
              <li key={`gap-${i}`} aria-hidden className="px-1 text-muted">
                …
              </li>
            ) : (
              <li key={p}>
                <button
                  type="button"
                  aria-current={p === current ? 'page' : undefined}
                  disabled={loading}
                  onClick={() => onPageChange(p)}
                  className={cn(
                    'min-h-10 min-w-10 rounded-lg px-2 text-sm tabular-nums transition-colors',
                    p === current ? 'bg-primary font-semibold text-primary-contrast' : 'text-fg hover:bg-surface-2',
                  )}
                >
                  {p}
                </button>
              </li>
            ),
          )}
        </ul>
        <IconButton
          size="sm"
          icon={<ChevronRight aria-hidden />}
          label={t('pagination.next')}
          disabled={loading || current >= pages}
          onClick={() => onPageChange(current + 1)}
        />
      </div>
    </nav>
  );
}

/**
 * Постраничный вывод для списков, которые не таблица (карточки, <ul>, самописная <table>) — тот же вид и те же размеры,
 * что у Table:
 *
 *   const { pageItems, pager } = usePagedList(entries);
 *   {pageItems.map(…)}
 *   {pager}
 *
 * Сменился resetKey или список поменялся больше чем на один элемент (фильтр, поиск) — снова первая страница; добавили или
 * удалили один — страница та же. Элементов не больше 10 — pager = null.
 */
export function usePagedList<T>(
  items: readonly T[],
  options: { resetKey?: unknown; className?: string } = {},
): { pageItems: T[]; pager: ReactNode; page: number; pageSize: number } {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  // На первую страницу — когда сменился фильтр/поиск (resetKey) или список поменялся целиком. Добавили или удалили
  // один элемент — остаёмся на своей странице (удаление на 3-й странице не должно выкидывать на 1-ю)
  const [seen, setSeen] = useState({ count: items.length, resetKey: options.resetKey });
  if (seen.count !== items.length || seen.resetKey !== options.resetKey) {
    const small = seen.resetKey === options.resetKey && Math.abs(seen.count - items.length) === 1;
    setSeen({ count: items.length, resetKey: options.resetKey });
    if (!small) setPage(1);
  }
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(page, pages);
  const pageItems = items.slice((current - 1) * pageSize, current * pageSize);
  const pager =
    items.length > DEFAULT_PAGE_SIZE ? (
      <Pagination
        page={current}
        pageSize={pageSize}
        total={items.length}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
        className={cn('mt-4', options.className)}
      />
    ) : null;
  return { pageItems, pager, page: current, pageSize };
}
