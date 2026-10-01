'use client';

/** Создание (F-07-020) и правка/удаление контрагента (F-07-021). */
import { CounterpartyHistory } from '@/areas/finance/counterparties/CounterpartyHistory';
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { createCounterparty, removeCounterparty, updateCounterparty } from '@/api/finance';
import { useApiMutation } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import type { Counterparty, CounterpartyType } from '@/domain/finance';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { PhoneInput } from '@/ui/PhoneInput';
import { Select } from '@/ui/Select';
import { Sheet } from '@/ui/Sheet';
import { Textarea } from '@/ui/Textarea';
import { useConfirm, useToast } from '@/ui/Toast';

export interface CounterpartyFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Counterparty;
}

export function CounterpartyFormSheet({ open, onOpenChange, initial }: CounterpartyFormSheetProps) {
  const t = useT('finance');
  const tc = useT('common');
  const toast = useToast();
  const confirm = useConfirm();
  const { businessId } = useCurrent();
  const isEdit = Boolean(initial);

  const [type, setType] = useState<CounterpartyType>(initial?.type ?? 'supplier');
  const [name, setName] = useState(initial?.name ?? '');
  const [inn, setInn] = useState(initial?.inn ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [contact, setContact] = useState(initial?.contact ?? '');
  const [note, setNote] = useState(initial?.note ?? '');
  // Владелец 01.10.2026: язык сообщений поставщику ('' — язык кабинета)
  const [messageLang, setMessageLang] = useState<'' | 'hy' | 'ru' | 'en'>(initial?.messageLang ?? '');
  const [touched, setTouched] = useState(false);

  const createMutation = useApiMutation(
    (input: { type: CounterpartyType; name: string; inn?: string; phone?: string; email?: string; contact?: string; note?: string; messageLang?: 'hy' | 'ru' | 'en' | null }) =>
      createCounterparty(businessId!, input),
  );
  // Без initial!.id — React Compiler выносит поле в рендер и падает, пока initial === undefined (§18.5)
  const updateMutation = useApiMutation(
    (input: { type: CounterpartyType; name: string; inn?: string; phone?: string; email?: string; contact?: string; note?: string; messageLang?: 'hy' | 'ru' | 'en' | null }) =>
      updateCounterparty(businessId!, initial?.id ?? '', input),
  );
  const removeMutation = useApiMutation(() => removeCounterparty(businessId!, initial?.id ?? ''));
  const isSaving = createMutation.isPending || updateMutation.isPending;

  const nameError = touched && !name.trim() ? t('counterpartyForm.nameRequired') : undefined;
  const innError = touched && inn.trim() && !/^\d{8}$/.test(inn.trim()) ? t('counterpartyForm.innInvalid') : undefined;

  const save = async () => {
    setTouched(true);
    if (!name.trim() || (inn.trim() && !/^\d{8}$/.test(inn.trim()))) return;
    // Правка: стёртое поле уходит пустым, «Как в кабинете» — null. undefined в JSON пропадает, и сервер (режим api)
    // оставлял старый телефон / язык сообщений (final-api.md)
    const cleared = isEdit ? '' : undefined;
    const input = {
      type,
      name: name.trim(),
      inn: inn.trim() || cleared,
      phone: phone.trim() || cleared,
      email: email.trim() || cleared,
      contact: contact.trim() || cleared,
      note: note.trim() || cleared,
      messageLang: messageLang || (isEdit ? null : undefined),
    };
    try {
      if (isEdit) {
        await updateMutation.mutate(input);
        toast.success(t('counterpartyForm.saved'));
      } else {
        await createMutation.mutate(input);
        toast.success(t('counterpartyForm.created'));
        setName('');
        setInn('');
        setPhone('');
        setEmail('');
        setContact('');
        setNote('');
        setMessageLang('');
        setTouched(false);
      }
      onOpenChange(false);
    } catch {
      toast.error(t('counterpartyForm.saveFailed'));
    }
  };

  const remove = async () => {
    const ok = await confirm({
      title: t('counterpartyForm.deleteTitle'),
      description: t('counterpartyForm.deleteText'),
      tone: 'danger',
      confirmLabel: tc('actions.delete'),
    });
    if (!ok) return;
    try {
      await removeMutation.mutate(undefined);
      toast.success(t('counterpartyForm.deleted'));
      onOpenChange(false);
    } catch {
      toast.error(t('counterpartyForm.deleteFailed'));
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? t('counterpartyForm.editTitle') : t('counterpartyForm.title')}
      headerActions={
        isEdit ? (
          <Button
            variant="ghost"
            leftIcon={<Trash2 aria-hidden />}
            onClick={remove}
            loading={removeMutation.isPending}
            className="text-danger hover:bg-danger-soft"
          >
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
      <div data-f="F-07-020 F-07-021 F-08-120" className="flex flex-col gap-5">
        <FormField label={t('counterpartyForm.type')}>
          <Select
            options={[
              { value: 'supplier', label: t('counterparties.type.supplier') },
              { value: 'company', label: t('counterparties.type.company') },
              { value: 'person', label: t('counterparties.type.person') },
              { value: 'other', label: t('counterparties.type.other') },
            ]}
            value={type}
            onValueChange={(v) => setType(v as CounterpartyType)}
          />
        </FormField>

        <FormField label={t('counterpartyForm.name')} required error={nameError}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('counterpartyForm.namePlaceholder')} />
        </FormField>

        {/* Ф27: в Армении налоговый номер — ՀՎՀՀ, 8 цифр */}
        <FormField label={t('counterpartyForm.inn')} hint={t('counterpartyForm.innHint')} error={innError}>
          <Input value={inn} onChange={(e) => setInn(e.target.value.replace(/[^\d]/g, '').slice(0, 8))} inputMode="numeric" />
        </FormField>

        <FormField label={t('counterpartyForm.phone')}>
          <PhoneInput value={phone} onValueChange={setPhone} />
        </FormField>

        <FormField label={t('counterpartyForm.email')}>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </FormField>

        <FormField label={t('counterpartyForm.contact')}>
          <Input value={contact} onChange={(e) => setContact(e.target.value)} placeholder={t('counterpartyForm.contactPlaceholder')} />
        </FormField>

        <FormField label={t('counterpartyForm.messageLang')} hint={t('counterpartyForm.messageLangHint')}>
          <Select
            options={[
              { value: '', label: t('counterpartyForm.messageLangDefault') },
              { value: 'hy', label: 'Հայերեն' },
              { value: 'ru', label: 'Русский' },
              { value: 'en', label: 'English' },
            ]}
            value={messageLang}
            onValueChange={(v) => setMessageLang(v as '' | 'hy' | 'ru' | 'en')}
          />
        </FormField>

        <FormField label={t('counterpartyForm.note')}>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
        </FormField>

        {initial && businessId && <CounterpartyHistory businessId={businessId} counterpartyId={initial.id} />}
      </div>
    </Sheet>
  );
}
