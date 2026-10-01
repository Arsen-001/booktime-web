'use client';

/**
 * Ячейка «цена» или «длительность» в строке каталога (У5): по нажатию — поле прямо в строке, запись при уходе из
 * поля или по Enter (не по каждой клавише, У13), Escape — отмена. «До» должно быть больше «от» (У14), иначе правка
 * не уходит и видна ошибка.
 */
import { useState } from 'react';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { CommitInput } from '@/areas/services/components/CommitInput';
import { useToast } from '@/ui/Toast';

export interface InlineRangeCellProps {
  kind: 'money' | 'minutes';
  min: number;
  max: number | undefined;
  display: string;
  label: string;
  canEdit: boolean;
  onCommit: (patch: { min?: number; max?: number | undefined }) => void;
  className?: string;
}

export function InlineRangeCell({ kind, min, max, display, label, canEdit, onCommit, className }: InlineRangeCellProps) {
  const t = useT('services');
  const toast = useToast();
  const [editing, setEditing] = useState(false);

  if (!canEdit) return <span className={cn('px-2 text-sm tabular-nums text-fg', className)}>{display}</span>;

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        aria-label={`${label}: ${display}`}
        className={cn(
          'flex h-10 w-full min-w-0 items-center justify-end truncate rounded-md border border-transparent px-2 text-sm tabular-nums text-fg transition-colors duration-150 hover:border-border-strong/50 hover:bg-surface',
          className,
        )}
      >
        {display}
      </button>
    );
  }

  const commitMin = (v: number | undefined) => {
    if (v == null || v === min) return;
    if (max != null && v >= max) return void toast.error(t('form.rangeInvalid'));
    onCommit({ min: v });
  };
  const commitMax = (v: number | undefined) => {
    if (v === max) return;
    if (v != null && v <= min) return void toast.error(t('form.rangeInvalid'));
    onCommit({ max: v });
  };

  return (
    <div
      className={cn('flex min-w-0 items-center gap-1', className)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setEditing(false);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape' || e.key === 'Enter') setEditing(false);
      }}
    >
      <CommitInput kind={kind} size="sm" value={min} onCommit={commitMin} autoFocus aria-label={`${label}, ${t('list.from')}`} />
      {max != null && (
        <>
          <span aria-hidden className="text-muted">
            –
          </span>
          <CommitInput kind={kind} size="sm" value={max} onCommit={commitMax} aria-label={`${label}, ${t('list.to')}`} />
        </>
      )}
    </div>
  );
}
