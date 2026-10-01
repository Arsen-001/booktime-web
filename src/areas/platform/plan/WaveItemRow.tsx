'use client';

/** Пункт волны: название, что осталось, статус — выбором «Не начато · Строится · Готово». */
import { useLocale } from 'next-intl';
import { setWaveItemStatus } from '@/api/platform';
import { patchInList, useApiMutation } from '@/api/request';
import type { LocaleCode } from '@/domain/core';
import type { WaveItem, WaveItemStatus } from '@/domain/platform';
import { useT } from '@/i18n/useT';
import { pickText } from '@/lib/text';
import { Select } from '@/ui/Select';
import { SkeletonText } from '@/ui/Skeleton';
import { useToast } from '@/ui/Toast';

const STATUSES: WaveItemStatus[] = ['todo', 'building', 'passed'];

export function WaveItemRow({ item }: { item: WaveItem }) {
  const t = useT('platform');
  const toast = useToast();
  const locale = useLocale() as LocaleCode;
  const save = useApiMutation((a: { id: string; status: WaveItemStatus }) => setWaveItemStatus(a.id, a.status), {
    optimistic: patchInList(['platform', 'waves'], (a: { id: string; status: WaveItemStatus }) => ({ id: a.id, patch: { status: a.status } })),
  });
  const change = async (status: WaveItemStatus) => {
    try {
      await save.mutate({ id: item.id, status });
    } catch {
      toast.error(t('plan.saveFailed'));
    }
  };
  return (
    <li className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      {/* На телефоне — по строке на название и пояснение (многоточием): высота пункта не зависит от длины текста */}
      <div className="min-w-0">
        <p className="font-medium text-fg max-sm:truncate">{pickText(item.title, locale)}</p>
        {item.note && <p className="text-sm text-muted max-sm:truncate">{item.note}</p>}
      </div>
      <Select
        size="sm"
        aria-label={t('plan.statusAria', { title: pickText(item.title, locale) })}
        value={item.status}
        onValueChange={(v) => void change(v as WaveItemStatus)}
        options={STATUSES.map((s) => ({ value: s, label: t(`plan.waveStatus.${s}`) }))}
        className="w-44 shrink-0"
      />
    </li>
  );
}

/** Пункт волны до данных: та же строка — название полосой и выключенный выбор статуса того же размера */
export function WaveItemRowSkeleton({ note }: { note?: boolean }) {
  const t = useT('platform');
  return (
    <li className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <p className="font-medium text-fg">
          <SkeletonText width="26ch" />
        </p>
        {note && (
          <p className="text-sm text-muted">
            <SkeletonText width="36ch" />
          </p>
        )}
      </div>
      <Select size="sm" aria-label={t('plan.title')} value="todo" onValueChange={() => {}} options={STATUSES.map((s) => ({ value: s, label: t(`plan.waveStatus.${s}`) }))} className="w-44 shrink-0" disabled />
    </li>
  );
}
