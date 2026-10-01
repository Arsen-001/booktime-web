'use client';

/**
 * Доверие на карточке мастера: «Документы проверены» (F-00-088), значок «первый» (F-00-181), блок «Стерилизация»
 * (F-00-090) и «Пожаловаться» (F-00-091). Данные — фасады services и platform: проверка документов, снимок
 * стерилизации, награда первому; жалоба уходит в общую очередь проверки платформы (`reportContent`).
 */
import { useState } from 'react';
import { Award, Flag, ShieldCheck, Sparkles } from 'lucide-react';
import { getFirstBadge } from '@/api/platform/demand';
import { useApiMutation, useApiQuery } from '@/api/request';
import { getSterilization, hasVerifiedDocuments, reportContent } from '@/api/services';
import type { Id } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { Modal } from '@/ui/Modal';
import { RadioGroup } from '@/ui/Radio';
import { SectionCard } from '@/ui/SectionCard';
import { Textarea } from '@/ui/Textarea';
import { useToast } from '@/ui/Toast';

/** Значок «Первый в сфере / в районе» (F-00-181) — у бизнеса, которого наградила наша панель */
export function FirstBadge({ businessId }: { businessId: Id }) {
  const t = useT('client');
  const q = useApiQuery(['client', 'firstBadge', businessId], () => getFirstBadge(businessId));
  if (!q.data) return null;
  return (
    <Badge data-f="F-00-181" tone="accent" icon={<Award aria-hidden />}>
      {q.data.scope === 'district' ? t('master.firstInDistrict') : t('master.firstInSphere')}
    </Badge>
  );
}

/** Строка отметок под шапкой мастера; пустая — не рисуется */
export function MasterTrustBadges({ staffId, businessId }: { staffId: Id; businessId: Id }) {
  const t = useT('client');
  const docsQ = useApiQuery(['client', 'verifiedDocs', staffId], () => hasVerifiedDocuments(staffId));
  const firstQ = useApiQuery(['client', 'firstBadge', businessId], () => getFirstBadge(businessId));
  if (!docsQ.data && !firstQ.data) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {docsQ.data && (
        <Badge data-f="F-00-088" tone="success" icon={<ShieldCheck aria-hidden />}>
          {t('master.docsVerified')}
        </Badge>
      )}
      <FirstBadge businessId={businessId} />
    </div>
  );
}

/** Блок «Стерилизация» (F-00-090): виден, только если мастер его заполнил */
export function SterilizationCard({ staffId }: { staffId: Id }) {
  const t = useT('client');
  const q = useApiQuery(['client', 'sterilization', staffId], () => getSterilization(staffId));
  const info = q.data;
  if (!info || (info.methods.length === 0 && !info.note?.trim())) return null;
  return (
    <div data-f="F-00-090">
      <SectionCard title={t('master.sterilizationTitle')}>
        <div className="flex flex-col gap-2 text-sm">
          {info.methods.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {info.methods.map((m) => (
                <Badge key={m} tone="neutral" icon={<Sparkles aria-hidden />}>
                  {t(`master.sterilization.${m}`)}
                </Badge>
              ))}
            </div>
          )}
          {info.note?.trim() && <p className="text-muted">{info.note}</p>}
        </div>
      </SectionCard>
    </div>
  );
}

const REASONS = ['foreignPhotos', 'indecent', 'misleading', 'other'] as const;
type Reason = (typeof REASONS)[number];

/** «Пожаловаться» на карточку мастера (F-00-091) — жалоба попадает в нашу очередь проверки */
export function ReportMasterButton({ staffId, businessId }: { staffId: Id; businessId: Id }) {
  const t = useT('client');
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<Reason>('foreignPhotos');
  const [text, setText] = useState('');
  const send = useApiMutation(reportContent);

  const submit = async () => {
    const label = t(`master.report.reason.${reason}`);
    try {
      await send.mutate({
        kind: 'staff',
        businessId,
        refId: staffId,
        staffId,
        reason: text.trim() ? `${label}: ${text.trim()}` : label,
      });
      toast.success(t('master.report.sent'));
      setOpen(false);
      setText('');
    } catch {
      toast.error(t('master.report.failed'));
    }
  };

  return (
    <>
      <Button data-f="F-00-091" variant="ghost" size="sm" className="self-start text-muted" leftIcon={<Flag aria-hidden />} onClick={() => setOpen(true)}>
        {t('master.report.action')}
      </Button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title={t('master.report.title')}
        description={t('master.report.hint')}
        footer={
          <Button fullWidth loading={send.isPending} onClick={submit}>
            {t('master.report.submit')}
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <RadioGroup
            aria-label={t('master.report.title')}
            value={reason}
            onValueChange={(v) => setReason(v as Reason)}
            options={REASONS.map((r) => ({
              value: r,
              label: t(`master.report.reason.${r}`),
            }))}
          />
          <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={t('master.report.placeholder')} rows={3} maxLength={500} />
        </div>
      </Modal>
    </>
  );
}
