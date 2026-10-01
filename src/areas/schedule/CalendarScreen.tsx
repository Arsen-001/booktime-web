'use client';

/**
 * «Мой календарь» мастера (F-00-051…060, F-02-039). Сверху вниз: заголовок и тихая строка режима → «Сегодня занято»
 * (час одним нажатием) → неделя строками (правка дня — в шторке) → «Сегодня: записи». У владельца/админа — выбор мастера
 * карточками, режим меняет только сам мастер (F-00-051). Неделя — одним запросом getCalendarWeek (arch-a1 №1).
 */
import { useState } from 'react';
import { CalendarCheck, CalendarClock, CalendarDays, CopyCheck, MoreHorizontal, Plane, Plus } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { ISODate } from '@/domain/core';
import { useCoreList } from '@/api/core';
import { useApiMutation, useApiQuery } from '@/api/request';
import { copyWeekFromLast, getCalendarWeek, hasEmptyNextWeek, openWeek, setCalendarMode, type AffectedBooking } from '@/api/schedule';
import { CalendarDayRow } from '@/areas/schedule/calendar/CalendarDayRow';
import { CalendarDaySheet } from '@/areas/schedule/calendar/CalendarDaySheet';
import { CalendarStaffPicker, CalendarStaffPickerSkeleton } from '@/areas/schedule/calendar/CalendarStaffPicker';
import { CalendarWeekSkeleton } from '@/areas/schedule/calendar/CalendarWeekSkeleton';
import { TodayBookings } from '@/areas/schedule/calendar/TodayBookings';
import { TodayHoursStrip } from '@/areas/schedule/calendar/TodayHoursStrip';
import { useMarksUndo } from '@/areas/schedule/calendar/useMarksUndo';
import { MonthLoadCalendar } from '@/areas/schedule/calendar/MonthLoadCalendar';
import { AbsenceModal } from '@/areas/schedule/components/AbsenceModal';
import { AffectedBookingsNotice } from '@/areas/schedule/components/AffectedBookingsNotice';
import { QuickBookingModal } from '@/areas/schedule/components/QuickBookingModal';
import { useActorName } from '@/areas/schedule/lib/actor';
import { useCustomDayTypes } from '@/areas/schedule/lib/customDayTypes';
import { useUndoToast } from '@/areas/schedule/lib/useUndoToast';
import { rangeFor } from '@/areas/schedule/lib/grid';
import { useCan, useCurrent } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { addDays, today, weekStart } from '@/lib/date';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { DropdownMenu } from '@/ui/DropdownMenu';
import { ErrorState } from '@/ui/ErrorState';
import { Fab } from '@/ui/Fab';
import { IconButton } from '@/ui/IconButton';
import { Modal } from '@/ui/Modal';
import { PageHeader } from '@/ui/PageHeader';
import { PeriodNav } from '@/ui/PeriodNav';
import { Select } from '@/ui/Select';
import { Skeleton, SkeletonText } from '@/ui/Skeleton';
import { useSkeletonCount } from '@/ui/hooks/useSkeletonCount';
import { useToast } from '@/ui/Toast';
import { HintBanner } from '@/ui/onboarding/HintBanner';
import { OneTimeChoice } from '@/ui/onboarding/OneTimeChoice';
import { Tour } from '@/ui/onboarding/Tour';
import { TourButton } from '@/ui/onboarding/TourButton';
import { useTour } from '@/ui/onboarding/useTour';

export function CalendarScreen() {
  const t = useT('schedule');
  const toast = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const { ready, businessId, staffId: ownStaffId, activeLocationIds } = useCurrent();
  const canPickStaff = useCan('journal.others');
  const canEditHours = useCan('schedule.edit');
  const actorName = useActorName();

  const dateParam = params.get('date');
  const [anchor, setAnchor] = useState<ISODate>(dateParam ?? today());
  const [openDate, setOpenDate] = useState<ISODate | null>(dateParam);
  // М3: шторка дня остаётся смонтированной и закрывается анимацией; день держим до следующего открытия
  const [sheetDate, setSheetDate] = useState<ISODate | null>(dateParam);
  const [quickOpen, setQuickOpen] = useState(false);
  const [absenceOpen, setAbsenceOpen] = useState(false);
  const [absenceKey, setAbsenceKey] = useState(0);
  const [monthLoadOpen, setMonthLoadOpen] = useState(false);
  const customDayTypes = useCustomDayTypes(businessId);
  const undoToast = useUndoToast();

  const staffListQuery = useCoreList('staff', { businessId: businessId ?? '' }, { enabled: ready && canPickStaff && Boolean(businessId) });
  const activeHere = (staffListQuery.data ?? []).filter(
    (s) => s.status === 'active' && s.locationIds.some((l) => activeLocationIds.includes(l)),
  );
  // Мастера — те, кто оказывает услуги и виден в журнале (владелец-администратор без услуг и ассистент — нет, F-02-098)
  const masters = activeHere.filter((s) => s.serviceIds.length > 0 && !s.hiddenInJournal);
  const pickable = masters.length > 0 ? masters : activeHere;
  const staffParam = params.get('staff');
  // Карточек мастеров при загрузке — как в прошлый раз, иначе типичный салон демо (4 мастера)
  const pickerSkeletonCount = useSkeletonCount('calendar-picker', {
    loading: !ready || staffListQuery.isLoading,
    count: staffListQuery.data ? pickable.length : undefined,
    fallback: 4,
    max: 12,
  });
  // Без ?staff=: свой календарь, если я мастер с графиком; единственный мастер — сразу он; иначе — выбор карточками
  const staffId = canPickStaff ? (staffParam ?? (pickable.length === 1 ? pickable[0].id : '')) : (ownStaffId ?? '');
  const isOwnCalendar = Boolean(ownStaffId) && staffId === ownStaffId;
  const staff = pickable.find((s) => s.id === staffId);
  // Г6: день правится в выбранном филиале (в котором мастер работает), а не всегда в первом
  const locationId = activeLocationIds.find((l) => !staff || staff.locationIds.includes(l)) ?? activeLocationIds[0];

  const { from, to } = rangeFor('week', anchor);
  const weekQuery = useApiQuery(['schedule', 'calendar-week', staffId, from, to, locationId ?? ''], () => getCalendarWeek(staffId, from, to, locationId), {
    enabled: ready && Boolean(staffId),
  });
  const week = weekQuery.data;
  const mode = week?.mode;
  const todayIso = today();
  const todayDay = week?.days.find((d) => d.date === todayIso);
  const sheetDay = week?.days.find((d) => d.date === sheetDate);
  const openDayAt = (date: ISODate) => {
    setSheetDate(date);
    setOpenDate(date);
  };

  // F-00-055: в воскресенье напомнить открыть окна на следующую неделю (режим «всё занято»)
  const nextWeekFrom = addDays(weekStart(todayIso), 7);
  const emptyNextQuery = useApiQuery(['schedule', 'calendar-empty-next', staffId, todayIso], () => hasEmptyNextWeek(staffId, todayIso), {
    enabled: ready && Boolean(staffId),
  });
  const openNextWeek = useApiMutation(() => openWeek(staffId, nextWeekFrom, addDays(nextWeekFrom, 6)));
  const undoMarks = useMarksUndo(staffId);
  const changeMode = useApiMutation((m: 'free' | 'busy') => setCalendarMode(staffId, m, ownStaffId ?? null));
  const openWeekM = useApiMutation(() => openWeek(staffId, from, to));
  const copyLast = useApiMutation((force: boolean) => copyWeekFromLast(staffId, anchor, actorName, locationId, force));
  // «Как на прошлой неделе» задевает записи — показываем их, как панель графика, и спрашиваем (schedule.md)
  const [copyAffected, setCopyAffected] = useState<AffectedBooking[] | null>(null);

  const tour = useTour('schedule.quickTools', {
    autoStart: true,
    when: isOwnCalendar && Boolean(week) && mode !== undefined,
  });

  const saveMode = async (m: 'free' | 'busy') => {
    try {
      await changeMode.mutate(m);
      toast.success(m === 'busy' ? t('calendar.modeSavedBusy') : t('calendar.modeSavedFree'));
    } catch {
      toast.error(t('calendar.actionFailed'));
    }
  };

  const doOpenWeek = async () => {
    try {
      const r = await openWeekM.mutate(undefined);
      if (r.changed === 0) toast.info(t('calendar.weekAlreadyOpen'));
      else undoMarks(t('calendar.weekOpened', { n: r.changed }), r);
    } catch {
      toast.error(t('calendar.actionFailed'));
    }
  };

  const doOpenNextWeek = async () => {
    try {
      const r = await openNextWeek.mutate(undefined);
      if (r.changed === 0) toast.info(t('calendar.weekAlreadyOpen'));
      else undoMarks(t('calendar.weekOpened', { n: r.changed }), r);
    } catch {
      toast.error(t('calendar.actionFailed'));
    }
  };

  // Г7: «Как на прошлой неделе» — и часы, и отметки; одно «Отменить» возвращает оба
  const doCopyLast = async (force = false) => {
    try {
      const r = await copyLast.mutate(force);
      if (r.affected?.length) {
        setCopyAffected(r.affected);
        return;
      }
      setCopyAffected(null);
      if (r.changed === 0) toast.info(t('calendar.nothingToCopy'));
      else undoToast(t('calendar.copiedLastWeek'), r.cells, { staffId, result: r.marks });
    } catch {
      toast.error(t('calendar.actionFailed'));
    }
  };

  const title = isOwnCalendar || !canPickStaff ? t('calendar.title') : t('calendar.titleOther');
  const staffSelect = canPickStaff && pickable.length > 1 && staffId && (
    <Select
      aria-label={t('calendar.pickStaff')}
      value={staffId}
      onValueChange={(id) => router.push(`/biz/schedule/calendar?staff=${id}`)}
      options={pickable.map((s) => ({ value: s.id, label: s.name }))}
      className="w-auto min-w-44"
    />
  );
  const header = (
    <PageHeader
      title={title}
      description={
        staffId
          ? isOwnCalendar
            ? t('calendar.subtitleOwn')
            : t('calendar.subtitleOther', { name: staff?.name ?? '' })
          : t('calendar.pickStaffHint')
      }
      actions={staffSelect || undefined}
    />
  );

  if (!ready || (canPickStaff && staffListQuery.isLoading)) {
    // Первая загрузка — та же шапка, что будет: без ?staff= у владельца — выбор мастера карточками
    if (canPickStaff && !staffParam)
      return (
        <div className="flex flex-col gap-6">
          <PageHeader title={t('calendar.titleOther')} description={t('calendar.pickStaffHint')} />
          <CalendarStaffPickerSkeleton count={pickerSkeletonCount} />
        </div>
      );
    const ownLoading = !canPickStaff || (Boolean(ownStaffId) && staffParam === ownStaffId);
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title={ownLoading ? t('calendar.title') : t('calendar.titleOther')}
          description={ownLoading ? t('calendar.subtitleOwn') : <SkeletonText width="32ch" />}
        />
        <CalendarWeekSkeleton />
      </div>
    );
  }

  if (canPickStaff && !staffId) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        {/* Ошибка загрузки — не «пригласите мастера»: при ?api=error владельцу казалось, что мастеров нет */}
        {staffListQuery.isError ? <ErrorState onRetry={() => staffListQuery.refetch()} /> : <CalendarStaffPicker staff={pickable} />}
      </div>
    );
  }

  const modeOptions = [
    {
      value: 'free' as const,
      icon: <CalendarCheck />,
      title: t('calendar.modeFreeShort'),
      description: t('calendar.modeFreeHint'),
    },
    {
      value: 'busy' as const,
      icon: <CalendarClock />,
      title: t('calendar.modeBusyShort'),
      description: t('calendar.modeBusyHint'),
    },
  ];

  return (
    <div className="flex flex-col gap-6" data-f="F-02-039">
      {header}

      {week && (
        <div data-f="F-00-051 F-00-052" data-tour="schedule-mode">
          {isOwnCalendar ? (
            <OneTimeChoice
              id="schedule.calendarMode"
              value={mode ?? null}
              when={Boolean(week)}
              onChange={saveMode}
              title={t('calendar.modeQuestion')}
              description={t('calendar.modeQuestionText')}
              label={t('calendar.modeLabel')}
              laterLabel={t('calendar.later')}
              options={modeOptions}
            />
          ) : (
            <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
              {t('calendar.modeLabel')}:
              <Badge tone={mode === 'busy' ? 'neutral' : 'success'}>
                {mode === 'busy' ? t('calendar.modeBusyShort') : t('calendar.modeFreeShort')}
              </Badge>
              <span>{t('calendar.modeChangedByMasterOnly')}</span>
            </p>
          )}
        </div>
      )}

      {week?.nothingOpen && (
        <HintBanner
          tone="warning"
          title={t('calendar.nothingOpenTitle')}
          action={
            <Button size="sm" loading={openWeekM.isPending} onClick={doOpenWeek} data-f="F-00-055">
              {t('calendar.openWeek')}
            </Button>
          }
        >
          {t('calendar.nothingOpenText')}
        </HintBanner>
      )}

      {emptyNextQuery.data && !week?.nothingOpen && (
        <HintBanner
          tone="warning"
          title={t('calendar.nextWeekEmptyTitle')}
          action={
            <Button size="sm" loading={openNextWeek.isPending} onClick={doOpenNextWeek}>
              {t('calendar.openNextWeek')}
            </Button>
          }
        >
          {t('calendar.nothingOpenText')}
        </HintBanner>
      )}

      {todayDay && staffId && (
        <TodayHoursStrip
          staffId={staffId}
          date={todayIso}
          hours={todayDay.hours.length ? todayDay.hours : (todayDay.elsewhere?.[0]?.hours ?? [])}
          marks={todayDay.marks}
          mode={mode}
        />
      )}

      <section className="flex flex-col gap-3" aria-label={t('calendar.weekLabel')} data-f="F-00-053 F-00-054">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" leftIcon={<CalendarDays aria-hidden />} onClick={() => setMonthLoadOpen(true)}>
              {t('calendar.monthLoadButton')}
            </Button>
            <PeriodNav unit="week" value={anchor} onValueChange={setAnchor} />
          </div>
          <div className="flex items-center gap-2">
            {isOwnCalendar && (
              <TourButton onClick={tour.start} iconOnly>
                {t('calendar.tourButton')}
              </TourButton>
            )}
            <DropdownMenu
              label={t('calendar.more')}
              trigger={(p) => (
                <IconButton
                  {...p}
                  icon={<MoreHorizontal aria-hidden />}
                  label={t('calendar.more')}
                  variant="outline"
                  data-tour="schedule-copy-week"
                />
              )}
              items={[
                ...(mode === 'busy'
                  ? [
                      {
                        id: 'open-week',
                        label: t('calendar.openWeek'),
                        icon: <CalendarCheck aria-hidden />,
                        onSelect: () => void doOpenWeek(),
                      },
                    ]
                  : []),
                {
                  id: 'copy',
                  label: t('calendar.asLastWeek'),
                  icon: <CopyCheck aria-hidden />,
                  onSelect: () => void doCopyLast(),
                },
                ...(canEditHours
                  ? [
                      {
                        id: 'vacation',
                        label: t('calendar.absenceMenu'),
                        icon: <Plane aria-hidden />,
                        onSelect: () => {
                          setAbsenceKey((k) => k + 1);
                          setAbsenceOpen(true);
                        },
                      },
                    ]
                  : []),
              ]}
            />
          </div>
        </div>

        {weekQuery.isError ? (
          <ErrorState onRetry={() => weekQuery.refetch()} />
        ) : weekQuery.isLoading || !week ? (
          <CalendarWeekSkeleton />
        ) : (
          <div className="flex flex-col gap-2">
            {week.days.map((day) => (
              <CalendarDayRow key={day.date} day={day} mode={mode} onOpen={() => openDayAt(day.date)} />
            ))}
          </div>
        )}
      </section>

      {staffId && <section aria-label={t('actions.title')}>{week ? <TodayBookings staffId={staffId} /> : <Skeleton lines={2} />}</section>}

      {sheetDay && staffId && (
        <CalendarDaySheet
          key={sheetDay.date}
          open={openDate === sheetDay.date}
          onOpenChange={(o) => !o && setOpenDate(null)}
          staffId={staffId}
          day={sheetDay}
          mode={mode}
          actorName={actorName}
          canEditHours={canEditHours}
          locationId={locationId}
        />
      )}

      {businessId && locationId && staffId && (
        <>
          <QuickBookingModal
            open={quickOpen}
            onOpenChange={setQuickOpen}
            businessId={businessId}
            locationId={locationId}
            staffId={staffId}
            date={todayIso}
          />
          <Fab icon={<Plus aria-hidden />} label={t('quickBooking.button')} onClick={() => setQuickOpen(true)} extended showOnDesktop />
        </>
      )}
      {staffId && (
        <>
        <Modal
          open={Boolean(copyAffected)}
          onOpenChange={(v) => !v && setCopyAffected(null)}
          title={t('calendar.copyAffectedTitle')}
          description={t('calendar.copyAffectedText')}
          footer={
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={() => setCopyAffected(null)}>
                {t('panel.cancel')}
              </Button>
              <Button
                variant={copyAffected?.length ? 'danger' : 'primary'}
                loading={copyLast.isPending}
                onClick={() => void doCopyLast(true)}
              >
                {copyAffected?.length ? t('panel.saveKeepBookings') : t('calendar.asLastWeek')}
              </Button>
            </div>
          }
        >
          {copyAffected && (
            <AffectedBookingsNotice
              bookings={copyAffected}
              onResolved={(id) => setCopyAffected((list) => (list ?? []).filter((a) => a.booking.id !== id))}
            />
          )}
        </Modal>
        <AbsenceModal
          key={absenceKey}
          open={absenceOpen}
          onOpenChange={setAbsenceOpen}
          kind="absence"
          staffIds={[staffId]}
          whoLabel={staff?.name}
          locationId={locationId}
          actorName={actorName}
          customTypes={customDayTypes}
        />
        </>
      )}
      {staffId && (
        <MonthLoadCalendar
          open={monthLoadOpen}
          onOpenChange={setMonthLoadOpen}
          staffOptions={canPickStaff ? pickable.map((s) => ({ id: s.id, name: s.name })) : []}
          staffIds={[staffId]}
          anchor={anchor}
          onPickDate={setAnchor}
        />
      )}

      {isOwnCalendar && (
        <Tour
          {...tour.props}
          steps={[
            {
              id: 'hours',
              target: '[data-tour="schedule-hours"]',
              title: t('tour.hoursTitle'),
              body: t('tour.hoursBody'),
            },
            {
              id: 'mode',
              target: '[data-tour="schedule-mode"]',
              title: t('tour.modeTitle'),
              body: t('tour.modeBody'),
            },
            {
              id: 'copy',
              target: '[data-tour="schedule-copy-week"]',
              title: t('tour.copyTitle'),
              body: t('tour.copyBody'),
            },
            {
              id: 'actions',
              target: '[data-tour="schedule-actions"]',
              title: t('tour.actionsTitle'),
              body: t('tour.actionsBody'),
            },
          ]}
        />
      )}
    </div>
  );
}
