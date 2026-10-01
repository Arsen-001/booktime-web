'use client';

/** Строка «Ждут отметки»: клиент, время, сумма визита и «Пришёл» / «Не пришёл» (F-00-127) */
import { useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { markVisitArrived, markVisitNoShow } from '@/api/clients';
import { useApiMutation } from '@/api/request';
import type { PendingMark } from '@/domain/clients';
import type { Id } from '@/domain/core';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { MoneyInput } from '@/ui/MoneyInput';
import { SkeletonText } from '@/ui/Skeleton';
import { useToast } from '@/ui/Toast';

export function PendingMarkRow({ mark }: { mark: PendingMark }) {
  const t = useT('clients');
  const fmt = useFormat();
  const toast = useToast();
  const [amount, setAmount] = useState<number | undefined>(mark.total);
  const arrived = useApiMutation((args: { bookingId: Id; amount: number }) => markVisitArrived(args.bookingId, args.amount));
  const noShow = useApiMutation(markVisitNoShow);
  const run = async (kind: 'arrived' | 'noShow') => {
    try {
      if (kind === 'arrived') await arrived.mutate({ bookingId: mark.bookingId, amount: amount ?? mark.total });
      else await noShow.mutate(mark.bookingId);
      toast.success(kind === 'arrived' ? t('summary.markedArrived') : t('summary.markedNoShow'));
    } catch {
      toast.error(t('summary.markFailed'));
    }
  };
  return (
    <li className="flex flex-col gap-3 rounded-xl border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="truncate text-base font-semibold text-fg">{mark.clientName}</p>
        <p className="truncate text-sm text-muted">
          {fmt.dateTime(mark.start)} · {mark.staffName}
        </p>
      </div>
      <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2 sm:flex">
        <div className="sm:w-32">
          <MoneyInput value={amount} onValueChange={setAmount} aria-label={t('summary.amount')} />
        </div>
        <Button size="sm" leftIcon={<CheckCircle2 aria-hidden />} loading={arrived.isPending} onClick={() => run('arrived')}>
          {t('summary.markArrived')}
        </Button>
        <Button size="sm" variant="outline" leftIcon={<XCircle aria-hidden />} loading={noShow.isPending} onClick={() => run('noShow')}>
          {t('summary.markNoShow')}
        </Button>
      </div>
    </li>
  );
}

/** Строка «Ждут отметки» до загрузки — та же разметка: имя, время · мастер, поле суммы и обе кнопки (неактивные) */
export function PendingMarkRowSkeleton() {
  const t = useT('clients');
  return (
    <li className="flex flex-col gap-3 rounded-xl border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="truncate text-base font-semibold text-fg">
          <SkeletonText width="16ch" />
        </p>
        <p className="truncate text-sm text-muted">
          <SkeletonText width="24ch" />
        </p>
      </div>
      <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2 sm:flex">
        <div className="sm:w-32">
          <MoneyInput value={undefined} onValueChange={() => {}} disabled aria-label={t('summary.amount')} />
        </div>
        <Button size="sm" disabled leftIcon={<CheckCircle2 aria-hidden />}>
          {t('summary.markArrived')}
        </Button>
        <Button size="sm" variant="outline" disabled leftIcon={<XCircle aria-hidden />}>
          {t('summary.markNoShow')}
        </Button>
      </div>
    </li>
  );
}
