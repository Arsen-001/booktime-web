'use client';

/** Причина отказа — чипом в одно касание; комментарий по желанию; для платного — сколько монет вернётся. */
import { useLocale } from 'next-intl';
import { useRejectReasons } from '@/areas/platform/hooks/usePlatformData';
import type { Id, LocaleCode } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { pickText } from '@/lib/text';
import { ChoiceGroup } from '@/ui/ChoiceGroup';
import { FormField } from '@/ui/FormField';
import { Skeleton } from '@/ui/Skeleton';
import { Textarea } from '@/ui/Textarea';

interface RejectReasonPickerProps {
  reasonId: Id;
  note: string;
  paidCoins?: number;
  showError: boolean;
  onReasonChange: (id: Id) => void;
  onNoteChange: (note: string) => void;
}

export function RejectReasonPicker({ reasonId, note, paidCoins, showError, onReasonChange, onNoteChange }: RejectReasonPickerProps) {
  const t = useT('platform');
  const locale = useLocale() as LocaleCode;
  const q = useRejectReasons();
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border p-4">
      <FormField label={t('moderation.reasonLabel')} required error={showError && !reasonId ? t('moderation.reasonRequired') : undefined}>
        {q.isLoading ? (
          <Skeleton lines={2} />
        ) : (
          // Длинные причины — карточками в столбик (одно касание, текст переносится), а не чипами в строку
          <ChoiceGroup value={reasonId} onValueChange={onReasonChange} options={(q.data ?? []).map((r) => ({ value: r.id, title: pickText(r.label, locale) }))} />
        )}
      </FormField>
      <FormField label={t('moderation.reasonNote')} optional hint={t('moderation.reasonNoteHint')}>
        <Textarea value={note} onChange={(e) => onNoteChange(e.target.value)} rows={2} />
      </FormField>
      {typeof paidCoins === 'number' && <p className="text-sm text-muted">{t('moderation.refundNote', { coins: paidCoins })}</p>}
    </div>
  );
}
