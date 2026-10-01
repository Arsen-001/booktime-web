'use client';

import { useState } from 'react';
import { useLocale } from 'next-intl';
import { CalendarCheck, CalendarClock, CalendarX, CheckCircle2, History, ShieldAlert } from 'lucide-react';
import { closeSlotFromClaim, getClaimByToken } from '@/api/client';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import type { Id } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { useFormat } from '@/i18n/useFormat';
import { pickText } from '@/lib/text';
import { Button, LinkButton } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { PageHeader } from '@/ui/PageHeader';
import { Skeleton } from '@/ui/Skeleton';
import { useToast } from '@/ui/Toast';

/**
 * /claim/[token] — «Закрыть окно» из готового текста клиента (F-00-107, решение владельца 26.09.2026).
 * Право на карточку — то же, что у создания записи в журнале (journal.create на targetStaffId): не
 * вошёл, вошёл клиентом или другим мастером без «чужих записей» — api/client.ts getClaimByToken отдаёт
 * status: 'wrong_actor' без единой детали окна (ссылка «клиенту — ничего», п. 3 сценария). Дальше три
 * терминальных состояния читаются с сервера сразу (expired/taken/used), а не только после клика —
 * occupied читается тем же core-правилом hasBookingOverlap, что и журнал.
 */
export function ClaimScreen({ token }: { token: string }) {
  const t = useT('client');
  const tc = useT('common');
  const toast = useToast();
  const locale = useLocale();
  const fmt = useFormat();
  const { ready } = useCurrent();
  const [justClosed, setJustClosed] = useState<Id | undefined>(undefined);

  const claimQ = useApiQuery(['client', 'claim', token], () => getClaimByToken(token), { enabled: ready });
  const closeMutation = useApiMutation(closeSlotFromClaim);

  const handleClose = async () => {
    try {
      const { bookingId } = await closeMutation.mutate(token);
      setJustClosed(bookingId);
      toast.success(t('claim.closedToast'));
    } catch {
      toast.error(tc('states.actionFailed'));
    }
  };

  if (!ready || claimQ.isLoading) {
    return (
      <div data-f="F-00-107" className="mx-auto flex max-w-sm flex-col gap-5 py-6" aria-busy="true">
        <Skeleton lines={5} />
      </div>
    );
  }

  if (claimQ.isError) {
    return (
      <div data-f="F-00-107" className="mx-auto flex max-w-sm flex-col gap-5 py-6">
        <ErrorState onRetry={() => claimQ.refetch()} />
      </div>
    );
  }

  const view = claimQ.data;

  if (!view || view.status === 'wrong_actor') {
    return (
      <div data-f="F-00-107" className="mx-auto flex max-w-sm flex-col gap-5 py-6">
        <EmptyState
          icon={<ShieldAlert aria-hidden />}
          title={t('claim.wrongActorTitle')}
          description={t('claim.wrongActorText')}
          action={<LinkButton href={`/login?next=${encodeURIComponent(`/claim/${token}`)}`}>{t('claim.toLogin')}</LinkButton>}
        />
      </div>
    );
  }

  const serviceName = pickText(view.serviceName, locale);
  const when = view.start ? `${fmt.relativeDay(view.start)}, ${fmt.time(view.start)}` : '';
  const journalHref = view.start ? `/biz/journal?date=${view.start.slice(0, 10)}` : '/biz/journal';

  if (view.status === 'used' && !justClosed) {
    return (
      <div data-f="F-00-107" className="mx-auto flex max-w-sm flex-col gap-5 py-6">
        <EmptyState
          icon={<History aria-hidden />}
          title={t('claim.usedTitle')}
          description={t('claim.usedDescription', { when })}
          action={
            <LinkButton href={view.usedBookingId ? `${journalHref}&booking=${view.usedBookingId}` : journalHref}>
              {t('claim.toBooking')}
            </LinkButton>
          }
        />
      </div>
    );
  }

  if (view.status === 'used' && justClosed) {
    return (
      <div data-f="F-00-107" className="mx-auto flex max-w-sm flex-col gap-5 py-6">
        <EmptyState
          icon={<CheckCircle2 aria-hidden className="text-success" />}
          title={t('claim.closedTitle')}
          description={t('claim.closedDescription', { when })}
          action={<LinkButton href={`${journalHref}&booking=${justClosed}`}>{t('claim.toBooking')}</LinkButton>}
        />
      </div>
    );
  }

  if (view.status === 'expired') {
    return (
      <div data-f="F-00-107" className="mx-auto flex max-w-sm flex-col gap-5 py-6">
        <EmptyState
          icon={<CalendarX aria-hidden />}
          title={t('claim.expiredTitle')}
          description={t('claim.expiredDescription', { when })}
          action={<LinkButton href={journalHref}>{t('claim.toJournal')}</LinkButton>}
        />
      </div>
    );
  }

  if (view.status === 'taken') {
    return (
      <div data-f="F-00-107" className="mx-auto flex max-w-sm flex-col gap-5 py-6">
        <EmptyState
          icon={<CalendarClock aria-hidden />}
          title={t('claim.takenTitle')}
          description={t('claim.takenDescription', { when })}
          action={<LinkButton href={journalHref}>{t('claim.toJournal')}</LinkButton>}
        />
      </div>
    );
  }

  // status === 'ready'
  return (
    <div data-f="F-00-107" className="mx-auto flex max-w-sm flex-col gap-5 py-6">
      <PageHeader title={t('claim.confirmTitle')} description={view.businessName ?? t('claim.confirmSubtitle')} />
      <Card padding="lg" className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-text">
            <CalendarCheck className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-fg">{when}</p>
            {serviceName && <p className="truncate text-sm text-muted">{serviceName}</p>}
          </div>
        </div>
        {(view.clientName || view.clientPhone) && (
          <p className="text-sm text-muted">
            {[view.clientName, view.clientPhone ? fmt.phone(view.clientPhone) : undefined].filter(Boolean).join(' · ')}
          </p>
        )}
        <Button onClick={() => void handleClose()} loading={closeMutation.isPending} fullWidth>
          {t('claim.confirmButton')}
        </Button>
      </Card>
    </div>
  );
}
