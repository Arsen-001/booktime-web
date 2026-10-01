'use client';

/**
 * /biz/groups/events/new — создание группового события (F-16-036, F-16-037, F-16-038, F-16-040). Раздел «resources».
 * Вход — кнопка «Новое событие» на /biz/groups, или клик по свободному времени в журнале (?staff=&start=).
 */
import { useMemo, useState } from 'react';
import { useLocale } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { Users } from 'lucide-react';
import { coreList, createGroupEvent } from '@/api/core';
import { listGroupServices, logResourcesChange, pickFreeResourceInstances } from '@/api/resources';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useCan, useCurrent } from '@/demo/hooks';
import type { Id } from '@/domain/core';
import { today } from '@/lib/date';
import { useT } from '@/i18n/useT';
import { pickText } from '@/lib/text';
import { Button } from '@/ui/Button';
import { DatePicker } from '@/ui/DatePicker';
import { FormField } from '@/ui/FormField';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';
import { Select } from '@/ui/Select';
import { Skeleton } from '@/ui/Skeleton';
import { StickyActionBar } from '@/ui/StickyActionBar';
import { TimePicker } from '@/ui/TimePicker';
import { useToast } from '@/ui/Toast';
import { EmptyState } from '@/ui/EmptyState';

export function EventCreateScreen() {
  const t = useT('resources');
  const locale = useLocale();
  const router = useRouter();
  const toast = useToast();
  const searchParams = useSearchParams();
  const { ready, businessId, locationId } = useCurrent();
  // F-16-046: право окна записи «Создавать записи» действует и на окно события
  const canCreate = useCan('journal.create');

  const staffQ = useApiQuery(['resources', 'staff-for-groups', businessId], () => coreList('staff', { businessId: businessId ?? '' }), {
    enabled: ready && Boolean(businessId),
  });
  const servicesQ = useApiQuery(['resources', 'group-services', businessId], () => listGroupServices(businessId ?? ''), {
    enabled: ready && Boolean(businessId),
  });

  // F-16-036 «?staff=&start=»: читаем query-параметры один раз при монтировании — инициализатором
  // useState, а не эффектом (react-hooks/set-state-in-effect и лишний кадр рендера ни к чему)
  const [staffId, setStaffId] = useState(() => searchParams.get('staff') ?? '');
  const startParam = searchParams.get('start');
  const [date, setDate] = useState(() => (startParam?.includes('T') ? startParam.slice(0, 10) : today()));
  const [time, setTime] = useState(() => (startParam?.includes('T') ? startParam.slice(11, 16) : '10:00'));
  const [serviceId, setServiceId] = useState('');
  const [durationMin, setDurationMin] = useState(60);
  const [capacity, setCapacity] = useState(8);
  const [error, setError] = useState<string | undefined>(undefined);

  const staffOptions = useMemo(() => (staffQ.data ?? []).map((s) => ({ value: s.id, label: s.name })), [staffQ.data]);
  const serviceOptions = useMemo(() => (servicesQ.data ?? []).map((s) => ({ value: s.id, label: pickText(s.name, locale) })), [servicesQ.data, locale]);
  const service = (servicesQ.data ?? []).find((s) => s.id === serviceId);

  // Подставить длительность/мест из выбранной услуги — во время рендера, не в эффекте
  const [defaultsForServiceId, setDefaultsForServiceId] = useState('');
  if (service && defaultsForServiceId !== service.id) {
    setDurationMin(service.durationMin);
    setCapacity(service.capacity ?? 8);
    setDefaultsForServiceId(service.id);
  }

  const create = useApiMutation(async (input: { staffId: Id; serviceId: Id; start: string; durationMin: number; capacity: number }) => {
    // F-16-011: событие тоже занимает ресурсы, привязанные к его услуге, — по одному свободному экземпляру каждого.
    const resourceIds = (await pickFreeResourceInstances(businessId ?? '', [input.serviceId], input.start, input.durationMin)) ?? [];
    return createGroupEvent({
      businessId: businessId ?? '',
      locationId: (locationId && locationId !== 'all' ? locationId : businessId) ?? '',
      staffId: input.staffId,
      serviceId: input.serviceId,
      start: input.start,
      durationMin: input.durationMin,
      capacity: input.capacity,
      resourceIds,
    });
  });

  const submit = async () => {
    if (!staffId || !serviceId || capacity <= 0) {
      setError(t('event.form.required'));
      return;
    }
    try {
      const event = await create.mutate({ staffId, serviceId, start: `${date}T${time}`, durationMin, capacity });
      logResourcesChange(businessId ?? '', 'event', event.id, 'create', pickText(service?.name ?? { ru: '' }, locale) || event.id);
      toast.success(t('event.form.created'));
      router.push(`/biz/groups/events/${event.id}`);
    } catch {
      toast.error(t('form.saveFailed'));
    }
  };

  if (ready && (servicesQ.data ?? []).length === 0 && !servicesQ.isLoading) {
    return (
      <div className="mx-auto w-full max-w-xl">
        <PageHeader title={t('event.form.createTitle')} back={{ href: '/biz/groups' }} />
        <EmptyState icon={<Users aria-hidden />} title={t('groups.emptyTitle')} description={t('groups.emptyText')} />
      </div>
    );
  }

  return (
    <div data-f="F-16-036 F-16-037 F-16-038 F-16-040 F-16-095" className="mx-auto flex w-full max-w-xl flex-col gap-6 pb-24">
      <PageHeader title={t('event.form.createTitle')} back={{ href: '/biz/groups' }} />

      {!ready || staffQ.isLoading || servicesQ.isLoading ? (
        <Skeleton lines={6} />
      ) : (
        <SectionCard title={t('event.form.sectionTitle')} classNames={{ body: 'flex flex-col gap-5' }}>
          <FormField label={t('event.form.staff')} error={!staffId ? error : undefined} required>
            <Select options={staffOptions} value={staffId} onValueChange={setStaffId} placeholder={t('event.form.staffPlaceholder')} />
          </FormField>
          <div className="flex flex-col gap-4 sm:flex-row">
            <FormField label={t('event.form.date')} className="flex-1">
              <DatePicker value={date} onValueChange={(d) => d && setDate(d)} />
            </FormField>
            <FormField label={t('event.form.time')} className="flex-1">
              <TimePicker value={time} onValueChange={setTime} />
            </FormField>
            <FormField label={t('event.form.duration')} className="flex-1">
              <Select
                options={[30, 45, 60, 75, 90, 120].map((m) => ({ value: String(m), label: t('event.form.durationOption', { m }) }))}
                value={String(durationMin)}
                onValueChange={(v) => setDurationMin(Number(v))}
              />
            </FormField>
          </div>
          <FormField label={t('event.form.service')} error={!serviceId ? error : undefined} required>
            <Select options={serviceOptions} value={serviceId} onValueChange={setServiceId} placeholder={t('event.form.servicePlaceholder')} />
          </FormField>
          <FormField label={t('event.form.capacity')} error={capacity <= 0 ? error : undefined} required>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={() => setCapacity((c) => Math.max(1, c - 1))} aria-label={t('event.form.capacityMinus')}>
                −
              </Button>
              <span className="w-10 text-center text-base font-semibold tabular-nums text-fg">{capacity}</span>
              <Button variant="outline" size="sm" onClick={() => setCapacity((c) => c + 1)} aria-label={t('event.form.capacityPlus')}>
                +
              </Button>
            </div>
          </FormField>
        </SectionCard>
      )}

      {!canCreate && ready && <p data-f="F-16-046" className="text-sm text-warning">{t('event.form.noCreateRight')}</p>}

      <StickyActionBar>
        <Button variant="ghost" onClick={() => router.push('/biz/groups')}>
          {t('form.cancel')}
        </Button>
        <Button disabled={!canCreate} loading={create.isPending} onClick={submit}>
          {t('event.form.save')}
        </Button>
      </StickyActionBar>
    </div>
  );
}
