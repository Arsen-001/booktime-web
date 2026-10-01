'use client';

/**
 * /biz/notifications/channels/whatsapp — три способа подключить WhatsApp: общий номер сервиса
 * (F-05-071), Embedded Signup — регистрация WhatsApp Business прямо из кабинета (F-05-072),
 * Coexistence — свой номер сразу и в приложении, и в Cloud API (F-05-073). F-05-074 (официальный
 * API против QR) — общая заметка внизу.
 *
 * Снято №11 / В-08 б: сообщения клиентам бесплатны (пуш — главный канал), поэтому здесь нет цены за
 * сообщение и баланса — только подключение канала и одобрение шаблонов.
 */
import { useState } from 'react';
import { CheckCircle2, Info } from 'lucide-react';
import { approveWhatsAppTemplates, getAltegioWhatsApp, sendTestWhatsAppMessage, setAltegioWhatsAppMode, updateAltegioWhatsApp } from '@/api/notify';
import { useApiMutation, useApiQuery } from '@/api/request';
import type { AltegioWhatsAppMode } from '@/domain/notify';
import { useCurrent } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { ChoiceCard } from '@/ui/ChoiceCard';
import { ErrorState } from '@/ui/ErrorState';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';
import { Skeleton } from '@/ui/Skeleton';
import { useToast } from '@/ui/Toast';

const MODES: AltegioWhatsAppMode[] = ['notificationSender', 'embeddedSignup', 'coexistence'];

export function WhatsAppScreen() {
  const t = useT('notify');
  const toast = useToast();
  const { ready, businessId } = useCurrent();
  const [companyName, setCompanyName] = useState('');
  const [ownNumber, setOwnNumber] = useState('');

  const q = useApiQuery(['notify', 'altegioWhatsApp', businessId], () => getAltegioWhatsApp(businessId!), { enabled: ready && !!businessId });
  const setMode = useApiMutation(setAltegioWhatsAppMode);
  const approve = useApiMutation(approveWhatsAppTemplates);
  const update = useApiMutation(updateAltegioWhatsApp);
  const sendTest = useApiMutation(sendTestWhatsAppMessage);

  if (!ready || q.isLoading) return <Skeleton lines={8} />;
  if (q.isError || !q.data) return <ErrorState onRetry={q.refetch} />;

  const settings = q.data;

  const pick = async (mode: AltegioWhatsAppMode) => {
    try {
      await setMode.mutate({ businessId: businessId!, mode });
    } catch {
      toast.error(t('typeDetail.saveFailed'));
    }
  };

  const saveNumber = async () => {
    try {
      await update.mutate({ businessId: businessId!, settings: { ...settings, companyName, ownNumber } });
      toast.success(t('whatsapp.saved'));
    } catch {
      toast.error(t('typeDetail.saveFailed'));
    }
  };

  const approveTemplates = async () => {
    try {
      await approve.mutate(businessId!);
      toast.success(t('whatsapp.templatesApprovedToast'));
    } catch {
      toast.error(t('typeDetail.saveFailed'));
    }
  };

  const runTest = async () => {
    try {
      const res = await sendTest.mutate(businessId!);
      if (res.sent) toast.success(t('whatsapp.testSent'));
      else toast.error(t('whatsapp.testFailed'));
    } catch {
      toast.error(t('typeDetail.saveFailed'));
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader back={{ href: '/biz/notifications/channels', label: t('tabs.channels') }} title={t('whatsapp.title')} description={t('whatsapp.subtitle')} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {MODES.map((mode) => (
          <div key={mode} data-f={mode === 'notificationSender' ? 'F-05-071' : mode === 'embeddedSignup' ? 'F-05-072' : 'F-05-073'}>
            <ChoiceCard
              selected={settings.mode === mode}
              onClick={() => pick(mode)}
              title={t(`whatsapp.mode.${mode}.title`)}
              description={t(`whatsapp.mode.${mode}.hint`)}
            />
          </div>
        ))}
      </div>

      {settings.mode === 'notificationSender' && (
        <SectionCard title={t('whatsapp.mode.notificationSender.title')} description={t('whatsapp.mode.notificationSender.hint')}>
          <div data-f="F-05-071" className="flex flex-col gap-4 text-sm">
            <Badge tone="success" size="sm" className="w-fit">
              {t('channelsTab.free')}
            </Badge>
            <div className="flex items-center gap-2">
              {settings.templatesApproved ? (
                <Badge tone="success" size="sm" className="gap-1">
                  <CheckCircle2 aria-hidden className="size-3.5" />
                  {t('whatsapp.templatesApproved')}
                </Badge>
              ) : (
                <Button variant="outline" size="sm" onClick={approveTemplates} loading={approve.isPending}>
                  {t('whatsapp.checkTemplates')}
                </Button>
              )}
            </div>
            <p className="text-xs text-muted">{t('whatsapp.trialNote')}</p>
            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={runTest} loading={sendTest.isPending} disabled={!settings.templatesApproved}>
                {t('whatsapp.sendTest')}
              </Button>
            </div>
          </div>
        </SectionCard>
      )}

      {settings.mode === 'embeddedSignup' && (
        <SectionCard title={t('whatsapp.mode.embeddedSignup.title')} description={t('whatsapp.mode.embeddedSignup.hint')}>
          <form
            data-f="F-05-072"
            className="flex flex-col gap-4"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void saveNumber();
            }}
          >
            <FormField label={t('whatsapp.companyName')}>
              <Input value={companyName || settings.companyName || ''} onChange={(e) => setCompanyName(e.target.value)} />
            </FormField>
            <FormField label={t('whatsapp.ownNumber')} hint={t('whatsapp.ownNumberHint')}>
              <Input value={ownNumber || settings.ownNumber || ''} onChange={(e) => setOwnNumber(e.target.value)} placeholder="+374 XX XXX XXX" />
            </FormField>
            <div className="flex justify-end">
              <Button type="submit" size="sm" loading={update.isPending}>
                {t('channelsTab.connect')}
              </Button>
            </div>
          </form>
        </SectionCard>
      )}

      {settings.mode === 'coexistence' && (
        <SectionCard title={t('whatsapp.mode.coexistence.title')} description={t('whatsapp.mode.coexistence.hint')}>
          <form
            data-f="F-05-073"
            className="flex flex-col gap-4"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void saveNumber();
            }}
          >
            <FormField label={t('whatsapp.ownNumber')} hint={t('whatsapp.coexistenceHint')}>
              <Input value={ownNumber || settings.ownNumber || ''} onChange={(e) => setOwnNumber(e.target.value)} placeholder="+374 XX XXX XXX" />
            </FormField>
            <ul className="list-disc pl-5 text-xs text-muted">
              <li>{t('whatsapp.coexistenceReq1')}</li>
              <li>{t('whatsapp.coexistenceReq2')}</li>
              <li>{t('whatsapp.coexistenceReq3')}</li>
            </ul>
            <div className="flex justify-end">
              <Button type="submit" size="sm" loading={update.isPending}>
                {t('channelsTab.connect')}
              </Button>
            </div>
          </form>
        </SectionCard>
      )}

      {/* F-05-074: официальный API против подключения по QR */}
      <div data-f="F-05-074" className="flex gap-2 rounded-xl border border-border bg-bg-muted p-3 text-xs text-muted">
        <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />
        <p>{t('whatsapp.officialVsQr')}</p>
      </div>
    </div>
  );
}
