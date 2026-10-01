'use client';

/**
 * /biz/notifications/channels/promotion — инструменты продвижения от приложений партнёров: картинка
 * свободных окон в Telegram «Open Slots» (F-05-124), «Кого позвать» — подбор клиентов на пустые окна
 * (F-05-125), витрина подарков партнёра в уведомлении о записи (F-05-127).
 */
import { useState } from 'react';
import { Gift, ImageDown, Users } from 'lucide-react';
import { getGiftShowcase, getOpenSlotsSchedule, listOpenSlots, listWhoToInvite, updateGiftShowcase, updateOpenSlotsSchedule } from '@/api/notify';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { Checkbox } from '@/ui/Checkbox';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { Input } from '@/ui/Input';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';
import { Skeleton } from '@/ui/Skeleton';
import { TimePicker } from '@/ui/TimePicker';
import { useToast } from '@/ui/Toast';

function OpenSlotsCard() {
  const t = useT('notify');
  const toast = useToast();
  const { ready, businessId } = useCurrent();
  const [day, setDay] = useState<'today' | 'tomorrow'>('today');

  const scheduleQ = useApiQuery(['notify', 'openSlotsSchedule', businessId], () => getOpenSlotsSchedule(businessId!), { enabled: ready && !!businessId });
  const slotsQ = useApiQuery(['notify', 'openSlots', businessId, day], () => listOpenSlots({ businessId: businessId!, day }), { enabled: ready && !!businessId });
  const save = useApiMutation(updateOpenSlotsSchedule);

  if (!ready || scheduleQ.isLoading) return <Skeleton lines={4} />;
  if (scheduleQ.isError || !scheduleQ.data) return <ErrorState onRetry={scheduleQ.refetch} />;

  const schedule = scheduleQ.data;
  const patch = async (next: typeof schedule) => {
    try {
      await save.mutate({ businessId: businessId!, settings: next });
    } catch {
      toast.error(t('typeDetail.saveFailed'));
    }
  };

  const slots = slotsQ.data ?? [];

  return (
    <div data-f="F-05-124">
      <SectionCard title={t('promotion.openSlotsTitle')} description={t('promotion.openSlotsHint')}>
        <div className="flex flex-col gap-4">
          <Checkbox checked={schedule.enabled} onCheckedChange={(enabled) => patch({ ...schedule, enabled })} label={t('promotion.openSlotsEnable')} />
          {schedule.enabled && (
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={schedule.sendMorningToday}
                  onCheckedChange={(sendMorningToday) => patch({ ...schedule, sendMorningToday })}
                  label={t('promotion.openSlotsMorning')}
                />
                {schedule.sendMorningToday && <TimePicker value={schedule.timeMorning} onValueChange={(timeMorning) => patch({ ...schedule, timeMorning })} />}
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={schedule.sendEveningTomorrow}
                  onCheckedChange={(sendEveningTomorrow) => patch({ ...schedule, sendEveningTomorrow })}
                  label={t('promotion.openSlotsEvening')}
                />
                {schedule.sendEveningTomorrow && <TimePicker value={schedule.timeEvening} onValueChange={(timeEvening) => patch({ ...schedule, timeEvening })} />}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 border-t border-border pt-3">
            <Button variant={day === 'today' ? 'primary' : 'outline'} size="sm" onClick={() => setDay('today')}>
              {t('promotion.today')}
            </Button>
            <Button variant={day === 'tomorrow' ? 'primary' : 'outline'} size="sm" onClick={() => setDay('tomorrow')}>
              {t('promotion.tomorrow')}
            </Button>
          </div>

          {slotsQ.isLoading ? (
            <Skeleton lines={3} />
          ) : slots.length === 0 ? (
            <EmptyState compact icon={<ImageDown aria-hidden className="size-6" />} title={t('promotion.openSlotsEmptyTitle')} description={t('promotion.openSlotsEmptyText')} />
          ) : (
            <>
              <ul className="flex flex-col gap-1.5 text-sm">
                {slots.slice(0, 12).map((slot, i) => (
                  <li key={`${slot.staffId}-${slot.time}-${i}`} className="flex items-center justify-between rounded-lg bg-bg-muted px-3 py-1.5">
                    <span className="text-fg">{slot.staffName}</span>
                    <span className="text-muted">{slot.time}</span>
                  </li>
                ))}
              </ul>
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={() => toast.success(t('promotion.imageDownloaded'))}>
                  <ImageDown aria-hidden className="size-4" />
                  {t('promotion.downloadImage')}
                </Button>
              </div>
            </>
          )}
        </div>
      </SectionCard>
    </div>
  );
}

function WhoToInviteCard() {
  const t = useT('notify');
  const toast = useToast();
  const { ready, businessId } = useCurrent();
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const q = useApiQuery(['notify', 'whoToInvite', businessId], () => listWhoToInvite(businessId!), { enabled: ready && !!businessId });

  if (!ready || q.isLoading) return <Skeleton lines={4} />;
  if (q.isError) return <ErrorState onRetry={q.refetch} />;

  const suggestions = q.data ?? [];

  const send = (key: string) => {
    setSentIds((prev) => new Set(prev).add(key));
    toast.success(t('promotion.inviteSent'));
  };

  return (
    <div data-f="F-05-125">
      <SectionCard title={t('promotion.whoToInviteTitle')} description={t('promotion.whoToInviteHint')}>
        {suggestions.length === 0 ? (
          <EmptyState compact icon={<Users aria-hidden className="size-6" />} title={t('promotion.whoToInviteEmptyTitle')} description={t('promotion.whoToInviteEmptyText')} />
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {suggestions.slice(0, 10).map((s, i) => {
              const key = `${s.clientId}-${s.slot.time}-${i}`;
              const sent = sentIds.has(key);
              return (
                <li key={key} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-fg">{s.clientName}</p>
                    <p className="text-xs text-muted">{s.messageText}</p>
                  </div>
                  <Button variant={sent ? 'outline' : 'primary'} size="sm" disabled={sent} onClick={() => send(key)}>
                    {sent ? t('promotion.inviteSentBadge') : t('promotion.inviteSendOne')}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

function GiftShowcaseCard() {
  const t = useT('notify');
  const toast = useToast();
  const { ready, businessId } = useCurrent();
  const q = useApiQuery(['notify', 'giftShowcase', businessId], () => getGiftShowcase(businessId!), { enabled: ready && !!businessId });
  const save = useApiMutation(updateGiftShowcase);

  if (!ready || q.isLoading) return <Skeleton lines={3} />;
  if (q.isError || !q.data) return <ErrorState onRetry={q.refetch} />;

  const s = q.data;
  const patch = async (next: typeof s) => {
    try {
      await save.mutate({ businessId: businessId!, settings: next });
    } catch {
      toast.error(t('typeDetail.saveFailed'));
    }
  };

  return (
    <div data-f="F-05-127 F-06-170">
      <SectionCard title={t('promotion.giftShowcaseTitle')} description={t('promotion.giftShowcaseHint')}>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Checkbox checked={s.enabled} onCheckedChange={(enabled) => patch({ ...s, enabled })} label={t('promotion.giftShowcaseEnable')} />
            <Badge tone="neutral" size="sm">
              {t('promotion.demoOnly')}
            </Badge>
          </div>
          {s.enabled && (
            <>
              <Input value={s.partnerName} onChange={(e) => patch({ ...s, partnerName: e.target.value })} className="max-w-xs" />
              <div className="flex items-center gap-2 rounded-xl border border-border bg-bg-muted p-3 text-sm">
                <Gift aria-hidden className="size-5 shrink-0 text-accent" />
                <span className="text-fg">{t('promotion.giftShowcasePreview', { partner: s.partnerName })}</span>
              </div>
            </>
          )}
        </div>
      </SectionCard>
    </div>
  );
}

export function PromotionScreen() {
  const t = useT('notify');
  return (
    <div className="flex flex-col gap-6">
      <PageHeader back={{ href: '/biz/notifications/channels', label: t('tabs.channels') }} title={t('promotion.title')} description={t('promotion.subtitle')} />
      <OpenSlotsCard />
      <WhoToInviteCard />
      <GiftShowcaseCard />
    </div>
  );
}
