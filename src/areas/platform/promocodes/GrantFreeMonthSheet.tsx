'use client';

/** «Выдать бесплатный месяц» — только салонам, подключённым на визите (F-00-019); найти салон поиском. */
import { useGuardedClose } from '@/areas/platform/hooks/useGuardedClose';
import { useState } from 'react';
import { CalendarPlus, Store } from 'lucide-react';
import { grantFreeMonth } from '@/api/platform';
import { useApiMutation } from '@/api/request';
import { useVisitBusinesses } from '@/areas/platform/hooks/usePlatformData';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Button, LinkButton } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { Combobox } from '@/ui/Combobox';
import { EmptyState } from '@/ui/EmptyState';
import { FormField } from '@/ui/FormField';
import { Sheet } from '@/ui/Sheet';
import { Skeleton } from '@/ui/Skeleton';
import { Textarea } from '@/ui/Textarea';
import { useToast } from '@/ui/Toast';

const DAY_PRESETS = [30, 60, 90] as const;

export function GrantFreeMonthSheet({ onClose }: { onClose: () => void }) {
  const t = useT('platform');
  const fmt = useFormat();
  const toast = useToast();
  const q = useVisitBusinesses();
  const grant = useApiMutation((a: { businessId: string; days: number; note?: string }) => grantFreeMonth(a.businessId, a.days, 'manual', a.note));
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [days, setDays] = useState<number>(30);
  const [note, setNote] = useState('');
  const picked = q.data?.find((b) => b.id === businessId);
  const [showError, setShowError] = useState(false);
  const onOpenChange = useGuardedClose(Boolean(businessId || note.trim()), onClose);

  const submit = async () => {
    if (!businessId) return setShowError(true);
    try {
      await grant.mutate({ businessId, days, note: note.trim() || undefined });
      toast.success(t('promocodes.granted', { name: picked?.name ?? '', n: days }));
      onClose();
    } catch {
      toast.error(t('promocodes.grantFailed'));
    }
  };

  return (
    <Sheet
      open
      onOpenChange={onOpenChange}
      title={t('promocodes.grantFreeMonth')}
      description={t('promocodes.grantEligibleOnly')}
      size="md"
      footer={
        q.data?.length ? (
          <Button fullWidth leftIcon={<CalendarPlus aria-hidden />} onClick={submit} loading={grant.isPending}>
            {t('promocodes.grantSubmit', { n: days })}
          </Button>
        ) : undefined
      }
    >
      {q.isLoading ? (
        <Skeleton lines={3} />
      ) : !q.data?.length ? (
        <EmptyState
          variant="section"
          icon={<Store aria-hidden />}
          title={t('promocodes.grantNoBusinesses')}
          description={t('promocodes.grantNoBusinessesHint')}
          action={<LinkButton href="/platform/connect" variant="outline">{t('promocodes.connectSalon')}</LinkButton>}
        />
      ) : (
        <div className="flex flex-col gap-5">
          <FormField label={t('promocodes.grantTo')} required error={showError && !businessId ? t('promocodes.businessRequired') : undefined}>
            <Combobox
              options={q.data.map((b) => ({ value: b.id, label: b.name, description: b.freeUntil ? t('promocodes.freeUntilNow', { date: fmt.date(b.freeUntil, 'dayMonth') }) : undefined }))}
              value={businessId}
              onValueChange={setBusinessId}
              placeholder={t('promocodes.findBusiness')}
              emptyText={t('promocodes.noBusinessFound')}
            />
          </FormField>
          <FormField label={t('promocodes.grantDays')}>
            <div className="flex flex-wrap gap-2">
              {DAY_PRESETS.map((d) => (
                <Chip key={d} selected={days === d} onClick={() => setDays(d)}>
                  {t('promocodes.daysChip', { n: d })}
                </Chip>
              ))}
            </div>
          </FormField>
          <FormField label={t('promocodes.grantNote')} optional>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </FormField>
        </div>
      )}
    </Sheet>
  );
}
