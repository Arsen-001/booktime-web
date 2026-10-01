'use client';

import type { Id, Staff } from '@/domain/core';
import {
  getHistoryLimitDays,
  getIncludeInFillRate,
  setHiddenInJournal,
  setHistoryLimitDays,
  setIncludeInFillRate,
  setJournalMarkupMin,
} from '@/api/schedule';
import { optimistic, useApiMutation, useApiQuery } from '@/api/request';
import { useT } from '@/i18n/useT';
import { Checkbox } from '@/ui/Checkbox';
import { FormField } from '@/ui/FormField';
import { Select } from '@/ui/Select';
import { useToast } from '@/ui/Toast';

// F-02-083/F-01-021: шаг разметки сетки журнала у мастера
const MARKUP_OPTIONS = [15, 30, 60, 90, 120] as const;
// F-02-085: «Не ограничивать» / 1 / 7 / 30 / 90 / 180 дней
const HISTORY_LIMIT_OPTIONS = [1, 7, 30, 90, 180] as const;

/**
 * Доступ к истории, разметка журнала, «скрыть в журнале», заполненность (F-02-081…085). Пока сотрудник или его
 * значения грузятся — те же поля неактивными и без значения (DESIGN.md → «The skeleton IS the page»): высота та же.
 */
export function StaffAccessSection({ staffId, staff }: { staffId: Id; staff?: Staff }) {
  const t = useT('schedule');
  const toast = useToast();
  const limitKey = ['schedule', 'history-limit', staffId] as const;
  const fillKey = ['schedule', 'ext-fill-rate', staffId] as const;
  const limitQuery = useApiQuery(limitKey, () => getHistoryLimitDays(staffId));
  const fillQuery = useApiQuery(fillKey, () => getIncludeInFillRate(staffId));
  const setLimit = useApiMutation((v: number | undefined) => setHistoryLimitDays(staffId, v));
  const setMarkup = useApiMutation((v: 15 | 30 | 60 | 90 | 120 | undefined) => setJournalMarkupMin(staffId, v));
  const setHidden = useApiMutation((v: boolean) => setHiddenInJournal(staffId, v));
  const setFill = useApiMutation((v: boolean) => setIncludeInFillRate(staffId, v), {
    optimistic: optimistic<boolean, boolean>(fillKey, (_o, v) => v),
  });

  const run = (p: Promise<unknown>) =>
    void p.then(
      () => toast.success(t('staffCard.settingsSaved')),
      () => toast.error(t('staffCard.settingsSaveFailed')),
    );

  return (
    <div className="flex flex-col gap-5">
      <div data-f="F-02-085">
        <FormField label={t('staffCard.historyLimitTitle')} hint={t('staffCard.historyLimitHint')}>
          {limitQuery.isLoading ? (
            <Select className="max-w-56" value="" options={[]} onValueChange={() => {}} disabled />
          ) : (
            <Select
              className="max-w-56"
              value={limitQuery.data === undefined ? 'none' : String(limitQuery.data)}
              onValueChange={(v) => run(setLimit.mutate(v === 'none' ? undefined : Number(v)))}
              options={[
                { value: 'none', label: t('staffCard.historyLimitNone') },
                ...HISTORY_LIMIT_OPTIONS.map((n) => ({ value: String(n), label: t('staffCard.historyLimitDays', { n }) })),
              ]}
            />
          )}
        </FormField>
      </div>

      <div data-f="F-02-083 F-10-034">
        <FormField label={t('staffCard.markupLabel')} hint={t('staffCard.markupHint')}>
          <Select
            className="max-w-56"
            value={!staff ? '' : staff.journalMarkupMin === undefined ? 'none' : String(staff.journalMarkupMin)}
            disabled={!staff}
            onValueChange={(v) => run(setMarkup.mutate(v === 'none' ? undefined : (Number(v) as 15 | 30 | 60 | 90 | 120)))}
            options={[
              { value: 'none', label: t('staffCard.markupNone') },
              ...MARKUP_OPTIONS.map((n) => ({ value: String(n), label: t('staffCard.markupMinutes', { n }) })),
            ]}
          />
        </FormField>
      </div>

      <div data-f="F-02-082">
        <Checkbox
          checked={staff?.hiddenInJournal ?? false}
          disabled={!staff}
          onCheckedChange={(v) => run(setHidden.mutate(v))}
          label={t('staffCard.hideInJournal')}
          description={t('staffCard.hideInJournalHint')}
        />
      </div>

      <div data-f="F-02-081 F-10-035">
        {fillQuery.isLoading ? (
          <Checkbox checked={false} disabled label={t('staffCard.includeInFillRate')} description={t('staffCard.includeInFillRateHint')} />
        ) : (
          <Checkbox
            checked={fillQuery.data ?? true}
            onCheckedChange={(v) => run(setFill.mutate(v))}
            label={t('staffCard.includeInFillRate')}
            description={t('staffCard.includeInFillRateHint')}
          />
        )}
      </div>
    </div>
  );
}
