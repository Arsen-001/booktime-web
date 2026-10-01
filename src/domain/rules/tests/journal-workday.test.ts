import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { ageOn, isBirthdayOn, isClosableVisit, unclosedReason } from '@/domain/journalWorkday';

describe('рабочий день журнала: незакрытые визиты, дни рождения', () => {
  const b = { start: '2026-10-01T10:00', durationMin: 60 } as const;
  test('прошедшая запись без отметки — «приход не отмечен», ещё идущая — нет', () => {
    assert.equal(unclosedReason({ ...b, status: 'scheduled' }, 0, '2026-10-01T11:00'), 'arrival');
    assert.equal(unclosedReason({ ...b, status: 'client_confirmed' }, 5000, '2026-10-01T10:59'), null);
  });
  test('«Пришёл» с остатком — «не оплачено»; оплачен, «не пришёл», отменён, удалён — закрыт', () => {
    assert.equal(unclosedReason({ ...b, status: 'arrived' }, 3000, '2026-10-01T12:00'), 'payment');
    assert.equal(unclosedReason({ ...b, status: 'arrived' }, 0, '2026-10-01T12:00'), null);
    assert.equal(unclosedReason({ ...b, status: 'no_show' }, 3000, '2026-10-01T12:00'), null);
    assert.equal(unclosedReason({ ...b, status: 'cancelled_by_client' }, 0, '2026-10-01T12:00'), null);
    assert.equal(unclosedReason({ ...b, status: 'scheduled', deletedAt: '2026-10-01T09:00' }, 0, '2026-10-01T12:00'), null);
  });
  test('запись-блок без клиента и суммы закрывать нечего', () => {
    assert.equal(isClosableVisit({ total: 0 }), false);
    assert.equal(isClosableVisit({ total: 0, visitorName: 'Гость' }), true);
    assert.equal(isClosableVisit({ total: 5000 }), true);
  });
  test('день рождения: 29 февраля в невисокосный год — 28-го; возраст', () => {
    assert.equal(isBirthdayOn('1990-10-01', '2026-10-01'), true);
    assert.equal(isBirthdayOn('1992-02-29', '2027-02-28'), true);
    assert.equal(isBirthdayOn('1992-02-29', '2028-02-28'), false);
    assert.equal(isBirthdayOn(undefined, '2026-10-01'), false);
    assert.equal(ageOn('1990-10-01', '2026-10-01'), 36);
    assert.equal(ageOn('1990-10-02', '2026-10-01'), 35);
  });
});
