'use client';

/**
 * Форма клиента, «Свои поля» бизнеса (F-04-060, F-04-198) + конструктор доп. полей (F-04-139…145):
 * значения по типу поля, добавление нового поля (тип, варианты списка, обязательность, редактирование клиентом).
 */
import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { ClientDraft } from '@/areas/clients/components/ClientFormFields';
import type { CustomFieldDef, CustomFieldType } from '@/domain/clients';
import { CUSTOM_FIELD_TYPES } from '@/domain/clients';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { FormField } from '@/ui/FormField';
import { IconButton } from '@/ui/IconButton';
import { Input } from '@/ui/Input';
import { DatePicker } from '@/ui/DatePicker';
import { Modal } from '@/ui/Modal';
import { Select } from '@/ui/Select';
import { Switch } from '@/ui/Switch';
import { useToast } from '@/ui/Toast';

/** F-04-139…145: то, что форма отдаёт наружу, когда бизнес создаёт новое доп. поле */
export interface NewCustomFieldInput {
  label: string;
  type: CustomFieldType;
  options?: string[];
  required: boolean;
  editableByClient: boolean;
  alwaysShowInClientCard: boolean;
  alwaysShowInBookingWindow: boolean;
}

export interface CustomFieldsProps {
  draft: ClientDraft;
  onChange: (patch: Partial<ClientDraft>) => void;
  defs: CustomFieldDef[];
  onAddDef: (input: NewCustomFieldInput) => void;
  canEdit: boolean;
  /** F-04-198: без права «Просмотр доп. полей» секция не показывается вовсе (не только disabled) */
  canView?: boolean;
  /**
   * F-04-144: удаление доп. поля. Необязательный — форма «Добавить клиента» тоже может звать конструктор
   * полей до того, как у клиента есть businessId с реальными полями; передаётся там, где удаление уместно
   * (карточка/форма правки).
   */
  onDeleteDef?: (fieldId: string) => void | Promise<void>;
}

export function CustomFields({ draft, onChange, defs, onAddDef, canEdit, canView = true, onDeleteDef }: CustomFieldsProps) {
  const t = useT('clients');
  const toast = useToast();
  const [label, setLabel] = useState('');
  const [type, setType] = useState<CustomFieldType>('text');
  const [optionsText, setOptionsText] = useState('');
  const [required, setRequired] = useState(false);
  const [editableByClient, setEditableByClient] = useState(false);
  const [alwaysShowInClientCard, setAlwaysShowInClientCard] = useState(false);
  const [alwaysShowInBookingWindow, setAlwaysShowInBookingWindow] = useState(false);
  const [adding, setAdding] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CustomFieldDef | null>(null);
  const [deleteWord, setDeleteWord] = useState('');
  const [deleting, setDeleting] = useState(false);
  const deleteConfirmWord = 'Delete';

  if (!canView) return null;

  const closeDeleteModal = () => {
    setDeleteTarget(null);
    setDeleteWord('');
  };

  const confirmDelete = async () => {
    if (!deleteTarget || !onDeleteDef || deleteWord !== deleteConfirmWord) return;
    try {
      setDeleting(true);
      await onDeleteDef(deleteTarget.id);
      toast.success(t('addClientForm.form.customFieldDeleted'));
      closeDeleteModal();
    } catch {
      toast.error(t('addClientForm.form.customFieldDeleteFailed'));
    } finally {
      setDeleting(false);
    }
  };

  const listOptions = optionsText
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  const canSubmit = label.trim().length > 0 && (type !== 'list' || listOptions.length >= 2);

  const add = () => {
    if (!canSubmit) return;
    onAddDef({
      label: label.trim(),
      type,
      options: type === 'list' ? listOptions : undefined,
      required,
      editableByClient,
      alwaysShowInClientCard,
      alwaysShowInBookingWindow,
    });
    setLabel('');
    setType('text');
    setOptionsText('');
    setRequired(false);
    setEditableByClient(false);
    setAlwaysShowInClientCard(false);
    setAlwaysShowInBookingWindow(false);
    setAdding(false);
  };

  const typeLabel: Record<CustomFieldType, string> = {
    text: t('addClientForm.form.customFieldType.text'),
    number: t('addClientForm.form.customFieldType.number'),
    list: t('addClientForm.form.customFieldType.list'),
    date: t('addClientForm.form.customFieldType.date'),
  };

  const setValue = (id: string, value: string) => onChange({ customFieldValues: { ...draft.customFieldValues, [id]: value } });

  return (
    <div data-f="F-04-060 F-04-198 F-04-139 F-04-140 F-04-141 F-04-142 F-04-144 F-04-145" className="flex flex-col gap-4">
      {defs.length === 0 && !adding && <p className="text-sm text-muted">{t('addClientForm.form.customFieldsEmpty')}</p>}
      {defs.map((def) => {
        const value = draft.customFieldValues[def.id] ?? '';
        const missing = def.required && !value.trim();
        const label = def.required ? `${def.label} *` : def.label;
        return (
          <div key={def.id} className="flex items-end gap-2">
            <FormField className="flex-1" label={label} error={missing ? t('addClientForm.form.customFieldRequired') : undefined}>
              {def.type === 'list' ? (
                <Select
                  value={value}
                  onValueChange={(v) => setValue(def.id, v)}
                  disabled={!canEdit}
                  placeholder={t('addClientForm.form.customFieldSelectPlaceholder')}
                  options={(def.options ?? []).map((o) => ({ value: o, label: o }))}
                />
              ) : def.type === 'date' ? (
                <DatePicker value={value ? (value as never) : null} onValueChange={(d) => setValue(def.id, d ?? '')} disabled={!canEdit} />
              ) : (
                <Input
                  type={def.type === 'number' ? 'number' : 'text'}
                  value={value}
                  onChange={(e) => setValue(def.id, e.target.value)}
                  disabled={!canEdit}
                />
              )}
            </FormField>
            {canEdit && onDeleteDef && (
              <IconButton
                icon={<Trash2 aria-hidden className="size-4" />}
                variant="ghost"
                size="sm"
                className="mb-0.5 text-muted hover:text-danger"
                label={t('addClientForm.form.customFieldDelete')}
                onClick={() => setDeleteTarget(def)}
              />
            )}
          </div>
        );
      })}
      {canEdit &&
        (adding ? (
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface-2 p-3">
            <div className="flex flex-col gap-2 @lg:flex-row @lg:items-center">
              <Input
                autoFocus
                className="flex-1"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={t('addClientForm.form.customFieldPlaceholder')}
                aria-label={t('addClientForm.form.customFieldNew')}
              />
              <Select
                className="@lg:w-40"
                value={type}
                onValueChange={(v) => setType(v as CustomFieldType)}
                options={CUSTOM_FIELD_TYPES.map((tp) => ({ value: tp, label: typeLabel[tp] }))}
                aria-label={t('addClientForm.form.customFieldType.label')}
              />
            </div>
            {type === 'list' && (
              <FormField label={t('addClientForm.form.customFieldOptions')} hint={t('addClientForm.form.customFieldOptionsHint')}>
                <Input value={optionsText} onChange={(e) => setOptionsText(e.target.value)} placeholder={t('addClientForm.form.customFieldOptionsPlaceholder')} />
              </FormField>
            )}
            <Switch checked={required} onCheckedChange={setRequired} label={t('addClientForm.form.customFieldRequiredLabel')} />
            <Switch checked={editableByClient} onCheckedChange={setEditableByClient} label={t('addClientForm.form.customFieldEditableByClient')} />
            <Switch
              checked={alwaysShowInClientCard}
              onCheckedChange={setAlwaysShowInClientCard}
              label={t('addClientForm.form.customFieldAlwaysCard')}
              description={t('addClientForm.form.customFieldAlwaysCardHint')}
            />
            <Switch
              checked={alwaysShowInBookingWindow}
              onCheckedChange={setAlwaysShowInBookingWindow}
              label={t('addClientForm.form.customFieldAlwaysBooking')}
              description={t('addClientForm.form.customFieldAlwaysBookingHint')}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setAdding(false)}>
                {t('addClientForm.cancel')}
              </Button>
              <Button onClick={add} disabled={!canSubmit}>
                {t('addClientForm.form.customFieldAdd')}
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" size="sm" leftIcon={<Plus aria-hidden />} className="self-start" onClick={() => setAdding(true)}>
            {t('addClientForm.form.customFieldNew')}
          </Button>
        ))}
      {onDeleteDef && (
        <Modal
          open={Boolean(deleteTarget)}
          onOpenChange={(next) => !next && !deleting && closeDeleteModal()}
          title={t('addClientForm.form.customFieldDeleteTitle', { name: deleteTarget?.label ?? '' })}
          description={t('addClientForm.form.customFieldDeleteDescription')}
          size="sm"
          footer={
            <>
              <Button variant="ghost" onClick={closeDeleteModal} disabled={deleting}>
                {t('addClientForm.cancel')}
              </Button>
              <Button variant="danger" onClick={confirmDelete} disabled={deleteWord !== deleteConfirmWord} loading={deleting}>
                {t('addClientForm.form.customFieldDelete')}
              </Button>
            </>
          }
        >
          <FormField label={t('addClientForm.form.customFieldDeleteTypeWord', { word: deleteConfirmWord })}>
            <Input
              autoFocus
              value={deleteWord}
              onChange={(e) => setDeleteWord(e.target.value)}
              placeholder={deleteConfirmWord}
            />
          </FormField>
        </Modal>
      )}
    </div>
  );
}
