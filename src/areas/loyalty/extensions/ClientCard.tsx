'use client';

/**
 * Вклад раздела «loyalty» в карточку клиента (хост «clientCard»): сертификаты и абонементы клиента —
 * баланс, срок, статус; правка баланса/срока и заморозка абонемента доступны только там, где это
 * разрешает настройка типа (F-06-093, F-06-111) — «Ни в одной локации» / «Только в локации продажи» /
 * «Во всех локациях сети». В сети (демо-персона без выбранной локации — «все локации») правка всегда
 * доступна: настройка программы ограничивает только локацию, не сеть (справка формы типа).
 * Файл принадлежит разделу «loyalty». Посмотреть вклад без хозяина хоста: /dev/ext/clientCard/loyalty
 */
import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, CreditCard, ExternalLink, Gift, History, Pencil, Snowflake, Trash2, Wallet } from 'lucide-react';
import {
  adjustCardBalance,
  adjustCertificate,
  adjustMembership,
  deleteCard,
  getCard,
  getCardSoldPaid,
  issueCard,
  listCardTypes,
  listCards,
  listCertificateTypes,
  listCertificates,
  listMembershipTypes,
  listMemberships,
  setMembershipFrozen,
  type CertificateRow,
  type LoyaltyCardDetail,
  type LoyaltyCardRow,
  type MembershipRow,
} from '@/api/loyalty';
import { ApiError, useApiMutation, useApiQuery } from '@/api/request';
import { ClientAccountsSection, ClientAccountsSectionSkeleton } from '@/areas/loyalty/components/ClientAccountsSection';
import { BadgeSkeleton } from '@/areas/loyalty/components/Skeletons';
import { useCurrent } from '@/demo/hooks';
import type { Id } from '@/domain/core';
import type { CertificateStatus, EditLocationsMode, MembershipStatus } from '@/domain/loyalty';
import type { ClientCardExtProps } from '@/extensions/types';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Badge, type BadgeTone } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { DatePicker } from '@/ui/DatePicker';
import { EmptyState } from '@/ui/EmptyState';
import { usePagedList } from '@/ui/Pagination';
import { ErrorState } from '@/ui/ErrorState';
import { FormField } from '@/ui/FormField';
import { IconButton } from '@/ui/IconButton';
import { Input } from '@/ui/Input';
import { Modal } from '@/ui/Modal';
import { MoneyInput } from '@/ui/MoneyInput';
import { Select } from '@/ui/Select';
import { SectionCard } from '@/ui/SectionCard';
import { Skeleton, SkeletonText } from '@/ui/Skeleton';
import { StatCard } from '@/ui/StatCard';
import { useConfirm, useToast } from '@/ui/Toast';

const CERT_STATUS_TONE: Record<CertificateStatus, BadgeTone> = {
  active: 'success',
  used: 'neutral',
  expired: 'danger',
};

const MEMBERSHIP_STATUS_TONE: Record<MembershipStatus, BadgeTone> = {
  issued: 'info',
  active: 'success',
  frozen: 'warning',
  used: 'neutral',
  expired: 'danger',
  deactivated: 'neutral',
};

/** F-06-093/F-06-111: правка в текущей локации сотрудника; в «сети» (без конкретной локации) — всегда */
function canEditHere(mode: EditLocationsMode, itemLocationId: Id, currentLocationId: Id | 'all' | undefined): boolean {
  if (currentLocationId === 'all' || currentLocationId === undefined) return true;
  if (mode === 'allLocations') return true;
  if (mode === 'saleLocation') return itemLocationId === currentLocationId;
  return false;
}

/**
 * F-06-053/070: плитки «Продано», «Оплачено», «Визиты» и «Кэшбэк (i)» — своим запросом, чтобы не грузить
 * их для каждой карты списком (карт у клиента обычно 1–2, запрос лёгкий и кэшируется по cardId).
 */
function CardSoldPaidTiles({ businessId, cardId }: { businessId: Id; cardId: Id }) {
  const t = useT('loyalty');
  const format = useFormat();
  const q = useApiQuery(['loyalty', 'cardSoldPaid', businessId, cardId], () => getCardSoldPaid(businessId, cardId));
  if (q.isLoading) return <Skeleton variant="rect" className="h-14 sm:col-span-4" />;
  if (q.isError || !q.data) return null;
  return (
    <>
      <StatCard label={t('clientCard.cards.cashback')} value={format.money(q.data.cashback)} />
      <StatCard label={t('clientCard.cards.sold')} value={format.money(q.data.sold)} />
      <StatCard label={t('clientCard.cards.paid')} value={format.money(q.data.paid)} />
      <StatCard label={t('clientCard.cards.visits')} value={String(q.data.visits)} />
    </>
  );
}

/** Скелетон строки сертификата/абонемента — та же рамка и отступы: название со статусом, подпись, кнопки 40 px */
function ClientCardRowSkeleton() {
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-medium text-fg">
            <SkeletonText width="18ch" />
          </span>
          <BadgeSkeleton size="sm" width="8ch" />
        </div>
        <p className="text-sm text-muted">
          <SkeletonText width="28ch" />
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <span className="inline-flex h-10 w-10" />
        <span className="inline-flex h-10 w-10" />
      </div>
    </li>
  );
}

export default function LoyaltyClientCard({ clientId, businessId }: ClientCardExtProps) {
  const t = useT('loyalty');
  const format = useFormat();
  const toast = useToast();
  const confirm = useConfirm();
  const { locationId, staffId } = useCurrent();
  const effectiveLocationId = locationId === 'all' || !locationId ? businessId : locationId;

  const cardTypesQ = useApiQuery(['loyalty', 'cardTypes', businessId], () => listCardTypes(businessId));
  const cardsQ = useApiQuery(['loyalty', 'cards', businessId, 'client', clientId], () => listCards(businessId, { clientId }));
  const certTypesQ = useApiQuery(['loyalty', 'certificateTypes', businessId], () => listCertificateTypes(businessId));
  const certsQ = useApiQuery(['loyalty', 'certificates', businessId, 'client', clientId], () => listCertificates(businessId, { clientId }));
  const membershipTypesQ = useApiQuery(['loyalty', 'membershipTypes', businessId], () => listMembershipTypes(businessId));
  const membershipsQ = useApiQuery(['loyalty', 'memberships', businessId, 'client', clientId], () => listMemberships(businessId, { clientId }));

  // F-06-051/052: выдача карты
  const [issueTypeId, setIssueTypeId] = useState('');
  const [issueNumber, setIssueNumber] = useState('');
  const issueMutation = useApiMutation((args: { cardTypeId: Id; number?: string }) => issueCard(businessId, clientId, args.cardTypeId, args.number));

  // F-06-054: развёрнутая карта (история + акции + сгорание)
  const [expandedCardId, setExpandedCardId] = useState<Id | null>(null);
  const expandedDetailQ = useApiQuery(
    ['loyalty', 'card', businessId, expandedCardId],
    () => getCard(businessId, expandedCardId as Id),
    { enabled: Boolean(expandedCardId) },
  );
  // Постранично, как во всех списках (DESIGN.md → Long lists): операции развёрнутой карты (развёрнута всегда одна)
  const { pageItems: expandedTxPage, pager: expandedTxPager } = usePagedList(expandedDetailQ.data?.transactions ?? [], { resetKey: expandedCardId });

  // F-06-055: ручное начисление/списание
  const [adjustCard, setAdjustCard] = useState<LoyaltyCardRow | null>(null);
  const [adjustAmount, setAdjustAmount] = useState<number | undefined>(undefined);
  const [adjustDirection, setAdjustDirection] = useState<'accrue' | 'charge'>('accrue');
  // Не `adjustCard!.id`: React Compiler по «!» считает adjustCard не-null и выносит чтение поля в рендер.
  const adjustCardId = adjustCard?.id;
  const adjustCardMutation = useApiMutation((amount: number) => {
    if (!adjustCardId) throw new Error('card is not selected');
    return adjustCardBalance(businessId, adjustCardId, effectiveLocationId, amount);
  });

  const deleteCardMutation = useApiMutation((cardId: Id) => deleteCard(businessId, cardId));

  const [editCert, setEditCert] = useState<CertificateRow | null>(null);
  const [certBalance, setCertBalance] = useState<number | undefined>(undefined);
  const [certExpiresAt, setCertExpiresAt] = useState<string | null>(null);
  // Не `editCert!.id`: React Compiler по «!» считает editCert не-null и выносит чтение поля в рендер.
  const editCertId = editCert?.id;
  const adjustCertMutation = useApiMutation((patch: { balance?: number; expiresAt?: string }) => {
    if (!editCertId) throw new Error('certificate is not selected');
    return adjustCertificate(businessId, editCertId, { ...patch, byStaffId: staffId });
  });

  const [editMembership, setEditMembership] = useState<MembershipRow | null>(null);
  const [membershipVisits, setMembershipVisits] = useState<number | undefined>(undefined);
  const [membershipExpiresAt, setMembershipExpiresAt] = useState<string | null>(null);
  // Не `editMembership!.id`: React Compiler по «!» считает editMembership не-null и выносит чтение поля в рендер.
  const editMembershipId = editMembership?.id;
  const adjustMembershipMutation = useApiMutation((patch: { balanceVisits?: number; expiresAt?: string }) => {
    if (!editMembershipId) throw new Error('membership is not selected');
    return adjustMembership(businessId, editMembershipId, patch);
  });
  const freezeMutation = useApiMutation((args: { id: Id; frozen: boolean }) => setMembershipFrozen(businessId, args.id, args.frozen));

  if (cardTypesQ.isError || cardsQ.isError || certTypesQ.isError || certsQ.isError || membershipTypesQ.isError || membershipsQ.isError) {
    return (
      <ErrorState
        onRetry={() => {
          cardTypesQ.refetch();
          cardsQ.refetch();
          certTypesQ.refetch();
          certsQ.refetch();
          membershipTypesQ.refetch();
          membershipsQ.refetch();
        }}
      />
    );
  }
  if (cardTypesQ.isLoading || cardsQ.isLoading || certTypesQ.isLoading || certsQ.isLoading || membershipTypesQ.isLoading || membershipsQ.isLoading) {
    // Скелетон — те же секции с заголовками (карты, сертификаты, абонементы) и по строке в каждой, та же сетка отступов
    return (
      <div className="flex flex-col gap-6" aria-hidden>
        {(['clientCard.cards.title', 'clientCard.certificates.title', 'clientCard.memberships.title'] as const).map((key) => (
          <div key={key} className="flex flex-col gap-3">
            <SectionCard title={t(key)} padding="sm">
              <ul className="flex flex-col gap-2">
                <ClientCardRowSkeleton />
              </ul>
            </SectionCard>
          </div>
        ))}
        <ClientAccountsSectionSkeleton />
      </div>
    );
  }

  const certTypeById = new Map((certTypesQ.data ?? []).map((ct) => [ct.id, ct]));
  const membershipTypeById = new Map((membershipTypesQ.data ?? []).map((mt) => [mt.id, mt]));
  const cards = cardsQ.data ?? [];
  const certificates = certsQ.data ?? [];
  const memberships = membershipsQ.data ?? [];
  // F-06-051 (добавлено проверкой 1): в списке типов на форме выдачи остаются только те, которых у клиента ещё нет;
  // questions-q4 В-40: архивный тип новые карты не выдаёт — сервер (issueCard) это проверяет тоже, но форма не
  // должна предлагать вариант, который заведомо упадёт с ошибкой.
  const issuableCardTypes = (cardTypesQ.data ?? []).filter((ct) => !ct.archived && !cards.some((c) => c.cardTypeId === ct.id));

  const submitIssueCard = async () => {
    if (!issueTypeId) return;
    try {
      await issueMutation.mutate({ cardTypeId: issueTypeId as Id, number: issueNumber.trim() || undefined });
      toast.success(t('clientCard.cards.issued'));
      setIssueTypeId('');
      setIssueNumber('');
      cardsQ.refetch();
    } catch (err) {
      toast.error(
        err instanceof ApiError && err.code === 'card_type_already_issued'
          ? t('clientCard.cards.typeTaken')
          : err instanceof ApiError && err.code === 'validation'
            ? t('clientCard.cards.numberTaken')
            : t('clientCard.cards.issueFailed'),
      );
    }
  };

  const openAdjust = (card: LoyaltyCardRow, direction: 'accrue' | 'charge') => {
    setAdjustCard(card);
    setAdjustDirection(direction);
    setAdjustAmount(undefined);
  };

  const submitAdjust = async () => {
    if (!adjustCard || !adjustAmount) return;
    try {
      await adjustCardMutation.mutate(adjustDirection === 'accrue' ? adjustAmount : -adjustAmount);
      toast.success(adjustDirection === 'accrue' ? t('clientCard.cards.accrued') : t('clientCard.cards.charged'));
      setAdjustCard(null);
      cardsQ.refetch();
      if (expandedCardId === adjustCard.id) expandedDetailQ.refetch();
    } catch {
      toast.error(t('clientCard.cards.adjustFailed'));
    }
  };

  const removeCard = async (card: LoyaltyCardRow) => {
    const ok = await confirm({ title: t('clientCard.cards.deleteConfirmTitle'), description: t('clientCard.cards.deleteConfirmText'), tone: 'danger' });
    if (!ok) return;
    try {
      await deleteCardMutation.mutate(card.id);
      toast.success(t('clientCard.cards.deleted'));
      if (expandedCardId === card.id) setExpandedCardId(null);
      cardsQ.refetch();
    } catch {
      toast.error(t('clientCard.cards.deleteFailed'));
    }
  };

  const openCertEdit = (cert: CertificateRow) => {
    setEditCert(cert);
    setCertBalance(cert.balance);
    setCertExpiresAt(cert.expiresAt ?? null);
  };

  const submitCertEdit = async () => {
    if (!editCert) return;
    try {
      await adjustCertMutation.mutate({ balance: certBalance, expiresAt: certExpiresAt ?? undefined });
      toast.success(t('clientCard.certificates.saved'));
      setEditCert(null);
      certsQ.refetch();
    } catch {
      toast.error(t('clientCard.certificates.saveFailed'));
    }
  };

  const openMembershipEdit = (m: MembershipRow) => {
    setEditMembership(m);
    setMembershipVisits(m.balanceVisits);
    setMembershipExpiresAt(m.expiresAt);
  };

  const submitMembershipEdit = async () => {
    if (!editMembership) return;
    try {
      await adjustMembershipMutation.mutate({ balanceVisits: membershipVisits, expiresAt: membershipExpiresAt ?? undefined });
      toast.success(t('clientCard.memberships.saved'));
      setEditMembership(null);
      membershipsQ.refetch();
    } catch {
      toast.error(t('clientCard.memberships.saveFailed'));
    }
  };

  const toggleFreeze = async (m: MembershipRow, frozen: boolean) => {
    try {
      await freezeMutation.mutate({ id: m.id, frozen });
      toast.success(frozen ? t('clientCard.memberships.frozen') : t('clientCard.memberships.unfrozen'));
      membershipsQ.refetch();
    } catch {
      toast.error(t('clientCard.memberships.actionFailed'));
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div data-f="F-06-051 F-06-052 F-06-053 F-06-054 F-06-055 F-06-056 F-06-060" className="flex flex-col gap-3">
        <SectionCard title={t('clientCard.cards.title')} padding="sm">
          {cards.length === 0 && certificates.length === 0 && memberships.length === 0 && issuableCardTypes.length === 0 ? (
            <EmptyState compact icon={<Wallet aria-hidden />} title={t('clientCard.empty.title')} description={t('clientCard.empty.text')} />
          ) : (
            <div className="flex flex-col gap-3">
              {cards.length === 0 ? (
                <EmptyState compact icon={<Wallet aria-hidden />} title={t('clientCard.cards.emptyTitle')} />
              ) : (
                <ul className="flex flex-col gap-2">
                  {cards.map((card) => {
                    const isExpanded = expandedCardId === card.id;
                    const detail: LoyaltyCardDetail | undefined = isExpanded ? expandedDetailQ.data : undefined;
                    return (
                      <li key={card.id} className="flex flex-col gap-3 rounded-lg border border-border p-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="truncate text-sm font-medium text-fg">{card.cardTypeName}</span>
                              <span className="text-sm text-muted">№ {card.number}</span>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <IconButton
                              icon={<History aria-hidden />}
                              label={t('clientCard.cards.accrue')}
                              variant="ghost"
                              onClick={() => openAdjust(card, 'accrue')}
                            />
                            <IconButton
                              icon={<Snowflake aria-hidden className="rotate-45" />}
                              label={t('clientCard.cards.charge')}
                              variant="ghost"
                              onClick={() => openAdjust(card, 'charge')}
                            />
                            <IconButton icon={<Trash2 aria-hidden />} label={t('clientCard.cards.delete')} variant="ghost" className="text-danger" onClick={() => removeCard(card)} />
                            <IconButton
                              icon={<ChevronDown aria-hidden className={isExpanded ? 'rotate-180 transition-transform' : 'transition-transform'} />}
                              label={t('clientCard.cards.expand')}
                              variant="ghost"
                              onClick={() => setExpandedCardId(isExpanded ? null : card.id)}
                            />
                          </div>
                        </div>
                        <div data-f="F-06-053 F-06-070" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          <StatCard label={t('clientCard.cards.balance')} value={format.money(card.balance)} />
                          <StatCard label={t('clientCard.cards.maxPercent')} value={card.maxPercentDiscount ? `${card.maxPercentDiscount}%` : '—'} />
                          <StatCard label={t('clientCard.cards.maxFixed')} value={card.maxFixedDiscount ? format.money(card.maxFixedDiscount) : '—'} />
                          <CardSoldPaidTiles businessId={businessId} cardId={card.id} />
                        </div>
                        {/* Л16: предупреждение о сгорании — дата, когда бонусы сгорят без визита */}
                        {card.burnsAt && card.balance > 0 && (
                          <p data-f="F-06-025" className="rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning">
                            {t('clientCard.cards.burnsAt', { amount: format.money(card.balance), date: format.date(card.burnsAt, 'long') })}
                          </p>
                        )}
                        {isExpanded && (
                          <div className="flex flex-col gap-3 border-t border-border pt-3">
                            {expandedDetailQ.isLoading && <Skeleton lines={3} />}
                            {expandedDetailQ.isError && <ErrorState compact onRetry={() => expandedDetailQ.refetch()} />}
                            {detail && (
                              <>
                                <StatCard
                                  label={t('clientCard.cards.burnHint')}
                                  value={
                                    cardTypesQ.data?.find((ct) => ct.id === card.cardTypeId)?.burnDays
                                      ? t('clientCard.cards.burnDays', { days: cardTypesQ.data!.find((ct) => ct.id === card.cardTypeId)!.burnDays! })
                                      : t('clientCard.cards.noBurn')
                                  }
                                />
                                <div>
                                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">{t('cardDetail.promotions')}</p>
                                  {detail.promotions.length === 0 ? (
                                    <p className="text-sm text-muted">{t('cardDetail.noPromotions')}</p>
                                  ) : (
                                    <ul className="flex flex-wrap gap-1.5">
                                      {detail.promotions.map((p) => (
                                        <Badge key={p.id} tone={p.kind.startsWith('discount') ? 'primary' : 'accent'} size="sm">
                                          {p.name}
                                        </Badge>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                                <div data-f="F-06-070">
                                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">{t('cardDetail.transactions')}</p>
                                  {detail.transactions.length === 0 ? (
                                    <p className="text-sm text-muted">{t('cardDetail.noTransactions')}</p>
                                  ) : (
                                    <ul className="flex flex-col gap-1.5">
                                      {expandedTxPage.map((tx) => (
                                        <li key={tx.id} className="flex items-center justify-between gap-3 text-sm">
                                          <span className="min-w-0 flex-1 truncate text-muted">
                                            {format.date(tx.createdAt)} · {t(`transactions.types.${tx.type}`)}
                                          </span>
                                          <span className={tx.amount < 0 ? 'font-semibold text-danger' : 'font-semibold text-success'}>
                                            {tx.amount > 0 ? '+' : ''}
                                            {format.money(tx.amount)}
                                          </span>
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                  {expandedTxPager && <div className="mt-3">{expandedTxPager}</div>}
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              {issuableCardTypes.length > 0 && (
                <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-3">
                  <p className="text-sm font-medium text-fg">{t('clientCard.cards.issueTitle')}</p>
                  <p className="text-xs text-muted">{t('clientCard.cards.issueHint')}</p>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <FormField label={t('clientCard.cards.typeLabel')} className="sm:flex-1">
                      <Select
                        options={issuableCardTypes.map((ct) => ({ value: ct.id, label: ct.name }))}
                        value={issueTypeId}
                        onValueChange={setIssueTypeId}
                        placeholder={t('clientCard.cards.typePlaceholder')}
                      />
                    </FormField>
                    <FormField label={t('clientCard.cards.numberLabel')} hint={t('clientCard.cards.numberHint')} className="sm:flex-1">
                      <Input value={issueNumber} onChange={(e) => setIssueNumber(e.target.value)} placeholder="000000000012345" />
                    </FormField>
                    <Button loading={issueMutation.isPending} disabled={!issueTypeId} onClick={submitIssueCard}>
                      {t('clientCard.cards.issueButton')}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </SectionCard>
      </div>

      <div data-f="F-06-093 F-06-099" className="flex flex-col gap-3">
        <SectionCard title={t('clientCard.certificates.title')} padding="sm">
          {certificates.length === 0 ? (
            <EmptyState
              compact
              icon={<Gift aria-hidden />}
              title={t('clientCard.certificates.emptyTitle')}
              description={t('clientCard.certificates.emptyText')}
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {certificates.map((cert) => {
                const type = certTypeById.get(cert.certTypeId);
                const editable = type ? canEditHere(type.editLocationsMode, cert.locationId, locationId) : false;
                return (
                  <li key={cert.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-medium text-fg">{cert.typeName || cert.code}</span>
                        <Badge tone={CERT_STATUS_TONE[cert.status]} size="sm">
                          {t(`certificates.status.${cert.status}`)}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted">
                        {t('clientCard.certificates.balance', { balance: format.money(cert.balance) })}
                        {' · '}
                        {cert.expiresAt
                          ? t('clientCard.certificates.expiresAt', { date: format.date(cert.expiresAt, 'long') })
                          : t('clientCard.certificates.noExpiry')}
                      </p>
                    </div>
                    <div data-f="F-04-218" className="flex shrink-0 items-center gap-1">
                      <Link
                        href={`/biz/loyalty/certificates/${cert.id}`}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-hover hover:text-fg"
                        title={t('clientCard.certificates.goToSale')}
                      >
                        <ExternalLink aria-hidden className="size-4" />
                      </Link>
                      {editable ? (
                        <IconButton icon={<Pencil aria-hidden />} label={t('clientCard.certificates.edit')} variant="ghost" onClick={() => openCertEdit(cert)} />
                      ) : (
                        <span className="text-xs text-muted">{t('clientCard.certificates.editLocked')}</span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>
      </div>

      <div data-f="F-06-111 F-06-112 F-06-125 F-06-126" className="flex flex-col gap-3">
        <SectionCard title={t('clientCard.memberships.title')} padding="sm">
          {memberships.length === 0 ? (
            <EmptyState
              compact
              icon={<CreditCard aria-hidden />}
              title={t('clientCard.memberships.emptyTitle')}
              description={t('clientCard.memberships.emptyText')}
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {memberships.map((m) => {
                const type = membershipTypeById.get(m.membershipTypeId);
                const editable = type ? canEditHere(type.editLocationsMode, m.locationId, locationId) : false;
                const canFreeze = editable && m.status === 'active' && Boolean(type?.freezeAllowed);
                const canUnfreeze = editable && m.status === 'frozen';
                return (
                  <li key={m.id} className="flex flex-col gap-2 rounded-lg border border-border px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-medium text-fg">{m.typeName}</span>
                        <Badge tone={MEMBERSHIP_STATUS_TONE[m.status]} size="sm">
                          {t(`memberships.status.${m.status}`)}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted">
                        {t('clientCard.memberships.visitsLeft', { balance: m.balanceVisits, total: m.totalVisits })}
                        {' · '}
                        {t('clientCard.memberships.expiresAt', { date: format.date(m.expiresAt, 'long') })}
                      </p>
                    </div>
                    <div data-f="F-04-218" className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
                      <Link
                        href={`/biz/loyalty/memberships/${m.id}`}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-hover hover:text-fg"
                        title={t('clientCard.memberships.goToSale')}
                      >
                        <ExternalLink aria-hidden className="size-4" />
                      </Link>
                      {canFreeze && (
                        <Button variant="outline" size="sm" leftIcon={<Snowflake aria-hidden />} loading={freezeMutation.isPending} onClick={() => toggleFreeze(m, true)}>
                          {t('clientCard.memberships.freeze')}
                        </Button>
                      )}
                      {canUnfreeze && (
                        <Button variant="outline" size="sm" loading={freezeMutation.isPending} onClick={() => toggleFreeze(m, false)}>
                          {t('clientCard.memberships.unfreeze')}
                        </Button>
                      )}
                      {editable ? (
                        <IconButton icon={<Pencil aria-hidden />} label={t('clientCard.memberships.edit')} variant="ghost" onClick={() => openMembershipEdit(m)} />
                      ) : (
                        <span className="text-xs text-muted">{t('clientCard.memberships.editLocked')}</span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>
      </div>

      <ClientAccountsSection businessId={businessId} clientId={clientId} />

      <Modal
        open={Boolean(editCert)}
        onOpenChange={(open) => !open && setEditCert(null)}
        title={t('clientCard.certificates.edit')}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditCert(null)}>
              {t('clientCard.cancel')}
            </Button>
            <Button loading={adjustCertMutation.isPending} onClick={submitCertEdit}>
              {t('clientCard.save')}
            </Button>
          </>
        }
      >
        {editCert && (
          <div className="flex flex-col gap-4">
            <FormField label={t('clientCard.certificates.balanceLabel')}>
              <MoneyInput value={certBalance} onValueChange={setCertBalance} max={editCert.nominal} />
            </FormField>
            <FormField label={t('clientCard.certificates.expiresAtLabel')}>
              <DatePicker value={certExpiresAt} onValueChange={setCertExpiresAt} clearable />
            </FormField>
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(editMembership)}
        onOpenChange={(open) => !open && setEditMembership(null)}
        title={t('clientCard.memberships.edit')}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditMembership(null)}>
              {t('clientCard.cancel')}
            </Button>
            <Button loading={adjustMembershipMutation.isPending} onClick={submitMembershipEdit}>
              {t('clientCard.save')}
            </Button>
          </>
        }
      >
        {editMembership && (
          <div className="flex flex-col gap-4">
            <FormField label={t('clientCard.memberships.visitsLabel')}>
              <Input
                type="number"
                min={0}
                max={editMembership.totalVisits}
                value={membershipVisits ?? ''}
                onChange={(e) => setMembershipVisits(Math.max(0, Math.min(editMembership.totalVisits, Number(e.target.value) || 0)))}
              />
            </FormField>
            <FormField label={t('clientCard.memberships.expiresAtLabel')}>
              <DatePicker value={membershipExpiresAt} onValueChange={setMembershipExpiresAt} />
            </FormField>
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(adjustCard)}
        onOpenChange={(open) => !open && setAdjustCard(null)}
        title={adjustDirection === 'accrue' ? t('clientCard.cards.accrue') : t('clientCard.cards.charge')}
        footer={
          <>
            <Button variant="outline" onClick={() => setAdjustCard(null)}>
              {t('clientCard.cancel')}
            </Button>
            <Button loading={adjustCardMutation.isPending} disabled={!adjustAmount} onClick={submitAdjust}>
              {t('clientCard.save')}
            </Button>
          </>
        }
      >
        {adjustCard && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted">{t('clientCard.cards.currentBalance', { balance: format.money(adjustCard.balance) })}</p>
            <FormField label={t('clientCard.cards.amountLabel')}>
              <MoneyInput value={adjustAmount} onValueChange={setAdjustAmount} max={adjustDirection === 'charge' ? adjustCard.balance : undefined} />
            </FormField>
          </div>
        )}
      </Modal>
    </div>
  );
}
