'use client';

/**
 * Карточка записи в сетке журнала — в стиле, который выбрал человек (lib/journalStyle):
 *  - «BookTime» — «C · Тон» (docs/design/DESIGN.md, Cards2.png колонка C): вся карточка — светлый тон оттенка лака
 *    (или цвета категории услуги), крупное время — тёмным тоном того же цвета, имя, «услуга · до HH:MM», белая
 *    пилюля «статус · лак», капля лака справа вверху, пунктир у «ждёт подтверждения»;
 *  - «Google Calendar» (owner 08.10.2026) — сплошная заливка цвета услуги с белым текстом, мелкий шрифт: имя,
 *    «11:00 – 12:00», услуга, статус; короткая — одной строкой «Имя, 11:00»; лак — точкой; ждёт подтверждения —
 *    белая с пунктиром цвета записи, отменённая и «не пришёл» — бледная и зачёркнутая.
 * Функции прежнего блока сохранены: F-01-026, F-01-027, F-01-214, F-01-031 (растягивание), F-01-032 (перерыв),
 * F-01-028/051/052 (метки, свои категории, ручной цвет — `BookingExtras`), F-01-110/111/114 (перенос), F-01-171,
 * F-16-022, F-16-127.
 *
 * Скорость (DESIGN.md → Performance): карточек на экране десятки, поэтому карточка «тонкая» — готовые строки приходят
 * из сетки (lib/cardText), своих запросов и переводов нет; поповер статуса и меню перерыва монтируются только при
 * первом наведении/нажатии; наведение и нажатие — чистый CSS (board.module.css); memo — перерисовка только своей.
 */
import { memo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { PackageCheck, PackagePlus } from 'lucide-react';
import type { Booking, Client, Id, Service } from '@/domain/core';
import type { BookingExtras } from '@/domain/journal';
import { cn } from '@/lib/cn';
import { cardSizes, type BookingToneInfo } from '@/areas/journal/lib/board';
import { renderedJournalStyle } from '@/areas/journal/lib/journalStyle';
import { shallowEqualDeep1, type CardLabels, type CardText } from '@/areas/journal/lib/cardText';
import { BookingHoverCard } from '@/areas/journal/components/BookingHoverCard';
import { TimeText } from '@/areas/journal/components/TimeText';
import styles from '@/areas/journal/board.module.css';
import { DropdownMenu } from '@/ui/DropdownMenu';
import { Popover } from '@/ui/Popover';

/** F-01-052: ручной цвет — полоса слева токеном chart-1..8 (тот же набор, что у цвета мастера). */
const MANUAL_COLOR_BORDER: Record<number, string> = {
  1: 'border-l-chart-1',
  2: 'border-l-chart-2',
  3: 'border-l-chart-3',
  4: 'border-l-chart-4',
  5: 'border-l-chart-5',
  6: 'border-l-chart-6',
  7: 'border-l-chart-7',
  8: 'border-l-chart-8',
};

/**
 * Единый масштаб карточки (owner 27.09.2026, DESIGN.md → «C · Тон»): время всегда 30px/800, имя всегда одного
 * размера под ним, паддинги и капля лака — тоже одни на все карточки. Разного размера карточка была раньше по
 * ВЫСОТЕ (см. lib/board.CARD_MIN_HEIGHT и lib/grid.pxPerMin) — не по шрифту.
 */
const TIME_SIZE = 'num-display';
const NAME_SIZE = 'mt-1 truncate pr-1 text-[13px] leading-tight font-semibold text-fg';
const CARD_PADDING = 'px-3 pt-2.5 pb-2';
/** Короткая карточка на телефоне: с этой высоты под именем помещается вторая строка (услуга), ниже — только имя */
const COMPACT_PHONE_TWO_LINES_FROM = 50;
const DROP_SIZE = 'size-[18px]';
const DROP_BUTTON =
  'absolute top-0 right-0 z-20 inline-flex size-10 items-start justify-end p-2.5 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus';

/** Стиль «Google Calendar» (owner 08.10.2026): мелкий текст события, белая точка вместо капли */
const G_NAME = 'truncate pr-3 text-xs leading-4 font-semibold';
const G_LINE = 'truncate text-xs leading-4';
const G_PADDING = 'px-2 py-1';
const G_DROP_SIZE = 'size-2.5';
const G_DROP_BUTTON =
  'absolute top-0 right-0 z-20 inline-flex size-10 items-start justify-end p-1.5 md:size-9 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus';
// DESIGN.md → Journal/мокап: технический перерыв — спокойная светлая заливка тем же тоном записи, БЕЗ пунктирной
// штриховки (пунктир в карточках означает только «ждёт подтверждения», F-01-078). Функция не меняется: перерыв
// по-прежнему блокирует запись и по-прежнему открывает своё меню/подсказку по наведению или тапу.
// Время уборки после услуги (F-01-032): как в макете A2 — на экране не рисуется (owner 27.09.2026 «делать как в макете»),
// но место занято и при наведении/фокусе проступает, чтобы его можно было изменить.
// Перерыв рисуется в масштабе времени (10 мин = 16 px), поэтому зона нажатия больше самой полосы: before — 40 px вниз
// от её верха, не заходя на карточку записи над ней (journal.md: 16–24 px было мало для пальца); разметка не сдвигается
const BREAK_CLASS =
  "relative mt-0.5 block w-full rounded-lg bg-transparent transition-colors before:absolute before:inset-x-0 before:top-0 before:h-10 before:content-[''] hover:bg-surface-2/70 focus-visible:bg-surface-2/70 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus";

export interface BookingBlockProps {
  booking: Booking;
  client?: Client;
  /** Для всплывающей карточки статуса (F-01-029) */
  services: Service[];
  /** Тон карточки: оттенок лака записи или цвет категории (lib/board.bookingTone) */
  tone: BookingToneInfo;
  /** Готовые строки карточки (lib/cardText) */
  text: CardText;
  labels: CardLabels;
  /** F-01-052: ручной цвет записи (свой срез) */
  extras?: BookingExtras;
  top: number;
  height: number;
  /**
   * Настоящая высота записи в px (durationMin × pxPerMin), ДО подстраховки минимальной высотой карточки:
   * `height` уже не бывает меньше lib/board.CARD_MIN_HEIGHT, а `naturalHeight` — для сравнения с ним. Когда
   * запись короче (редкие 15-минутные), карточка растянута до CARD_MIN_HEIGHT и заходит на соседнюю строку —
   * приподнимаем её z-index, чтобы она легла НА следующую запись, а не спряталась под ней (owner 27.09.2026:
   * «карточка со статусом "ожидает" не должна визуально наезжать на соседнюю» — это же правило одинаково
   * защищает и обычное растягивание коротких записей).
   */
  naturalHeight?: number;
  /** Технический перерыв под записью (F-01-032), минуты; 0 — нет */
  breakMin?: number;
  /** Перерыв по умолчанию (buffer услуги) — пункт «По умолчанию», если правка отличается */
  defaultBreakMin?: number;
  onBreakChange?: (bookingId: Id, minutes: number) => void;
  /** Пикселей на минуту сетки — растягивание (F-01-031) считает высоту в минуты */
  pxPerMin?: number;
  /** Шаг растягивания = масштаб сетки (F-01-015) */
  zoomStepMin?: number;
  canResize?: boolean;
  onResize?: (booking: Booking, newDurationMin: number) => void;
  /** F-01-110/F-01-111/F-01-114: перенос карточки — право «Перенос записи» */
  canMove?: boolean;
  onOpen: (bookingId: Id) => void;
  /** F-16-127: наведение подсвечивает все записи пакета */
  packageGroupId?: Id;
  onPackageHover?: (groupId: Id | undefined) => void;
  highlighted?: boolean;
  /** ⭐ Клиент опаздывает (lib/lateness) — красная обводка, пока не отметили «Пришёл» */
  late?: boolean;
  /** «Живой день»: где запись относительно «сейчас» — прошла (приглушена), идёт (primary + прогресс), впереди */
  phase?: 'past' | 'now' | 'future';
  /** «Живой день»: доля пройденного у идущего визита, 0…100 */
  progressPct?: number;
  /** «Живой день»: «ещё 53 мин» у идущего, «опаздывает 7 мин» у опоздавшего */
  liveNote?: string;
  className?: string;
}

function BookingBlockInner({
  booking,
  client,
  services,
  tone,
  text,
  labels,
  extras,
  top,
  height,
  naturalHeight: _naturalHeight,
  breakMin = 0,
  defaultBreakMin = 0,
  onBreakChange,
  pxPerMin,
  zoomStepMin = 5,
  canResize = false,
  onResize,
  canMove = false,
  onOpen,
  packageGroupId,
  onPackageHover,
  highlighted,
  late,
  phase,
  progressPct = 0,
  liveNote,
  className,
}: BookingBlockProps) {
  const manualColorClass = extras?.colorIndex ? MANUAL_COLOR_BORDER[extras.colorIndex] : undefined;
  // Стиль, которым рисуется доска (lib/journalStyle): при смене стиля доска перемонтируется
  const style = renderedJournalStyle();
  const google = style === 'google';
  const ios = style === 'ios';
  const live = style === 'live';
  const liveNow = live && phase === 'now';
  // «Google» и «iOS» — мелкий текст события и точка вместо капли; различаются заливкой и порядком строк
  const small = google || ios || live;
  const sizes = cardSizes();

  const { attributes, listeners, setNodeRef: setDragRef, transform, isDragging } = useDraggable({
    id: booking.id,
    data: { durationMin: booking.durationMin },
    disabled: !canMove,
  });

  // F-01-031: тянем нижний край — px во время протяжки, минуты с шагом сетки только на отпускании
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  // F-01-029: карточка статуса — наведением на каплю (клик/фокус — для тача и клавиатуры). Поповер монтируется при
  // первом касании капли: пока карточку не трогали, в ней нет ни поповера, ни его подписок.
  const [statusArmed, setStatusArmed] = useState(false);
  const [statusCardOpen, setStatusCardOpen] = useState(false);
  const [breakArmed, setBreakArmed] = useState(false);
  const breakBtnRef = useRef<HTMLElement | null>(null);
  const hoverTimer = useRef<number | null>(null);
  const clearHoverTimer = () => {
    if (hoverTimer.current !== null) {
      window.clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
  };
  const openStatusCardOnHover = () => {
    clearHoverTimer();
    setStatusArmed(true);
    hoverTimer.current = window.setTimeout(() => setStatusCardOpen(true), 150);
  };
  const closeStatusCardOnHover = () => {
    clearHoverTimer();
    hoverTimer.current = window.setTimeout(() => setStatusCardOpen(false), 200);
  };
  const displayHeight = dragHeight ?? height;
  const compact = displayHeight < sizes.stack;
  // Растянута до минимума (owner 27.09.2026: короткая запись «ложится на следующую строку», а не ужимает текст).
  // Над соседкой снизу её НЕ поднимаем: следующая запись идёт за ней в DOM и ложится сверху, поэтому время
  // каждой записи всегда видно; спрятанный низ короткой (имя) виден в карточке статуса и окне записи.
  const breakHeight = pxPerMin ? Math.max(0, breakMin) * pxPerMin : 0;

  const startResize = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!canResize || !pxPerMin || !onResize) return;
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    const startHeight = height;
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    const step = zoomStepMin;
    const minHeight = step * pxPerMin;
    // F-01-031 fix: хвостовой синтетический click после отпускания попадал в пустую ячейку сетки и открывал
    // «Новую запись» — гасим ровно его на фазе перехвата окна.
    const swallowClick = (ev: MouseEvent) => {
      ev.stopPropagation();
      ev.preventDefault();
      window.removeEventListener('click', swallowClick, true);
    };
    window.addEventListener('click', swallowClick, true);
    const onMove = (ev: PointerEvent) => setDragHeight(Math.max(minHeight, startHeight + (ev.clientY - startY)));
    const onUp = (ev: PointerEvent) => {
      target.releasePointerCapture(e.pointerId);
      target.removeEventListener('pointermove', onMove);
      target.removeEventListener('pointerup', onUp);
      const rawMin = (startHeight + (ev.clientY - startY)) / pxPerMin;
      const steppedMin = Math.max(step, Math.round(rawMin / step) * step);
      setDragHeight(null);
      if (steppedMin !== booking.durationMin) onResize(booking, steppedMin);
      window.setTimeout(() => window.removeEventListener('click', swallowClick, true), 0);
    };
    target.addEventListener('pointermove', onMove);
    target.addEventListener('pointerup', onUp);
  };

  const toneVars = {
    '--tone-solid': tone.solid,
    ...(tone.lacquerHex ? { '--tone-lacquer': tone.lacquerHex } : {}),
    '--tone-fill': tone.fill,
    '--tone-ink': tone.ink,
    '--tone-drop': tone.drop,
    '--tone-ring': tone.ring,
  } as CSSProperties;

  const dropProps = {
    type: 'button' as const,
    'aria-label': labels.statusCard,
    onMouseEnter: openStatusCardOnHover,
    onMouseLeave: closeStatusCardOnHover,
    onBlur: closeStatusCardOnHover,
    className: small ? G_DROP_BUTTON : DROP_BUTTON,
  };
  const drop = (
    <span
      aria-hidden
      className={cn(google ? styles.gDrop : ios || live ? styles.iDrop : styles.drop, 'block rounded-full', small ? G_DROP_SIZE : DROP_SIZE, liveNow && 'ring-2 ring-primary-contrast')}
    />
  );

  return (
    <div
      ref={setDragRef}
      data-booking={booking.id}
      data-f="F-01-026 F-01-027 F-01-028 F-01-051 F-01-052 F-01-214 F-01-031 F-01-110 F-01-111 F-01-114 F-01-178 F-00-184 F-10-133 F-10-134 F-10-136 F-03-124 F-04-102 F-16-127 F-00-094"
      style={{
        ...toneVars,
        top,
        height: displayHeight,
        transform: transform ? CSS.Translate.toString(transform) : undefined,
        cursor: canMove ? 'grab' : undefined,
      }}
      onMouseEnter={packageGroupId && onPackageHover ? () => onPackageHover(packageGroupId) : undefined}
      onMouseLeave={packageGroupId && onPackageHover ? () => onPackageHover(undefined) : undefined}
      className={cn(
        // Google: справа зазор, в него можно нажать, чтобы создать запись на это же время
        google ? 'absolute right-2 left-0.5 z-10' : ios ? 'absolute right-1 left-0.5 z-10' : live ? 'absolute right-2 left-1.5 z-10' : 'absolute inset-x-1 z-10',
        isDragging && 'z-30 opacity-80',
        !small && text.dimmed && 'opacity-60',
        className,
      )}
    >
      <div className="relative h-full w-full">
        <button
          type="button"
          data-f="F-01-030"
          data-testid="booking-block"
          aria-label={text.aria}
          onClick={(e) => {
            e.stopPropagation();
            onOpen(booking.id);
          }}
          className={cn(
            google ? styles.gCard : ios ? styles.iCard : live ? cn(styles.lCard, liveNow && styles.lNow, phase === 'past' && styles.lPast) : styles.card,
            'flex h-full w-full flex-col overflow-hidden text-left focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus',
            google ? cn('rounded-md', G_PADDING) : ios ? 'rounded-[5px] py-1 pr-2 pl-2.5' : live ? 'gap-px rounded-[10px] px-2.5 py-1.5' : cn('rounded-xl', CARD_PADDING),
            text.pending && (google ? styles.gPending : ios ? styles.iPending : styles.pending),
            text.dimmed && (google ? styles.gDimmed : ios ? styles.iDimmed : live ? styles.lPast : undefined),
            manualColorClass && cn('border-l-[3px]', manualColorClass),
            highlighted && 'ring-2 ring-primary ring-offset-1 ring-offset-surface',
            late && !highlighted && (live ? styles.lLate : 'ring-2 ring-danger ring-offset-1 ring-offset-surface'),
            canMove && 'touch-none',
          )}
          {...(canMove ? attributes : undefined)}
          {...(canMove ? listeners : undefined)}
        >
          {live ? (
            <>
              {/* «Живой день» (owner 08.10.2026): время крупно и длительность (у идущего — «до 15:30» и «сейчас»), имя и
                  «новый», услуга, внизу цена и статус; у идущего — полоса прогресса и «ещё N мин»; у опоздавшего —
                  «опаздывает N мин». Короткая — строкой «10:30 Имя». */}
              {compact ? (
                <span data-f="F-01-128 F-01-171" className={cn(G_LINE, 'flex items-center gap-1.5 pr-3', text.dimmed && 'line-through')}>
                  <b className="font-display text-[13px] font-extrabold"><TimeText value={text.time} /></b>
                  <span className={cn('truncate font-semibold', !liveNow && 'text-fg')}>{text.primary}</span>
                  {liveNote && <span className="truncate opacity-90">· {liveNote}</span>}
                </span>
              ) : (
                <>
                  <span className="flex items-baseline gap-1.5 pr-3">
                    <b className={cn('font-display text-[15px] leading-5 font-extrabold tracking-[-0.2px]', text.dimmed && 'line-through')}>
                      <TimeText value={text.time} suffixClassName="text-[10px]" />
                    </b>
                    <span className="truncate text-[11px] opacity-80">{liveNow ? text.until : text.duration}</span>
                    {liveNow && <span className="ml-auto shrink-0 rounded-full bg-primary-contrast/20 px-1.5 text-[10.5px] leading-4 font-semibold">{labels.liveNow}</span>}
                  </span>
                  <span data-f="F-01-128 F-01-171" className={cn('flex min-w-0 items-center gap-1.5 text-[13px] leading-4 font-semibold', !liveNow && 'text-fg', text.dimmed && 'line-through')}>
                    <span className="truncate">{text.primary}</span>
                    {text.isNew && <span className="shrink-0 rounded-full bg-fg px-1.5 text-[10px] leading-4 text-surface">{labels.newClient}</span>}
                  </span>
                  {late && liveNote && <span className="self-start rounded-full bg-danger px-1.5 text-[10.5px] leading-4 font-semibold text-primary-contrast">{liveNote}</span>}
                  {displayHeight >= sizes.service && (
                    <span className={cn(G_LINE, 'opacity-90')}>
                      {text.dropOff && <PackagePlus aria-hidden data-f="orders-dropoff-badge" className="mr-1 inline size-3 align-[-2px]" />}
                      {text.pickup && <PackageCheck aria-hidden data-f="orders-pickup-badge" className="mr-1 inline size-3 align-[-2px]" />}
                      {text.detail}
                    </span>
                  )}
                  {liveNow ? (
                    displayHeight >= sizes.service && (
                      <span className="mt-auto flex flex-col gap-0.5">
                        <span aria-hidden className="block h-1.5 overflow-hidden rounded-full bg-primary-contrast/25">
                          <span className="block h-full rounded-full bg-primary-contrast" style={{ width: `${Math.max(3, Math.min(100, progressPct))}%` }} />
                        </span>
                        {liveNote && <span className="text-[11px] leading-4 opacity-90">{liveNote}</span>}
                      </span>
                    )
                  ) : (
                    // У опоздавшего с номером внизу — «Позвонить» (поверх карточки), цена и статус не нужны
                    !(late && text.callHref) &&
                    displayHeight >= sizes.pill && (
                      <span className="mt-auto flex items-center justify-between gap-2 text-xs leading-4 font-semibold">
                        <span className="truncate">{text.price}</span>
                        <span className="truncate rounded-full bg-surface/75 px-1.5 text-[10.5px] text-fg">{text.liveStatus}</span>
                      </span>
                    )
                  )}
                </>
              )}
            </>
          ) : ios ? (
            <>
              {/* Как в Календаре iOS (owner 08.10.2026): жирное имя, под ним услуга (как «место» у iOS), время и статус —
                  если хватает высоты; короткая — одной строкой «Имя 10:30» */}
              {compact ? (
                <span data-f="F-01-128 F-01-171" className={cn(G_LINE, 'pr-3', text.dimmed && 'line-through')}>
                  {text.dropOff && <PackagePlus aria-hidden className="mr-1 inline size-3 align-[-2px]" />}
                  {text.pickup && <PackageCheck aria-hidden className="mr-1 inline size-3 align-[-2px]" />}
                  <span className="font-semibold">{text.primary}</span> <span className="opacity-80"><TimeText value={text.time} /></span>
                </span>
              ) : (
                <>
                  <span data-f="F-01-128 F-01-171" className={cn(G_NAME, text.dimmed && 'line-through')}>
                    {text.primary}
                  </span>
                  <span className={cn(G_LINE, 'opacity-85')}>
                    {text.dropOff && <PackagePlus aria-hidden data-f="orders-dropoff-badge" className="mr-1 inline size-3 align-[-2px]" />}
                    {text.pickup && <PackageCheck aria-hidden data-f="orders-pickup-badge" className="mr-1 inline size-3 align-[-2px]" />}
                    {text.detail}
                  </span>
                  {displayHeight >= sizes.service && <span className={cn(G_LINE, 'opacity-75')}>{text.range}</span>}
                  {displayHeight >= sizes.pill && <span className={cn(G_LINE, 'mt-auto opacity-75')}>{text.pill}</span>}
                </>
              )}
            </>
          ) : google ? (
            <>
              {/* Как в Google Calendar (owner 08.10.2026): короткая — одной строкой «Имя, 11:00», выше — имя, «11:00 – 12:00»,
                  услуга, статус (пороги — lib/board.cardSizes). Метки клиента, телефон, комментарий —
                  в карточке статуса и окне записи, не здесь. */}
              {compact ? (
                <span data-f="F-01-128 F-01-171" className={cn(G_LINE, 'pr-3', text.dimmed && 'line-through')}>
                  {text.dropOff && <PackagePlus aria-hidden className="mr-1 inline size-3 align-[-2px]" />}
                  {text.pickup && <PackageCheck aria-hidden className="mr-1 inline size-3 align-[-2px]" />}
                  <span className="font-semibold">{text.primary}</span>, <TimeText value={text.time} />
                </span>
              ) : (
                <>
                  <span data-f="F-01-128 F-01-171" className={cn(G_NAME, text.dimmed && 'line-through')}>
                    {text.primary}
                  </span>
                  <span className={cn(G_LINE, 'opacity-90')}>
                    {text.range}
                  </span>
                  {displayHeight >= sizes.service && (
                    <span className={cn(G_LINE, 'opacity-90')}>
                      {text.dropOff && <PackagePlus aria-hidden data-f="orders-dropoff-badge" className="mr-1 inline size-3 align-[-2px]" />}
                      {text.pickup && <PackageCheck aria-hidden data-f="orders-pickup-badge" className="mr-1 inline size-3 align-[-2px]" />}
                      {text.detail}
                    </span>
                  )}
                  {displayHeight >= sizes.pill && <span className={cn(G_LINE, 'mt-auto opacity-80')}>{text.pill}</span>}
                </>
              )}
            </>
          ) : (
            <>
              {/* DESIGN.md → «C · Тон»: один масштаб на все карточки (owner 27.09.2026) — время всегда 30px/800,
                  имя всегда одного размера под ним. Карточка держит ровно 4 строки данных (время, имя, «услуга ·
                  до HH:MM», пилюля «статус · лак») — «никаких цветных шапок, никакого стека значков». Телефон,
                  метки клиента/своя категория, значок статуса, «Новый клиент» и занятость ресурса остались
                  функциями (см. карточку статуса F-01-029 и окно записи), но не рисуются здесь второй раз. */}
              {compact ? (
                // Короче CARD_STACK_FROM (запись меньше часа): те же шрифты, время слева, имя и услуга справа —
                // ничего не налезает на соседнюю запись. Полная информация — в карточке статуса и окне записи.
                // Телефон (решение 01.10.2026): узкая колонка не вмещает крупное время и имя — время не выводим (оно на оси,
                // в aria-label и окне записи), первым идёт имя клиента; услуга — второй строкой, если на неё хватает высоты.
                <span className="flex min-w-0 items-start gap-2.5">
                  <span className={cn(styles.ink, TIME_SIZE, 'shrink-0 max-md:hidden', text.dimmed && 'line-through')}><TimeText value={text.time} suffixClassName="text-xs" /></span>
                  <span className="flex min-w-0 flex-col pt-0.5 pr-5">
                    <span data-f="F-01-128 F-01-171" className={cn(NAME_SIZE, 'mt-0', text.dimmed && 'max-md:line-through')}>
                      {/* ⭐ Запись на сдачу: на телефоне вторая строка («Сдача: …») у короткой записи не помещается — значок у имени */}
                      {text.dropOff && <PackagePlus aria-hidden className="mr-1 inline size-3.5 align-[-2px] md:hidden" />}
                      {text.pickup && <PackageCheck aria-hidden className="mr-1 inline size-3.5 align-[-2px] md:hidden" />}
                      {text.primary}
                    </span>
                    <span className={cn(styles.ink, 'truncate text-xs leading-snug opacity-90', displayHeight < COMPACT_PHONE_TWO_LINES_FROM && 'max-md:hidden')}>
                      {text.dropOff && <PackagePlus aria-hidden data-f="orders-dropoff-badge" className="mr-1 inline size-3 align-[-2px]" />}
                      {text.pickup && <PackageCheck aria-hidden data-f="orders-pickup-badge" className="mr-1 inline size-3 align-[-2px]" />}
                      {text.secondary}
                    </span>
                  </span>
                </span>
              ) : (
                // DESIGN.md → A2 / «C · Тон», как в одобренном макете: время и имя всегда, «услуга · до» с CARD_SERVICE_FROM,
                // пилюля «статус · лак» с CARD_PILL_FROM.
                <>
                  <span className={cn(styles.ink, TIME_SIZE, 'pr-6', text.dimmed && 'line-through')}><TimeText value={text.time} suffixClassName="text-xs" /></span>
                  <span data-f="F-01-128 F-01-171" className={NAME_SIZE}>
                    {text.primary}
                  </span>
                  {displayHeight >= sizes.service && (
                    <span className={cn(styles.ink, 'mt-0.5 truncate text-xs leading-snug opacity-90')}>
                      {text.dropOff && <PackagePlus aria-hidden data-f="orders-dropoff-badge" className="mr-1 inline size-3 align-[-2px]" />}
                      {text.pickup && <PackageCheck aria-hidden data-f="orders-pickup-badge" className="mr-1 inline size-3 align-[-2px]" />}
                      {text.secondary}
                    </span>
                  )}
                  {displayHeight >= sizes.pill && (
                    <span className="mt-auto flex max-w-full items-center gap-1 self-start rounded-full bg-surface px-2 py-0.5 text-[11px] leading-4 font-semibold text-primary-text">
                      <span className="truncate">{text.pill}</span>
                    </span>
                  )}
                </>
              )}
            </>
          )}
        </button>
        {/* F-01-029: капля лака — вход в карточку статуса; зона нажатия 40px */}
        {statusArmed ? (
          <Popover
            align="end"
            label={labels.statusCard}
            open={statusCardOpen}
            onOpenChange={setStatusCardOpen}
            trigger={(p) => (
              <button
                {...p}
                {...dropProps}
                onClick={(e) => {
                  e.stopPropagation();
                  clearHoverTimer();
                  p.onClick();
                }}
                onFocus={() => {
                  clearHoverTimer();
                  setStatusCardOpen(true);
                }}
              >
                {drop}
              </button>
            )}
          >
            {({ close }) => (
              <div onMouseEnter={clearHoverTimer} onMouseLeave={closeStatusCardOnHover}>
                <BookingHoverCard booking={booking} client={client} services={services} onChanged={close} />
              </div>
            )}
          </Popover>
        ) : (
          <button
            {...dropProps}
            aria-haspopup="dialog"
            aria-expanded={false}
            onClick={(e) => {
              e.stopPropagation();
              clearHoverTimer();
              setStatusArmed(true);
              setStatusCardOpen(true);
            }}
            onFocus={() => {
              setStatusArmed(true);
              setStatusCardOpen(true);
            }}
          >
            {drop}
          </button>
        )}
        {/* «Живой день»: опоздавшему — «Позвонить» прямо на карточке (номер, если он виден сотруднику) */}
        {live && late && text.callHref && displayHeight >= sizes.service && (
          <a
            href={text.callHref}
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-1.5 left-2.5 z-20 inline-flex h-7 items-center rounded-full bg-danger px-3 text-xs font-semibold text-primary-contrast focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus"
          >
            {labels.liveCall}
          </a>
        )}
        {canResize && onResize && pxPerMin && (
          <div
            onPointerDown={startResize}
            aria-label={labels.resizeHandle}
            className={cn('absolute inset-x-2 bottom-0 z-20 h-2 cursor-row-resize touch-none', google ? 'rounded-b-md hover:bg-surface/30' : 'rounded-b-xl hover:bg-primary/25')}
          />
        )}
      </div>
      {breakMin > 0 &&
        (onBreakChange ? (
          breakArmed ? (
            <DropdownMenu
              align="start"
              label={labels.breakTitle}
              trigger={(p) => (
                <button
                  {...p}
                  ref={(el) => {
                    p.ref(el);
                    breakBtnRef.current = el;
                  }}
                  type="button"
                  data-f="F-01-032 F-02-062"
                  aria-label={labels.breakTitle}
                  style={{ height: breakHeight }}
                  onClick={(e) => {
                    e.stopPropagation();
                    p.onClick();
                  }}
                  className={BREAK_CLASS}
                />
              )}
              items={[
                { id: 'group', groupLabel: labels.breakTitle },
                ...labels.breakSetTo.map(({ m, label }) => ({
                  id: String(m),
                  label,
                  disabled: m === breakMin,
                  onSelect: () => onBreakChange(booking.id, m),
                })),
                ...(breakMin !== defaultBreakMin
                  ? [{ id: 'default', label: labels.breakDefault, onSelect: () => onBreakChange(booking.id, defaultBreakMin) }]
                  : []),
                { id: 'sep', separator: true as const },
                { id: 'delete', label: labels.breakDelete, danger: true, onSelect: () => onBreakChange(booking.id, 0) },
              ]}
            />
          ) : (
            <button
              type="button"
              data-f="F-01-032 F-02-062"
              aria-label={labels.breakTitle}
              aria-haspopup="menu"
              style={{ height: breakHeight }}
              onClick={(e) => {
                e.stopPropagation();
                setBreakArmed(true);
                // Меню смонтировалось — открыть его тем же нажатием
                requestAnimationFrame(() => breakBtnRef.current?.click());
              }}
              className={BREAK_CLASS}
            />
          )
        ) : (
          <div data-f="F-01-032" style={{ height: breakHeight }} aria-label={labels.breakTitle} className={BREAK_CLASS} />
        ))}
    </div>
  );
}

/**
 * Перерисовка только своей карточки: колбэки сетка держит стабильными (через ref), строки, подписи и тон сравниваются
 * по значению — листание дня, открытие окна записи и наведение на пакет не перерисовывают десятки соседей.
 */
export const BookingBlock = memo(BookingBlockInner, (a, b) => {
  const keys = Object.keys(b) as (keyof BookingBlockProps)[];
  if (Object.keys(a).length !== keys.length) return false;
  for (const k of keys) {
    if (typeof b[k] === 'function') continue;
    if (a[k] === b[k]) continue;
    if ((k === 'text' || k === 'labels' || k === 'tone') && shallowEqualDeep1(a[k], b[k])) continue;
    return false;
  }
  return true;
});
