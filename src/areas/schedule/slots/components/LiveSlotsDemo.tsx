'use client';

/**
 * «Проверить на реальных данных» — живой расчёт окон тем же движком, что у клиента (getFreeSlots). Нажатие на окно
 * занимает его учебной записью — окно пропадает (F-02-072); «Освободить» возвращает. По умолчанию выбран первый
 * сотрудник, у которого есть услуги с онлайн-записью (ux-r5 L-2).
 */
import { useState, type ReactNode } from 'react';
import { useLocale } from 'next-intl';
import type { Id } from '@/domain/core';
import { bookDemoSlot, cancelDemoSlot, getDemoBooking, getFreeSlots, getLiveDemoOptions, type FreeSlot } from '@/api/schedule';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { today } from '@/lib/date';
import { pickText } from '@/lib/text';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { DatePicker } from '@/ui/DatePicker';
import { EmptyState } from '@/ui/EmptyState';
import { FormField } from '@/ui/FormField';
import { SectionCard } from '@/ui/SectionCard';
import { Select } from '@/ui/Select';
import { Skeleton } from '@/ui/Skeleton';
import { SlotButton } from '@/ui/SlotButton';
import { useToast } from '@/ui/Toast';

export function LiveSlotsDemo() {
  const t = useT('schedule');
  const locale = useLocale();
  const format = useFormat();
  const toast = useToast();
  const { ready, businessId, activeLocationIds } = useCurrent();
  const locationId = activeLocationIds[0] ?? '';

  const optionsQuery = useApiQuery(
    ['schedule', 'live-demo-options', businessId, locationId],
    () => getLiveDemoOptions(businessId ?? '', locationId),
    {
      enabled: ready && Boolean(businessId) && Boolean(locationId),
    },
  );
  const staffList = optionsQuery.data ?? [];
  const [staffId, setStaffId] = useState<Id | undefined>(undefined);
  const staff = staffList.find((s) => s.id === staffId) ?? staffList.find((s) => s.services.length > 0) ?? staffList[0];
  const [serviceId, setServiceId] = useState<Id | undefined>(undefined);
  const service = staff?.services.find((s) => s.id === serviceId) ?? staff?.services[0];
  const [date, setDate] = useState(today());

  const staffKey = staff?.id ?? '';
  const serviceKey = service?.id ?? '';
  const durationMin = service?.durationMin ?? 0;
  const durationMax = service?.durationMax;
  const bufferAfterMin = service?.bufferAfterMin ?? 0;
  const slotsQuery = useApiQuery(
    ['schedule', 'live-demo-slots', staffKey, serviceKey, date],
    () => getFreeSlots({ staffId: staffKey, date, durationMin, durationMax, bufferAfterMin, serviceId: serviceKey, locationId }),
    { enabled: ready && Boolean(staffKey) && Boolean(serviceKey) },
  );
  const demoQuery = useApiQuery(['schedule', 'live-demo-booking', staffKey], () => getDemoBooking(staffKey), {
    enabled: ready && Boolean(staffKey),
  });
  const book = useApiMutation(bookDemoSlot);
  const cancel = useApiMutation(cancelDemoSlot);

  const onBook = async (slot: FreeSlot) => {
    if (!businessId || !service || !staff) return;
    try {
      await book.mutate({ businessId, locationId, staffId: staff.id, serviceId: service.id, start: slot.start, workplace: slot.workplace });
      toast.success(t('slots.liveDemo.bookedToast', { time: format.time(slot.start) }));
    } catch {
      toast.error(t('slots.liveDemo.errorToast'));
    }
  };

  const onCancel = async (id: Id) => {
    try {
      await cancel.mutate(id);
      toast.success(t('slots.liveDemo.freedToast'));
    } catch {
      toast.error(t('slots.liveDemo.errorToast'));
    }
  };

  const shell = (children: ReactNode) => (
    <SectionCard title={t('slots.liveDemo.title')} description={t('slots.liveDemo.hint')}>
      <div data-f="F-00-056 F-02-064 F-02-070 F-02-072 F-02-080" className="flex flex-col gap-4">
        {children}
      </div>
    </SectionCard>
  );

  if (!ready || optionsQuery.isLoading) return shell(<Skeleton lines={4} />);
  if (optionsQuery.isError) return shell(<EmptyState variant="inline" title={t('slots.liveDemo.errorToast')} />);
  if (!staff) return shell(<EmptyState variant="inline" title={t('slots.liveDemo.noStaff')} />);

  const demo = demoQuery.data;
  const slots = slotsQuery.data ?? [];

  return shell(
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FormField label={t('slots.liveDemo.staffLabel')}>
          <Select
            options={staffList.map((s) => ({ value: s.id, label: s.name }))}
            value={staff.id}
            onValueChange={(v) => {
              setStaffId(v);
              setServiceId(undefined);
            }}
          />
        </FormField>
        {service ? (
          <FormField label={t('slots.liveDemo.serviceLabel')}>
            <Select
              options={staff.services.map((s) => ({ value: s.id, label: pickText(s.name, locale) }))}
              value={service.id}
              onValueChange={setServiceId}
            />
          </FormField>
        ) : null}
        <FormField label={t('quickBooking.date')}>
          <DatePicker value={date} onValueChange={(v) => v && setDate(v)} min={today()} />
        </FormField>
      </div>

      {!service ? (
        <EmptyState variant="inline" title={t('slots.liveDemo.noServices')} description={t('slots.liveDemo.noServicesHint')} />
      ) : (
        <>
          <p className="text-sm text-muted">
            {t('slots.liveDemo.needLine', {
              duration: format.duration(service.durationMax ?? service.durationMin),
              buffer: format.duration(service.bufferAfterMin),
            })}
            {service.resource && (
              <> · {t('slots.liveDemo.resourceLine', { name: pickText(service.resource.name, locale), count: service.resource.count })}</>
            )}
          </p>
          {demo && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg bg-warning-soft px-3 py-2 text-sm">
              <Badge tone="warning">{t('slots.liveDemo.occupiedChip', { time: format.time(demo.start) })}</Badge>
              <span className="text-fg">{t('slots.liveDemo.occupiedHint')}</span>
              <Button size="sm" variant="ghost" loading={cancel.isPending} onClick={() => void onCancel(demo.id)}>
                {t('slots.liveDemo.cancelDemoBooking')}
              </Button>
            </div>
          )}
          {slotsQuery.isLoading ? (
            <Skeleton lines={2} />
          ) : slots.length === 0 ? (
            <EmptyState variant="inline" title={t('slots.liveDemo.empty')} description={t('slots.liveDemo.emptyHint')} />
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted">{demo ? t('slots.liveDemo.slotsHintBusy') : t('slots.liveDemo.slotsHint')}</p>
              <div className="flex flex-wrap gap-2">
                {slots.map((slot) => (
                  <SlotButton
                    key={`${slot.start}-${slot.locationId}`}
                    disabled={Boolean(demo) || book.isPending}
                    disabledReason={demo ? t('slots.liveDemo.oneAtATime') : undefined}
                    onClick={() => void onBook(slot)}
                  >
                    {format.time(slot.start)}
                  </SlotButton>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </>,
  );
}
