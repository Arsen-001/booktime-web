'use client';

/**
 * F-13-071: MCP — адрес MCP-сервера, как подключить. F-13-072: токен ИИ-ассистента и права.
 * Ревью 27.09 (И5): выпущенный токен показывается целиком один раз (окно), в списке — только маска без
 * «Копировать»; «Отозвать» крутит только свою строку.
 */
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { issueAiToken, listAiTokens, revokeAiToken } from '@/api/integrations';
import { useApiMutation, useApiQuery } from '@/api/request';
import { CopyRow } from '@/areas/integrations/components/CopyRow';
import { useCurrent } from '@/demo/hooks';
import { maskToken, type AiTokenScope } from '@/domain/integrations';
import { useT } from '@/i18n/useT';
import { ErrorState } from '@/ui/ErrorState';
import { Accordion } from '@/ui/Accordion';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { SectionCard } from '@/ui/SectionCard';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { Modal } from '@/ui/Modal';
import { Skeleton } from '@/ui/Skeleton';
import { useConfirm, useToast } from '@/ui/Toast';

export function McpTab() {
  const t = useT('integrations');
  const toast = useToast();
  const confirm = useConfirm();
  const { businessId, ready } = useCurrent();
  const [scope, setScope] = useState<AiTokenScope>('read');
  const [reveal, setReveal] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const tokensQ = useApiQuery(['integrations', 'aiTokens', businessId], () => listAiTokens(businessId!), { enabled: ready && Boolean(businessId) });
  const issue = useApiMutation((s: AiTokenScope) => issueAiToken(businessId!, s));
  const revoke = useApiMutation(revokeAiToken);

  const active = tokensQ.data?.filter((tk) => !tk.revokedAt) ?? [];

  const onIssue = async () => {
    try {
      const token = await issue.mutate(scope);
      setReveal(token.token);
      toast.success(t('api.mcp.issued'));
      tokensQ.refetch();
    } catch {
      toast.error(t('errors.actionFailed'));
    }
  };

  const onRevoke = async (id: string) => {
    const ok = await confirm({ title: t('api.mcp.revokeConfirmTitle'), description: t('api.mcp.revokeConfirmText'), tone: 'danger', confirmLabel: t('api.keys.revoke') });
    if (!ok) return;
    setRevokingId(id);
    try {
      await revoke.mutate(id);
      toast.success(t('api.keys.revoked'));
      tokensQ.refetch();
    } catch {
      toast.error(t('errors.actionFailed'));
    } finally {
      setRevokingId(null);
    }
  };

  // QA 30.09: ошибка загрузки — ErrorState, а не «токенов нет»
  if (tokensQ.isError) return <ErrorState onRetry={() => tokensQ.refetch()} />;

  return (
    <div data-f="F-13-071 F-13-072" className="flex flex-col gap-4">
      <SectionCard title={t('api.mcp.serverTitle')} description={t('api.mcp.serverHint')}>
        <CopyRow label={t('api.mcp.serverAddress')} value="mcp.example-booking.am/v1" />
      </SectionCard>

      <SectionCard title={t('api.mcp.howTitle')}>
        <Accordion
          items={[
            { id: 'claude', title: t('api.mcp.howClaudeTitle'), content: t('api.mcp.howClaudeText') },
            { id: 'chatgpt', title: t('api.mcp.howChatgptTitle'), content: t('api.mcp.howChatgptText') },
            { id: 'cursor', title: t('api.mcp.howCursorTitle'), content: t('api.mcp.howCursorText') },
          ]}
          variant="plain"
        />
      </SectionCard>

      <SectionCard title={t('api.mcp.tokenTitle')} description={t('api.mcp.tokenHint')}>
        <div className="flex flex-col gap-3">
          <SegmentedControl
            options={[
              { value: 'read', label: t('api.mcp.scopeRead') },
              { value: 'readWrite', label: t('api.mcp.scopeReadWrite') },
            ]}
            value={scope}
            onValueChange={(v) => setScope(v as AiTokenScope)}
          />
          <Button leftIcon={<Plus aria-hidden />} loading={issue.isPending} onClick={onIssue} className="self-start">
            {t('api.mcp.issueToken')}
          </Button>

          {!ready || tokensQ.isLoading ? (
            <Skeleton lines={2} />
          ) : active.length === 0 ? (
            <EmptyState compact title={t('api.mcp.noTokens')} />
          ) : (
            <ul className="flex flex-col gap-2">
              {active.map((tk) => (
                <li key={tk.id} className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <CopyRow label={t(tk.scope === 'read' ? 'api.mcp.scopeRead' : 'api.mcp.scopeReadWrite')} value={maskToken(tk.token)} copyable={false} hint={t('api.keys.shownOnce')} />
                  </div>
                  <Button variant="ghost" size="sm" loading={revokingId === tk.id} onClick={() => onRevoke(tk.id)}>
                    {t('api.keys.revoke')}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SectionCard>

      <Modal
        open={Boolean(reveal)}
        onOpenChange={() => setReveal(null)}
        title={t('api.keys.revealTitle')}
        description={t('api.keys.revealText')}
        footer={<Button onClick={() => setReveal(null)}>{t('api.keys.revealSaved')}</Button>}
      >
        {reveal && <CopyRow label={t('api.mcp.tokenTitle')} value={reveal} />}
      </Modal>
    </div>
  );
}
