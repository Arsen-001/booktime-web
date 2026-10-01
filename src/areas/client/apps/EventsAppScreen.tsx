'use client';

/**
 * «Приложение» → групповые события (F-14-106…109). Демо-симуляция раздела мобильного приложения:
 * создание события с одной услугой/вместимостью/ресурсом, запись клиентов на несколько мест, правка
 * данных и цены участника (но не времени и услуги), повтор по неделям с меткой серии.
 */
import { useState } from 'react';
import { useLocale } from 'next-intl';
import { CalendarRange, Plus, Repeat, Users } from 'lucide-react';
import {
  cancelAppGroupEvent,
  createAppGroupEvent,
  listAppGroupEvents,
  listAppServices,
  listStaffBrief,
  signUpForAppGroupEvent,
  updateEventParticipant,
  type AppGroupEvent,
} from '@/api/client';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import type { Id, ISODate, TimeHM } from '@/domain/core';
import { useClientFormat } from '@/areas/client/useClientFormat';
import { useT } from '@/i18n/useT';
import { combine, today } from '@/lib/date';
import { pickText } from '@/lib/text';
import { splitLegacySeatName } from '@/domain/client';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { DatePicker } from '@/ui/DatePicker';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { Modal } from '@/ui/Modal';
import { MoneyInput } from '@/ui/MoneyInput';
import { PageHeader } from '@/ui/PageHeader';
import { usePagedList } from '@/ui/Pagination';
import { Select } from '@/ui/Select';
import { SectionCard } from '@/ui/SectionCard';
import { Skeleton } from '@/ui/Skeleton';
import { TimePicker } from '@/ui/TimePicker';
import { useToast } from '@/ui/Toast';
import { ExitHold } from '@/ui/ExitHold';

export function EventsAppScreen() {
  const t = useT('client');
  const locale = useLocale();
  const fmt = useClientFormat();
  const { ready, businessId, locationIds } = useCurrent();
  const [createOpen, setCreateOpen] = useState(false);
  const [openId, setOpenId] = useState<Id | undefined>(undefined);

  const q = useApiQuery(['app-events', businessId], () => listAppGroupEvents(businessId!), { enabled: ready && Boolean(businessId) });
  // Постранично, как во всех списках (DESIGN.md → Long lists)
  const { pageItems, pager } = usePagedList(q.data ?? []);

  return (
    <div data-f="F-14-106 F-14-107 F-14-108 F-14-109" className="flex flex-col gap-6">
      <PageHeader
        title={t('apps.events.title')}
        description={t('apps.events.subtitle')}
        actions={
          <Button size="sm" leftIcon={<Plus aria-hidden />} onClick={() => setCreateOpen(true)}>
            {t('apps.events.createCta')}
          </Button>
        }
      />

      {!ready || q.isLoading ? (
        <Skeleton lines={4} />
      ) : q.isError ? (
        <ErrorState onRetry={() => void q.refetch()} />
      ) : !q.data?.length ? (
        <EmptyState
          icon={<CalendarRange aria-hidden className="size-8 text-muted" />}
          title={t('apps.events.empty')}
          action={<Button onClick={() => setCreateOpen(true)}>{t('apps.events.createCta')}</Button>}
        />
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {pageItems.map((row) => (
              <li key={row.event.id}>
                <Card interactive padding="sm" className="flex items-center justify-between gap-3" onClick={() => setOpenId(row.event.id)}>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-fg">{row.service ? pickText(row.service.name, locale) : row.event.serviceId}</p>
                    <p className="text-sm text-muted">
                      {fmt.dateTime(row.event.start)}
                      {' · '}
                      {row.staff?.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {row.event.seriesId && (
                      <Badge tone="info" variant="soft">
                        <Repeat aria-hidden className="size-3" />
                      </Badge>
                    )}
                    <Badge tone={row.seatsLeft > 0 ? 'success' : 'neutral'} variant="soft">
                      {t('apps.events.seatsLeft', { count: row.seatsLeft })}
                    </Badge>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
          {pager}
        </>
      )}

      <ExitHold value={createOpen && businessId && locationIds[0] ? businessId : null}>
        {(businessId) => (
          <CreateEventModal businessId={businessId} locationId={locationIds[0]!} onClose={() => setCreateOpen(false)} onCreated={() => void q.refetch()} />
        )}
      </ExitHold>

      <ExitHold value={openId ? q.data?.find((r) => r.event.id === openId) : undefined}>
        {(row) => <EventModal row={row} onClose={() => setOpenId(undefined)} onChanged={() => void q.refetch()} />}
      </ExitHold>
    </div>
  );
}

function CreateEventModal({ businessId, locationId, onClose, onCreated }: { businessId: Id; locationId: Id; onClose: () => void; onCreated: () => void }) {
  const t = useT('client');
  const locale = useLocale();
  const toast = useToast();
  const servicesQ = useApiQuery(['app-services', businessId], () => listAppServices(businessId));
  const staffQ = useApiQuery(['staff-brief', businessId], () => listStaffBrief(businessId));

  const [serviceId, setServiceId] = useState('');
  const [staffId, setStaffId] = useState('');
  const [date, setDate] = useState<ISODate | null>(today());
  const [time, setTime] = useState<TimeHM | null>('12:00');
  const [durationMin, setDurationMin] = useState(60);
  const [capacity, setCapacity] = useState(6);
  const [repeatWeeks, setRepeatWeeks] = useState(1);

  const create = useApiMutation(createAppGroupEvent);

  const selectedService = servicesQ.data?.find((s) => s.id === serviceId);

  return (
    <Modal open onOpenChange={onClose} title={t('apps.events.createCta')} size="md">
      <div className="flex flex-col gap-3">
        <FormField label={t('apps.events.serviceLabel')}>
          <Select
            options={(servicesQ.data ?? []).map((s) => ({ value: s.id, label: pickText(s.name, locale) }))}
            value={serviceId}
            onValueChange={(v) => {
              setServiceId(v);
              const svc = servicesQ.data?.find((s) => s.id === v);
              if (svc) setDurationMin(svc.durationMin);
            }}
            placeholder={t('apps.events.servicePlaceholder')}
          />
        </FormField>
        <FormField label={t('apps.events.staffLabel')}>
          <Select
            options={(staffQ.data ?? []).map((s) => ({ value: s.id, label: s.name }))}
            value={staffId}
            onValueChange={setStaffId}
            placeholder={t('apps.events.staffPlaceholder')}
          />
        </FormField>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField label={t('apps.events.dateLabel')}>
            <DatePicker value={date} onValueChange={setDate} min={today()} className="w-full" />
          </FormField>
          <FormField label={t('apps.events.timeLabel')}>
            <TimePicker value={time} onValueChange={setTime} />
          </FormField>
        </div>
        <FormField label={t('apps.events.durationLabel')} hint={t('apps.events.durationFromService')}>
          <Input
            type="number"
            value={durationMin}
            onChange={(e) => setDurationMin(Number(e.target.value) || 0)}
          />
        </FormField>
        <FormField label={t('apps.events.capacityLabel')}>
          <Input type="number" min={1} max={30} value={capacity} onChange={(e) => setCapacity(Number(e.target.value) || 1)} />
        </FormField>
        <FormField label={t('apps.events.repeatLabel')} hint={t('apps.events.repeatHint')}>
          <Input type="number" min={1} max={12} value={repeatWeeks} onChange={(e) => setRepeatWeeks(Number(e.target.value) || 1)} />
        </FormField>

        <Button
          loading={create.isPending}
          disabled={!serviceId || !staffId || !date || !time || durationMin <= 0}
          onClick={() =>
            date &&
            time &&
            void create
              .mutate({
                businessId,
                locationId,
                serviceId,
                staffId,
                start: combine(date, time),
                durationMin,
                capacity,
                repeat: repeatWeeks > 1 ? { weeks: repeatWeeks } : undefined,
              })
              .then(() => {
                toast.success(t('apps.events.created'));
                onCreated();
                onClose();
              })
              .catch(() => toast.error(t('apps.events.actionFailed')))
          }
        >
          {t('apps.events.createCta')}
        </Button>
        {!selectedService && <p className="text-xs text-muted">{t('apps.events.pickServiceFirst')}</p>}
      </div>
    </Modal>
  );
}

function EventModal({ row, onClose, onChanged }: { row: AppGroupEvent; onClose: () => void; onChanged: () => void }) {
  const t = useT('client');
  const toast = useToast();
  const [visitorName, setVisitorName] = useState('');
  const [seats, setSeats] = useState(1);
  const [price, setPrice] = useState(0);

  const signUp = useApiMutation(signUpForAppGroupEvent);
  const updateParticipant = useApiMutation(({ id, patch }: { id: Id; patch: { visitorName?: string; total?: number } }) => updateEventParticipant(id, patch));
  const cancel = useApiMutation(cancelAppGroupEvent);
  const [confirmCancel, setConfirmCancel] = useState(false);

  return (
    <Modal open onOpenChange={onClose} title={t('apps.events.title')} size="lg">
      <div className="flex flex-col gap-4">
        <Card padding="sm" className="flex items-center justify-between bg-surface-2">
          <span className="text-sm text-muted">{t('apps.events.seatsLeft', { count: row.seatsLeft })}</span>
          {row.event.seriesId && (
            <Badge tone="info" variant="soft">
              {t('apps.events.partOfSeries')}
            </Badge>
          )}
        </Card>

        <SectionCard title={t('apps.events.participantsTitle')}>
          {row.participants.length === 0 ? (
            <EmptyState icon={<Users aria-hidden className="size-8 text-muted" />} title={t('apps.events.noParticipants')} />
          ) : (
            <ul className="flex flex-col gap-2">
              {row.participants.map((b) => (
                <li key={b.id}>
                  <ParticipantRow
                    booking={b}
                    extraSeat={row.extraSeats[b.id]}
                    onSave={(patch) =>
                      updateParticipant
                        .mutate({ id: b.id, patch })
                        .then(onChanged)
                        .catch(() => toast.error(t('apps.events.actionFailed')))
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        {row.seatsLeft > 0 && (
          <SectionCard title={t('apps.events.signUpTitle')}>
            <div className="flex flex-col gap-3">
              <FormField label={t('apps.events.visitorNameLabel')}>
                <Input value={visitorName} onChange={(e) => setVisitorName(e.target.value)} />
              </FormField>
              <FormField label={t('apps.events.seatsLabel')}>
                <Input
                  type="number"
                  min={1}
                  max={row.seatsLeft}
                  value={seats}
                  onChange={(e) => setSeats(Math.min(row.seatsLeft, Math.max(1, Number(e.target.value) || 1)))}
                />
              </FormField>
              <FormField label={t('apps.events.priceLabel')}>
                <MoneyInput value={price} onValueChange={(v) => setPrice(v ?? 0)} />
              </FormField>
              <Button
                loading={signUp.isPending}
                disabled={!visitorName.trim()}
                onClick={() =>
                  void signUp
                    .mutate({ eventId: row.event.id, visitorName: visitorName.trim(), seats, price })
                    .then(() => {
                      toast.success(t('apps.events.signedUp'));
                      setVisitorName('');
                      setSeats(1);
                      onChanged();
                    })
                    .catch(() => toast.error(t('apps.events.actionFailed')))
                }
              >
                {t('apps.events.signUpCta')}
              </Button>
            </div>
          </SectionCard>
        )}

        <Button variant="ghost" className="self-start text-danger" onClick={() => setConfirmCancel(true)}>
          {t('apps.events.cancelEventCta')}
        </Button>
      </div>

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        tone="danger"
        title={t('apps.events.cancelConfirmTitle')}
        description={t('apps.events.cancelConfirmHint', { count: row.participants.length })}
        confirmLabel={t('apps.events.cancelEventCta')}
        onConfirm={async () => {
          try {
            await cancel.mutate(row.event.id);
            toast.success(t('apps.events.cancelled'));
            onChanged();
            onClose();
          } catch {
            toast.error(t('apps.events.actionFailed'));
          }
        }}
      />
    </Modal>
  );
}

/**
 * Участник события: имя и цена с подписями; сохраняем по уходу с поля (onBlur) и только если значение
 * изменилось — не на каждую цифру (раньше MoneyInput слал запрос на каждое нажатие).
 */
function ParticipantRow({
  booking,
  extraSeat,
  onSave,
}: {
  booking: AppGroupEvent['participants'][number];
  /** Номер доп. места (1, 2…) — подпись «+1 место» на языке пользователя; старые «Анна +1» разбираются при показе */
  extraSeat?: number;
  onSave: (patch: { visitorName?: string; total?: number }) => Promise<unknown>;
}) {
  const t = useT('client');
  const [price, setPrice] = useState(booking.total);
  const legacy = splitLegacySeatName(booking.visitorName);
  const seat = extraSeat ?? legacy.seat;
  return (
    <Card padding="sm" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <FormField label={t('apps.events.visitorNameLabel')} hint={seat ? t('apps.events.extraSeat', { n: seat }) : undefined}>
        <Input
          defaultValue={legacy.name}
          placeholder={t('apps.visit.guest')}
          onBlur={(e) => {
            const next = e.target.value.trim();
            if (next && next !== legacy.name) void onSave({ visitorName: next });
          }}
        />
      </FormField>
      <FormField label={t('apps.events.priceLabel')}>
        <MoneyInput
          value={price}
          onValueChange={(v) => setPrice(v ?? 0)}
          onBlur={() => {
            if (price !== booking.total) void onSave({ total: price });
          }}
        />
      </FormField>
    </Card>
  );
}
