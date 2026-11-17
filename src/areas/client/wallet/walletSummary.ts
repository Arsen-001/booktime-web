'use client';

import type { WalletPlace } from '@/api/client';
import type { useClientFormat } from '@/areas/client/useClientFormat';
import type { useT } from '@/i18n/useT';

/** Скидка карты числом: с сервера — полем, у старых данных — из текста «…: 5%» */
export function cardDiscount(card: WalletPlace['cards'][number]): { value: number; percent: boolean } | undefined {
  if (card.discountValue !== undefined) return { value: card.discountValue, percent: card.discountIsPercent !== false };
  const m = card.discountText?.match(/(\d+(?:[.,]\d+)?)\s*%/);
  return m ? { value: Number(m[1].replace(',', '.')), percent: true } : undefined;
}

/**
 * Коротко всё, что у клиента есть в салоне, — строка «Карт и абонементов» (владелец 17.11.2026, DESIGN.md №4):
 * «карта −5 % · абонемент 5/10», «счёт 3 000 ֏ · сертификат 10 000 ֏». Несколько одинаковых — одним словом с числом
 * («3 абонемента», «сертификаты 20 000 ֏»), счета — одной суммой; заявки — «ждёт подтверждения».
 */
export function walletSummary(p: WalletPlace, t: ReturnType<typeof useT<'client'>>, fmt: ReturnType<typeof useClientFormat>): string[] {
  const parts: string[] = [];
  for (const c of p.cards) {
    const d = cardDiscount(c);
    parts.push(d ? t('wallet.cardDiscount', { value: d.percent ? `${d.value} %` : fmt.money(d.value) }) : t('wallet.card'));
    if (c.balance > 0) parts.push(t('wallet.bonus', { amount: fmt.money(c.balance) }));
  }
  if (p.accounts.length) parts.push(t('wallet.account', { amount: fmt.money(p.accounts.reduce((sum, a) => sum + a.balance, 0)) }));
  const memberships = p.memberships.filter((m) => m.purchaseStatus !== 'pendingConfirmation');
  if (memberships.length === 1) {
    const m = memberships[0];
    parts.push(m.frozen ? t('wallet.membershipFrozen') : t('wallet.membership', { left: m.visitsLeft, total: m.visitsTotal }));
  } else if (memberships.length > 1) parts.push(t('wallet.memberships', { n: memberships.length }));
  const certificates = p.certificates.filter((c) => c.purchaseStatus !== 'pendingConfirmation');
  if (certificates.length === 1) parts.push(t('wallet.certificate', { amount: fmt.money(certificates[0].balance) }));
  else if (certificates.length > 1) parts.push(t('wallet.certificates', { amount: fmt.money(certificates.reduce((sum, c) => sum + c.balance, 0)) }));
  const pending = p.memberships.length - memberships.length + p.certificates.length - certificates.length;
  if (pending > 0) parts.push(t('wallet.pending', { n: pending }));
  return parts;
}
