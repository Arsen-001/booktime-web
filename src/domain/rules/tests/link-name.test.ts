import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { BookingLink } from '@/domain/online';
import { linkNameToStore, linkWithName } from '@/domain/online';
import { seedCore } from '@/mock/seed';
import { localizeDemo } from '@/mock/seed/demoLocale';
import { onlineSlice } from '@/mock/slices/online';

// Название ссылки онлайн-записи (20.11.2026): основную заводили «Форма компании» — по-русски на hy/en и словом Altegio.
// Теперь без названия, подпись — на языке запроса, как у сервера (booktime-backend primary-link.test.ts).
const link = (over: Partial<BookingLink>) => ({ id: 'l1', name: '', primary: true, ...over }) as BookingLink;

describe('ссылка без своего названия', () => {
  test('новая основная (пустое название) — подпись на hy/ru/en', () => {
    assert.equal(linkWithName(link({}), 'hy').name, 'Հիմնական հղում');
    assert.equal(linkWithName(link({}), 'ru').name, 'Основная ссылка');
    assert.equal(linkWithName(link({}), 'en').name, 'Main link');
    assert.equal(linkWithName(link({}), 'en').nameDefault, true);
  });

  test('старая «Форма компании» — тоже без названия', () => {
    for (const [locale, label] of [['hy', 'Հիմնական հղում'], ['ru', 'Основная ссылка'], ['en', 'Main link']] as const) {
      const out = linkWithName(link({ name: 'Форма компании' }), locale);
      assert.equal(out.name, label);
      assert.equal(out.nameDefault, true);
    }
  });

  test('не основная без названия — «Ссылка на запись»', () => {
    assert.equal(linkWithName(link({ primary: false }), 'ru').name, 'Ссылка на запись');
    assert.equal(linkWithName(link({ primary: false }), 'en').name, 'Booking link');
  });

  test('своё название владельца — как есть', () => {
    const out = linkWithName(link({ name: 'Instagram' }), 'hy');
    assert.equal(out.name, 'Instagram');
    assert.equal(out.nameDefault, false);
  });

  test('сохранение: её же подпись у ссылки без названия — без названия; своё — как прислали', () => {
    assert.equal(linkNameToStore(link({ name: 'Форма компании' }), 'Main link'), '');
    assert.equal(linkNameToStore(link({}), 'Հիմնական հղում'), '');
    assert.equal(linkNameToStore(link({}), 'Запись с сайта'), 'Запись с сайта');
    assert.equal(linkNameToStore(link({ name: 'Instagram' }), 'Основная ссылка'), 'Основная ссылка');
  });

  test('сид мока: основная ссылка у каждого бизнеса без названия, и на hy/en тоже', () => {
    const now = new Date('2026-11-20T10:00:00');
    const core = seedCore(now);
    const primary = onlineSlice.seed(core, now).links.filter((l) => l.primary);
    assert.equal(new Set(primary.map((l) => l.businessId)).size, core.businesses.length);
    for (const locale of ['hy', 'en'] as const) {
      for (const l of localizeDemo(primary, locale)) assert.equal(l.name, '');
    }
  });
});
