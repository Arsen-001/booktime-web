'use client';

/**
 * F-13-052: API-ключ (Bearer) партнёра — выпустить, показать один раз, отозвать.
 * F-13-053: User token — список, отозвать.
 * F-13-055: «Разработчик для вашего салона» — пригласить в /biz/staff и выдать токен с его правами.
 * F-13-059: системный пользователь маркетплейса бесплатен, своей интеграции — платный (справочная строка).
 */
import Link from 'next/link';
import { Info, Plus } from 'lucide-react';
import { useState } from 'react';
import { issuePartnerApiKey, issueUserApiToken, listPartnerApiKeys, listUserApiTokens, revokePartnerApiKey, revokeUserApiToken } from '@/api/integrations';
import { useApiMutation, useApiQuery } from '@/api/request';
import { CopyRow } from '@/areas/integrations/components/CopyRow';
import { useCurrent } from '@/demo/hooks';
import { maskToken } from '@/domain/integrations';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { Input } from '@/ui/Input';
import { Modal } from '@/ui/Modal';
import { SectionCard } from '@/ui/SectionCard';
import { Skeleton } from '@/ui/Skeleton';
import { useConfirm, useToast } from '@/ui/Toast';

export function KeysTab() {
  const t = useT('integrations');
  const toast = useToast();
  const confirm = useConfirm();
  const { businessId, ready } = useCurrent();
  const [reveal, setReveal] = useState<{ label: string; token: string } | null>(null);
  const [tokenLabel, setTokenLabel] = useState('');
  // И5: «Отозвать» крутит только свою строку
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const keysQ = useApiQuery(['integrations', 'partnerKeys', businessId], () => listPartnerApiKeys(businessId!), { enabled: ready && Boolean(businessId) });
  const tokensQ = useApiQuery(['integrations', 'userTokens', businessId], () => listUserApiTokens(businessId!), { enabled: ready && Boolean(businessId) });
  const issueKey = useApiMutation(() => issuePartnerApiKey(businessId!));
  const revokeKey = useApiMutation(revokePartnerApiKey);
  const issueToken = useApiMutation((label: string) => issueUserApiToken(businessId!, label));
  const revokeToken = useApiMutation(revokeUserApiToken);

  const activeKey = keysQ.data?.find((k) => !k.revokedAt);
  const activeTokens = tokensQ.data?.filter((t2) => !t2.revokedAt) ?? [];

  const onIssueKey = async () => {
    try {
      const key = await issueKey.mutate(undefined);
      setReveal({ label: t('api.keys.partnerKeyLabel'), token: key.token });
      keysQ.refetch();
    } catch {
      toast.error(t('errors.actionFailed'));
    }
  };

  const onRevokeKey = async (id: string) => {
    const ok = await confirm({ title: t('api.keys.revokeConfirmTitle'), description: t('api.keys.revokeConfirmText'), tone: 'danger', confirmLabel: t('api.keys.revoke') });
    if (!ok) return;
    setRevokingId(id);
    try {
      await revokeKey.mutate(id);
      toast.success(t('api.keys.revoked'));
      keysQ.refetch();
    } catch {
      toast.error(t('errors.actionFailed'));
    } finally {
      setRevokingId(null);
    }
  };

  const onIssueToken = async () => {
    try {
      const token = await issueToken.mutate(tokenLabel.trim() || t('api.keys.userTokenDefaultLabel'));
      setTokenLabel('');
      setReveal({ label: token.label, token: token.token });
      tokensQ.refetch();
    } catch {
      toast.error(t('errors.actionFailed'));
    }
  };

  const onRevokeToken = async (id: string) => {
    const ok = await confirm({ title: t('api.keys.revokeConfirmTitle'), description: t('api.keys.revokeConfirmText'), tone: 'danger', confirmLabel: t('api.keys.revoke') });
    if (!ok) return;
    setRevokingId(id);
    try {
      await revokeToken.mutate(id);
      toast.success(t('api.keys.revoked'));
      tokensQ.refetch();
    } catch {
      toast.error(t('errors.actionFailed'));
    } finally {
      setRevokingId(null);
    }
  };

  // QA 30.09: ошибка загрузки — ErrorState, а не «Ключ ещё не выпущен» с кнопкой «Выпустить»
  if (keysQ.isError || tokensQ.isError) return <ErrorState onRetry={() => (keysQ.refetch(), tokensQ.refetch())} />;

  return (
    <div data-f="F-13-052 F-13-053 F-13-055 F-13-059" className="flex flex-col gap-4">
      <SectionCard title={t('api.keys.partnerKeyTitle')} description={t('api.keys.partnerKeyHint')}>
        {!ready || keysQ.isLoading ? (
          <Skeleton lines={2} />
        ) : activeKey ? (
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <CopyRow label={t('api.keys.partnerKeyLabel')} value={maskToken(activeKey.token)} copyable={false} hint={t('api.keys.shownOnce')} />
            </div>
            <Button variant="ghost" onClick={() => onRevokeKey(activeKey.id)} loading={revokingId === activeKey.id}>
              {t('api.keys.revoke')}
            </Button>
          </div>
        ) : (
          <EmptyState
            compact
            title={t('api.keys.noPartnerKey')}
            action={
              <Button leftIcon={<Plus aria-hidden />} loading={issueKey.isPending} onClick={onIssueKey}>
                {t('api.keys.issue')}
              </Button>
            }
          />
        )}
      </SectionCard>

      <SectionCard title={t('api.keys.userTokensTitle')} description={t('api.keys.userTokensHint')}>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <Input value={tokenLabel} onChange={(e) => setTokenLabel(e.target.value)} aria-label={t('api.keys.tokenLabelPlaceholder')} placeholder={t('api.keys.tokenLabelPlaceholder')} className="max-w-xs" />
            <Button leftIcon={<Plus aria-hidden />} loading={issueToken.isPending} onClick={onIssueToken}>
              {t('api.keys.issue')}
            </Button>
          </div>
          {!ready || tokensQ.isLoading ? (
            <Skeleton lines={2} />
          ) : activeTokens.length === 0 ? (
            <EmptyState compact title={t('api.keys.noUserTokens')} />
          ) : (
            <ul className="flex flex-col gap-2">
              {activeTokens.map((tok) => (
                <li key={tok.id} className="flex items-center gap-2">
                  <div className="flex-1">
                    <CopyRow label={tok.label} value={maskToken(tok.token)} copyable={false} hint={t('api.keys.shownOnce')} />
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => onRevokeToken(tok.id)} loading={revokingId === tok.id}>
                    {t('api.keys.revoke')}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SectionCard>

      <SectionCard title={t('api.keys.forClientTitle')} description={t('api.keys.forClientHint')}>
        <Link href="/biz/staff" className="inline-flex min-h-11 items-center text-sm text-primary-text underline decoration-border-strong underline-offset-2">
          {t('api.keys.forClientLink')}
        </Link>
      </SectionCard>

      <div className="flex items-start gap-2 rounded-lg border border-border bg-surface-2 p-3 text-sm text-muted">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        {t('api.keys.systemUserBillingNote')}
      </div>

      <Modal
        open={Boolean(reveal)}
        onOpenChange={() => setReveal(null)}
        title={t('api.keys.revealTitle')}
        description={t('api.keys.revealText')}
        footer={<Button onClick={() => setReveal(null)}>{t('api.keys.revealSaved')}</Button>}
      >
        {reveal && <CopyRow label={reveal.label} value={reveal.token} />}
      </Modal>
    </div>
  );
}
