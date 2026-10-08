/**
 * Расчёты «доски» журнала (DESIGN.md → Journal A2): итоги дня, загрузка мастера, свободные окна, тон карточки.
 * Чистые функции без React — сетка зовёт их один раз на данные дня (useMemo), а не на каждый кадр/карточку.
 */
import type { Booking, BookingStatus, DayHours, Id, Minutes, Service } from '@/domain/core';
import type { BookingLacquer } from '@/domain/journal';
import { toMinutes } from '@/lib/date';
import { tone, type Tone } from '@/ui/tone';
import { renderedJournalStyle } from '@/areas/journal/lib/journalStyle';

/** Отменённые не занимают время, не приносят денег и не считаются записями дня */
const INACTIVE: BookingStatus[] = ['cancelled_by_client', 'cancelled_by_master'];

export function isActiveBooking(b: Pick<Booking, 'status' | 'deletedAt'>): boolean {
  return !b.deletedAt && !INACTIVE.includes(b.status);
}

export function startMinutes(b: Pick<Booking, 'start'>): Minutes {
  return Number(b.start.slice(11, 13)) * 60 + Number(b.start.slice(14, 16));
}

/** Минимальное свободное окно, которое имеет смысл предлагать (и считать в итогах дня) */
export const FREE_SLOT_MIN = 60;

export interface Gap {
  from: Minutes;
  to: Minutes;
}

/** Свободные промежутки рабочего времени мастера не короче minGap (занятое — активными записями) */
export function freeGaps(hours: DayHours, bookings: Booking[], minGap: Minutes = FREE_SLOT_MIN, notBefore: Minutes = 0): Gap[] {
  const busy = bookings
    .filter(isActiveBooking)
    .map((b) => ({ from: startMinutes(b), to: startMinutes(b) + b.durationMin }))
    .sort((a, b) => a.from - b.from);
  const gaps: Gap[] = [];
  for (const h of hours) {
    let cursor = Math.max(toMinutes(h.from), notBefore);
    const end = toMinutes(h.to);
    for (const b of busy) {
      if (b.to <= cursor || b.from >= end) continue;
      if (b.from - cursor >= minGap) gaps.push({ from: cursor, to: b.from });
      cursor = Math.max(cursor, b.to);
    }
    if (end - cursor >= minGap) gaps.push({ from: cursor, to: end });
  }
  return gaps;
}

export interface StaffLoad {
  count: number;
  ratio: number;
}

/** Загрузка мастера за день: доля рабочих минут, занятых активными записями (0…1) */
export function staffLoad(hours: DayHours, bookings: Booking[]): StaffLoad {
  const active = bookings.filter(isActiveBooking);
  const work = hours.reduce((sum, h) => sum + Math.max(0, toMinutes(h.to) - toMinutes(h.from)), 0);
  const booked = active.reduce((sum, b) => sum + b.durationMin, 0);
  return { count: active.length, ratio: work > 0 ? Math.min(1, booked / work) : 0 };
}

export interface DayTotalsData {
  bookings: number;
  revenue: number;
  freeSlots: number;
  pending: number;
}

export function dayTotals(bookings: Booking[], hoursByStaff: Record<Id, DayHours>, bookingsByStaff: Record<Id, Booking[]>): DayTotalsData {
  const active = bookings.filter(isActiveBooking);
  let freeSlots = 0;
  for (const [staffId, hours] of Object.entries(hoursByStaff)) freeSlots += freeGaps(hours, bookingsByStaff[staffId] ?? []).length;
  return {
    bookings: active.length,
    revenue: active.reduce((sum, b) => sum + b.total, 0),
    freeSlots,
    pending: active.filter((b) => b.status === 'awaiting_confirmation').length,
  };
}

/**
 * Цвет категорий услуг — данные, а не токены темы: из цвета карточка строит свой тон (светлая заливка + тёмное
 * время), токенов под это нет. Спокойные «лаковые» оттенки, различимые между собой.
 */
const CATEGORY_HEX = [
  '#d98a9e', // tokens-ok — розовый
  '#8fb9a8', // tokens-ok — шалфей
  '#a896d6', // tokens-ok — лаванда
  '#e2a878', // tokens-ok — персик
  '#7fa3d1', // tokens-ok — голубой
  '#c9a95c', // tokens-ok — песок
  '#9cb4c4', // tokens-ok — туман
  '#cf8fbf', // tokens-ok — орхидея
];
/**
 * Стиль «Google Calendar» (owner 08.10.2026): яркие цвета событий — все держат белый текст ≥ 4.5:1 сами, без
 * затемнения (затемнённые светлые лаки выходили бурыми, поэтому там заливка — по услуге, а лак — точкой).
 */
const GOOGLE_HEX = [
  '#1a73e8', // tokens-ok — синий Google
  '#188038', // tokens-ok — зелёный Google
  '#8e24aa', // tokens-ok — виноград
  '#c2185b', // tokens-ok — малиновый
  '#00796b', // tokens-ok — бирюзовый
  '#3f51b5', // tokens-ok — черника
  '#d84315', // tokens-ok — мандарин
  '#0277bd', // tokens-ok — павлин
];
/**
 * Стиль «Календарь iOS» (owner 08.10.2026): системные цвета iOS. Красный — акцент «сегодня» и линии «сейчас», а
 * коричневый на подкраске выходил грязным — их среди цветов записей нет.
 */
const IOS_HEX = [
  '#007aff', // tokens-ok — синий iOS
  '#34c759', // tokens-ok — зелёный iOS
  '#af52de', // tokens-ok — фиолетовый iOS
  '#ff9500', // tokens-ok — оранжевый iOS
  '#ff2d55', // tokens-ok — розовый iOS
  '#30b0c7', // tokens-ok — бирюзовый iOS
  '#5856d6', // tokens-ok — индиго iOS
  '#ffcc00', // tokens-ok — жёлтый iOS
];

export interface BookingToneInfo extends Tone {
  lacquerName?: string;
  /** Цвет лака записи — точка на событии (сама заливка — по услуге, см. bookingTone) */
  lacquerHex?: string;
}

const toneCache = new Map<string, Tone>();
function cachedTone(hex: string): Tone {
  let t = toneCache.get(hex);
  if (!t) {
    t = tone(hex);
    toneCache.set(hex, t);
  }
  return t;
}

/** Стабильный хеш строки (тот же приём, что у выбора оттенка лака в src/api/journal.ts lacquersOf) */
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * Тон карточки: оттенок лака записи, если он есть, иначе цвет — по конкретной услуге (DESIGN.md → «C · Тон»);
 * в стиле «Google Calendar» — всегда цвет услуги, лак — точкой (lacquerHex).
 * Owner 27.09.2026 («почти все карточки розовые»): индекс раньше брали от КАТЕГОРИИ первой услуги — в салоне
 * ногтевого сервиса «Маникюр» одна категория держит и классический, и аппаратный, и мужской, и детский
 * маникюр разом, так что почти весь день красился в CATEGORY_HEX[0]. Индекс от id самой услуги держит те же
 * 8 «лаковых» оттенков, но разводит их между услугами одной категории — заливка всё ещё проходит через
 * tone.ts, контраст ≥4.5:1 не меняется.
 */
export function bookingTone(
  booking: Pick<Booking, 'services'>,
  lacquer: BookingLacquer | undefined,
  servicesById: Map<Id, Service>,
): BookingToneInfo {
  const service = booking.services[0] ? servicesById.get(booking.services[0].serviceId) : undefined;
  const idx = service ? hashString(service.id) : 0;
  if (renderedJournalStyle() === 'ios') {
    // Как в Календаре iOS: цвет календаря (по услуге), лак — словом в строке статуса и точкой
    const base = cachedTone(IOS_HEX[idx % IOS_HEX.length]);
    return lacquer ? { ...base, lacquerName: lacquer.name, lacquerHex: lacquer.hex } : base;
  }
  if (renderedJournalStyle() === 'google') {
    // Заливка — всегда яркий цвет услуги; лак — точкой своего цвета на событии
    const base = cachedTone(GOOGLE_HEX[idx % GOOGLE_HEX.length]);
    return lacquer ? { ...base, lacquerName: lacquer.name, lacquerHex: lacquer.hex } : base;
  }
  if (lacquer) return { ...cachedTone(lacquer.hex), lacquerName: lacquer.name, lacquerHex: lacquer.hex };
  return cachedTone(CATEGORY_HEX[idx % CATEGORY_HEX.length]);
}

/**
 * Единый масштаб карточки записи (owner 27.09.2026: «не нравится, что элементы разного размера»).
 * Раньше карточка ниже 64px переключала время/имя на мелкий шрифт (22/18px) и укладывала их в одну строку —
 * при листании дня получалось три разных на вид типа карточек. Теперь текст всегда одного размера
 * (BookingBlock.TIME_SIZE/NAME_SIZE), а подбирает это высота строки сетки (lib/grid.pxPerMin): CARD_MIN_HEIGHT —
 * минимум, которого хватает «время + имя» при стандартном размере (сама сетка уже держит 30 минут выше этого
 * порога, см. pxPerMin); только записи короче — редкие 15-минутные — растягиваются в него принудительно и
 * заходят на соседнюю строку, а не переключают карточку на другую раскладку.
 */
export const CARD_MIN_HEIGHT = 44;
/**
 * Owner 27.09.2026: «нравится дизайн как в макете» (A2). Шрифты одни на все карточки; содержимое — по высоте, как в
 * макете: с CARD_STACK_FROM время и имя столбиком, с CARD_SERVICE_FROM + «услуга · до», с CARD_PILL_FROM + пилюля.
 * Ниже CARD_STACK_FROM — строка «время | имя, услуга» тех же размеров; CARD_MIN_HEIGHT — сколько ей нужно.
 */
export const CARD_STACK_FROM = 76;
/** Строка «услуга · до HH:MM» — с этой высоты карточки */
export const CARD_SERVICE_FROM = 96;
/** Пилюля «статус · лак» — с этой высоты карточки */
export const CARD_PILL_FROM = 120;

export interface CardSizes {
  min: number;
  stack: number;
  service: number;
  pill: number;
}
/**
 * Пороги карточки в стиле, которым рисуется доска. «Google Calendar» (owner 08.10.2026) — мелкий текст события,
 * пороги ниже: одна строка «Имя, 11:00» до stack, дальше имя и «11:00 – 12:00» столбиком, услуга, статус.
 */
export function cardSizes(): CardSizes {
  const style = renderedJournalStyle();
  if (style === 'ios') return { min: 40, stack: 44, service: 58, pill: 78 };
  return style === 'google'
    ? // min 40 — зона нажатия пальцем (CONVENTIONS §10); 30-минутная запись (30px) заходит на следующую, строка видна
      { min: 40, stack: 44, service: 54, pill: 72 }
    : { min: CARD_MIN_HEIGHT, stack: CARD_STACK_FROM, service: CARD_SERVICE_FROM, pill: CARD_PILL_FROM };
}
