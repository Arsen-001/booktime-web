'use client';

import { useState } from 'react';
import { findClientByPhone } from '@/api/core';
import { addToWaitlist, draftsToWishes, updateWaitlistEntry, wishesToDrafts, type WaitlistEntry, type WaitlistEntryInput, type WaitlistWishDraft } from '@/api/resources';
import { useApiMutation } from '@/api/request';
import type { Id } from '@/domain/core';
import { normalizePhone } from '@/lib/phone';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { PhoneInput } from '@/ui/PhoneInput';
import { Sheet } from '@/ui/Sheet';
import { Textarea } from '@/ui/Textarea';
import { useToast } from '@/ui/Toast';
import { EntityMultiPicker } from '@/areas/resources/components/EntityMultiPicker';
import { WaitlistWishesEditor } from '@/areas/resources/waitlist/WaitlistWishesEditor';

export interface WaitlistFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Нет — новая заявка */
  entry: WaitlistEntry | null;
  businessId: Id | undefined;
  locationId: Id | undefined;
  serviceOptions: { id: Id; label: string }[];
  /** Мастера журнала; staffIds — какие услуги делает (форма предлагает только тех, кто делает выбранные) */
  staffOptions: { id: Id; label: string; serviceIds: Id[] }[];
  /** sheet — своей шторкой (экран листа); inline — вместо списка (панель журнала уже шторка) */
  layout: 'sheet' | 'inline';
  onSaved?: (entry: WaitlistEntry) => void;
}

/** Форма заявки — одна для экрана и панели журнала: создание и изменение (F-16-150…154, F-16-164, F-01-157, F-01-161) */
export function WaitlistForm({ open, onOpenChange, entry, businessId, locationId, serviceOptions, staffOptions, layout, onSaved }: WaitlistFormProps) {
  const t = useT('resources');
  const toast = useToast();
  const [name, setName] = useState(entry?.clientName ?? '');
  const [phone, setPhone] = useState(entry?.clientPhone ?? '');
  const [serviceIds, setServiceIds] = useState<Id[]>(entry?.serviceIds ?? []);
  const [staffIds, setStaffIds] = useState<Id[]>(entry?.staffIds ?? []);
  const [comment, setComment] = useState(entry?.comment ?? '');
  const [slots, setSlots] = useState<WaitlistWishDraft[]>(wishesToDrafts(entry?.wishes ?? []));
  const [error, setError] = useState<string | undefined>(undefined);
  const [matchedClientName, setMatchedClientName] = useState<string | undefined>(undefined);
  const [key, setKey] = useState(entry?.id ?? 'new');

  // Другая заявка (или создание) — форма с чистого листа
  if (key !== (entry?.id ?? 'new')) {
    setKey(entry?.id ?? 'new');
    setName(entry?.clientName ?? '');
    setPhone(entry?.clientPhone ?? '');
    setServiceIds(entry?.serviceIds ?? []);
    setStaffIds(entry?.staffIds ?? []);
    setComment(entry?.comment ?? '');
    setSlots(wishesToDrafts(entry?.wishes ?? []));
    setError(undefined);
    setMatchedClientName(undefined);
  }

  const create = useApiMutation((input: WaitlistEntryInput) => addToWaitlist(input));
  // Не `entry!.id`: React Compiler по «!» считает entry не-null и читает его поля без «?.»
  const entryId = entry?.id;
  const update = useApiMutation((patch: Partial<WaitlistEntryInput>) => {
    if (!entryId) throw new Error('waitlist entry is not selected');
    return updateWaitlistEntry(entryId, patch);
  });

  // Мастера — те, кто делает выбранные услуги (уже выбранных не прячем — их можно снять)
  const pickableStaff = staffOptions.filter((s) => staffIds.includes(s.id) || serviceIds.length === 0 || s.serviceIds.some((id) => serviceIds.includes(id)));

  // F-16-150: номер подсказывает существующего клиента, нажатие подставляет имя
  async function handlePhoneChange(v: string) {
    setPhone(v);
    setMatchedClientName(undefined);
    const normalized = normalizePhone(v);
    if (!normalized || !businessId) return;
    const client = await findClientByPhone(businessId, normalized).catch(() => undefined);
    if (client && client.name !== name) setMatchedClientName(client.name);
  }

  const submit = async () => {
    if (!name.trim() || !normalizePhone(phone) || serviceIds.length === 0) {
      setError(t('waitlist.form.required'));
      return;
    }
    // Время без дня не сохранить (желание — это день): раньше такое время молча превращалось в «любое время»
    if (slots.some((s) => !s.date && !s.anyTime)) {
      setError(t('waitlist.form.dateRequired'));
      return;
    }
    const input: WaitlistEntryInput = {
      businessId: businessId ?? '',
      locationId: locationId ?? '',
      clientName: name.trim(),
      clientPhone: normalizePhone(phone) ?? phone,
      serviceIds,
      staffIds,
      wishes: draftsToWishes(slots),
      comment: comment.trim() || undefined,
    };
    try {
      const saved = entry ? await update.mutate(input) : await create.mutate(input);
      toast.success(entry ? t('waitlist.form.updated') : t('waitlist.form.created'));
      setError(undefined);
      onOpenChange(false);
      onSaved?.(saved);
    } catch {
      toast.error(t('form.saveFailed'));
    }
  };

  const saving = create.isPending || update.isPending;
  const title = entry ? t('waitlist.form.editTitle') : t('waitlist.form.createTitle');
  const actions = (
    <>
      <Button variant="outline" onClick={() => onOpenChange(false)}>
        {t('form.cancel')}
      </Button>
      <Button loading={saving} onClick={submit}>
        {entry ? t('form.save') : t('waitlist.add')}
      </Button>
    </>
  );

  const fields = (
    <div data-f="F-16-154 F-01-157" className="flex flex-col gap-4">
      <div data-f="F-16-150" className="flex flex-col gap-4">
        <FormField label={t('event.clients.name')} error={error && !name.trim() ? error : undefined} required>
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={t('event.clients.namePlaceholder')} />
        </FormField>
        <FormField label={t('event.clients.phoneLabel')} error={error && !normalizePhone(phone) ? error : undefined} required>
          <PhoneInput value={phone} onValueChange={(v) => void handlePhoneChange(v)} />
        </FormField>
        {matchedClientName && (
          <button type="button" className="-mt-2 min-h-8 self-start text-left text-xs text-primary-text underline" onClick={() => setName(matchedClientName)}>
            {t('waitlist.form.existingClient', { name: matchedClientName })}
          </button>
        )}
      </div>
      <div data-f="F-16-151">
        <FormField label={t('form.services')} error={error && serviceIds.length === 0 ? error : undefined} required>
          <EntityMultiPicker
            options={serviceOptions}
            value={serviceIds}
            onValueChange={setServiceIds}
            title={t('form.services')}
            placeholder={t('form.servicesPlaceholder')}
            searchPlaceholder={t('form.servicesSearch')}
            emptyText={t('form.servicesEmpty')}
          />
        </FormField>
      </div>
      <div data-f="F-16-152">
        <FormField label={t('waitlist.form.staff')} optional>
          <div className="flex flex-wrap gap-1.5">
            <Chip selected={staffIds.length === 0} onClick={() => setStaffIds([])}>
              {t('waitlist.form.staffAny')}
            </Chip>
            {pickableStaff.map((s) => (
              <Chip key={s.id} selected={staffIds.includes(s.id)} onClick={() => setStaffIds((prev) => (prev.includes(s.id) ? prev.filter((x) => x !== s.id) : [...prev, s.id]))}>
                {s.label}
              </Chip>
            ))}
          </div>
        </FormField>
      </div>
      <WaitlistWishesEditor value={slots} onChange={setSlots} showErrors={Boolean(error)} />
      <FormField label={t('event.clients.commentLabel')} optional>
        <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} />
      </FormField>
    </div>
  );

  if (layout === 'inline') {
    if (!open) return null;
    return (
      <div className="flex flex-col gap-4">
        <p className="text-base font-semibold text-fg">{title}</p>
        {fields}
        <div className="flex items-center justify-end gap-2 border-t border-border pt-3">{actions}</div>
      </div>
    );
  }
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={title} side="right" size="sm" footer={actions}>
      {fields}
    </Sheet>
  );
}
