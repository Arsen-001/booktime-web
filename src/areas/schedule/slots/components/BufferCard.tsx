'use client';

/**
 * «Технический перерыв после каждой записи» — запас между клиентами (F-02-059, F-00-057). Свой у мастера важнее общего
 * филиала; перерыв самой услуги важнее обоих (F-02-060, считает движок окон).
 */
import type { Id } from '@/domain/core';
import type { SlotScopeKind } from '@/domain/schedule';
import { getBufferMin, setBufferMin } from '@/api/schedule';
import { optimistic, useApiMutation, useApiQuery } from '@/api/request';
import { useT } from '@/i18n/useT';
import { SectionCard } from '@/ui/SectionCard';
import { Select } from '@/ui/Select';
import { Skeleton } from '@/ui/Skeleton';
import { useToast } from '@/ui/Toast';

const OPTIONS_MIN = [0, 5, 10, 15, 20, 25, 30, 40, 45, 50, 60];

export interface BufferCardProps {
  scopeKind: SlotScopeKind;
  scopeId: Id;
  editable: boolean;
}

export function BufferCard({ scopeKind, scopeId, editable }: BufferCardProps) {
  const t = useT('schedule');
  const toast = useToast();
  const key = ['schedule', 'buffer-min', scopeKind, scopeId] as const;
  const query = useApiQuery(key, () => getBufferMin(scopeKind, scopeId), { enabled: Boolean(scopeId) });
  const save = useApiMutation((minutes: number) => setBufferMin(scopeKind, scopeId, minutes), {
    optimistic: optimistic<number, number>(key, (_old, minutes) => minutes),
  });

  const onChange = async (v: string) => {
    try {
      await save.mutate(Number(v));
      toast.success(t('slots.buffer.saved'));
    } catch {
      toast.error(t('panel.saveFailed'));
    }
  };

  return (
    <SectionCard
      title={t('slots.buffer.title')}
      description={scopeKind === 'staff' ? t('slots.buffer.hintStaff') : t('slots.buffer.hintLocation')}
    >
      <div data-f="F-02-059 F-00-057" className="flex flex-col gap-2">
        {query.isLoading ? (
          <Skeleton lines={1} />
        ) : (
          <Select
            aria-label={t('slots.buffer.title')}
            className="max-w-56"
            disabled={!editable}
            value={String(query.data ?? 0)}
            onValueChange={(v) => void onChange(v)}
            options={OPTIONS_MIN.map((m) => ({
              value: String(m),
              label: m === 0 ? t('slots.buffer.none') : t('slots.buffer.minutes', { n: m }),
            }))}
          />
        )}
        <p className="text-sm text-muted" data-f="F-02-065">
          {t('slots.buffer.appliesIfNoServiceBuffer')}
        </p>
      </div>
    </SectionCard>
  );
}
