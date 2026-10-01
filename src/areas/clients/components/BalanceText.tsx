'use client';

/**
 * Баланс клиента словом, а не только цветом и минусом (ux-best-c1 №2, ux-r1 №19): «Долг 10 000 ֏» / «Аванс 4 000 ֏» / «0 ֏».
 * Одинаково в списке, карточке и окне записи.
 */
import { AlertCircle, Wallet } from 'lucide-react';
import { balanceKind, type BalanceKind } from '@/domain/clients';
import type { Money } from '@/domain/core';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { Badge, type BadgeTone } from '@/ui/Badge';

const TEXT_TONE: Record<BalanceKind, string> = {
  debt: 'text-danger',
  advance: 'text-success',
  zero: 'text-muted',
};

const BADGE_TONE: Record<BalanceKind, BadgeTone> = {
  debt: 'danger',
  advance: 'success',
  zero: 'neutral',
};

export interface BalanceTextProps {
  balance: Money;
  /** badge — пилюлей с иконкой (строка клиента на телефоне, шапка карточки); text — числом в таблице */
  as?: 'text' | 'badge';
  /** Ноль не показывать вовсе (строка на телефоне, окно записи) */
  hideZero?: boolean;
  className?: string;
}

export function BalanceText({ balance, as = 'text', hideZero = false, className }: BalanceTextProps) {
  const t = useT('clients');
  const fmt = useFormat();
  const kind = balanceKind(balance);
  if (kind === 'zero' && hideZero) return null;
  const label = t(`balance.${kind}`, { amount: fmt.money(Math.abs(balance)) });
  if (as === 'badge') {
    return (
      <Badge
        tone={BADGE_TONE[kind]}
        icon={kind === 'debt' ? <AlertCircle aria-hidden /> : kind === 'advance' ? <Wallet aria-hidden /> : undefined}
        className={className}
      >
        {label}
      </Badge>
    );
  }
  return <span className={cn('whitespace-nowrap tabular-nums', TEXT_TONE[kind], className)}>{label}</span>;
}
