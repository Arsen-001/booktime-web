'use client';

/**
 * Условия отправки, специфичные для типа (F-05-009, F-05-024…F-05-040): рендерится внутри «Основных
 * настроек» страницы типа — набор полей зависит от `code`. Типы без своих условий («условий нет» в
 * ТЗ: 2, 8, 9, 4, 75, 16, 85, 7, 65) не показывают этот блок вовсе — вызывающая сторона решает, звать ли.
 */
import type { ReactNode } from 'react';
import type { TypeConditions } from '@/domain/notify';
import { useT } from '@/i18n/useT';
import { Checkbox } from '@/ui/Checkbox';
import { Select } from '@/ui/Select';
import { TimePicker } from '@/ui/TimePicker';

const HOUR_OPTIONS = [1, 2, 3, 4, 5, 6, 9, 12, 15, 18, 21, 24];
const RESCHEDULE_MINUTE_OPTIONS = [5, 10, 15, 30];
const RESCHEDULE_HOUR_OPTIONS = [1, 2, 3, 6, 12, 24];
const REVIEW_MINUTE_OPTIONS = [1, 5, 15, 30, 60];
const INVITE_HOUR_OPTIONS = [1, 2, 4, 8, 24];
const DAY_OPTIONS = [1, 2, 3, 5, 7, 10, 14, 21, 30];

export interface TypeConditionsFieldsProps {
  code: number;
  conditions: TypeConditions;
  onChange: (patch: Partial<TypeConditions>) => void;
  disabled?: boolean;
}

/** Строки-значения порога переноса (F-05-027): -1 «Любое», иначе минуты (≤30) или часы×60 */
function rescheduleValue(minutes: number | undefined): string {
  if (minutes === undefined || minutes < 0) return 'any';
  return String(minutes);
}

function Row({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">{children}</div>;
}

function Label({ children }: { children: ReactNode }) {
  return <span className="text-sm font-medium text-fg">{children}</span>;
}

export function TypeConditionsFields({ code, conditions, onChange, disabled }: TypeConditionsFieldsProps) {
  const t = useT('notify');

  // Тип 74 — изменение записи
  if (code === 74) {
    const rescheduleOptions = [
      { value: 'any', label: t('conditions.rescheduleAny') },
      ...RESCHEDULE_MINUTE_OPTIONS.map((m) => ({ value: String(m), label: t('conditions.rescheduleMinutesOption', { m }) })),
      ...RESCHEDULE_HOUR_OPTIONS.map((h) => ({ value: String(h * 60), label: t('conditions.rescheduleHoursOption', { h }) })),
    ];
    return (
      <div className="flex flex-col gap-4">
        <Row>
          <Label>{t('conditions.rescheduleThresholdLabel')}</Label>
          <Select
            className="w-full sm:w-64"
            options={rescheduleOptions}
            value={rescheduleValue(conditions.rescheduleThresholdMinutes)}
            disabled={disabled}
            onValueChange={(v) => onChange({ rescheduleThresholdMinutes: v === 'any' ? -1 : Number(v) })}
          />
        </Row>
        <Row>
          <Label>{t('conditions.rescheduleSourceLabel')}</Label>
          <Select
            className="w-full sm:w-64"
            options={[
              { value: 'client', label: t('conditions.rescheduleSourceClient') },
              { value: 'staff', label: t('conditions.rescheduleSourceStaff') },
              { value: 'all', label: t('conditions.rescheduleSourceAll') },
            ]}
            value={conditions.rescheduleSource ?? 'all'}
            disabled={disabled}
            onValueChange={(v) => onChange({ rescheduleSource: v as 'client' | 'staff' | 'all' })}
          />
        </Row>
      </div>
    );
  }

  // Тип 73 — запрос подтверждения
  if (code === 73) {
    return (
      <div className="flex flex-col gap-4">
        <Row>
          <Label>{t('conditions.timingHoursLabel')}</Label>
          <Select
            className="w-full sm:w-56"
            options={HOUR_OPTIONS.map((h) => ({ value: String(h), label: t('conditions.hoursOption', { h }) }))}
            value={String(conditions.timingHours ?? 24)}
            disabled={disabled || !!conditions.useSpecificTime}
            onValueChange={(v) => onChange({ timingHours: Number(v) })}
          />
        </Row>
        <Checkbox
          checked={!!conditions.useSpecificTime}
          disabled={disabled}
          onCheckedChange={(useSpecificTime) => onChange({ useSpecificTime })}
          label={t('conditions.useSpecificTimeToggle')}
        />
        {conditions.useSpecificTime && (
          <Row>
            <Label>{t('conditions.specificTimeLabel')}</Label>
            <TimePicker
              className="w-full sm:w-40"
              value={conditions.specificTime ?? '14:00'}
              disabled={disabled}
              onValueChange={(specificTime) => onChange({ specificTime })}
            />
          </Row>
        )}
      </div>
    );
  }

  // Тип 1 — напоминание о визите
  if (code === 1) {
    return (
      <div className="flex flex-col gap-4">
        <Row>
          <Label>{t('conditions.timingHoursLabel')}</Label>
          <Select
            className="w-full sm:w-56"
            options={HOUR_OPTIONS.map((h) => ({ value: String(h), label: t('conditions.hoursOption', { h }) }))}
            value={String(conditions.timingHours ?? 1)}
            disabled={disabled}
            onValueChange={(v) => onChange({ timingHours: Number(v) })}
          />
        </Row>
        {/* ⭐ 01.10.2026: одно правило с сервером (telegram-reminders.ts) — у Telegram своё время, не из этого поля */}
        <p className="text-sm text-muted" data-f="F-00-120">
          {t('conditions.telegramTimingNote')}
        </p>
        <Checkbox
          checked={conditions.emailTimingHours !== undefined}
          disabled={disabled}
          onCheckedChange={(on) => onChange({ emailTimingHours: on ? 12 : undefined })}
          label={t('conditions.emailTimingToggle')}
        />
        {conditions.emailTimingHours !== undefined && (
          <Row>
            <Label>{t('conditions.emailTimingLabel')}</Label>
            <Select
              className="w-full sm:w-56"
              options={HOUR_OPTIONS.map((h) => ({ value: String(h), label: t('conditions.hoursOption', { h }) }))}
              value={String(conditions.emailTimingHours)}
              disabled={disabled}
              onValueChange={(v) => onChange({ emailTimingHours: Number(v) })}
            />
          </Row>
        )}
      </div>
    );
  }

  // Тип 72 — приглашение недошедших
  if (code === 72) {
    return (
      <div className="flex flex-col gap-4" data-f="F-04-160">
        <Row>
          <Label>{t('conditions.inviteAfterLabel')}</Label>
          <Select
            className="w-full sm:w-56"
            options={[
              { value: '0', label: t('conditions.inviteAfterNow') },
              ...INVITE_HOUR_OPTIONS.map((h) => ({ value: String(h), label: t('conditions.inviteAfterHoursOption', { h }) })),
            ]}
            value={String(conditions.inviteAfterHours ?? 0)}
            disabled={disabled}
            onValueChange={(v) => onChange({ inviteAfterHours: Number(v) })}
          />
        </Row>
        <Row>
          <Label>{t('conditions.inviteStatusLabel')}</Label>
          <Select
            className="w-full sm:w-56"
            options={[
              { value: 'cancelled', label: t('conditions.inviteStatusCancelled') },
              { value: 'noShow', label: t('conditions.inviteStatusNoShow') },
              { value: 'all', label: t('conditions.inviteStatusAll') },
            ]}
            value={conditions.inviteStatusFilter ?? 'all'}
            disabled={disabled}
            onValueChange={(v) => onChange({ inviteStatusFilter: v as 'cancelled' | 'noShow' | 'all' })}
          />
        </Row>
      </div>
    );
  }

  // Типы 6, 20 — запрос отзыва
  if (code === 6 || code === 20) {
    const reviewed = conditions.reviewExcludeIfReviewed ?? {};
    return (
      <div className="flex flex-col gap-4">
        <Row>
          <Label>{t('conditions.reviewDelayLabel')}</Label>
          <Select
            className="w-full sm:w-56"
            options={REVIEW_MINUTE_OPTIONS.map((m) => ({ value: String(m), label: t('conditions.reviewDelayMinutesOption', { m }) }))}
            value={String(conditions.reviewDelayMinutes ?? 5)}
            disabled={disabled}
            onValueChange={(v) => onChange({ reviewDelayMinutes: Number(v) })}
          />
        </Row>
        <div className="flex flex-col gap-2">
          <Label>{t('conditions.reviewExcludeReviewedLabel')}</Label>
          <Checkbox
            checked={!!reviewed.location}
            disabled={disabled}
            onCheckedChange={(v) => onChange({ reviewExcludeIfReviewed: { ...reviewed, location: v } })}
            label={t('conditions.reviewExcludeReviewedLocation')}
          />
          <Checkbox
            checked={!!reviewed.staff}
            disabled={disabled}
            onCheckedChange={(v) => onChange({ reviewExcludeIfReviewed: { ...reviewed, staff: v } })}
            label={t('conditions.reviewExcludeReviewedStaff')}
          />
          <Checkbox
            checked={!!reviewed.service}
            disabled={disabled}
            onCheckedChange={(v) => onChange({ reviewExcludeIfReviewed: { ...reviewed, service: v } })}
            label={t('conditions.reviewExcludeReviewedService')}
          />
        </div>
      </div>
    );
  }

  // Тип 3 — день рождения
  if (code === 3) {
    return (
      <div className="flex flex-col gap-4" data-f="F-00-187 F-06-190">
        <Row>
          <Label>{t('conditions.birthdayModeLabel')}</Label>
          <Select
            className="w-full sm:w-56"
            options={[
              { value: 'onDay', label: t('conditions.birthdayOnDay') },
              ...[1, 2, 3, 5, 7, 10, 14].map((d) => ({ value: `days-${d}`, label: t('conditions.birthdayDaysBeforeOption', { d }) })),
            ]}
            value={conditions.birthdayMode === 'daysBefore' ? `days-${conditions.birthdayDaysBefore ?? 3}` : 'onDay'}
            disabled={disabled}
            onValueChange={(v) =>
              v === 'onDay'
                ? onChange({ birthdayMode: 'onDay' })
                : onChange({ birthdayMode: 'daysBefore', birthdayDaysBefore: Number(v.replace('days-', '')) })
            }
          />
        </Row>
        <Row>
          <Label>{t('conditions.birthdayTimeLabel')}</Label>
          <TimePicker
            className="w-full sm:w-40"
            value={conditions.birthdayTimeOfDay ?? '10:00'}
            disabled={disabled}
            onValueChange={(birthdayTimeOfDay) => onChange({ birthdayTimeOfDay })}
          />
        </Row>
      </div>
    );
  }

  // Тип 17 — окончание скидки
  if (code === 17) {
    return (
      <Row>
        <span data-f="F-04-122" className="contents">
          <Label>{t('conditions.discountExpiryLabel')}</Label>
          <Select
            className="w-full sm:w-56"
            options={[1, 2, 3, 5, 7, 10, 15].map((d) => ({ value: String(d), label: t('conditions.discountExpiryDaysOption', { d }) }))}
            value={String(conditions.discountExpiryDaysBefore ?? 3)}
            disabled={disabled}
            onValueChange={(v) => onChange({ discountExpiryDaysBefore: Number(v) })}
          />
        </span>
      </Row>
    );
  }

  // Тип 55 — приглашение на повторный визит
  if (code === 55) {
    return (
      <Row>
        <Label>{t('conditions.winbackLabel')}</Label>
        <Select
          className="w-full sm:w-56"
          options={DAY_OPTIONS.map((d) => ({ value: String(d), label: t('conditions.winbackDaysOption', { d }) }))}
          value={String(conditions.winbackAfterDays ?? 14)}
          disabled={disabled}
          onValueChange={(v) => onChange({ winbackAfterDays: Number(v) })}
        />
      </Row>
    );
  }

  return null;
}

/** Типы, у которых есть свои условия (F-05-024…F-05-040) — остальные «условий нет» по ТЗ */
export const TYPES_WITH_CONDITIONS = new Set([74, 73, 1, 72, 6, 20, 3, 17, 55]);

/**
 * Подмножество TYPES_WITH_CONDITIONS, привязанное к конкретной записи (F-05-009): у типов 74 (перенос),
 * 73 (подтверждение) и 1 (напоминание) время меняют вручную в окне записи, у 6/20 (отзыв) — там же,
 * запись всё ещё видна в карточке. У 3 (день рождения), 17 (сгорание скидки), 55 (повторный визит) и
 * 72 (недошедшие) привязки к карточке записи нет — подсказка про «плитку в её карточке» их не касается.
 */
export const HINT_FUTURE_ONLY_TYPES = new Set([74, 73, 1, 6, 20]);
