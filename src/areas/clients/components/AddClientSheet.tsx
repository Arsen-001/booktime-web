'use client';

/**
 * «Добавить клиента» (F-04-001, F-04-044…061, F-00-128): сразу видны имя и телефон, остальное — в «Ещё о клиенте».
 * Дубль номера — не ошибка на месте, а переход в карточку того клиента. Из пустого поиска приходит `prefill`.
 */
import { useState } from 'react';
import { DuplicatePhoneError, addCustomFieldDef, createClient, getShowFullNameFields, listCategoryOptions, listCustomFieldDefs } from '@/api/clients';
import { ApiError, useApiMutation, useApiQuery } from '@/api/request';
import { ClientFormFields, emptyClientDraft, type ClientDraft } from '@/areas/clients/components/ClientFormFields';
import { draftToInput } from '@/areas/clients/lib/draft';
import type { Id } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { Sheet } from '@/ui/Sheet';
import { useToast } from '@/ui/Toast';
import { useUnsavedGuard } from '@/ui/hooks/useUnsavedGuard';

export interface AddClientSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId: Id | undefined;
  /** Имя или номер из пустого поиска (ux-r1 №18) */
  prefill?: string;
  onCreated: (clientId: Id) => void;
  /** Дубль номера (F-00-128): открываем существующую карточку вместо ошибки на месте */
  onDuplicateFound: (clientId: Id) => void;
}

export function AddClientSheet({ open, onOpenChange, businessId, prefill = '', onCreated, onDuplicateFound }: AddClientSheetProps) {
  const t = useT('clients');
  const toast = useToast();
  const create = useApiMutation(createClient);
  // F-04-139 (исправлено): без invalidates список полей не обновлялся сразу — «Своих полей пока нет» висело
  // после «Создать», пока форму не переоткроют. Тот же фикс — в EditClientSheet.
  const addDef = useApiMutation(addCustomFieldDef, { invalidates: (args) => [['clients', 'customFieldDefs', args.businessId]] });
  const enabled = open && Boolean(businessId);

  const categoriesQ = useApiQuery(['clients', 'categories', businessId], () => listCategoryOptions(businessId ?? ''), { enabled });
  const customFieldsQ = useApiQuery(['clients', 'customFieldDefs', businessId], () => listCustomFieldDefs(businessId ?? undefined), { enabled });
  const showFullNameQ = useApiQuery(['clients', 'showFullName', businessId], () => getShowFullNameFields(businessId ?? undefined), { enabled });

  const [draft, setDraft] = useState<ClientDraft>(emptyClientDraft());
  const [errors, setErrors] = useState<Partial<Record<'name' | 'phone', string>>>({});
  // Введено что-то — закрытие шторки (✕, фон, Escape, «Отмена») и уход по ссылке сначала спрашивают
  const [dirty, setDirty] = useState(false);
  const { confirmLeave } = useUnsavedGuard(open && dirty);
  const requestClose = async () => {
    if (!(await confirmLeave())) return;
    setDirty(false);
    onOpenChange(false);
  };

  // Черновик сбрасывается при каждом новом открытии шторки
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setDraft(emptyClientDraft(prefill));
      setErrors({});
      setDirty(false);
    }
  }

  const validate = (): boolean => {
    const next: Partial<Record<'name' | 'phone', string>> = {};
    if (!draft.name.trim()) next.name = t('addClientForm.form.nameRequired');
    if (draft.phone.replace(/\D/g, '').length < 6) next.phone = t('addClientForm.form.phoneRequired');
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    if (!businessId || !validate()) return;
    try {
      const client = await create.mutate({ businessId, ...draftToInput(draft) });
      toast.success(t('addClientForm.success', { name: client.name }));
      setDirty(false);
      onOpenChange(false);
      onCreated(client.id);
    } catch (e) {
      if (e instanceof DuplicatePhoneError) {
        toast.info(t('addClientForm.form.duplicatePhoneOpening'));
        setDirty(false);
        onOpenChange(false);
        onDuplicateFound(e.existingClientId);
      } else if (e instanceof ApiError && e.code === 'invalid_phone') {
        setErrors((prev) => ({ ...prev, phone: t('addClientForm.form.phoneRequired') }));
      } else {
        toast.error(t('addClientForm.failed'));
      }
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => (o ? onOpenChange(true) : void requestClose())}
      title={t('addClientForm.title')}
      description={t('addClientForm.description')}
      size="lg"
      footer={
        <div className="grid w-full grid-cols-[1fr_2fr] gap-2 md:flex md:w-auto md:justify-end">
          <Button variant="outline" onClick={requestClose}>
            {t('addClientForm.cancel')}
          </Button>
          <Button loading={create.isPending} onClick={submit}>
            {t('addClientForm.save')}
          </Button>
        </div>
      }
    >
      <form
        noValidate
        data-f="F-00-128 F-04-001 F-04-044 F-04-046 F-04-061"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <ClientFormFields
          mode="add"
          draft={draft}
          onChange={(patch) => {
            setDirty(true);
            setDraft((d) => ({ ...d, ...patch }));
          }}
          errors={errors}
          showFullName={showFullNameQ.data ?? true}
          categoryOptions={categoriesQ.data ?? []}
          customFieldDefs={customFieldsQ.data ?? []}
          onAddCustomFieldDef={async (input) => {
            if (!businessId) return;
            try {
              await addDef.mutate({ businessId, ...input });
            } catch {
              toast.error(t('addClientForm.form.customFieldFailed'));
            }
          }}
        />
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </Sheet>
  );
}
