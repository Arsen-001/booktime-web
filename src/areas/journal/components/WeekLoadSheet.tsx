'use client';

/**
 * «Загрузка недели» (⭐ наше, 29.09.2026): тепловая карта «мастер × день» на 7 дней от выбранной в журнале даты.
 * Клетка — доля рабочих минут, занятых активными записями (те же правила, что полоска загрузки в шапке колонки),
 * цвет — насыщенность акцента по ступеням; выходной — серый. Справа итог мастера за неделю, внизу — итог дня.
 * Наведение (десктоп) — подсказка со свободными часами; касание (телефон) — строка деталей внизу и «Открыть день».
 * Клик по клетке — журнал переходит на этот день и оставляет в сетке только этого мастера; по дню в шапке —
 * этот день у всех мастеров. Данные — одним запросом на 7 дней (сотрудники, график, записи), пока идут — скелетон
 * той же формы.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { CalendarDays, Flame } from 'lucide-react';
import { coreList, listBookings } from '@/api/core';
import { getStaffHoursRange } from '@/api/journal';
import { useApiQuery } from '@/api/request';
import type { ISODate, Id, Staff } from '@/domain/core';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { addDays, combine, eachDay, fromMinutes, today, weekdayIndex } from '@/lib/date';
import { buildWeekLoad, loadLevel, type WeekLoadCell, type WeekLoadTotal } from '@/areas/journal/lib/weekLoad';
import { useJournalHourFormat } from '@/areas/journal/lib/useJournalHourFormat';
import { Avatar } from '@/ui/Avatar';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { Modal } from '@/ui/Modal';
import { Skeleton } from '@/ui/Skeleton';
import { Tooltip } from '@/ui/Tooltip';
import { useIsMobile } from '@/ui/hooks/useMediaQuery';

export interface WeekLoadSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Первый день недели — выбранная в журнале дата */
  from: ISODate;
  /** Мастера, которых человек видит в журнале (права уже учтены) */
  staffIds: Id[];
  /** Перейти в журнале на день; staffId — оставить в сетке только этого мастера */
  onPick: (date: ISODate, staffId?: Id) => void;
}

/** Ступени тепловой карты: насыщенность акцента растёт с загрузкой; на двух верхних — светлый текст на тёмном */
const LEVEL: Record<0 | 1 | 2 | 3 | 4 | 5, string> = {
  0: 'bg-surface text-muted ring-1 ring-inset ring-border',
  1: 'bg-primary/10 text-fg',
  2: 'bg-primary/25 text-fg',
  3: 'bg-primary/45 text-fg',
  4: 'bg-primary/75 text-primary-contrast',
  5: 'bg-primary text-primary-contrast',
};
const OFF = 'bg-surface-2 text-muted';

const pct = (ratio: number) => Math.round(ratio * 100);

export function WeekLoadSheet({ open, onOpenChange, from, staffIds, onPick }: WeekLoadSheetProps) {
  const t = useT('journal');
  const hourCycle = useJournalHourFormat();
  const format = useFormat({ hourCycle });
  const isMobile = useIsMobile();
  const days = useMemo(() => eachDay(from, addDays(from, 6)), [from]);
  const to = days[days.length - 1];
  // Телефон: касание выбирает клетку (подсказок по наведению там нет), переход — кнопкой «Открыть день»
  const [picked, setPicked] = useState<{ staffId: Id; date: ISODate } | null>(null);

  // Одна загрузка на неделю: сотрудники → (график на 7 дней ‖ записи на 7 дней), без запроса на каждый день
  const query = useApiQuery(
    ['journal', 'week-load', staffIds.join(','), from],
    async () => {
      const ids = new Set(staffIds);
      const staff = await coreList('staff', (s) => ids.has(s.id));
      const businessIds = [...new Set(staff.map((s) => s.businessId))];
      const [hours, bookings] = await Promise.all([
        getStaffHoursRange(staffIds, from, to),
        listBookings({ businessIds, from, to }),
      ]);
      return { staff, hours, bookings: bookings.filter((b) => ids.has(b.staffId)) };
    },
    { enabled: open && staffIds.length > 0 },
  );

  const data = query.data;
  const model = useMemo(() => {
    if (!data) return null;
    const byId = new Map(data.staff.map((s) => [s.id, s]));
    // Порядок — как колонки журнала; мастера без графика на всю неделю не занимают строку
    const order = staffIds.filter((id) => byId.has(id));
    const built = buildWeekLoad(order, days, data.hours, data.bookings);
    const rows = built.rows.filter((r) => r.workMin > 0 || r.cells.some((c) => c.count > 0));
    return { ...built, rows, staffById: byId };
  }, [data, staffIds, days]);

  const weekdays = format.weekdaysShort();
  const todayDate = today();
  const freeText = (cell: WeekLoadCell) =>
    cell.gaps.length
      ? t('weekLoad.free', {
          ranges: cell.gaps
            .map((g) => `${format.time(combine(cell.date, fromMinutes(g.from)))}–${format.time(combine(cell.date, fromMinutes(g.to)))}`)
            .join(', '),
        })
      : t('weekLoad.noFree');
  const cellSummary = (cell: WeekLoadCell) =>
    cell.off
      ? cell.count > 0
        ? t('weekLoad.offWithBookings', { n: cell.count })
        : t('weekLoad.dayOff')
      : t('weekLoad.booked', { booked: format.duration(cell.bookedMin), work: format.duration(cell.workMin), n: cell.count });

  const pick = (date: ISODate, staffId?: Id) => {
    onOpenChange(false);
    onPick(date, staffId);
  };

  const pickedStaff = picked ? model?.staffById.get(picked.staffId) : undefined;
  const pickedCell = picked ? model?.rows.find((r) => r.staffId === picked.staffId)?.cells.find((c) => c.date === picked.date) : undefined;

  const description = t('weekLoad.description', {
    from: format.date(from, 'weekday'),
    to: format.date(to, 'weekday'),
  });

  const footer = model?.rows.length ? (
    isMobile ? (
      <div className="flex w-full flex-col gap-3" aria-live="polite">
        {picked && pickedStaff && pickedCell ? (
          <>
            <div className="flex min-w-0 items-center gap-3">
              <Avatar name={pickedStaff.name} src={pickedStaff.avatarUrl} colorIndex={pickedStaff.colorIndex} size="sm" />
              <div className="min-w-0 flex-1 text-sm">
                <p className="truncate font-semibold text-fg">
                  {pickedStaff.name} · {format.date(pickedCell.date, 'weekday')}
                </p>
                <p className="text-muted">
                  {pickedCell.off ? cellSummary(pickedCell) : `${pct(pickedCell.ratio)}% · ${cellSummary(pickedCell)}`}
                </p>
                {!pickedCell.off && <p className="text-fg">{freeText(pickedCell)}</p>}
              </div>
            </div>
            <Button className="w-full" leftIcon={<CalendarDays aria-hidden />} onClick={() => pick(pickedCell.date, pickedStaff.id)}>
              {t('weekLoad.openDay')}
            </Button>
          </>
        ) : (
          <p className="text-sm text-muted">{t('weekLoad.hintMobile')}</p>
        )}
      </div>
    ) : (
      <div className="flex w-full flex-wrap items-center justify-between gap-x-6 gap-y-2 text-sm text-muted">
        <Legend />
        <span>{t('weekLoad.hint')}</span>
      </div>
    )
  ) : undefined;

  return (
    <Modal
      open={open}
      onOpenChange={(v) => {
        if (!v) setPicked(null);
        onOpenChange(v);
      }}
      title={t('weekLoad.title')}
      description={description}
      size="xl"
      footer={footer}
    >
      <div aria-busy={query.isLoading || undefined}>
        {query.isError ? (
          <ErrorState onRetry={query.refetch} />
        ) : !model ? (
          <WeekLoadSkeleton rows={Math.min(Math.max(staffIds.length, 3), 12)} />
        ) : model.rows.length === 0 ? (
          <EmptyState icon={<CalendarDays />} title={t('weekLoad.emptyTitle')} description={t('weekLoad.emptyText')} />
        ) : (
          // Телефон: таблица шире экрана — листается вбок, имена мастеров прилипают слева
          <div className="-mx-5 overflow-x-auto pr-5 sm:mx-0 sm:pr-0">
            <table className="w-full min-w-[34rem] border-separate border-spacing-x-0 border-spacing-y-1 text-sm tabular-nums">
              <thead>
                <tr>
                  <th scope="col" className="sticky left-0 z-10 w-28 bg-surface pb-1 pl-5 text-left sm:pl-0 text-xs font-medium text-muted sm:w-44">
                    {t('weekLoad.master')}
                  </th>
                  {days.map((d) => (
                    <th key={d} scope="col" className="px-0.5 pb-1 font-normal">
                      <button
                        type="button"
                        onClick={() => pick(d)}
                        aria-label={t('weekLoad.openDayAll', { date: format.date(d, 'weekdayLong') })}
                        className={cn(
                          'flex w-full flex-col items-center rounded-lg py-1 leading-tight transition-colors hover:bg-surface-2',
                          d === todayDate && 'text-primary-text',
                        )}
                      >
                        <span className="text-xs text-muted capitalize">{weekdays[weekdayIndex(d)]}</span>
                        <span className={cn('text-base font-semibold', d === todayDate ? 'text-primary-text' : 'text-fg')}>
                          {Number(d.slice(8, 10))}
                        </span>
                      </button>
                    </th>
                  ))}
                  <th scope="col" className="w-16 pb-1 pl-2 text-right text-xs font-medium text-muted">
                    {t('weekLoad.week')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {model.rows.map((row) => {
                  const s = model.staffById.get(row.staffId) as Staff;
                  return (
                    <tr key={row.staffId}>
                      <th scope="row" className="sticky left-0 z-10 bg-surface py-0 pr-1 pl-5 text-left font-normal sm:pl-0">
                        <span className="flex min-w-0 items-center gap-2">
                          <Avatar name={s.name} src={s.avatarUrl} colorIndex={s.colorIndex} size="xs" className="max-sm:hidden" />
                          <span className="truncate text-fg max-sm:max-w-24 sm:max-w-32">{s.name}</span>
                        </span>
                      </th>
                      {row.cells.map((cell) => {
                        const selected = picked?.staffId === row.staffId && picked.date === cell.date;
                        const label = `${s.name}, ${format.date(cell.date, 'weekday')}: ${
                          cell.off ? cellSummary(cell) : `${pct(cell.ratio)}%, ${cellSummary(cell)}. ${freeText(cell)}`
                        }`;
                        return (
                          <td key={cell.date} className="px-0.5 py-0">
                            <Tooltip
                              disabled={isMobile}
                              classNames={{ anchor: 'flex w-full' }}
                              content={<CellTip title={`${s.name} · ${format.date(cell.date, 'weekday')}`} lines={cell.off ? [cellSummary(cell)] : [`${pct(cell.ratio)}% · ${cellSummary(cell)}`, freeText(cell)]} />}
                            >
                              <button
                                type="button"
                                data-week-cell=""
                                data-date={cell.date}
                                data-off={cell.off ? '1' : '0'}
                                aria-label={label}
                                aria-pressed={isMobile ? selected : undefined}
                                onClick={() => (isMobile ? setPicked({ staffId: row.staffId, date: cell.date }) : pick(cell.date, row.staffId))}
                                className={cn(
                                  'relative flex h-10 w-full min-w-12 sm:h-8 items-center justify-center rounded-md text-sm font-semibold transition-[box-shadow,transform] outline-none',
                                  'hover:ring-2 hover:ring-primary hover:ring-inset focus-visible:ring-2 focus-visible:ring-focus',
                                  cell.off ? OFF : LEVEL[loadLevel(cell.ratio)],
                                  selected && 'ring-2 ring-fg ring-inset',
                                )}
                              >
                                {cell.off ? (
                                  <span className="text-xs font-normal">{t('weekLoad.dayOffShort')}</span>
                                ) : (
                                  `${pct(cell.ratio)}%`
                                )}
                                {cell.off && cell.count > 0 && (
                                  <span aria-hidden className="absolute top-1 right-1 size-1.5 rounded-full bg-warning" />
                                )}
                              </button>
                            </Tooltip>
                          </td>
                        );
                      })}
                      <td className="p-0 pl-2 text-right">
                        <TotalCell total={row} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row" className="sticky left-0 z-10 bg-surface pt-2 pr-1 pb-0 pl-5 text-left sm:pl-0 text-xs font-medium text-muted">
                    {t('weekLoad.allMasters')}
                  </th>
                  {model.days.map((d, i) => (
                    <td key={days[i]} className="px-0.5 pt-2 pb-0 text-center">
                      <TotalCell total={d} center />
                    </td>
                  ))}
                  <td className="p-0 pt-2 pl-2 text-right">
                    <TotalCell total={model.total} strong />
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
}

/** Итог строки/столбца: процент и тонкая полоска загрузки под ним */
function TotalCell({ total, center, strong }: { total: WeekLoadTotal; center?: boolean; strong?: boolean }) {
  if (total.workMin === 0) return <span className="text-muted">—</span>;
  const p = pct(total.ratio);
  return (
    <span className={cn('inline-flex w-full flex-col gap-1', center ? 'items-center' : 'items-end')}>
      <span className={cn('text-sm', strong ? 'font-bold text-fg' : 'font-semibold text-fg')}>{p}%</span>
      <span aria-hidden className="h-1 w-10 overflow-hidden rounded-full bg-surface-3">
        <span className="block h-full rounded-full bg-primary" style={{ width: `${p}%` }} />
      </span>
    </span>
  );
}

function CellTip({ title, lines }: { title: string; lines: ReactNode[] }) {
  return (
    <span className="flex max-w-64 flex-col gap-0.5 text-left">
      <span className="font-semibold">{title}</span>
      {lines.map((l, i) => (
        <span key={i}>{l}</span>
      ))}
    </span>
  );
}

/** Легенда: пусто → занято, отдельно — выходной */
function Legend() {
  const t = useT('journal');
  return (
    <span className="flex items-center gap-2 text-xs">
      <Flame aria-hidden className="size-4 text-muted" />
      <span>0%</span>
      <span className="flex gap-0.5" aria-hidden>
        {([0, 1, 2, 3, 4, 5] as const).map((l) => (
          <span key={l} className={cn('size-4 rounded-sm', LEVEL[l])} />
        ))}
      </span>
      <span>100%</span>
      <span aria-hidden className={cn('ml-2 size-4 rounded-sm', OFF)} />
      <span>{t('weekLoad.dayOff')}</span>
    </span>
  );
}

function WeekLoadSkeleton({ rows }: { rows: number }) {
  return (
    <div className="flex flex-col gap-1" aria-hidden>
      <div className="flex gap-1">
        <Skeleton className="h-9 w-28 sm:w-44" />
        {Array.from({ length: 7 }, (_, i) => (
          <Skeleton key={i} className="h-9 flex-1" />
        ))}
        <Skeleton className="h-9 w-16" />
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex gap-1">
          <Skeleton className="h-10 w-28 sm:h-8 sm:w-44" />
          {Array.from({ length: 7 }, (_, i) => (
            <Skeleton key={i} className="h-10 flex-1 sm:h-8" />
          ))}
          <Skeleton className="h-10 w-16 sm:h-8" />
        </div>
      ))}
    </div>
  );
}
