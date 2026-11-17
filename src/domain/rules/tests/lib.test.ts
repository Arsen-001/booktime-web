import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { toCsv } from '@/lib/csv';
import { addDays, diffMinutes, isLaterTime, nowDateTime, today } from '@/lib/date';

describe('lib', () => {
  test('addDays через границу месяца и назад', () => {
    assert.equal(addDays('2026-09-30', 1), '2026-10-01');
    assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  });
  test('«сейчас» по Еревану — в формате данных', () => {
    assert.match(nowDateTime(), /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    assert.equal(today(), nowDateTime().slice(0, 10));
    assert.equal(diffMinutes('2026-09-30T23:30', '2026-10-01T01:00'), 90);
  });
  test('isLaterTime: местное время Еревана против мгновения с сервера (ведомость, 17.11)', () => {
    // Ведомость начислена в 02:19Z = 06:19 по Еревану; визит правили в 03:23 по Еревану — ДО начисления
    assert.equal(isLaterTime('2026-11-17T03:23', '2026-11-17T02:19:05.064Z'), false);
    assert.equal(isLaterTime('2026-11-17T06:30', '2026-11-17T02:19:05.064Z'), true);
    assert.equal(isLaterTime('2026-11-17T13:40:04.151Z', '2026-11-17T12:23:40.645Z'), true);
    assert.equal(isLaterTime('2026-11-17T10:00', '2026-11-17T09:59'), true);
    assert.equal(isLaterTime(undefined, '2026-11-17T09:59'), false);
  });
  test('CSV: кавычки для разделителя и переводов строки', () => {
    assert.equal(toCsv([['Анна; мл.', 5000, null]], ['Имя', 'Сумма', 'Заметка']), 'Имя;Сумма;Заметка\r\n"Анна; мл.";5000;');
    assert.equal(toCsv([['a"b', 'x\ny']]), '"a""b";"x\ny"');
  });
});
