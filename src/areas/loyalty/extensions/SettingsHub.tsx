'use client';

/**
 * Вклад раздела «loyalty» в хаб настроек /biz/settings (хост «settingsHub»). Файл принадлежит разделу «loyalty».
 * Посмотреть вклад без хозяина хоста: /dev/ext/settingsHub/loyalty
 *
 * F-06-015/016/017: уведомления «Новая скидка» / «Окончание действия скидки» + переменные их шаблонов.
 * Сама персональная скидка и её правила (F-06-006…014, F-06-018/019) уже построены разделом «clients» как
 * «Клиенты → Программа лояльности» (`src/areas/clients/LoyaltyProgramScreen.tsx`, F-04-114…122/053…056) —
 * это тот же экран, что описывает 06-loyalty.md; см. qa/requests/loyalty.md. Здесь — то, что «clients» не
 * строил: сами push-уведомления клиенту (F-00-120) и подсказка по переменным их шаблона.
 */
import { useState } from 'react';
import { Bell, ExternalLink } from 'lucide-react';
import { getDiscountNotify, setDiscountNotify } from '@/api/loyalty';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useCan } from '@/demo/hooks';
import { defaultDiscountNotify, type DiscountNotifySettings } from '@/domain/loyalty';
import { NotifyTemplateField } from '@/areas/loyalty/NotifyTemplateField';
import type { SettingsHubExtProps } from '@/extensions/types';
import { useT } from '@/i18n/useT';
import { EmptyState } from '@/ui/EmptyState';
import { FormField } from '@/ui/FormField';
import { LinkButton } from '@/ui/Button';
import { Select } from '@/ui/Select';
import { SectionCard } from '@/ui/SectionCard';
import { useToast } from '@/ui/Toast';

const WARN_DAYS_OPTIONS = [1, 2, 3, 5, 7, 10, 15];

export default function LoyaltySettingsHub({ businessId }: SettingsHubExtProps) {
  const t = useT('loyalty');
  const toast = useToast();
  const canManage = useCan('loyalty.manage');

  const q = useApiQuery(['loyalty', 'discountNotify', businessId], () => getDiscountNotify(businessId));
  const save = useApiMutation((settings: DiscountNotifySettings) => setDiscountNotify(businessId, settings));

  const [draft, setDraft] = useState<DiscountNotifySettings | null>(null);
  const [seededFor, setSeededFor] = useState<string | undefined>(undefined);
  if (q.data && seededFor !== businessId) {
    setSeededFor(businessId);
    setDraft(q.data);
  }

  const loading = !draft;
  const form = draft ?? defaultDiscountNotify();

  if (!canManage) {
    return <EmptyState compact icon={<Bell aria-hidden />} title={t('settingsHub.title')} description={t('cardTypeForm.notFound')} />;
  }

  const commit = async (next: DiscountNotifySettings) => {
    setDraft(next);
    try {
      await save.mutate(next);
    } catch {
      toast.error(t('settingsHub.saveFailed'));
    }
  };

  return (
    <div data-f="F-06-015 F-06-016 F-06-017" className="flex flex-col gap-4">
      <SectionCard title={t('settingsHub.discountNotifyTitle')} description={t('settingsHub.discountNotifyText')}>
        {/* Загрузка — те же поля со значениями по умолчанию (выключены): пришли настройки — ничего не сдвинулось */}
        {(
          <div className="flex flex-col gap-4">
            <NotifyTemplateField
              value={form.newDiscount}
              disabled={loading}
              onChange={(v) => commit({ ...form, newDiscount: v })}
              label={t('settingsHub.newDiscount')}
              templates={[(t.raw('settingsHub.newDiscountTemplates.0') as string), (t.raw('settingsHub.newDiscountTemplates.1') as string), (t.raw('settingsHub.newDiscountTemplates.2') as string)]}
            />
            <NotifyTemplateField
              value={form.discountEnding}
              disabled={loading}
              onChange={(v) => commit({ ...form, discountEnding: v })}
              label={t('settingsHub.discountEnding')}
              templates={[(t.raw('settingsHub.discountEndingTemplates.0') as string), (t.raw('settingsHub.discountEndingTemplates.1') as string), (t.raw('settingsHub.discountEndingTemplates.2') as string)]}
              extra={
                // F-06-012/016: то же число, что «Уведомлять за» в настройках отмены скидки локации —
                // синхронизация в обе стороны не построена (нет общего поля с clients), см. qa/requests/loyalty.md.
                <FormField label={t('settingsHub.warnDaysBefore')}>
                  <Select
                    options={WARN_DAYS_OPTIONS.map((d) => ({ value: String(d), label: String(d) }))}
                    value={String(form.warnDaysBefore)}
                    onValueChange={(v) => commit({ ...form, warnDaysBefore: Number(v) })}
                  />
                </FormField>
              }
            />
            <div className="rounded-xl border border-border-strong bg-surface-2 p-3 text-sm text-muted">
              <p className="mb-1.5 font-medium text-fg">{t('settingsHub.variablesTitle')}</p>
              <ul className="flex flex-col gap-0.5">
                <li>{t('settingsHub.variableDiscount')}</li>
                <li>{t('settingsHub.variableDaysDiscount')}</li>
                <li>{t('settingsHub.variableDaysImportance')}</li>
              </ul>
            </div>
          </div>
        )}
      </SectionCard>

      <SectionCard title={t('settingsHub.linksTitle')}>
        <div className="flex flex-col gap-2">
          <LinkButton href="/biz/loyalty/card-types" variant="outline" leftIcon={<ExternalLink aria-hidden className="size-4" />} className="justify-start">
            {t('settingsHub.linkCardTypes')}
          </LinkButton>
          <LinkButton href="/biz/loyalty/promotions" variant="outline" leftIcon={<ExternalLink aria-hidden className="size-4" />} className="justify-start">
            {t('settingsHub.linkPromotions')}
          </LinkButton>
          <LinkButton href="/biz/loyalty/auto-apply" variant="outline" leftIcon={<ExternalLink aria-hidden className="size-4" />} className="justify-start">
            {t('settingsHub.linkAutoApply')}
          </LinkButton>
          <LinkButton href="/biz/loyalty/referral" variant="outline" leftIcon={<ExternalLink aria-hidden className="size-4" />} className="justify-start">
            {t('settingsHub.linkReferral')}
          </LinkButton>
        </div>
      </SectionCard>
    </div>
  );
}
