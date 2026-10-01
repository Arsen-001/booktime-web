import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { dayCloseFingerprint, dayCloseInboxId, dayMoneyOf, upsertDayCloseNotice, type DayCloseNotice } from '@/domain/journalWorkday';

describe('⭐ «День закрыт» владельцу: снимок итога дня и дедупликация', () => {
  const base = { closedBy: 'st_admin', revenue: 282500, cash: 67500, discrepancy: -500 };
  const notice = (over: Partial<DayCloseNotice> = {}): DayCloseNotice => {
    const n = { businessId: 'b1', date: '2026-10-01', at: '2026-10-01T20:26', closedByName: 'Лилит', recipientStaffIds: ['st_owner'], ...base, ...over };
    return { ...n, fingerprint: dayCloseFingerprint(n), ...over } as DayCloseNotice;
  };

  test('повторное закрытие с теми же цифрами — без изменений, тот же id строки', () => {
    const first = upsertDayCloseNotice([], notice());
    assert.equal(first.changed, true);
    const again = upsertDayCloseNotice(first.list, notice({ at: '2026-10-01T21:10' }));
    assert.equal(again.changed, false);
    assert.equal(again.list.length, 1);
    assert.equal(again.list[0].at, '2026-10-01T20:26');
  });

  test('другие цифры в тот же день — снимок заменяется, id строки новый (снова «не прочитано»)', () => {
    const first = upsertDayCloseNotice([], notice()).list;
    const next = notice({ discrepancy: 0, at: '2026-10-01T21:10' });
    const r = upsertDayCloseNotice(first, next);
    assert.equal(r.changed, true);
    assert.equal(r.list.length, 1);
    assert.notEqual(dayCloseInboxId(first[0], 'st_owner'), dayCloseInboxId(r.list[0], 'st_owner'));
  });

  test('id строки свой у каждого владельца и не длиннее 32 символов', () => {
    const n = notice();
    const a = dayCloseInboxId(n, 'st_owner');
    const b = dayCloseInboxId(n, 'st_owner2');
    assert.notEqual(a, b);
    assert.ok(a.length <= 32 && a.startsWith('dc_20261001_'));
  });

  test('разные дни и бизнесы живут отдельно, хранится не больше keep дней на бизнес', () => {
    let list: DayCloseNotice[] = [];
    for (let d = 1; d <= 5; d += 1) list = upsertDayCloseNotice(list, notice({ date: `2026-10-0${d}`, at: `2026-10-0${d}T20:00` }), 3).list;
    list = upsertDayCloseNotice(list, notice({ businessId: 'b2' }), 3).list;
    assert.deepEqual(list.filter((n) => n.businessId === 'b1').map((n) => n.date), ['2026-10-05', '2026-10-04', '2026-10-03']);
    assert.equal(list.filter((n) => n.businessId === 'b2').length, 1);
  });

  test('деньги дня: приход по способам, возвраты, расходы; поправки смены и чужие кассы не считаются', () => {
    const ops = [
      { id: 'o1', accountId: 'cash', kind: 'income', amount: 5000, method: 'cash', date: '2026-10-01T10:00' },
      { id: 'o2', accountId: 'card', kind: 'income', amount: 7000, method: 'card', date: '2026-10-01T11:00' },
      { id: 'o3', accountId: 'cash', kind: 'expense', amount: 500, method: 'cash', date: '2026-10-01T20:26' },
      { id: 'o4', accountId: 'cash', kind: 'expense', amount: 1000, method: 'cash', itemId: 'refund', date: '2026-10-01T12:00' },
      { id: 'o5', accountId: 'cash', kind: 'income', amount: 9999, method: 'cash', date: '2026-09-30T12:00' },
      { id: 'o6', accountId: 'alien', kind: 'income', amount: 9999, method: 'cash', date: '2026-10-01T12:00' },
      { id: 'o7', accountId: 'cash', kind: 'income', amount: 9999, method: 'cash', date: '2026-10-01T12:00', cancelled: true },
    ];
    const m = dayMoneyOf(ops, { date: '2026-10-01', accountIds: new Set(['cash', 'card']), refundItemId: 'refund', adjustmentIds: new Set(['o3']) });
    assert.deepEqual(m, { cash: 5000, card: 7000, transfer: 0, other: 0, refunds: 1000, expense: 0 });
  });
});
