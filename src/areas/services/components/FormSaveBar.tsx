'use client';

/**
 * Одна модель сохранения во всём разделе (У3, У20): липкая полоса «Отмена / Сохранить» внизу каждой формы
 * и видно, есть ли несохранённое. Отмена при изменениях спрашивает «Выйти без сохранения?» (У17) — это делает
 * вызывающий экран через useUnsavedGuard().confirmLeave.
 */
import { Check, CircleDot } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { StickyActionBar } from '@/ui/StickyActionBar';

export interface FormSaveBarProps {
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  onCancel?: () => void;
  /** Новая запись: «Сохранить» доступна и без правок */
  isNew?: boolean;
  canEdit?: boolean;
  saveLabel?: string;
}

export function FormSaveBar({ dirty, saving, onSave, onCancel, isNew, canEdit = true, saveLabel }: FormSaveBarProps) {
  const t = useT('services');
  return (
    <StickyActionBar
      desktop="sticky"
      aria-label={t('form.saveBar')}
      summary={
        isNew ? undefined : dirty ? (
          <span data-dirty="" className="flex items-center gap-1.5 text-warning">
            <CircleDot aria-hidden className="size-4 shrink-0" />
            {t('form.unsaved')}
          </span>
        ) : (
          <span className="flex items-center gap-1.5">
            <Check aria-hidden className="size-4 shrink-0 text-success" />
            {t('form.allSaved')}
          </span>
        )
      }
    >
      {onCancel && (
        <Button variant="secondary" onClick={onCancel}>
          {t('form.cancel')}
        </Button>
      )}
      {canEdit && (
        <Button loading={saving} disabled={!isNew && !dirty} onClick={onSave}>
          {saveLabel ?? t('form.save')}
        </Button>
      )}
    </StickyActionBar>
  );
}
