'use client';

import { useState } from 'react';
import type { Id, LocaleCode } from '@/domain/core';
import type { LinkBookingType, LinkKind } from '@/domain/online';
import { createLink, listPublicGroupEvents } from '@/api/online';
import { useApiMutation, useApiQuery } from '@/api/request';
import { CLIENT_LOCALES, type Locale } from '@/i18n/config';
import { addDays, today } from '@/lib/date';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { Checkbox } from '@/ui/Checkbox';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { RadioGroup } from '@/ui/Radio';
import { Select } from '@/ui/Select';
import { Sheet } from '@/ui/Sheet';
import { Textarea } from '@/ui/Textarea';
import { useToast } from '@/ui/Toast';

export interface StaffOption {
  id: Id;
  name: string;
}

export interface NewLinkSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId: Id;
  locationId: Id | undefined;
  staffOptions: StaffOption[];
  onCreated: () => void;
}

/** «Новая ссылка»: выбор типа + параметры (F-03-005, F-03-006) */
export function NewLinkSheet({ open, onOpenChange, businessId, locationId, staffOptions, onCreated }: NewLinkSheetProps) {
  const t = useT('online');
  const toast = useToast();
  const [kind, setKind] = useState<LinkKind>('normal');
  const [staffId, setStaffId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  // О10: пока у бизнеса нет групповых занятий в ближайшие 30 дней, новая ссылка — «Индивидуальные»: иначе каждый
  // клиент сначала отвечает «индивидуальная или групповая», хотя групповых нет. Выбор владельца (touched) не перебиваем.
  const groupQ = useApiQuery(['online-group-events', businessId], () => listPublicGroupEvents(businessId), { enabled: open });
  const horizon = addDays(today(), 30);
  const hasGroup = (groupQ.data ?? []).some((e) => e.event.start.slice(0, 10) <= horizon);
  const [pickedType, setPickedType] = useState<LinkBookingType | undefined>();
  const bookingType: LinkBookingType = pickedType ?? (hasGroup ? 'mixed' : 'individual');
  const setBookingType = (v: LinkBookingType) => setPickedType(v);
  // О3: язык ссылки по умолчанию — армянский (главное отличие от DIKIDI и Fresha в Ереване)
  const [defaultLocale, setDefaultLocale] = useState<LocaleCode>('hy');
  const [primary, setPrimary] = useState(false);
  const [error, setError] = useState('');
  const mutation = useApiMutation(createLink);

  const reset = () => {
    setKind('normal');
    setStaffId('');
    setName('');
    setDescription('');
    setPickedType(undefined);
    setDefaultLocale('hy');
    setPrimary(false);
    setError('');
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError(t('links.form.nameRequired'));
      return;
    }
    try {
      await mutation.mutate({
        businessId,
        locationId,
        name: name.trim(),
        description: description.trim() || undefined,
        kind,
        bookingType,
        defaultLocale,
        staffId: staffId || undefined,
        primary,
      });
      toast.success(t('links.form.created'));
      onOpenChange(false);
      reset();
      onCreated();
    } catch {
      toast.error(t('links.form.createFailed'));
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
      title={t('links.new.title')}
      description={t('links.new.description')}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('links.form.cancel')}
          </Button>
          <Button onClick={handleSubmit} loading={mutation.isPending}>
            {t('links.form.create')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4" data-f="F-03-005">
        <FormField label={t('links.new.typeLabel')}>
          <RadioGroup
            value={kind}
            onValueChange={(v) => setKind(v as LinkKind)}
            options={[
              { value: 'normal', label: t('links.new.typeCommon'), description: t('links.new.typeCommonHint') },
              { value: 'network', label: t('links.new.typeNetwork'), description: t('links.new.typeNetworkHint') },
            ]}
          />
        </FormField>

        <div className="flex flex-col gap-4" data-f="F-03-006">
        <div data-f="F-10-146">
        <FormField label={t('links.form.staff')} hint={t('links.form.staffHint')}>
          <Select
            value={staffId}
            onValueChange={setStaffId}
            placeholder={t('links.form.staffAny')}
            options={staffOptions.map((s) => ({ value: s.id, label: s.name }))}
          />
        </FormField>
        </div>

        <FormField label={t('links.form.name')} required error={error || undefined}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('links.form.namePlaceholder')} maxLength={60} />
        </FormField>

        <FormField label={t('links.form.description')} optional>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={200} />
        </FormField>

        <FormField label={t('links.form.bookingType')}>
          <Select
            value={bookingType}
            onValueChange={(v) => setBookingType(v as LinkBookingType)}
            options={[
              { value: 'individual', label: t('links.form.bookingTypeIndividual') },
              { value: 'group', label: t('links.form.bookingTypeGroup') },
              { value: 'mixed', label: t('links.form.bookingTypeMixed') },
            ]}
          />
        </FormField>

        <div data-f="F-15-139">
          <FormField label={t('links.form.defaultLocale')} hint={t('links.form.defaultLocaleHint')}>
            <Select
              value={defaultLocale}
              onValueChange={(v) => setDefaultLocale(v as LocaleCode)}
              options={CLIENT_LOCALES.map((l: Locale) => ({ value: l, label: t(`links.form.localeName.${l}` as 'links.form.localeName.hy') }))}
            />
          </FormField>
        </div>
        </div>

        <Checkbox checked={primary} onCheckedChange={setPrimary} label={t('links.form.makePrimary')} data-f="F-03-007" />
      </div>
    </Sheet>
  );
}
