'use client';

import type { PrepaymentRule } from '@/domain/core';
import { normalizeNoShowRule, prepaymentAmount } from '@/domain/rules';
import { ChoiceGroup } from '@/ui/ChoiceGroup';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Chip } from '@/ui/Chip';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { Select } from '@/ui/Select';
import { Switch } from '@/ui/Switch';

export interface PrepaymentDraft {
  on: boolean;
  /** ⭐ С кого: только с тех, кто не приходил (по умолчанию, владелец 01.10.2026) или со всех */
  scope: 'no_shows' | 'all';
  /** Порог «не пришёл N раз за M месяцев» — для scope 'no_shows' */
  noShowCount: number;
  noShowMonths: number;
  percent: number;
  requisites: string;
  timeoutMin: number;
}

const PERCENT_PRESETS = [10, 20, 30, 50, 100];
const WAIT_OPTIONS = [5, 10, 15, 20, 30, 45, 60];
const NO_SHOW_COUNT_OPTIONS = [1, 2, 3, 4, 5];
const NO_SHOW_MONTH_OPTIONS = [3, 6, 12, 24];
/** Пример в подсказке: запись за 10 000 ֏ */
const EXAMPLE_PRICE = 10000;

export function prepaymentDraftOf(rule: PrepaymentRule | undefined): PrepaymentDraft {
  const on = Boolean(rule && ((rule.percent ?? 0) > 0 || rule.amount > 0));
  const threshold = normalizeNoShowRule(rule?.onlyAfterNoShows);
  return {
    on,
    // Уже включённая предоплата без порога — «со всех», как и было; новая — по умолчанию «только кто не приходил»
    scope: on && !rule?.onlyAfterNoShows ? 'all' : 'no_shows',
    noShowCount: threshold.count,
    noShowMonths: threshold.months,
    percent: rule?.percent ?? 30,
    requisites: rule?.requisites ?? '',
    timeoutMin: rule?.timeoutMin ?? 30,
  };
}

export function prepaymentDraftEqual(a: PrepaymentDraft, b: PrepaymentDraft): boolean {
  if (a.on !== b.on) return false;
  if (!a.on) return true;
  if (a.scope !== b.scope) return false;
  if (a.scope === 'no_shows' && (a.noShowCount !== b.noShowCount || a.noShowMonths !== b.noShowMonths)) return false;
  return a.percent === b.percent && a.requisites.trim() === b.requisites.trim() && a.timeoutMin === b.timeoutMin;
}

/** Правило для Staff.prepayment; выключено — undefined (поле удаляется) */
export function prepaymentRuleOf(d: PrepaymentDraft): PrepaymentRule | undefined {
  if (!d.on) return undefined;
  return {
    amount: 0,
    percent: d.percent,
    requisites: d.requisites.trim(),
    timeoutMin: d.timeoutMin,
    ...(d.scope === 'no_shows' ? { onlyAfterNoShows: normalizeNoShowRule({ count: d.noShowCount, months: d.noShowMonths }) } : {}),
  };
}

/**
 * ⭐ F-00-097: предоплата — по желанию мастера, процентом от цены записи. Клиент при записи выбирает сам: только
 * предоплату или всю сумму сразу. Чужой мастер (владелец смотрит) — только просмотр: решает сам мастер.
 */
export function PrepaymentFields({
  value,
  onChange,
  legacyAmount,
  readOnly,
  requisitesError,
}: {
  value: PrepaymentDraft;
  onChange: (next: PrepaymentDraft) => void;
  /** Старое правило фиксированной суммой — после сохранения станет процентом */
  legacyAmount?: number;
  readOnly: boolean;
  requisitesError?: string;
}) {
  const t = useT('online');
  const format = useFormat();
  const set = (patch: Partial<PrepaymentDraft>) => onChange({ ...value, ...patch });
  const example = prepaymentAmount({ amount: 0, percent: value.percent }, EXAMPLE_PRICE);

  if (readOnly) {
    return (
      <div className="flex flex-col gap-1 rounded-xl border border-border bg-surface-2 p-3" data-f="F-00-097">
        <p className="text-sm font-medium text-fg">{t('settings.prepay.title')}</p>
        <p className="text-sm text-fg">
          {!value.on
            ? t('settings.prepay.off')
            : legacyAmount
              ? t('settings.prepay.summaryFixed', { amount: format.money(legacyAmount) })
              : t('settings.prepay.summary', { percent: value.percent })}
        </p>
        {value.on && value.scope === 'no_shows' && (
          <p className="text-sm text-fg" data-f="F-00-071">
            {t('settings.prepay.scopeNoShowsSummary', { count: value.noShowCount, months: value.noShowMonths })}
          </p>
        )}
        <p className="text-xs text-muted">{t('settings.decidesForSelf')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface-2 p-3" data-f="F-00-097">
      <Switch checked={value.on} onCheckedChange={(on) => set({ on })} label={t('settings.prepay.toggle')} description={t('settings.prepay.toggleHint')} />
      {value.on && (
        <>
          {legacyAmount ? <p className="text-sm text-warning-text">{t('settings.prepay.legacy', { amount: format.money(legacyAmount) })}</p> : null}
          {/* ⭐ С кого брать (владелец, 01.10.2026): по умолчанию — только с тех, кто уже не приходил к этому мастеру */}
          <FormField label={t('settings.prepay.scopeLabel')}>
            <div className="flex flex-col gap-3" data-f="F-00-071">
              <ChoiceGroup
                aria-label={t('settings.prepay.scopeLabel')}
                value={value.scope}
                onValueChange={(v) => set({ scope: v === 'all' ? 'all' : 'no_shows' })}
                options={[
                  { value: 'no_shows', title: t('settings.prepay.scopeNoShows'), description: t('settings.prepay.scopeNoShowsHint') },
                  { value: 'all', title: t('settings.prepay.scopeAll'), description: t('settings.prepay.scopeAllHint') },
                ]}
              />
              {value.scope === 'no_shows' && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <FormField label={t('settings.prepay.noShowCount')}>
                    <Select
                      value={String(value.noShowCount)}
                      onValueChange={(v) => set({ noShowCount: Number(v) })}
                      options={NO_SHOW_COUNT_OPTIONS.map((n) => ({ value: String(n), label: t('settings.prepay.noShowCountOption', { count: n }) }))}
                    />
                  </FormField>
                  <FormField label={t('settings.prepay.noShowMonths')}>
                    <Select
                      value={String(value.noShowMonths)}
                      onValueChange={(v) => set({ noShowMonths: Number(v) })}
                      options={NO_SHOW_MONTH_OPTIONS.map((m) => ({ value: String(m), label: t('settings.prepay.noShowMonthsOption', { months: m }) }))}
                    />
                  </FormField>
                  <p className="text-xs text-muted sm:col-span-2">{t('settings.prepay.noShowCounterHint')}</p>
                </div>
              )}
            </div>
          </FormField>
          <FormField label={t('settings.prepay.percent')} hint={t('settings.prepay.example', { price: format.money(EXAMPLE_PRICE), amount: format.money(example) })}>
            <div className="flex flex-wrap items-center gap-2">
              {PERCENT_PRESETS.map((p) => (
                <Chip key={p} selected={value.percent === p} onClick={() => set({ percent: p })}>
                  {p}%
                </Chip>
              ))}
              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={100}
                  className="w-20"
                  aria-label={t('settings.prepay.percentCustom')}
                  value={value.percent}
                  onChange={(e) => set({ percent: Math.min(100, Math.max(1, Math.round(Number(e.target.value) || 1))) })}
                />
                <span className="text-sm text-muted">%</span>
              </div>
            </div>
          </FormField>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
            <FormField label={t('settings.prepay.requisites')} hint={t('settings.prepay.requisitesHint')} error={requisitesError}>
              <Input value={value.requisites} placeholder={t('settings.prepay.requisitesPlaceholder')} onChange={(e) => set({ requisites: e.target.value })} />
            </FormField>
            <FormField label={t('settings.prepay.wait')}>
              <Select
                value={String(value.timeoutMin)}
                onValueChange={(v) => set({ timeoutMin: Number(v) })}
                options={WAIT_OPTIONS.map((m) => ({ value: String(m), label: t('settings.prepay.waitMinutes', { minutes: m }) }))}
              />
            </FormField>
          </div>
          {value.percent < 100 && <p className="text-xs text-muted">{t('settings.prepay.clientChoice')}</p>}
        </>
      )}
    </div>
  );
}
