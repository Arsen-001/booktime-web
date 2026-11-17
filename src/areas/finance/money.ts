/**
 * Формат денежных сумм раздела «finance» (F-07-185): один формат на весь раздел, поверх общего
 * @/lib/money — просьба общего помощника с дробями пока не понадобилась (сумм с копейками в разделе нет,
 * все деньги — целые драмы). Разделу принадлежит только знак и подписи ± для операций.
 */
import type { OperationKind } from '@/domain/finance';
import { formatMoney } from '@/lib/money';

function isInflow(kind: OperationKind): boolean {
  return kind === 'income' || kind === 'transfer_in';
}

/** «+5 000 ֏» / «−5 000 ֏» — знак по виду операции (доход/приход перевода — плюс) */
export function formatSignedMoney(amount: number, kind: OperationKind): string {
  return `${isInflow(kind) ? '+' : '−'}${formatMoney(Math.abs(amount))}`;
}

/** То же числом — для выгрузок: 5000 / −5000 */
export function signedAmount(amount: number, kind: OperationKind): number {
  return isInflow(kind) ? Math.abs(amount) : -Math.abs(amount);
}
