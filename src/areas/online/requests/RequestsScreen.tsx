'use client';

import { useState } from 'react';
import { Inbox } from 'lucide-react';
import { coreList } from '@/api/core';
import { confirmPrepaymentReceived, listOnlineRequests, respondToRequest } from '@/api/online';
import { optimistic, useApiMutation, useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import type { OnlineRequestView } from '@/domain/online';
import { useT } from '@/i18n/useT';
import { nowYerevan } from '@/lib/date';
import { useOnlineAccess } from '@/areas/online/access';
import { HelpHint } from '@/areas/online/HelpHint';
import { OtherTimeSheet } from '@/areas/online/requests/OtherTimeSheet';
import { RequestCard, RequestCardSkeleton } from '@/areas/online/requests/RequestCard';
import { WhoToInviteSection } from '@/areas/online/requests/WhoToInviteSection';
import { Badge } from '@/ui/Badge';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { PageHeader } from '@/ui/PageHeader';
import { PermissionGate } from '@/ui/PermissionGate';
import { SkeletonText } from '@/ui/Skeleton';
import { useSkeletonCount } from '@/ui/hooks/useSkeletonCount';
import { usePagedList } from '@/ui/Pagination';
import { useConfirm, useToast } from '@/ui/Toast';

const OWNER_LIKE = new Set(['owner', 'admin', 'network']);

/** Убрать заявку из списка сразу по нажатию (DESIGN «only what changed updates») — ошибка откатит сама */
const dropRequest = optimistic<OnlineRequestView[], { id: string }>(['online-requests'], (old, { id }) => old.filter((r) => r.bookingId !== id));

/** /biz/online/requests — заявки, ждущие мастера или сверки предоплаты (F-00-067, F-00-071, F-00-079, F-03-127, О6, О28) */
export function RequestsScreen() {
  const t = useT('online');
  const toast = useToast();
  const confirm = useConfirm();
  const { businessId, staffId, persona, ready } = useCurrent();
  const ownStaffOnly = !OWNER_LIKE.has(persona);
  const { own: hasAccess } = useOnlineAccess();
  const [otherTimeFor, setOtherTimeFor] = useState<string | undefined>();
  // «Ждёт N мин» считается от момента открытия экрана — Date.now() в рендере запрещён (React Compiler)
  // Ереванское «сейчас» — submittedAt в данных тоже по Еревану (не по поясу устройства)
  const [now] = useState(() => nowYerevan().valueOf());

  const staffQ = useApiQuery(['online-requests-staff', businessId], () => coreList('staff', (s) => s.businessId === businessId), {
    enabled: ready && Boolean(businessId),
  });
  const requestsQ = useApiQuery(
    ['online-requests', businessId, ownStaffOnly ? staffId : undefined, staffId],
    () => listOnlineRequests(businessId!, ownStaffOnly ? staffId : undefined, staffId),
    { enabled: ready && Boolean(businessId) },
  );
  const respondMutation = useApiMutation((args: { id: string; action: 'confirm' | 'decline' }) => respondToRequest(args.id, args.action), {
    optimistic: dropRequest,
  });
  const moneyMutation = useApiMutation((args: { id: string }) => confirmPrepaymentReceived(args.id), { optimistic: dropRequest });
  // Постранично, как во всех списках (DESIGN.md → Long lists)
  const { pageItems, pager } = usePagedList(requestsQ.data ?? []);

  // До данных — та же страница: заголовок на месте, заявки — скелетоны карточек (столько, сколько было)
  const loading = !ready || requestsQ.isLoading || staffQ.isLoading;
  const skeletonCount = useSkeletonCount('online-requests', { loading, count: pageItems.length, fallback: 1, max: 10 });
  if (!loading && (requestsQ.isError || staffQ.isError)) {
    return (
      <ErrorState
        onRetry={() => {
          requestsQ.refetch();
          staffQ.refetch();
        }}
      />
    );
  }

  const staffList = staffQ.data ?? [];
  const staffById = new Map(staffList.map((s) => [s.id, s] as const));
  const items = requestsQ.data ?? [];
  // О28: «Кого позвать» — только те, кто принимает клиентов (есть услуги), без администраторов
  const masters = staffList
    .filter((s) => s.status === 'active' && s.role !== 'admin' && s.serviceIds.length > 0 && (!ownStaffOnly || s.id === staffId))
    .map((s) => ({ value: s.id, label: s.name }));

  const respond = async (id: string, action: 'confirm' | 'decline') => {
    // Отклонение необратимо для клиента — спрашиваем нашим ConfirmDialog; подтверждение — без диалога.
    if (action === 'decline') {
      const ok = await confirm({
        title: t('requests.declineConfirm.title'),
        description: t('requests.declineConfirm.description'),
        confirmLabel: t('requests.declineConfirm.confirm'),
        tone: 'danger',
      });
      if (!ok) return;
    }
    try {
      await respondMutation.mutate({ id, action });
      toast.success(action === 'confirm' ? t('requests.confirmed') : t('requests.declined'));
    } catch {
      toast.error(t('requests.actionFailed'));
    }
  };

  const moneyReceived = async (id: string) => {
    try {
      await moneyMutation.mutate({ id });
      toast.success(t('requests.moneyReceivedDone'));
    } catch {
      toast.error(t('requests.actionFailed'));
    }
  };

  return (
    <PermissionGate permission={hasAccess ? undefined : 'online.manage'} fallback="message">
      <div className="flex flex-col gap-6" data-f="F-00-067 F-03-127" aria-busy={loading || undefined}>
        <PageHeader
          title={t('requests.title')}
          description={t('requests.subtitle')}
          meta={
            <div className="flex flex-wrap items-center gap-2">
              {loading ? (
                <Badge tone="warning">
                  <SkeletonText width="1ch" />
                </Badge>
              ) : (
                items.length > 0 && <Badge tone="warning">{t('requests.count', { count: items.length })}</Badge>
              )}
              <HelpHint screenKey="requests" />
            </div>
          }
        />

        {loading ? (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {Array.from({ length: skeletonCount }, (_, i) => (
              <RequestCardSkeleton key={i} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState icon={<Inbox aria-hidden />} title={t('requests.empty.title')} description={t('requests.empty.description')} />
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {pageItems.map((r) => (
              <RequestCard
                key={r.bookingId}
                request={r}
                staff={staffById.get(r.staffId)}
                viewerStaffId={staffId}
                now={now}
                busy={respondMutation.isPending || moneyMutation.isPending}
                onConfirm={() => respond(r.bookingId, 'confirm')}
                onDecline={() => respond(r.bookingId, 'decline')}
                onOtherTime={() => setOtherTimeFor(r.bookingId)}
                onMoneyReceived={() => moneyReceived(r.bookingId)}
              />
            ))}
          </div>
        )}
        {pager}

        {/* Секция на месте уже до данных (мастеров ещё нет — pending) */}
        {(loading || businessId) && <WhoToInviteSection businessId={businessId ?? ''} masters={loading ? [] : masters} pending={loading} />}
      </div>

      <OtherTimeSheet bookingId={otherTimeFor} onOpenChange={(open) => !open && setOtherTimeFor(undefined)} />
    </PermissionGate>
  );
}
