'use client';

import { Globe, UserRoundPlus } from 'lucide-react';
import { getOnlineReadiness, publishBusiness } from '@/api/online';
import { useApiMutation, useApiQuery } from '@/api/request';
import type { Id } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { useToast } from '@/ui/Toast';

/**
 * Сц. 5 полного теста: новый бизнес (черновик) открывается клиентам кнопкой «Опубликовать» прямо здесь, а не только
 * регистрацией. Пока записаться не к кому — кнопка неактивна и сказано, что добавить. Приглашённые, но ещё не принявшие
 * приглашение сотрудники в онлайн-записи не видны — об этом тоже говорим (сц. 7).
 */
export function PublishCard({ businessId, onPublished }: { businessId: Id; onPublished: () => void }) {
  const t = useT('online');
  const toast = useToast();
  const q = useApiQuery(['online', 'readiness', businessId], () => getOnlineReadiness(businessId));
  const publish = useApiMutation(() => publishBusiness(businessId), { invalidates: [['online', 'readiness', businessId]] });
  const r = q.data;
  if (!r || (r.status !== 'draft' && r.invitedNames.length === 0)) return null;

  const invitedNote =
    r.invitedNames.length > 0 ? (
      <p className="flex items-start gap-2 text-sm text-muted">
        <UserRoundPlus aria-hidden className="mt-0.5 size-4 shrink-0" />
        {t('settings.invitedHint', { count: r.invitedNames.length, names: r.invitedNames.join(', ') })}
      </p>
    ) : null;

  if (r.status !== 'draft') {
    return <div className="rounded-lg bg-surface-2 px-3 py-2.5">{invitedNote}</div>;
  }

  return (
    <Card padding="md" className="flex flex-col gap-3 border-warning/40 bg-warning-soft">
      <div className="flex items-start gap-3">
        <Globe aria-hidden className="mt-0.5 size-5 shrink-0 text-warning" />
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-sm font-semibold text-fg">{t('links.publish.title')}</p>
          <p className="text-sm text-fg">{t('links.publish.text')}</p>
          {r.bookableCount === 0 && <p className="text-sm text-muted">{t('links.publish.nobody')}</p>}
        </div>
      </div>
      {invitedNote}
      <Button
        className="self-start"
        disabled={r.bookableCount === 0}
        loading={publish.isPending}
        onClick={async () => {
          try {
            await publish.mutate(undefined);
            toast.success(t('links.publish.done'));
            onPublished();
          } catch {
            toast.error(t('links.publish.failed'));
          }
        }}
      >
        {t('links.publish.button')}
      </Button>
    </Card>
  );
}
