'use client';

/**
 * «Изменить клиента» — та же шторка, что и «Добавить», а не форма, раскрывающаяся внутри вкладки ниже сгиба (ux-r2 №6,
 * ux-r5 улучшение 3). Фото — первым полем; смена имени спрашивает подтверждение (F-04-062).
 */
import { useState } from 'react';
import { addCustomFieldDef, deleteCustomFieldDef, getCustomFieldValues, getShowFullNameFields, listCategoryOptions, listCustomFieldDefs, updateClient } from '@/api/clients';
import { ApiError, useApiMutation, useApiQuery } from '@/api/request';
import { ClientFormFields, emptyClientDraft, type ClientDraft } from '@/areas/clients/components/ClientFormFields';
import { draftToInput, rowToDraft } from '@/areas/clients/lib/draft';
import type { UseClientsRightsResult } from '@/areas/clients/lib/rights';
import type { ClientRow } from '@/domain/clients';
import type { Id } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { FormField } from '@/ui/FormField';
import { ImageUpload } from '@/ui/ImageUpload';
import { Sheet } from '@/ui/Sheet';
import { useConfirm, useToast } from '@/ui/Toast';
import { useUnsavedGuard } from '@/ui/hooks/useUnsavedGuard';

export interface EditClientSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: ClientRow;
  businessId: Id;
  staffId: Id | undefined;
  authorName: string;
  rights: UseClientsRightsResult;
}

export function EditClientSheet({ open, onOpenChange, row, businessId, staffId, authorName, rights }: EditClientSheetProps) {
  const t = useT('clients');
  const toast = useToast();
  const confirm = useConfirm();
  const save = useApiMutation(updateClient);
  // F-04-139 (исправлено): без invalidates список полей не обновлялся сразу после «Создать»
  const addDef = useApiMutation(addCustomFieldDef, { invalidates: () => [['clients', 'customFieldDefs', businessId]] });
  // F-04-144: удаление поля — сбрасываем и список полей, и уже загруженные значения этой карточки
  const deleteDef = useApiMutation(deleteCustomFieldDef, {
    invalidates: () => [['clients', 'customFieldDefs', businessId], ['clients', 'customFieldValues', row.id]],
  });
  const categoriesQ = useApiQuery(['clients', 'categories', businessId], () => listCategoryOptions(businessId), { enabled: open });
  const defsQ = useApiQuery(['clients', 'customFieldDefs', businessId], () => listCustomFieldDefs(businessId), { enabled: open });
  const valuesQ = useApiQuery(['clients', 'customFieldValues', row.id], () => getCustomFieldValues(row.id), { enabled: open });
  const fullNameQ = useApiQuery(['clients', 'showFullName', businessId], () => getShowFullNameFields(businessId), { enabled: open });

  const [draft, setDraft] = useState<ClientDraft>(emptyClientDraft());
  const [avatar, setAvatar] = useState<string[]>([]);
  const [errors, setErrors] = useState<Partial<Record<'name' | 'phone', string>>>({});
  // Поправили что-то — закрытие шторки (✕, фон, Escape, «Отмена») и уход по ссылке сначала спрашивают
  const [dirty, setDirty] = useState(false);
  const { confirmLeave } = useUnsavedGuard(open && dirty);
  const requestClose = async () => {
    if (!(await confirmLeave())) return;
    setDirty(false);
    onOpenChange(false);
  };
  // Черновик — из карточки при каждом открытии; доп. поля подхватываем, когда придут (подхват по id — §18 п. 6)
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setDraft(rowToDraft(row, valuesQ.data ?? {}));
      setAvatar(row.avatar ? [row.avatar] : []);
      setErrors({});
      setDirty(false);
    }
  }
  const values = valuesQ.data;
  if (open && values && Object.keys(values).length > 0 && Object.keys(draft.customFieldValues).length === 0) {
    setDraft((d) => ({ ...d, customFieldValues: values }));
  }

  const submit = async () => {
    const next: Partial<Record<'name' | 'phone', string>> = {};
    if (!draft.name.trim()) next.name = t('addClientForm.form.nameRequired');
    if (draft.phone.replace(/\D/g, '').length < 6) next.phone = t('addClientForm.form.phoneRequired');
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    if (draft.name.trim() !== row.name) {
      const ok = await confirm({ title: t('card.confirmNameChange.title'), description: t('card.confirmNameChange.description'), tone: 'primary' });
      if (!ok) return;
    }
    try {
      await save.mutate({ clientId: row.id, businessId, ...draftToInput(draft), avatar: avatar[0], actorId: staffId, actorName: authorName });
      toast.success(t('card.saved'));
      setDirty(false);
      onOpenChange(false);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'duplicate_phone') setErrors((prev) => ({ ...prev, phone: t('addClientForm.form.duplicatePhone') }));
      else if (e instanceof ApiError && e.code === 'forbidden') toast.error(t('card.editForbidden'));
      else toast.error(t('card.saveFailed'));
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => (o ? onOpenChange(true) : void requestClose())}
      title={t('cardView.editTitle')}
      size="lg"
      footer={
        <div className="grid w-full grid-cols-[1fr_2fr] gap-2 md:flex md:w-auto md:justify-end">
          <Button variant="outline" onClick={requestClose}>
            {t('addClientForm.cancel')}
          </Button>
          <Button loading={save.isPending} onClick={submit}>
            {t('card.save')}
          </Button>
        </div>
      }
    >
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <ClientFormFields
          mode="edit"
          draft={draft}
          onChange={(patch) => {
            setDirty(true);
            setDraft((d) => ({ ...d, ...patch }));
          }}
          errors={errors}
          showFullName={fullNameQ.data ?? true}
          categoryOptions={categoriesQ.data ?? []}
          customFieldDefs={defsQ.data ?? []}
          onAddCustomFieldDef={async (input) => {
            try {
              await addDef.mutate({ businessId, ...input });
            } catch {
              toast.error(t('addClientForm.form.customFieldFailed'));
            }
          }}
          onDeleteCustomFieldDef={rights.editCustomFields ? (fieldId) => deleteDef.mutate({ businessId, fieldId }) : undefined}
          sold={row.sold}
          hasApp={Boolean(row.appUserId)}
          canEditGeneral={rights.editClient}
          canEditFullName={rights.editFullName}
          canEditNote={rights.editNote}
          canEditCustomFields={rights.editCustomFields}
          canViewCustomFields={rights.viewCustomFields}
          photo={
            <div data-f="F-04-069">
              <FormField label={t('card.photo')}>
                <ImageUpload
                  value={avatar}
                  onValueChange={(v) => {
                    setDirty(true);
                    setAvatar(v);
                  }} max={1} aspect="square" maxSizeMb={12} className="max-w-32" />
              </FormField>
            </div>
          }
        />
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </Sheet>
  );
}
