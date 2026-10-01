'use client';

import { useState } from 'react';
import { Send } from 'lucide-react';
import { firstStaffWithCandidates, getSlotCandidates, inviteToSlot, listSlotInvites, type SlotCandidate } from '@/api/online';
import { useApiMutation, useApiQuery } from '@/api/request';
import type { Id } from '@/domain/core';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { SectionCard } from '@/ui/SectionCard';
import { Select } from '@/ui/Select';
import { SkeletonText } from '@/ui/Skeleton';
import { useSkeletonCount } from '@/ui/hooks/useSkeletonCount';
import { useToast } from '@/ui/Toast';

/**
 * «Кого позвать» (F-03-052). ⭐ Своя реализация без стороннего ИИ-бота: свободные окна — тот же расчёт, что и
 * виджет; подбор клиента — «обычно ходит в это время» или «пора снова». О28: в списке только мастера (кто
 * принимает клиентов), по умолчанию выбран первый мастер, у которого есть кого звать, — а не владелица без услуг.
 */
export function WhoToInviteSection({
  businessId,
  masters,
  pending = false,
}: {
  businessId: Id;
  masters: { value: string; label: string }[];
  /** Экран ещё грузит мастеров — секция на месте: выбор мастера выключен, окна строками-скелетонами */
  pending?: boolean;
}) {
  const t = useT('online');
  const toast = useToast();
  const format = useFormat();
  const masterIds = masters.map((m) => m.value);
  const defaultQ = useApiQuery(['online', 'who-to-invite-default', businessId, masterIds.join(',')], () => firstStaffWithCandidates(businessId, masterIds), {
    enabled: masterIds.length > 0,
  });
  const [picked, setPicked] = useState<string | undefined>();
  const staffId = picked ?? defaultQ.data ?? '';

  const candidatesQ = useApiQuery(['online-slot-candidates', businessId, staffId], () => getSlotCandidates(businessId, staffId), {
    enabled: Boolean(staffId),
  });
  const invitesQ = useApiQuery(['online-slot-invites', businessId], () => listSlotInvites(businessId), { enabled: Boolean(businessId) });
  const inviteMutation = useApiMutation((args: { candidate: SlotCandidate; message: string }) => inviteToSlot(businessId, args.candidate, args.message));

  const invite = async (candidate: SlotCandidate) => {
    const message = t('requests.whoToInvite.messageTemplate', { name: candidate.clientName, when: format.dateTime(candidate.slotStart) });
    try {
      await inviteMutation.mutate({ candidate, message });
      toast.success(t('requests.whoToInvite.invited'));
    } catch {
      toast.error(t('requests.whoToInvite.inviteFailed'));
    }
  };

  const invitedSlots = new Set((invitesQ.data ?? []).map((i) => `${i.staffId}:${i.slotStart}`));
  const candidates = (candidatesQ.data ?? []).filter((c) => !invitedSlots.has(`${c.staffId}:${c.slotStart}`));
  const loading = pending || defaultQ.isLoading || (Boolean(staffId) && candidatesQ.isLoading);
  const skeletonCount = useSkeletonCount('who-to-invite', { loading, count: candidates.length, fallback: 8, max: 20 });

  if (masters.length === 0 && !pending) return null;

  return (
    <div data-f="F-03-052">
      <SectionCard title={t('requests.whoToInvite.title')} description={t('requests.whoToInvite.hint')}>
        <div className="flex flex-col gap-4">
          {(masters.length > 1 || pending) && (
            <div className="max-w-xs">
              <Select value={staffId} onValueChange={setPicked} options={masters} disabled={pending} aria-label={t('requests.whoToInvite.staffSelect')} />
            </div>
          )}

          {loading ? (
            // Те же строки окон до данных: «клиент · когда», причина, «Пригласить» (выключена)
            <ul className="flex flex-col gap-2" aria-busy="true">
              {Array.from({ length: skeletonCount }, (_, i) => (
                <li key={i} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface-2 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-fg">
                      <SkeletonText width="30ch" />
                    </p>
                    <p className="text-xs text-muted">
                      <SkeletonText width="20ch" />
                    </p>
                  </div>
                  <Button size="sm" variant="secondary" leftIcon={<Send aria-hidden />} disabled>
                    {t('requests.whoToInvite.invite')}
                  </Button>
                </li>
              ))}
            </ul>
          ) : candidates.length === 0 ? (
            <EmptyState compact title={t('requests.whoToInvite.empty.title')} description={t('requests.whoToInvite.empty.description')} />
          ) : (
            <ul className="flex flex-col gap-2">
              {candidates.map((c) => (
                <li
                  key={`${c.staffId}:${c.slotStart}:${c.clientId}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface-2 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-fg">
                      {c.clientName} · {format.dateTime(c.slotStart)}
                    </p>
                    <p className="text-xs text-muted">{t(c.reason === 'regular' ? 'requests.whoToInvite.reasonRegular' : 'requests.whoToInvite.reasonDueAgain')}</p>
                  </div>
                  <Button size="sm" variant="secondary" leftIcon={<Send aria-hidden />} loading={inviteMutation.isPending} onClick={() => invite(c)}>
                    {t('requests.whoToInvite.invite')}
                  </Button>
                </li>
              ))}
            </ul>
          )}

          {(invitesQ.data ?? []).length > 0 && (
            <div className="flex flex-col gap-2 border-t border-border pt-4">
              <p className="text-sm font-medium text-fg">{t('requests.whoToInvite.log')}</p>
              <ul className="flex flex-col gap-1.5 text-sm text-muted">
                {(invitesQ.data ?? []).slice(0, 8).map((i) => (
                  <li key={i.id} className="flex justify-between gap-2">
                    <span className="min-w-0 truncate">{i.clientName}</span>
                    <span className="shrink-0">{format.dateTime(i.slotStart)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
