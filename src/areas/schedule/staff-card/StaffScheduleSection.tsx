'use client';

import { useState } from 'react';
import { AlertTriangle, CalendarPlus } from 'lucide-react';
import type { Id, Staff } from '@/domain/core';
import { getScheduleEnd, removeFromScheduleWithUndo, restoreAfterRemoveFromSchedule } from '@/api/schedule';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useActorName } from '@/areas/schedule/lib/actor';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { today } from '@/lib/date';
import { Button, LinkButton } from '@/ui/Button';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { SkeletonText } from '@/ui/Skeleton';
import { useToast } from '@/ui/Toast';

/**
 * График сотрудника на его карточке (F-02-019/020/021/023): «График есть до 25 октября» словами (ux-r5 E-1),
 * «Настроить» / «Убрать из графика» — без записей сразу с «Отменить», с записями — подтверждение.
 */
export function StaffScheduleSection({ staffId, staff, canEdit }: { staffId: Id; staff?: Staff; canEdit: boolean }) {
  const t = useT('schedule');
  const format = useFormat();
  const toast = useToast();
  const actorName = useActorName();
  const [affected, setAffected] = useState<number | null>(null);
  const endQuery = useApiQuery(['schedule', 'ext-schedule-end', staffId], () => getScheduleEnd(staffId));
  const remove = useApiMutation((force: boolean) => removeFromScheduleWithUndo(staffId, actorName, force));
  const restore = useApiMutation((snapshot: Parameters<typeof restoreAfterRemoveFromSchedule>[1]) =>
    restoreAfterRemoveFromSchedule(staffId, snapshot),
  );

  const end = endQuery.data;
  const active = Boolean(end) && (end ?? '') >= today();
  // Загрузка (сотрудник или дата конца графика) — та же секция: строка статуса полосой, кнопки на местах неактивными
  const loading = !staff || endQuery.isLoading;

  const doRemove = async (force: boolean) => {
    try {
      const r = await remove.mutate(force);
      if (!r.ok) {
        setAffected(r.affected);
        return;
      }
      setAffected(null);
      toast.show({
        title: t('staffCard.removedFromSchedule'),
        tone: 'success',
        durationMs: 5000,
        action: {
          label: t('panel.undo'),
          onClick: () =>
            void restore.mutate(r.snapshot).then(
              () => toast.info(t('panel.undone')),
              () => toast.error(t('staffCard.settingsSaveFailed')),
            ),
        },
      });
    } catch {
      toast.error(t('staffCard.settingsSaveFailed'));
    }
  };

  return (
    <div data-f="F-02-019 F-02-020 F-02-021" className="flex flex-col gap-2">
      <p className="font-medium text-fg">{t('staffCard.scheduleTitle')}</p>
      <p className={cn('text-sm font-medium', loading ? 'text-muted' : active ? 'text-success' : 'text-danger')}>
        {loading ? (
          <SkeletonText width="26ch" />
        ) : end ? (
          t('staffCard.scheduleUntil', { date: format.date(end, 'long') })
        ) : (
          t('staffCard.scheduleNone')
        )}
      </p>
      <div className="flex flex-wrap gap-2">
        {loading ? (
          <>
            <Button variant="secondary" size="sm" disabled>
              {t('staffCard.scheduleOpen')}
            </Button>
            {canEdit && (
              <Button variant="ghost" size="sm" disabled>
                {t('staffCard.scheduleRemove')}
              </Button>
            )}
          </>
        ) : (
        <LinkButton
          href={`/biz/schedule/calendar?staff=${staffId}`}
          variant={active ? 'secondary' : 'primary'}
          size="sm"
          leftIcon={active ? undefined : <CalendarPlus aria-hidden />}
        >
          {active ? t('staffCard.scheduleOpen') : t('staffCard.scheduleAdd')}
        </LinkButton>
        )}
        {!loading && active && canEdit && (
          <Button variant="ghost" size="sm" onClick={() => void doRemove(false)} loading={remove.isPending}>
            {t('staffCard.scheduleRemove')}
          </Button>
        )}
      </div>

      {staff?.status === 'fired' && active && (
        <div data-f="F-02-023" className="flex items-start gap-2 rounded-lg bg-warning-soft p-3 text-sm text-fg">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          <span>{t('staffCard.firedStillInJournal')}</span>
        </div>
      )}
      {staff?.hiddenInJournal && !loading && !end && (
        <p data-f="F-02-098" className="text-sm text-muted">
          {t('staffCard.assistantNote')}
        </p>
      )}

      <ConfirmDialog
        open={affected !== null}
        onOpenChange={(v) => !v && setAffected(null)}
        title={t('staffCard.removeConfirmTitle')}
        description={t('staffCard.removeAffectedWarning', { n: affected ?? 0 })}
        confirmLabel={t('staffCard.removeAnyway')}
        tone="danger"
        onConfirm={() => doRemove(true)}
      />
    </div>
  );
}
