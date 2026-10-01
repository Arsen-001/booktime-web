'use client';

/**
 * «Онлайн-запись» в основном блоке формы услуги (У20, У24): тумблер наверху, рядом с названием, а не последним в
 * длинной форме; предупреждение, если некому записывать (У8, У21); «Доступна ограниченное время» — даты, дни недели
 * и часы для сезонных и акционных услуг (F-02-067, F-03-129). Онлайн-предоплата появится вместе с кошельком (F-00-028).
 */
import { AlertTriangle } from 'lucide-react';
import type { ServiceOnlineWindow } from '@/domain/services';
import { useT } from '@/i18n/useT';
import { DateRangePicker } from '@/ui/DateRangePicker';
import { Collapse } from '@/ui/Collapse';
import { FormField } from '@/ui/FormField';
import { Switch } from '@/ui/Switch';
import { TimePicker } from '@/ui/TimePicker';
import { WeekdayPicker } from '@/ui/WeekdayPicker';

export interface OnlineBookingBlockProps {
  online: boolean;
  onOnlineChange: (on: boolean) => void;
  window: ServiceOnlineWindow;
  onWindowChange: (w: ServiceOnlineWindow) => void;
  noStaff: boolean;
  disabled?: boolean;
}

export function OnlineBookingBlock({ online, onOnlineChange, window: w, onWindowChange, noStaff, disabled }: OnlineBookingBlockProps) {
  const t = useT('services');
  return (
    <div data-f="F-00-081 F-02-067 F-03-129 F-02-068" className="flex flex-col gap-3 rounded-xl border border-border bg-surface-2/50 p-3.5">
      <Switch
        checked={online}
        onCheckedChange={onOnlineChange}
        disabled={disabled}
        label={t('form.onlineLabel')}
        description={t('form.onlineHint')}
      />
      <Collapse open={online && noStaff}>
        <p className="flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">
          <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
          {t('form.onlineNoStaff')}
        </p>
      </Collapse>
      <Collapse open={online}>
        <Switch
          checked={w.enabled}
          onCheckedChange={(enabled) => onWindowChange({ ...w, enabled })}
          disabled={disabled}
          label={t('form.limitedLabel')}
          description={t('form.limitedHint')}
        />
      </Collapse>
      <Collapse open={online && w.enabled}>
        <div className="flex flex-col gap-3 pl-1">
          <FormField label={t('form.limitedDates')} optional>
            <DateRangePicker
              value={{ from: w.dateFrom, to: w.dateTo }}
              onValueChange={(r) => onWindowChange({ ...w, dateFrom: r.from, dateTo: r.to })}
              disabled={disabled}
            />
          </FormField>
          <FormField label={t('form.limitedWeekdays')} optional>
            <WeekdayPicker value={w.weekdays ?? []} onValueChange={(weekdays) => onWindowChange({ ...w, weekdays })} disabled={disabled} />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label={t('form.limitedFrom')} optional>
              <TimePicker
                value={w.timeFrom ?? null}
                onValueChange={(timeFrom) => onWindowChange({ ...w, timeFrom })}
                step={30}
                disabled={disabled}
              />
            </FormField>
            <FormField label={t('form.limitedTo')} optional>
              <TimePicker
                value={w.timeTo ?? null}
                onValueChange={(timeTo) => onWindowChange({ ...w, timeTo })}
                step={30}
                disabled={disabled}
              />
            </FormField>
          </div>
        </div>
      </Collapse>
    </div>
  );
}
