'use client';

/**
 * F-13-062/F-13-065 + ревью 27.09 (И13): адреса вебхуков. «Добавить адрес» сначала шлёт проверочный запрос:
 * ответил — адрес добавлен и получает секрет подписи (целиком — один раз, в окне), не ответил — причина под полем.
 * Секрет в списке — только маска; «Новый секрет» выпускает другой и тоже показывает его один раз.
 */
import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Info, KeyRound, Plus } from 'lucide-react';
import { addWebhookAddress, removeWebhookAddress, rotateWebhookSecret } from '@/api/integrations';
import { ApiError, useApiMutation } from '@/api/request';
import { CopyRow } from '@/areas/integrations/components/CopyRow';
import { isValidWebhookUrl, type WebhookConfig } from '@/domain/integrations';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { Modal } from '@/ui/Modal';
import { SectionCard } from '@/ui/SectionCard';
import { useConfirm, useToast } from '@/ui/Toast';

export function WebhookAddressesCard({ businessId, cfg, canEdit }: { businessId: string; cfg: WebhookConfig; canEdit: boolean }) {
  const t = useT('integrations');
  const toast = useToast();
  const confirm = useConfirm();
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [secret, setSecret] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const add = useApiMutation((value: string) => addWebhookAddress(businessId, value));
  const rotate = useApiMutation((addressId: string) => rotateWebhookSecret(businessId, addressId));
  const remove = useApiMutation((addressId: string) => removeWebhookAddress(businessId, addressId));

  const onAdd = async () => {
    const value = url.trim();
    if (!isValidWebhookUrl(value)) {
      setError(t('api.webhooks.add.invalid'));
      return;
    }
    setError(undefined);
    try {
      const result = await add.mutate(value);
      setUrl('');
      setSecret(result.secret);
      toast.success(t('api.webhooks.add.added'));
    } catch (e) {
      const code = e instanceof ApiError ? e.code : '';
      setError(code === 'webhook_unreachable' ? t('api.webhooks.add.unreachable') : code === 'duplicate' ? t('api.webhooks.add.duplicate') : t('errors.actionFailed'));
    }
  };

  const onRotate = async (addressId: string) => {
    const ok = await confirm({
      title: t('api.webhooks.secret.rotateConfirmTitle'),
      description: t('api.webhooks.secret.rotateConfirmText'),
      confirmLabel: t('api.webhooks.secret.rotate'),
    });
    if (!ok) return;
    setBusyId(addressId);
    try {
      setSecret(await rotate.mutate(addressId));
    } catch {
      toast.error(t('errors.actionFailed'));
    } finally {
      setBusyId(null);
    }
  };

  const onRemove = async (addressId: string) => {
    const ok = await confirm({
      title: t('api.webhooks.removeConfirmTitle'),
      description: t('api.webhooks.removeConfirmText'),
      tone: 'danger',
      confirmLabel: t('api.webhooks.remove'),
    });
    if (!ok) return;
    setBusyId(addressId);
    try {
      await remove.mutate(addressId);
      toast.success(t('api.webhooks.removed'));
    } catch {
      toast.error(t('errors.actionFailed'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <SectionCard title={t('api.webhooks.addressesTitle')} description={t('api.webhooks.addressesHint')}>
      {cfg.addresses.length === 0 ? (
        <EmptyState compact title={t('api.webhooks.noAddresses')} />
      ) : (
        <ul className="flex flex-col gap-2">
          {cfg.addresses.map((a) => (
            <li key={a.id} className="flex flex-col gap-2 rounded-lg border border-border px-3 py-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="min-w-0 truncate font-mono text-sm text-fg">{a.url}</span>
                <span className="flex flex-wrap items-center gap-1.5">
                  {a.verifiedAt && (
                    <Badge tone="success" size="sm" icon={<CheckCircle2 aria-hidden />}>
                      {t('api.webhooks.verified')}
                    </Badge>
                  )}
                  {a.legacy && (
                    <Badge tone="neutral" size="sm">
                      {t('api.webhooks.legacyBadge')}
                    </Badge>
                  )}
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="flex min-w-0 items-center gap-1.5 text-muted">
                  <KeyRound className="h-4 w-4 shrink-0" aria-hidden />
                  {t('api.webhooks.secret.label')}: <span className="truncate font-mono text-fg">{a.signingSecret ?? t('api.webhooks.secret.none')}</span>
                </span>
                {canEdit && (
                  <span className="flex gap-1">
                    <Button size="sm" variant="ghost" loading={busyId === a.id && rotate.isPending} onClick={() => onRotate(a.id)}>
                      {t('api.webhooks.secret.rotate')}
                    </Button>
                    <Button size="sm" variant="ghost" className="text-danger" loading={busyId === a.id && remove.isPending} onClick={() => onRemove(a.id)}>
                      {t('api.webhooks.remove')}
                    </Button>
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start">
          <FormField label={t('api.webhooks.add.label')} hint={t('api.webhooks.add.hint')} error={error} className="min-w-0 flex-1">
            <Input
              type="url"
              inputMode="url"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (error) setError(undefined);
              }}
              placeholder="https://example.am/hooks/booking"
              className="font-mono"
            />
          </FormField>
          <Button leftIcon={<Plus aria-hidden />} loading={add.isPending} onClick={onAdd} disabled={!url.trim()} className="sm:mt-7">
            {t('api.webhooks.add.cta')}
          </Button>
        </div>
      )}

      <div data-f="F-13-065 F-01-202 F-01-203" className="mt-3 flex items-start gap-2 rounded-lg border border-border bg-surface-2 p-3 text-sm text-muted">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>
          {t('api.webhooks.appsNote')}{' '}
          <Link
            href="/biz/integrations/developers/apps/new"
            className="inline-flex min-h-11 items-center text-primary-text underline decoration-border-strong underline-offset-2"
          >
            {t('api.webhooks.newAddressLink')}
          </Link>
        </span>
      </div>

      <Modal
        open={Boolean(secret)}
        onOpenChange={() => setSecret(null)}
        title={t('api.webhooks.secret.revealTitle')}
        description={t('api.webhooks.secret.revealText')}
        footer={<Button onClick={() => setSecret(null)}>{t('api.keys.revealSaved')}</Button>}
      >
        {secret && <CopyRow label={t('api.webhooks.secret.label')} value={secret} />}
      </Modal>
    </SectionCard>
  );
}
