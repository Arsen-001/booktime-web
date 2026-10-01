'use client';

/** Волны запуска (F-00-203…205): выбор волны, «готово 6 из 10» с полосой, пункты со статусом. */
import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { ListChecks } from 'lucide-react';
import { useWaveItems } from '@/areas/platform/hooks/usePlatformData';
import { WaveItemRow, WaveItemRowSkeleton } from '@/areas/platform/plan/WaveItemRow';
import type { LocaleCode } from '@/domain/core';
import type { WaveItem, WaveNo } from '@/domain/platform';
import { useT } from '@/i18n/useT';
import { pickText } from '@/lib/text';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { SectionCard } from '@/ui/SectionCard';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { SkeletonText } from '@/ui/Skeleton';
import { useRememberedLayout } from '@/ui/hooks/useSkeletonCount';

/** Какие пункты волны с пояснением (вторая строка) — как в демо, пока нет памяти о прошлом разе */
const TYPICAL_NOTES: Record<WaveNo, boolean[]> = {
  1: [true, false, false, false, false, true, true, false, false, false],
  2: [false, false, false, false, false, true, false, false, false, false],
  3: [false, false, false, false, false, false],
};

const FIDS: Record<WaveNo, string> = { 1: 'F-00-203', 2: 'F-00-204', 3: 'F-00-205' };
/** Заметки (без функций) в прогресс не входят */
const isNote = (item: WaveItem) => item.fids.length === 0 && item.id.includes('_note_');

export function WavesPanel() {
  const t = useT('platform');
  const locale = useLocale() as LocaleCode;
  const [wave, setWave] = useState<WaveNo>(1);
  const q = useWaveItems();
  // Скелетон — те же строки: сколько пунктов и у каких есть пояснение (строка выше) — как в прошлый раз, иначе как в демо
  const [rememberedNotes, saveNotes] = useRememberedLayout<boolean[]>(`wave-notes-${wave}`);
  const loadedNotes = q.data?.filter((w) => w.wave === wave && !isNote(w)).map((w) => Boolean(w.note));
  useEffect(() => {
    if (!q.isLoading && loadedNotes) saveNotes(loadedNotes);
  });
  const skeletonNotes = rememberedNotes ?? TYPICAL_NOTES[wave];

  if (q.isError) return <ErrorState onRetry={q.refetch} />;
  const all = (q.data ?? []).filter((w) => w.wave === wave);
  const items = all.filter((w) => !isNote(w));
  const notes = all.filter(isNote);
  const passed = items.filter((w) => w.status === 'passed').length;

  return (
    <div data-f={FIDS[wave]} className="flex flex-col gap-4">
      <SegmentedControl value={String(wave)} onValueChange={(v) => setWave(Number(v) as WaveNo)} options={([1, 2, 3] as const).map((n) => ({ value: String(n), label: t('plan.wave', { n }) }))} />
      {q.isLoading ? (
        // Та же карточка: заголовок «готово N из M», полоса прогресса, строки пунктов с выбором статуса
        <SectionCard
          title={<SkeletonText width="14ch" />}
          description={<span className="mt-2 block h-2 overflow-hidden rounded-full bg-surface-3" />}
          padding="none"
          classNames={{ body: 'mt-4 border-t border-border' }}
        >
          <ul className="flex flex-col divide-y divide-border">
            {skeletonNotes.map((note, i) => (
              <WaveItemRowSkeleton key={i} note={note} />
            ))}
          </ul>
        </SectionCard>
      ) : !items.length ? (
        <EmptyState framed icon={<ListChecks aria-hidden />} title={t('plan.waveEmpty')} />
      ) : (
        <SectionCard
          title={t('plan.waveDone', { passed, total: items.length })}
          description={
            <span className="mt-2 block h-2 overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-valuemin={0} aria-valuemax={items.length} aria-valuenow={passed}>
              <span className="block h-full rounded-full bg-primary" style={{ width: `${(passed / items.length) * 100}%` }} />
            </span>
          }
          padding="none"
          classNames={{ body: 'mt-4 border-t border-border' }}
        >
          <ul className="flex flex-col divide-y divide-border">
            {items.map((item) => (
              <WaveItemRow key={item.id} item={item} />
            ))}
          </ul>
        </SectionCard>
      )}
      {notes.map((n) => (
        <p key={n.id} className="text-sm text-muted">{pickText(n.title, locale)}</p>
      ))}
    </div>
  );
}
