import type { ISODateTime } from '@/domain/core';

/**
 * О21: файл «В календарь» по стандарту (RFC 5545): UID и DTSTAMP обязательны (без них календарь iPhone файл может не
 * принять), время — в поясе Asia/Yerevan (TZID + VTIMEZONE: у человека в другом поясе визит не сдвинется), адрес,
 * услуги, мастер и ссылка на управление записью, напоминание (VALARM). Плюс ссылка «Google Календарь».
 */
export interface CalendarEventInput {
  uid: string;
  start: ISODateTime;
  end: ISODateTime;
  title: string;
  location?: string;
  description: string;
  url: string;
  reminderMinutes?: number;
  /** Сейчас — для DTSTAMP (UTC) */
  stampUtc: string;
}

const local = (dt: ISODateTime) => `${dt.replace(/[-:]/g, '')}00`;

/** Экранирование текста значения iCalendar: \ ; , и переводы строк */
function esc(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Строки длиннее 75 октетов переносятся (складываются) пробелом в начале следующей */
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 70) {
    out.push(rest.slice(0, 70));
    rest = ` ${rest.slice(70)}`;
  }
  out.push(rest);
  return out.join('\r\n');
}

export function buildIcs(e: CalendarEventInput): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//BookTime//Online booking//RU',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    // Армения без перехода на летнее время: UTC+4 круглый год
    'BEGIN:VTIMEZONE',
    'TZID:Asia/Yerevan',
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    'TZOFFSETFROM:+0400',
    'TZOFFSETTO:+0400',
    'TZNAME:+04',
    'END:STANDARD',
    'END:VTIMEZONE',
    'BEGIN:VEVENT',
    `UID:${e.uid}`,
    `DTSTAMP:${e.stampUtc}`,
    `DTSTART;TZID=Asia/Yerevan:${local(e.start)}`,
    `DTEND;TZID=Asia/Yerevan:${local(e.end)}`,
    `SUMMARY:${esc(e.title)}`,
    ...(e.location ? [`LOCATION:${esc(e.location)}`] : []),
    `DESCRIPTION:${esc(e.description)}`,
    `URL:${e.url}`,
    ...(e.reminderMinutes
      ? ['BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(e.title)}`, `TRIGGER:-PT${Math.max(1, Math.round(e.reminderMinutes))}M`, 'END:VALARM']
      : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}

export function icsHref(e: CalendarEventInput): string {
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(buildIcs(e))}`;
}

/** «Google Календарь» — ссылка на форму нового события с теми же данными */
export function googleCalendarHref(e: CalendarEventInput): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: e.title,
    dates: `${local(e.start)}/${local(e.end)}`,
    ctz: 'Asia/Yerevan',
    details: `${e.description}\n${e.url}`,
  });
  if (e.location) params.set('location', e.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
