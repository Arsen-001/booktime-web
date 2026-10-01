'use client';

/**
 * /biz/loyalty/memberships/[membershipId] — карточка абонемента в сети (F-06-187): остаток, срок,
 * дни заморозки, история заморозок; заморозить/разморозить сдвигает срок (F-06-194).
 * F-06-126: заморозка спрашивает период заморозки перед действием — не захардкожена.
 * F-06-125: остаток визитов и срок правятся вручную (с правом «Изменение баланса/срока» — пока общий
 * `loyalty.manage`, см. qa/requests/loyalty.md п.4), правка видна в истории.
 * F-06-102/132: возврат — способ 1 «отменить продажу» (deleteMembershipSale, убирает абонемент у клиента
 * целиком, заблокирован при уже проведённой оплате абонементом) или способ 2 «частичный возврат» (остаток
 * визитов в 0 + сумма записывается транзакцией). F-06-103: код показан отдельной строкой как штрихкод.
 * F-06-121: абонемент — позиция каталога без движения по складу (см. sellMembership в api/loyalty.ts) —
 * поэтому «докупить перед продажей» здесь не нужно.
 */
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Barcode, Pencil, Snowflake, Undo2 } from 'lucide-react';
import { adjustMembership, deleteMembershipSale, getMembership, refundMembershipPartial, setMembershipFrozen } from '@/api/loyalty';
import { ApiError, useApiMutation, useApiQuery } from '@/api/request';
import { useCan, useCurrent } from '@/demo/hooks';
import type { Id } from '@/domain/core';
import type { MembershipStatus } from '@/domain/loyalty';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Badge, type BadgeTone } from '@/ui/Badge';
import { Button, LinkButton } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { KeyValueList } from '@/ui/KeyValueList';
import { Modal } from '@/ui/Modal';
import { MoneyInput } from '@/ui/MoneyInput';
import { PageHeader } from '@/ui/PageHeader';
import { RadioGroup } from '@/ui/Radio';
import { SectionCard } from '@/ui/SectionCard';
import { Skeleton } from '@/ui/Skeleton';
import { useToast } from '@/ui/Toast';

const STATUS_TONE: Record<MembershipStatus, BadgeTone> = {
  issued: 'info',
  active: 'success',
  frozen: 'warning',
  used: 'neutral',
  expired: 'danger',
  deactivated: 'neutral',
};

/** F-06-126: диалог периода заморозки — «период заморозки → Заморозить», не мгновенное действие */
function FreezeDialog({ open, onOpenChange, onConfirm, loading }: { open: boolean; onOpenChange: (open: boolean) => void; onConfirm: (days: number) => void; loading: boolean }) {
  const t = useT('loyalty');
  const [days, setDays] = useState('7');
  const parsed = Number(days);
  const valid = Number.isFinite(parsed) && parsed > 0 && Number.isInteger(parsed);

  return (
    <Modal
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setDays('7');
      }}
      title={t('membershipDetail.freezeDialogTitle')}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('membershipDetail.freezeDialogCancel')}
          </Button>
          <Button leftIcon={<Snowflake aria-hidden />} disabled={!valid} loading={loading} onClick={() => onConfirm(parsed)}>
            {t('membershipDetail.freeze')}
          </Button>
        </>
      }
    >
      <FormField label={t('membershipDetail.freezeDialogDays')} error={days.trim() && !valid ? t('membershipDetail.freezeDialogDaysError') : undefined}>
        <Input inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value.replace(/\D/g, ''))} />
      </FormField>
    </Modal>
  );
}

/** F-06-125: ручная правка остатка визитов и срока действия проданного абонемента */
function AdjustDialog({
  open,
  onOpenChange,
  balanceVisits,
  totalVisits,
  expiresAt,
  onConfirm,
  loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  balanceVisits: number;
  totalVisits: number;
  expiresAt: string;
  onConfirm: (patch: { balanceVisits: number; expiresAt: string }) => void;
  loading: boolean;
}) {
  const t = useT('loyalty');
  const [visits, setVisits] = useState(String(balanceVisits));
  const [date, setDate] = useState(expiresAt);
  const parsedVisits = Number(visits);
  const visitsValid = visits.trim() !== '' && Number.isFinite(parsedVisits) && Number.isInteger(parsedVisits) && parsedVisits >= 0 && parsedVisits <= totalVisits;
  const dateValid = /^\d{4}-\d{2}-\d{2}$/.test(date);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t('membershipDetail.editTitle')}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('membershipDetail.freezeDialogCancel')}
          </Button>
          <Button disabled={!visitsValid || !dateValid} loading={loading} onClick={() => onConfirm({ balanceVisits: parsedVisits, expiresAt: date })}>
            {t('membershipDetail.editSave')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <FormField label={t('membershipDetail.visitsLeft')} hint={t('membershipDetail.editVisitsHint', { total: totalVisits })} error={visits.trim() && !visitsValid ? t('membershipDetail.editVisitsError') : undefined}>
          <Input inputMode="numeric" value={visits} onChange={(e) => setVisits(e.target.value.replace(/\D/g, ''))} />
        </FormField>
        <FormField label={t('membershipDetail.expiresAt')} error={date.trim() && !dateValid ? t('membershipDetail.editExpiresAtError') : undefined}>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </FormField>
      </div>
    </Modal>
  );
}

export function MembershipDetailScreen({ membershipId }: { membershipId: Id }) {
  const t = useT('loyalty');
  const toast = useToast();
  const router = useRouter();
  const format = useFormat();
  const { ready, businessId, staffId } = useCurrent();
  const canEdit = useCan('loyalty.manage');

  const q = useApiQuery(['loyalty', 'membership', businessId, membershipId], () => getMembership(businessId!, membershipId), { enabled: ready && Boolean(businessId) });
  const toggleFreeze = useApiMutation((patch: { frozen: boolean; days?: number }) => setMembershipFrozen(businessId!, membershipId, patch.frozen, patch.days, staffId));
  const adjust = useApiMutation((patch: { balanceVisits: number; expiresAt: string }) => adjustMembership(businessId!, membershipId, patch, staffId));
  const voidSale = useApiMutation(() => deleteMembershipSale(businessId!, membershipId));
  const refundPartial = useApiMutation((amount: number) => refundMembershipPartial(businessId!, membershipId, amount, staffId));

  const [freezeOpen, setFreezeOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundMode, setRefundMode] = useState<'void' | 'partial'>('void');
  const [refundValue, setRefundValue] = useState<number | undefined>(undefined);

  const submitFreeze = async (days: number) => {
    try {
      await toggleFreeze.mutate({ frozen: true, days });
      toast.success(t('membershipDetail.frozen'));
      setFreezeOpen(false);
      q.refetch();
    } catch {
      toast.error(t('membershipDetail.actionFailed'));
    }
  };

  const submitUnfreeze = async () => {
    try {
      await toggleFreeze.mutate({ frozen: false });
      toast.success(t('membershipDetail.unfrozen'));
      q.refetch();
    } catch {
      toast.error(t('membershipDetail.actionFailed'));
    }
  };

  const submitAdjust = async (patch: { balanceVisits: number; expiresAt: string }) => {
    try {
      await adjust.mutate(patch);
      toast.success(t('membershipDetail.editSaved'));
      setEditOpen(false);
      q.refetch();
    } catch {
      toast.error(t('membershipDetail.actionFailed'));
    }
  };

  const openRefund = () => {
    setRefundMode('void');
    setRefundValue(q.data?.price);
    setRefundOpen(true);
  };

  const submitRefund = async () => {
    try {
      if (refundMode === 'void') {
        await voidSale.mutate(undefined);
        toast.success(t('membershipDetail.refundedVoid'));
        router.push('/biz/loyalty/memberships');
        return;
      }
      await refundPartial.mutate(refundValue ?? 0);
      toast.success(t('membershipDetail.refundedPartial'));
      setRefundOpen(false);
      q.refetch();
    } catch (err) {
      toast.error(err instanceof ApiError && err.code === 'has_usage' ? t('membershipDetail.refundBlocked') : t('membershipDetail.refundFailed'));
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

  const m = q.data;
  // F-06-112: у типа с «Нет» кнопки заморозки у проданных абонементов нет — уже начатую заморозку
  // разморозить всё равно можно (запрет действует только на НОВУЮ заморозку).
  const canFreeze = m.status === 'active' && m.typeFreezeAllowed;
  const canUnfreeze = m.status === 'frozen';

  return (
    <div data-f="F-06-187 F-06-194 F-06-112 F-06-125 F-06-126 F-06-121" className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
      <PageHeader
        title={t('membershipDetail.title', { type: m.typeName })}
        back={{ href: '/biz/loyalty/memberships' }}
        meta={<Badge tone={STATUS_TONE[m.status]}>{t(`memberships.status.${m.status}`)}</Badge>}
        actions={
          <>
            {canEdit && m.status !== 'deactivated' && (
              <Button variant="outline" leftIcon={<Undo2 aria-hidden />} onClick={openRefund}>
                {t('membershipDetail.refund')}
              </Button>
            )}
            {canEdit && (
              <Button variant="outline" leftIcon={<Pencil aria-hidden />} onClick={() => setEditOpen(true)}>
                {t('membershipDetail.editBalance')}
              </Button>
            )}
            {canFreeze ? (
              <Button variant="outline" leftIcon={<Snowflake aria-hidden />} onClick={() => setFreezeOpen(true)}>
                {t('membershipDetail.freeze')}
              </Button>
            ) : canUnfreeze ? (
              <Button variant="outline" onClick={submitUnfreeze} loading={toggleFreeze.isPending}>
                {t('membershipDetail.unfreeze')}
              </Button>
            ) : undefined}
          </>
        }
      />

      <SectionCard title={t('membershipDetail.general')}>
        <KeyValueList
          items={[
            {
              label: t('membershipDetail.barcode'),
              value: (
                <span data-f="F-06-103" className="inline-flex items-center gap-1.5 font-mono tracking-wider">
                  <Barcode aria-hidden className="size-4 text-muted" />
                  {m.code || '—'}
                </span>
              ),
            },
            { label: t('membershipDetail.visitsLeft'), value: `${m.balanceVisits} / ${m.totalVisits}` },
            { label: t('membershipDetail.expiresAt'), value: format.date(m.expiresAt, 'long') },
            { label: t('membershipDetail.frozenDays'), value: String(m.frozenDays) },
            { label: t('membershipDetail.price'), value: format.money(m.price) },
            {
              label: t('membershipDetail.owner'),
              value: (
                <Link href={`/biz/clients/${m.clientId}`} className="inline-flex min-h-10 items-center text-primary-text underline decoration-border-strong underline-offset-2">
                  {m.clientName} · {format.phone(m.clientPhone)}
                </Link>
              ),
            },
            { label: t('membershipDetail.location'), value: m.locationName },
          ]}
        />
        <p className="mt-3 text-xs text-muted">{t('membershipDetail.noStockNote')}</p>
      </SectionCard>

      <SectionCard title={t('membershipDetail.freezeHistory')}>
        {m.freezeHistory.length === 0 ? (
          <EmptyState compact title={t('membershipDetail.noFreezeHistory')} />
        ) : (
          <ul className="flex flex-col gap-2">
            {m.freezeHistory.map((entry, i) => (
              <li key={i} className="flex flex-col gap-0.5 rounded-lg border border-border px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <span className="text-fg">{entry.action === 'freeze' ? t('membershipDetail.frozenAt', { days: entry.days }) : t('membershipDetail.unfrozenAt')}</span>
                <span className="text-muted">
                  {entry.byName ?? t('membershipDetail.byUnknown')} · {format.date(entry.at, 'long')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <LinkButton href="/biz/loyalty/memberships" variant="outline" className="self-start">
        {t('membershipDetail.back')}
      </LinkButton>

      <FreezeDialog open={freezeOpen} onOpenChange={setFreezeOpen} onConfirm={submitFreeze} loading={toggleFreeze.isPending} />
      <AdjustDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        balanceVisits={m.balanceVisits}
        totalVisits={m.totalVisits}
        expiresAt={m.expiresAt}
        onConfirm={submitAdjust}
        loading={adjust.isPending}
      />

      <Modal
        open={refundOpen}
        onOpenChange={setRefundOpen}
        title={t('membershipDetail.refundTitle')}
        footer={
          <>
            <Button variant="outline" onClick={() => setRefundOpen(false)}>
              {t('membershipDetail.freezeDialogCancel')}
            </Button>
            <Button variant="danger" loading={voidSale.isPending || refundPartial.isPending} onClick={submitRefund} disabled={refundMode === 'partial' && !refundValue}>
              {t('membershipDetail.refundConfirm')}
            </Button>
          </>
        }
      >
        <div data-f="F-06-102 F-06-132 F-04-218" className="flex flex-col gap-4">
          <RadioGroup
            value={refundMode}
            onValueChange={(v) => setRefundMode(v as 'void' | 'partial')}
            options={[
              { value: 'void', label: t('membershipDetail.refundModeVoid') },
              { value: 'partial', label: t('membershipDetail.refundModePartial') },
            ]}
          />
          {refundMode === 'partial' && (
            <FormField label={t('membershipDetail.refundAmount')}>
              <MoneyInput value={refundValue} onValueChange={setRefundValue} max={m.price} />
            </FormField>
          )}
        </div>
      </Modal>
    </div>
  );
}
