'use client';

import { useState, type FormEvent } from 'react';
import { MessageSquareText } from 'lucide-react';
import { getMyLocationReview, submitLocationReview } from '@/api/client';
import { useApiMutation, useApiQuery } from '@/api/request';
import type { Id } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { FormField } from '@/ui/FormField';
import { Textarea } from '@/ui/Textarea';
import { useToast } from '@/ui/Toast';

const MAX = 500;

/**
 * Отзыв о месте после визита (F-14-014) — у бизнеса с отзывами «оценка + текст» (В-24). Один на визит, можно поправить;
 * виден на карточке места. Сохраняется кнопкой, пустой — подсказка под полем, а не молчание.
 */
export function LocationReviewForm({ appUserId, businessId, bookingId }: { appUserId: Id; businessId: Id; bookingId: Id }) {
  const t = useT('client');
  const toast = useToast();
  const key = ['client', 'myLocationReview', appUserId, bookingId] as const;
  const q = useApiQuery(key, () => getMyLocationReview(appUserId, bookingId));
  const submit = useApiMutation(submitLocationReview, { invalidates: [key, ['location-reviews', businessId]] });
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | undefined>(undefined);

  if (q.isLoading) return <Card padding="md" className="h-40 skeleton-shimmer" data-skeleton />;
  const saved = q.data;
  const editing = draft !== null || !saved;
  const value = draft ?? saved?.text ?? '';

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!value.trim()) {
      setError(t('bookingDetail.placeReviewEmpty'));
      return;
    }
    try {
      await submit.mutate({ appUserId, businessId, bookingId, text: value });
      setDraft(null);
      toast.success(t('bookingDetail.placeReviewSaved'));
    } catch {
      toast.error(t('bookingDetail.actionFailed'));
    }
  };

  return (
    <Card data-f="F-14-014" padding="md" className="flex flex-col gap-3">
      <p className="flex items-center gap-2 font-medium text-fg">
        <MessageSquareText aria-hidden className="size-5 text-muted" />
        {t('bookingDetail.placeReviewTitle')}
      </p>
      {editing ? (
        <form noValidate onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-3">
          <FormField label={t('bookingDetail.placeReviewLabel')} error={error} hint={`${value.length} / ${MAX}`}>
            <Textarea
              value={value}
              onChange={(e) => {
                setDraft(e.target.value.slice(0, MAX));
                if (error) setError(undefined);
              }}
              placeholder={t('bookingDetail.placeReviewPlaceholder')}
              rows={3}
            />
          </FormField>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" loading={submit.isPending}>
              {t('bookingDetail.placeReviewSend')}
            </Button>
            {saved && (
              <Button variant="ghost" onClick={() => setDraft(null)}>
                {t('bookingDetail.placeReviewCancel')}
              </Button>
            )}
          </div>
        </form>
      ) : (
        <>
          <p className="text-sm whitespace-pre-line text-fg">{saved.text}</p>
          <Button variant="secondary" className="w-fit" onClick={() => setDraft(saved.text)}>
            {t('bookingDetail.editReview')}
          </Button>
        </>
      )}
    </Card>
  );
}
