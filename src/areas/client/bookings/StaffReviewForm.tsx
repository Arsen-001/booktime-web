'use client';

import { Star } from 'lucide-react';
import { useState } from 'react';
import { getMyStaffReview, submitStaffReview } from '@/api/client';
import { useApiMutation, useApiQuery } from '@/api/request';
import { clientKeys } from '@/areas/client/ui/clientKeys';
import type { Id } from '@/domain/core';
import type { StaffReview } from '@/domain/client';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Textarea } from '@/ui/Textarea';
import { useToast } from '@/ui/Toast';

const RATING_VALUES = [1, 2, 3, 4, 5] as const;

/** Черновик формы — существует только пока клиент ставит/меняет оценку; null — просто показываем сохранённое (F-r1) */
interface Draft {
  rating: number;
  text: string;
}

function draftFrom(review: StaffReview | undefined): Draft {
  return { rating: review?.rating ?? 0, text: review?.text ?? '' };
}

/**
 * «Оценка + текст» (В-24, F-14-013 1:1 с Altegio) — заменяет StarRatingBlock, когда бизнес выбрал
 * online.reviewMode = 'text'. Оценка обязательна, текст — нет; и то, и другое видно только у визита
 * «пришёл», можно менять, пока не удалил визит. Текст уходит на модерацию платформы (submitStaffReview);
 * рейтинг сохраняется и виден сразу.
 */
export function StaffReviewForm({ appUserId, staffId, businessId, bookingId }: { appUserId: Id; staffId: Id; businessId: Id; bookingId: Id }) {
  const t = useT('client');
  const toast = useToast();
  const q = useApiQuery(clientKeys.myStaffReview(appUserId, staffId), () => getMyStaffReview(appUserId, staffId));
  const submit = useApiMutation(submitStaffReview, { invalidates: [clientKeys.myStaffReview(appUserId, staffId)] });

  // null — не редактируем: показываем сохранённый отзыв (если есть) или пустую форму первого раза
  const [draft, setDraft] = useState<Draft | null>(null);
  const [hoverRating, setHoverRating] = useState<number>(0);

  const saved = q.data;
  const editing = draft !== null || !saved;
  const value = draft ?? draftFrom(saved);

  const save = async () => {
    if (value.rating < 1) return;
    try {
      await submit.mutate({ appUserId, staffId, businessId, bookingId, rating: value.rating as 1 | 2 | 3 | 4 | 5, text: value.text.trim() || undefined });
      setDraft(null);
      toast.success(t('bookingDetail.reviewSaved'));
    } catch {
      toast.error(t('bookingDetail.actionFailed'));
    }
  };

  return (
    <Card data-f="F-14-013 F-00-116" padding="md" className="flex flex-col gap-3">
      <p className="font-medium text-fg">{t('bookingDetail.rateTitle')}</p>
      <div className="flex items-center gap-1" role="radiogroup" aria-label={t('bookingDetail.rateTitle')}>
        {RATING_VALUES.map((v) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={value.rating === v}
            aria-label={t('bookingDetail.rateStars', { count: v })}
            disabled={!editing}
            onClick={() => setDraft({ ...value, rating: v })}
            onMouseEnter={() => editing && setHoverRating(v)}
            onMouseLeave={() => setHoverRating(0)}
            className="grid min-h-11 min-w-11 place-items-center disabled:cursor-default"
          >
            <Star aria-hidden className={(hoverRating || value.rating) >= v ? 'size-6 fill-warning text-warning' : 'size-6 text-muted'} />
          </button>
        ))}
      </div>
      {editing ? (
        <Textarea
          value={value.text}
          onChange={(e) => setDraft({ ...value, text: e.target.value.slice(0, 500) })}
          placeholder={t('bookingDetail.reviewTextPlaceholder')}
          rows={3}
        />
      ) : (
        saved?.text && <p className="text-sm text-fg">{saved.text}</p>
      )}
      <div>
        {editing ? (
          <Button onClick={() => void save()} disabled={value.rating < 1} loading={submit.isPending}>
            {t('bookingDetail.rateCta')}
          </Button>
        ) : (
          <Button variant="secondary" onClick={() => setDraft(draftFrom(saved))}>
            {t('bookingDetail.editReview')}
          </Button>
        )}
      </div>
    </Card>
  );
}
