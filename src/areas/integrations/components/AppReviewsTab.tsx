'use client';

/** Вкладка «Отзывы» карточки приложения (F-13-011): список + форма после подключения */
import { useState } from 'react';
import { Star } from 'lucide-react';
import { addReview, listReviews } from '@/api/integrations';
import { useApiMutation, useApiQuery } from '@/api/request';
import type { Id } from '@/domain/core';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { Modal } from '@/ui/Modal';
import { Skeleton } from '@/ui/Skeleton';
import { usePagedList } from '@/ui/Pagination';
import { Textarea } from '@/ui/Textarea';
import { useToast } from '@/ui/Toast';

export function AppReviewsTab({ appId, businessId, installed }: { appId: Id; businessId?: Id; installed: boolean }) {
  const t = useT('integrations');
  const { date } = useFormat();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [text, setText] = useState('');

  const q = useApiQuery(['integrations', 'reviews', appId], () => listReviews(appId));
  const add = useApiMutation(() => addReview({ appId, businessId: businessId!, rating, text }));
  // Постранично, как во всех списках (DESIGN.md → Long lists)
  const { pageItems, pager } = usePagedList(q.data ?? []);

  const submit = async () => {
    try {
      await add.mutate(undefined);
      setOpen(false);
      setText('');
      setRating(5);
      toast.success(t('reviews.addedToast'));
    } catch {
      toast.error(t('errors.actionFailed'));
    }
  };

  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;

  return (
    <div data-f="F-13-011" className="flex flex-col gap-4">
      {installed && (
        <Button variant="secondary" onClick={() => setOpen(true)} className="self-start">
          {t('reviews.addCta')}
        </Button>
      )}

      {q.isLoading ? (
        <Skeleton lines={4} />
      ) : (q.data ?? []).length === 0 ? (
        <EmptyState icon={<Star aria-hidden />} title={t('reviews.emptyTitle')} description={t('reviews.emptyText')} compact />
      ) : (
        <ul className="flex flex-col gap-3">
          {pageItems.map((r) => (
            <Card as="li" key={r.id} padding="sm" className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-fg">{r.authorRole ? t(`reviews.author.${r.authorRole}`) : r.authorName}</p>
                <span className="flex items-center gap-1 text-sm text-warning">
                  <Star className="h-3.5 w-3.5 fill-warning" aria-hidden /> {r.rating}
                </span>
              </div>
              <p className="text-sm text-muted">{r.text}</p>
              <p className="text-xs text-muted">{date(r.createdAt, 'long')}</p>
            </Card>
          ))}
        </ul>
      )}
      {pager}

      <Modal
        open={open}
        onOpenChange={setOpen}
        title={t('reviews.modalTitle')}
        footer={
          <Button fullWidth loading={add.isPending} disabled={!text.trim()} onClick={submit}>
            {t('reviews.submit')}
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-1" role="radiogroup" aria-label={t('reviews.ratingLabel')}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={rating === n}
                aria-label={t('reviews.ratingStars', { n })}
                onClick={() => setRating(n)}
                className="flex h-11 w-11 items-center justify-center"
              >
                <Star className={n <= rating ? 'h-6 w-6 fill-warning text-warning' : 'h-6 w-6 text-border-strong'} aria-hidden />
              </button>
            ))}
          </div>
          <Textarea placeholder={t('reviews.textPlaceholder')} value={text} onChange={(e) => setText(e.target.value)} rows={4} autoResize />
        </div>
      </Modal>
    </div>
  );
}
