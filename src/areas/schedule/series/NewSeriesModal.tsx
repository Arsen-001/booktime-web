'use client';

/**
 * «Новая повторяющаяся серия» (F-00-064, ux-r5 R-2): день недели — одним выбором в ряду кружков, дата первого визита
 * сама подстраивается под этот день; над кнопкой — итог словами «Каждый пн в 10:00, с 28 сент · 6 записей» и
 * предупреждение, если мастер в какие-то из дат не работает. Клиент — один поиск с «+ Новый клиент» (Q-1).
 */
import { useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import { useLocale } from 'next-intl';
import type { Id, ISODate, TimeHM } from '@/domain/core';
import type { SeriesRuleKind } from '@/domain/schedule';
import { useCoreList } from '@/api/core';
import { useApiMutation, useApiQuery } from '@/api/request';
import { createSeries, previewSeries } from '@/api/schedule';
import { NumberStepper } from '@/areas/schedule/components/NumberStepper';
import { useCan } from '@/demo/hooks';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { today, weekdayIndex } from '@/lib/date';
import { pickText } from '@/lib/text';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { Combobox, type ComboboxOption } from '@/ui/Combobox';
import { DatePicker } from '@/ui/DatePicker';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { Modal } from '@/ui/Modal';
import { PhoneInput } from '@/ui/PhoneInput';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { Select } from '@/ui/Select';
import { TimePicker } from '@/ui/TimePicker';
import { useToast } from '@/ui/Toast';
import { WeekdayPicker } from '@/ui/WeekdayPicker';

export interface NewSeriesModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  businessId: Id;
  locationId: Id;
  /** Мастер создаёт серию себе — выбора сотрудника нет */
  fixedStaffId?: Id;
  actorStaffId?: Id;
  actorName: string;
}

export function NewSeriesModal({ open, onOpenChange, businessId, locationId, fixedStaffId, actorStaffId, actorName }: NewSeriesModalProps) {
  const t = useT('schedule');
  const locale = useLocale();
  const format = useFormat();
  const toast = useToast();
  const canSeePhones = useCan('clients.phones');

  const [staffId, setStaffId] = useState<Id | ''>(fixedStaffId ?? '');
  const [clientId, setClientId] = useState<Id | null>(null);
  const [newClientName, setNewClientName] = useState<string | null>(null);
  const [newClientPhone, setNewClientPhone] = useState('');
  const [serviceId, setServiceId] = useState<Id | ''>('');
  const [kind, setKind] = useState<SeriesRuleKind>('weekly');
  const [intervalDays, setIntervalDays] = useState(7);
  const [startDate, setStartDate] = useState<ISODate>(today());
  const [weekday, setWeekday] = useState<number>(weekdayIndex(today()));
  const [time, setTime] = useState<TimeHM>('10:00');
  const [tried, setTried] = useState(false);

  const staffQuery = useCoreList('staff', { businessId }, { enabled: open && !fixedStaffId });
  const clientsQuery = useCoreList('clients', { businessId }, { enabled: open });
  const servicesQuery = useCoreList('services', { businessId }, { enabled: open });
  const create = useApiMutation(createSeries);

  const effectiveStaffId = fixedStaffId ?? staffId;
  const service = (servicesQuery.data ?? []).find((s) => s.id === serviceId);
  const durationMin = service ? (service.durationMax ?? service.durationMin) : 30;
  const previewQuery = useApiQuery(
    ['schedule', 'series-preview', effectiveStaffId, locationId, kind, intervalDays, weekday, time, startDate, durationMin],
    () =>
      previewSeries({
        staffId: effectiveStaffId,
        locationId,
        kind,
        intervalDays: kind === 'every_n_days' ? intervalDays : undefined,
        weekday: kind === 'weekly' ? weekday : undefined,
        time,
        startDate,
        durationMin,
      }),
    { enabled: open && Boolean(effectiveStaffId) },
  );
  const preview = previewQuery.data;

  const clientOptions: ComboboxOption[] = (clientsQuery.data ?? [])
    .filter((c) => !c.deletedAt)
    .map((c) => ({ value: c.id, label: c.name, description: canSeePhones ? format.phone(c.phone) : format.maskedPhone(c.phone) }));
  const isNew = newClientName !== null;
  const errors = tried
    ? {
        staff: !effectiveStaffId ? t('series.errorStaff') : undefined,
        client: !clientId && !newClientName?.trim() ? t('quickBooking.errorClient') : undefined,
        phone: isNew && newClientPhone.replace(/\D/g, '').length < 11 ? t('quickBooking.errorPhone') : undefined,
        service: !serviceId ? t('quickBooking.errorService') : undefined,
      }
    : {};

  const reset = () => {
    setClientId(null);
    setNewClientName(null);
    setNewClientPhone('');
    setServiceId('');
    setKind('weekly');
    setIntervalDays(7);
    setStartDate(today());
    setWeekday(weekdayIndex(today()));
    setTime('10:00');
    setTried(false);
  };

  const save = async () => {
    setTried(true);
    if (
      !effectiveStaffId ||
      !serviceId ||
      (!clientId && !newClientName?.trim()) ||
      (isNew && newClientPhone.replace(/\D/g, '').length < 11)
    )
      return;
    try {
      const result = await create.mutate({
        businessId,
        locationId,
        staffId: effectiveStaffId,
        serviceId,
        durationMin,
        clientId: clientId ?? undefined,
        clientName: clientId ? (clientsQuery.data ?? []).find((c) => c.id === clientId)?.name : newClientName?.trim(),
        clientPhone: clientId ? undefined : newClientPhone,
        kind,
        intervalDays: kind === 'every_n_days' ? intervalDays : undefined,
        weekday: kind === 'weekly' ? (weekday as 0 | 1 | 2 | 3 | 4 | 5 | 6) : undefined,
        time,
        startDate,
        createdByName: actorName,
        createdBy: actorStaffId ?? 'client',
      });
      toast.success(t('series.created', { n: result.occurrences.length }));
      if (result.movedCount > 0) toast.info(t('series.someMoved', { n: result.movedCount }));
      reset();
      onOpenChange(false);
    } catch {
      toast.error(t('quickBooking.failed'));
    }
  };

  const summary =
    preview &&
    (kind === 'weekly'
      ? t('series.summaryWeekly', {
          day: format.weekdaysShort()[weekday],
          time,
          from: format.date(preview.firstDate, 'dayMonth'),
          n: preview.count,
        })
      : t('series.summaryInterval', { every: intervalDays, time, from: format.date(preview.firstDate, 'dayMonth'), n: preview.count }));

  return (
    <Modal
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
      title={t('series.newTitle')}
      description={t('series.newSubtitle')}
      footer={
        <div className="flex flex-col gap-3">
          {summary && (
            <div className="flex flex-wrap items-center gap-2 text-sm text-fg" aria-live="polite">
              <span>{summary}</span>
              {preview && preview.offDays > 0 && (
                <Badge tone="warning" icon={<TriangleAlert aria-hidden />}>
                  {t('series.offDays', { n: preview.offDays })}
                </Badge>
              )}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={create.isPending}>
              {t('panel.cancel')}
            </Button>
            <Button onClick={save} loading={create.isPending}>
              {t('series.create')}
            </Button>
          </div>
        </div>
      }
    >
      <form
        noValidate
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        {!fixedStaffId && (
          <FormField label={t('series.staff')} error={errors.staff}>
            <Select
              value={staffId}
              onValueChange={(v) => setStaffId(v as Id)}
              options={(staffQuery.data ?? []).filter((s) => s.status === 'active').map((s) => ({ value: s.id, label: s.name }))}
              placeholder={t('series.staffPlaceholder')}
            />
          </FormField>
        )}

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
        {isNew && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label={t('quickBooking.newName')}>
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

        <FormField label={t('quickBooking.service')} error={errors.service}>
          <Select
            value={serviceId}
            onValueChange={setServiceId}
            options={(servicesQuery.data ?? []).filter((s) => s.active).map((s) => ({ value: s.id, label: pickText(s.name, locale) }))}
            placeholder={t('quickBooking.servicePlaceholder')}
            searchable
          />
        </FormField>

        <FormField label={t('series.rule')}>
          <SegmentedControl
            fullWidth
            value={kind}
            onValueChange={(v) => setKind(v as SeriesRuleKind)}
            options={[
              { value: 'weekly', label: t('series.kindWeekly') },
              { value: 'every_n_days', label: t('series.kindInterval') },
            ]}
          />
        </FormField>

        {kind === 'weekly' ? (
          <FormField label={t('series.weekday')}>
            <WeekdayPicker
              presets={false}
              value={[weekday]}
              onValueChange={(next) => {
                const added = next.find((d) => d !== weekday);
                if (added !== undefined) setWeekday(added);
              }}
            />
          </FormField>
        ) : (
          <FormField label={t('series.intervalDays')}>
            <NumberStepper
              value={intervalDays}
              onValueChange={setIntervalDays}
              min={1}
              max={60}
              unitLabel={t('series.everyDays', { n: intervalDays })}
            />
          </FormField>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label={kind === 'weekly' ? t('series.startFrom') : t('series.startDate')}>
            <DatePicker
              value={startDate}
              onValueChange={(v) => {
                if (!v) return;
                setStartDate(v);
                if (kind === 'weekly') setWeekday(weekdayIndex(v));
              }}
              min={today()}
            />
          </FormField>
          <FormField label={t('quickBooking.time')}>
            <TimePicker value={time} onValueChange={setTime} step={15} />
          </FormField>
        </div>
      </form>
    </Modal>
  );
}
