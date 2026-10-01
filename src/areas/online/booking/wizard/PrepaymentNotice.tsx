'use client';

import { CreditCard } from 'lucide-react';
import type { PrepaymentRule } from '@/domain/core';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { ChoiceGroup } from '@/ui/ChoiceGroup';

/** Предоплата визита: часть (процент или сумма мастера) и, если цена точная, «вся сумма сразу» */
export interface WizardPrepayment {
  amount: number;
  /** Вся сумма частей визита, где берут предоплату; нет — «всё сразу» не предлагаем (цена «от–до» или 100%) */
  full?: number;
  rule: PrepaymentRule;
}

/**
 * О5: про предоплату клиент узнаёт ДО записи — сумма, куда платить и сколько времени будет на оплату после
 * «Записаться». Жёлтый блок над кнопкой, чтобы человек на ходу не получил сюрприз «15 минут на перевод».
 * ⭐ Мастер ставит процент — клиент выбирает: только предоплату или всю сумму сразу.
 */
export function PrepaymentNotice({
  prepayment,
  payInFull,
  onPayInFullChange,
}: {
  prepayment: WizardPrepayment;
  payInFull: boolean;
  onPayInFullChange: (v: boolean) => void;
}) {
  const t = useT('online');
  const format = useFormat();
  const { amount, full, rule } = prepayment;
  const toPay = payInFull && full ? full : amount;
  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-warning/40 bg-warning-soft p-3" data-f="F-03-094 F-00-097" role="note">
      <p className="inline-flex items-center gap-2 text-sm font-semibold text-fg">
        <CreditCard aria-hidden className="size-4 shrink-0" />
        {full
          ? rule.percent
            ? t('booking.details.prepay.choiceTitlePercent', { percent: rule.percent })
            : t('booking.details.prepay.choiceTitle')
          : t('booking.details.prepay.title', { amount: format.money(amount) })}
      </p>
      {full && (
        <ChoiceGroup
          aria-label={t('booking.details.prepay.choiceTitle')}
          value={payInFull ? 'full' : 'part'}
          onValueChange={(v) => onPayInFullChange(v === 'full')}
          options={[
            {
              value: 'part',
              title: t('booking.details.prepay.partTitle', { amount: format.money(amount) }),
              description: t('booking.details.prepay.partHint', { rest: format.money(full - amount) }),
            },
            {
              value: 'full',
              title: t('booking.details.prepay.fullTitle', { amount: format.money(full) }),
              description: t('booking.details.prepay.fullHint'),
            },
          ]}
        />
      )}
      <p className="text-sm text-fg">{t('booking.details.prepay.where', { requisites: rule.requisites })}</p>
      <p className="text-sm text-muted">
        {full ? t('booking.details.prepay.timerAmount', { amount: format.money(toPay), minutes: rule.timeoutMin }) : t('booking.details.prepay.timer', { minutes: rule.timeoutMin })}
      </p>
    </div>
  );
}
