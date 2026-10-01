'use client';

/**
 * Перевод денег между кассами (F-07-006) — шторка на /biz/finance/accounts. fin-review Ф2: из наличного ящика нельзя
 * перевести больше, чем в нём есть (ошибка под суммой, кнопка не проводит); безналичный счёт — только после вопроса.
 */
import { useState } from 'react';
import { transferFunds, type AccountWithBalance } from '@/api/finance';
import { ApiError, useApiMutation } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { FormField } from '@/ui/FormField';
import { MoneyInput } from '@/ui/MoneyInput';
import { Select } from '@/ui/Select';
import { Sheet } from '@/ui/Sheet';
import { Textarea } from '@/ui/Textarea';
import { useConfirm, useToast } from '@/ui/Toast';

export interface TransferFundsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: AccountWithBalance[];
}

export function TransferFundsSheet({ open, onOpenChange, accounts }: TransferFundsSheetProps) {
  const t = useT('finance');
  const tc = useT('common');
  const toast = useToast();
  const confirm = useConfirm();
  const format = useFormat();
  const { businessId } = useCurrent();

  // Шторка смонтирована всегда (закрытая): accounts ещё пуст на момент первого рендера, поэтому не
  // замораживаем выбор кассы в initial useState — держим только выбор пользователя (override), а
  // значение по умолчанию считаем заново на каждый рендер, как только кассы подгрузились.
  const [fromIdOverride, setFromIdOverride] = useState<string | null>(null);
  const [toIdOverride, setToIdOverride] = useState<string | null>(null);
  const fromId = fromIdOverride ?? accounts[0]?.id ?? '';
  const toId = toIdOverride ?? accounts[1]?.id ?? '';
  const [amount, setAmount] = useState<number | undefined>(undefined);
  const [comment, setComment] = useState('');
  const [touched, setTouched] = useState(false);

  const mutation = useApiMutation((input: { fromAccountId: string; toAccountId: string; amount: number; comment?: string; allowOverdraft?: boolean }) => transferFunds(businessId!, input));

  const from = accounts.find((a) => a.id === fromId);
  const sameAccount = fromId === toId;
  // Ф2: наличный ящик не уходит в минус — видно сразу, до нажатия «Сохранить»
  const cashShort = Boolean(from && from.kind === 'cash' && amount && amount > from.balance);
  const amountError =
    touched && (!amount || amount <= 0)
      ? t('transferForm.amountRequired')
      : cashShort && from
        ? t('transferForm.insufficientCash', { amount: format.money(Math.max(0, from.balance)) })
        : undefined;

  const save = async (allowOverdraft = false) => {
    setTouched(true);
    if (!amount || amount <= 0 || sameAccount || cashShort) return;
    if (!allowOverdraft && from && from.kind !== 'cash' && amount > from.balance) {
      const ok = await confirm({
        title: t('operationForm.overdraftTitle'),
        description: t('operationForm.overdraftText', { amount: format.money(from.balance) }),
        confirmLabel: t('operationForm.overdraftConfirm'),
        tone: 'danger',
      });
      if (!ok) return;
      allowOverdraft = true;
    }
    try {
      await mutation.mutate({ fromAccountId: fromId, toAccountId: toId, amount, comment: comment.trim() || undefined, allowOverdraft });
      toast.success(t('transferForm.saved'));
      setAmount(undefined);
      setComment('');
      setTouched(false);
      setFromIdOverride(null);
      setToIdOverride(null);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof ApiError && e.code === 'insufficient_funds' ? t('transferForm.insufficientCash', { amount: format.money(Number(e.message) || 0) }) : t('transferForm.saveFailed'));
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('accounts.transfer')}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {tc('actions.cancel')}
          </Button>
          <Button onClick={() => void save()} loading={mutation.isPending}>
            {tc('actions.save')}
          </Button>
        </>
      }
    >
      <div data-f="F-07-006" className="flex flex-col gap-5">
        <FormField label={t('transferForm.from')}>
          <Select options={accounts.map((a) => ({ value: a.id, label: `${a.name} · ${format.money(a.balance)}` }))} value={fromId} onValueChange={setFromIdOverride} />
        </FormField>
        <FormField label={t('transferForm.to')} error={touched && sameAccount ? t('transferForm.sameAccount') : undefined}>
          <Select options={accounts.map((a) => ({ value: a.id, label: a.name }))} value={toId} onValueChange={setToIdOverride} />
        </FormField>
        <FormField label={t('transferForm.amount')} required error={amountError}>
          <MoneyInput value={amount} onValueChange={setAmount} placeholder="0" invalid={cashShort} />
        </FormField>
        {from && amount && !cashShort ? <p className="text-xs text-muted">{t('transferForm.willRemain', { amount: format.money(from.balance - amount) })}</p> : null}
        <FormField label={t('transferForm.comment')}>
          <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} />
        </FormField>
      </div>
    </Sheet>
  );
}
