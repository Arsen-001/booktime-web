'use client';

/**
 * ⭐ «Запись на сдачу» (05.10.2026): клиент на странице мастерской выбирает короткое окно, когда принесёт вещь, и пишет,
 * что сдаёт; мастерская знает, кого ждать, и принимает заказ по записи одним нажатием. Настройка: вкл/выкл, сколько
 * времени на приём, кто принимает. Каждое изменение сохраняется сразу (как «Заказы» вкл/выкл).
 */
import { ExternalLink } from 'lucide-react';
import { useCoreGet, useCoreList } from '@/api/core';
import { ordersKeys, setIntakeSettings } from '@/api/orders';
import { optimistic, useApiMutation } from '@/api/request';
import { useCan, useCurrent } from '@/demo/hooks';
import type { Id } from '@/domain/core';
import { DEFAULT_INTAKE_SLOT_MIN, INTAKE_SLOT_OPTIONS, type IntakeSettings, type IntakeSettingsInput } from '@/domain/orders';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { useIntakeSettings } from '@/areas/orders/lib/useOrdersData';
import { Checkbox } from '@/ui/Checkbox';
import { FormField } from '@/ui/FormField';
import { SectionCard } from '@/ui/SectionCard';
import { Select } from '@/ui/Select';
import { Skeleton } from '@/ui/Skeleton';
import { Switch } from '@/ui/Switch';
import { useToast } from '@/ui/Toast';

type SaveArgs = { businessId: Id; input: IntakeSettingsInput };

export function IntakeCard() {
  const t = useT('orders');
  const fmt = useFormat();
  const toast = useToast();
  const { ready, businessId } = useCurrent();
  const canManage = useCan('settings.manage');
  const q = useIntakeSettings();
  const businessQ = useCoreGet('businesses', businessId, { enabled: ready });
  const staffQ = useCoreList('staff', { businessId: businessId ?? '' }, { enabled: ready && Boolean(businessId) });
  const save = useApiMutation(setIntakeSettings, {
    optimistic: optimistic<IntakeSettings, SaveArgs>(
      (a) => ordersKeys.intake(a.businessId),
      (old, a) => ({ ...old, enabled: a.input.enabled, slotMin: a.input.slotMin, staffIds: a.input.staffIds ?? old.staffIds }),
    ),
  });

  const staff = (staffQ.data ?? []).filter((s) => s.status === 'active');
  const settings = q.data;
  const enabled = settings?.enabled ?? false;
  const slotMin = settings?.slotMin ?? DEFAULT_INTAKE_SLOT_MIN;
  // Ещё не настраивали — принимают все
  const chosen = settings?.staffIds.length ? settings.staffIds.filter((id) => staff.some((s) => s.id === id)) : staff.map((s) => s.id);
  const slug = businessQ.data?.slug;

  async function change(patch: Partial<IntakeSettingsInput>, okKey: 'savedOn' | 'savedOff' | 'saved') {
    if (!businessId) return;
    try {
      await save.mutate({ businessId, input: { enabled, slotMin, staffIds: chosen, ...patch } });
      toast.success(t(`settings.intake.${okKey}`));
    } catch (e) {
      toast.error((e as { code?: string } | undefined)?.code === 'intake_no_staff' ? t('settings.intake.noStaff') : t('toast.failed'));
    }
  }

  const toggleStaff = (id: Id, on: boolean) => void change({ staffIds: on ? [...chosen, id] : chosen.filter((x) => x !== id) }, 'saved');
  const disabled = !canManage || q.isLoading || save.isPending;

  return (
    <div data-f="orders-intake-settings">
      <SectionCard title={t('settings.intake.title')} description={t('settings.intake.description')}>
        <div className="flex flex-col gap-5">
          <Switch
            checked={enabled}
            disabled={disabled || !staff.length}
            onCheckedChange={(v) => void change({ enabled: v }, v ? 'savedOn' : 'savedOff')}
            label={t('settings.intake.toggleLabel')}
            description={t('settings.intake.toggleHint')}
            labelPosition="start"
          />
          {q.isLoading ? (
            <Skeleton variant="rect" className="h-11 w-full rounded-lg" />
          ) : (
            enabled && (
              <>
                <FormField label={t('settings.intake.slot')} hint={t('settings.intake.slotHint')}>
                  <Select
                    value={String(slotMin)}
                    disabled={disabled}
                    onValueChange={(v) => void change({ slotMin: Number(v) }, 'saved')}
                    options={INTAKE_SLOT_OPTIONS.map((m) => ({ value: String(m), label: fmt.duration(m) }))}
                  />
                </FormField>
                <fieldset className="flex flex-col gap-1">
                  <legend className="mb-1 text-sm font-medium text-fg">{t('settings.intake.staff')}</legend>
                  <p className="mb-1 text-sm text-muted">{t('settings.intake.staffHint')}</p>
                  {staff.map((s) => {
                    const on = chosen.includes(s.id);
                    return (
                      <Checkbox
                        key={s.id}
                        checked={on}
                        // Последнего принимающего не снять — иначе запись на сдачу некому принимать
                        disabled={disabled || (on && chosen.length === 1)}
                        onCheckedChange={(v) => toggleStaff(s.id, v)}
                        label={s.name}
                      />
                    );
                  })}
                </fieldset>
                {slug && (
                  <a
                    href={`/b/${slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-10 items-center gap-1.5 self-start rounded-lg px-2 text-sm font-medium text-primary-text hover:bg-primary-soft"
                  >
                    <ExternalLink aria-hidden className="size-4" />
                    {t('settings.intake.openPage')}
                  </a>
                )}
              </>
            )
          )}
          {!canManage && <p className="text-sm text-muted">{t('settings.noRights')}</p>}
        </div>
      </SectionCard>
    </div>
  );
}
