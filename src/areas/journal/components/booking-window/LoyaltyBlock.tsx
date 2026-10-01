'use client';

/**
 * F-01-072: блок лояльности клиента — окно записи → правая зона → «Лояльность». Показывает карты,
 * абонементы и сертификаты клиента с балансами, которыми можно оплатить этот визит; без клиента блок
 * не рисуется (ClientZone монтирует его только когда есть matchedClient).
 * Читает @/api/loyalty как чужой раздел (чтение и точечные мутации, тот же приём, что у @/api/clients в
 * JournalSettingsScreen.tsx) — loyalty не даёт полного количества визитов абонемента на строке
 * списка (MembershipRow), поэтому вместо «2 из 2» показываем «Остаток N» (упрощение — assumed).
 *
 * F-01-206: действия «не уходя из визита» — выдать/удалить карту, изменить баланс карты/абонемента/
 * сертификата, заморозить/разморозить абонемент (если тип разрешает). Права блока «Лояльность» в
 * фундаменте одно общее (loyalty.manage) — так же, как у остальных действий лояльности в
 * LoyaltyPaymentPanel (см. её комментарий и src/areas/staff/permissions/catalog.ts) — отдельного
 * права на каждое действие не заводим, это архитектурное решение, а не упрощение этой пачки.
 * История заморозки/операций, ссылка на продажу абонемента для возврата и подраздел «Транзакции
 * лояльности» — это отдельные экраны раздела «Лояльность» (F-01-069 уже даёт туда ссылку), здесь не
 * дублируем.
 */
import { useState } from 'react';
import { CreditCard, Gift, Plus, Snowflake, Ticket, Trash2 } from 'lucide-react';
import type { Id } from '@/domain/core';
import {
  adjustCardBalance,
  adjustCertificate,
  adjustMembership,
  deleteCard,
  issueCard,
  listCardTypes,
  listCards,
  listCertificates,
  listMemberships,
  listMembershipTypes,
  setMembershipFrozen,
} from '@/api/loyalty';
import { ApiError, useApiMutation, useApiQuery } from '@/api/request';
import { useCan, useCurrent } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { useFormat } from '@/i18n/useFormat';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { FormField } from '@/ui/FormField';
import { IconButton } from '@/ui/IconButton';
import { Input } from '@/ui/Input';
import { Modal } from '@/ui/Modal';
import { Select } from '@/ui/Select';
import { Skeleton } from '@/ui/Skeleton';
import { useConfirm, useToast } from '@/ui/Toast';

export interface LoyaltyBlockProps {
  businessId: Id;
  clientId?: Id;
  clientPhone: string;
  locationId?: Id;
}

export function LoyaltyBlock({ businessId, clientId, clientPhone, locationId }: LoyaltyBlockProps) {
  const t = useT('journal');
  const format = useFormat();
  const toast = useToast();
  const confirm = useConfirm();
  const { staffId } = useCurrent();
  const canManage = useCan('loyalty.manage');

  const cardsQuery = useApiQuery(
    ['journal', 'client-loyalty-cards', businessId, clientPhone],
    () => listCards(businessId, { phone: clientPhone }),
    { enabled: Boolean(clientPhone) },
  );
  const membershipsQuery = useApiQuery(
    ['journal', 'client-memberships', businessId, clientPhone],
    () => listMemberships(businessId, { phone: clientPhone, status: 'active' }),
    { enabled: Boolean(clientPhone) },
  );
  const certificatesQuery = useApiQuery(
    ['journal', 'client-certificates', businessId, clientPhone],
    () => listCertificates(businessId, { phone: clientPhone, status: 'active' }),
    { enabled: Boolean(clientPhone) },
  );
  const cardTypesQuery = useApiQuery(
    ['journal', 'card-types-for-loyalty-block', businessId],
    () => listCardTypes(businessId),
    { enabled: canManage },
  );
  const membershipTypesQuery = useApiQuery(
    ['journal', 'membership-types-for-loyalty-block', businessId],
    () => listMembershipTypes(businessId),
    { enabled: canManage },
  );

  const refetchAll = () => {
    cardsQuery.refetch();
    membershipsQuery.refetch();
    certificatesQuery.refetch();
  };

  const [issueOpen, setIssueOpen] = useState(false);
  const [issueTypeId, setIssueTypeId] = useState('');
  const [issueNumber, setIssueNumber] = useState('');
  const issueMutation = useApiMutation(() =>
    issueCard(businessId, clientId as Id, issueTypeId, issueNumber.trim() || undefined),
  );
  async function handleIssueCard() {
    try {
      await issueMutation.mutate(undefined);
      toast.success(t('window.right.loyaltyActions.toastIssued'));
      setIssueOpen(false);
      setIssueTypeId('');
      setIssueNumber('');
      refetchAll();
    } catch (err) {
      // Вторая карта того же типа — сервер и мок отвечают card_type_already_issued: скажем, что не так
      toast.error(
        err instanceof ApiError && err.code === 'card_type_already_issued'
          ? t('window.right.loyaltyActions.toastTypeTaken')
          : t('window.right.loyaltyActions.toastFailed'),
      );
    }
  }

  const deleteMutation = useApiMutation((cardId: Id) => deleteCard(businessId, cardId));
  async function handleDeleteCard(cardId: Id) {
    const ok = await confirm({
      title: t('window.right.loyaltyActions.deleteConfirmTitle'),
      description: t('window.right.loyaltyActions.deleteConfirmText'),
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await deleteMutation.mutate(cardId);
      toast.success(t('window.right.loyaltyActions.toastDeleted'));
      refetchAll();
    } catch {
      toast.error(t('window.right.loyaltyActions.toastFailed'));
    }
  }

  const [balanceTarget, setBalanceTarget] = useState<
    { kind: 'card' | 'membership' | 'certificate'; id: Id; label: string; current: number } | null
  >(null);
  const [balanceValue, setBalanceValue] = useState('');
  const balanceMutation = useApiMutation(async (target: NonNullable<typeof balanceTarget>) => {
    const value = Math.max(0, Number(balanceValue));
    if (target.kind === 'card') {
      await adjustCardBalance(businessId, target.id, locationId as Id, value - target.current);
    } else if (target.kind === 'membership') {
      await adjustMembership(businessId, target.id, { balanceVisits: value }, staffId);
    } else {
      await adjustCertificate(businessId, target.id, { balance: value, byStaffId: staffId });
    }
  });
  async function handleSaveBalance() {
    if (!balanceTarget) return;
    try {
      await balanceMutation.mutate(balanceTarget);
      toast.success(t('window.right.loyaltyActions.toastSaved'));
      setBalanceTarget(null);
      setBalanceValue('');
      refetchAll();
    } catch {
      toast.error(t('window.right.loyaltyActions.toastFailed'));
    }
  }

  const freezeMutation = useApiMutation((args: { id: Id; frozen: boolean; days: number }) =>
    setMembershipFrozen(businessId, args.id, args.frozen, args.days, staffId),
  );
  async function handleToggleFreeze(id: Id, frozen: boolean) {
    // Тернарник — до try: «value block» внутри try/catch React Compiler не компилирует (весь блок остался бы без памяти)
    const doneKey = frozen ? 'window.right.loyaltyActions.toastFrozen' : 'window.right.loyaltyActions.toastUnfrozen';
    try {
      await freezeMutation.mutate({ id, frozen, days: 7 });
      toast.success(t(doneKey));
      refetchAll();
    } catch {
      toast.error(t('window.right.loyaltyActions.toastFailed'));
    }
  }

  const loading = cardsQuery.isLoading || membershipsQuery.isLoading || certificatesQuery.isLoading;
  const cards = cardsQuery.data ?? [];
  const memberships = membershipsQuery.data ?? [];
  const certificates = certificatesQuery.data ?? [];
  const membershipTypeById = new Map((membershipTypesQuery.data ?? []).map((mt) => [mt.id, mt]));
  const empty = !loading && cards.length === 0 && memberships.length === 0 && certificates.length === 0;
  // Тип, карта которого у клиента уже есть, второй раз не выдаётся — в списке его нет
  const cardTypeOptions = (cardTypesQuery.data ?? []).filter((ct) => !cards.some((c) => c.cardTypeId === ct.id)).map((ct) => ({ value: ct.id, label: ct.name }));

  if (loading) {
    return (
      <div data-f="F-01-072" className="flex flex-col gap-2">
        <span className="text-sm font-medium text-fg">{t('window.right.loyaltyTitle')}</span>
        <Skeleton lines={2} />
      </div>
    );
  }

  return (
    <div data-f="F-01-072 F-01-206" className="flex flex-col gap-2 rounded-xl border border-border px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-fg">{t('window.right.loyaltyTitle')}</span>
        {canManage && clientId && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            leftIcon={<Plus aria-hidden />}
            onClick={() => setIssueOpen(true)}
          >
            {t('window.right.loyaltyActions.issueCard')}
          </Button>
        )}
      </div>

      {!canManage && <p className="text-xs text-muted">{t('window.right.loyaltyActions.noRight')}</p>}

      {empty ? (
        <EmptyState compact icon={<Ticket aria-hidden />} title={t('window.right.loyaltyEmpty')} />
      ) : (
        <div className="flex flex-col gap-1.5">
          {memberships.map((m) => {
            const mtype = membershipTypeById.get(m.membershipTypeId);
            const canFreeze = canManage && mtype ? mtype.freezeAllowed : canManage;
            const frozen = m.status === 'frozen';
            return (
              <div key={m.id} className="flex flex-col gap-1 rounded-lg bg-surface-2 px-2 py-1.5">
                <div className="flex items-center gap-2 text-sm">
                  <Ticket aria-hidden className="size-4 shrink-0 text-muted" />
                  <span className="min-w-0 flex-1 truncate text-fg">{m.typeName}</span>
                  <span className="shrink-0 text-muted">
                    {t('window.right.loyaltyMembershipBalance', { count: m.balanceVisits })}
                  </span>
                </div>
                {canManage && (
                  <div className="flex flex-wrap items-center gap-1.5 pl-6">
                    {frozen && <span className="text-xs text-warning">{t('window.right.loyaltyActions.frozenBadge')}</span>}
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setBalanceTarget({ kind: 'membership', id: m.id, label: m.typeName, current: m.balanceVisits })}
                    >
                      {t('window.right.loyaltyActions.adjustBalance')}
                    </Button>
                    {mtype?.freezeAllowed ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        leftIcon={<Snowflake aria-hidden />}
                        loading={freezeMutation.isPending}
                        onClick={() => handleToggleFreeze(m.id, !frozen)}
                      >
                        {t(frozen ? 'window.right.loyaltyActions.unfreeze' : 'window.right.loyaltyActions.freeze')}
                      </Button>
                    ) : (
                      !canFreeze && <span className="text-xs text-muted">{t('window.right.loyaltyActions.freezeNotAllowed')}</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {cards.map((c) => (
            <div key={c.id} className="flex flex-col gap-1 rounded-lg bg-surface-2 px-2 py-1.5">
              <div className="flex items-center gap-2 text-sm">
                <CreditCard aria-hidden className="size-4 shrink-0 text-muted" />
                <span className="min-w-0 flex-1 truncate text-fg">{c.cardTypeName}</span>
                <span className="shrink-0 text-muted">{format.money(c.balance)}</span>
              </div>
              {canManage && (
                <div className="flex flex-wrap items-center gap-1.5 pl-6">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setBalanceTarget({ kind: 'card', id: c.id, label: c.cardTypeName, current: c.balance })}
                  >
                    {t('window.right.loyaltyActions.adjustBalance')}
                  </Button>
                  <IconButton
                    icon={<Trash2 aria-hidden />}
                    label={t('window.right.loyaltyActions.deleteCard')}
                    size="sm"
                    variant="ghost"
                    disabled={deleteMutation.isPending}
                    onClick={() => handleDeleteCard(c.id)}
                  />
                </div>
              )}
            </div>
          ))}
          {certificates.map((c) => (
            <div key={c.id} className="flex flex-col gap-1 rounded-lg bg-surface-2 px-2 py-1.5">
              <div className="flex items-center gap-2 text-sm">
                <Gift aria-hidden className="size-4 shrink-0 text-muted" />
                <span className="min-w-0 flex-1 truncate text-fg">{c.typeName}</span>
                <span className="shrink-0 text-muted">{format.money(c.balance)}</span>
              </div>
              {canManage && (
                <div className="flex flex-wrap items-center gap-1.5 pl-6">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setBalanceTarget({ kind: 'certificate', id: c.id, label: c.typeName, current: c.balance })}
                  >
                    {t('window.right.loyaltyActions.adjustBalance')}
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={issueOpen} onOpenChange={setIssueOpen} title={t('window.right.loyaltyActions.issueCard')} size="sm">
        <div className="flex flex-col gap-3">
          {cardTypeOptions.length === 0 ? (
            <p className="text-sm text-muted">{t('window.right.loyaltyActions.noCardTypes')}</p>
          ) : (
            <>
              <FormField label={t('window.right.loyaltyActions.cardTypeLabel')}>
                <Select
                  options={cardTypeOptions}
                  value={issueTypeId}
                  onValueChange={setIssueTypeId}
                  placeholder={t('window.right.loyaltyActions.cardTypePlaceholder')}
                />
              </FormField>
              <FormField label={t('window.right.loyaltyActions.cardNumberLabel')} hint={t('window.right.loyaltyActions.cardNumberHint')}>
                <Input value={issueNumber} onChange={(e) => setIssueNumber(e.target.value)} />
              </FormField>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIssueOpen(false)}>
                  {t('window.right.loyaltyActions.cancel')}
                </Button>
                <Button type="button" disabled={!issueTypeId} loading={issueMutation.isPending} onClick={handleIssueCard}>
                  {t('window.right.loyaltyActions.issueButton')}
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      <Modal
        open={Boolean(balanceTarget)}
        onOpenChange={(open) => !open && setBalanceTarget(null)}
        title={balanceTarget ? `${t('window.right.loyaltyActions.adjustBalance')} · ${balanceTarget.label}` : ''}
        size="sm"
      >
        {balanceTarget && (
          <div className="flex flex-col gap-3">
            <FormField label={t('window.right.loyaltyActions.newBalanceLabel')}>
              <Input
                type="number"
                min={0}
                value={balanceValue}
                onChange={(e) => setBalanceValue(e.target.value)}
                placeholder={String(balanceTarget.current)}
              />
            </FormField>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setBalanceTarget(null)}>
                {t('window.right.loyaltyActions.cancel')}
              </Button>
              <Button type="button" disabled={balanceValue === ''} loading={balanceMutation.isPending} onClick={handleSaveBalance}>
                {t('window.right.loyaltyActions.save')}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
