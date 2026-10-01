'use client';

import { useState } from 'react';
import { Copy, Wallet } from 'lucide-react';
import { markPrepaymentPaid } from '@/api/client';
import { useApiMutation } from '@/api/request';
import { clientKeys } from '@/areas/client/ui/clientKeys';
import { useClientFormat } from '@/areas/client/useClientFormat';
import type { Id, ISODateTime, Money } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { copyText } from '@/lib/clipboard';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { IconButton } from '@/ui/IconButton';
import { useToast } from '@/ui/Toast';

/**
 * Ручная предоплата по реквизитам мастера (F-00-097): сколько, куда (реквизиты из правила мастера, а не его телефон —
 * decision-c1 №5, e2e-q1 №7) с копированием, до какого времени держим, «Я оплатил».
 */
export function PrepaymentCard({
  bookingId,
  appUserId,
  amount,
  full,
  reported,
  requisites,
  deadline,
  noShowReason,
}: {
  bookingId: Id;
  appUserId: Id;
  amount: Money;
  /** Клиент выбрал «Всю сумму сразу» */
  full?: boolean;
  /** Уже нажал «Я оплатил» — мастер сверяет деньги, кнопки нет */
  reported?: boolean;
  requisites?: string;
  deadline?: ISODateTime;
  /** ⭐ Мастер просит предоплату, потому что клиент не пришёл `noShows` раз за `months` месяцев — объясняем спокойно */
  noShowReason?: { noShows: number; months: number };
}) {
  const t = useT('client');
  const fmt = useClientFormat();
  const toast = useToast();
  const pay = useApiMutation((id: Id) => markPrepaymentPaid(id, appUserId), {
    invalidates: [clientKeys.booking(bookingId, appUserId), clientKeys.myBookings(appUserId), clientKeys.upcoming(appUserId)],
  });
  const [sent, setSent] = useState(false);

  const copy = async () => {
    if (!requisites) return;
    if (await copyText(requisites)) toast.success(t('bookingDetail.requisitesCopied'));
    else toast.info(t('bookingDetail.copyManually'));
  };

  const markPaid = async () => {
    try {
      await pay.mutate(bookingId);
      setSent(true);
      toast.success(t('bookingDetail.paidSent'));
    } catch {
      toast.error(t('bookingDetail.actionFailed'));
    }
  };

  return (
    <Card data-f="F-00-097" padding="lg" className="flex flex-col gap-4 border-warning/30 bg-warning-soft/40">
      <div className="flex items-start gap-3">
        <Wallet aria-hidden className="mt-0.5 size-5 shrink-0 text-warning" />
        <div className="min-w-0">
          <p className="font-semibold text-fg">{t(full ? 'bookingDetail.prepaymentAmountFull' : 'bookingDetail.prepaymentAmount', { amount: fmt.money(amount) })}</p>
          {deadline && <p className="text-sm text-muted">{t('bookingDetail.prepaymentDeadline', { time: fmt.time(deadline) })}</p>}
          {noShowReason && (
            <p className="mt-1 text-sm text-muted" data-f="F-00-071">
              {t('book.prepayNoShowsWhy', { count: noShowReason.noShows, months: noShowReason.months })}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-border bg-surface py-1 pr-1 pl-3">
        <p className="min-w-0 flex-1 text-sm text-fg">
          {requisites ? t('bookingDetail.prepaymentRequisites', { requisites }) : t('bookingDetail.requisitesFromMaster')}
        </p>
        {requisites && <IconButton icon={<Copy aria-hidden />} label={t('bookingDetail.copyRequisites')} variant="ghost" onClick={() => void copy()} />}
      </div>
      {reported || sent ? (
        <p className="rounded-lg bg-surface px-3 py-2 text-sm font-medium text-fg">{t('bookingDetail.prepaymentWaitingMaster')}</p>
      ) : (
        <Button onClick={() => void markPaid()} loading={pay.isPending} fullWidth>
          {t('bookingDetail.prepaymentPaid')}
        </Button>
      )}
    </Card>
  );
}
