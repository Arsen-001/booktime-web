'use client';

/**
 * Решения по материалам: одобрить / отклонить с причиной / вернуть на проверку — по одному и пачкой (выбор галочками).
 * Строка сначала плавно уходит (opacity + сдвиг, 150 мс, только она), потом исчезает из кэша оптимистично — очередь не
 * перечитывается и не мигает. Счётчики на вкладках правятся тут же. В тосте — «Отменить» (мелкое обратимое — без
 * «Вы уверены?», §0). Один экземпляр на экран: очередь и шторка «по одному» делят его (общее «уходит»).
 */
import { useState } from 'react';
import {
  approveModerationItem,
  approveModerationItems,
  rejectModerationItem,
  rejectModerationItems,
  reopenModerationItem,
  reopenModerationItems,
} from '@/api/platform';
import { optimistic, removeFromList, useApiMutation } from '@/api/request';
import type { Id } from '@/domain/core';
import type { ModerationCounts } from '@/domain/platform';
import { useT } from '@/i18n/useT';
import { DURATION } from '@/ui/motion';
import { useToast } from '@/ui/Toast';

const PENDING_LIST = ['platform', 'moderation', 'pending'] as const;
const COUNTS = ['platform', 'moderation-counts'] as const;
/** Сколько длится уход строки (CSS-переход строки — duration-150) */
const LEAVE_MS = Math.round(DURATION.fast * 1000);

/** Счётчики вкладок: n материалов ушло из «На проверке» в «Одобрено» / «Отклонено» */
const moveCounts = <A,>(to: 'approved' | 'rejected', count: (args: A) => number) =>
  optimistic<ModerationCounts, A>(COUNTS, (old, args) => ({ ...old, pending: Math.max(0, old.pending - count(args)), [to]: old[to] + count(args) }));

const dropIds = <A,>(pick: (args: A) => Id[]) => optimistic<{ id: Id }[], A>(PENDING_LIST, (old, args) => old.filter((m) => !pick(args).includes(m.id)));

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export type ModerationDecisions = ReturnType<typeof useModerationDecisions>;

export function useModerationDecisions() {
  const t = useT('platform');
  const toast = useToast();
  const [leaving, setLeaving] = useState<ReadonlySet<Id>>(() => new Set());

  const approveM = useApiMutation((id: Id) => approveModerationItem(id), {
    optimistic: [removeFromList(PENDING_LIST, (id: Id) => id), moveCounts<Id>('approved', () => 1)],
  });
  const rejectM = useApiMutation((a: { id: Id; reasonId: Id; note?: string }) => rejectModerationItem(a.id, a.reasonId, a.note), {
    optimistic: [removeFromList(PENDING_LIST, (a: { id: Id }) => a.id), moveCounts<{ id: Id }>('rejected', () => 1)],
  });
  const approveManyM = useApiMutation((ids: Id[]) => approveModerationItems(ids), {
    optimistic: [dropIds<Id[]>((ids) => ids), moveCounts<Id[]>('approved', (ids) => ids.length)],
  });
  const rejectManyM = useApiMutation((a: { ids: Id[]; reasonId: Id; note?: string }) => rejectModerationItems(a.ids, a.reasonId, a.note), {
    optimistic: [dropIds<{ ids: Id[] }>((a) => a.ids), moveCounts<{ ids: Id[] }>('rejected', (a) => a.ids.length)],
  });
  const reopenM = useApiMutation((id: Id) => reopenModerationItem(id));
  const reopenManyM = useApiMutation((ids: Id[]) => reopenModerationItems(ids));

  /** Строки плавно уходят, потом — запись (оптимистично убирает их из кэша); ошибка — строки вернутся откатом */
  const leave = async <R,>(ids: Id[], run: () => Promise<R>): Promise<R> => {
    setLeaving((prev) => new Set([...prev, ...ids]));
    try {
      if (!reducedMotion()) await wait(LEAVE_MS);
      return await run();
    } finally {
      setLeaving((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
    }
  };

  const undo = async (id: Id) => {
    try {
      await reopenM.mutate(id);
      toast.info(t('moderation.reopened'));
    } catch {
      toast.error(t('moderation.actionFailed'));
    }
  };
  const undoMany = async (ids: Id[]) => {
    try {
      await reopenManyM.mutate(ids);
      toast.info(t('moderation.reopenedMany', { n: ids.length }));
    } catch {
      toast.error(t('moderation.actionFailed'));
    }
  };

  const approve = async (id: Id): Promise<boolean> => {
    try {
      await leave([id], () => approveM.mutate(id));
      toast.success(t('moderation.approvedToast'), { action: { label: t('common.undo'), onClick: () => void undo(id) } });
      return true;
    } catch {
      toast.error(t('moderation.approveFailed'));
      return false;
    }
  };

  const reject = async (id: Id, reasonId: Id, note?: string, refund?: number): Promise<boolean> => {
    try {
      await leave([id], () => rejectM.mutate({ id, reasonId, note }));
      toast.success(refund ? t('moderation.rejectedRefundToast', { coins: refund }) : t('moderation.rejectedToast'), {
        action: { label: t('common.undo'), onClick: () => void undo(id) },
      });
      return true;
    } catch {
      toast.error(t('moderation.rejectFailed'));
      return false;
    }
  };

  /** Пачкой. Кто-то мог решить часть раньше — в тосте ровно то, что решили мы */
  const approveMany = async (ids: Id[]): Promise<boolean> => {
    if (!ids.length) return false;
    try {
      const done = await leave(ids, () => approveManyM.mutate(ids));
      if (!done.length) toast.error(t('moderation.alreadyDecided'));
      else toast.success(t('moderation.approvedManyToast', { n: done.length }), { action: { label: t('common.undo'), onClick: () => void undoMany(done) } });
      return true;
    } catch {
      toast.error(t('moderation.approveFailed'));
      return false;
    }
  };

  const rejectMany = async (ids: Id[], reasonId: Id, note?: string): Promise<boolean> => {
    if (!ids.length) return false;
    try {
      const done = await leave(ids, () => rejectManyM.mutate({ ids, reasonId, note }));
      if (!done.length) toast.error(t('moderation.alreadyDecided'));
      else toast.success(t('moderation.rejectedManyToast', { n: done.length }), { action: { label: t('common.undo'), onClick: () => void undoMany(done) } });
      return true;
    } catch {
      toast.error(t('moderation.rejectFailed'));
      return false;
    }
  };

  return {
    approve,
    reject,
    approveMany,
    rejectMany,
    reopen: undo,
    leaving,
    approving: approveM.isPending,
    rejecting: rejectM.isPending,
    bulkPending: approveManyM.isPending || rejectManyM.isPending,
    reopening: reopenM.isPending,
  };
}
