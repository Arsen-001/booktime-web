'use client';

/**
 * /biz/notifications/channels/email — настройка Email-канала (F-05-066): «Email для ответов».
 */
import { useState } from 'react';
import { getEmailSettings, updateEmailSettings } from '@/api/notify';
import type { EmailChannelSettings } from '@/domain/notify';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { ErrorState } from '@/ui/ErrorState';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';
import { Skeleton } from '@/ui/Skeleton';
import { useToast } from '@/ui/Toast';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function EmailForm({ businessId, settings }: { businessId: string; settings: EmailChannelSettings }) {
  const t = useT('notify');
  const toast = useToast();
  const [replyEmail, setReplyEmail] = useState(settings.replyEmail);
  const [error, setError] = useState<string | undefined>();
  const save = useApiMutation(updateEmailSettings);

  const submit = async () => {
    if (!EMAIL_RE.test(replyEmail)) {
      setError(t('channelsTab.emailInvalid'));
      return;
    }
    setError(undefined);
    try {
      await save.mutate({ businessId, settings: { replyEmail } });
      toast.success(t('typeDetail.saved'));
    } catch {
      toast.error(t('channelsTab.saveFailed'));
    }
  };

  return (
    <SectionCard title={t('channelsTab.emailSettingsTitle')} description={t('channelsTab.emailSettingsHint')}>
      <form
        className="flex flex-col gap-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <FormField label={t('channelsTab.replyEmailLabel')} error={error}>
          <Input type="email" value={replyEmail} onChange={(e) => setReplyEmail(e.target.value)} placeholder="salon@mail.am" />
        </FormField>
        <div className="flex justify-end">
          <Button type="submit" loading={save.isPending}>
            {t('typeDetail.save')}
          </Button>
        </div>
      </form>
    </SectionCard>
  );
}

export function EmailChannelScreen() {
  const t = useT('notify');
  const { ready, businessId } = useCurrent();

  const q = useApiQuery(['notify', 'emailSettings', businessId], () => getEmailSettings(businessId!), {
    enabled: ready && !!businessId,
  });

  return (
    <div data-f="F-05-066" className="flex flex-col gap-6">
      <PageHeader back={{ href: '/biz/notifications/channels', label: t('tabs.channels') }} title={t('channels.email')} />
      {q.isError ? (
        <ErrorState onRetry={q.refetch} />
      ) : !ready || q.isLoading || !q.data ? (
        <Skeleton lines={6} />
      ) : (
        <EmailForm key={businessId} businessId={businessId!} settings={q.data} />
      )}
    </div>
  );
}
