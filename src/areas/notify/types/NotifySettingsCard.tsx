'use client';

/**
 * Язык и формат уведомлений клиенту (F-05-010, F-05-011) и тихие часы (Ув12) — общие для всех типов, поэтому живут
 * на экране «Типы уведомлений» (Ув3), а не на вкладке шаблона одного типа: там смена языка выглядела как правка
 * шаблона, а на деле меняла язык отправки всего салона. Язык с Н5 (28.09) — один на бизнес, в «Системных»: здесь
 * только показ и ссылка. Каждое поле сохраняется сразу и оптимистично —
 * без тоста на каждое изменение, тост только при ошибке.
 */
import Link from 'next/link';
import { getNotifySettings, updateNotifySettings } from '@/api/notify';
import { useMessageLanguage } from '@/api/settings';
import { optimistic, useApiMutation, useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import type { TimeHM } from '@/domain/core';
import { DEFAULT_QUIET_HOURS } from '@/domain/notify';
import type { NotifyDateFormat, NotifyLanguage, NotifySettings } from '@/domain/notify';
import { useT } from '@/i18n/useT';
import { Collapse } from '@/ui/Collapse';
import { FormField } from '@/ui/FormField';
import { SectionCard } from '@/ui/SectionCard';
import { Select } from '@/ui/Select';
import { SkeletonText } from '@/ui/Skeleton';
import { Switch } from '@/ui/Switch';
import { TimePicker } from '@/ui/TimePicker';
import { useToast } from '@/ui/Toast';

export const NOTIFY_LANGUAGE_OPTIONS: { value: NotifyLanguage; label: string }[] = [
  { value: 'hy', label: 'Հայերեն' },
  { value: 'ru', label: 'Русский' },
  { value: 'en', label: 'English' },
];

export function NotifySettingsCard() {
  const t = useT('notify');
  const toast = useToast();
  const { ready, businessId } = useCurrent();
  const settingsQ = useApiQuery(['notify', 'settings', businessId], () => getNotifySettings(businessId!), { enabled: ready && !!businessId });
  const messageLang = useMessageLanguage(businessId, { enabled: ready });
  const save = useApiMutation(updateNotifySettings, {
    optimistic: optimistic<NotifySettings, { businessId: string; settings: NotifySettings }>(
      (args) => ['notify', 'settings', args.businessId],
      (_old, args) => args.settings,
    ),
  });

  const settings: NotifySettings | undefined = settingsQ.data;
  const loading = !settings;
  const quiet = settings?.quietHours ?? DEFAULT_QUIET_HOURS;

  const patch = async (next: Partial<NotifySettings>) => {
    if (!businessId || !settings) return;
    try {
      await save.mutate({ businessId, settings: { ...settings, quietHours: quiet, ...next } });
    } catch {
      toast.error(t('typeDetail.saveFailed'));
    }
  };

  return (
    <div data-f="F-05-010 F-05-011">
      <SectionCard title={t('settingsCard.title')} description={t('settingsCard.hint')}>
        {/* Загрузка — та же форма со значениями по умолчанию (выключена): пришли настройки — ничего не сдвинулось */}
        {(
          <div className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Н5: язык сообщений клиентам — один источник, «Системные»; здесь только показ и ссылка */}
              <FormField label={t('typeDetail.languageLabel')} hint={t('typeDetail.languageHint')}>
                <div className="flex min-h-11 flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-1.5">
                  <span className="text-fg">{loading ? <SkeletonText width="8ch" /> : (NOTIFY_LANGUAGE_OPTIONS.find((o) => o.value === messageLang)?.label ?? messageLang)}</span>
                  <Link href="/biz/settings/system" className="inline-flex min-h-10 items-center text-sm font-medium text-primary-text hover:underline">
                    {t('typeDetail.sendLanguageLink')}
                  </Link>
                </div>
              </FormField>
              <FormField label={t('typeDetail.dateFormatLabel')}>
                <Select
                  options={[
                    { value: '24h', label: t('typeDetail.dateFormat24') },
                    { value: '12h', label: t('typeDetail.dateFormat12') },
                  ]}
                  value={settings?.dateFormat ?? '24h'}
                  disabled={loading}
                  onValueChange={(v) => patch({ dateFormat: v as NotifyDateFormat })}
                />
              </FormField>
            </div>
            <div className="flex flex-col gap-3 border-t border-border pt-4">
              <Switch
                checked={quiet.enabled}
                disabled={loading}
                onCheckedChange={(enabled) => patch({ quietHours: { ...quiet, enabled } })}
                label={t('settingsCard.quietTitle')}
                description={t('settingsCard.quietHint', { from: quiet.from, to: quiet.to })}
              />
              <Collapse open={quiet.enabled}>
                <div className="grid grid-cols-2 gap-4 sm:max-w-md">
                  <FormField label={t('settingsCard.quietFrom')}>
                    <TimePicker step={30} value={quiet.from as TimeHM} disabled={loading} onValueChange={(from) => patch({ quietHours: { ...quiet, from } })} />
                  </FormField>
                  <FormField label={t('settingsCard.quietTo')}>
                    <TimePicker step={30} value={quiet.to as TimeHM} disabled={loading} onValueChange={(to) => patch({ quietHours: { ...quiet, to } })} />
                  </FormField>
                </div>
              </Collapse>
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
