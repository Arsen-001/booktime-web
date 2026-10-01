'use client';

/**
 * /biz/settings/system — «Основные» (F-15-113…117, F-15-136): внутреннее имя, сфера (заблокировано, ссылка),
 * страна/город, формат даты и времени, язык уведомлений клиентам, часовой пояс (показ).
 * F-15-009 (частично, наша доля): значения на этом экране для НОВОГО бизнеса приходят уже заполненными из
 * сида среза settings (город Ереван, формат времени, язык сообщений — `src/mock/slices/settings.ts`), плюс
 * подписка/счета/категории записи того же среза — «кабинет готов к работе сразу» без нашего участия при
 * регистрации. Остальные умолчания из «Готово когда» (кассы, статьи платежей, шаблоны ролей, склад) — сиды
 * других разделов, не наши.
 */
import { Globe, Palette } from 'lucide-react';
import Link from 'next/link';
import type { SettingsLang } from '@/domain/settings';
import { useCoreGet } from '@/api/core';
import { saveSystemSettings, saveWebhookSettings, useSystemSettings, useWebhookSettings } from '@/api/settings';
import { useApiMutation } from '@/api/request';
import { useCan, useCurrent, useSphere } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { Select } from '@/ui/Select';
import { StickyActionBar } from '@/ui/StickyActionBar';
import { useToast } from '@/ui/Toast';
import { NetworkMembershipCard } from '@/areas/settings/NetworkMembershipCard';
import { WebhookCard, type WebhookDraft } from '@/areas/settings/WebhookCard';
import { sameValue, useSettingsDraft } from '@/areas/settings/useSettingsDraft';
import { useRememberedFlag } from '@/areas/settings/useRememberedFlag';

interface Draft {
  internalName: string;
  city: string;
  dateTimeFormat: '24' | '12';
  messageLanguage: SettingsLang;
  webhook: WebhookDraft;
}

const LANG_OPTIONS: { value: SettingsLang; label: string }[] = [
  { value: 'ru', label: 'Русский' },
  { value: 'hy', label: 'Հայերեն' },
  { value: 'en', label: 'English' },
];

export function SystemScreen() {
  const t = useT('settings');
  const tc = useT('common');
  const toast = useToast();
  const { businessId, staffId, ready } = useCurrent();
  const canManage = useCan('settings.manage');
  const { config: sphereConfig } = useSphere();
  const q = useSystemSettings(businessId, { enabled: ready });
  const bizQ = useCoreGet('businesses', businessId, { enabled: ready });

  const webhookQ = useWebhookSettings(businessId, { enabled: ready });

  // Н5/Н11: одна форма, одна кнопка. Формат времени — тот же, что читает журнал (getSystemSettings берёт его
  // из настроек журнала), вебхук — часть этой же формы.
  const form = useSettingsDraft<Draft>(
    q.data && bizQ.data && webhookQ.data
      ? {
          internalName: bizQ.data.name,
          city: q.data.city,
          dateTimeFormat: q.data.dateTimeFormat,
          messageLanguage: q.data.messageLanguage,
          webhook: {
            enabled: webhookQ.data.enabled,
            url: webhookQ.data.url ?? '',
            entities: webhookQ.data.entities,
          },
        }
      : undefined,
    ready ? businessId : undefined,
  );
  const { draft, dirty, setDraft } = form;
  const loading = !ready || q.isLoading || bizQ.isLoading || webhookQ.isLoading || !draft;
  // Вебхук включён — под переключателем адрес и галочки; до ответа — как было в прошлый раз (в демо выключен)
  const webhookOn = useRememberedFlag('webhook-enabled', loading, draft?.webhook.enabled, false);
  const d: Draft = draft ?? { internalName: '', city: 'Yerevan', dateTimeFormat: '24', messageLanguage: 'ru', webhook: { enabled: webhookOn, url: '', entities: [] } };
  const save = useApiMutation(saveSystemSettings, {
    // Формат времени читает журнал — его настройки перечитываются сразу (в режиме api тоже)
    invalidates: [['journal']],
  });
  const saveWebhook = useApiMutation(saveWebhookSettings);

  async function handleSave() {
    if (!draft || !businessId) return;
    try {
      await save.mutate({
        businessId,
        staffId,
        internalName: draft.internalName || undefined,
        city: draft.city,
        dateTimeFormat: draft.dateTimeFormat,
        messageLanguage: draft.messageLanguage,
      });
      if (
        webhookQ.data &&
        !sameValue(draft.webhook, {
          enabled: webhookQ.data.enabled,
          url: webhookQ.data.url ?? '',
          entities: webhookQ.data.entities,
        })
      ) {
        await saveWebhook.mutate({
          businessId,
          staffId,
          enabled: draft.webhook.enabled,
          url: draft.webhook.url.trim() || undefined,
          entities: draft.webhook.entities,
        });
      }
      form.markSaved();
      toast.success(t('system.saved'));
    } catch {
      toast.error(t('system.saveFailed'));
    }
  }

  const now = new Date();
  const sample24 = `${now.toLocaleDateString('ru-RU')}, ${now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
  const sample12 = `${now.toLocaleDateString('en-US')}, ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`;

  return (
    <div
      data-f="F-15-113 F-15-114 F-15-115 F-15-116 F-15-117 F-15-136 F-15-135 F-15-029 F-15-009"
      className="mx-auto flex w-full max-w-[760px] flex-col gap-6"
    >
      <PageHeader
        title={t('system.title')}
        description={t('system.description')}
        back={{ href: '/biz/settings' }}
      />

      {q.isError || bizQ.isError ? (
        <ErrorState
          onRetry={() => {
            q.refetch();
            bizQ.refetch();
          }}
        />
      ) : !loading && !canManage ? (
        <EmptyState
          icon={<Globe aria-hidden />}
          title={t('system.accessDenied')}
        />
      ) : (
        // До ответа — та же форма с пустыми выключенными полями (DESIGN.md «The skeleton IS the page»)
        <fieldset disabled={loading} aria-busy={loading || undefined} className="contents">
          <SectionCard title={t('system.mainTitle')}>
            <div className="flex flex-col gap-4">
              <FormField
                label={t('system.internalNameLabel')}
                hint={t('system.internalNameHint')}
              >
                <Input
                  value={d.internalName}
                  onChange={(e) =>
                    setDraft({ ...d, internalName: e.target.value })
                  }
                  placeholder={t('system.internalNamePlaceholder')}
                />
              </FormField>

              <div data-f="F-15-029" className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-fg">
                  {t('system.sphereLabel')}
                </span>
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-2/50 px-3 py-2.5">
                  <span className="text-sm text-fg">
                    {tc(`spheres.${sphereConfig.id}` as never)}
                  </span>
                  <Link
                    href="/biz/settings/sphere"
                    className="text-sm font-medium text-accent-text hover:underline"
                  >
                    {t('system.sphereLink')}
                  </Link>
                </div>
              </div>

              <FormField label={t('system.countryLabel')}>
                <Input value={t('system.countryValue')} disabled />
              </FormField>
              <FormField
                label={t('system.cityLabel')}
                hint={t('system.cityHint')}
              >
                <Select
                  value={d.city}
                  onValueChange={(v) => setDraft({ ...d, city: v })}
                  options={[
                    { value: 'Yerevan', label: t('system.cityYerevan') },
                  ]}
                />
              </FormField>
              {/* F-02-074: часовой пояс локации — от города, один пояс (Армения); справочный текст */}
              <div data-f="F-02-074" className="contents">
                <FormField label={t('system.timezoneLabel')}>
                  <Input value="Asia/Yerevan" disabled />
                </FormField>
              </div>

              <FormField label={t('system.dateFormatLabel')} hint={t('system.dateFormatHint')}>
                <SegmentedControl
                  value={d.dateTimeFormat}
                  onValueChange={(v) =>
                    setDraft({ ...d, dateTimeFormat: v as '24' | '12' })
                  }
                  options={[
                    { value: '24', label: sample24 },
                    { value: '12', label: sample12 },
                  ]}
                />
              </FormField>

              <FormField
                label={t('system.messageLanguageLabel')}
                hint={t('system.messageLanguageHint')}
              >
                {/* F-15-135: значение проставлено сама система при регистрации (сид бизнеса), здесь его видно и можно сменить */}
                <Select
                  value={d.messageLanguage}
                  onValueChange={(v) =>
                    setDraft({ ...d, messageLanguage: v as SettingsLang })
                  }
                  options={LANG_OPTIONS}
                />
              </FormField>
            </div>
          </SectionCard>

          <SectionCard title={t('system.appearanceTitle')}>
            <div data-f="F-15-182" className="flex items-start gap-3 rounded-lg bg-surface-2/50 px-3.5 py-3">
              <Palette aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
              <p className="text-sm text-muted">{t('system.appearanceHint')}</p>
            </div>
          </SectionCard>

          <NetworkMembershipCard businessId={businessId} ready={ready} />
          <WebhookCard
            value={d.webhook}
            onChange={(webhook) => setDraft({ ...d, webhook })}
            canManage={canManage}
          />

          <StickyActionBar>
            <Button
              onClick={handleSave}
              disabled={!dirty}
              loading={save.isPending || saveWebhook.isPending}
            >
              {t('system.save')}
            </Button>
          </StickyActionBar>
        </fieldset>
      )}
    </div>
  );
}
