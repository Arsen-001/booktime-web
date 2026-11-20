import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { ipAllowedBy, isValidIpRange, normalizeIp, salonAddressFor } from '@/domain/staff';

/**
 * «Вход только с IP салона» (F-10-091, ответ 22, 20.11.2026): мок решает так же, как сервер
 * (booktime-backend src/common/http/salon-ip.test.ts — те же примеры).
 */
describe('адреса салона (как сервер)', () => {
  test('адрес и сеть: точное совпадение, /24, /16, IPv6 /64, ::ffff:, ошибочные строки списка пропускаются', () => {
    const salon = ['37.252.64.10', '5.77.0.0/16', '2a00:cc0:1:2::/64', 'опечатка', '300.1.1.1'];
    assert.equal(ipAllowedBy(salon, '37.252.64.10'), true);
    assert.equal(ipAllowedBy(salon, '37.252.64.11'), false);
    assert.equal(ipAllowedBy(salon, '5.77.200.3'), true);
    assert.equal(ipAllowedBy(salon, '5.78.0.1'), false);
    assert.equal(ipAllowedBy(salon, '2a00:cc0:1:2:aaaa:bbbb:cccc:dddd'), true);
    assert.equal(ipAllowedBy(salon, '2a00:cc0:1:3::1'), false);
    assert.equal(ipAllowedBy(salon, '::ffff:37.252.64.10'), true);
    assert.equal(ipAllowedBy(['37.252.64.0/24'], '37.252.64.200'), true);
    assert.equal(ipAllowedBy(['37.252.64.0/20'], '37.252.79.1'), true, 'сеть не по целым байтам');
    assert.equal(ipAllowedBy(['37.252.64.0/20'], '37.252.80.1'), false);
    assert.equal(ipAllowedBy([], '37.252.64.10'), false, 'пустой список — закрыто для всех адресов');
    assert.equal(ipAllowedBy(salon, ''), false);
    assert.equal(isValidIpRange('37.252.64.0/24'), true);
    assert.equal(isValidIpRange('37.252.64.0/33'), false);
    assert.equal(isValidIpRange('2a00:cc0::/64'), true);
    assert.equal(isValidIpRange('37.252.64'), false);
    assert.equal(isValidIpRange('1.2.3.4/8/8'), false);
    assert.equal(isValidIpRange('2a00:cc0::1::2'), false);
    assert.equal(normalizeIp(' ::FFFF:1.2.3.4 '), '1.2.3.4');
  });

  test('«Добавить этот адрес»: IPv4 — сам адрес, IPv6 — его сеть /64', () => {
    assert.equal(salonAddressFor('37.252.64.10'), '37.252.64.10');
    assert.equal(salonAddressFor('2a00:cc0:1:2:a:b:c:d'), '2a00:cc0:1:2::/64');
    assert.equal(salonAddressFor('2A00:CC0:1::5'), '2a00:cc0:1:0::/64');
    assert.equal(salonAddressFor('::ffff:5.77.1.2'), '5.77.1.2');
    assert.equal(salonAddressFor('не адрес'), null);
    // Добавленная сеть пускает завтрашний адрес той же сети
    assert.equal(ipAllowedBy([salonAddressFor('2a00:cc0:1:2:a:b:c:d')!], '2a00:cc0:1:2:1:2:3:4'), true);
  });
});
