/**
 * Формат денежных сумм раздела «finance» (F-07-185): один формат на весь раздел, поверх общего
 * @/lib/money — просьба общего помощника с дробями пока не понадобилась (сумм с копейками в разделе нет,
 * все деньги — целые драмы). Разделу принадлежит только знак и подписи ± для операций.
 */
import type { OperationKind } from '@/domain/finance';
import { formatMoney } from '@/lib/money';

/** «+5 000 ֏» / «−5 000 ֏» — знак по виду операции (доход/приход перевода — плюс) */
export function formatSignedMoney(amount: number, kind: OperationKind): string {
  const sign = kind === 'income' || kind === 'transfer_in' ? '+' : '−';
  return `${sign}${formatMoney(Math.abs(amount))}`;
}
