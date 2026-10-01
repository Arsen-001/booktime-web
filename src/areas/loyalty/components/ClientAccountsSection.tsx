'use client';

/**
 * F-06-137/138/143/196: «Счета клиентов» во вкладке «Лояльность» карточки клиента — открытие счёта,
 * пополнение (с чеком), история операций; персона network (без выбранной локации) видит только просмотр
 * (F-06-196 «у персоны network — только просмотр»). Отдельный файл — чтобы не раздувать ClientCard.tsx.
 *
 * F-06-186 «Счёт клиента в клиентской базе и карточке»: «есть ли счёт и его баланс» — эта секция и есть
 * то место в карточке клиента, где это видно (список счетов с балансом сверху). Колонка «баланс депозита»
 * и фильтр «Баланс счета» в списке клиентской базы — файл `clients` (не наш путь), запрошено в
 * qa/requests/loyalty.md с готовой функцией чтения (`listClientAccounts` ниже даёт баланс по клиенту;
 * для списка нужна сумма по всем клиентам сразу — тоже в запросе).
 *
 * Файл принадлежит разделу «loyalty».
 */
import { useState } from 'react';
import { ChevronDown, Plus, Printer, Wallet } from 'lucide-react';
import {
  getAccountReceipt,
  listAccountOperationsForAccount,
  listAccountTypes,
  listClientAccounts,
  openAccount,
  topupAccount,
  type AccountOperationDetail,
} from '@/api/loyalty';
import { ApiError, useApiMutation, useApiQuery } from '@/api/request';
import { useAccountRights } from '@/areas/loyalty/lib/accountRights';
import { useCurrent } from '@/demo/hooks';
import type { Id } from '@/domain/core';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { SalePaymentField } from '@/areas/loyalty/components/SalePaymentField';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { usePagedList } from '@/ui/Pagination';
import { ErrorState } from '@/ui/ErrorState';
import { FormField } from '@/ui/FormField';
import { IconButton } from '@/ui/IconButton';
import { Modal } from '@/ui/Modal';
import { MoneyInput } from '@/ui/MoneyInput';
import { SectionCard } from '@/ui/SectionCard';
import { Select } from '@/ui/Select';
import { Skeleton, SkeletonText } from '@/ui/Skeleton';
import { useToast } from '@/ui/Toast';

export interface ClientAccountsSectionProps {
  businessId: Id;
  clientId: Id;
}

function ReceiptModal({ businessId, operationId, onClose }: { businessId: Id; operationId: Id | null; onClose: () => void }) {
  const t = useT('loyalty');
  const format = useFormat();
  const q = useApiQuery(['loyalty', 'accountReceipt', businessId, operationId], () => getAccountReceipt(businessId, operationId as Id), { enabled: Boolean(operationId) });
  return (
    <Modal
      open={Boolean(operationId)}
      onOpenChange={(open) => !open && onClose()}
      title={t('clientCard.accounts.receiptTitle')}
      footer={
        <Button leftIcon={<Printer aria-hidden />} onClick={onClose}>
          {t('clientCard.accounts.ok')}
        </Button>
      }
    >
      {q.isLoading && <Skeleton lines={4} />}
      {q.data && (
        <div className="flex flex-col gap-2 text-sm">
          <p className="font-semibold text-fg">{q.data.businessName}</p>
          <p className="text-muted">{format.dateTime(q.data.createdAt)}</p>
          <p className="text-fg">
            {q.data.clientName} · {q.data.clientPhone}
          </p>
          <p className="text-fg">{q.data.accountTypeName}</p>
          <p className="text-lg font-semibold text-fg">
            {/* F-06-143: чек пополнения помечен как «аванс», чек оплаты со счёта — «полный расчёт» */}
            {t(`clientCard.accounts.opType.receipt.${q.data.type}`)}: {format.money(Math.abs(q.data.amount))}
          </p>
          <p className="text-muted">{t('clientCard.accounts.balanceAfter', { balance: format.money(q.data.balanceAfter) })}</p>
        </div>
      )}
    </Modal>
  );
}

function AccountHistory({ businessId, accountId }: { businessId: Id; accountId: Id }) {
  const t = useT('loyalty');
  const format = useFormat();
  const q = useApiQuery(['loyalty', 'accountOps', businessId, accountId], () => listAccountOperationsForAccount(businessId, accountId));
  // Постранично, как во всех списках (DESIGN.md → Long lists)
  const { pageItems, pager } = usePagedList(q.data ?? []);
  if (q.isLoading) return <Skeleton lines={2} />;
  if (q.isError) return <ErrorState compact onRetry={() => q.refetch()} />;
  const rows: AccountOperationDetail[] = q.data ?? [];
  if (rows.length === 0) return <p className="px-1 text-sm text-muted">{t('clientCard.accounts.noOps')}</p>;
  return (
    <>
      <ul className="flex flex-col gap-1 border-t border-border pt-2">
        {pageItems.map((op) => (
          <li key={op.id} className="flex items-center justify-between gap-2 px-1 text-sm">
            <span className="min-w-0 flex-1 truncate text-muted">
              {t(`clientCard.accounts.opType.${op.type}`)} · {format.dateTime(op.createdAt)}
              {op.authorName ? ` · ${op.authorName}` : ''}
            </span>
            <span className="flex shrink-0 flex-col items-end">
              <span className={`font-medium ${op.amount < 0 ? 'text-danger' : 'text-success'}`}>
                {op.amount >= 0 ? '+' : ''}
                {format.money(op.amount)}
              </span>
              <span className="text-xs text-muted">{t('clientCard.accounts.balanceAfter', { balance: format.money(op.balanceAfter) })}</span>
            </span>
          </li>
        ))}
      </ul>
      {pager}
    </>
  );
}

/** Скелетон секции «Счета» — та же карточка с заголовком и строка счёта: значок, тип и баланс, «Пополнить», стрелка */
export function ClientAccountsSectionSkeleton() {
  const t = useT('loyalty');
  return (
    <div className="flex flex-col gap-3" aria-hidden>
      <SectionCard title={t('clientCard.accounts.title')} padding="sm">
        <ul className="flex flex-col gap-2">
          <li className="rounded-lg border border-border p-3">
            <div className="flex items-center gap-2">
              <Wallet aria-hidden className="size-4 shrink-0 text-muted" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-fg">
                  <SkeletonText width="10ch" />
                </p>
                <p className="text-sm font-semibold text-fg">
                  <SkeletonText width="8ch" />
                </p>
              </div>
              <Button size="sm" variant="outline" disabled>
                {t('clientCard.accounts.topup')}
              </Button>
              <span className="size-10 shrink-0 md:size-9" />
            </div>
            <p className="mt-1 pl-6 text-xs text-muted">
              <SkeletonText width="24ch" />
            </p>
          </li>
        </ul>
      </SectionCard>
    </div>
  );
}

export function ClientAccountsSection({ businessId, clientId }: ClientAccountsSectionProps) {
  const t = useT('loyalty');
  const format = useFormat();
  const toast = useToast();
  const { locationId } = useCurrent();
  const rights = useAccountRights();
  // F-06-196: без выбранной локации (сеть) — только просмотр
  const inLocation = locationId !== 'all' && Boolean(locationId);
  // F-06-196/F-06-176: тонкие права «Открыть счет» / «Пополнить счет» (последнее — только вместе с правом на
  // оплату, см. useAccountRights) поверх грубого гейта по локации; «Просмотр счетов» решает, видна ли секция
  // вообще, «Просмотр истории операций по счетам» — видна ли история внутри неё.
  const canOpen = inLocation && rights.openAccount;
  const canTopup = inLocation && rights.topUpAccount;
  const effectiveLocationId = locationId === 'all' || !locationId ? businessId : locationId;

  const typesQ = useApiQuery(['loyalty', 'accountTypes', businessId], () => listAccountTypes(businessId));
  const accountsQ = useApiQuery(['loyalty', 'clientAccounts', businessId, clientId], () => listClientAccounts(businessId, clientId));

  const [openTypeId, setOpenTypeId] = useState('');
  const [openModal, setOpenModal] = useState(false);
  const openMutation = useApiMutation((typeId: Id) => openAccount(businessId, clientId, typeId, effectiveLocationId));

  const [topupTarget, setTopupTarget] = useState<Id | null>(null);
  const [topupAmount, setTopupAmount] = useState<number | undefined>(undefined);
  const [topupMethod, setTopupMethod] = useState('');
  const topupMutation = useApiMutation((args: { id: Id; amount: number }) => topupAccount(businessId, args.id, args.amount, undefined, topupMethod ? { methodKey: topupMethod } : undefined));

  const [expanded, setExpanded] = useState<Id | null>(null);
  const [receiptOpId, setReceiptOpId] = useState<Id | null>(null);

  const accounts = accountsQ.data ?? [];
  const openTypes = (typesQ.data ?? []).filter((ty) => !accounts.some((a) => a.accountTypeId === ty.id));

  const submitOpen = async () => {
    if (!openTypeId) return;
    try {
      await openMutation.mutate(openTypeId as Id);
      toast.success(t('clientCard.accounts.opened'));
      setOpenModal(false);
      setOpenTypeId('');
      accountsQ.refetch();
    } catch {
      toast.error(t('clientCard.accounts.openFailed'));
    }
  };

  const submitTopup = async () => {
    if (!topupTarget || !topupAmount) return;
    try {
      const result = await topupMutation.mutate({ id: topupTarget, amount: topupAmount });
      toast.success(t('clientCard.accounts.toppedUp'));
      setTopupTarget(null);
      setTopupAmount(undefined);
      accountsQ.refetch();
      setReceiptOpId(result.operationId); // F-06-143: чек сразу после пополнения
    } catch (err) {
      if (err instanceof ApiError && ['payment_setup_incomplete', 'method_not_found', 'invalid_amount', 'forbidden'].includes(err.code)) toast.error(t('sell.paymentFailed'));
      else toast.error(t('clientCard.accounts.topupFailed'));
    }
  };

  if (typesQ.isLoading || accountsQ.isLoading || !rights.ready) return <ClientAccountsSectionSkeleton />;
  if (typesQ.isError || accountsQ.isError) return <ErrorState compact onRetry={() => (typesQ.refetch(), accountsQ.refetch())} />;

  // F-06-196: право «Просмотр счетов» — базовое; без него секция скрыта целиком (не только пополнение/история)
  if (!rights.viewAccounts) {
    return (
      <div data-f="F-06-196" className="flex flex-col gap-3">
        <SectionCard title={t('clientCard.accounts.title')} padding="sm">
          <EmptyState compact icon={<Wallet aria-hidden />} title={t('clientCard.accounts.noAccess')} />
        </SectionCard>
      </div>
    );
  }

  return (
    <div data-f="F-06-137 F-06-138 F-06-143 F-06-186 F-06-196 F-06-176 F-04-169 F-04-170 F-04-171 F-04-174 F-04-176" className="flex flex-col gap-3">
      <SectionCard
        title={t('clientCard.accounts.title')}
        padding="sm"
        actions={
          canOpen && openTypes.length > 0 ? (
            <Button size="sm" variant="outline" leftIcon={<Plus aria-hidden />} onClick={() => setOpenModal(true)}>
              {t('clientCard.accounts.open')}
            </Button>
          ) : undefined
        }
      >
        {accounts.length === 0 ? (
          <EmptyState
            compact
            icon={<Wallet aria-hidden />}
            title={t('clientCard.accounts.empty')}
            action={
              canOpen && openTypes.length > 0 ? (
                <Button size="sm" onClick={() => setOpenModal(true)}>
                  {t('clientCard.accounts.open')}
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {accounts.map((a) => {
              const isExpanded = expanded === a.id;
              return (
                <li key={a.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-center gap-2">
                    <Wallet aria-hidden className="size-4 shrink-0 text-primary-text" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-fg">{a.typeName}</p>
                      <p className={`text-sm font-semibold ${a.balance < 0 ? 'text-danger' : 'text-fg'}`}>{format.money(a.balance)}</p>
                    </div>
                    {canTopup && (
                      <Button size="sm" variant="outline" onClick={() => setTopupTarget(a.id)}>
                        {t('clientCard.accounts.topup')}
                      </Button>
                    )}
                    {rights.viewAccountHistory && (
                      <IconButton
                        icon={<ChevronDown aria-hidden className={isExpanded ? 'rotate-180 transition-transform' : 'transition-transform'} />}
                        label={t('clientCard.cards.expand')}
                        size="sm"
                        variant="ghost"
                        onClick={() => setExpanded(isExpanded ? null : a.id)}
                      />
                    )}
                  </div>
                  {a.allowNegative && <p className="mt-1 pl-6 text-xs text-muted">{t('clientCard.accounts.negativeAllowed', { limit: format.money(a.negativeLimit) })}</p>}
                  {rights.viewAccountHistory && isExpanded && <AccountHistory businessId={businessId} accountId={a.id} />}
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      <Modal
        open={openModal}
        onOpenChange={setOpenModal}
        title={t('clientCard.accounts.open')}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpenModal(false)}>
              {t('clientCard.cancel')}
            </Button>
            <Button loading={openMutation.isPending} disabled={!openTypeId} onClick={submitOpen}>
              {t('clientCard.save')}
            </Button>
          </>
        }
      >
        {openTypes.length === 0 ? (
          <EmptyState compact icon={<Wallet aria-hidden />} title={t('clientCard.accounts.noTypes')} />
        ) : (
          <FormField label={t('clientCard.accounts.typeLabel')}>
            <Select value={openTypeId} onValueChange={setOpenTypeId} options={openTypes.map((ty) => ({ value: ty.id, label: ty.name }))} placeholder={t('clientCard.accounts.typePlaceholder')} />
          </FormField>
        )}
      </Modal>

      <Modal
        open={Boolean(topupTarget)}
        onOpenChange={(open) => !open && setTopupTarget(null)}
        title={t('clientCard.accounts.topup')}
        footer={
          <>
            <Button variant="outline" onClick={() => setTopupTarget(null)}>
              {t('clientCard.cancel')}
            </Button>
            <Button loading={topupMutation.isPending} disabled={!topupAmount || !topupMethod} onClick={submitTopup}>
              {t('clientCard.save')}
            </Button>
          </>
        }
      >
        <FormField label={t('clientCard.accounts.amountLabel')}>
          <MoneyInput value={topupAmount} onValueChange={setTopupAmount} />
        </FormField>
        <div className="mt-4">
          <SalePaymentField businessId={businessId} value={topupMethod} onChange={setTopupMethod} enabled={Boolean(topupTarget)} />
        </div>
      </Modal>

      <ReceiptModal businessId={businessId} operationId={receiptOpId} onClose={() => setReceiptOpId(null)} />
    </div>
  );
}
