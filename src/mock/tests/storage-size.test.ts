/**
 * Демо (demo.booktime.am, режим mock) держит всю базу в localStorage посетителя — квота ~5,24 млн символов на сайт.
 * 20.11.2026: оплата визита после вкладки «Уведомления» не сохранялась (bookings 2,6 млн + notify 1,09 млн +
 * finance 1,67 млн > квоты): после перезагрузки визит «Пришёл», а оплаты нет. Теперь ключи пишутся упакованными
 * (src/mock/packJson.ts). Этот тест падает, если свежий сид снова вырастет так, что ВСЕ ключи разом займут больше
 * 80 % квоты, или если упаковка потеряет хоть что-то. Его гоняет общий прогон src/domain/rules/tests/run.mjs (и CI).
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { seedCore } from '@/mock/seed';
import { localizeDemo } from '@/mock/seed/demoLocale';
import { SLICES } from '@/mock/slices';
import { packJson, unpackJson } from '@/mock/packJson';

/** Chrome: 10 МиБ на источник, строки по 2 байта → 5 242 880 символов на все ключи вместе (замер 20.11.2026) */
const QUOTA = 5_242_880;
const LIMIT = Math.floor(QUOTA * 0.8);

function freshKeys(locale: 'ru' | 'en' | 'hy'): Map<string, unknown> {
  const now = new Date();
  const rawCore = seedCore(now);
  const rawAreas = Object.fromEntries(Object.entries(SLICES).map(([id, slice]) => [id, slice.seed(rawCore, now)]));
  const sources = [rawCore.services, rawCore.serviceCategories];
  const core = locale === 'ru' ? rawCore : localizeDemo(rawCore, locale, sources);
  const areas = locale === 'ru' ? rawAreas : localizeDemo(rawAreas, locale, sources);
  const keys = new Map<string, unknown>();
  for (const [k, v] of Object.entries(core)) keys.set(`bp-mock-db:core:${k}`, v);
  for (const [id, v] of Object.entries(areas)) keys.set(`bp-mock-db:area:${id}`, v);
  return keys;
}

describe('моковая база в localStorage', () => {
  const ru = freshKeys('ru');

  test('упаковка без потерь на всём свежем сиде', () => {
    for (const [key, value] of ru) {
      assert.deepStrictEqual(unpackJson(packJson(value)), JSON.parse(JSON.stringify(value)), key);
    }
  });

  for (const locale of ['ru', 'en', 'hy'] as const) {
    test(`свежий сид (${locale}) целиком — не больше 80 % квоты`, () => {
      const keys = locale === 'ru' ? ru : freshKeys(locale);
      const sizes = [...keys].map(([key, value]) => [key, key.length + packJson(value).length] as const).sort((a, b) => b[1] - a[1]);
      const total = sizes.reduce((sum, [, n]) => sum + n, 0);
      const top = sizes.slice(0, 5).map(([k, n]) => `${k} ${n}`).join(', ');
      assert.ok(total <= LIMIT, `все ключи вместе ${total} символов > ${LIMIT} (80 % от ${QUOTA}). Крупнее всего: ${top}`);
    });
  }

  test('крайние случаи упаковки', () => {
    const cases: unknown[] = [
      null,
      0,
      -5000,
      'строка',
      '\x7f*',
      '\x7f!x',
      '\x7f0',
      [],
      [{}],
      [{}, {}],
      [{ a: 1 }, { b: 2 }, { a: 3, b: undefined }, { a: null }],
      [{ a: '\x7f*' }, { a: '\x7f*' }, { a: '\x7f*' }],
      ['\x7f*', { a: 1 }, { a: 1 }],
      [[{ id: 'bk_1' }, { id: 'bk_1' }], [1, 'x', null, true]],
      { '2': 'b', '1': 'a', z: { y: [{ q: 'повтор' }, { q: 'повтор' }, { q: 'повтор' }] } },
      { ['__proto__']: { polluted: true }, ok: 1 },
      { when: new Date('2026-11-20T10:00:00Z'), list: [new Date(0), new Date(0)] },
    ];
    for (const value of cases) {
      const packed = packJson(value);
      assert.deepStrictEqual(unpackJson(packed), JSON.parse(JSON.stringify(value)), JSON.stringify(value));
    }
    assert.equal(({} as { polluted?: boolean }).polluted, undefined);
  });

  test('старые записи (обычный JSON) читаются', () => {
    const value = { bookings: [{ id: 'bk_1', status: 'arrived' }], n: 1 };
    assert.deepStrictEqual(unpackJson(JSON.stringify(value)), value);
  });
});
