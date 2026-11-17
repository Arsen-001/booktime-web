import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { assistedMasterIds, computeServicesForDay, emptyScheme, type AssistantShare, type PayrollScheme } from '@/domain/payroll';
import { DAY, NOW, makeBooking, makeService } from '@/domain/rules/tests/fixture';

// F-09-046/047 — доля ассистента. ТЕ ЖЕ числа, что тест сервера payroll-assist.test.ts (booktime-backend): мок и сервер
// считают одним правилом. Мариам — маникюр 10 000, ставки «без ассистента» 50 %, «как ассистент» 10 %; Ани ассистирует.
function mariamScheme(): PayrollScheme {
  const s = emptyScheme('st_mariam', NOW);
  s.personalServices.enabled = true;
  s.personalServices.defaultPayout = { unit: 'percent', value: 30 };
  s.personalServices.assistRates = { withoutAssistant: { unit: 'percent', value: 50 }, asAssistant: { unit: 'percent', value: 10 } };
  return s;
}

const line = { serviceId: 'sv_mani', staffId: 'st_mariam', price: 10000, durationMin: 60, qty: 1 };
const assisted = makeBooking({ id: 'bk_assist', staffId: 'st_mariam', status: 'arrived', start: `${DAY}T10:00`, total: 10000, services: [line] });
const alone = makeBooking({ id: 'bk_alone', staffId: 'st_mariam', status: 'arrived', start: `${DAY}T12:00`, total: 10000, services: [line] });
const assistants: Record<string, AssistantShare[]> = { 'bk_assist:0': [{ staffId: 'st_ani', sharePct: 100 }] };
const assistantsForLine = (bookingId: string, i: number) => assistants[`${bookingId}:${i}`] ?? [];

function dayOps(staffIds: string[], schemes: Map<string, PayrollScheme>) {
  return computeServicesForDay({
    date: DAY,
    locationId: 'loc_1',
    staffIds,
    bookings: [assisted, alone],
    services: [makeService({ id: 'sv_mani', priceMin: 10000 })],
    schemes,
    assistantsForLine,
  });
}

describe('доля ассистента (F-09-047)', () => {
  test('Мариам: с ассистентом 5 000 − 1 000 = 4 000, без ассистента — своя ставка 30 % = 3 000; Ани — 1 000', () => {
    const ops = dayOps(['st_mariam', 'st_ani'], new Map([['st_mariam', mariamScheme()]]));
    assert.deepEqual(ops.get('st_mariam')?.map((o) => [o.bookingId, o.amount]), [['bk_assist', 4000], ['bk_alone', 3000]]);
    assert.deepEqual(ops.get('st_ani')?.map((o) => [o.bookingId, o.amount, o.lines[0]?.refId]), [['bk_assist', 1000, 'assist:sv_mani']]);
  });

  test('ведомость Ани (только она) — доля есть, когда в схемах есть схема мастера строки', () => {
    const masters = assistedMasterIds([assisted, alone], ['st_ani'], assistantsForLine);
    assert.deepEqual(masters, ['st_mariam']);
    const ops = dayOps(['st_ani'], new Map([['st_mariam', mariamScheme()]]));
    assert.equal(ops.get('st_ani')?.reduce((s, o) => s + o.amount, 0), 1000);
    // Без схемы мастера (как было в ведомости ассистента) — доли нет
    assert.equal(dayOps(['st_ani'], new Map()).get('st_ani')?.length ?? 0, 0);
  });
});
