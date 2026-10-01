'use client';

/**
 * Ск16: поставщик прихода — из справочника «Контрагенты» финансов, а не свободная строка. Новое имя
 * можно ввести прямо тут: «Добавить „…“» заводит контрагента-поставщика в финансах (если есть право
 * finance.edit), иначе остаётся просто именем в документе. Выбранный контрагент уходит в кассу
 * получателем денег (recordStockFinanceOperation → partyType 'counterparty').
 */
import { createCounterparty, listCounterparties } from '@/api/finance';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useCan } from '@/demo/hooks';
import type { Id } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { Combobox } from '@/ui/Combobox';

export interface SupplierValue {
  counterpartyId?: Id;
  name: string;
}

export interface SupplierFieldProps {
  businessId: Id;
  value: SupplierValue;
  onChange: (value: SupplierValue) => void;
  disabled?: boolean;
  id?: string;
}

export function SupplierField({ businessId, value, onChange, disabled, id }: SupplierFieldProps) {
  const t = useT('stock');
  const canCreate = useCan('finance.edit');
  const q = useApiQuery(['finance', 'counterparties', businessId], () => listCounterparties(businessId), { enabled: Boolean(businessId) });
  const create = useApiMutation((name: string) => createCounterparty(businessId, { type: 'supplier', name }));

  // Поставщики — первыми; остальные контрагенты тоже можно выбрать (ИП, компания)
  const list = [...(q.data ?? [])].sort((a, b) => Number(b.type === 'supplier') - Number(a.type === 'supplier') || a.name.localeCompare(b.name));
  const options = list.map((c) => ({ value: c.id, label: c.name, description: c.phone }));
  // Имя без контрагента (старые документы, ввод без права создавать) — показываем как есть
  if (!value.counterpartyId && value.name) options.unshift({ value: `name:${value.name}`, label: value.name, description: undefined });
  const selected = value.counterpartyId ?? (value.name ? `name:${value.name}` : null);

  const onCreate = async (text: string) => {
    const name = text.trim();
    if (!name) return;
    if (!canCreate) {
      onChange({ name });
      return;
    }
    try {
      const cp = await create.mutate(name);
      onChange({ counterpartyId: cp.id, name: cp.name });
    } catch {
      onChange({ name });
    }
  };

  return (
    <Combobox
      id={id}
      options={options}
      value={selected}
      onValueChange={(v, option) => {
        if (!v) onChange({ name: '' });
        else if (v.startsWith('name:')) onChange({ name: v.slice(5) });
        else onChange({ counterpartyId: v, name: option?.label ?? '' });
      }}
      allowCreate
      onCreate={onCreate}
      loading={q.isLoading || create.isPending}
      placeholder={t('operationForm.counterpartyPlaceholder')}
      emptyText={t('supplier.empty')}
      disabled={disabled}
    />
  );
}
