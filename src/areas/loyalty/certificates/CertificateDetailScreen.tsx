'use client';

/**
 * /biz/loyalty/certificates/[certId] — страница сертификата в сети (F-06-188): баланс, срок, покупатель,
 * списания; владелец может поправить баланс и срок (F-06-099, F-06-195).
 * F-06-101/102: возврат — способ 1 «отменить продажу» (voidCertificateSale, заблокирован, пока
 * сертификатом уже платили — F-06-102) или способ 2 «частичный возврат суммой» (refundCertificateAmount).
 * F-06-103: код показан отдельной строкой как штрихкод — тот же код, что находит сертификат при оплате
 * (findLoyaltyByCode), в т.ч. сканером-клавиатурой.
 */
import { useState } from 'react';
import { Barcode, Pencil, Undo2 } from 'lucide-react';
import { adjustCertificate, getCertificate, refundCertificateAmount, voidCertificateSale } from '@/api/loyalty';
import { ApiError, useApiMutation, useApiQuery } from '@/api/request';
import { useCan, useCurrent } from '@/demo/hooks';
import type { Id } from '@/domain/core';
import type { CertificateStatus } from '@/domain/loyalty';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Badge, type BadgeTone } from '@/ui/Badge';
import { Button, LinkButton } from '@/ui/Button';
import { DatePicker } from '@/ui/DatePicker';
import { ErrorState } from '@/ui/ErrorState';
import { FormField } from '@/ui/FormField';
import { KeyValueList } from '@/ui/KeyValueList';
import { Modal } from '@/ui/Modal';
import { MoneyInput } from '@/ui/MoneyInput';
import { PageHeader } from '@/ui/PageHeader';
import { usePagedList } from '@/ui/Pagination';
import { RadioGroup } from '@/ui/Radio';
import { SectionCard } from '@/ui/SectionCard';
import { Skeleton } from '@/ui/Skeleton';
import { EmptyState } from '@/ui/EmptyState';
import { useToast } from '@/ui/Toast';

const STATUS_TONE: Record<CertificateStatus, BadgeTone> = {
  active: 'success',
  used: 'neutral',
  expired: 'danger',
};

export function CertificateDetailScreen({ certId }: { certId: Id }) {
  const t = useT('loyalty');
  const toast = useToast();
  const format = useFormat();
  const { ready, businessId, staffId } = useCurrent();
  const canManage = useCan('loyalty.manage');

  const q = useApiQuery(['loyalty', 'certificate', businessId, certId], () => getCertificate(businessId!, certId), { enabled: ready && Boolean(businessId) });
  const adjust = useApiMutation((patch: { balance?: number; expiresAt?: string }) => adjustCertificate(businessId!, certId, patch));
  const voidSale = useApiMutation(() => voidCertificateSale(businessId!, certId, staffId));
  const refundAmount = useApiMutation((amount: number) => refundCertificateAmount(businessId!, certId, amount, staffId));

  const [edit, setEdit] = useState(false);
  const [balance, setBalance] = useState<number | undefined>(undefined);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundMode, setRefundMode] = useState<'void' | 'partial'>('void');
  const [refundValue, setRefundValue] = useState<number | undefined>(undefined);
  // Заводим черновик из загруженного сертификата один раз (без useEffect — условный setState
  // прямо в рендере для «синхронизации из запроса» React допускает, это не эффект).
  const [seededFor, setSeededFor] = useState<Id | undefined>(undefined);
  // Постранично, как во всех списках (DESIGN.md → Long lists)
  const { pageItems: txPage, pager: txPager } = usePagedList(q.data?.transactions ?? []);
  if (q.data && seededFor !== certId) {
    setSeededFor(certId);
    setBalance(q.data.balance);
    setExpiresAt(q.data.expiresAt ?? null);
  }

  const submit = async () => {
    try {
      await adjust.mutate({ balance, expiresAt: expiresAt ?? undefined });
      toast.success(t('certificateDetail.saved'));
      setEdit(false);
      q.refetch();
    } catch {
      toast.error(t('certificateDetail.saveFailed'));
    }
  };

  const openRefund = () => {
    setRefundMode('void');
    setRefundValue(q.data?.balance);
    setRefundOpen(true);
  };

  const submitRefund = async () => {
    try {
      if (refundMode === 'void') {
        await voidSale.mutate(undefined);
        toast.success(t('certificateDetail.refundedVoid'));
      } else {
        await refundAmount.mutate(refundValue ?? 0);
        toast.success(t('certificateDetail.refundedPartial'));
      }
      setRefundOpen(false);
      q.refetch();
    } catch (err) {
      toast.error(err instanceof ApiError && err.code === 'has_usage' ? t('certificateDetail.refundBlocked') : t('certificateDetail.refundFailed'));
    }
  };

  if (q.isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
        <Skeleton variant="rect" className="h-24" />
        <Skeleton lines={6} />
      </div>
    );
  }
  if (q.isError || !q.data) return <ErrorState onRetry={q.refetch} />;

  const cert = q.data;

  return (
    <div data-f="F-06-188 F-06-195" className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
      <PageHeader
        title={t('certificateDetail.title', { code: cert.code })}
        back={{ href: '/biz/loyalty/certificates' }}
        meta={<Badge tone={STATUS_TONE[cert.status]}>{t(`certificates.status.${cert.status}`)}</Badge>}
        actions={
          canManage ? (
            <>
              {cert.status !== 'expired' && (
                <Button variant="outline" leftIcon={<Undo2 aria-hidden />} onClick={openRefund}>
                  {t('certificateDetail.refund')}
                </Button>
              )}
              <Button variant="outline" leftIcon={<Pencil aria-hidden />} onClick={() => setEdit(true)}>
                {t('certificateDetail.adjust')}
              </Button>
            </>
          ) : undefined
        }
      />

      <SectionCard title={t('certificateDetail.general')}>
        <KeyValueList
          items={[
            {
              label: t('certificateDetail.barcode'),
              value: (
                <span data-f="F-06-103" className="inline-flex items-center gap-1.5 font-mono tracking-wider">
                  <Barcode aria-hidden className="size-4 text-muted" />
                  {cert.code}
                </span>
              ),
            },
            { label: t('certificateDetail.type'), value: cert.typeName },
            {
              label: t('certificateDetail.nominal'),
              value: format.money(cert.nominal),
            },
            {
              label: t('certificateDetail.balance'),
              value: format.money(cert.balance),
            },
            {
              label: t('certificateDetail.expiresAt'),
              value: cert.expiresAt ? format.date(cert.expiresAt, 'long') : '—',
            },
            {
              label: t('certificateDetail.owner'),
              value: cert.clientId ? (
                <a
                  href={`/biz/clients/${cert.clientId}`}
                  className="inline-flex min-h-10 items-center text-primary-text underline decoration-border-strong underline-offset-2"
                >
                  {cert.clientName} · {format.phone(cert.clientPhone)}
                </a>
              ) : (
                t('certificateDetail.noOwner')
              ),
            },
            {
              label: t('certificateDetail.soldAt'),
              value: format.date(cert.soldAt, 'long'),
            },
            {
              label: t('certificateDetail.location'),
              value: cert.locationName,
            },
            ...(cert.usedLocationNames.length > 0
              ? [
                  {
                    label: t('certificateDetail.usedLocation'),
                    value:
                      cert.usedLocationNames.length === 1
                        ? cert.usedLocationNames[0]
                        : t('certificates.usedLocationsMore', { name: cert.usedLocationNames[0], n: cert.usedLocationNames.length - 1 }),
                  },
                ]
              : []),
          ]}
        />
      </SectionCard>

      <SectionCard title={t('certificateDetail.transactions')}>
        {cert.transactions.length === 0 ? (
          <EmptyState compact title={t('certificateDetail.noTransactions')} />
        ) : (
          <ul className="flex flex-col gap-2">
            {txPage.map((tx) => (
              <li key={tx.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm">
                <span className="text-muted">{format.date(tx.createdAt)}</span>
                <span className="font-semibold text-danger">{format.money(tx.amount)}</span>
              </li>
            ))}
          </ul>
        )}
        {txPager && <div className="mt-4">{txPager}</div>}
      </SectionCard>

      <LinkButton href="/biz/loyalty/certificates" variant="outline" className="self-start">
        {t('certificateDetail.back')}
      </LinkButton>

      <Modal
        open={edit}
        onOpenChange={setEdit}
        title={t('certificateDetail.adjust')}
        footer={
          <>
            <Button variant="outline" onClick={() => setEdit(false)}>
              {t('certificateDetail.cancel')}
            </Button>
            <Button loading={adjust.isPending} onClick={submit}>
              {t('certificateDetail.save')}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <FormField label={t('certificateDetail.balance')}>
            <MoneyInput value={balance} onValueChange={setBalance} max={cert.nominal} />
          </FormField>
          <FormField label={t('certificateDetail.expiresAt')}>
            <DatePicker value={expiresAt} onValueChange={setExpiresAt} />
          </FormField>
        </div>
      </Modal>

      <Modal
        open={refundOpen}
        onOpenChange={setRefundOpen}
        title={t('certificateDetail.refundTitle')}
        footer={
          <>
            <Button variant="outline" onClick={() => setRefundOpen(false)}>
              {t('certificateDetail.cancel2')}
            </Button>
            <Button variant="danger" loading={voidSale.isPending || refundAmount.isPending} onClick={submitRefund} disabled={refundMode === 'partial' && !refundValue}>
              {t('certificateDetail.refundConfirm')}
            </Button>
          </>
        }
      >
        <div data-f="F-06-101 F-06-102 F-04-218" className="flex flex-col gap-4">
          <RadioGroup
            value={refundMode}
            onValueChange={(v) => setRefundMode(v as 'void' | 'partial')}
            options={[
              { value: 'void', label: t('certificateDetail.refundModeVoid') },
              { value: 'partial', label: t('certificateDetail.refundModePartial') },
            ]}
          />
          {refundMode === 'partial' && (
            <FormField label={t('certificateDetail.refundAmount')}>
              <MoneyInput value={refundValue} onValueChange={setRefundValue} max={cert.balance} />
            </FormField>
          )}
        </div>
      </Modal>
    </div>
  );
}
