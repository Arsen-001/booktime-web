'use client';

/**
 * /biz/groups/events/[eventId] — окно группового события (F-16-041). Параметры (F-16-037, F-16-038, F-16-044),
 * участники (F-16-047, F-16-048, F-16-051), удаление (F-16-045) — пачка b01/b02. Пачка b03 наполняет вкладки:
 * «Повтор» (F-16-064, F-16-065), «Расписание»/серия (F-16-067…077), расписание посещений участника (F-16-078…080),
 * «Присоединиться» (F-16-081) и «Уведомления» (F-16-082, F-16-083). «История» — вне списка функций b03, каркас
 * остаётся заглушкой. Тот же экран на телефоне 390px — «мобильное приложение для бизнеса» (F-16-095…101).
 */
import { useMemo, useState } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import {
  ArrowRightLeft,
  CalendarClock,
  CalendarPlus,
  History,
  Link2,
  MoreHorizontal,
  Phone,
  Plus,
  Repeat,
  Send,
  ShoppingBag,
  Star,
  Trash2,
  Users,
  Wallet,
} from 'lucide-react';
import { coreList, updateBooking, updateGroupEvent } from '@/api/core';
import {
  addParticipant,
  addParticipantExtra,
  addSeriesWeekday,
  cancelParticipantPayment,
  getParticipantPayment,
  chargeBookingAutoDebit,
  createEventCategory,
  createEventSeries,
  deleteEventCategory,
  getBookingAutoCharge,
  getGroupSeatsSettings,
  createVisitSchedule,
  deleteSeries,
  deleteVisitSchedule,
  editSeriesDayRule,
  extendOrShortenSeries,
  getEventExtra,
  getEventJoin,
  getSeriesDef,
  isPastEvent,
  listEventCategories,
  listEventParticipants,
  listEventTemplates,
  listGroupServices,
  listParticipantExtras,
  listResources,
  listTransferTargets,
  listVisitSchedules,
  payParticipant,
  removeParticipant,
  removeParticipantExtra,
  removeSeriesWeekday,
  repeatEvent,
  saveEventExtra,
  saveEventJoin,
  saveEventParams,
  seatsTaken,
  sendEventJoinNotifications,
  transferParticipant,
  updateSeriesEvent,
  updateVisitSchedule,
  type EventCategory,
  type EventParticipant,
  type ParticipantExtraKind,
  type ParticipantPaymentMethod,
  type RepeatFreq,
  type SeriesDayRule,
} from '@/api/resources';
import { ApiError, useApiMutation, useApiQuery } from '@/api/request';
import { useCan, useCurrent } from '@/demo/hooks';
import type { Booking, GroupEvent, Id } from '@/domain/core';
import { PARTICIPANT_COMMENT_MAX, REPEAT_FREQS } from '@/domain/resources';
import { addDays } from '@/lib/date';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { pickText } from '@/lib/text';
import { maskPhone, telLink, waLink } from '@/lib/phone';
import { Badge } from '@/ui/Badge';
import { BookingStatusBadge } from '@/ui/BookingStatusBadge';
import { Button } from '@/ui/Button';
import { Checkbox } from '@/ui/Checkbox';
import { ColorPicker } from '@/ui/ColorPicker';
import { ColorSwatch } from '@/ui/ColorSwatch';
import { DatePicker } from '@/ui/DatePicker';
import { DropdownMenu } from '@/ui/DropdownMenu';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { FormField } from '@/ui/FormField';
import { IconButton } from '@/ui/IconButton';
import { Input } from '@/ui/Input';
import { MoneyInput } from '@/ui/MoneyInput';
import { PageHeader } from '@/ui/PageHeader';
import { PhoneInput } from '@/ui/PhoneInput';
import { Radio } from '@/ui/Radio';
import { SectionCard } from '@/ui/SectionCard';
import { Select } from '@/ui/Select';
import { Sheet } from '@/ui/Sheet';
import { Skeleton } from '@/ui/Skeleton';
import { usePagedList } from '@/ui/Pagination';
import { StickyActionBar } from '@/ui/StickyActionBar';
import { Tabs } from '@/ui/Tabs';
import { Textarea } from '@/ui/Textarea';
import { TimePicker } from '@/ui/TimePicker';
import { useConfirm, useToast } from '@/ui/Toast';
import { WeekdayPicker } from '@/ui/WeekdayPicker';
import { ExitHold } from '@/ui/ExitHold';
import { EntityMultiPicker } from '@/areas/resources/components/EntityMultiPicker';

export interface EventWindowScreenProps {
  eventId: string;
}

type TabKey = 'clients' | 'details' | 'repeat' | 'schedule' | 'join' | 'notify' | 'history';

const DURATION_OPTIONS = [30, 45, 60, 75, 90, 120];

export function EventWindowScreen({ eventId }: EventWindowScreenProps) {
  const t = useT('resources');
  const locale = useLocale();
  const format = useFormat();
  const router = useRouter();
  const toast = useToast();
  const { ready, businessId, locationId } = useCurrent();
  const canManage = useCan('resources.manage');

  const eventQ = useApiQuery(['resources', 'group-event', eventId], () => coreList('groupEvents', (e) => e.id === eventId), { enabled: ready });
  const event = eventQ.data?.[0];
  // Сотрудники и услуги — бизнеса САМОГО события (владелец сети видит события разных филиалов; businessId
  // из useCurrent — это «где я сейчас в кабинете», а не обязательно бизнес события)
  const eventBusinessId = event?.businessId ?? businessId;

  const staffQ = useApiQuery(['resources', 'staff-for-groups', eventBusinessId], () => coreList('staff', { businessId: eventBusinessId ?? '' }), {
    enabled: ready && Boolean(eventBusinessId),
  });
  const servicesQ = useApiQuery(['resources', 'group-services', eventBusinessId], () => listGroupServices(eventBusinessId ?? ''), {
    enabled: ready && Boolean(eventBusinessId),
  });
  const participantsQ = useApiQuery(['resources', 'event-participants', eventId], () => listEventParticipants(eventId), { enabled: ready });
  const resourcesQ = useApiQuery(['resources', 'list', eventBusinessId], () => listResources(eventBusinessId ?? ''), {
    enabled: ready && Boolean(eventBusinessId),
  });
  const seriesDefQ = useApiQuery(['resources', 'series-def', event?.seriesId], () => getSeriesDef(event?.seriesId), {
    enabled: ready && Boolean(event?.seriesId),
  });
  const templatesQ = useApiQuery(['resources', 'event-templates', eventBusinessId], () => listEventTemplates(eventBusinessId ?? ''), {
    enabled: ready && Boolean(eventBusinessId),
  });
  const joinQ = useApiQuery(['resources', 'event-join', eventId], () => getEventJoin(eventId), { enabled: ready });
  const visitSchedulesQ = useApiQuery(['resources', 'visit-schedules', event?.seriesId], () => listVisitSchedules(event?.seriesId ?? ''), {
    enabled: ready && Boolean(event?.seriesId),
  });
  const eventExtraQ = useApiQuery(['resources', 'event-extra', eventId], () => getEventExtra(eventId), { enabled: ready });
  const categoriesQ = useApiQuery(['resources', 'event-categories', eventBusinessId], () => listEventCategories(eventBusinessId ?? ''), {
    enabled: ready && Boolean(eventBusinessId),
  });
  const seatsSettingsQ = useApiQuery(['resources', 'group-seats-settings', eventBusinessId], () => getGroupSeatsSettings(eventBusinessId ?? ''), {
    enabled: ready && Boolean(eventBusinessId),
  });

  const [tab, setTab] = useState<TabKey>('clients');
  const [staffId, setStaffId] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [durationMin, setDurationMin] = useState(60);
  const [serviceId, setServiceId] = useState('');
  const [capacity, setCapacity] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [scheduleClientId, setScheduleClientId] = useState<{ phone: string; name: string; clientId?: Id } | null>(null);
  const [expandedId, setExpandedId] = useState<Id | null>(null);

  // Загрузить черновик из события ВО ВРЕМЯ рендера (не useEffect — react-hooks/set-state-in-effect)
  const [loadedEventId, setLoadedEventId] = useState<string | null>(null);
  if (event && loadedEventId !== eventId) {
    setStaffId(event.staffId);
    setDate(event.start.slice(0, 10));
    setTime(event.start.slice(11, 16));
    setDurationMin(event.durationMin);
    setServiceId(event.serviceId);
    setCapacity(event.capacity);
    setLoadedEventId(eventId);
  }

  const staffOptions = useMemo(() => (staffQ.data ?? []).map((s) => ({ value: s.id, label: s.name })), [staffQ.data]);
  const serviceOptions = useMemo(
    () => (servicesQ.data ?? []).map((s) => ({ value: s.id, label: pickText(s.name, locale) })),
    [servicesQ.data, locale],
  );
  const staffName = useMemo(() => new Map((staffQ.data ?? []).map((s) => [s.id, s.name])), [staffQ.data]);
  const service = (servicesQ.data ?? []).find((s) => s.id === event?.serviceId);
  const resourceOptions = useMemo(
    () => (resourcesQ.data ?? []).filter((r) => r.active).map((r) => ({ id: r.id, label: pickText(r.name, locale), description: r.description || undefined })),
    [resourcesQ.data, locale],
  );

  const participants = participantsQ.data ?? [];
  const taken = seatsTaken(participants);
  // Постранично, как во всех списках (DESIGN.md → Long lists)
  const { pageItems: participantsPage, pager: participantsPager } = usePagedList(participants);
  const capacityNow = event?.capacity ?? capacity;
  const full = taken >= capacityNow;
  const isUnique = Boolean(event?.seriesId && seriesDefQ.data?.uniqueEventIds.includes(event.id));
  const isPast = event ? isPastEvent(event) : false;

  const save = useApiMutation((patch: { staffId: string; start: string; durationMin: number; serviceId: string; capacity: number }) =>
    saveEventParams(eventId, patch),
  );
  const remove = useApiMutation(() =>
    event?.seriesId ? updateSeriesEvent(eventId, { status: 'cancelled' }) : updateGroupEvent(eventId, { status: 'cancelled' }),
  );
  const addM = useApiMutation((args: { name: string; phone: string; seats: number; visitorName?: string; comment?: string }) =>
    addParticipant({
      businessId: event?.businessId ?? businessId ?? '',
      locationId: event?.locationId ?? (locationId && locationId !== 'all' ? locationId : businessId) ?? '',
      eventId,
      staffId: event?.staffId ?? staffId,
      start: event?.start ?? `${date}T${time}`,
      name: args.name,
      phone: args.phone,
      seats: args.seats,
      visitorName: args.visitorName,
      comment: args.comment,
    }),
  );
  const removeM = useApiMutation((bookingId: Id) => removeParticipant(bookingId));

  const dirty =
    event &&
    (staffId !== event.staffId ||
      `${date}T${time}` !== event.start ||
      durationMin !== event.durationMin ||
      serviceId !== event.serviceId ||
      capacity !== event.capacity);

  const capacityBelowParticipants = capacity < taken;

  const submitParams = async () => {
    if (capacityBelowParticipants) return;
    try {
      await save.mutate({ staffId, start: `${date}T${time}`, durationMin, serviceId, capacity });
      toast.success(t('event.window.updated'));
      eventQ.refetch();
      seriesDefQ.refetch();
    } catch {
      toast.error(t('form.saveFailed'));
    }
  };

  const doDelete = async () => {
    try {
      await remove.mutate(undefined);
      toast.success(t('event.window.deleted'));
      router.push('/biz/groups');
    } catch {
      toast.error(t('form.saveFailed'));
    }
  };

  if (eventQ.isLoading || !ready) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <Skeleton lines={10} />
      </div>
    );
  }
  if (eventQ.isError || !event) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <ErrorState onRetry={eventQ.refetch} />
      </div>
    );
  }

  const tabItems = [
    { value: 'clients', label: t('event.tabs.clients') },
    { value: 'details', label: t('event.tabs.details') },
    { value: 'repeat', label: t('event.tabs.repeat') },
    { value: 'schedule', label: t('event.tabs.schedule') },
    { value: 'join', label: t('event.tabs.join') },
    { value: 'notify', label: t('event.tabs.notify') },
    { value: 'history', label: t('event.tabs.history') },
  ];

  return (
    <div
      data-f="F-16-037 F-16-038 F-16-040 F-16-041 F-16-044 F-16-045 F-16-047 F-16-048 F-16-051 F-16-096 F-16-097 F-00-185 F-01-200"
      className="mx-auto flex w-full max-w-3xl flex-col gap-6 pb-24"
    >
      <PageHeader
        title={service ? pickText(service.name, locale) : t('event.window.title')}
        description={`${format.date(event.start, 'short')} · ${format.time(event.start)} · ${staffName.get(event.staffId) ?? ''}`}
        back={{ href: '/biz/groups' }}
        actions={
          canManage ? (
            <Button
              variant="ghost"
              className="text-danger"
              leftIcon={<Trash2 aria-hidden className="size-4" />}
              onClick={doDelete}
              loading={remove.isPending}
            >
              {t('event.window.delete')}
            </Button>
          ) : undefined
        }
      />

      {event.seriesId && (
        <div data-f="F-16-077" className="flex flex-wrap items-center gap-2">
          <Badge tone="info" variant="soft" icon={<Repeat aria-hidden className="size-3.5" />}>
            {t('event.series.badge')}
          </Badge>
          {isUnique && (
            <Badge tone="warning" variant="soft">
              {t('event.series.uniqueBadge')}
            </Badge>
          )}
          {seriesDefQ.data && (
            <span className="text-sm text-muted">{t('event.series.until', { date: format.date(seriesDefQ.data.endDate, 'short') })}</span>
          )}
        </div>
      )}

      <SectionCard title={t('event.form.sectionTitle')} classNames={{ body: 'flex flex-col gap-5' }}>
        <div className="flex flex-col gap-4 sm:flex-row">
          <FormField label={t('event.form.staff')} className="flex-1">
            <Select options={staffOptions} value={staffId} onValueChange={setStaffId} disabled={!canManage} />
          </FormField>
          <FormField label={t('event.form.date')} className="flex-1">
            <DatePicker value={date} onValueChange={(d) => d && setDate(d)} disabled={!canManage} />
          </FormField>
          <FormField label={t('event.form.time')} className="flex-1">
            <TimePicker value={time} onValueChange={setTime} disabled={!canManage} />
          </FormField>
        </div>
        <div className="flex flex-col gap-4 sm:flex-row">
          <FormField label={t('event.form.service')} className="flex-1">
            <Select options={serviceOptions} value={serviceId} onValueChange={setServiceId} disabled={!canManage} />
          </FormField>
          <FormField label={t('event.form.duration')} className="flex-1">
            <Select
              options={DURATION_OPTIONS.map((m) => ({ value: String(m), label: t('event.form.durationOption', { m }) }))}
              value={String(durationMin)}
              onValueChange={(v) => setDurationMin(Number(v))}
              disabled={!canManage}
            />
          </FormField>
          <FormField
            label={t('event.form.capacity')}
            error={capacityBelowParticipants ? t('event.form.capacityTooLow', { count: taken }) : undefined}
            className="flex-1"
          >
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                disabled={!canManage}
                onClick={() => setCapacity((c) => Math.max(1, c - 1))}
                aria-label={t('event.form.capacityMinus')}
              >
                −
              </Button>
              <span className="w-8 text-center text-base font-semibold tabular-nums text-fg">{capacity}</span>
              <Button
                variant="outline"
                size="sm"
                disabled={!canManage}
                onClick={() => setCapacity((c) => c + 1)}
                aria-label={t('event.form.capacityPlus')}
              >
                +
              </Button>
            </div>
          </FormField>
        </div>
      </SectionCard>

      <Tabs items={tabItems} value={tab} onValueChange={(v) => setTab(v as TabKey)} />

      {tab === 'clients' && (
        <SectionCard
          title={t('event.clients.title')}
          description={t('event.clients.seatsOf', { taken, capacity: capacityNow })}
          actions={
            canManage ? (
              <Button size="sm" leftIcon={<Plus aria-hidden className="size-4" />} disabled={full} onClick={() => setAddOpen(true)}>
                {full ? t('event.clients.full') : t('event.clients.add')}
              </Button>
            ) : undefined
          }
        >
          {participantsQ.isLoading ? (
            <Skeleton lines={3} />
          ) : participants.length === 0 ? (
            <EmptyState
              compact
              icon={<Users aria-hidden />}
              title={t('event.clients.emptyTitle')}
              description={t('event.clients.emptyText')}
              action={
                canManage ? (
                  <Button size="sm" onClick={() => setAddOpen(true)}>
                    {t('event.clients.add')}
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <ul data-f="F-01-195" className="flex flex-col gap-1">
              {participantsPage.map((p) => (
                <ParticipantRow
                  key={p.booking.id}
                  participant={p}
                  expanded={expandedId === p.booking.id}
                  onToggle={() => setExpandedId((id) => (id === p.booking.id ? null : p.booking.id))}
                  onRemove={
                    canManage
                      ? () =>
                          removeM
                            .mutate(p.booking.id)
                            .then(() => participantsQ.refetch())
                            .catch(() => toast.error(t('form.saveFailed')))
                      : undefined
                  }
                  onSchedule={
                    canManage && event.seriesId && !isPast && Math.max(1, p.booking.services[0]?.qty ?? 1) === 1
                      ? () =>
                          setScheduleClientId({
                            phone: p.client?.phone ?? '',
                            name: p.client?.name ?? p.booking.visitorName ?? '',
                            clientId: p.client?.id,
                          })
                      : undefined
                  }
                  format={format}
                  canManage={canManage}
                  businessId={event.businessId}
                  serviceId={event.serviceId}
                  eventId={event.id}
                  onChanged={() => participantsQ.refetch()}
                />
              ))}
            </ul>
          )}
          {participantsPager}
        </SectionCard>
      )}

      {tab === 'details' && (
        <DetailsPanel
          event={event}
          extra={eventExtraQ.data}
          loading={eventExtraQ.isLoading}
          resourceOptions={resourceOptions}
          categories={categoriesQ.data ?? []}
          categoriesLoading={categoriesQ.isLoading}
          canManage={canManage}
          onSaved={() => {
            eventExtraQ.refetch();
            eventQ.refetch();
          }}
          onCategoriesChanged={() => categoriesQ.refetch()}
        />
      )}

      {tab === 'repeat' && (
        <RepeatPanel
          event={event}
          templates={templatesQ.data ?? []}
          onCreated={() => {
            templatesQ.refetch();
          }}
        />
      )}

      {tab === 'schedule' && (
        <SchedulePanel
          event={event}
          isPast={isPast}
          seriesDef={seriesDefQ.data}
          seriesDefLoading={Boolean(event.seriesId) && seriesDefQ.isLoading}
          resourceOptions={resourceOptions}
          canManage={canManage}
          hasParticipants={participants.length > 0}
          onChanged={() => {
            eventQ.refetch();
            seriesDefQ.refetch();
            participantsQ.refetch();
          }}
        />
      )}

      {tab === 'join' && (
        <JoinPanel eventId={eventId} join={joinQ.data} loading={joinQ.isLoading} canManage={canManage} onSaved={() => joinQ.refetch()} />
      )}

      {tab === 'notify' && (
        <NotifyPanel
          eventId={eventId}
          join={joinQ.data}
          loading={joinQ.isLoading}
          participantsCount={
            participants.filter(
              (p) => p.booking.status !== 'cancelled_by_client' && p.booking.status !== 'cancelled_by_master' && p.booking.status !== 'no_show',
            ).length
          }
          canManage={canManage}
          onSent={() => joinQ.refetch()}
        />
      )}

      {tab === 'history' && (
        <SectionCard title={tabItems.find((i) => i.value === 'history')?.label ?? ''}>
          <EmptyState compact icon={<History aria-hidden />} title={t('event.tabsEmpty.history')} />
        </SectionCard>
      )}

      {canManage && dirty && (
        <StickyActionBar>
          <Button
            variant="ghost"
            onClick={() => {
              setStaffId(event.staffId);
              setDate(event.start.slice(0, 10));
              setTime(event.start.slice(11, 16));
              setDurationMin(event.durationMin);
              setServiceId(event.serviceId);
              setCapacity(event.capacity);
            }}
          >
            {t('form.cancel')}
          </Button>
          <Button loading={save.isPending} disabled={capacityBelowParticipants} onClick={submitParams}>
            {t('event.form.save')}
          </Button>
        </StickyActionBar>
      )}

      <AddParticipantSheet
        open={addOpen}
        onOpenChange={setAddOpen}
        pending={addM.isPending}
        maxSeats={seatsSettingsQ.data?.maxSeats ?? 6}
        allowMultiSeat={seatsSettingsQ.data?.allowMultiSeat ?? true}
        onSubmit={async (args) => {
          try {
            await addM.mutate(args);
            setAddOpen(false);
            participantsQ.refetch();
            toast.success(t('event.clients.added', { name: args.name }));
          } catch (e) {
            toast.error(e instanceof ApiError && e.code === 'group_full' ? t('event.clients.groupFull') : t('form.saveFailed'));
          }
        }}
      />

      {event.seriesId && (
        <VisitScheduleSheet
          open={Boolean(scheduleClientId)}
          onOpenChange={(open) => !open && setScheduleClientId(null)}
          client={scheduleClientId}
          seriesId={event.seriesId}
          seriesDays={seriesDefQ.data?.days ?? []}
          existing={visitSchedulesQ.data ?? []}
          onSaved={() => {
            setScheduleClientId(null);
            visitSchedulesQ.refetch();
            participantsQ.refetch();
          }}
        />
      )}
    </div>
  );
}

// ─────────────────────────── Детали события: ресурсы, цвет, категории, комментарий (F-16-039, F-16-043) ───────────────────────────

function DetailsPanel({
  event,
  extra,
  loading,
  resourceOptions,
  categories,
  categoriesLoading,
  canManage,
  onSaved,
  onCategoriesChanged,
}: {
  event: GroupEvent;
  extra: { colorIndex?: number; categoryIds: Id[]; comment?: string } | undefined;
  loading: boolean;
  resourceOptions: { id: string; label: string; description?: string }[];
  categories: EventCategory[];
  categoriesLoading: boolean;
  canManage: boolean;
  onSaved: () => void;
  onCategoriesChanged: () => void;
}) {
  const t = useT('resources');
  const toast = useToast();
  const [resourceIds, setResourceIds] = useState<Id[]>(event.resourceIds);
  const [colorIndex, setColorIndex] = useState<number | undefined>(undefined);
  const [categoryIds, setCategoryIds] = useState<Id[]>([]);
  const [comment, setComment] = useState('');
  const [manageOpen, setManageOpen] = useState(false);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  const key = `${event.id}:${loading ? 'loading' : 'loaded'}`;
  if (!loading && loadedFor !== key) {
    setResourceIds(event.resourceIds);
    setColorIndex(extra?.colorIndex);
    setCategoryIds(extra?.categoryIds ?? []);
    setComment(extra?.comment ?? '');
    setLoadedFor(key);
  }

  const save = useApiMutation(async () => {
    await updateGroupEvent(event.id, { resourceIds });
    return saveEventExtra(event.id, { colorIndex, categoryIds, comment });
  });

  const dirty =
    JSON.stringify([...resourceIds].sort()) !== JSON.stringify([...event.resourceIds].sort()) ||
    colorIndex !== extra?.colorIndex ||
    JSON.stringify([...categoryIds].sort()) !== JSON.stringify([...(extra?.categoryIds ?? [])].sort()) ||
    comment !== (extra?.comment ?? '');

  const toggleCategory = (id: Id) => setCategoryIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));

  if (loading) {
    return (
      <SectionCard title={t('event.tabs.details')}>
        <Skeleton lines={6} />
      </SectionCard>
    );
  }

  return (
    <div data-f="F-16-039">
      <SectionCard title={t('event.tabs.details')} classNames={{ body: 'flex flex-col gap-5' }}>
        <FormField label={t('event.details.resources')}>
          <EntityMultiPicker
            disabled={!canManage}
            options={resourceOptions}
            value={resourceIds}
            onValueChange={setResourceIds}
            title={t('event.details.resources')}
            placeholder={t('event.details.resourcesPlaceholder')}
            searchPlaceholder={t('form.servicesSearch')}
            emptyText={t('form.servicesEmpty')}
          />
        </FormField>

        <ColorPicker value={colorIndex} onValueChange={setColorIndex} label={t('event.details.color')} />

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-fg">{t('event.details.categories')}</span>
          {categoriesLoading ? (
            <Skeleton lines={1} />
          ) : categories.length === 0 ? (
            <p className="text-sm text-muted">{t('event.details.categoriesEmpty')}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => {
                const active = categoryIds.includes(c.id);
                return (
                  <button key={c.id} type="button" disabled={!canManage} onClick={() => toggleCategory(c.id)} className="disabled:opacity-60">
                    <Badge
                      tone={active ? 'primary' : 'neutral'}
                      variant={active ? 'soft' : 'outline'}
                      icon={<ColorSwatch colorIndex={c.colorIndex} label={c.name} size="sm" />}
                    >
                      {c.name}
                    </Badge>
                  </button>
                );
              })}
            </div>
          )}
          {canManage && (
            <Button variant="ghost" size="sm" className="self-start" onClick={() => setManageOpen(true)}>
              {t('event.details.manageCategories')}
            </Button>
          )}
        </div>

        <FormField label={t('event.details.comment')} optional>
          <Textarea
            disabled={!canManage}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            placeholder={t('event.details.commentPlaceholder')}
          />
        </FormField>

        {canManage && (
          <div className="flex justify-end">
            <Button
              disabled={!dirty}
              loading={save.isPending}
              onClick={async () => {
                try {
                  await save.mutate(undefined);
                  toast.success(t('event.details.saved'));
                  onSaved();
                } catch {
                  toast.error(t('form.saveFailed'));
                }
              }}
            >
              {t('event.details.save')}
            </Button>
          </div>
        )}
      </SectionCard>

      <Sheet open={manageOpen} onOpenChange={setManageOpen} title={t('categories.title')} side="right" size="sm">
        <ManageCategoriesInline businessId={event.businessId} categories={categories} canManage={canManage} onChanged={onCategoriesChanged} />
      </Sheet>
    </div>
  );
}

function ManageCategoriesInline({
  businessId,
  categories,
  canManage,
  onChanged,
}: {
  businessId: Id;
  categories: EventCategory[];
  canManage: boolean;
  onChanged: () => void;
}) {
  const t = useT('resources');
  const toast = useToast();
  const [name, setName] = useState('');
  const [colorIndex, setColorIndex] = useState(1);
  const create = useApiMutation(() => createEventCategory(businessId, name, colorIndex));
  const remove = useApiMutation((id: Id) => deleteEventCategory(id));

  return (
    <div data-f="F-16-043" className="flex flex-col gap-4">
      {categories.length === 0 ? (
        <p className="text-sm text-muted">{t('categories.emptyText')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {categories.map((c) => (
            <li key={c.id} className="flex min-h-10 items-center gap-2 rounded-lg border border-border px-3 py-1.5">
              <ColorSwatch colorIndex={c.colorIndex} label={c.name} size="sm" />
              <span className="flex-1 text-sm text-fg">{c.name}</span>
              {canManage && (
                <IconButton
                  icon={<Trash2 aria-hidden />}
                  label={t('categories.delete')}
                  variant="ghost"
                  size="sm"
                  className="text-danger"
                  onClick={async () => {
                    try {
                      await remove.mutate(c.id);
                      onChanged();
                    } catch {
                      toast.error(t('form.saveFailed'));
                    }
                  }}
                />
              )}
            </li>
          ))}
        </ul>
      )}
      {canManage && (
        <div className="flex flex-col gap-3 border-t border-border pt-4">
          <FormField label={t('categories.form.name')}>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('categories.form.namePlaceholder')} />
          </FormField>
          <ColorPicker value={colorIndex} onValueChange={setColorIndex} label={t('categories.form.color')} />
          <Button
            disabled={!name.trim()}
            loading={create.isPending}
            leftIcon={<Plus aria-hidden className="size-4" />}
            onClick={async () => {
              try {
                await create.mutate(undefined);
                setName('');
                setColorIndex(1);
                onChanged();
              } catch {
                toast.error(t('form.saveFailed'));
              }
            }}
          >
            {t('categories.add')}
          </Button>
        </div>
      )}
    </div>
  );
}

const VISIT_STATUS_OPTIONS = ['awaiting_confirmation', 'client_confirmed', 'arrived', 'no_show'] as const;

function ParticipantRow({
  participant,
  expanded,
  onToggle,
  onRemove,
  onSchedule,
  format,
  canManage,
  businessId,
  serviceId,
  eventId,
  onChanged,
}: {
  participant: EventParticipant;
  expanded: boolean;
  onToggle: () => void;
  onRemove?: () => void;
  onSchedule?: () => void;
  format: ReturnType<typeof useFormat>;
  canManage: boolean;
  businessId: Id;
  serviceId: Id;
  eventId: Id;
  onChanged: () => void;
}) {
  const t = useT('resources');
  const tc = useT('common');
  const toast = useToast();
  // F-16-046: «Доступ к данным клиентов» скрывает телефон участника и в окне события, как в окне записи
  const canSeePhones = useCan('clients.phones');
  const { booking, client } = participant;
  const seats = Math.max(1, booking.services[0]?.qty ?? 1);
  const name = client?.name ?? booking.visitorName ?? t('event.clients.unknown');
  const [priceOpen, setPriceOpen] = useState(false);
  const [extrasOpen, setExtrasOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [pinned, setPinned] = useState(false);

  const extrasQ = useApiQuery(['resources', 'participant-extras', booking.id], () => listParticipantExtras(booking.id), { enabled: expanded });
  // F-16-062: настройка автосписания (loyalty F-06-127) применённая к этой брони — только если у участника есть клиент
  const autoChargeQ = useApiQuery(
    ['resources', 'auto-charge', booking.id],
    () => getBookingAutoCharge(businessId, booking.id, serviceId, client?.id),
    { enabled: expanded && Boolean(client?.id) },
  );
  // Не `client!.id`: React Compiler по «!» считает client не-null и выносит чтение поля в рендер.
  const clientId = client?.id;
  const chargeNow = useApiMutation(() => {
    if (!clientId) throw new Error('participant has no client');
    return chargeBookingAutoDebit(businessId, booking.id, serviceId, clientId);
  });

  const setStatus = useApiMutation((status: Booking['status']) => updateBooking(booking.id, { status }));
  const cancelPayment = useApiMutation(() => cancelParticipantPayment(booking.id));
  // «Оплачено»: наличные и карта теперь — настоящая оплата визита в финансах (метка участника), абонемент и «другое» —
  // как раньше, prepayment.paid
  const participantPaymentQ = useApiQuery(['resources', 'participant-payment', booking.id], () => getParticipantPayment(booking.id));
  const paid = Boolean(booking.prepayment?.paid || participantPaymentQ.data);

  return (
    <li data-f="F-01-196" className="rounded-lg border border-border bg-surface">
      <button type="button" onClick={onToggle} className="flex min-h-11 w-full items-center gap-3 px-3 py-2.5 text-left">
        {seats > 1 && (
          <Badge tone="neutral" variant="soft" size="sm">
            ×{seats}
          </Badge>
        )}
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-fg">{name}</span>
        {pinned && <Star aria-hidden className="size-3.5 shrink-0 fill-warning text-warning" />}
        {booking.visitorName && client && (
          <Badge tone="info" variant="soft" size="sm">
            {t('event.clients.visitorBadge')}
          </Badge>
        )}
        <BookingStatusBadge status={booking.status} size="sm" />
        <Badge tone={paid ? 'success' : 'neutral'} variant="soft" size="sm">
          {paid ? t('event.clients.paid') : booking.prepayment ? t('event.clients.unpaid') : t('event.clients.noPrepayment')}
        </Badge>
      </button>
      {expanded && (
        <div
          data-f="F-16-046 F-16-051 F-16-052 F-16-053 F-16-054 F-16-057 F-16-058 F-16-059 F-16-060 F-16-061 F-16-098 F-16-099 F-16-100 F-16-063 F-08-069 F-01-196 F-01-197 F-01-218 F-07-048 F-04-098"
          className="flex flex-col gap-4 border-t border-border px-3 py-3 text-sm"
        >
          {/* F-16-058: панель клиента — контакты, «⋯» с историей/лояльностью/счетами, звёздочка */}
          <div className="flex flex-col gap-2 rounded-lg bg-surface-2 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium text-fg">{name}</p>
                <p className="text-muted">{client?.phone ? (canSeePhones ? client.phone : maskPhone(client.phone)) : '—'}</p>
              </div>
              {client?.id && canSeePhones && (
                <div className="flex shrink-0 items-center gap-1">
                  <IconButton
                    icon={<Star aria-hidden className={pinned ? 'fill-warning text-warning' : undefined} />}
                    label={pinned ? t('event.clients.unpin') : t('event.clients.pin')}
                    variant="ghost"
                    size="sm"
                    onClick={() => setPinned((v) => !v)}
                  />
                  <DropdownMenu
                    trigger={(props) => (
                      <IconButton {...props} icon={<MoreHorizontal aria-hidden />} label={t('event.clients.more')} variant="ghost" size="sm" />
                    )}
                    items={[
                      { id: 'history', label: t('event.clients.history'), href: `/biz/clients/${client.id}` },
                      { id: 'loyalty', label: t('event.clients.loyalty'), href: `/biz/clients/${client.id}` },
                      { id: 'invoices', label: t('event.clients.invoices'), href: `/biz/clients/${client.id}` },
                    ]}
                  />
                </div>
              )}
            </div>
            {client?.phone && canSeePhones && (
              <div className="grid grid-cols-2 gap-2">
                <a
                  href={telLink(client.phone)}
                  className="flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-border-strong text-sm font-medium text-fg"
                >
                  <Phone aria-hidden className="size-4" /> {t('event.clients.call')}
                </a>
                <a
                  href={waLink(client.phone, t('event.clients.waGreeting', { name }))}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-border-strong text-sm font-medium text-fg"
                >
                  WhatsApp
                </a>
              </div>
            )}
          </div>

          <p className="text-muted">
            {t('event.clients.createdAt')}: {format.date(booking.createdAt, 'short')} {format.time(booking.createdAt)}
          </p>
          {booking.comment && (
            <p className="text-muted">
              {t('event.clients.comment')}: {booking.comment}
            </p>
          )}

          {/* F-16-052: статус визита участника, не трогает других */}
          {canManage && (
            <FormField label={t('event.clients.status')} className="max-w-xs">
              <Select
                value={
                  VISIT_STATUS_OPTIONS.includes(booking.status as (typeof VISIT_STATUS_OPTIONS)[number]) ? booking.status : 'awaiting_confirmation'
                }
                onValueChange={async (v) => {
                  try {
                    await setStatus.mutate(v as Booking['status']);
                    toast.success(t('event.clients.statusChanged'));
                    onChanged();
                  } catch {
                    toast.error(t('form.saveFailed'));
                  }
                }}
                options={VISIT_STATUS_OPTIONS.map((s) => ({ value: s, label: tc(`bookingStatus.${s}`) }))}
              />
            </FormField>
          )}

          {/* F-16-059: товары/абонементы/сертификаты, проданные участнику */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="font-medium text-fg">{t('event.clients.addExtra')}</span>
              {canManage && (
                <Button size="sm" variant="ghost" leftIcon={<ShoppingBag aria-hidden className="size-4" />} onClick={() => setExtrasOpen(true)}>
                  {t('event.clients.addExtra')}
                </Button>
              )}
            </div>
            {extrasQ.isLoading ? (
              <Skeleton lines={1} />
            ) : (extrasQ.data ?? []).length === 0 ? (
              <p className="text-muted">{t('event.clients.extrasEmpty')}</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {(extrasQ.data ?? []).map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-2 rounded-lg border border-border px-2.5 py-1.5">
                    <span className="min-w-0 flex-1 truncate text-fg">{item.name}</span>
                    <span className="tabular-nums text-muted">{format.money(item.price)}</span>
                    {canManage && (
                      <IconButton
                        icon={<Trash2 aria-hidden className="size-3.5" />}
                        label={t('event.clients.extraRemove')}
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          await removeParticipantExtra(booking.id, item.id);
                          extrasQ.refetch();
                        }}
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* F-16-060/061: быстрая оплата — деньги не принимаем, только фиксируем способ */}
          {canManage && (
            <div className="flex flex-col gap-2">
              <span className="font-medium text-fg">{t('event.clients.payment')}</span>
              {paid ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="success" variant="soft" icon={<Wallet aria-hidden className="size-3.5" />}>
                    {t('event.clients.paid')}
                  </Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={cancelPayment.isPending}
                    onClick={async () => {
                      try {
                        await cancelPayment.mutate(undefined);
                        toast.success(t('event.clients.paymentCancelled'));
                        onChanged();
                      } catch {
                        toast.error(t('form.saveFailed'));
                      }
                    }}
                  >
                    {t('event.clients.cancelPayment')}
                  </Button>
                </div>
              ) : (
                <PayButtons bookingId={booking.id} onPaid={onChanged} />
              )}
            </div>
          )}

          {autoChargeQ.data?.applicable && (
            <div data-f="F-16-062" className="flex flex-col gap-2">
              <span className="font-medium text-fg">{t('event.clients.autoCharge')}</span>
              <div className="flex flex-wrap items-center gap-2">
                {autoChargeQ.data.status === 'charged' ? (
                  <Badge tone="success" variant="soft">
                    {t('event.clients.autoChargeCharged')}
                  </Badge>
                ) : autoChargeQ.data.status === 'not_charged' ? (
                  <Badge tone="danger" variant="soft">
                    {t('event.clients.autoChargeNotCharged')}
                  </Badge>
                ) : (
                  <Badge tone="neutral" variant="soft">
                    {t('event.clients.autoChargePending')}
                  </Badge>
                )}
                {canManage && autoChargeQ.data.status === 'pending' && (
                  <Button
                    size="sm"
                    variant="outline"
                    loading={chargeNow.isPending}
                    onClick={async () => {
                      try {
                        await chargeNow.mutate(undefined);
                        autoChargeQ.refetch();
                      } catch {
                        toast.error(t('form.saveFailed'));
                      }
                    }}
                  >
                    {t('event.clients.autoChargeNow')}
                  </Button>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2 border-t border-border pt-3">
            {onSchedule && (
              <Button size="sm" variant="outline" leftIcon={<CalendarPlus aria-hidden className="size-4" />} onClick={onSchedule}>
                {t('event.clients.schedule')}
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => setPriceOpen(true)}>
              {t('event.clients.editComment')}
            </Button>
            {canManage && (
              <span data-f="F-16-055">
                <Button size="sm" variant="outline" leftIcon={<ArrowRightLeft aria-hidden className="size-4" />} onClick={() => setTransferOpen(true)}>
                  {t('event.clients.transfer')}
                </Button>
              </span>
            )}
            {onRemove && (
              <span data-f="F-16-056">
                <IconButton
                  icon={<Trash2 aria-hidden />}
                  label={t('event.clients.remove')}
                  variant="ghost"
                  size="sm"
                  className="text-danger"
                  onClick={onRemove}
                />
              </span>
            )}
          </div>
          <p className="text-xs text-muted">{t('event.clients.cannotChangeHint')}</p>
        </div>
      )}
      <EditParticipantSheet open={priceOpen} onOpenChange={setPriceOpen} booking={booking} format={format} onSaved={onChanged} />
      <AddExtraSheet
        open={extrasOpen}
        onOpenChange={setExtrasOpen}
        onSubmit={async (args) => {
          await addParticipantExtra(booking.id, args.kind, args.name, args.price);
          extrasQ.refetch();
          setExtrasOpen(false);
        }}
      />
      <TransferSheet
        open={transferOpen}
        onOpenChange={setTransferOpen}
        serviceId={serviceId}
        excludeEventId={eventId}
        format={format}
        onSubmit={async (targetEventId) => {
          try {
            await transferParticipant(booking.id, targetEventId);
            toast.success(t('event.clients.transferred'));
            setTransferOpen(false);
            onChanged();
          } catch (e) {
            toast.error(e instanceof ApiError && e.code === 'group_full' ? t('event.clients.transferFull') : t('form.saveFailed'));
          }
        }}
      />
    </li>
  );
}

function PayButtons({ bookingId, onPaid }: { bookingId: Id; onPaid: () => void }) {
  const t = useT('resources');
  const toast = useToast();
  const pay = useApiMutation((method: ParticipantPaymentMethod) => payParticipant(bookingId, method));
  const methods: { id: ParticipantPaymentMethod; label: string; icon?: typeof Wallet }[] = [
    { id: 'membership', label: t('event.clients.payMembership') },
    { id: 'card', label: t('event.clients.payCard') },
    { id: 'cash', label: t('event.clients.payCash') },
    { id: 'other', label: t('event.clients.payOther') },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" data-f="F-06-072">
      {methods.map((m) => (
        <Button
          key={m.id}
          size="sm"
          variant="outline"
          loading={pay.isPending}
          onClick={async () => {
            try {
              await pay.mutate(m.id);
              toast.success(t('event.clients.paymentDone'));
              onPaid();
            } catch (e) {
              toast.error(e instanceof ApiError && e.code === 'no_membership' ? t('event.clients.noMembership') : t('form.saveFailed'));
            }
          }}
        >
          {m.label}
        </Button>
      ))}
    </div>
  );
}

/**
 * F-16-053/054/057/098: у отдельного участника меняются только цена, скидка и комментарий — не услуга, сотрудник,
 * ресурсы, дата, время (ТЗ прямо это разводит). Пишет саму бронь (Booking), не событие — не наш путь по сущности, но
 * действие открыто из НАШЕГО экрана события, поэтому вызов из resources.
 */
function EditParticipantSheet({
  open,
  onOpenChange,
  booking,
  format,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  booking: Booking;
  format: ReturnType<typeof useFormat>;
  onSaved: () => void;
}) {
  const t = useT('resources');
  const toast = useToast();
  const line = booking.services[0];
  const [comment, setComment] = useState(booking.comment ?? '');
  const [price, setPrice] = useState<number | undefined>(line?.unitPrice ?? line?.price ?? 0);
  const [discountPct, setDiscountPct] = useState(line?.discountPct ?? 0);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setComment(booking.comment ?? '');
      setPrice(line?.unitPrice ?? line?.price ?? 0);
      setDiscountPct(line?.discountPct ?? 0);
    }
  }
  const commentTooLong = comment.length > PARTICIPANT_COMMENT_MAX;
  const unit = price ?? 0;
  const qty = Math.max(1, line?.qty ?? 1);
  const finalUnit = Math.round(unit * (1 - Math.max(0, Math.min(100, discountPct)) / 100));
  const total = finalUnit * qty;

  const save = useApiMutation(() => {
    const nextServices = line
      ? [{ ...line, price: finalUnit, unitPrice: unit, discountPct: discountPct || undefined }, ...booking.services.slice(1)]
      : booking.services;
    const nextTotal = nextServices.reduce((sum, l) => sum + l.price * l.qty, 0);
    return updateBooking(booking.id, { comment: comment.trim() || undefined, services: nextServices, total: nextTotal });
  });

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('event.clients.editComment')}
      side="right"
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('form.cancel')}
          </Button>
          <Button
            disabled={commentTooLong}
            loading={save.isPending}
            onClick={async () => {
              try {
                await save.mutate(undefined);
                toast.success(t('form.updated'));
                onSaved();
                onOpenChange(false);
              } catch {
                toast.error(t('form.saveFailed'));
              }
            }}
          >
            {t('event.form.save')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {line && (
          <>
            <FormField label={t('event.clients.price')}>
              <MoneyInput value={price} onValueChange={setPrice} />
            </FormField>
            <FormField label={t('event.clients.discount')} className="max-w-[10rem]">
              <Input
                type="number"
                min={0}
                max={100}
                value={discountPct}
                onChange={(e) => setDiscountPct(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
              />
            </FormField>
            <p className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2 text-sm">
              <span className="text-muted">{t('event.clients.total')}</span>
              <span className="font-semibold tabular-nums text-fg">{format.money(total)}</span>
            </p>
          </>
        )}
        <FormField
          label={t('event.clients.commentLabel')}
          optional
          error={commentTooLong ? t('event.clients.commentTooLong', { max: PARTICIPANT_COMMENT_MAX }) : undefined}
        >
          <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} maxLength={PARTICIPANT_COMMENT_MAX} />
        </FormField>
        <p className="-mt-3 text-right text-xs text-muted">
          {comment.length}/{PARTICIPANT_COMMENT_MAX}
        </p>
      </div>
    </Sheet>
  );
}

function AddExtraSheet({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (args: { kind: ParticipantExtraKind; name: string; price: number }) => void | Promise<void>;
}) {
  const t = useT('resources');
  const [kind, setKind] = useState<ParticipantExtraKind>('product');
  const [name, setName] = useState('');
  const [price, setPrice] = useState<number | undefined>(0);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setKind('product');
      setName('');
      setPrice(0);
    }
  }
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('event.clients.addExtra')}
      side="right"
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('form.cancel')}
          </Button>
          <Button disabled={!name.trim()} onClick={() => onSubmit({ kind, name: name.trim(), price: price ?? 0 })}>
            {t('event.clients.extraAdded')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <FormField label={t('event.clients.extraKind')}>
          <Select
            value={kind}
            onValueChange={(v) => setKind(v as ParticipantExtraKind)}
            options={[
              { value: 'product', label: t('event.clients.extraKindProduct') },
              { value: 'membership', label: t('event.clients.extraKindMembership') },
              { value: 'certificate', label: t('event.clients.extraKindCertificate') },
            ]}
          />
        </FormField>
        <FormField label={t('event.clients.extraName')} required>
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={t('event.clients.extraNamePlaceholder')} />
        </FormField>
        <FormField label={t('event.clients.extraPrice')}>
          <MoneyInput value={price} onValueChange={setPrice} />
        </FormField>
      </div>
    </Sheet>
  );
}

/** F-16-055: перенос брони — только на другие будущие события ТОЙ ЖЕ услуги, заполненные исключены API-проверкой */
function TransferSheet({
  open,
  onOpenChange,
  serviceId,
  excludeEventId,
  format,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  serviceId: Id;
  excludeEventId: Id;
  format: ReturnType<typeof useFormat>;
  onSubmit: (targetEventId: Id) => void | Promise<void>;
}) {
  const t = useT('resources');
  const targetsQ = useApiQuery(['resources', 'transfer-targets', serviceId, excludeEventId], () => listTransferTargets(serviceId, excludeEventId), {
    enabled: open,
  });
  const targets = targetsQ.data ?? [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={t('event.clients.transferTitle')} side="right" size="sm">
      {targetsQ.isLoading ? (
        <Skeleton lines={3} />
      ) : targets.length === 0 ? (
        <EmptyState compact icon={<ArrowRightLeft aria-hidden />} title={t('event.clients.transferTargetsEmpty')} />
      ) : (
        <ul className="flex flex-col gap-2">
          {targets.map((e) => (
            <li key={e.id} className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
              <span className="text-sm text-fg">
                {format.date(e.start, 'short')} · {format.time(e.start)}
              </span>
              <Button size="sm" onClick={() => onSubmit(e.id)}>
                {t('event.clients.transferConfirm')}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}

function AddParticipantSheet({
  open,
  onOpenChange,
  onSubmit,
  pending,
  maxSeats,
  allowMultiSeat,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (args: { name: string; phone: string; seats: number; visitorName?: string; comment?: string }) => void | Promise<void>;
  pending: boolean;
  maxSeats: number;
  allowMultiSeat: boolean;
}) {
  const t = useT('resources');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [seats, setSeats] = useState(1);
  const [isVisitor, setIsVisitor] = useState(false);
  const [visitorName, setVisitorName] = useState('');
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);

  // Очистить форму при каждом новом открытии — правкой состояния во время рендера (arch: тот же приём,
  // что при загрузке черновика из запроса), а не useEffect
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setName('');
      setPhone('');
      setSeats(1);
      setIsVisitor(false);
      setVisitorName('');
      setComment('');
      setError(undefined);
    }
  }

  const submit = () => {
    if (!name.trim() || !phone) {
      setError(t('event.clients.required'));
      return;
    }
    if (isVisitor && !visitorName.trim()) {
      setError(t('event.clients.visitorNameRequired'));
      return;
    }
    void onSubmit({ name: name.trim(), phone, seats, visitorName: isVisitor ? visitorName.trim() : undefined, comment: comment.trim() || undefined });
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('event.clients.add')}
      side="right"
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('form.cancel')}
          </Button>
          <Button loading={pending} onClick={submit}>
            {t('event.clients.add')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <FormField label={t('event.clients.name')} error={error && !name.trim() ? error : undefined} required>
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={t('event.clients.namePlaceholder')} />
        </FormField>
        <FormField label={t('event.clients.phoneLabel')} error={error && !phone ? error : undefined} required>
          <PhoneInput value={phone} onValueChange={setPhone} />
        </FormField>
        {allowMultiSeat && (
          <FormField label={t('event.clients.seats')}>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={() => setSeats((s) => Math.max(1, s - 1))} aria-label={t('event.form.capacityMinus')}>
                −
              </Button>
              <span className="w-8 text-center text-base font-semibold tabular-nums text-fg">{seats}</span>
              <Button
                variant="outline"
                size="sm"
                disabled={seats >= maxSeats}
                onClick={() => setSeats((s) => Math.min(maxSeats, s + 1))}
                aria-label={t('event.form.capacityPlus')}
              >
                +
              </Button>
            </div>
          </FormField>
        )}
        <div data-f="F-16-050" className="flex flex-col gap-3">
          <Checkbox checked={isVisitor} onCheckedChange={setIsVisitor} label={t('event.clients.isVisitor')} />
          {isVisitor && (
            <FormField label={t('event.clients.visitorName')} error={error && !visitorName.trim() ? error : undefined} required>
              <Input value={visitorName} onChange={(e) => setVisitorName(e.target.value)} placeholder={t('event.clients.visitorNamePlaceholder')} />
            </FormField>
          )}
        </div>
        <FormField label={t('event.clients.commentLabel')} optional>
          <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} maxLength={PARTICIPANT_COMMENT_MAX} />
        </FormField>
      </div>
    </Sheet>
  );
}

// ─────────────────────────── Повтор (F-16-064, F-16-065, F-16-101) ───────────────────────────

function RepeatPanel({
  event,
  templates,
  onCreated,
}: {
  event: GroupEvent;
  templates: { id: Id; name: string; freq: RepeatFreq; weekIntervalWeeks?: number }[];
  onCreated: () => void;
}) {
  const t = useT('resources');
  const toast = useToast();
  const canManage = useCan('resources.manage');

  const [templateId, setTemplateId] = useState('new');
  const [freq, setFreq] = useState<RepeatFreq>('weekly');
  const [weekIntervalWeeks, setWeekIntervalWeeks] = useState(1);
  const [startDate, setStartDate] = useState(addDays(event.start.slice(0, 10), 1));
  const [endMode, setEndMode] = useState<'count' | 'date'>('count');
  const [count, setCount] = useState(4);
  const [endDate, setEndDate] = useState(addDays(event.start.slice(0, 10), 60));
  const [withClients, setWithClients] = useState(false);
  const [saveTemplate, setSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');

  const run = useApiMutation(() =>
    repeatEvent({
      eventId: event.id,
      freq,
      weekIntervalWeeks: freq === 'weekly' ? weekIntervalWeeks : undefined,
      startDate,
      end: endMode === 'count' ? { kind: 'count', count } : { kind: 'date', date: endDate },
      withClients,
      saveAsTemplateName: saveTemplate ? templateName : undefined,
    }),
  );

  if (event.seriesId) {
    return (
      <SectionCard title={t('event.tabs.repeat')}>
        <EmptyState compact icon={<Repeat aria-hidden />} title={t('repeat.partOfSeries')} description={t('repeat.goToSchedule')} />
      </SectionCard>
    );
  }

  return (
    <div data-f="F-16-064 F-16-065 F-16-101 F-01-108 F-01-216">
      <SectionCard title={t('event.tabs.repeat')} description={t('repeat.description')} classNames={{ body: 'flex flex-col gap-5' }}>
        <FormField label={t('repeat.template')}>
          <Select
            disabled={!canManage}
            value={templateId}
            onValueChange={(v) => {
              setTemplateId(v);
              const tpl = templates.find((x) => x.id === v);
              if (tpl) {
                setFreq(tpl.freq);
                if (tpl.weekIntervalWeeks) setWeekIntervalWeeks(tpl.weekIntervalWeeks);
              }
            }}
            options={[{ value: 'new', label: t('repeat.newTemplate') }, ...templates.map((tpl) => ({ value: tpl.id, label: tpl.name }))]}
          />
        </FormField>
        <div className="flex flex-col gap-4 sm:flex-row">
          <FormField label={t('repeat.freqLabel')} className="flex-1">
            <Select
              disabled={!canManage}
              value={freq}
              onValueChange={(v) => setFreq(v as RepeatFreq)}
              options={REPEAT_FREQS.map((f) => ({ value: f, label: t(`repeat.freq.${f}`) }))}
            />
          </FormField>
          {freq === 'weekly' && (
            <FormField label={t('repeat.everyWeeks')} className="flex-1">
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!canManage}
                  onClick={() => setWeekIntervalWeeks((n) => Math.max(1, n - 1))}
                  aria-label={t('event.form.capacityMinus')}
                >
                  −
                </Button>
                <span className="w-8 text-center text-base font-semibold tabular-nums text-fg">{weekIntervalWeeks}</span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!canManage}
                  onClick={() => setWeekIntervalWeeks((n) => n + 1)}
                  aria-label={t('event.form.capacityPlus')}
                >
                  +
                </Button>
              </div>
            </FormField>
          )}
          <FormField label={t('repeat.startDate')} className="flex-1">
            <DatePicker disabled={!canManage} value={startDate} onValueChange={(d) => d && setStartDate(d)} />
          </FormField>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-fg">{t('repeat.end')}</span>
          <Radio
            name="repeat-end"
            label={t('repeat.endByCount')}
            checked={endMode === 'count'}
            onChange={() => setEndMode('count')}
            disabled={!canManage}
          />
          {endMode === 'count' && (
            <div className="ml-8 flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                disabled={!canManage}
                onClick={() => setCount((n) => Math.max(1, n - 1))}
                aria-label={t('event.form.capacityMinus')}
              >
                −
              </Button>
              <span className="w-10 text-center text-base font-semibold tabular-nums text-fg">{count}</span>
              <Button
                variant="outline"
                size="sm"
                disabled={!canManage}
                onClick={() => setCount((n) => n + 1)}
                aria-label={t('event.form.capacityPlus')}
              >
                +
              </Button>
            </div>
          )}
          <Radio
            name="repeat-end"
            label={t('repeat.endByDate')}
            checked={endMode === 'date'}
            onChange={() => setEndMode('date')}
            disabled={!canManage}
          />
          {endMode === 'date' && (
            <div className="ml-8">
              <DatePicker disabled={!canManage} value={endDate} onValueChange={(d) => d && setEndDate(d)} />
            </div>
          )}
        </div>

        <Checkbox disabled={!canManage} checked={withClients} onCheckedChange={setWithClients} label={t('repeat.withClients')} />

        <div className="flex flex-col gap-2 border-t border-border pt-4">
          <Checkbox disabled={!canManage} checked={saveTemplate} onCheckedChange={setSaveTemplate} label={t('repeat.saveTemplate')} />
          {saveTemplate && (
            <Input value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder={t('repeat.templateNamePlaceholder')} />
          )}
        </div>

        {canManage && (
          <div className="flex justify-end">
            <Button
              loading={run.isPending}
              leftIcon={<Repeat aria-hidden className="size-4" />}
              onClick={async () => {
                try {
                  const result = await run.mutate(undefined);
                  toast.success(t('repeat.created', { count: result.createdCount }));
                  onCreated();
                } catch {
                  toast.error(t('form.saveFailed'));
                }
              }}
            >
              {t('repeat.submit')}
            </Button>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

// ─────────────────────────── Расписание — серия (F-16-067…077) ───────────────────────────

type SeriesDayFormRule = SeriesDayRule;

function defaultDayRule(event: GroupEvent, weekday: number): SeriesDayFormRule {
  return {
    weekday: weekday as SeriesDayRule['weekday'],
    startTime: event.start.slice(11, 16),
    durationMin: event.durationMin,
    resourceIds: event.resourceIds,
  };
}

function DayRuleFields({
  rule,
  resourceOptions,
  disabled,
  onChange,
}: {
  rule: SeriesDayFormRule;
  resourceOptions: { id: string; label: string; description?: string }[];
  disabled?: boolean;
  onChange: (rule: SeriesDayFormRule) => void;
}) {
  const t = useT('resources');
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <FormField label={t('event.form.time')} className="flex-1">
        <TimePicker disabled={disabled} value={rule.startTime} onValueChange={(v) => onChange({ ...rule, startTime: v })} />
      </FormField>
      <FormField label={t('event.form.duration')} className="flex-1">
        <Select
          disabled={disabled}
          options={DURATION_OPTIONS.map((m) => ({ value: String(m), label: t('event.form.durationOption', { m }) }))}
          value={String(rule.durationMin)}
          onValueChange={(v) => onChange({ ...rule, durationMin: Number(v) })}
        />
      </FormField>
      <FormField label={t('bookingWindow.title')} className="flex-[2]">
        <EntityMultiPicker
          disabled={disabled}
          options={resourceOptions}
          value={rule.resourceIds}
          onValueChange={(ids) => onChange({ ...rule, resourceIds: ids })}
          title={t('bookingWindow.title')}
          placeholder={t('bookingWindow.placeholder')}
          searchPlaceholder={t('form.servicesSearch')}
          emptyText={t('form.servicesEmpty')}
        />
      </FormField>
    </div>
  );
}

function CreateSeriesForm({
  event,
  resourceOptions,
  canManage,
  hasParticipants,
  onCreated,
}: {
  event: GroupEvent;
  resourceOptions: { id: string; label: string; description?: string }[];
  canManage: boolean;
  hasParticipants: boolean;
  onCreated: () => void;
}) {
  const t = useT('resources');
  const format = useFormat();
  const toast = useToast();
  const weekdayNames = format.weekdaysShort();

  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [perDay, setPerDay] = useState<Record<number, SeriesDayFormRule>>({});
  const [endDate, setEndDate] = useState(addDays(event.start.slice(0, 10), 60));
  const [addClientsFromSource, setAddClientsFromSource] = useState(false);

  const toggleWeekday = (next: number[]) => {
    setWeekdays(next);
    setPerDay((prev) => {
      const nextMap = { ...prev };
      for (const wd of next) if (!nextMap[wd]) nextMap[wd] = defaultDayRule(event, wd);
      for (const wd of Object.keys(nextMap).map(Number)) if (!next.includes(wd)) delete nextMap[wd];
      return nextMap;
    });
  };

  const create = useApiMutation(() =>
    createEventSeries({ sourceEventId: event.id, days: weekdays.map((wd) => perDay[wd]), endDate, addClientsFromSource }),
  );

  return (
    <SectionCard title={t('schedule.createTitle')} description={t('schedule.createDescription')} classNames={{ body: 'flex flex-col gap-5' }}>
      <FormField label={t('schedule.weekdays')}>
        <WeekdayPicker presets={false} disabled={!canManage} value={weekdays} onValueChange={toggleWeekday} />
      </FormField>

      {weekdays.length > 0 && (
        <div className="flex flex-col gap-4">
          {[...weekdays]
            .sort((a, b) => a - b)
            .map((wd) => (
              <div key={wd} className="rounded-lg border border-border p-3">
                <p className="mb-2 text-sm font-semibold text-fg">{weekdayNames[wd]}</p>
                <DayRuleFields
                  rule={perDay[wd] ?? defaultDayRule(event, wd)}
                  resourceOptions={resourceOptions}
                  disabled={!canManage}
                  onChange={(rule) => setPerDay((prev) => ({ ...prev, [wd]: rule }))}
                />
              </div>
            ))}
        </div>
      )}

      <FormField label={t('schedule.endDate')}>
        <DatePicker disabled={!canManage} value={endDate} onValueChange={(d) => d && setEndDate(d)} />
      </FormField>

      {hasParticipants && (
        <Checkbox
          disabled={!canManage}
          checked={addClientsFromSource}
          onCheckedChange={setAddClientsFromSource}
          label={t('schedule.addClientsFromSource')}
        />
      )}

      {canManage && (
        <div className="flex justify-end">
          <Button
            disabled={weekdays.length === 0}
            loading={create.isPending}
            leftIcon={<CalendarClock aria-hidden className="size-4" />}
            onClick={async () => {
              try {
                const result = await create.mutate(undefined);
                toast.success(t('schedule.created', { count: result.createdCount }));
                onCreated();
              } catch {
                toast.error(t('form.saveFailed'));
              }
            }}
          >
            {t('schedule.submit')}
          </Button>
        </div>
      )}
    </SectionCard>
  );
}

function SeriesManagePanel({
  event,
  isPast,
  seriesDef,
  resourceOptions,
  canManage,
  onChanged,
}: {
  event: GroupEvent;
  isPast: boolean;
  seriesDef: { id: Id; days: SeriesDayRule[]; endDate: string; uniqueEventIds: Id[] };
  resourceOptions: { id: string; label: string; description?: string }[];
  canManage: boolean;
  onChanged: () => void;
}) {
  const t = useT('resources');
  const format = useFormat();
  const toast = useToast();
  const confirm = useConfirm();
  const weekdayNames = format.weekdaysShort();
  const router = useRouter();

  const [editWeekday, setEditWeekday] = useState<number | null>(null);
  const [addWeekday, setAddWeekday] = useState<number | null>(null);
  const [endDate, setEndDate] = useState(seriesDef.endDate);
  const [loadedEndFor, setLoadedEndFor] = useState(seriesDef.id);
  if (loadedEndFor !== seriesDef.id || endDate === '') {
    if (loadedEndFor !== seriesDef.id) {
      setEndDate(seriesDef.endDate);
      setLoadedEndFor(seriesDef.id);
    }
  }

  const usedWeekdays = new Set<number>(seriesDef.days.map((d) => d.weekday));
  const freeWeekdays = [0, 1, 2, 3, 4, 5, 6].filter((wd) => !usedWeekdays.has(wd));

  const removeDay = useApiMutation((weekday: SeriesDayRule['weekday']) => removeSeriesWeekday(seriesDef.id, weekday));
  const extendShorten = useApiMutation((date: string) => extendOrShortenSeries(seriesDef.id, date));
  const remove = useApiMutation(() => deleteSeries(seriesDef.id));

  const canEdit = canManage && !isPast;

  return (
    <div className="flex flex-col gap-5">
      <SectionCard title={t('schedule.daysTitle')}>
        <ul className="flex flex-col gap-2">
          {[...seriesDef.days]
            .sort((a, b) => a.weekday - b.weekday)
            .map((day) => (
              <li key={day.weekday} className="flex min-h-11 flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
                <span className="text-sm font-medium text-fg">{weekdayNames[day.weekday]}</span>
                <span className="text-sm text-muted">
                  {day.startTime} · {format.duration(day.durationMin)}
                </span>
                {canEdit && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEditWeekday(day.weekday)}>
                      {t('form.edit')}
                    </Button>
                    <IconButton
                      icon={<Trash2 aria-hidden />}
                      label={t('schedule.removeDay')}
                      variant="ghost"
                      size="sm"
                      className="text-danger"
                      onClick={async () => {
                        const ok = await confirm({
                          title: t('schedule.removeDayConfirmTitle', { day: weekdayNames[day.weekday] }),
                          description: t('schedule.removeDayConfirmText'),
                          tone: 'danger',
                        });
                        if (!ok) return;
                        try {
                          await removeDay.mutate(day.weekday);
                          toast.success(t('form.updated'));
                          onChanged();
                        } catch {
                          toast.error(t('form.saveFailed'));
                        }
                      }}
                    />
                  </div>
                )}
              </li>
            ))}
        </ul>
        {canEdit && freeWeekdays.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {freeWeekdays.map((wd) => (
              <Button key={wd} size="sm" variant="outline" leftIcon={<Plus aria-hidden className="size-3.5" />} onClick={() => setAddWeekday(wd)}>
                {weekdayNames[wd]}
              </Button>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title={t('schedule.endDate')}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <DatePicker disabled={!canEdit} value={endDate} onValueChange={(d) => d && setEndDate(d)} />
          </div>
          {canEdit && (
            <Button
              loading={extendShorten.isPending}
              disabled={endDate === seriesDef.endDate}
              onClick={async () => {
                try {
                  const result = await extendShorten.mutate(endDate);
                  toast.success(t('schedule.endDateSaved', { created: result.createdCount, cancelled: result.cancelledCount }));
                  onChanged();
                } catch (e) {
                  toast.error(e instanceof ApiError && e.code === 'invalid_end_date' ? t('schedule.endDateInvalid') : t('form.saveFailed'));
                }
              }}
            >
              {t('form.save')}
            </Button>
          )}
        </div>
      </SectionCard>

      {canEdit && (
        <Button
          variant="ghost"
          className="self-start text-danger"
          leftIcon={<Trash2 aria-hidden className="size-4" />}
          onClick={async () => {
            const ok = await confirm({
              title: t('schedule.deleteSeriesConfirmTitle'),
              description: t('schedule.deleteSeriesConfirmText'),
              tone: 'danger',
            });
            if (!ok) return;
            try {
              await remove.mutate(undefined);
              toast.success(t('schedule.seriesDeleted'));
              router.push('/biz/groups');
            } catch {
              toast.error(t('form.saveFailed'));
            }
          }}
        >
          {t('schedule.deleteSeries')}
        </Button>
      )}

      <ExitHold value={!isPast && editWeekday}>
        {(editWeekday) => (
        <SeriesDayEditSheet
          open
          onOpenChange={(v) => !v && setEditWeekday(null)}
          seriesId={seriesDef.id}
          rule={seriesDef.days.find((d) => d.weekday === editWeekday)!}
          resourceOptions={resourceOptions}
          isNew={false}
          onSaved={() => {
            setEditWeekday(null);
            onChanged();
          }}
        />
        )}
      </ExitHold>
      <ExitHold value={!isPast && addWeekday}>
        {(addWeekday) => (
        <SeriesDayEditSheet
          open
          onOpenChange={(v) => !v && setAddWeekday(null)}
          seriesId={seriesDef.id}
          rule={defaultDayRule(event, addWeekday)}
          resourceOptions={resourceOptions}
          isNew
          onSaved={() => {
            setAddWeekday(null);
            onChanged();
          }}
        />
        )}
      </ExitHold>
    </div>
  );
}

function SeriesDayEditSheet({
  open,
  onOpenChange,
  seriesId,
  rule,
  resourceOptions,
  isNew,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  seriesId: Id;
  rule: SeriesDayRule;
  resourceOptions: { id: string; label: string; description?: string }[];
  isNew: boolean;
  onSaved: () => void;
}) {
  const t = useT('resources');
  const format = useFormat();
  const toast = useToast();
  const [draft, setDraft] = useState<SeriesDayFormRule>(rule);
  const [applyToUnique, setApplyToUnique] = useState(false);

  const save = useApiMutation(async () => {
    if (isNew) await addSeriesWeekday(seriesId, draft);
    else
      await editSeriesDayRule(
        seriesId,
        rule.weekday,
        { startTime: draft.startTime, durationMin: draft.durationMin, resourceIds: draft.resourceIds },
        applyToUnique,
      );
  });

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={format.weekdaysShort()[rule.weekday]}
      side="right"
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('form.cancel')}
          </Button>
          <Button
            loading={save.isPending}
            onClick={async () => {
              try {
                await save.mutate(undefined);
                toast.success(t('form.updated'));
                onSaved();
              } catch {
                toast.error(t('form.saveFailed'));
              }
            }}
          >
            {t('form.save')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <DayRuleFields rule={draft} resourceOptions={resourceOptions} onChange={setDraft} />
        {!isNew && <Checkbox checked={applyToUnique} onCheckedChange={setApplyToUnique} label={t('schedule.applyToUnique')} />}
      </div>
    </Sheet>
  );
}

function SchedulePanel({
  event,
  isPast,
  seriesDef,
  seriesDefLoading,
  resourceOptions,
  canManage,
  hasParticipants,
  onChanged,
}: {
  event: GroupEvent;
  isPast: boolean;
  seriesDef: { id: Id; days: SeriesDayRule[]; endDate: string; uniqueEventIds: Id[] } | undefined;
  seriesDefLoading: boolean;
  resourceOptions: { id: string; label: string; description?: string }[];
  canManage: boolean;
  hasParticipants: boolean;
  onChanged: () => void;
}) {
  const t = useT('resources');

  if (!event.seriesId) {
    return (
      <div data-f="F-16-067 F-01-198">
        <CreateSeriesForm
          event={event}
          resourceOptions={resourceOptions}
          canManage={canManage}
          hasParticipants={hasParticipants}
          onCreated={onChanged}
        />
      </div>
    );
  }
  if (seriesDefLoading || !seriesDef) {
    return (
      <SectionCard title={t('event.tabs.schedule')}>
        <Skeleton lines={4} />
      </SectionCard>
    );
  }
  return (
    <div data-f="F-16-068 F-16-069 F-16-070 F-16-071 F-16-072 F-16-073 F-16-074 F-16-075 F-16-076 F-01-198">
      {isPast && <p className="mb-3 text-sm text-muted">{t('schedule.pastEventNote')}</p>}
      <SeriesManagePanel
        event={event}
        isPast={isPast}
        seriesDef={seriesDef}
        resourceOptions={resourceOptions}
        canManage={canManage}
        onChanged={onChanged}
      />
    </div>
  );
}

// ─────────────────────────── Присоединиться / Уведомления (F-16-081…083) ───────────────────────────

function JoinPanel({
  eventId,
  join,
  loading,
  canManage,
  onSaved,
}: {
  eventId: Id;
  join: { url: string; instructions: string } | undefined;
  loading: boolean;
  canManage: boolean;
  onSaved: () => void;
}) {
  const t = useT('resources');
  const toast = useToast();
  const [url, setUrl] = useState('');
  const [instructions, setInstructions] = useState('');
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  if (!loading && loadedFor !== eventId) {
    setUrl(join?.url ?? '');
    setInstructions(join?.instructions ?? '');
    setLoadedFor(eventId);
  }

  const save = useApiMutation(() => saveEventJoin(eventId, { url, instructions }));

  if (loading) {
    return (
      <SectionCard title={t('event.tabs.join')}>
        <Skeleton lines={3} />
      </SectionCard>
    );
  }

  return (
    <SectionCard title={t('event.tabs.join')} description={t('join.description')} classNames={{ body: 'flex flex-col gap-4' }}>
      <div data-f="F-16-081 F-01-199 F-05-041" className="flex flex-col gap-4">
        <FormField label={t('join.url')}>
          <Input disabled={!canManage} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
        </FormField>
        <FormField label={t('join.instructions')} optional>
          <Textarea
            disabled={!canManage}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={4}
            placeholder={t('join.instructionsPlaceholder')}
          />
        </FormField>
        {canManage && (
          <div className="flex justify-end">
            <Button
              leftIcon={<Link2 aria-hidden className="size-4" />}
              loading={save.isPending}
              onClick={async () => {
                try {
                  await save.mutate(undefined);
                  toast.success(t('form.updated'));
                  onSaved();
                } catch {
                  toast.error(t('form.saveFailed'));
                }
              }}
            >
              {t('form.save')}
            </Button>
          </div>
        )}
      </div>
    </SectionCard>
  );
}

function NotifyPanel({
  eventId,
  join,
  loading,
  participantsCount,
  canManage,
  onSent,
}: {
  eventId: Id;
  join: { url: string; instructions: string; sentAt: string[] } | undefined;
  loading: boolean;
  participantsCount: number;
  canManage: boolean;
  onSent: () => void;
}) {
  const t = useT('resources');
  const format = useFormat();
  const toast = useToast();
  const send = useApiMutation(() => sendEventJoinNotifications(eventId));
  const hasUrl = Boolean(join?.url);
  const sentAt = join?.sentAt ?? [];

  if (loading) {
    return (
      <SectionCard title={t('event.tabs.notify')}>
        <Skeleton lines={3} />
      </SectionCard>
    );
  }

  return (
    <div data-f="F-16-082 F-16-083 F-05-041">
      <SectionCard title={t('event.tabs.notify')} description={t('notify.description')} classNames={{ body: 'flex flex-col gap-4' }}>
        {!hasUrl ? (
          <EmptyState compact icon={<Send aria-hidden />} title={t('notify.noLink')} />
        ) : (
          <>
            <p className="text-sm text-muted">{t('notify.willNotify', { count: participantsCount })}</p>
            {canManage && (
              <Button
                leftIcon={<Send aria-hidden className="size-4" />}
                loading={send.isPending}
                onClick={async () => {
                  try {
                    const result = await send.mutate(undefined);
                    toast.success(t('notify.sent', { count: result.notifiedCount }));
                    onSent();
                  } catch {
                    toast.error(t('form.saveFailed'));
                  }
                }}
                className="self-start"
              >
                {sentAt.length > 0 ? t('notify.resend') : t('notify.send')}
              </Button>
            )}
            {sentAt.length > 0 && (
              <ul className="flex flex-col gap-1 text-sm text-muted">
                {sentAt.map((s, i) => (
                  <li key={i}>{`${format.date(s, 'short')} ${format.time(s)}`}</li>
                ))}
              </ul>
            )}
          </>
        )}
      </SectionCard>
    </div>
  );
}

// ─────────────────────────── Расписание посещений клиента (F-16-078…080) ───────────────────────────

function VisitScheduleSheet({
  open,
  onOpenChange,
  client,
  seriesId,
  seriesDays,
  existing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  client: { phone: string; name: string; clientId?: Id } | null;
  seriesId: Id;
  seriesDays: SeriesDayRule[];
  existing: { id: Id; clientPhone: string; weekdays: number[] }[];
  onSaved: () => void;
}) {
  const t = useT('resources');
  const format = useFormat();
  const toast = useToast();
  const weekdayNames = format.weekdaysShort();
  const entry = client ? existing.find((e) => e.clientPhone === client.phone) : undefined;

  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const key = client ? `${client.phone}:${entry?.id ?? 'new'}` : null;
  if (open && key && loadedFor !== key) {
    setWeekdays(entry?.weekdays ?? []);
    setLoadedFor(key);
  }

  const create = useApiMutation(() =>
    createVisitSchedule({
      seriesId,
      clientId: client?.clientId,
      clientName: client?.name ?? '',
      clientPhone: client?.phone ?? '',
      weekdays,
      seats: 1,
    }),
  );
  const update = useApiMutation((id: Id) => updateVisitSchedule(id, weekdays));
  const remove = useApiMutation((id: Id) => deleteVisitSchedule(id));

  const toggleDay = (wd: number) => setWeekdays((prev) => (prev.includes(wd) ? prev.filter((d) => d !== wd) : [...prev, wd]));

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('event.clients.schedule')}
      description={client?.name}
      side="right"
      size="sm"
      footer={
        <>
          {entry && (
            <Button
              variant="ghost"
              className="text-danger"
              loading={remove.isPending}
              onClick={async () => {
                try {
                  await remove.mutate(entry.id);
                  toast.success(t('schedule.visitDeleted'));
                  onSaved();
                } catch {
                  toast.error(t('form.saveFailed'));
                }
              }}
            >
              {t('waitlist.delete')}
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('form.cancel')}
          </Button>
          <Button
            disabled={weekdays.length === 0}
            loading={create.isPending || update.isPending}
            onClick={async () => {
              try {
                if (entry) await update.mutate(entry.id);
                else await create.mutate(undefined);
                toast.success(t('form.updated'));
                onSaved();
              } catch (e) {
                toast.error(e instanceof ApiError && e.code === 'multi_seat_no_schedule' ? t('schedule.multiSeatNotAllowed') : t('form.saveFailed'));
              }
            }}
          >
            {t('form.save')}
          </Button>
        </>
      }
    >
      <div data-f="F-16-078 F-16-079 F-16-080" className="flex flex-col gap-1">
        <p className="mb-2 text-sm text-muted">{t('schedule.visitScheduleHint')}</p>
        {seriesDays.length === 0 ? (
          <EmptyState compact title={t('schedule.noDays')} />
        ) : (
          [...seriesDays]
            .sort((a, b) => a.weekday - b.weekday)
            .map((d) => (
              <Checkbox
                key={d.weekday}
                checked={weekdays.includes(d.weekday)}
                onCheckedChange={() => toggleDay(d.weekday)}
                label={`${weekdayNames[d.weekday]} · ${d.startTime}`}
              />
            ))
        )}
      </div>
    </Sheet>
  );
}
