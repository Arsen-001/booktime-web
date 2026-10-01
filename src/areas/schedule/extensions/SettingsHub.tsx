'use client';

/**
 * Вклад раздела «schedule» в хаб настроек /biz/settings (хост «settingsHub»). Две группы (ux-r5 E-2): «Онлайн-запись»
 * (любой мастер, запись поверх «Не пришёл», время на оплату) и «График» (на сколько вперёд, уведомлять мастера).
 * Посмотреть вклад без хозяина хоста: /dev/ext/settingsHub/schedule
 */
import {
  getAllowOnlineOverNoShow,
  getAnySpecialistAllowed,
  getNotifyMasterOnScheduleChange,
  getPlanningPeriodYears,
  setAllowOnlineOverNoShow,
  setAnySpecialistAllowed,
  setNotifyMasterOnScheduleChange,
  setPlanningPeriodYears,
} from '@/api/schedule';
import { PLANNING_PERIOD_YEARS, type PlanningPeriodYears } from '@/domain/schedule';
import { useCoreGet } from '@/api/core';
import { optimistic, useApiMutation, useApiQuery } from '@/api/request';
import type { SettingsHubExtProps } from '@/extensions/types';
import { SettingSwitch } from '@/areas/schedule/components/SettingSwitch';
import { useT } from '@/i18n/useT';
import { LinkButton } from '@/ui/Button';
import { FormField } from '@/ui/FormField';
import { SectionCard } from '@/ui/SectionCard';
import { Select } from '@/ui/Select';
import { useToast } from '@/ui/Toast';

export default function ScheduleSettingsHub({ businessId }: SettingsHubExtProps) {
  const t = useT('schedule');
  const toast = useToast();
  const periodKey = ['schedule', 'planning-period', businessId] as const;
  const periodQ = useApiQuery(periodKey, () => getPlanningPeriodYears(businessId));
  const savePeriod = useApiMutation((y: PlanningPeriodYears) => setPlanningPeriodYears(businessId, y), {
    optimistic: optimistic<PlanningPeriodYears, PlanningPeriodYears>(periodKey, (_o, v) => v),
  });
  // F-02-105: индивидуалу тумблер не нужен — его график никто другой не меняет
  const businessQ = useCoreGet('businesses', businessId);
  const isIndividual = businessQ.data?.kind === 'individual';

  return (
    <div className="flex flex-col gap-6">
      <SectionCard title={t('settingsHub.onlineTitle')} description={t('settingsHub.onlineSubtitle')}>
        <div className="flex flex-col gap-5">
          <div data-f="F-02-079">
            <SettingSwitch
              queryKey={['schedule', 'ext-any-allowed', businessId]}
              read={() => getAnySpecialistAllowed(businessId)}
              write={(v) => setAnySpecialistAllowed(businessId, v)}
              fallback={false}
              label={t('settingsHub.anySpecialist.title')}
              description={t('settingsHub.anySpecialist.hint')}
              savedText={(v) => (v ? t('settingsHub.anySpecialist.enabled') : t('settingsHub.anySpecialist.disabled'))}
            />
          </div>
          <div data-f="F-02-066">
            <SettingSwitch
              queryKey={['schedule', 'ext-noshow-online', businessId]}
              read={() => getAllowOnlineOverNoShow(businessId)}
              write={(v) => setAllowOnlineOverNoShow(businessId, v)}
              fallback
              label={t('settingsHub.noShowOnline.title')}
              description={t('settingsHub.noShowOnline.hint')}
              savedText={(v) => (v ? t('settingsHub.noShowOnline.enabled') : t('settingsHub.noShowOnline.disabled'))}
            />
          </div>
          <div data-f="F-02-071" className="flex flex-col gap-1.5">
            <p className="font-medium text-fg">{t('settingsHub.prepayWait.title')}</p>
            <p className="text-sm text-muted">{t('settingsHub.prepayWait.hint')}</p>
            <LinkButton href="/biz/staff" variant="secondary" size="sm" className="mt-1 self-start">
              {t('settingsHub.prepayWait.open')}
            </LinkButton>
          </div>
        </div>
      </SectionCard>

      <SectionCard title={t('settingsHub.scheduleTitle')} description={t('settingsHub.scheduleSubtitle')}>
        <div className="flex flex-col gap-5">
          <div data-f="F-02-030">
            <FormField label={t('settingsHub.planningPeriod.title')} hint={t('settingsHub.planningPeriod.hint')}>
              {/* Загрузка — тот же список, неактивный и без значения: высота поля та же */}
              {periodQ.isLoading ? (
                <Select className="max-w-xs" value="" options={[]} onValueChange={() => {}} disabled />
              ) : (
                <Select
                  className="max-w-xs"
                  value={String(periodQ.data ?? 1)}
                  options={PLANNING_PERIOD_YEARS.map((y) => ({ value: String(y), label: t('settingsHub.planningPeriod.years', { n: y }) }))}
                  onValueChange={(v) =>
                    void savePeriod.mutate(Number(v) as PlanningPeriodYears).then(
                      () => toast.success(t('settingsHub.saved')),
                      () => toast.error(t('settingsHub.saveFailed')),
                    )
                  }
                />
              )}
            </FormField>
          </div>
          {/* Пока бизнес грузится — показываем (у типичного салона тумблер есть), индивидуалу — уберём */}
          {!isIndividual && (
            <div data-f="F-02-105">
              <SettingSwitch
                queryKey={['schedule', 'ext-notify-master', businessId]}
                read={() => getNotifyMasterOnScheduleChange(businessId)}
                write={(v) => setNotifyMasterOnScheduleChange(businessId, v)}
                fallback={false}
                label={t('settingsHub.notifyMaster.title')}
                description={t('settingsHub.notifyMaster.hint')}
              />
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
