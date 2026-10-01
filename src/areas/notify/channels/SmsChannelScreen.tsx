'use client';

/**
 * /biz/notifications/channels/sms — подключение SMS-агрегатора (F-05-068): ключ авторизации + имя
 * отправителя; после подключения SMS появляется в типах, коде подтверждения и рассылках.
 */
import { useState } from 'react';
import { Info } from 'lucide-react';
import { coreGet } from '@/api/core';
import { connectSms, disconnectSms, getSmsSettings } from '@/api/notify';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { ErrorState } from '@/ui/ErrorState';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';
import { Skeleton } from '@/ui/Skeleton';
import { useToast } from '@/ui/Toast';

/** F-05-068: имя отправителя по умолчанию берём из названия салона (латиницей, до 11 знаков — лимит SMS-сетей) */
function senderNameFromBusiness(name: string | undefined): string {
  const latin = (name ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '')
    .slice(0, 11);
  return latin || 'Salon';
}

export function SmsChannelScreen() {
  const t = useT('notify');
  const toast = useToast();
  const { ready, businessId } = useCurrent();
  const [apiKey, setApiKey] = useState('');
  // F-05-068: undefined = ещё не тронуто руками → показываем имя, выведенное из названия салона.
  const [senderNameOverride, setSenderNameOverride] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | undefined>();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const q = useApiQuery(['notify', 'smsSettings', businessId], () => getSmsSettings(businessId!), {
    enabled: ready && !!businessId,
  });
  const businessQ = useApiQuery(['notify', 'sms-business-name', businessId], () => coreGet('businesses', businessId!), {
    enabled: ready && !!businessId,
  });
  const connect = useApiMutation(connectSms);
  const disconnect = useApiMutation(disconnectSms);
  const senderName = senderNameOverride ?? senderNameFromBusiness(businessQ.data?.name);

  if (!ready || q.isLoading) return <Skeleton lines={6} />;
  if (q.isError) return <ErrorState onRetry={q.refetch} />;

  const submit = async () => {
    if (apiKey.trim().length < 4) {
      setError(t('channelsTab.smsKeyInvalid'));
      return;
    }
    setError(undefined);
    try {
      await connect.mutate({ businessId: businessId!, apiKey: apiKey.trim(), senderName });
      toast.success(t('channelsTab.smsConnected'));
    } catch {
      toast.error(t('channelsTab.saveFailed'));
    }
  };

  const confirmDisconnect = async () => {
    try {
      await disconnect.mutate(businessId!);
      toast.success(t('channelsTab.smsDisconnected'));
    } catch {
      toast.error(t('channelsTab.saveFailed'));
    } finally {
      setConfirmOpen(false);
    }
  };

  return (
    <div data-f="F-05-068" className="flex flex-col gap-6">
      <PageHeader back={{ href: '/biz/notifications/channels', label: t('tabs.channels') }} title={t('channels.sms')} />

      {q.data?.connected ? (
        <SectionCard
          title={t('channelsTab.smsSettingsTitle')}
          actions={
            <Badge tone="success" size="sm">
              {t('channelsTab.active')}
            </Badge>
          }
        >
          <div className="flex flex-col gap-3 text-sm">
            <p>
              <span className="text-muted">{t('channelsTab.senderName')}: </span>
              <span className="font-medium text-fg">{q.data.senderName}</span>
            </p>
            <div className="flex justify-end">
              <Button variant="danger" size="sm" onClick={() => setConfirmOpen(true)}>
                {t('channelsTab.disconnect')}
              </Button>
            </div>
          </div>
        </SectionCard>
      ) : (
        <>
          <div className="flex gap-3 rounded-xl border border-border bg-bg-muted p-4 text-sm text-muted">
            <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />
            <div className="flex flex-col gap-1">
              <p className="text-fg">{t('channelsTab.smsWhyTitle')}</p>
              <p>{t('channelsTab.smsWhyText')}</p>
              <p>{t('channelsTab.smsWhereKeyText')}</p>
            </div>
          </div>
          <SectionCard title={t('channelsTab.smsSettingsTitle')} description={t('channelsTab.smsSettingsHint')}>
            <form
              className="flex flex-col gap-4"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              <FormField label={t('channelsTab.apiKeyLabel')} error={error}>
                <Input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="AGG-XXXX-XXXX" />
              </FormField>
              <FormField label={t('channelsTab.senderNameLabel')} hint={t('channelsTab.senderNameHint')}>
                <Input value={senderName} maxLength={11} onChange={(e) => setSenderNameOverride(e.target.value)} />
              </FormField>
              <div className="flex justify-end">
                <Button type="submit" loading={connect.isPending}>
                  {t('channelsTab.connect')}
                </Button>
              </div>
            </form>
          </SectionCard>
        </>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t('channelsTab.disconnectConfirmTitle')}
        description={t('channelsTab.disconnectConfirmText')}
        tone="danger"
        onConfirm={confirmDisconnect}
      />
    </div>
  );
}
