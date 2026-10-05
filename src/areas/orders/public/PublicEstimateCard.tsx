'use client';

/**
 * ⭐ Смета на странице заказа /o/<code> (05.10.2026): клиент без входа видит, что и за сколько предлагают сделать, и
 * отвечает одной из двух больших кнопок — «Согласен» или «Отказаться» (отказ — с нашим подтверждением), при желании с
 * комментарием. Ответили — карточка показывает, что выбрано и что дальше. Мастерская обновила смету, пока страница
 * была открыта, — тост «посмотрите новую» и страница перечитывается.
 */
import { useState } from 'react';
import { MessageSquarePlus, ThumbsDown, ThumbsUp } from 'lucide-react';
import { decidePublicEstimate } from '@/api/orders-public';
import { ApiError, useApiMutation } from '@/api/request';
import type { EstimateDecision, PublicOrder, PublicOrderEstimate } from '@/domain/orders';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { Button } from '@/ui/Button';
import { Textarea } from '@/ui/Textarea';
import { useConfirm, useToast } from '@/ui/Toast';

export interface PublicEstimateCardProps {
  code: string;
  order: PublicOrder & { estimate: PublicOrderEstimate };
  /** Перечитать заказ (смету обновили или уже ответили с другого устройства) */
  onStale: () => void;
}

export function PublicEstimateCard({ code, order, onStale }: PublicEstimateCardProps) {
  const t = useT('orders');
  const fmt = useFormat();
  const toast = useToast();
  const confirm = useConfirm();
  const est = order.estimate;
  const decide = useApiMutation(decidePublicEstimate);
  const [commentOpen, setCommentOpen] = useState(false);
  const [comment, setComment] = useState('');
  const [choice, setChoice] = useState<EstimateDecision | null>(null);
  // Ответ возможен, пока вещь у мастера и не готова (как у сервера)
  const pending = est.status === 'pending' && (order.status === 'received' || order.status === 'in_progress');
  const when = (v: string) => `${fmt.relativeDayInline(v)}, ${fmt.time(v)}`;

  async function answer(decision: EstimateDecision) {
    if (decide.isPending) return;
    if (decision === 'decline') {
      const ok = await confirm({
        title: t('public.estimate.declineConfirm.title'),
        description: t('public.estimate.declineConfirm.text'),
        confirmLabel: t('public.estimate.declineConfirm.confirm'),
        cancelLabel: t('public.estimate.declineConfirm.keep'),
        tone: 'danger',
      });
      if (!ok) return;
    }
    setChoice(decision);
    try {
      await decide.mutate({ code, decision, version: est.version, comment: comment.trim() || null });
      toast.success(t(decision === 'approve' ? 'public.estimate.thanksApproved' : 'public.estimate.thanksDeclined'));
    } catch (err) {
      const errCode = err instanceof ApiError ? err.code : '';
      if (errCode === 'estimate_changed' || errCode === 'estimate_already_decided' || errCode === 'estimate_not_pending') {
        toast.error(t(errCode === 'estimate_changed' ? 'public.estimate.changed' : 'public.estimate.alreadyDecided'));
        onStale();
      } else {
        toast.error(t('public.estimate.failed'));
      }
    } finally {
      setChoice(null);
    }
  }

  return (
    <section
      data-f="orders-estimate-public"
      aria-labelledby="estimate-title"
      className={cn('rounded-2xl border bg-surface p-4 sm:p-6', pending ? 'border-primary shadow-sm' : 'border-border')}
    >
      <h2 id="estimate-title" className="text-[1.0625rem] font-bold text-fg">
        {t('public.estimate.title')}
      </h2>
      {pending && <p className="mt-1 text-base text-muted">{t(est.version > 1 ? 'public.estimate.introChanged' : 'public.estimate.intro')}</p>}

      <dl className="mt-3 flex flex-col divide-y divide-border">
        {est.lines.map((l, i) => (
          <div key={i} className="flex items-baseline justify-between gap-4 py-2.5 first:pt-0">
            <dt className="min-w-0 text-base text-fg">{l.title}</dt>
            <dd className="shrink-0 text-base text-fg tabular-nums">{fmt.money(l.price)}</dd>
          </div>
        ))}
        <div className={cn('flex items-baseline justify-between gap-4', est.lines.length ? 'pt-3' : '')}>
          <dt className="font-semibold text-fg">{t('public.estimate.total')}</dt>
          <dd className="text-2xl font-bold text-fg tabular-nums">{fmt.money(est.total)}</dd>
        </div>
      </dl>
      {order.prepaid > 0 && pending && <p className="mt-1 text-sm text-muted">{t('public.estimate.prepaid', { amount: fmt.money(order.prepaid) })}</p>}

      {est.comment && (
        <div className="mt-4 rounded-xl bg-surface-2 px-4 py-3">
          <p className="text-sm font-semibold text-muted">{t('public.estimate.ourComment')}</p>
          <p className="mt-0.5 text-base text-fg [overflow-wrap:anywhere]">{est.comment}</p>
        </div>
      )}

      {pending ? (
        <div data-f="orders-estimate-decision" className="mt-5 flex flex-col gap-3">
          {commentOpen ? (
            <Textarea
              aria-label={t('public.estimate.commentLabel')}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t('public.estimate.commentPlaceholder')}
              rows={2}
              maxLength={500}
              autoResize
            />
          ) : (
            <Button variant="ghost" className="self-start" leftIcon={<MessageSquarePlus aria-hidden />} onClick={() => setCommentOpen(true)}>
              {t('public.estimate.addComment')}
            </Button>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Button size="lg" fullWidth leftIcon={<ThumbsUp aria-hidden />} loading={choice === 'approve'} disabled={choice === 'decline'} onClick={() => void answer('approve')}>
              {t('public.estimate.approve')}
            </Button>
            <Button
              size="lg"
              variant="outline"
              fullWidth
              leftIcon={<ThumbsDown aria-hidden />}
              loading={choice === 'decline'}
              disabled={choice === 'approve'}
              onClick={() => void answer('decline')}
            >
              {t('public.estimate.decline')}
            </Button>
          </div>
        </div>
      ) : est.status !== 'pending' && est.decidedAt ? (
        <div
          role="status"
          className={cn('mt-5 flex items-start gap-3 rounded-xl px-4 py-3', est.status === 'approved' ? 'bg-success-soft text-success' : 'bg-surface-3 text-fg')}
        >
          {est.status === 'approved' ? <ThumbsUp aria-hidden className="mt-0.5 size-5 shrink-0" /> : <ThumbsDown aria-hidden className="mt-0.5 size-5 shrink-0" />}
          <div className="min-w-0">
            <p className="font-semibold">{t(est.status === 'approved' ? 'public.estimate.approved' : 'public.estimate.declined', { when: when(est.decidedAt) })}</p>
            {(order.status === 'received' || order.status === 'in_progress') && (
              <p className="mt-0.5 text-sm text-fg">{t(est.status === 'approved' ? 'public.estimate.approvedHint' : 'public.estimate.declinedHint')}</p>
            )}
            {est.clientComment && <p className="mt-1 text-sm text-fg [overflow-wrap:anywhere]">{t('public.estimate.yourComment', { text: est.clientComment })}</p>}
          </div>
        </div>
      ) : null}
    </section>
  );
}
