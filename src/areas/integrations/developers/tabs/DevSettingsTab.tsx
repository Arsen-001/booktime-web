'use client';

/**
 * F-13-035: «Настройки для разработки» — адрес регистрации (обязателен для модерации), callback, адрес
 * вебхуков. F-13-066: этот вебхук-адрес у непубличного приложения — новый путь поставить вебхуки в свою
 * локацию (F-13-065 в /biz/integrations/api «Вебхуки» ведёт сюда).
 */
import { useState } from 'react';
import { updateDevAppDevSettings } from '@/api/integrations';
import { useApiMutation } from '@/api/request';
import type { DevApp } from '@/domain/integrations';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { SectionCard } from '@/ui/SectionCard';
import { Switch } from '@/ui/Switch';
import { useToast } from '@/ui/Toast';

export function DevSettingsTab({ app, onChanged }: { app: DevApp; onChanged: () => void }) {
  const t = useT('integrations');
  const toast = useToast();
  const [form, setForm] = useState(app.devSettings);
  const mutation = useApiMutation((patch: typeof form) => updateDevAppDevSettings(app.id, patch));

  const save = async () => {
    try {
      await mutation.mutate(form);
      toast.success(t('developers.devSettings.saved'));
      onChanged();
    } catch {
      toast.error(t('errors.actionFailed'));
    }
  };

  return (
    <div data-f="F-13-035 F-13-039 F-13-040 F-13-041 F-13-042 F-13-066 F-01-202 F-01-203" className="flex flex-col gap-4">
      <SectionCard title={t('developers.devSettings.addressesTitle')} description={t('developers.devSettings.addressesHint')}>
        <div className="flex flex-col gap-4">
          <FormField label={t('developers.devSettings.registrationUrl')} required hint={t('developers.devSettings.registrationUrlHint')}>
            <Input
              value={form.registrationUrl}
              onChange={(e) => setForm((f) => ({ ...f, registrationUrl: e.target.value }))}
              placeholder="https://"
            />
          </FormField>
          <FormField label={t('developers.devSettings.callbackUrl')} optional hint={t('developers.devSettings.callbackUrlHint')}>
            <Input value={form.callbackUrl ?? ''} onChange={(e) => setForm((f) => ({ ...f, callbackUrl: e.target.value }))} placeholder="https://" />
          </FormField>
          {app.isPrivate && (
            <FormField label={t('developers.devSettings.webhookUrl')} optional hint={t('developers.devSettings.webhookUrlHint')}>
              <Input value={form.webhookUrl ?? ''} onChange={(e) => setForm((f) => ({ ...f, webhookUrl: e.target.value }))} placeholder="https://" />
            </FormField>
          )}
        </div>
      </SectionCard>

      <SectionCard title={t('developers.devSettings.modesTitle')}>
        <div className="flex flex-col gap-4">
          <Switch
            checked={form.passUserData}
            onCheckedChange={(v) => setForm((f) => ({ ...f, passUserData: v }))}
            label={t('developers.devSettings.passUserData')}
            description={t('developers.devSettings.passUserDataHint')}
          />
          <Switch
            checked={form.iframeMode}
            onCheckedChange={(v) => setForm((f) => ({ ...f, iframeMode: v }))}
            label={t('developers.devSettings.iframeMode')}
            description={t('developers.devSettings.iframeModeHint')}
          />
          {form.iframeMode && form.registrationUrl.trim() && (
            <div className="flex flex-col gap-1.5 rounded-lg border border-dashed border-border-strong/60 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t('developers.devSettings.iframePreviewLabel')}</p>
              <p className="truncate rounded-md bg-surface-2 px-2.5 py-2 font-mono text-xs text-muted">
                {form.registrationUrl}?salon_id=…&amp;user_data=…
              </p>
            </div>
          )}
          <Switch
            checked={form.allowMultiLocation}
            onCheckedChange={(v) => setForm((f) => ({ ...f, allowMultiLocation: v }))}
            label={t('developers.devSettings.allowMultiLocation')}
            description={t('developers.devSettings.allowMultiLocationHint')}
          />
        </div>
      </SectionCard>

      <Button loading={mutation.isPending} onClick={save} className="self-start">
        {t('developers.devSettings.save')}
      </Button>
    </div>
  );
}
