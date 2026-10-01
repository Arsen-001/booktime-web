'use client';

/**
 * «Новый платёж» — ручная операция (F-07-012); получатель/плательщик меняется по виду статьи (F-07-013).
 * ⭐ F-00-129: этой же формой заводится «прошлый визит с суммой» — просто более ранняя дата, без записи в
 * календаре (поле «Дата» не ограничено «сегодня»).
 * fin-review 27.09: открывается сразу на нужном виде (кнопка «Расход» — Ф19), касса выбрана заранее, способ оплаты
 * следует за кассой (наличная касса — наличные, счёт — перевод/карта; Ф19), расход больше остатка наличной кассы не
 * проходит, безналичный — только после вопроса (Ф2), закрытие с набранным — наш вопрос «Уйти без сохранения?» (Ф23).
 */
import { useMemo, useState } from 'react';
import { listAccounts, listCounterparties, listItems, recordOperation } from '@/api/finance';
import { ApiError } from '@/api/request';
import { useCoreList } from '@/api/core';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import type { AccountKind, OperationMethod, OperationPartyType } from '@/domain/finance';
import { useUnsavedGuard } from '@/ui/hooks/useUnsavedGuard';
import { useConfirm } from '@/ui/Toast';
import { useFormat } from '@/i18n/useFormat';

type ManualOperationKind = 'income' | 'expense';
import { combine, nowYerevan, today } from '@/lib/date';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { Combobox, type ComboboxOption } from '@/ui/Combobox';
import { DatePicker } from '@/ui/DatePicker';
import { FormField } from '@/ui/FormField';
import { MoneyInput } from '@/ui/MoneyInput';
import { Select } from '@/ui/Select';
import { Sheet } from '@/ui/Sheet';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { Textarea } from '@/ui/Textarea';
import { TimePicker } from '@/ui/TimePicker';
import { useToast } from '@/ui/Toast';

export interface NewOperationSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** С какого вида открыть: «Новый платёж» — приход, «Расход» — расход (Ф19) */
  initialKind?: ManualOperationKind;
}

/** Способ оплаты по виду кассы: ящик — наличные, расчётный счёт — перевод, прочее — «другое» */
const METHOD_BY_ACCOUNT: Record<AccountKind, OperationMethod> = { cash: 'cash', card: 'transfer', other: 'other' };

export function NewOperationSheet({ open, onOpenChange, initialKind = 'income' }: NewOperationSheetProps) {
  const t = useT('finance');
  const tc = useT('common');
  const toast = useToast();
  const confirm = useConfirm();
  const format = useFormat();
  const { businessId, locationIds, activeLocationIds } = useCurrent();

  // Ф6: справочники формы грузятся заранее (те же ключи, что у экрана — один кэш), чтобы открытие шторки не ждало
  // пять запросов и не перерисовывало её по мере их прихода (кадр 150 мс на CPU×4). Клиенты — только когда нужны.
  const [partyTypeForQuery, setPartyTypeForQuery] = useState<OperationPartyType>('none');
  const itemsQ = useApiQuery(['finance', 'items', businessId], () => listItems(businessId!), { enabled: Boolean(businessId) });
  const accountsQ = useApiQuery(['finance', 'accounts', businessId, activeLocationIds], () => listAccounts(businessId!, activeLocationIds), { enabled: Boolean(businessId) });
  const counterpartiesQ = useApiQuery(['finance', 'counterparties', businessId], () => listCounterparties(businessId!), { enabled: Boolean(businessId) });
  const clientsQ = useCoreList('clients', { businessId: businessId ?? '' }, { enabled: open && partyTypeForQuery === 'client' && Boolean(businessId) });
  const staffQ = useCoreList('staff', { businessId: businessId ?? '' }, { enabled: Boolean(businessId) });

  const [kind, setKind] = useState<ManualOperationKind>(initialKind);
  // Открыли заново с другой кнопкой — вид из кнопки (сброс в рендере, без эффекта)
  const [openedAs, setOpenedAs] = useState<{ open: boolean; kind: ManualOperationKind }>({ open, kind: initialKind });
  if (openedAs.open !== open || openedAs.kind !== initialKind) {
    setOpenedAs({ open, kind: initialKind });
    if (open) setKind(initialKind);
  }
  const [itemId, setItemId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [amount, setAmount] = useState<number | undefined>(undefined);
  const [date, setDate] = useState(() => today());
  const [time, setTime] = useState(() => nowYerevan().format('HH:mm'));
  const [method, setMethod] = useState<OperationMethod>('cash');
  const [partyType, setPartyType] = useState<OperationPartyType>('none');
  const [partyId, setPartyId] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [touched, setTouched] = useState(false);

  const mutation = useApiMutation(
    (input: {
      locationId: string;
      accountId: string;
      itemId: string;
      kind: 'income' | 'expense';
      amount: number;
      date: string;
      method: OperationMethod;
      partyType: OperationPartyType;
      partyId?: string;
      partyName?: string;
      comment?: string;
      allowOverdraft?: boolean;
    }) => {
      const { allowOverdraft, ...rest } = input;
      return recordOperation(businessId!, rest, { allowOverdraft, checkFunds: true });
    },
  );

  const items = (itemsQ.data ?? []).filter((i) => i.kind === kind);
  const accounts = accountsQ.data ?? [];
  // Касса по умолчанию — первая наличная (или первая вообще), пока человек не выбрал свою
  const effectiveAccountId = accountId || accounts.find((a) => a.kind === 'cash')?.id || accounts[0]?.id || '';
  const effectiveMethod = accountId ? method : (METHOD_BY_ACCOUNT[accounts.find((a) => a.id === effectiveAccountId)?.kind ?? 'cash'] ?? method);
  const dirty = Boolean(amount) || Boolean(itemId) || comment.trim().length > 0 || partyId !== null;
  const { confirmLeave } = useUnsavedGuard(open && dirty, { beforeUnload: false });

  const partyOptions: ComboboxOption[] = useMemo(() => {
    if (partyType === 'counterparty') return (counterpartiesQ.data ?? []).map((c) => ({ value: c.id, label: c.name }));
    if (partyType === 'client') return (clientsQ.data ?? []).map((c) => ({ value: c.id, label: `${c.name} · ${c.phone}` }));
    if (partyType === 'staff') return (staffQ.data ?? []).map((s) => ({ value: s.id, label: s.name }));
    return [];
  }, [partyType, counterpartiesQ.data, clientsQ.data, staffQ.data]);

  const reset = () => {
    setKind(initialKind);
    setItemId('');
    setAccountId('');
    setAmount(undefined);
    setDate(today);
    setTime(nowYerevan().format('HH:mm'));
    setMethod('cash');
    setPartyType('none');
    setPartyId(null);
    setComment('');
    setTouched(false);
  };

  const amountError = touched && (!amount || amount <= 0) ? t('operationForm.amountRequired') : undefined;
  const itemError = touched && !itemId ? t('operationForm.itemRequired') : undefined;
  const accountError = touched && !effectiveAccountId ? t('operationForm.accountRequired') : undefined;
  const [fundsError, setFundsError] = useState<string | undefined>(undefined);

  const save = async (allowOverdraft = false) => {
    setTouched(true);
    setFundsError(undefined);
    if (!amount || amount <= 0 || !itemId || !effectiveAccountId) return;
    const account = accounts.find((a) => a.id === effectiveAccountId);
    const partyOption = partyOptions.find((o) => o.value === partyId);
    try {
      await mutation.mutate({
        locationId: account?.locationId ?? activeLocationIds[0] ?? locationIds[0] ?? '',
        accountId: effectiveAccountId,
        itemId,
        kind,
        amount,
        date: combine(date, time),
        method: effectiveMethod,
        partyType,
        partyId: partyId ?? undefined,
        partyName: partyOption?.label,
        comment: comment.trim() || undefined,
        allowOverdraft,
      });
      toast.success(t('operationForm.created'));
      reset();
      onOpenChange(false);
    } catch (e) {
      const code = e instanceof ApiError ? e.code : '';
      if (code === 'insufficient_funds') {
        // Ф2: наличных в ящике меньше суммы — не проводим, говорим сколько есть
        setFundsError(t('operationForm.insufficientCash', { amount: format.money(Number((e as ApiError).message) || 0) }));
        return;
      }
      if (code === 'overdraft') {
        const ok = await confirm({
          title: t('operationForm.overdraftTitle'),
          description: t('operationForm.overdraftText', { amount: format.money(Number((e as ApiError).message) || 0) }),
          confirmLabel: t('operationForm.overdraftConfirm'),
          tone: 'danger',
        });
        if (ok) await save(true);
        return;
      }
      toast.error(t('operationForm.saveFailed'));
    }
  };

  // Ф23: Esc, крестик, свайп и «Отмена» с набранной формой — наш вопрос, а не молчаливая потеря
  const requestClose = async () => {
    if (!(await confirmLeave())) return;
    reset();
    onOpenChange(false);
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          void requestClose();
          return;
        }
        onOpenChange(next);
      }}
      title={t('operationForm.title')}
      footer={
        <>
          <Button variant="secondary" onClick={() => void requestClose()}>
            {tc('actions.cancel')}
          </Button>
          <Button onClick={() => void save()} loading={mutation.isPending}>
            {tc('actions.save')}
          </Button>
        </>
      }
    >
      <div data-f="F-07-012 F-07-013" className="flex flex-col gap-5">
        <FormField label={t('operationForm.kind')}>
          <SegmentedControl
            fullWidth
            value={kind}
            onValueChange={(v) => {
              setKind(v as ManualOperationKind);
              setItemId('');
            }}
            options={[
              { value: 'income', label: t('items.incomeGroup') },
              { value: 'expense', label: t('items.expenseGroup') },
            ]}
          />
        </FormField>

        <FormField label={t('operationForm.item')} required error={itemError}>
          <Select options={items.map((i) => ({ value: i.id, label: i.name }))} value={itemId} onValueChange={setItemId} placeholder={t('operationForm.itemPlaceholder')} />
        </FormField>

        <FormField label={t('operationForm.account')} required error={accountError}>
          <Select
            options={accounts.map((a) => ({ value: a.id, label: a.name }))}
            value={effectiveAccountId}
            onValueChange={(v) => {
              setAccountId(v);
              setFundsError(undefined);
              // Ф19: способ следует за кассой — продажа «картой» не ляжет в наличный ящик
              const acc = accounts.find((a) => a.id === v);
              if (acc) setMethod(METHOD_BY_ACCOUNT[acc.kind]);
            }}
            placeholder={t('operationForm.accountPlaceholder')}
          />
        </FormField>

        <FormField label={t('operationForm.amount')} required error={amountError ?? fundsError}>
          <MoneyInput
            value={amount}
            onValueChange={(v) => {
              setAmount(v);
              setFundsError(undefined);
            }}
            placeholder="0"
            invalid={Boolean(fundsError)}
          />
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField label={t('operationForm.date')}>
            <DatePicker value={date} onValueChange={(v) => v && setDate(v)} max={today()} />
          </FormField>
          <FormField label={t('operationForm.time')}>
            <TimePicker value={time} onValueChange={setTime} />
          </FormField>
        </div>

        <FormField label={t('operationForm.method')}>
          <Select
            options={[
              { value: 'cash', label: t('operations.method.cash') },
              { value: 'card', label: t('operations.method.card') },
              { value: 'transfer', label: t('operations.method.transfer') },
              { value: 'other', label: t('operations.method.other') },
            ]}
            value={effectiveMethod}
            onValueChange={(v) => {
              const next = v as OperationMethod;
              setMethod(next);
              // Ф19: наличные — в наличную кассу, карта/перевод — на безналичный счёт
              const current = accounts.find((a) => a.id === effectiveAccountId);
              const wantCash = next === 'cash';
              if (current && (current.kind === 'cash') !== wantCash) {
                const match = accounts.find((a) => (wantCash ? a.kind === 'cash' : a.kind === 'card')) ?? accounts.find((a) => (a.kind === 'cash') === wantCash);
                if (match) setAccountId(match.id);
                else setAccountId(effectiveAccountId);
              } else if (!accountId) setAccountId(effectiveAccountId);
            }}
          />
        </FormField>

        <FormField label={t('operationForm.party')}>
          <Select
            options={[
              { value: 'none', label: t('operationForm.partyNone') },
              { value: 'counterparty', label: t('counterparties.title') },
              { value: 'client', label: t('operationForm.partyClient') },
              { value: 'staff', label: t('operationForm.partyStaff') },
            ]}
            value={partyType}
            onValueChange={(v) => {
              setPartyType(v as OperationPartyType);
              setPartyTypeForQuery(v as OperationPartyType);
              setPartyId(null);
            }}
          />
        </FormField>

        {partyType !== 'none' && (
          <FormField label={t('operationForm.partyPick')}>
            <Combobox options={partyOptions} value={partyId} onValueChange={(v) => setPartyId(v)} placeholder={t('operationForm.partyPickPlaceholder')} />
          </FormField>
        )}

        <FormField label={t('operationForm.comment')}>
          <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} />
        </FormField>
      </div>
    </Sheet>
  );
}
