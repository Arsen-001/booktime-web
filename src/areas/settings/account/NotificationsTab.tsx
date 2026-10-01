'use client';

/**
 * Личный кабинет → «Уведомления» (F-15-153): письма и пуши сервиса; служебные сообщения не отключаются.
 * Н11 (27.09.2026): одна модель — КАЖДЫЙ переключатель сохраняется сам, сразу (раньше три ждали кнопку, а
 * четвёртый сохранялся сам). М1: сохранение оптимистичное — переключатель не ждёт перечитывания вкладки.
 */
import { optimistic, useApiMutation, useApiQuery } from '@/api/request';
import { getPersonalAccount, getSubscription, saveNotificationPrefs, setPaymentDocsEmail, type SubscriptionView } from '@/api/settings';
import type { Id } from '@/domain/core';
import type { NotificationPrefs, PersonalAccount } from '@/domain/settings';
import { useCan, useCurrent } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { SectionCard } from '@/ui/SectionCard';
import { Switch } from '@/ui/Switch';
import { useToast } from '@/ui/Toast';

export function NotificationsTab({ staffId }: { staffId: Id }) {
  const t = useT('settings');
  const toast = useToast();
  const { businessId, ready } = useCurrent();
  const canBilling = useCan('billing.manage');
  const accKey = ['settings', 'personalAccount', staffId] as const;
  const accQ = useApiQuery(accKey, () => getPersonalAccount(staffId));
  const save = useApiMutation((prefs: NotificationPrefs) => saveNotificationPrefs(staffId, prefs), {
    optimistic: optimistic<PersonalAccount, NotificationPrefs>(accKey, (old, prefs) => ({ ...old, notificationPrefs: prefs })),
  });

  // F-15-093: «Документы об оплате на почту» — принадлежит подписке бизнеса, не личным настройкам; право billing.manage
  const subKey = ['settings', 'subscription', businessId] as const;
  const subQ = useApiQuery(subKey, () => getSubscription(businessId ?? ''), {
    enabled: ready && Boolean(businessId) && canBilling,
  });
  const docsEmail = useApiMutation((value: boolean) => setPaymentDocsEmail(businessId ?? '', value), {
    optimistic: optimistic<SubscriptionView, boolean>(subKey, (old, value) => ({ ...old, paymentDocsEmail: value })),
  });

  // До данных — те же переключатели, выключенные (DESIGN.md «The skeleton IS the page»): пришли данные — только встали на место
  const loading = accQ.isLoading || !accQ.data;
  const prefs: NotificationPrefs = accQ.data?.notificationPrefs ?? { news: false, marketing: false, system: true };

  const setPref = async (key: keyof NotificationPrefs, value: boolean) => {
    try {
      await save.mutate({ ...prefs, [key]: value });
      toast.success(t('account.notifications.saved'));
    } catch {
      toast.error(t('account.notifications.saveFailed'));
    }
  };

  const setDocs = async (value: boolean) => {
    try {
      await docsEmail.mutate(value);
      toast.success(t('account.notifications.saved'));
    } catch {
      toast.error(t('account.notifications.saveFailed'));
    }
  };

  return (
    <SectionCard title={t('account.notifications.title')} description={t('account.notifications.autoSaveHint')}>
      <div data-f="F-15-153 F-15-160 F-10-126 F-05-064" className="flex flex-col gap-4">
        <Switch
          label={t('account.notifications.news')}
          checked={prefs.news}
          disabled={loading}
          onCheckedChange={(v) => void setPref('news', v)}
          labelPosition="start"
        />
        <Switch
          label={t('account.notifications.marketing')}
          checked={prefs.marketing}
          disabled={loading}
          onCheckedChange={(v) => void setPref('marketing', v)}
          labelPosition="start"
        />
        <Switch
          label={t('account.notifications.system')}
          description={t('account.notifications.systemHint')}
          checked={prefs.system}
          disabled={loading}
          onCheckedChange={(v) => void setPref('system', v)}
          labelPosition="start"
        />
      </div>

      {canBilling && (
        <div data-f="F-15-093" className="mt-6 border-t border-border pt-6">
          <Switch
            label={t('account.notifications.paymentDocs')}
            description={t('account.notifications.paymentDocsHint')}
            checked={subQ.data?.paymentDocsEmail ?? true}
            disabled={subQ.isLoading || !ready}
            labelPosition="start"
            onCheckedChange={(v) => void setDocs(v)}
          />
        </div>
      )}
    </SectionCard>
  );
}
