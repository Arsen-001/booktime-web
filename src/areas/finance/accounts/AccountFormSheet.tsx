'use client';

/** Создание (F-07-003) и правка/удаление кассы (F-07-004) — шторка на /biz/finance/accounts. */
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { createAccount, removeAccount, updateAccount, type AccountWithBalance } from '@/api/finance';
import { ApiError, useApiMutation } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import type { Account, AccountKind } from '@/domain/finance';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { MoneyInput } from '@/ui/MoneyInput';
import { Select } from '@/ui/Select';
import { Sheet } from '@/ui/Sheet';
import { Textarea } from '@/ui/Textarea';
import { useConfirm, useToast } from '@/ui/Toast';

export interface AccountFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: AccountWithBalance | Account;
}

export function AccountFormSheet({ open, onOpenChange, initial }: AccountFormSheetProps) {
  const t = useT('finance');
  const tc = useT('common');
  const toast = useToast();
  const confirm = useConfirm();
  const { businessId, locationIds, activeLocationIds } = useCurrent();
  const isEdit = Boolean(initial);

  const [name, setName] = useState(initial?.name ?? '');
  const [kind, setKind] = useState<AccountKind>(initial?.kind ?? 'cash');
  const [openingBalance, setOpeningBalance] = useState<number | undefined>(initial?.openingBalance ?? 0);
  // Шторка смонтирована всегда (закрытая): activeLocationIds/locationIds ещё пустые на момент первого
  // рендера, поэтому не замораживаем их в initial useState — держим только выбор пользователя, а филиал
  // по умолчанию считаем заново на каждый рендер (иначе «Новая касса» уходит с locationId: '' и пропадает
  // из списка, отфильтрованного по филиалу).
  const [locationIdOverride, setLocationIdOverride] = useState<string | null>(initial?.locationId ?? null);
  const locationId = locationIdOverride ?? activeLocationIds[0] ?? locationIds[0] ?? '';
  const [note, setNote] = useState(initial?.note ?? '');
  const [touched, setTouched] = useState(false);

  const createMutation = useApiMutation((input: { name: string; kind: AccountKind; openingBalance: number; locationId: string; note?: string }) =>
    createAccount(businessId!, input),
  );
  // Без initial!.id — React Compiler выносит поле в рендер и падает, пока initial === undefined
  // (шторка «Новая касса» смонтирована всегда, initial появляется только в режиме правки; §18.5)
  const updateMutation = useApiMutation((input: { name: string; kind: AccountKind; openingBalance: number; locationId: string; note?: string }) =>
    updateAccount(businessId!, initial?.id ?? '', input),
  );
  const removeMutation = useApiMutation(() => removeAccount(businessId!, initial?.id ?? ''));
  const isSaving = createMutation.isPending || updateMutation.isPending;

  const nameError = touched && !name.trim() ? t('accountForm.nameRequired') : undefined;

  const reset = () => {
    setName('');
    setKind('cash');
    setOpeningBalance(0);
    setNote('');
    setTouched(false);
  };

  const save = async () => {
    setTouched(true);
    if (!name.trim()) return;
    const input = { name: name.trim(), kind, openingBalance: openingBalance ?? 0, locationId, note: note.trim() || undefined };
    try {
      if (isEdit) {
        await updateMutation.mutate(input);
        toast.success(t('accountForm.saved'));
      } else {
        await createMutation.mutate(input);
        toast.success(t('accountForm.created'));
        reset();
      }
      onOpenChange(false);
    } catch {
      toast.error(t('accountForm.saveFailed'));
    }
  };

  const remove = async () => {
    const ok = await confirm({ title: t('accountForm.deleteTitle'), description: t('accountForm.deleteText'), tone: 'danger', confirmLabel: tc('actions.delete') });
    if (!ok) return;
    try {
      await removeMutation.mutate(undefined);
      toast.success(t('accountForm.deleted'));
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof ApiError && e.code === 'account_in_use' ? t('accountForm.deleteInUse') : t('accountForm.deleteFailed'));
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? t('accountForm.editTitle') : t('accountForm.title')}
      headerActions={
        isEdit && !initial?.systemGenerated ? (
          <Button variant="ghost" leftIcon={<Trash2 aria-hidden />} onClick={remove} loading={removeMutation.isPending} className="text-danger hover:bg-danger-soft">
            {tc('actions.delete')}
          </Button>
        ) : undefined
      }
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {tc('actions.cancel')}
          </Button>
          <Button onClick={save} loading={isSaving}>
            {tc('actions.save')}
          </Button>
        </>
      }
    >
      <div data-f="F-07-003 F-07-004" className="flex flex-col gap-5">
        <FormField label={t('accountForm.name')} required error={nameError}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('accountForm.namePlaceholder')} />
        </FormField>

        <FormField label={t('accountForm.kind')}>
          <Select
            options={[
              { value: 'cash', label: t('accounts.kind.cash') },
              { value: 'card', label: t('accounts.kind.card') },
              { value: 'other', label: t('accounts.kind.other') },
            ]}
            value={kind}
            onValueChange={(v) => setKind(v as AccountKind)}
          />
        </FormField>

        {locationIds.length > 1 && (
          <FormField label={t('accountForm.location')}>
            <Select options={locationIds.map((id) => ({ value: id, label: id }))} value={locationId} onValueChange={setLocationIdOverride} disabled={isEdit} />
          </FormField>
        )}

        {!isEdit && (
          <FormField label={t('accountForm.openingBalance')} hint={t('accountForm.openingBalanceHint')}>
            <MoneyInput value={openingBalance} onValueChange={setOpeningBalance} placeholder="0" />
          </FormField>
        )}

        <FormField label={t('accountForm.note')}>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder={t('accountForm.notePlaceholder')} />
        </FormField>
      </div>
    </Sheet>
  );
}
