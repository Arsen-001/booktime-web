import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  makeReferralCode,
  normalizeReferralCode,
  priorBookingsOf,
  referralDenied,
  referralInvitePath,
  referralInviteeStatus,
  referralPublicName,
} from '@/domain/rules/referral';
import { telegramShareUrl, whatsAppShareUrl } from '@/lib/share';

const A = { id: 'cl_a', phone: '+37400100001', appUserId: 'au_a' };
const B = { id: 'cl_b', phone: '+37400100002' };

describe('referral', () => {
  test('код: 6 знаков без похожих, нормализация из ссылки', () => {
    const code = makeReferralCode(() => 0.5);
    assert.equal(code.length, 6);
    assert.equal(normalizeReferralCode(code.toLowerCase()), code);
    assert.equal(normalizeReferralCode('ab-cd 23'), 'ABCD23');
    assert.equal(normalizeReferralCode('ABC0D1'), undefined); // 0 и 1 в алфавит не входят
    assert.equal(normalizeReferralCode('ABC'), undefined);
    assert.equal(normalizeReferralCode(null), undefined);
  });
  test('ссылка и «поделиться»', () => {
    assert.equal(referralInvitePath('nuri-nails', 'ABCD23'), '/b/nuri-nails?ref=ABCD23');
    assert.equal(whatsAppShareUrl('Привет https://x.am'), 'https://wa.me/?text=%D0%9F%D1%80%D0%B8%D0%B2%D0%B5%D1%82%20https%3A%2F%2Fx.am');
    assert.match(telegramShareUrl('https://x.am/b/n?ref=A', 'Привет'), /^https:\/\/t\.me\/share\/url\?url=https%3A%2F%2Fx\.am%2Fb%2Fn%3Fref%3DA&text=/);
  });
  test('привязка: только новому, один раз, не себе', () => {
    assert.equal(referralDenied({ programActive: true, referrer: A, invitee: B, priorBookings: 0 }), null);
    assert.equal(referralDenied({ programActive: false, referrer: A, invitee: B, priorBookings: 0 }), 'inactive');
    assert.equal(referralDenied({ programActive: true, invitee: B, priorBookings: 0 }), 'unknown_code');
    assert.equal(referralDenied({ programActive: true, referrer: A, invitee: A, priorBookings: 0 }), 'self');
    assert.equal(referralDenied({ programActive: true, referrer: A, invitee: { ...B, phone: A.phone }, priorBookings: 0 }), 'self');
    assert.equal(referralDenied({ programActive: true, referrer: A, invitee: { ...B, appUserId: 'au_a' }, priorBookings: 0 }), 'self');
    assert.equal(referralDenied({ programActive: true, referrer: A, invitee: { ...B, referredByClientId: 'cl_x' }, priorBookings: 0 }), 'already_referred');
    assert.equal(referralDenied({ programActive: true, referrer: A, invitee: B, priorBookings: 1 }), 'not_new');
    assert.equal(referralDenied({ programActive: true, referrer: { ...A, deletedAt: '2026-09-01T10:00' }, invitee: B, priorBookings: 0 }), 'unknown_code');
  });
  test('«новый» — без неотменённых записей, кроме текущей', () => {
    const bookings = [
      { id: 'bk1', clientId: 'cl_b', status: 'cancelled_by_client' as const },
      { id: 'bk2', clientId: 'cl_b', status: 'scheduled' as const },
      { id: 'bk3', clientId: 'cl_b', status: 'arrived' as const, deletedAt: '2026-09-01T10:00' },
    ];
    assert.equal(priorBookingsOf(bookings, 'cl_b', 'bk2'), 0);
    assert.equal(priorBookingsOf(bookings, 'cl_b'), 1);
  });
  test('статус приглашённой и имя для чужих глаз', () => {
    assert.equal(referralInviteeStatus([{ clientId: 'cl_b', status: 'scheduled' }], 'cl_b', false), 'booked');
    assert.equal(referralInviteeStatus([{ clientId: 'cl_b', status: 'arrived' }], 'cl_b', false), 'visited');
    assert.equal(referralInviteeStatus([{ clientId: 'cl_b', status: 'arrived' }], 'cl_b', true), 'rewarded');
    assert.equal(referralInviteeStatus([{ clientId: 'cl_b', status: 'cancelled_by_client' }], 'cl_b', false), 'cancelled');
    assert.equal(referralPublicName('Анна Карапетян'), 'Анна К.');
    assert.equal(referralPublicName('Лала'), 'Лала');
  });
});
