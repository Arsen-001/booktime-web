'use client';

import { restoreCells, restoreMarksRange, type CellSnapshot, type MarksEditResult } from '@/api/schedule';
import { useApiMutation } from '@/api/request';
import type { Id } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { useToast } from '@/ui/Toast';

/**
 * Тост «… · Отменить» на 5 с (F-00-061) для любой правки графика: возвращает клетки из слепка «до», а для
 * «Как на прошлой неделе» (Г7) — ещё и отметки «занято / открыто».
 */
export function useUndoToast() {
  const t = useT('schedule');
  const toast = useToast();
  const restore = useApiMutation(async (p: { cells: CellSnapshot[]; marks?: { staffId: Id; result: MarksEditResult } }) => {
    if (p.cells.length) await restoreCells(p.cells);
    if (p.marks) await restoreMarksRange(p.marks.staffId, p.marks.result.from, p.marks.result.to, p.marks.result.before);
  });
  return (title: string, cells: CellSnapshot[], marks?: { staffId: Id; result: MarksEditResult }) =>
    toast.show({
      title,
      tone: 'success',
      durationMs: 5000,
      action: {
        label: t('panel.undo'),
        onClick: () =>
          void restore.mutate({ cells, marks }).then(
            () => toast.info(t('panel.undone')),
            () => toast.error(t('panel.saveFailed')),
          ),
      },
    });
}
