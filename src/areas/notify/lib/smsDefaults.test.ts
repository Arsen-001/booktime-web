/**
 * Короткие SMS по умолчанию укладываются в одну часть (28.09): реальные по длине данные — название салона 16
 * символов, услуга ~20, короткая ссылка booktime.am/s/<6 знаков>, дата «ДД.ММ» и худшие «сегодня/завтра».
 * SMS_TABLE=1 печатает таблицу «было → стало» (полный текст с длинной ссылкой против короткого).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { NotifyLanguage } from '@/domain/notify';
import type { Booking, BookingEvent, CoreData } from '@/domain/core';
import type { NotificationType } from '@/domain/notify';
import { deriveLiveLogEntries } from '@/areas/notify/lib/liveLog';
import { buildTypes, TYPE_REGISTRY, upgradeSmsDefaults } from '@/areas/notify/lib/registry';
import { shortCodeFor } from '@/areas/notify/lib/shortLink';
import { dayjs } from '@/lib/date';
import { SMS_DEFAULTS } from '@/areas/notify/lib/smsDefaults';
import { countSms } from '@/areas/notify/lib/sms';

const LANGS: NotifyLanguage[] = ['ru', 'hy', 'en'];

const COMMON: Record<NotifyLanguage, Record<string, string>> = {
  ru: { service: 'Маникюр с покрытием', staff: 'Лилит', address: 'ул. Абовяна, 12', clientName: 'Мариам', amount: '15 000' },
  hy: { service: 'Մատնահարդարում գելով', staff: 'Լիլիթ', address: 'Աբովյան փ․ 12', clientName: 'Մարիամ', amount: '15 000' },
  en: { service: 'Gel manicure + design', staff: 'Lilit', address: '12 Abovyan St', clientName: 'Mariam', amount: '15 000' },
};
const LONG_BASE = 'booktime.am/b/nuri-nail-studio';
const LONG_BOOKING = `${LONG_BASE}/booking/bk_mg3x8k2fa1b2c3`;

function data(lang: NotifyLanguage, long: boolean, date: string): Record<string, string> {
  const short = 'booktime.am/s/x7Kp2A';
  return {
    companyName: 'Nuri Nail Studio',
    ...COMMON[lang],
    date,
    time: '14:00',
    discount: '10',
    days: '5',
    link: long ? LONG_BOOKING : short,
    reviewLink: long ? `${LONG_BOOKING}?review=1` : short,
    paymentLink: long ? `${LONG_BOOKING}?pay=1` : short,
    bookingLink: long ? `${LONG_BASE}/book` : short,
  };
}

const fill = (tpl: string, vars: Record<string, string>) => tpl.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? '');

/** Все формы {date} короткой SMS: ДД.ММ и слова «сегодня/завтра» на языке сообщения */
const SHORT_DATES: Record<NotifyLanguage, string[]> = {
  ru: ['29.09', 'сегодня', 'завтра'],
  hy: ['29.09', 'այսօր', 'վաղը'],
  en: ['29.09', 'today', 'tomorrow'],
};

test('короткие SMS по умолчанию: одна часть на реальных данных, en — без символов вне GSM-7', () => {
  for (const [code, text] of Object.entries(SMS_DEFAULTS)) {
    for (const lang of LANGS) {
      const tpl = text[lang];
      for (const date of SHORT_DATES[lang]) {
        const c = countSms(fill(tpl, data(lang, false, date)));
        assert.equal(c.parts, 1, `тип ${code} ${lang} (${date}): ${c.units} символов → ${c.parts} части`);
      }
      if (lang === 'en') assert.equal(countSms(fill(tpl, data('en', false, '29.09'))).encoding, 'gsm7', `тип ${code} en ушёл в UCS-2`);
    }
  }
});

test('короткий текст есть у каждого клиентского типа, кроме системного кода входа (7)', () => {
  const clientCodes = TYPE_REGISTRY.filter((d) => d.recipient === 'client' && d.availableChannels.includes('sms') && !d.systemLocked).map((d) => d.code);
  for (const code of clientCodes) assert.ok(SMS_DEFAULTS[code], `нет короткого SMS у типа ${code}`);
});

test('старый полный SMS-текст по умолчанию читается как короткий, свой текст салона — нет', () => {
  const def = TYPE_REGISTRY.find((d) => d.code === 8)!;
  const stored = buildTypes('biz_t').map((t) =>
    t.code === 8 ? { ...t, templates: { ...t.templates, sms: { ru: def.templateRu, en: 'My own text {link}', hy: def.templateHy } } } : t,
  );
  const sms = upgradeSmsDefaults(stored).find((t) => t.code === 8)!.templates.sms!;
  assert.equal(sms.ru, SMS_DEFAULTS[8].ru);
  assert.equal(sms.hy, SMS_DEFAULTS[8].hy);
  assert.equal(sms.en, 'My own text {link}');
  const fresh = buildTypes('biz_t');
  assert.equal(upgradeSmsDefaults(fresh), fresh, 'свежий сид уже короткий — тот же массив, без копий');
});

test('живой журнал: SMS — короткая ссылка и «ДД.ММ», пуш — полная ссылка с ?h=', () => {
  const booking = {
    id: 'bk_t', businessId: 'biz_t', locationId: 'loc_t', staffId: 'st_t', clientId: 'cl_t', start: '2026-10-05T14:00', durationMin: 60,
    status: 'scheduled', services: [{ serviceId: 'sv_t', staffId: 'st_t', price: 5000, durationMin: 60, qty: 1 }], total: 5000, resourceIds: [],
    workplace: 'salon', source: 'journal', createdBy: 'st_owner', forWhom: 'self', createdAt: '2026-09-28T10:00', updatedAt: '2026-09-28T10:00',
  } as Booking;
  const core: CoreData = {
    networks: [], serviceCategories: [], resources: [], appUsers: [], groupEvents: [], schedules: [], calendarMarks: [],
    businesses: [{ id: 'biz_t', kind: 'salon', name: 'Nuri Nail Studio', slug: 'nuri', sphereIds: [], ownerStaffId: 'st_owner', locationIds: ['loc_t'], phone: '', photos: [], status: 'active', createdAt: '2025-01-01T10:00' }],
    locations: [{ id: 'loc_t', businessId: 'biz_t', name: { ru: 'Центр' }, address: { ru: 'ул. Тест 1' }, district: 'kentron' }],
    staff: [], services: [],
    clients: [{ id: 'cl_t', businessId: 'biz_t', phone: '+37400199999', name: 'Мариам', gender: 'female', tags: [], noShowCount: 0, createdAt: '2026-01-01T10:00' }],
    bookings: [booking],
    bookingEvents: [{ id: 'ev1', businessId: 'biz_t', bookingId: 'bk_t', kind: 'created', staffId: 'st_t', at: '2026-09-28T10:00', by: 'st_owner' } as BookingEvent],
  };
  const withSms = (scenario: 'always' | 'off'): NotificationType[] =>
    buildTypes('biz_t').map((t) => (t.code === 8 ? { ...t, channels: t.channels.map((c) => (c.channel === 'sms' ? { ...c, scenario } : c)) } : { ...t, enabled: false }));
  const shortened: string[] = [];
  const base = { businessId: 'biz_t', core, overrides: {}, now: dayjs('2026-09-28T11:00').toDate(), accessHashes: { bk_t: 'abc123' } };
  const shorten = (path: string) => (shortened.push(path), shortCodeFor('biz_t', path));

  const sms = deriveLiveLogEntries({ ...base, types: withSms('always'), shorten }).find((e) => e.channel === 'sms')!;
  const code = shortCodeFor('biz_t', '/b/nuri/booking/bk_t?h=abc123');
  assert.equal(sms.text.ru, `Nuri Nail Studio: вы записаны 05.10 в 14:00. booktime.am/s/${code}`);
  assert.equal(sms.smsParts, 1);
  assert.deepEqual(shortened.slice(0, 1), ['/b/nuri/booking/bk_t?h=abc123']);

  // Клиент без приложения и SMS выключен — пуш не доставим; с приложением пуш уходит с полной ссылкой
  const push = deriveLiveLogEntries({ ...base, core: { ...core, clients: [{ ...core.clients[0], appUserId: 'au_t' }] }, types: withSms('off'), shorten }).find((e) => e.channel === 'push')!;
  assert.match(push.text.ru, /booktime\.am\/b\/nuri\/booking\/bk_t\?h=abc123/);
  assert.match(push.text.ru, /05\.10\.2026/);
});

if (process.env.SMS_TABLE) {
  const rows: string[] = ['тип | язык | было (символов/частей) | стало (символов/частей)'];
  TYPE_REGISTRY.filter((d) => d.recipient === 'client' && d.availableChannels.includes('sms')).forEach((def) => {
    for (const lang of LANGS) {
      const full = lang === 'ru' ? def.templateRu : lang === 'en' ? def.templateEn : def.templateHy;
      const before = countSms(fill(full ?? def.templateRu, data(lang, true, '29.09.2026')));
      const shortTpl = SMS_DEFAULTS[def.code]?.[lang] ?? full ?? def.templateRu;
      const after = countSms(fill(shortTpl, data(lang, false, '29.09')));
      rows.push(`${def.code} | ${lang} | ${before.units}/${before.parts} | ${after.units}/${after.parts}`);
    }
  });
  console.log(rows.join('\n'));
}
