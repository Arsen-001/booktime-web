'use client';

/**
 * Модалка создания/правки типа счёта (F-06-135 создание, F-06-136 «Оплата в минус»). По плану раздела
 * форма типа счёта — модалка, не отдельная страница (список короткий, полей мало).
 */
import { useState } from 'react';
import { coreList } from '@/api/core';
import { createAccountType, updateAccountType, type AccountTypeInput } from '@/api/loyalty';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useCurrent, useDemo } from '@/demo/hooks';
import type { Id } from '@/domain/core';
import { isAccountTypeValid, type AccountType } from '@/domain/loyalty';
import { useT } from '@/i18n/useT';
import { pickText } from '@/lib/text';
import { Button } from '@/ui/Button';
import { Checkbox } from '@/ui/Checkbox';
import { EmptyState } from '@/ui/EmptyState';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { Modal } from '@/ui/Modal';
import { MoneyInput } from '@/ui/MoneyInput';
import { Skeleton } from '@/ui/Skeleton';
import { useToast } from '@/ui/Toast';

export interface AccountTypeFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: AccountType;
  onSaved?: () => void;
}

export function AccountTypeFormModal({ open, onOpenChange, initial, onSaved }: AccountTypeFormModalProps) {
  const t = useT('loyalty');
  const tc = useT('common');
  const toast = useToast();
  const { businessId, networkId } = useCurrent();
  const { lang } = useDemo();
  const isEdit = Boolean(initial);

  const locationsQ = useApiQuery(['loyalty', 'locations', businessId], () => coreList('locations', { businessId: businessId ?? '' }), {
    enabled: Boolean(businessId) && open,
  });

  const createMutation = useApiMutation((input: AccountTypeInput) => createAccountType(businessId!, input));
  // Не `initial!.id`: React Compiler по «!» считает initial не-null и выносит чтение поля в рендер.
  const initialId = initial?.id;
  const updateMutation = useApiMutation((input: AccountTypeInput) => {
    if (!initialId) throw new Error('account type is not selected');
    return updateAccountType(businessId!, initialId, input);
  });
  const isSaving = createMutation.isPending || updateMutation.isPending;

  const [name, setName] = useState(initial?.name ?? '');
  const [locationIds, setLocationIds] = useState<Id[]>(initial?.locationIds ?? []);
  const [allowNegative, setAllowNegative] = useState(initial?.allowNegative ?? false);
  const [negativeLimit, setNegativeLimit] = useState<number | undefined>(initial?.negativeLimit ?? 0);
  const [touched, setTouched] = useState(false);

  const nameError = touched && !name.trim() ? t('accountTypeForm.nameRequired') : undefined;
  const limitInvalid = allowNegative && !isAccountTypeValid(true, negativeLimit ?? 0);

  const save = async () => {
    setTouched(true);
    if (!name.trim() || limitInvalid) return;
    const input: AccountTypeInput = { name, locationIds, allowNegative, negativeLimit: allowNegative ? (negativeLimit ?? 0) : 0 };
    try {
      if (isEdit) {
        await updateMutation.mutate(input);
        toast.success(t('accountTypeForm.saved'));
      } else {
        await createMutation.mutate(input);
        toast.success(t('accountTypeForm.created'));
      }
      onSaved?.();
      onOpenChange(false);
    } catch {
      toast.error(t('accountTypeForm.saveFailed'));
    }
  };

  const locations = locationsQ.data ?? [];

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? t('accountTypeForm.editTitle') : t('accountTypeForm.title')}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {tc('actions.cancel')}
          </Button>
          <Button onClick={save} loading={isSaving}>
            {t('accountTypeForm.save')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <FormField label={t('accountTypeForm.name')} required error={nameError}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('accountTypeForm.namePlaceholder')} />
        </FormField>

        <div data-f="F-06-136" className="flex flex-col gap-3">
          <Checkbox checked={allowNegative} onCheckedChange={setAllowNegative} label={t('accountTypeForm.allowNegative')} description={t('accountTypeForm.allowNegativeHint')} />
          {allowNegative && (
            <FormField label={t('accountTypeForm.negativeLimit')} required error={touched && limitInvalid ? t('accountTypeForm.negativeLimitRequired') : undefined}>
              <MoneyInput value={negativeLimit} onValueChange={setNegativeLimit} placeholder="0" />
            </FormField>
          )}
        </div>

        {networkId && (
          <FormField label={t('accountTypeForm.locations')}>
            {locationsQ.isLoading ? (
              <Skeleton lines={2} />
            ) : locations.length === 0 ? (
              <EmptyState compact title={t('cardTypeForm.noLocations')} />
            ) : (
              <div className="flex flex-col gap-1.5 rounded-xl border border-border-strong bg-surface p-3">
                {locations.map((l) => (
                  <Checkbox
                    key={l.id}
                    checked={locationIds.includes(l.id)}
                    onCheckedChange={(checked) => setLocationIds((ids) => (checked ? [...ids, l.id] : ids.filter((id) => id !== l.id)))}
                    label={pickText(l.name, lang)}
                  />
                ))}
              </div>
            )}
          </FormField>
        )}
      </div>
    </Modal>
  );
}
