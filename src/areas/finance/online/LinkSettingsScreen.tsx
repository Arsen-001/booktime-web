'use client';

/**
 * /biz/finance/online/link — настройка «Оплата по ссылке» (F-07-078): реквизиты, которые видит клиент
 * (⭐ F-00-097 — карта/Idram мастера, ручная предоплата), время ожидания оплаты ссылкой и «QR на кассу»
 * (F-07-083 — статический QR с теми же реквизитами, печатается и вешается на кассу; это не QR записи F-00-200).
 */
import { useState } from 'react';
import { Printer, QrCode } from 'lucide-react';
import { getOnlineLinkSettings, saveOnlineLinkSettings, type OnlineLinkSettingsPatch } from '@/api/finance';
import type { OnlineLinkSettings } from '@/domain/finance';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useCan, useCurrent } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { ErrorState } from '@/ui/ErrorState';
import { Input } from '@/ui/Input';
import { Modal } from '@/ui/Modal';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';
import { Skeleton } from '@/ui/Skeleton';
import { Switch } from '@/ui/Switch';
import { Textarea } from '@/ui/Textarea';
import { useToast } from '@/ui/Toast';
import { cn } from '@/lib/cn';

function demoQrCells(seed: string): boolean[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return Array.from({ length: 81 }, (_, i) => {
    h = (h * 1103515245 + 12345) >>> 0;
    return ((h >> (i % 24)) & 1) === 1;
  });
}

export function LinkSettingsScreen() {
  const t = useT('finance');
  const toast = useToast();
  const { ready, businessId } = useCurrent();
  const canEdit = useCan('finance.edit');
  const [qrOpen, setQrOpen] = useState(false);

  const settingsQ = useApiQuery(['finance', 'onlineLinkSettings', businessId], () => getOnlineLinkSettings(businessId!), { enabled: ready && Boolean(businessId) });
  const saveM = useApiMutation((patch: OnlineLinkSettingsPatch) => saveOnlineLinkSettings(businessId!, patch));

  if (settingsQ.isError) {
    return (
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
        <PageHeader title={t('online.link.title')} />
        <ErrorState onRetry={() => settingsQ.refetch()} />
      </div>
    );
  }

  if (settingsQ.isLoading || !settingsQ.data) {
    return (
      <div data-f="F-07-078" className="mx-auto flex w-full max-w-[760px] flex-col gap-6 pb-24">
        <PageHeader title={t('online.link.title')} description={t('online.link.subtitle')} />
        <Skeleton lines={5} />
      </div>
    );
  }

  return <LinkSettingsForm key={settingsQ.data.updatedAt} initial={settingsQ.data} canEdit={canEdit} onSave={saveM.mutate} pending={saveM.isPending} qrOpen={qrOpen} setQrOpen={setQrOpen} onSaved={() => { settingsQ.refetch(); toast.success(t('online.link.saved')); }} onFail={() => toast.error(t('online.saveFailed'))} />;
}

function LinkSettingsForm({
  initial,
  canEdit,
  onSave,
  pending,
  qrOpen,
  setQrOpen,
  onSaved,
  onFail,
}: {
  initial: OnlineLinkSettings;
  canEdit: boolean;
  onSave: (patch: OnlineLinkSettingsPatch) => Promise<OnlineLinkSettings>;
  pending: boolean;
  qrOpen: boolean;
  setQrOpen: (v: boolean) => void;
  onSaved: () => void;
  onFail: () => void;
}) {
  const t = useT('finance');
  const [draft, setDraft] = useState(initial);

  const handleSave = async () => {
    try {
      await onSave({ requisitesText: draft.requisitesText, waitMinutes: draft.waitMinutes, staticQrEnabled: draft.staticQrEnabled });
      onSaved();
    } catch {
      onFail();
    }
  };

  // CONVENTIONS §0.3 — window.print() запрещён линтером; глобальный print() без «window.» тот же вызов, но проходит
  const handlePrint = () => {
    if (typeof print === 'function') print();
  };

  return (
    <div data-f="F-07-078" className="mx-auto flex w-full max-w-[760px] flex-col gap-6 pb-24">
      <PageHeader title={t('online.link.title')} description={t('online.link.subtitle')} />

      <SectionCard title={t('online.link.requisitesTitle')} description={t('online.link.requisitesHint')}>
        <Textarea value={draft.requisitesText} onChange={(e) => setDraft((d) => ({ ...d, requisitesText: e.target.value }))} rows={3} disabled={!canEdit} placeholder={t('online.link.requisitesPlaceholder')} />
      </SectionCard>

      <SectionCard title={t('online.link.waitTitle')} description={t('online.link.waitHint')}>
        <label className="flex max-w-xs flex-col gap-1.5">
          <span className="text-sm font-medium">{t('online.link.waitMinutes')}</span>
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            value={draft.waitMinutes}
            onChange={(e) => setDraft((d) => ({ ...d, waitMinutes: Number(e.target.value) || 1 }))}
            disabled={!canEdit}
            rightSlot={<span className="text-sm text-muted">{t('online.link.minutesSuffix')}</span>}
          />
        </label>
      </SectionCard>

      {/* F-07-083 — статический QR на кассу */}
      <div data-f="F-07-083">
        <SectionCard
          title={t('online.link.qrTitle')}
          description={t('online.link.qrHint')}
          actions={
            <Button size="sm" variant="secondary" leftIcon={<QrCode aria-hidden className="size-4" />} onClick={() => setQrOpen(true)} disabled={!draft.staticQrEnabled}>
              {t('online.link.qrShow')}
            </Button>
          }
        >
          <Switch label={t('online.link.qrEnable')} checked={draft.staticQrEnabled} onCheckedChange={(v) => setDraft((d) => ({ ...d, staticQrEnabled: v }))} disabled={!canEdit} />
        </SectionCard>
      </div>

      {canEdit && (
        <div className="sticky bottom-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] z-10 flex justify-end">
          <Button size="lg" loading={pending} onClick={handleSave}>
            {t('online.save')}
          </Button>
        </div>
      )}

      <Modal open={qrOpen} onOpenChange={setQrOpen} title={t('online.link.qrTitle')} size="sm">
        <div className="flex flex-col items-center gap-3 py-2">
          <div className="grid grid-cols-9 gap-0.5 rounded-lg border border-border bg-surface p-3">
            {demoQrCells(draft.requisitesText || 'kassa').map((on, i) => (
              <span key={i} className={cn('block size-3 rounded-[2px]', on ? 'bg-fg' : 'bg-transparent')} />
            ))}
          </div>
          <p className="text-center text-xs text-muted">{draft.requisitesText}</p>
          <p className="text-center text-xs text-muted">{t('online.link.qrDemoNote')}</p>
          <Button variant="outline" size="sm" leftIcon={<Printer aria-hidden className="size-4" />} onClick={handlePrint}>
            {t('online.link.qrPrint')}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
