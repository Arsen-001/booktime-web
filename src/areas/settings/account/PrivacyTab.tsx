'use client';

/**
 * Личный кабинет → «Конфиденциальность» (F-15-154 выгрузка данных, F-15-155 блокировка, F-15-156 документы,
 * F-15-161 советы по защите — статические, у нас: чужие данные не видны никому, права галочками F-00-039).
 */
import { useState } from 'react';
import { FileDown, Lock, ShieldCheck } from 'lucide-react';
import { useApiMutation, useApiQuery } from '@/api/request';
import { getPersonalAccount, requestDataBlock, requestDataExport } from '@/api/settings';
import type { Id } from '@/domain/core';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { SectionCard } from '@/ui/SectionCard';
import { Sheet } from '@/ui/Sheet';
import { SkeletonText } from '@/ui/Skeleton';
import { useConfirm, useToast } from '@/ui/Toast';

export function PrivacyTab({ staffId }: { staffId: Id }) {
  const t = useT('settings');
  const format = useFormat();
  const toast = useToast();
  const confirm = useConfirm();
  const accQ = useApiQuery(['settings', 'personalAccount', staffId], () => getPersonalAccount(staffId));
  const exportData = useApiMutation(() => requestDataExport(staffId), { invalidates: [['settings', 'personalAccount', staffId]] });
  const blockData = useApiMutation(() => requestDataBlock(staffId), { invalidates: [['settings', 'personalAccount', staffId]] });
  const [openDoc, setOpenDoc] = useState<'terms' | 'license' | null>(null);

  // До данных — те же карточки; в истории выгрузок — полоса на месте ответа, кнопки выключены
  const loading = accQ.isLoading || !accQ.data;
  const requests = accQ.data?.dataExportRequests ?? [];
  const blockRequestedAt = accQ.data?.dataBlockRequestedAt;

  const runExport = async () => {
    try {
      await exportData.mutate(undefined);
      toast.success(t('account.privacy.exportReady'));
    } catch {
      toast.error(t('account.privacy.exportTooSoon'));
    }
  };

  // Н10: блокировка данных — заявка с последствиями, сначала вопрос
  const runBlock = async () => {
    const ok = await confirm({
      title: t('account.privacy.blockConfirmTitle'),
      description: t('account.privacy.blockConfirmText'),
      confirmLabel: t('account.privacy.blockConfirmButton'),
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await blockData.mutate(undefined);
      toast.success(t('account.privacy.blockSent'));
    } catch {
      toast.error(t('account.privacy.blockFailed'));
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <SectionCard title={t('account.privacy.exportTitle')} description={t('account.privacy.exportDescription')}>
        <div data-f="F-15-154 F-10-127 F-12-082" className="flex flex-col gap-3">
          <p className="text-sm text-muted">{t('account.privacy.exportHint')}</p>
          <Button leftIcon={<FileDown />} loading={exportData.isPending} disabled={loading} className="self-start" onClick={() => void runExport()}>
            {t('account.privacy.exportButton')}
          </Button>
          <div className="mt-2">
            <h3 className="mb-2 text-sm font-medium text-fg">{t('account.privacy.exportHistoryTitle')}</h3>
            {requests.length === 0 ? (
              <EmptyState variant="section" compact title={loading ? <SkeletonText width="20ch" /> : t('account.privacy.exportEmpty')} />
            ) : (
              <ul className="flex flex-col gap-1.5 text-sm text-muted">
                {requests
                  .slice()
                  .reverse()
                  .map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-2">
                      <span>{format.dateTime(r.requestedAt)}</span>
                      <Badge tone={r.ready ? 'success' : 'warning'} size="sm">
                        {r.ready ? t('account.privacy.exportReady') : '…'}
                      </Badge>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </div>
      </SectionCard>

      <SectionCard title={t('account.privacy.blockTitle')} description={t('account.privacy.blockDescription')}>
        <div data-f="F-15-155" className="flex flex-col gap-2">
          <Button variant="outline" leftIcon={<Lock />} loading={blockData.isPending} disabled={loading} className="self-start" onClick={() => void runBlock()}>
            {t('account.privacy.blockButton')}
          </Button>
          {blockRequestedAt && (
            <p className="text-xs text-muted">{t('account.privacy.blockAlreadySent', { date: format.dateTime(blockRequestedAt) })}</p>
          )}
        </div>
      </SectionCard>

      <SectionCard title={t('account.privacy.documentsTitle')}>
        <div data-f="F-15-156" className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => setOpenDoc('terms')}>
            {t('account.privacy.termsOfUse')}
          </Button>
          <Button variant="outline" onClick={() => setOpenDoc('license')}>
            {t('account.privacy.licenseAgreement')}
          </Button>
        </div>
      </SectionCard>

      <SectionCard title={t('account.privacy.securityTitle')}>
        <ul data-f="F-15-161" className="flex flex-col gap-3">
          {([1, 2, 3, 4, 5] as const).map((n) => (
            <li key={n} className="flex items-start gap-2.5 text-sm text-fg">
              <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />
              <span>{t(`account.privacy.securityTip${n}` as 'account.privacy.securityTip1')}</span>
            </li>
          ))}
        </ul>
      </SectionCard>

      <Sheet
        open={openDoc !== null}
        onOpenChange={(v) => !v && setOpenDoc(null)}
        title={openDoc === 'terms' ? t('account.privacy.termsOfUse') : t('account.privacy.licenseAgreement')}
        side="right"
      >
        <p className="text-sm leading-relaxed text-muted">{t('account.privacy.documentDraftNote')}</p>
      </Sheet>
    </div>
  );
}
