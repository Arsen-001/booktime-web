'use client';

/**
 * Мастер «Редактировать правила» (F-02-045…052). 5 шагов у фиксированного/оптимального,
 * 3 у динамичного (плотность → шаг → время до визита) — F-02-045 «исправлено проверкой 2».
 * Показывается и для основного правила, и для нового/редактируемого исключения по дням (F-02-054).
 */
import { useMemo, useState } from 'react';
import type { DayHours } from '@/domain/core';
import type { SlotDensity, SlotRule, SlotStartMode } from '@/domain/schedule';
import { newSlotRule } from '@/domain/schedule';
import { previewRuleGrid } from '@/api/schedule';
import { wizardSteps, leadTimeOptions, stepOptions, type WizardStepId } from '@/areas/schedule/lib/slots';
import { useT } from '@/i18n/useT';
import { useFormat } from '@/i18n/useFormat';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { Modal } from '@/ui/Modal';
import { Radio } from '@/ui/Radio';
import { Select } from '@/ui/Select';
import { Stepper, type StepItem } from '@/ui/Stepper';
import { TimePicker } from '@/ui/TimePicker';

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;
/** Пример, когда рабочих часов нет: 10:00–19:00 (ux-r5 L-6 — не выдуманные 9–18 при другом графике) */
const PREVIEW_HOURS: DayHours = [{ from: '10:00', to: '19:00' }];

export interface SlotRuleWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Базовое правило локации/сотрудника (undefined — создаём новое исключение) */
  initial: SlotRule | null;
  /** true — это исключение по дням недели (F-02-054): показываем выбор дней сверху */
  isException: boolean;
  onSave: (rule: SlotRule) => Promise<void> | void;
  /** Часы филиала/сотрудника — для примера на шаге «Как показывать окна» */
  previewHours?: DayHours;
}

export function SlotRuleWizard({ open, onOpenChange, initial, isException, onSave, previewHours }: SlotRuleWizardProps) {
  const t = useT('schedule');
  const format = useFormat();
  const [rule, setRule] = useState<SlotRule>(
    () =>
      initial ??
      newSlotRule('', {
        isBase: !isException,
        weekdays: isException ? [] : [...WEEKDAYS],
      }),
  );
  const [stepIndex, setStepIndex] = useState(0);
  const [saving, setSaving] = useState(false);

  const steps = wizardSteps(rule.density);
  const stepItems: StepItem[] = steps.map((id) => ({
    id,
    label: t(
      `slots.wizard.${id === 'density' ? 'density.title' : id === 'start' ? 'start.title' : id === 'step' ? 'step.title' : id === 'lead' ? 'lead.title' : 'manual.title'}` as never,
    ),
  }));
  const currentStep: WizardStepId = steps[Math.min(stepIndex, steps.length - 1)];

  const exampleHours = previewHours && previewHours.length ? previewHours : PREVIEW_HOURS;
  const preview = useMemo(() => previewRuleGrid(rule, exampleHours), [rule, exampleHours]);

  const reset = () => {
    setRule(
      initial ??
        newSlotRule('', {
          isBase: !isException,
          weekdays: isException ? [] : [...WEEKDAYS],
        }),
    );
    setStepIndex(0);
  };

  const close = () => {
    reset();
    onOpenChange(false);
  };

  const weekdaysValid = !isException || rule.weekdays.length > 0;

  const next = () => setStepIndex((i) => Math.min(steps.length - 1, i + 1));
  const back = () => setStepIndex((i) => Math.max(0, i - 1));

  const finish = async () => {
    setSaving(true);
    try {
      await onSave(rule);
      close();
    } finally {
      setSaving(false);
    }
  };

  const setDensity = (density: SlotDensity) => setRule((r) => ({ ...r, density }));
  const setStartMode = (startMode: SlotStartMode) => setRule((r) => ({ ...r, startMode }));

  return (
    <Modal open={open} onOpenChange={(v) => (v ? onOpenChange(v) : close())} title={t('slots.wizard.title')} size="lg" dismissible>
      <div className="flex flex-col gap-6" data-f="F-03-056">
        <Stepper steps={stepItems} current={Math.min(stepIndex, stepItems.length - 1)} />

        {isException && (
          <div className="rounded-lg bg-surface-2 p-3" data-f="F-03-064">
            <p className="text-sm font-medium text-fg">{t('slots.wizard.exceptionWeekdaysTitle')}</p>
            <p className="text-sm text-muted">{t('slots.wizard.exceptionWeekdaysHint')}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {WEEKDAYS.map((wd) => {
                const active = rule.weekdays.includes(wd);
                return (
                  <Chip
                    key={wd}
                    selected={active}
                    onClick={() =>
                      setRule((r) => ({
                        ...r,
                        weekdays: active ? r.weekdays.filter((w) => w !== wd) : [...r.weekdays, wd].sort(),
                      }))
                    }
                  >
                    {t(`weekdaysShort.${wd}` as never)}
                  </Chip>
                );
              })}
            </div>
            {!weekdaysValid && <p className="mt-1.5 text-sm text-danger">{t('slots.wizard.exceptionWeekdaysEmpty')}</p>}
          </div>
        )}

        {currentStep === 'density' && (
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="flex flex-1 flex-col gap-3">
              <p className="text-sm font-medium text-fg">{t('slots.wizard.density.question')}</p>
              {/* Плотность «Фиксированный» / «Оптимальный» / «Динамичный» — data-f="F-03-057", data-f="F-03-058", data-f="F-03-059" */}
              {(
                [
                  ['fixed', 'F-03-057'],
                  ['optimal', 'F-03-058'],
                  ['dynamic', 'F-03-059'],
                ] as [SlotDensity, string][]
              ).map(([d, fid]) => (
                <Radio
                  key={d}
                  name="density"
                  checked={rule.density === d}
                  onChange={() => setDensity(d)}
                  className="rounded-xl border border-border p-3 has-checked:border-primary has-checked:bg-primary-soft"
                  label={<span className="font-medium text-fg">{t(`slots.wizard.density.${d}` as never)}</span>}
                  description={t(`slots.wizard.density.${d}Hint` as never)}
                  data-f={fid}
                />
              ))}
            </div>
            <div className="flex-1 rounded-xl bg-surface-2 p-4">
              <p className="text-sm font-medium text-fg">{t(`slots.wizard.density.${rule.density}Example` as never)}</p>
              <p className="mt-3 text-sm text-muted">
                {t('slots.wizard.density.livePreview', { from: exampleHours[0].from, to: exampleHours[exampleHours.length - 1].to })}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {preview.slice(0, 10).map((p) => (
                  <span
                    key={p.time}
                    className={`rounded-md px-2 py-1 text-sm ${p.extra ? 'bg-accent-soft text-accent' : 'bg-surface-3 text-fg'}`}
                  >
                    {p.time}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {currentStep === 'start' && (
          <div className="flex flex-col gap-3" data-f="F-02-049 F-03-060">
            <p className="text-sm font-medium text-fg">{t('slots.wizard.start.question')}</p>
            <div className="flex flex-col gap-2 rounded-xl border border-border p-3 has-checked:border-primary has-checked:bg-primary-soft">
              <Radio
                name="start"
                checked={rule.startMode === 'from_window'}
                onChange={() => setStartMode('from_window')}
                label={t('slots.wizard.start.window')}
                description={t('slots.wizard.start.windowHint')}
              />
              {rule.startMode === 'from_window' && (
                <div className="flex flex-wrap items-center gap-2 pl-8">
                  <span className="text-sm text-muted">{t('slots.wizard.start.windowFrom')}</span>
                  <TimePicker value={rule.windowFrom} max="24:00" onValueChange={(v) => setRule((r) => ({ ...r, windowFrom: v }))} />
                  <span className="text-sm text-muted">{t('slots.wizard.start.windowTo')}</span>
                  <TimePicker value={rule.windowTo} max="24:00" onValueChange={(v) => setRule((r) => ({ ...r, windowTo: v }))} />
                </div>
              )}
            </div>
            <Radio
              name="start"
              checked={rule.startMode === 'from_shift_start'}
              onChange={() => setStartMode('from_shift_start')}
              className="rounded-xl border border-border p-3 has-checked:border-primary has-checked:bg-primary-soft"
              label={t('slots.wizard.start.shift')}
              description={t('slots.wizard.start.shiftHint')}
            />
          </div>
        )}

        {currentStep === 'step' && (
          <div className="flex flex-col gap-2" data-f="F-03-061">
            <p className="text-sm font-medium text-fg">{t('slots.wizard.step.question')}</p>
            <Select
              options={stepOptions().map((m) => ({
                value: String(m),
                label: format.duration(m),
              }))}
              value={String(rule.stepMin)}
              onValueChange={(v) => setRule((r) => ({ ...r, stepMin: Number(v) }))}
              className="max-w-xs"
            />
            <p className="text-sm text-muted">{t('slots.wizard.step.hint')}</p>
          </div>
        )}

        {currentStep === 'lead' && (
          <div data-f="F-02-056 F-03-062" className="flex flex-col gap-2">
            <p className="text-sm font-medium text-fg">{t('slots.wizard.lead.question')}</p>
            <Select
              options={[
                { value: '0', label: t('slots.wizard.lead.notSet') },
                ...leadTimeOptions().map((m) => ({
                  value: String(m),
                  label: format.duration(m),
                })),
              ]}
              value={String(rule.leadTimeMin ?? 0)}
              onValueChange={(v) => setRule((r) => ({ ...r, leadTimeMin: Number(v) || undefined }))}
              className="max-w-xs"
            />
            <p className="text-sm text-muted">{t('slots.wizard.lead.hint')}</p>
            <p className="text-sm text-muted">{t('slots.wizard.lead.mobileNote')}</p>
          </div>
        )}

        {currentStep === 'manual' && (
          <div className="rounded-xl bg-surface-2 p-4">
            <p className="text-sm font-medium text-fg">{t('slots.wizard.manual.title')}</p>
            <p className="mt-1.5 text-sm text-muted">{t('slots.wizard.manual.text')}</p>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-border pt-4">
          <Button variant="ghost" onClick={close}>
            {t('slots.wizard.close')}
          </Button>
          <div className="flex gap-2">
            {stepIndex > 0 && (
              <Button variant="outline" onClick={back}>
                {t('slots.wizard.back')}
              </Button>
            )}
            {stepIndex < steps.length - 1 ? (
              <Button onClick={next} disabled={!weekdaysValid}>
                {t('slots.wizard.next')}
              </Button>
            ) : (
              <Button onClick={finish} loading={saving} disabled={!weekdaysValid}>
                {t('slots.wizard.finish')}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
