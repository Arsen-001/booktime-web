'use client';

/**
 * ⭐ Смета в заказе (05.10.2026). Нет сметы — одна фраза зачем и «Составить смету». Есть — состояние словом и значком
 * («Ждём согласия клиента» / «Клиент согласен» / «Клиент отказался»), строки и итог, комментарий мастера и клиента,
 * когда отправили, напомнили или ответили. Действия: «Отправить ещё раз» (пока ждём), «Изменить смету» / «Новая смета»,
 * в «⋯» — ответ, полученный по телефону.
 */
import { useState } from 'react';
import { MoreHorizontal, Pencil, Send, ThumbsDown, ThumbsUp } from 'lucide-react';
import { canSendEstimate, type Order } from '@/domain/orders';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { addDays } from '@/lib/date';
import { useEstimateActions } from '@/areas/orders/detail/useEstimateActions';
import { EstimateBadge } from '@/areas/orders/ui/EstimateBadge';
import { EstimateSheet } from '@/areas/orders/detail/EstimateSheet';
import { Button } from '@/ui/Button';
import { DropdownMenu, type DropdownMenuItem } from '@/ui/DropdownMenu';
import { ExitHold } from '@/ui/ExitHold';
import { IconButton } from '@/ui/IconButton';
import { SectionCard } from '@/ui/SectionCard';

export function EstimateCard({ order }: { order: Order }) {
  const t = useT('orders');
  const fmt = useFormat();
  const actions = useEstimateActions(order);
  const [editing, setEditing] = useState(false);
  const est = order.estimate ?? null;
  const open = canSendEstimate(order.status);
  if (!est && !open) return null;

  const when = (v: string) => `${fmt.relativeDay(v).toLocaleLowerCase()}, ${fmt.time(v)}`;
  const pending = est?.status === 'pending' && open;
  const remindAt = pending && est.sentAt && !est.remindedAt ? `${addDays(est.sentAt.slice(0, 10), 1)}T${est.sentAt.slice(11, 16)}` : null;

  const menu: DropdownMenuItem[] = pending
    ? [
        { id: 'edit', label: t('estimate.edit'), icon: <Pencil aria-hidden />, onSelect: () => setEditing(true) },
        { id: 'sep', separator: true as const },
        { id: 'approve', label: t('estimate.phoneApprove'), icon: <ThumbsUp aria-hidden />, onSelect: () => void actions.decide('approve') },
        { id: 'decline', label: t('estimate.phoneDecline'), icon: <ThumbsDown aria-hidden />, danger: true, onSelect: () => void actions.decide('decline') },
      ]
    : [];

  // «⋯» — рядом с «Отправить ещё раз», а не в шапке: на телефоне шапка переносила его под заголовок
  const moreMenu = (
    <DropdownMenu
      label={t('estimate.more')}
      items={menu}
      trigger={(p) => <IconButton {...p} icon={<MoreHorizontal aria-hidden />} label={t('estimate.more')} variant="outline" />}
    />
  );

  return (
    <SectionCard title={t('estimate.title')}>
      <div data-f="orders-estimate" className="flex flex-col gap-4">
        {!est ? (
          <>
            <p className="text-base text-muted">{t('estimate.hintNone')}</p>
            <Button variant="secondary" className="self-start" leftIcon={<Send aria-hidden />} onClick={() => setEditing(true)}>
              {t('estimate.create')}
            </Button>
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <EstimateBadge status={est.status} />
              {est.sentAt && <span className="text-sm text-muted">{t('estimate.sentAt', { when: when(est.sentAt) })}</span>}
            </div>

            <dl className="flex flex-col divide-y divide-border">
              {est.lines.map((l, i) => (
                <div key={i} className="flex items-baseline justify-between gap-4 py-2.5 first:pt-0">
                  <dt className="min-w-0 text-base text-fg">{l.title}</dt>
                  <dd className="shrink-0 text-base text-fg tabular-nums">{fmt.money(l.price)}</dd>
                </div>
              ))}
              <div className="flex items-baseline justify-between gap-4 pt-3">
                <dt className="font-semibold text-fg">{t('estimate.total')}</dt>
                <dd className="text-2xl font-bold text-fg tabular-nums">{fmt.money(est.total)}</dd>
              </div>
            </dl>

            {est.comment && <p className="rounded-xl bg-surface-2 px-4 py-3 text-base text-fg [overflow-wrap:anywhere]">{est.comment}</p>}

            <div className="flex flex-col gap-1 text-sm text-muted">
              {est.decidedAt && <p>{t(est.decidedBy === 'staff' ? 'estimate.decidedStaff' : 'estimate.decidedClient', { when: when(est.decidedAt) })}</p>}
              {est.clientComment && <p className="text-base text-fg [overflow-wrap:anywhere]">{t('estimate.clientComment', { text: est.clientComment })}</p>}
              {pending && est.remindedAt && <p>{t('estimate.remindedAt', { when: when(est.remindedAt) })}</p>}
              {remindAt && <p>{t('estimate.remindNext', { when: when(remindAt) })}</p>}
              {est.status === 'approved' && open && <p>{t('estimate.approvedHint')}</p>}
              {est.status === 'declined' && open && <p className="font-semibold text-fg">{t('estimate.declinedHint')}</p>}
            </div>

            {open && (
              <div className="flex flex-wrap gap-2">
                {pending ? (
                  <>
                    <Button variant="outline" leftIcon={<Send aria-hidden />} loading={actions.resending} onClick={() => void actions.resend()}>
                      {t('estimate.resend')}
                    </Button>
                    {moreMenu}
                  </>
                ) : (
                  <Button variant="secondary" leftIcon={<Pencil aria-hidden />} onClick={() => setEditing(true)}>
                    {t('estimate.newEstimate')}
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </div>
      <ExitHold value={editing ? order : null}>{(o: Order) => <EstimateSheet order={o} onClose={() => setEditing(false)} />}</ExitHold>
    </SectionCard>
  );
}
