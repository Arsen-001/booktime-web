'use client';

/**
 * Быстрая запись мастером (F-00-060), тот же диалог открывает «+» на телефоне (F-00-062) и разбор фразы (F-00-063 —
 * поле «Записать фразой» сверху, а не отдельная карточка «(демо)» на экране). Один способ указать клиента: поиск с
 * недавними чипами, «+ Новый клиент» раскрывает имя и телефон (Q-1). Время — свободные окна кнопками, а не голый
 * TimePicker. «Записать» активна всегда: чего не хватает — ошибка у поля.
 */
import { useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useLocale } from 'next-intl';
import type { Id, ISODate, TimeHM } from '@/domain/core';
import { useCoreList } from '@/api/core';
import { ApiError, useApiMutation, useApiQuery } from '@/api/request';
import { createQuickBooking, getQuickBookingContext, getQuickBookingSlots } from '@/api/schedule';
import { matchServices, parseVoicePhrase } from '@/areas/schedule/lib/voice';
import { useCan, useCurrent } from '@/demo/hooks';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { addDays, combine, today, timePart, weekdayIndex } from '@/lib/date';
import { pickText } from '@/lib/text';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { Combobox, type ComboboxOption } from '@/ui/Combobox';
import { DatePicker } from '@/ui/DatePicker';
import { EmptyState } from '@/ui/EmptyState';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { Modal } from '@/ui/Modal';
import { PhoneInput } from '@/ui/PhoneInput';
import { ScrollRow } from '@/ui/ScrollRow';
import { Select } from '@/ui/Select';
import { SlotButton } from '@/ui/SlotButton';
import { SlotRow } from '@/ui/SlotRow';
import { TimePicker } from '@/ui/TimePicker';
import { useToast } from '@/ui/Toast';

export interface QuickBookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId: Id;
  locationId: Id;
  staffId: Id;
  date: ISODate;
}

function nextDateForWeekday(weekday: number, from: ISODate): ISODate {
  for (let i = 0; i < 7; i++) if (weekdayIndex(addDays(from, i)) === weekday) return addDays(from, i);
  return from;
}

export function QuickBookingModal({ open, onOpenChange, businessId, locationId, staffId, date: initialDate }: QuickBookingModalProps) {
  const t = useT('schedule');
  const tc = useT('common');
  const locale = useLocale();
  const format = useFormat();
  const toast = useToast();
  const canSeePhones = useCan('clients.phones');
  const { staffId: actorStaffId } = useCurrent();

  const [phrase, setPhrase] = useState('');
  const [clientId, setClientId] = useState<Id | null>(null);
  const [newClientName, setNewClientName] = useState<string | null>(null);
  const [newClientPhone, setNewClientPhone] = useState('');
  const [serviceId, setServiceId] = useState<Id | ''>('');
  const [date, setDate] = useState<ISODate>(initialDate);
  const [time, setTime] = useState<TimeHM | null>(null);
  const [customTime, setCustomTime] = useState(false);
  const [tried, setTried] = useState(false);

  const clientsQuery = useCoreList('clients', { businessId }, { enabled: open });
  const servicesQuery = useCoreList('services', { businessId }, { enabled: open });
  const contextQuery = useApiQuery(['schedule', 'quick-context', businessId, staffId], () => getQuickBookingContext(businessId, staffId), {
    enabled: open,
  });
  const create = useApiMutation(createQuickBooking);

  const services = useMemo(
    () => (servicesQuery.data ?? []).filter((s) => s.active).map((s) => ({ value: s.id, label: pickText(s.name, locale) })),
    [servicesQuery.data, locale],
  );
  const lastServiceId = clientId ? contextQuery.data?.lastServiceByClient[clientId] : undefined;
  const effectiveServiceId = serviceId || lastServiceId || '';

  const slotsQuery = useApiQuery(
    ['schedule', 'quick-slots', staffId, date, effectiveServiceId],
    () => getQuickBookingSlots({ staffId, date, serviceId: effectiveServiceId || undefined, locationId }),
    { enabled: open },
  );

  const clientOptions: ComboboxOption[] = (clientsQuery.data ?? [])
    .filter((c) => !c.deletedAt)
    .map((c) => ({ value: c.id, label: c.name, description: canSeePhones ? format.phone(c.phone) : format.maskedPhone(c.phone) }));

  const isNew = newClientName !== null;
  const errors = tried
    ? {
        client:
          !clientId && !isNew ? t('quickBooking.errorClient') : isNew && !newClientName?.trim() ? t('quickBooking.errorName') : undefined,
        phone: isNew && newClientPhone.replace(/\D/g, '').length < 11 ? t('quickBooking.errorPhone') : undefined,
        service: !effectiveServiceId ? t('quickBooking.errorService') : undefined,
        time: !time ? t('quickBooking.errorTime') : undefined,
      }
    : {};

  const reset = () => {
    setPhrase('');
    setClientId(null);
    setNewClientName(null);
    setNewClientPhone('');
    setServiceId('');
    setDate(initialDate);
    setTime(null);
    setCustomTime(false);
    setTried(false);
  };

  const parse = () => {
    const parsed = parseVoicePhrase(phrase);
    if (parsed.weekday !== undefined) setDate(nextDateForWeekday(parsed.weekday, today()));
    if (parsed.time) {
      setTime(parsed.time as TimeHM);
      setCustomTime(true);
    }
    const matched = matchServices(
      parsed.serviceText,
      services.map((s) => ({ id: s.value, label: s.label })),
    );
    if (matched.length === 1) setServiceId(matched[0]);
    if (parsed.name) {
      const known = (clientsQuery.data ?? []).filter((c) => c.name.toLowerCase().startsWith(parsed.name!.toLowerCase()));
      if (known.length === 1) {
        setClientId(known[0].id);
        setNewClientName(null);
      } else {
        setClientId(null);
        setNewClientName(parsed.name);
      }
    }
  };

  const save = async () => {
    setTried(true);
    const missing =
      (!clientId && !newClientName?.trim()) || (isNew && newClientPhone.replace(/\D/g, '').length < 11) || !effectiveServiceId || !time;
    if (missing || !time) return;
    try {
      await create.mutate({
        businessId,
        locationId,
        staffId,
        start: combine(date, time),
        serviceId: effectiveServiceId as Id,
        durationMin: 30,
        clientId: clientId ?? undefined,
        clientName: clientId ? undefined : newClientName?.trim(),
        clientPhone: clientId ? undefined : newClientPhone,
        createdBy: actorStaffId ?? staffId,
      });
      toast.success(t('quickBooking.created', { when: `${format.relativeDay(date)}, ${time}` }));
      reset();
      onOpenChange(false);
    } catch (e) {
      const code = e instanceof ApiError ? e.code : '';
      toast.error(code && tc.has(`bookingErrors.${code}` as never) ? tc(`bookingErrors.${code}` as never) : t('quickBooking.failed'));
    }
  };

  const slots = slotsQuery.data ?? [];

  return (
    <Modal
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
      title={t('quickBooking.titleFor', { day: format.relativeDayInline(date) })}
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('panel.cancel')}
          </Button>
          <Button onClick={save} loading={create.isPending}>
            {t('quickBooking.save')}
          </Button>
        </div>
      }
    >
      <form
        noValidate
        data-f="F-00-060 F-00-062"
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div data-f="F-00-063" className="flex flex-col gap-2">
          <FormField label={t('voice.label')} hint={t('voice.hint')}>
            <div className="flex gap-2">
              <Input
                value={phrase}
                onChange={(e) => setPhrase(e.target.value)}
                placeholder={t('voice.placeholder')}
                className="min-w-0 flex-1"
              />
              <Button type="button" variant="secondary" leftIcon={<Sparkles aria-hidden />} onClick={parse} disabled={!phrase.trim()}>
                {t('voice.parse')}
              </Button>
            </div>
          </FormField>
        </div>

        <FormField label={t('quickBooking.client')} error={errors.client}>
          <Combobox
            options={clientOptions}
            value={clientId}
            onValueChange={(v) => {
              setClientId(v as Id | null);
              if (v) setNewClientName(null);
            }}
            allowCreate
            onCreate={(text) => {
              setClientId(null);
              setNewClientName(text);
            }}
            placeholder={t('quickBooking.clientSearch')}
            emptyText={t('quickBooking.clientEmpty')}
            loading={clientsQuery.isLoading}
          />
        </FormField>
        {!clientId && !isNew && (contextQuery.data?.recentClients.length ?? 0) > 0 && (
          <ScrollRow className="-mt-3" aria-label={t('quickBooking.recent')}>
            {contextQuery.data?.recentClients.map((c) => (
              <Chip key={c.id} onClick={() => setClientId(c.id)}>
                {c.name}
              </Chip>
            ))}
          </ScrollRow>
        )}

        {isNew && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label={t('quickBooking.newName')} error={errors.client}>
              <Input
                value={newClientName ?? ''}
                onChange={(e) => setNewClientName(e.target.value)}
                placeholder={t('quickBooking.newNamePlaceholder')}
              />
            </FormField>
            <FormField label={t('quickBooking.newPhone')} error={errors.phone}>
              <PhoneInput value={newClientPhone} onValueChange={setNewClientPhone} />
            </FormField>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label={t('quickBooking.service')} error={errors.service}>
            <Select
              value={effectiveServiceId}
              onValueChange={setServiceId}
              placeholder={t('quickBooking.servicePlaceholder')}
              options={services}
              searchable
            />
          </FormField>
          <FormField label={t('quickBooking.date')}>
            <DatePicker value={date} onValueChange={(d) => d && (setDate(d), setTime(null))} min={today()} />
          </FormField>
        </div>

        <FormField label={t('quickBooking.time')} error={errors.time}>
          <div className="flex flex-col gap-2">
            {customTime ? (
              <TimePicker value={time} onValueChange={setTime} step={15} />
            ) : slotsQuery.isLoading ? (
              <p className="text-sm text-muted">{t('quickBooking.slotsLoading')}</p>
            ) : slots.length === 0 ? (
              <EmptyState variant="inline" title={t('quickBooking.noSlots')} />
            ) : (
              <SlotRow>
                {slots.map((s) => (
                  <SlotButton key={s.start} selected={time === timePart(s.start)} onClick={() => setTime(timePart(s.start))}>
                    {format.time(s.start)}
                  </SlotButton>
                ))}
              </SlotRow>
            )}
            <Button type="button" variant="link" size="sm" className="self-start" onClick={() => setCustomTime((v) => !v)}>
              {customTime ? t('quickBooking.pickSlot') : t('quickBooking.otherTime')}
            </Button>
          </div>
        </FormField>
      </form>
    </Modal>
  );
}
