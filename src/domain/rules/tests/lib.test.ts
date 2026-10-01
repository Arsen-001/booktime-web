import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { toCsv } from '@/lib/csv';
import { addDays, diffMinutes, nowDateTime, today } from '@/lib/date';

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
  test('CSV: кавычки для разделителя и переводов строки', () => {
    assert.equal(toCsv([['Анна; мл.', 5000, null]], ['Имя', 'Сумма', 'Заметка']), 'Имя;Сумма;Заметка\r\n"Анна; мл.";5000;');
    assert.equal(toCsv([['a"b', 'x\ny']]), '"a""b";"x\ny"');
  });
});
