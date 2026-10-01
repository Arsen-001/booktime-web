'use client';

import { restoreMarksRange, type MarksEditResult } from '@/api/schedule';
import { useApiMutation } from '@/api/request';
import type { Id } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { useToast } from '@/ui/Toast';

/** Тост «… · Отменить» 5 с после быстрого инструмента календаря (F-00-061): возвращает отметки из слепка */
export function useMarksUndo(staffId: Id) {
  const t = useT('schedule');
  const toast = useToast();
  const restore = useApiMutation((r: MarksEditResult) => restoreMarksRange(staffId, r.from, r.to, r.before));
  return (title: string, result: MarksEditResult) =>
    toast.show({
      title,
      tone: 'success',
      durationMs: 5000,
      action: {
        label: t('panel.undo'),
        onClick: () =>
          void restore.mutate(result).then(
            () => toast.info(t('panel.undone')),
            () => toast.error(t('calendar.actionFailed')),
          ),
      },
    });
}
