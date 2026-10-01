'use client';

import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { Checkbox } from '@/ui/Checkbox';
import { EmptyState } from '@/ui/EmptyState';
import { DEFAULT_PAGE_SIZE, Pagination } from '@/ui/Pagination';
import { SkeletonText } from '@/ui/Skeleton';
import { TableCardBody } from '@/ui/TableCardBody';
import { useControllableState } from '@/ui/hooks/useControllableState';
import { useScrollEdges } from '@/ui/hooks/useScrollEdges';
import { useRememberedLayout, useSkeletonCount } from '@/ui/hooks/useSkeletonCount';
import { useNavigate } from '@/ui/navigation/useNavigate';

export type TableAlign = 'left' | 'right' | 'center';
/**
 * Роль колонки в карточке на телефоне: title — заголовок; subtitle — строка под ним; meta — строка «подпись: значение»;
 * badge — статус справа в строке заголовка; media — картинка 56×56 слева; aside — время/сумма справа от subtitle;
 * hidden — не показывать.
 */
export type TableMobileRole = 'title' | 'subtitle' | 'meta' | 'badge' | 'media' | 'aside' | 'hidden';

export interface TableColumn<T> {
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  sortable?: boolean;
  /** Значение для сортировки (иначе — текст ячейки, если это строка или число) */
  sortValue?: (row: T) => string | number;
  align?: TableAlign;
  /** CSS-ширина колонки, например '12rem' или '20%' */
  width?: string;
  /** По умолчанию первая колонка — title, остальные — meta */
  mobile?: TableMobileRole;
  className?: string;
  /**
   * Что показать в ячейке при загрузке — в форме содержимого (аватар + имя, значок статуса). По умолчанию — полоса
   * текста типичной ширины (skeletonWidth). Ячейка та же (отступы, высота), меняется только её содержимое.
   */
  skeleton?: ReactNode;
  /** Ширина полосы-скелетона по умолчанию: '14ch' — примерно столько знаков, как у типичного значения */
  skeletonWidth?: string;
}

export interface TableSort {
  columnId: string;
  dir: 'asc' | 'desc';
}

export interface TableProps<T> {
  columns: TableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  selectable?: boolean;
  selected?: string[];
  defaultSelected?: string[];
  onSelectedChange?: (ids: string[]) => void;
  sort?: TableSort | null;
  defaultSort?: TableSort | null;
  onSortChange?: (sort: TableSort | null) => void;
  /** Строки уже отсортированы снаружи (сервер) — таблица сама не сортирует */
  manualSort?: boolean;
  onRowClick?: (row: T) => void;
  /**
   * Строка ведёт на страницу (карточка записи, клиента…). Лучше, чем router.push в onRowClick: страница загружается
   * при наведении и открывается сразу, полоска загрузки — с нажатия. onRowClick, если есть, вызывается перед переходом.
   */
  rowHref?: (row: T) => string;
  loading?: boolean;
  /**
   * Сколько строк-скелетонов, если таблица ещё ни разу не показывалась (дальше — сколько было в прошлый раз, но не
   * больше страницы). Ставьте типичное число строк этого списка.
   */
  loadingRows?: number;
  /** Имя таблицы на экране для памяти числа строк и ширин колонок (по умолчанию — id колонок) */
  skeletonId?: string;
  /** Скелетон своей карточки на телефоне (к mobileCard) — в той же разметке, что карточка */
  mobileCardSkeleton?: ReactNode;
  /** Что показать, если строк нет */
  empty?: ReactNode;
  /** Своя карточка строки на телефоне (вместо сборки по mobile-ролям) */
  mobileCard?: (row: T) => ReactNode;
  stickyHeader?: boolean;
  /** Подпись таблицы для скринридера */
  label?: string;
  className?: string;
  classNames?: { table?: string; row?: string; cards?: string; card?: string };
  /** Класс конкретной строки/карточки — например, строка плавно уходит после решения (только transform/opacity) */
  rowClassName?: (row: T) => string | undefined;
  /**
   * Постраничный вывод внутри таблицы: строк больше 10 — показываются страницами, внизу «1–10 из N» и выбор
   * 10/20/50/100 (как в «Записях»). По умолчанию включён; выключен при manualSort — там страницы отдаёт сервер и экран
   * ставит свою <Pagination>. false — таблица всегда целиком (короткий фиксированный список).
   */
  pagination?: boolean;
}

const ALIGN: Record<TableAlign, string> = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
};

const JUSTIFY: Record<TableAlign, string> = {
  left: 'justify-start',
  right: 'justify-end',
  center: 'justify-center',
};

function compare(a: string | number, b: string | number): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'ru', { numeric: true, sensitivity: 'base' });
}

/**
 * Ширина полосы-скелетона по умолчанию. У колонки с заданной шириной — доля ячейки (в % полоса не распирает колонку:
 * узкая «Визиты» 5.5rem осталась бы шире в скелетоне, чем с числом); без ширины — в знаках. Разные длины по строкам —
 * чтобы строки не выглядели одинаковыми полосами.
 */
const DEFAULT_WIDTHS_PCT = ['70%', '55%', '80%', '45%', '65%'];
const DEFAULT_WIDTHS_CH = ['12ch', '9ch', '14ch', '7ch', '11ch'];

function skeletonWidthOf<T>(col: TableColumn<T>, i: number, ci: number): string {
  if (col.skeletonWidth) return col.skeletonWidth;
  const pick = (i + ci) % DEFAULT_WIDTHS_PCT.length;
  return col.width ? DEFAULT_WIDTHS_PCT[pick] : DEFAULT_WIDTHS_CH[pick];
}

/** Карточка строки на телефоне — одна и та же у данных и у скелетона */
const CARD = 'flex items-start gap-2 rounded-xl border border-border bg-surface p-4 shadow-xs';

function cellClass<T>(col: TableColumn<T>, ci: number, stickFirst: boolean): string {
  return cn(
    'h-13 px-4 py-2.5 align-middle',
    ALIGN[col.align ?? 'left'],
    // Числа справа — одинаковой ширины, столбец читается ровно
    col.align === 'right' && 'tabular-nums',
    // Первая колонка — «кто/что»: чуть жирнее и не ломается на слова при узкой таблице
    ci === 0 && 'font-medium text-fg',
    ci === 0 && !col.width && 'min-w-44',
    ci === 0 &&
      stickFirst &&
      'sticky left-0 z-[1] bg-surface shadow-[6px_0_8px_-6px_var(--overlay)] group-hover/row:bg-surface-2',
    col.className,
  );
}

/** Место галочки в строке-скелетоне: та же коробка, что у Checkbox без подписи (44×44, квадрат по центру), без поля ввода */
function CheckboxPlaceholder({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn('inline-flex min-h-11 min-w-11 items-center justify-center', className)}>
      <span className="relative mt-0.5 inline-flex size-5 shrink-0 rounded-[6px] border-2 border-border-strong bg-surface" />
    </span>
  );
}

/**
 * Таблица: сортировка по заголовку, выбор строк, постраничный вывод, скелетоны, пустое состояние.
 * На телефоне (<768px) строки превращаются в карточки.
 */
export function Table<T>({
  columns,
  rows,
  rowKey,
  selectable = false,
  selected: selectedProp,
  defaultSelected = [],
  onSelectedChange,
  sort: sortProp,
  defaultSort = null,
  onSortChange,
  manualSort = false,
  onRowClick: onRowClickProp,
  rowHref,
  loading = false,
  loadingRows = 5,
  skeletonId,
  empty,
  mobileCard,
  mobileCardSkeleton,
  stickyHeader = false,
  label,
  className,
  classNames,
  rowClassName,
  pagination = !manualSort,
}: TableProps<T>) {
  const t = useT('ui');
  const [selected, setSelected] = useControllableState(selectedProp, defaultSelected, onSelectedChange);
  const [sort, setSort] = useControllableState<TableSort | null>(
    sortProp,
    defaultSort,
    onSortChange,
    sortProp !== undefined,
  );

  const sortValueOf = (col: TableColumn<T>, row: T): string | number => {
    if (col.sortValue) return col.sortValue(row);
    const v = col.cell(row);
    return typeof v === 'string' || typeof v === 'number' ? v : '';
  };

  const sortedRows = (() => {
    if (manualSort || !sort) return rows;
    const col = columns.find((c) => c.id === sort.columnId);
    if (!col) return rows;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => compare(sortValueOf(col, a), sortValueOf(col, b)) * dir);
  })();

  // Страница. Сменилась сортировка или строки поменялись больше чем на одну (фильтр, поиск) — снова первая; добавили или
  // удалили одну строку — страница та же (подстройка во время рендера)
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const sortKey = `${sort?.columnId ?? ''}|${sort?.dir ?? ''}`;
  const [seenPage, setSeenPage] = useState({ count: rows.length, sortKey });
  if (seenPage.count !== rows.length || seenPage.sortKey !== sortKey) {
    const small = seenPage.sortKey === sortKey && Math.abs(seenPage.count - rows.length) === 1;
    setSeenPage({ count: rows.length, sortKey });
    if (!small) setPage(1);
  }
  const paged = pagination && !loading && sortedRows.length > DEFAULT_PAGE_SIZE;
  const pageCount = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleRows = paged ? sortedRows.slice((currentPage - 1) * pageSize, currentPage * pageSize) : sortedRows;

  const toggleSort = (col: TableColumn<T>) => {
    if (!sort || sort.columnId !== col.id) setSort({ columnId: col.id, dir: 'asc' });
    else if (sort.dir === 'asc') setSort({ columnId: col.id, dir: 'desc' });
    else setSort(null);
  };

  // «Выбрать всё» — строки текущей страницы (как в почте), а не спрятанные на других страницах
  const ids = visibleRows.map(rowKey);
  const selectedSet = new Set(selected);
  const allSelected = ids.length > 0 && ids.every((id) => selectedSet.has(id));
  const someSelected = !allSelected && ids.some((id) => selectedSet.has(id));
  const toggleRow = (id: string, on: boolean) =>
    setSelected(on ? [...selected.filter((x) => x !== id), id] : selected.filter((x) => x !== id));
  const toggleAll = (on: boolean) =>
    setSelected(on ? Array.from(new Set([...selected, ...ids])) : selected.filter((x) => !ids.includes(x)));

  const nav = useNavigate();
  const onRowClick =
    rowHref || onRowClickProp
      ? (row: T) => {
          onRowClickProp?.(row);
          if (rowHref) nav.go(rowHref(row));
        }
      : undefined;
  const prefetchRow = rowHref ? (row: T) => nav.prefetch(rowHref(row)) : undefined;

  const rowKeyDown = (event: KeyboardEvent, row: T) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onRowClick?.(row);
    }
  };

  // Широкая таблица: тень у края, который прокручивается, и первая колонка («кто/что») держится слева
  const scrollRef = useRef<HTMLDivElement>(null);
  const edges = useScrollEdges(scrollRef);
  const stickFirst = !selectable && edges.start;
  const isEmpty = !loading && sortedRows.length === 0;

  // Скелетон = таблица в прошлый раз: столько же строк (не больше страницы) и те же ширины колонок
  const memoryId = skeletonId ?? columns.map((c) => c.id).join(',');
  const skeletonRows = useSkeletonCount(memoryId, {
    loading,
    count: loading ? undefined : visibleRows.length,
    fallback: loadingRows,
    max: pagination ? DEFAULT_PAGE_SIZE : undefined,
  });
  const headRowRef = useRef<HTMLTableRowElement>(null);
  const [widths, saveWidths] = useRememberedLayout<number[]>(`${memoryId}|w`);
  useEffect(() => {
    const row = headRowRef.current;
    if (loading || !row || visibleRows.length === 0 || !row.getClientRects().length) return;
    saveWidths([...row.children].map((th) => Math.round(th.getBoundingClientRect().width)));
  });
  const skeletonWidths = loading && widths?.length === columns.length + (selectable ? 1 : 0) ? widths : undefined;
  const colOffset = selectable ? 1 : 0;
  // Строка страниц под таблицей: при загрузке — на своём месте, если скелетон занимает полную страницу (значит, в
  // прошлый раз строк было больше страницы или так задано), с числом строк прошлого раза
  const [lastTotal, saveTotal] = useRememberedLayout<number>(`${memoryId}|total`);
  useEffect(() => {
    if (!loading) saveTotal(sortedRows.length);
  });
  const pagerWhileLoading = loading && pagination && skeletonRows >= DEFAULT_PAGE_SIZE;
  // В прошлый раз список был пуст — при загрузке показываем то же пустое состояние, а не строки из ниоткуда
  const showEmpty = isEmpty || (loading && skeletonRows === 0);
  const emptyNode = empty ?? <EmptyState compact title={t('table.empty')} className="py-10" />;

  return (
    <div className={cn('w-full', className)} aria-busy={loading || undefined}>
      {/* Десктоп: таблица. Пусто — только пустое состояние, без шапки, стрелок сортировки и «выбрать всё» над пустотой */}
      {showEmpty ? (
        <div className="hidden rounded-xl border border-border bg-surface shadow-xs md:block">{emptyNode}</div>
      ) : (
        <div className="relative hidden md:block">
          <div
            ref={scrollRef}
            className="relative overflow-x-auto rounded-xl border border-border bg-surface shadow-xs scrollbar-thin"
          >
            <table
              aria-label={label}
              className={cn('row-links w-full border-collapse text-left text-[0.9375rem]', classNames?.table)}
            >
              <thead
                className={cn(
                  'bg-surface-2/70 text-[13px] text-muted',
                  stickyHeader && 'sticky top-0 z-10 bg-surface-2',
                )}
              >
                <tr ref={headRowRef}>
                  {selectable && (
                    <th scope="col" className="w-12 px-2 py-1">
                      <Checkbox
                        aria-label={t('table.selectAll')}
                        checked={allSelected}
                        indeterminate={someSelected}
                        disabled={loading || ids.length === 0}
                        onCheckedChange={toggleAll}
                      />
                    </th>
                  )}
                  {columns.map((col, ci) => {
                    const active = sort?.columnId === col.id ? sort.dir : null;
                    return (
                      <th
                        key={col.id}
                        scope="col"
                        // Заданная ширина — и наименьшая: колонка не сжимается под полосу-скелетон, чтобы потом не
                        // растянуться под текст (таблица со скелетоном и с данными одной ширины)
                        style={
                          col.width
                            ? { width: col.width, minWidth: col.width }
                            : skeletonWidths
                              ? { width: skeletonWidths[ci + colOffset] }
                              : undefined
                        }
                        aria-sort={active === 'asc' ? 'ascending' : active === 'desc' ? 'descending' : undefined}
                        className={cn(
                          'h-11 px-4 py-2 font-semibold whitespace-nowrap',
                          ALIGN[col.align ?? 'left'],
                          ci === 0 &&
                            stickFirst &&
                            'sticky left-0 z-[1] bg-surface-2 shadow-[6px_0_8px_-6px_var(--overlay)]',
                        )}
                      >
                        {col.sortable ? (
                          <button
                            type="button"
                            onClick={() => toggleSort(col)}
                            className={cn(
                              '-mx-2 inline-flex min-h-10 items-center gap-1.5 rounded-md px-2 hover:bg-surface-3 hover:text-fg',
                              active && 'text-fg',
                              JUSTIFY[col.align ?? 'left'],
                            )}
                            aria-label={typeof col.header === 'string' ? `${col.header}, ${active === 'asc' ? t('table.sortDesc') : t('table.sortAsc')}` : undefined}
                          >
                            {col.header}
                            {active === 'asc' ? (
                              <ArrowUp className="size-4" aria-hidden />
                            ) : active === 'desc' ? (
                              <ArrowDown className="size-4" aria-hidden />
                            ) : (
                              <ArrowUpDown className="size-4 opacity-60" aria-hidden />
                            )}
                          </button>
                        ) : (
                          col.header
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              {/* Скелетон → данные: та же строка сразу с содержимым, без проявления — любое проявление мигает */}
              <tbody>
                {loading
                  ? Array.from({ length: skeletonRows }, (_, i) => (
                      // Та же строка, что с данными: те же ячейки, отступы и высота — меняется только содержимое
                      <tr key={`sk-${i}`} className={cn('border-t border-border', classNames?.row)}>
                        {selectable && (
                          <td className="px-2 py-1">
                            <CheckboxPlaceholder />
                          </td>
                        )}
                        {columns.map((col, ci) => (
                          <td key={col.id} className={cellClass(col, ci, false)}>
                            {col.skeleton ?? <SkeletonText width={skeletonWidthOf(col, i, ci)} />}
                          </td>
                        ))}
                      </tr>
                    ))
                  : visibleRows.map((row) => {
                      const id = rowKey(row);
                      const isSelected = selectedSet.has(id);
                      return (
                        <tr
                          key={id}
                          aria-selected={selectable ? isSelected : undefined}
                          tabIndex={onRowClick ? 0 : undefined}
                          onClick={onRowClick ? () => onRowClick(row) : undefined}
                          onPointerEnter={prefetchRow ? () => prefetchRow(row) : undefined}
                          onKeyDown={onRowClick ? (e) => rowKeyDown(e, row) : undefined}
                          className={cn(
                            'group/row border-t border-border transition-colors',
                            'hover:bg-surface-2/50',
                            onRowClick &&
                              'cursor-pointer hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus active:bg-surface-3',
                            isSelected && 'bg-primary-soft hover:bg-primary-soft',
                            classNames?.row,
                            rowClassName?.(row),
                          )}
                        >
                          {selectable && (
                            <td className="px-2 py-1" onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                aria-label={t('table.selectRow')}
                                checked={isSelected}
                                onCheckedChange={(on) => toggleRow(id, on)}
                              />
                            </td>
                          )}
                          {columns.map((col, ci) => (
                            <td key={col.id} className={cellClass(col, ci, stickFirst)}>
                              {col.cell(row)}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
              </tbody>
            </table>
          </div>
          {edges.end && (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-px right-px w-8 rounded-r-xl bg-linear-to-l from-overlay/25 to-transparent"
            />
          )}
        </div>
      )}

      {/* Телефон: карточки */}
      <ul
        className={cn('row-links flex flex-col gap-2 md:hidden', classNames?.cards)}
        aria-label={label}
      >
        {loading && skeletonRows > 0 ? (
          Array.from({ length: skeletonRows }, (_, i) => (
            // Та же карточка, что с данными (рамка, отступы, галочка, стрелка) — внутри скелетон тех же ролей
            <li key={`sk-${i}`} aria-hidden className={cn(CARD, classNames?.card)}>
              {selectable && <CheckboxPlaceholder className="-my-2 -ml-2" />}
              <div className={cn('min-w-0 flex-1', onRowClick && 'flex items-center gap-2')}>
                <div className="min-w-0 flex-1">
                  {mobileCardSkeleton ?? <TableCardBody columns={columns} skeleton />}
                </div>
                {onRowClick && <ChevronRight aria-hidden className="size-5 shrink-0 text-muted" />}
              </div>
            </li>
          ))
        ) : showEmpty ? (
          <li className="rounded-xl border border-border bg-surface">{emptyNode}</li>
        ) : (
          visibleRows.map((row) => {
            const id = rowKey(row);
            const isSelected = selectedSet.has(id);
            const content = mobileCard ? mobileCard(row) : <TableCardBody columns={columns} row={row} />;
            return (
              <li
                key={id}
                className={cn(
                  CARD,
                  'transition-[background-color,border-color,transform] duration-150',
                  onRowClick && 'active:scale-[0.99] active:bg-surface-2',
                  isSelected && 'border-primary bg-primary-soft',
                  classNames?.card,
                  rowClassName?.(row),
                )}
              >
                {selectable && (
                  <Checkbox
                    aria-label={t('table.selectRow')}
                    checked={isSelected}
                    onCheckedChange={(on) => toggleRow(id, on)}
                    className="-my-2 -ml-2"
                  />
                )}
                {onRowClick ? (
                  <button
                    type="button"
                    onClick={() => onRowClick(row)}
                    onPointerDown={prefetchRow ? () => prefetchRow(row) : undefined}
                    className="-m-1 flex min-w-0 flex-1 items-center gap-2 rounded-lg p-1 text-left"
                  >
                    <div className="min-w-0 flex-1">{content}</div>
                    <ChevronRight aria-hidden className="size-5 shrink-0 text-muted" />
                  </button>
                ) : (
                  <div className="min-w-0 flex-1">{content}</div>
                )}
              </li>
            );
          })
        )}
      </ul>

      {pagerWhileLoading && (
        <Pagination
          loading
          page={1}
          pageSize={pageSize}
          total={lastTotal ?? 0}
          onPageChange={setPage}
          onPageSizeChange={() => undefined}
          className="mt-4"
        />
      )}
      {paged && (
        <Pagination
          page={currentPage}
          pageSize={pageSize}
          total={sortedRows.length}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
          className="mt-4"
        />
      )}
    </div>
  );
}
