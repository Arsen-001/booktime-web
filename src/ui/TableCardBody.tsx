import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Skeleton, SkeletonText } from '@/ui/Skeleton';
import type { TableColumn, TableMobileRole } from '@/ui/Table';

/** С какого числа полей «подпись — значение» карточка раскладывает их в две колонки */
const GRID_FROM = 4;

/** Роль колонки на телефоне: по умолчанию первая — title, остальные — meta */
export function mobileRoleOf<T>(col: TableColumn<T>, index: number): TableMobileRole {
  return col.mobile ?? (index === 0 ? 'title' : 'meta');
}

type TableCardBodyProps<T> =
  | { columns: TableColumn<T>[]; row: T; skeleton?: false }
  /** Скелетон карточки: та же разметка по ролям, в каждой ячейке — col.skeleton или полоса текста */
  | { columns: TableColumn<T>[]; row?: undefined; skeleton: true };

const MOBILE_WIDTHS: Partial<Record<TableMobileRole, string>> = { title: '16ch', subtitle: '20ch', aside: '7ch', badge: '8ch' };

/**
 * Карточка строки таблицы на телефоне, собранная по ролям колонок:
 *   media (картинка 56×56 слева) · title + badge (статус справа в той же строке) · subtitle + aside (время/сумма справа) ·
 *   meta (строки «подпись — значение»).
 */
export function TableCardBody<T>({ columns, row, skeleton }: TableCardBodyProps<T>) {
  const skeletonOf = (col: TableColumn<T>, role: TableMobileRole): ReactNode =>
    col.skeleton ??
    (role === 'media' ? (
      <Skeleton variant="rect" className="size-14" />
    ) : (
      <SkeletonText width={MOBILE_WIDTHS[role] ?? col.skeletonWidth ?? '10ch'} />
    ));
  const pick = (role: TableMobileRole): { id: string; header: ReactNode; node: ReactNode }[] =>
    columns
      .map((col, i) => ({ col, i }))
      .filter(({ col, i }) => mobileRoleOf(col, i) === role)
      .map(({ col }) => ({ id: col.id, header: col.header, node: skeleton ? skeletonOf(col, role) : col.cell(row as T) }));

  const media = pick('media');
  const titles = pick('title');
  const badges = pick('badge');
  const subtitles = pick('subtitle');
  const asides = pick('aside');
  const metas = pick('meta');

  return (
    <div className="flex min-w-0 gap-3">
      {media.length > 0 && (
        <div className="shrink-0 [&>img]:size-14 [&>img]:rounded-lg [&>img]:object-cover">
          {media[0].node}
        </div>
      )}
      <div className="min-w-0 flex-1">
        {(titles.length > 0 || badges.length > 0) && (
          <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
            <div className="min-w-[8rem] flex-1 text-base leading-snug font-semibold text-fg">
              {titles.map((c) => (
                <div key={c.id}>{c.node}</div>
              ))}
            </div>
            {badges.length > 0 && (
              <div className="flex shrink-0 flex-wrap justify-end gap-1">
                {badges.map((c) => (
                  <span key={c.id}>{c.node}</span>
                ))}
              </div>
            )}
          </div>
        )}
        {(subtitles.length > 0 || asides.length > 0) && (
          <div className="mt-0.5 flex items-baseline justify-between gap-3">
            <div className="min-w-0 flex-1 text-sm text-muted">
              {subtitles.map((c) => (
                <div key={c.id}>{c.node}</div>
              ))}
            </div>
            {asides.length > 0 && (
              <div className="shrink-0 text-right text-sm font-semibold text-fg tabular-nums">
                {asides.map((c) => (
                  <div key={c.id}>{c.node}</div>
                ))}
              </div>
            )}
          </div>
        )}
        {metas.length > 0 && (
          <dl
            className={cn(
              'text-sm',
              titles.length + subtitles.length + badges.length + asides.length > 0 &&
                'mt-2.5 border-t border-border/60 pt-2.5',
              // Много полей — две колонки «подпись над значением»: карточка вдвое короче, список читается быстрее
              metas.length >= GRID_FROM
                ? 'grid grid-cols-2 gap-x-4 gap-y-2.5'
                : 'grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5',
            )}
          >
            {metas.map((c) =>
              // Колонка без заголовка (статус, метки) — значением во всю строку, а не с пустой подписью слева
              c.header === '' || c.header === null || c.header === undefined ? (
                <dd key={c.id} className="col-span-2 min-w-0 text-fg">
                  {c.node}
                </dd>
              ) : metas.length >= GRID_FROM ? (
                <div key={c.id} className="flex min-w-0 flex-col gap-0.5">
                  <dt className="leading-snug break-words text-muted">{c.header}</dt>
                  <dd className="min-w-0 font-medium break-words text-fg tabular-nums">{c.node}</dd>
                </div>
              ) : (
                <div key={c.id} className="contents">
                  <dt className="text-muted">{c.header}</dt>
                  <dd className="min-w-0 text-right text-fg tabular-nums">{c.node}</dd>
                </div>
              ),
            )}
          </dl>
        )}
      </div>
    </div>
  );
}
