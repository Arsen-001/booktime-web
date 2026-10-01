'use client';

/**
 * /biz/finance/account-types — «Типы счетов» (F-07-058, кабинет сети): вид личных счетов, на которые
 * клиент вносит деньги заранее (депозит) — где их можно открыть и разрешена ли оплата в минус.
 * ⭐ демо-минимум: полный учёт счетов клиента (открытие/пополнение/списание по типу) — b03,
 * см. qa/plan/finance.md; здесь только справочник типов, как в кабинете сети Altegio.
 */
import { useState } from 'react';
import { useLocale } from 'next-intl';
import { Landmark, Plus, Trash2 } from 'lucide-react';
import { createAccountType, listAccountTypes, removeAccountType, updateAccountType } from '@/api/finance';
import { useCoreList } from '@/api/core';
import { ApiError, useApiMutation, useApiQuery } from '@/api/request';
import type { AccountType, AccountTypeInput } from '@/domain/finance';
import { useCan, useCurrent } from '@/demo/hooks';
import { pickText } from '@/lib/text';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { Checkbox } from '@/ui/Checkbox';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { FormField } from '@/ui/FormField';
import { IconButton } from '@/ui/IconButton';
import { Input } from '@/ui/Input';
import { Modal } from '@/ui/Modal';
import { MoneyInput } from '@/ui/MoneyInput';
import { PageHeader } from '@/ui/PageHeader';
import { SkeletonText } from '@/ui/Skeleton';
import { Switch } from '@/ui/Switch';
import { useConfirm, useToast } from '@/ui/Toast';
import { ExitHold } from '@/ui/ExitHold';

export function AccountTypesScreen() {
  const t = useT('finance');
  const toast = useToast();
  const confirm = useConfirm();
  const { ready, businessId } = useCurrent();
  const canEdit = useCan('finance.edit');
  const [editing, setEditing] = useState<AccountType | 'new' | null>(null);

  const q = useApiQuery(['finance', 'accountTypes', businessId], () => listAccountTypes(businessId!), { enabled: ready && Boolean(businessId) });
  const locationsQ = useCoreList('locations', { businessId: businessId ?? '' }, { enabled: ready && Boolean(businessId) });
  const removeM = useApiMutation((id: string) => removeAccountType(businessId!, id));
  const locale = useLocale();

  if (q.isError) return <ErrorState onRetry={q.refetch} />;
  const types = q.data ?? [];
  const locations = (locationsQ.data ?? []).map((l) => ({ id: l.id, name: pickText(l.name, locale) }));
  const locationName = (id: string) => locations.find((l) => l.id === id)?.name ?? '—';

  const remove = async (row: AccountType) => {
    const ok = await confirm({ title: t('accountTypes.removeTitle'), description: t('accountTypes.removeText', { name: row.name }), tone: 'danger', confirmLabel: t('accountTypes.removeConfirm') });
    if (!ok) return;
    try {
      await removeM.mutate(row.id);
      q.refetch();
      toast.success(t('accountTypes.removed'));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t('accountTypes.removeFailed'));
    }
  };

  return (
    <div data-f="F-07-058" className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
      <PageHeader
        title={t('accountTypes.title')}
        description={t('accountTypes.subtitle')}
        actions={
          canEdit && (
            <Button leftIcon={<Plus aria-hidden />} onClick={() => setEditing('new')}>
              {t('accountTypes.add')}
            </Button>
          )
        }
      />

      {q.isLoading || locationsQ.isLoading ? (
        // Скелетон — та же строка вида счёта (в демо он один: «Депозит на визиты»)
        <ul className="flex flex-col gap-2.5">
          <li className="flex items-start justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3.5">
            <span className="min-w-0 flex-1 py-0.5">
              <span className="block truncate text-sm font-semibold text-fg">
                <SkeletonText width="18ch" />
              </span>
              <span className="mt-1 block text-xs text-muted">
                <SkeletonText width="12ch" />
              </span>
            </span>
            {canEdit && <IconButton label={t('accountTypes.remove')} icon={<Trash2 aria-hidden className="size-4 text-danger" />} size="sm" variant="ghost" disabled />}
          </li>
        </ul>
      ) : types.length === 0 ? (
        <EmptyState
          icon={<Landmark aria-hidden />}
          title={t('accountTypes.emptyTitle')}
          description={t('accountTypes.emptyDescription')}
          action={
            canEdit ? (
              <Button leftIcon={<Plus aria-hidden />} onClick={() => setEditing('new')}>
                {t('accountTypes.add')}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="flex flex-col gap-2.5">
          {types.map((row) => (
            <li key={row.id} className="flex items-start justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3.5">
              <button type="button" onClick={() => canEdit && setEditing(row)} disabled={!canEdit} className="min-w-0 flex-1 py-0.5 text-left disabled:cursor-default">
                <span className="block truncate text-sm font-semibold text-fg">{row.name}</span>
                <span className="mt-1 block text-xs text-muted">{row.locationIds.length === locations.length ? t('accountTypes.allLocations') : row.locationIds.map(locationName).join(', ') || t('accountTypes.noLocations')}</span>
                {row.allowNegative && (
                  <span className="mt-1 inline-block">
                    <Badge tone="warning" size="sm">
                      {t('accountTypes.negativeAllowed', { limit: row.negativeLimit })}
                    </Badge>
                  </span>
                )}
              </button>
              {canEdit && <IconButton label={t('accountTypes.remove')} icon={<Trash2 aria-hidden className="size-4 text-danger" />} size="sm" variant="ghost" onClick={() => remove(row)} disabled={removeM.isPending} />}
            </li>
          ))}
        </ul>
      )}

      <ExitHold value={editing}>
        {(editing) => (
        <AccountTypeFormModal
          businessId={businessId!}
          locations={locations}
          initial={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            q.refetch();
          }}
        />
        )}
      </ExitHold>
    </div>
  );
}

function AccountTypeFormModal({
  businessId,
  locations,
  initial,
  onClose,
  onSaved,
}: {
  businessId: string;
  locations: { id: string; name: string }[];
  initial?: AccountType;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT('finance');
  const toast = useToast();
  const [name, setName] = useState(initial?.name ?? '');
  const [locationIds, setLocationIds] = useState<string[]>(initial?.locationIds ?? locations.map((l) => l.id));
  const [allowNegative, setAllowNegative] = useState(initial?.allowNegative ?? false);
  const [negativeLimit, setNegativeLimit] = useState<number | undefined>(initial?.negativeLimit ?? 0);
  const [saving, setSaving] = useState(false);

  const toggleAll = (checked: boolean) => setLocationIds(checked ? locations.map((l) => l.id) : []);

  const save = async () => {
    setSaving(true);
    try {
      const input: AccountTypeInput = { name: name.trim(), locationIds, allowNegative, negativeLimit: allowNegative ? (negativeLimit ?? 0) : 0 };
      if (initial) await updateAccountType(businessId, initial.id, input);
      else await createAccountType(businessId, input);
      toast.success(t('accountTypes.saved'));
      onSaved();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message === 'negativeLimitRequired' ? t('accountTypes.negativeLimitRequired') : e.message === 'nameRequired' ? t('accountTypes.nameRequired') : t('accountTypes.saveFailed') : t('accountTypes.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const invalid = !name.trim() || (allowNegative && (!negativeLimit || negativeLimit <= 0));

  return (
    <Modal
      open
      onOpenChange={(v) => !v && onClose()}
      title={initial ? initial.name : t('accountTypes.addTitle')}
      footer={
        <Button className="w-full" onClick={save} loading={saving} disabled={invalid}>
          {t('accountTypes.save')}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <FormField label={t('accountTypes.name')}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('accountTypes.namePlaceholder')} />
        </FormField>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{t('accountTypes.locations')}</span>
            <div className="flex gap-2 text-xs">
              <button type="button" className="text-primary-text underline underline-offset-2" onClick={() => toggleAll(true)}>
                {t('accountTypes.selectAll')}
              </button>
              <button type="button" className="text-muted underline underline-offset-2" onClick={() => toggleAll(false)}>
                {t('accountTypes.selectNone')}
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            {locations.map((l) => (
              <Checkbox key={l.id} label={l.name} checked={locationIds.includes(l.id)} onCheckedChange={(v) => setLocationIds((ids) => (v ? [...ids, l.id] : ids.filter((id) => id !== l.id)))} />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <Switch checked={allowNegative} onCheckedChange={setAllowNegative} label={t('accountTypes.allowNegative')} description={t('accountTypes.allowNegativeHint')} />
          {allowNegative && (
            <FormField label={t('accountTypes.negativeLimit')} error={!negativeLimit || negativeLimit <= 0 ? t('accountTypes.negativeLimitRequired') : undefined}>
              <MoneyInput value={negativeLimit} onValueChange={setNegativeLimit} />
            </FormField>
          )}
        </div>
      </div>
    </Modal>
  );
}
