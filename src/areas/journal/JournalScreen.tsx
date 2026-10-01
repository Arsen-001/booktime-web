'use client';

/**
 * Экран «Журнал» — журнал A2 (docs/design/DESIGN.md, A2-wide/laptop/phone.png): один ряд управления
 * (‹ › · дата ⌄ · День/Неделя/Месяц · «Все мастера» · поиск · ⋯ · «Новая запись»), итоги дня, сетка с карточками
 * «C · Тон», панель «Требует внимания» справа; на телефоне — шапка месяца, полоса недели, плашка «ждут
 * подтверждения», сетка на 2 мастера, «+ Запись» и нижнее меню. Прежние ряды фильтров и левая панель — в «⋯ Ещё».
 * Пачка b01: F-01-001…035, F-01-078, F-01-186…188, F-01-214, F-01-215.
 */
import { startTransition, useEffect, useEffectEvent, useMemo, useState, type ReactNode } from 'react';
import { useLocale } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChartNoAxesGantt, Columns3, Columns4, List, MoreHorizontal, Plus, Search } from 'lucide-react';
import type { Booking, Id, ISODate } from '@/domain/core';
import type { FavoriteSection, JournalGroupBy } from '@/domain/journal';
import { dayTypeById, isScheduleStaff } from '@/domain/schedule';
import { closeWaitlistEntry, getStaffResourcesRights } from '@/api/resources';
import { getStaffDayInfo } from '@/api/schedule';
import { useTDynamic } from '@/i18n/useTDynamic';
import { coreGet, coreList, listBookings, listGroupEvents, releaseExpiredPrepayments } from '@/api/core';
import { listEventSeriesDefsByIds } from '@/api/resources';
import {
  getBookingCategories,
  getFavorites,
  getJournalPrefs,
  getJournalSettings,
  getStaffHoursMap,
  listBookingExtrasByIds,
  listDayLacquers,
  setBreakCombineMode,
  setJournalHiddenStatuses,
  setJournalZoom,
  setSplitByResourceEnabled,
  toggleFavorite,
} from '@/api/journal';
import { prefetchApiQuery, useApiMutation, useApiQuery } from '@/api/request';
import { useFormat } from '@/i18n/useFormat';
import { useJournalHourFormat } from '@/areas/journal/lib/useJournalHourFormat';
import { useCan, useCurrent, useSphere } from '@/demo/hooks';
import { useDenseScreen, requestShellDrawerOpen } from '@/shell/workspace/useDenseScreen';
import { LocationSwitcher } from '@/shell/biz/LocationSwitcher';
import { startNavPending } from '@/ui/navigation/navPending';
import { useT } from '@/i18n/useT';
import { pickText } from '@/lib/text';
import { addDays, fromMinutes, nowYerevan, today, toMinutes } from '@/lib/date';
import { BookingWindow } from '@/areas/journal/components/BookingWindow';
import { useJournalBlockRights } from '@/areas/journal/lib/rights';
import { MixedTypeChoice } from '@/areas/journal/components/MixedTypeChoice';
import { DayGrid, type ColumnDef } from '@/areas/journal/components/DayGrid';
import { EmptyDayState } from '@/areas/journal/components/EmptyDayState';
import { JournalSidebar } from '@/areas/journal/components/JournalSidebar';
import { AttentionContent, AttentionPanel, useAttention, type AttentionData } from '@/areas/journal/components/AttentionPanel';
import { DayTotals, DayTotalsSkeleton } from '@/areas/journal/components/DayTotals';
import { DayGridSkeleton, useDayGridShape, useSaveDayGridShape } from '@/areas/journal/components/DayGridSkeleton';
import { computeDayRange } from '@/areas/journal/lib/grid';
import { DayNow } from '@/areas/journal/components/DayNow';
import { OFFER_GAP_EVENT } from '@/areas/journal/lib/visitTiming';
import { NEXT_VISIT_EVENT, findNextVisitSlot, repeatDaysOf } from '@/areas/journal/lib/nextVisit';
import { CONFIRM_TOMORROW_EVENT, ConfirmTomorrowSheet } from '@/areas/journal/components/ConfirmTomorrowSheet';
import { FreeTodaySheet } from '@/areas/journal/components/FreeTodaySheet';
import { WorkdaySheets } from '@/areas/journal/components/workday/WorkdaySheets';
import { JournalDateNav, shiftDate } from '@/areas/journal/components/JournalDateNav';
import { JournalWorkday } from '@/areas/journal/components/JournalWorkday';
import { JournalMoreSheet } from '@/areas/journal/components/JournalMoreSheet';
import { AlertBar, JournalBottomNav, PendingBar, PendingBarSkeleton, PhoneHeader, WeekStrip } from '@/areas/journal/components/JournalPhone';
import { MastersPicker } from '@/areas/journal/components/MastersPicker';
import { MonthGrid } from '@/areas/journal/components/MonthGrid';
import { bookingTone, dayTotals, isActiveBooking, startMinutes } from '@/areas/journal/lib/board';
import { findSlotGaps, nearestSlots } from '@/areas/journal/lib/findSlots';
import { FindSlotButton } from '@/areas/journal/components/FindSlotButton';
import { WaitlistPanel } from '@/areas/journal/components/WaitlistPanel';
import { DayOverview } from '@/areas/journal/components/DayOverview';
import { DayTimeline } from '@/areas/journal/components/DayTimeline';
import { DayList } from '@/areas/journal/components/DayList';
import { DAY_LAYOUTS, useDayLayout } from '@/areas/journal/lib/dayLayout';
import type { DayLayout } from '@/domain/journal';
import type { JournalView } from '@/areas/journal/components/JournalToolbar';
import { JournalScaleSheet, maxMobileColumns, type JournalScaleValue } from '@/areas/journal/components/JournalScaleSheet';
import { PackageCreateModal } from '@/areas/journal/components/PackageCreateModal';
import { OfflineBanner } from '@/areas/journal/components/OfflineBanner';
import { RightPanel } from '@/areas/journal/components/RightPanel';
import { StaffScheduleModal } from '@/areas/journal/components/StaffScheduleModal';
import { WeekGrid, prefetchStaffWeek } from '@/areas/journal/components/WeekGrid';
import { Button } from '@/ui/Button';
import { ErrorState } from '@/ui/ErrorState';
import { Fab } from '@/ui/Fab';
import { IconButton } from '@/ui/IconButton';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { startSharedTransition } from '@/ui/SharedTransition';
import { OpenBookingContext, SharedWindowFrame, setSharedBookingId } from '@/areas/journal/components/SharedBookingSlot';
import { HoldWhileClosing } from '@/areas/journal/components/HoldWhileClosing';
import { Sheet } from '@/ui/Sheet';
import { Tooltip } from '@/ui/Tooltip';
import { useIsMobile } from '@/ui/hooks/useMediaQuery';
import { useToast } from '@/ui/Toast';

const JOURNAL_FAVORITE: FavoriteSection = { id: 'journal', labelKey: 'sections.journal', href: '/biz/journal' };

export function JournalScreen() {
  const t = useT('journal');
  const locale = useLocale();
  const router = useRouter();
  const params = useSearchParams();
  const isMobile = useIsMobile();
  // F-01-001: полноценный переключатель «Журнал / Администрирование» — решение продукта ядра,
  // хранитель ядра отказал (r3, qa/requests/ux-core.md §5: единое меню — сознательное упрощение)
  // и предложил взамен «плотный» каркас — журналу, как самой рабочей сетке дня, он нужнее всего.
  useDenseScreen();
  // Полоса каркаса над журналом снова видна на каждой ширине (owner 27.09.2026 — «без шапки не нравится»,
  // единая полоса на всех страницах кабинета): уведомления и меню пользователя больше не дублируются в ряду
  // управления журнала, они уже в этой полосе. Переключатель филиала остаётся в «⋯ Ещё» — так короче путь
  // к нему для журнала, а не потому что полоса каркаса его не показывает.
  const { ready, businessId, businessIds, locationId, staffId: ownStaffId, activeLocationIds } = useCurrent();
  // F-01-006: у сети «Все филиалы» (locationId === 'all') журнал обязан показывать мастеров и
  // записи ВСЕХ филиалов сети, а не только первого — иначе ярлык переключателя врёт о содержимом.
  const activeBusinessIds = useMemo(
    () => (locationId === 'all' ? businessIds : businessId ? [businessId] : []),
    [locationId, businessId, businessIds],
  );
  const canSeeOthers = useCan('journal.others');
  const canCreate = useCan('journal.create');
  const { has: sphereHas } = useSphere();
  // F-01-115: право «Перенос записи» в СЕТКЕ разделено от прав окна (WindowRights.changeStaffAndTime)
  const journalRights = useJournalBlockRights();
  const canReschedule = canCreate && journalRights.reschedule;
  // F-01-167, F-01-170, F-01-155, F-01-169: настройки страницы «Цифровой журнал» (пачка b05)
  const journalSettingsQuery = useApiQuery(['journal', 'settings-in-screen'], getJournalSettings, { enabled: ready });
  // F-01-155: плитка «Лист ожидания» — настройка журнала + одно право «Видит лист ожидания» (resources.viewWaitlist,
  // решение владельца 01.10.2026: лист один — и право одно; тот же ключ запроса, что useResourcesRights раздела)
  const waitlistRightsQuery = useApiQuery(['resources', 'staffRights', ownStaffId], () => getStaffResourcesRights(ownStaffId ?? ''), {
    enabled: ready && Boolean(ownStaffId),
  });
  const showWaitlistTile = (journalSettingsQuery.data?.waitlistEnabled ?? true) && (waitlistRightsQuery.data?.viewWaitlist ?? true);
  // F-01-156: панель листа ожидания — открывается с плитки, живёт внутри журнала (не /biz/waitlist)
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [confirmTomorrowOpen, setConfirmTomorrowOpen] = useState(false);
  const [freeTodayOpen, setFreeTodayOpen] = useState(false);
  // «Закончили раньше» / «Начать сейчас» освободили время — «Предложить окно» в тосте открывает «Свободно сегодня»;
  // «Напомнить» в «Требует внимания» — шторку «Подтвердить завтра»
  useEffect(() => {
    // ⭐ «Предложить окно» (тост «Освободилось …», «Требует внимания») — все пустоты сегодня одним предложением
    const onOffer = () => setFreeTodayOpen(true);
    const onConfirmTomorrow = () => setConfirmTomorrowOpen(true);
    window.addEventListener(OFFER_GAP_EVENT, onOffer);
    window.addEventListener(CONFIRM_TOMORROW_EVENT, onConfirmTomorrow);
    return () => {
      window.removeEventListener(OFFER_GAP_EVENT, onOffer);
      window.removeEventListener(CONFIRM_TOMORROW_EVENT, onConfirmTomorrow);
    };
  }, []);


  const [date, setDate] = useState<ISODate>(() => params.get('date') ?? today());
  const [view, setView] = useState<JournalView>('day');
  // F-01-170: значение по умолчанию из настроек журнала («вид»/«должность»/«ресурс») — до первого
  // ручного переключения override пуст, и виден дефолт; переключил сам — override живёт поверх него.
  const [groupByOverride, setGroupByOverride] = useState<JournalGroupBy | null>(null);
  const [positionFilterOverride, setPositionFilterOverride] = useState<string | null>(null);
  const [resourceFilterOverride, setResourceFilterOverride] = useState<string | null>(null);
  const settingsDefaultView = journalSettingsQuery.data?.defaultView ?? 'staff';
  // F-16-024: «Масштаб» на телефоне — пока шторка открыта, журнал показывает предпросмотр (scalePreview),
  // «Сохранить» переносит его в настоящие значения, закрытие без сохранения — возвращает прежние.
  const [scalePreview, setScalePreview] = useState<JournalScaleValue | null>(null);
  const [savedMobileColumns, setSavedMobileColumns] = useState<number | null>(null);
  const savedGroupBy = groupByOverride ?? settingsDefaultView;
  const groupBy = scalePreview?.groupBy ?? savedGroupBy;
  const positionFilter =
    positionFilterOverride ?? (settingsDefaultView === 'staff' ? (journalSettingsQuery.data?.defaultPositionId ?? 'all') : 'all');
  const resourceFilter =
    resourceFilterOverride ?? (settingsDefaultView === 'resource' ? (journalSettingsQuery.data?.defaultResourceId ?? 'all') : 'all');
  const [weekStaffId, setWeekStaffId] = useState<Id>(ownStaffId ?? '');
  // F-16-020: неделя одного ресурса — тот же режим, что «Неделя» сотрудника, но subject = экземпляр ресурса
  const [weekSubjectKind, setWeekSubjectKind] = useState<'staff' | 'resource'>('staff');
  const [weekResourceInstanceId, setWeekResourceInstanceId] = useState<string>('');
  const [mobileCalendarOpen, setMobileCalendarOpen] = useState(false);
  // Журнал A2: мастера, которых человек убрал из дня в «Все мастера» (по умолчанию — никого)
  const [hiddenStaffIds, setHiddenStaffIds] = useState<Id[]>([]);
  // «Найти окно»: выбранная услуга — её свободные места подсвечены в сетке дня
  const [slotServiceId, setSlotServiceId] = useState<Id | null>(null);
  // Вид дня (⭐ 29.09.2026): «Колонки / Обзор / Лента / Список» — личный выбор, хранится в аккаунте сотрудника
  const [dayLayout, setDayLayout, dayLayoutLoading] = useDayLayout(ownStaffId);
  // «Требует внимания» на телефоне — шторкой с жёлтой плашки
  const [attentionSheetOpen, setAttentionSheetOpen] = useState(false);
  // Карточка, которая «перетекает» в окно записи и обратно (SharedTransition) — одна на экран. Хранится вне состояния
  // экрана (components/SharedBookingSlot.tsx): клик по карточке не перерисовывает журнал целиком. Уход с экрана — сброс.
  useEffect(() => () => setSharedBookingId(null), []);
  const [mixedTypeChoice, setMixedTypeChoice] = useState<{ staffId: Id; time: string; showEvent: boolean } | null>(null);
  // F-02-036: «Перерыв» из выбора по пустой ячейке — открывает StaffScheduleModal, готовый к сохранению.
  const [breakChoice, setBreakChoice] = useState<{ staffId: Id; time: string } | null>(null);
  const [addStaffOpen, setAddStaffOpen] = useState(false);
  const [packageOpen, setPackageOpen] = useState(false);
  // F-01-010, F-01-011, F-01-016 и фильтры сетки: журнал A2 держит их под одной кнопкой «⋯ Ещё» (DESIGN.md)
  const [moreOpen, setMoreOpen] = useState(false);
  // F-01-017: «Клиенты и чат» (поиск клиента) — шторкой по кнопке поиска, сетка остаётся на месте
  const [clientsOpen, setClientsOpen] = useState(false);

  const bookingId = params.get('booking') ?? undefined;
  const isNew = params.get('new') === '1';
  const windowOpen = Boolean(bookingId) || isNew;
  // Окно записи монтируется кадром ПОСЛЕ перехода по адресу, отдельным фоновым рендером: переход «карточка → окно»
  // (View Transition) не ждёт монтирования шторки с двумя десятками запросов (qa/journal-redesign/open-trace.mjs).
  // Прямая ссылка ?booking= открывает окно сразу; закрытие снимает его в том же рендере.
  const newStaffParam = params.get('staff') ?? undefined;
  const newStartParam = params.get('start') ?? undefined;
  const newClientParam = params.get('client') ?? undefined;
  const newPhoneParam = params.get('phone') ?? undefined;
  const newNameParam = params.get('name') ?? undefined;
  const newServicesParam = params.get('services') ?? undefined;
  // «Записать» с экрана «Лист ожидания» (/biz/waitlist): после сохранения заявка закрывается записью (F-16-163)
  const waitlistParam = params.get('waitlist') ?? undefined;

  const prefsQuery = useApiQuery(['journal', 'prefs'], getJournalPrefs, { enabled: ready });
  const zoomMutation = useApiMutation(setJournalZoom);
  const hiddenMutation = useApiMutation(setJournalHiddenStatuses);
  const breakModeMutation = useApiMutation(setBreakCombineMode);
  const splitByResourceMutation = useApiMutation(setSplitByResourceEnabled);
  const favoritesQuery = useApiQuery(['journal', 'favorites', ownStaffId], () => getFavorites(ownStaffId ?? ''), { enabled: Boolean(ownStaffId) });
  const favoriteMutation = useApiMutation((section: FavoriteSection) => toggleFavorite(ownStaffId ?? '', section));
  const isJournalFavorite = (favoritesQuery.data ?? []).some((f) => f.id === JOURNAL_FAVORITE.id);
  const canEditSchedule = useCan('journal.edit');
  // «Добавить сотрудника» относится к управлению персоналом, не к правке расписания (core-k4-4)
  const canAddStaff = useCan('staff.manage');
  const toast = useToast();

  const staffQuery = useApiQuery(
    ['journal', 'staff', activeBusinessIds.join(','), activeLocationIds.join(',')],
    () =>
      coreList(
        'staff',
        (s) =>
          activeBusinessIds.includes(s.businessId) &&
          // Г14: кто в графике — общее правило с таблицей графика (isScheduleStaff); уволенные тоже читаются —
          // их колонка появится только если в дне остались записи (Г3)
          s.status !== 'disabled' &&
          s.locationIds.some((l) => activeLocationIds.includes(l)),
      ),
    { enabled: ready && activeBusinessIds.length > 0 },
  );
  const allStaffIds = useMemo(() => staffQuery.data?.map((s) => s.id) ?? [], [staffQuery.data]);

  // Г3/Г16: тип дня и заметка из графика — подпись колонки «Отпуск · 7 записей — перенести» и заметка над колонкой
  const dayInfoQuery = useApiQuery(['journal', 'day-info', allStaffIds.join(','), date], () => getStaffDayInfo(allStaffIds, date), {
    enabled: allStaffIds.length > 0,
  });
  const dayInfoData = dayInfoQuery.data;
  const tDynamic = useTDynamic();
  const hoursQuery = useApiQuery(['journal', 'hours', allStaffIds.join(','), date], () => getStaffHoursMap(allStaffIds, date), {
    enabled: allStaffIds.length > 0,
  });

  const resourcesQuery = useApiQuery(['journal', 'resources', businessId], () => coreList('resources', { businessId: businessId!, active: true }), {
    enabled: ready && Boolean(businessId) && groupBy === 'resource',
  });

  const bookingsQuery = useApiQuery(
    ['journal', 'bookings', activeBusinessIds.join(','), date],
    () => listBookings({ businessIds: activeBusinessIds, from: date, to: date }),
    { enabled: ready && activeBusinessIds.length > 0 },
  );

  // qa/measure/journal/recheck-c3.md (25.09, major): `?booking=<id>` без `&date=` для записи не на
  // сегодня открывало пустую «Новую запись» — `bookingsQuery` грузит только `date`, так что запись с
  // другого дня в нём не найдётся. Такие ссылки строит карточка клиента («Следующая запись», «История
  // визитов»). Если id задан, но не встречается среди уже загруженных записей дня — догружаем ровно эту
  // запись отдельно и переключаем день на её дату; если её вовсе нет (удалена/неверный id) — тост и
  // закрываем окно вместо пустого черновика.
  const bookingNotInDay = Boolean(bookingId) && !bookingsQuery.isLoading && !(bookingsQuery.data ?? []).some((b) => b.id === bookingId);
  const bookingLookupQuery = useApiQuery(['journal', 'booking-lookup', bookingId], () => coreGet('bookings', bookingId!), {
    enabled: ready && bookingNotInDay,
  });
  // Эффекты ниже зовут useEffectEvent вместо «eslint-disable exhaustive-deps»: любая такая подавленная
  // проверка выключает React Compiler для ВСЕГО экрана (замер открытия окна записи — qa/journal-redesign/open-window.mjs).
  // Синхронизация URL-параметра `booking` (внешний источник) с локальным `date`, один раз на
  // найденную запись — не цикл: как только `date` совпадёт, `bookingNotInDay` станет false и этот
  // запрос выключится сам (enabled: ready && bookingNotInDay), эффект больше не выполнится.
  // Подстройка состояния во время рендера (официальный приём React), один раз на каждый ответ поиска записи.
  const [syncedLookup, setSyncedLookup] = useState<unknown>(undefined);
  if (bookingLookupQuery.data && syncedLookup !== bookingLookupQuery.data) {
    setSyncedLookup(bookingLookupQuery.data);
    const foundDate = bookingLookupQuery.data.start.slice(0, 10);
    if (foundDate !== date) setDate(foundDate);
  }
  const reportBookingNotFound = useEffectEvent(() => {
    toast.error(t('window.bookingNotFound'));
    router.push('/biz/journal');
  });
  useEffect(() => {
    if (bookingNotInDay && bookingLookupQuery.isError) reportBookingNotFound();
  }, [bookingNotInDay, bookingLookupQuery.isError]);

  // Попутный баг ревью склада (27.09): «Открыть визит» (?booking= без &date=, или день ещё не загружен) монтировал
  // окно, пока записи в данных дня нет, — оно открывалось как НОВАЯ запись с общим ключом черновика
  // `new:x:<день>:10:00` и подхватывало чужой брошенный черновик (другая клиентка), а когда запись приезжала,
  // гидратация уже прошла. Окно существующей записи монтируется только когда сама запись уже в руках.
  const windowBookingResolved = !bookingId || (bookingsQuery.data ?? []).some((b) => b.id === bookingId);
  const [windowMounted, setWindowMounted] = useState(windowOpen && windowBookingResolved);
  if (!windowOpen && windowMounted) setWindowMounted(false);
  useEffect(() => {
    if (!windowOpen || !windowBookingResolved) return;
    const id = requestAnimationFrame(() => startTransition(() => setWindowMounted(true)));
    return () => cancelAnimationFrame(id);
  }, [windowOpen, windowBookingResolved]);
  // F-01-028/051/052: ручной цвет и категории записи — один запрос на весь видимый день, а не по
  // одному запросу на блок (сетка дня легко показывает 20-30 записей одновременно).
  const dayBookingIds = (bookingsQuery.data ?? []).map((b) => b.id);
  const extrasQuery = useApiQuery(['journal', 'day-extras', businessId, date, dayBookingIds.join(',')], () => listBookingExtrasByIds(dayBookingIds), {
    enabled: dayBookingIds.length > 0,
  });
  const bookingCategoriesQuery = useApiQuery(['journal', 'booking-categories'], getBookingCategories, { enabled: ready });
  // F-00-094 / DESIGN.md «C · Тон»: оттенок лака записи — цвет карточки
  const lacquersQuery = useApiQuery(['journal', 'day-lacquers', activeBusinessIds.join(','), date], () => listDayLacquers(activeBusinessIds, date), {
    enabled: ready && activeBusinessIds.length > 0,
  });
  // Соседние дни — заранее в кэш: «‹ ›» и полоса недели листают без скелетона и без вспышки цветов
  const businessIdsKey = activeBusinessIds.join(',');
  const staffIdsKey = allStaffIds.join(',');
  const prefetchNeighbourDays = useEffectEvent(() => {
    if (!ready || activeBusinessIds.length === 0) return undefined;
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 300));
    const cancel = window.cancelIdleCallback ?? window.clearTimeout;
    const handle = idle(() => {
      for (const d of [addDays(date, 1), addDays(date, -1)]) {
        prefetchApiQuery(['journal', 'bookings', activeBusinessIds.join(','), d], () =>
          listBookings({ businessIds: activeBusinessIds, from: d, to: d }),
        );
        prefetchApiQuery(['journal', 'day-lacquers', activeBusinessIds.join(','), d], () => listDayLacquers(activeBusinessIds, d));
        if (allStaffIds.length > 0) prefetchApiQuery(['journal', 'hours', allStaffIds.join(','), d], () => getStaffHoursMap(allStaffIds, d));
      }
    });
    return () => cancel(handle);
  });
  useEffect(() => prefetchNeighbourDays(), [ready, date, businessIdsKey, staffIdsKey]);
  // Телефон: под месяцем в шапке — название салона
  const businessQuery = useApiQuery(['journal', 'business', businessId], () => coreGet('businesses', businessId!), {
    enabled: ready && Boolean(businessId),
  });

  // F-01-035: групповые события дня — рисуем в сетке (наша часть); участники, серия, отчёт — раздел
  // `resources`, `/biz/groups` (qa/requests/journal.md, 2026-09-25 g2-1).
  const groupEventsQuery = useApiQuery(['journal', 'group-events', businessId, date], () => listGroupEvents({ businessId, from: date, to: date }), {
    enabled: ready && Boolean(businessId),
  });

  // F-16-042: значок «изменено отдельно от серии» и дата окончания расписания в блоке события —
  // нужен `EventSeriesDef` по каждому `seriesId`, видимому сегодня (раздел `resources`, наш блок только
  // читает готовую функцию их api).
  const visibleSeriesIds = Array.from(new Set((groupEventsQuery.data ?? []).map((e) => e.seriesId).filter((id): id is Id => Boolean(id))));
  const seriesDefsQuery = useApiQuery(
    ['journal', 'group-events-series', businessId, date, visibleSeriesIds.join(',')],
    () => listEventSeriesDefsByIds(visibleSeriesIds),
    { enabled: ready && Boolean(businessId) && visibleSeriesIds.length > 0 },
  );
  const seriesDefsById = seriesDefsQuery.data ?? {};

  // F-01-205: неоплаченная в срок онлайн-запись снимается сама — окно освобождается без участия
  // администратора; F-01-220: перенос/отмена клиентом онлайн (в другой вкладке/устройстве) тоже должен
  // быть виден без ручного обновления — обе задачи решает лёгкий опрос вместо ручного refetch.
  const refetchDayTick = useEffectEvent((forBusinessId: Id) => {
    releaseExpiredPrepayments({ businessId: forBusinessId })
      .then((released) => {
        if (released.length > 0) bookingsQuery.refetch();
      })
      .catch(() => {});
    bookingsQuery.refetch();
  });
  useEffect(() => {
    if (!ready || !businessId) return;
    const timer = setInterval(() => refetchDayTick(businessId), 20000);
    return () => clearInterval(timer);
  }, [ready, businessId, date]);

  const clientsQuery = useApiQuery(['journal', 'clients', businessId], () => coreList('clients', { businessId: businessId! }), {
    enabled: ready && Boolean(businessId),
  });
  const clientsById = useMemo(() => Object.fromEntries((clientsQuery.data ?? []).map((c) => [c.id, c])), [clientsQuery.data]);

  const servicesQuery = useApiQuery(['journal', 'services', businessId], () => coreList('services', { businessId: businessId! }), {
    enabled: ready && Boolean(businessId),
  });

  // qa/measure/journal/g2-3-m1.md (25.09, major, F-01-018): `hoursQuery` грузится ПОСЛЕ
  // staffQuery (её ключ и `enabled` зависят от allStaffIds, доступного только следующим рендером) и
  // не входила в `isLoading` — экран проходил гейт загрузки раньше, чем график сотрудников успевал
  // прийти. На телефоне (задержка мока 150–400 мс) это иногда (~1 из 6) заставало
  // `staffWithSchedule` пустым: ложное «Расписание не установлено» (EmptyDayState) и пропадала Fab
  // «+» (F-01-184) — единственный способ создать запись с телефона. Гонка данных, не разметка Fab.
  // Модель сетки дня — одним useMemo ДО ранних return (правила хуков). Без него React Compiler склеивал эти расчёты
  // в один блок с bookingId/openWindow/целыми объектами запросов в зависимостях: открытие окна записи (смена
  // ?booking=) пересчитывало колонки и перерисовывало всю сетку дня (~30 мс на CPU×4, qa/journal-redesign/open-window.mjs).
  const staffData = staffQuery.data;
  const hoursData = hoursQuery.data;
  const resourcesData = resourcesQuery.data;
  const prefsHiddenStatuses = prefsQuery.data?.hiddenStatuses;
  const bookingsData = bookingsQuery.data;
  const groupEventsData = groupEventsQuery.data;
  const viewStaffScope = journalRights.viewStaffScope;
  const gridModel = useMemo(() => {
    const everyone = staffData ?? [];
    const allStaff = everyone.filter(isScheduleStaff);
    // F-01-178: viewStaffScope сужает canSeeOthers по override сотрудника (тонкое право поверх грубого)
    const inView = (list: typeof everyone) => (canSeeOthers && viewStaffScope === 'all' ? list : list.filter((s) => s.id === ownStaffId));
    const staffForView = inView(allStaff);
    // «Не показывать в журнале» (карточка сотрудника; администраторы со сменами в сиде) — колонки нет, даже с графиком
    const staffWithSchedule = staffForView.filter((s) => !s.hiddenInJournal && (hoursData?.[s.id]?.length ?? 0) > 0);
    // Г3: мастер не работает (отпуск, выходной, уволен), а записи на день остались — записи не пропадают, колонка
    // остаётся с пометкой «перенести»
    const withSchedule = new Set(staffWithSchedule.map((s) => s.id));
    const offWithBookings = inView(everyone).filter(
      (s) => !withSchedule.has(s.id) && (bookingsData ?? []).some((b) => b.staffId === s.id && isActiveBooking(b) && b.status !== 'no_show'),
    );
    const positions = [...new Set(staffWithSchedule.map((s) => (s.position ? pickText(s.position, locale) : t('grid.noPosition'))))];

    const byPositionColumns: ColumnDef[] = [...staffWithSchedule, ...offWithBookings]
      .filter((s) => {
        if (hiddenStaffIds.includes(s.id)) return false;
        if (positionFilter === 'all') return true;
        const label = s.position ? pickText(s.position, locale) : t('grid.noPosition');
        return label === positionFilter;
      })
      .map((s) => {
        const info = dayInfoData?.[s.id];
        const offLabel = withSchedule.has(s.id)
          ? undefined
          : s.status === 'fired'
            ? t('board.column.fired')
            : info?.typeId && info.typeId !== 'work' && info.typeId !== 'not_working'
              ? tDynamic(`schedule.${dayTypeById(info.typeId).labelKey}`)
              : t('board.column.dayOff');
        return {
          kind: 'staff' as const,
          id: s.id,
          staff: s,
          hours: hoursData?.[s.id] ?? [],
          ...(offLabel ? { off: { label: offLabel } } : {}),
          ...(info?.note ? { note: info.note } : {}),
        };
      });

    const resources = resourcesData ?? [];
    const resourceColumns: ColumnDef[] = resources
      .filter((r) => resourceFilter === 'all' || r.id === resourceFilter)
      .flatMap((r) =>
        r.instances.map((inst) => ({ kind: 'resource' as const, id: `${r.id}:${inst.id}`, resource: r, instanceId: inst.id, instanceName: inst.name })),
      );

    const hiddenStatuses = prefsHiddenStatuses ?? [];
    const visibleBookings = (bookingsData ?? []).filter((b) => !hiddenStatuses.includes(b.status));

    const bookingsByColumn: Record<Id, typeof visibleBookings> = {};
    if (groupBy === 'staff') {
      for (const col of byPositionColumns) bookingsByColumn[col.id] = visibleBookings.filter((b) => b.staffId === col.id);
    } else {
      for (const col of resourceColumns) {
        if (col.kind !== 'resource') continue;
        bookingsByColumn[col.id] = visibleBookings.filter((b) => b.resourceIds.includes(col.instanceId));
      }
    }

    const columns = groupBy === 'staff' ? byPositionColumns : resourceColumns;
    // F-01-035: только вид «по должностям» — колонка группового события = её мастер; ресурсный вид
    // сложнее (событие может занимать несколько ресурсов сразу) и в эту пачку не входит.
    const groupEvents = groupEventsData ?? [];
    const groupEventsByColumn: Record<Id, (typeof groupEvents)[number][]> = {};
    if (groupBy === 'staff') {
      for (const col of byPositionColumns) groupEventsByColumn[col.id] = groupEvents.filter((e) => e.staffId === col.id);
    }
    const participantCountByEvent: Record<Id, number> = {};
    for (const b of bookingsData ?? []) {
      if (!b.groupEventId || b.deletedAt) continue;
      participantCountByEvent[b.groupEventId] = (participantCountByEvent[b.groupEventId] ?? 0) + 1;
    }
    return {
      allStaff,
      staffForView,
      staffWithSchedule,
      positions,
      byPositionColumns,
      resources,
      visibleBookings,
      bookingsByColumn,
      columns,
      groupEventsByColumn,
      participantCountByEvent,
    };
  }, [
    staffData,
    dayInfoData,
    tDynamic,
    canSeeOthers,
    viewStaffScope,
    ownStaffId,
    hoursData,
    hiddenStaffIds,
    positionFilter,
    locale,
    t,
    resourcesData,
    resourceFilter,
    prefsHiddenStatuses,
    bookingsData,
    groupBy,
    groupEventsData,
  ]);

  const isLoading =
    staffQuery.isLoading || hoursQuery.isLoading || bookingsQuery.isLoading || clientsQuery.isLoading || servicesQuery.isLoading || dayLayoutLoading;
  const isError = staffQuery.isError || hoursQuery.isError || bookingsQuery.isError || clientsQuery.isError || servicesQuery.isError;

  const openWindow = (query: Record<string, string>) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) sp.set(k, v);
    router.push(`/biz/journal?${sp.toString()}`);
  };
  const closeWindow = () => router.push('/biz/journal');
  // Групповое событие открывается на другой странице — полоска загрузки сразу, как у ссылок (NavPendingFeedback)
  const openGroupEvent = (id: Id) => {
    const href = `/biz/groups?event=${id}`;
    startNavPending(href);
    router.push(href);
  };

  // Неделя выбранного мастера — в кэш заранее: «День → Неделя» без скелетона на месте сетки
  // Тот же мастер, что выберет переключатель «Неделя» (ниже, onValueChange)
  const weekStaffKey =
    (gridModel.staffWithSchedule.some((s) => s.id === weekStaffId) ? weekStaffId : gridModel.staffWithSchedule[0]?.id) ?? weekStaffId;
  const prefetchWeek = useEffectEvent(() => {
    if (!ready || view !== 'day' || weekSubjectKind !== 'staff' || !weekStaffKey) return undefined;
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 300));
    const cancel = window.cancelIdleCallback ?? window.clearTimeout;
    const handle = idle(() => prefetchStaffWeek(weekStaffKey, date));
    return () => cancel(handle);
  });
  useEffect(() => prefetchWeek(), [ready, view, date, weekStaffKey, weekSubjectKind]);

  // ⭐ «Записать на следующий визит»: тот же клиент, мастер и услуги через интервал повтора — в ближайшее окно
  const nextVisitHandler = useEffectEvent(async (bookingId: Id) => {
    const b = (bookingsData ?? []).find((x) => x.id === bookingId) ?? (await coreGet('bookings', bookingId).catch(() => undefined));
    if (!b) return;
    const slot = await findNextVisitSlot(b, servicesQuery.data ?? []);
    const target = slot?.date ?? addDays(b.start.slice(0, 10), repeatDaysOf(b, servicesQuery.data ?? []));
    if (!slot) toast.info(t('board.nextVisit.noSlot'));
    setDate(target);
    openWindow({
      new: '1',
      staff: b.staffId,
      date: target,
      ...(slot ? { start: slot.time } : {}),
      ...(b.clientId ? { client: b.clientId } : {}),
      services: b.services.map((l) => l.serviceId).join(','),
    });
  });
  useEffect(() => {
    const onNext = (e: Event) => void nextVisitHandler((e as CustomEvent<Id>).detail);
    window.addEventListener(NEXT_VISIT_EVENT, onNext);
    return () => window.removeEventListener(NEXT_VISIT_EVENT, onNext);
  }, []);


  // Первая загрузка — не отдельная заглушка, а сама страница (DESIGN.md → «The skeleton IS the page», владелец
  // 30.09.2026): ряд управления, итоги, рамка сетки с шапками колонок и линиями часов, панель «Требует внимания» —
  // на своих местах; вместо данных — полосы (DayGridSkeleton, *Skeleton рядом с компонентами). Приехали данные —
  // ничего не сдвигается, полосы заполняются.
  const loading = !ready || isLoading;
  // Раскладка сетки (колонки, часы) — запоминается, чтобы следующий скелетон встал ровно по ней
  const [gridShape, saveGridShape] = useDayGridShape();
  useSaveDayGridShape(
    saveGridShape,
    loading || view !== 'day' || dayLayout !== 'columns' || gridModel.columns.length === 0
      ? null
      : {
          columns: gridModel.columns.length,
          ...computeDayRange(
            gridModel.columns.map((c) => (c.kind === 'staff' ? c.hours : [])),
            Object.values(gridModel.bookingsByColumn)
              .flat()
              .map((b) => ({ from: startMinutes(b), to: startMinutes(b) + b.durationMin })),
          ),
        },
  );
  if (!loading && isError) {
    return (
      <ErrorState
        onRetry={() => {
          staffQuery.refetch();
          hoursQuery.refetch();
          bookingsQuery.refetch();
          clientsQuery.refetch();
          servicesQuery.refetch();
        }}
      />
    );
  }

  const {
    allStaff,
    staffForView,
    staffWithSchedule,
    positions,
    byPositionColumns,
    resources,
    visibleBookings,
    bookingsByColumn,
    columns,
    groupEventsByColumn,
    participantCountByEvent,
  } = gridModel;
  const hiddenStatuses = prefsHiddenStatuses ?? [];
  // empty-d1.md #1: «Новая запись» открывала черновик без адресата, когда некого/нечего записывать.
  const hasAnyServices = (servicesQuery.data ?? []).length > 0;
  const canCreateBooking = staffWithSchedule.length > 0 && hasAnyServices;
  const newBookingDisabledReason = !hasAnyServices ? t('header.newBookingDisabledNoServices') : t('header.newBookingDisabledNoStaff');

  // F-16-024: число колонок на экране телефона — по умолчанию от прав (журнал одного сотрудника — 1,
  // нескольких — 3), потолок — 3 у ресурсов и 5 у сотрудников; в неделе не применяется, но и не теряется.
  const savedZoomMin = prefsQuery.data?.zoomMin ?? 15;
  const effectiveZoomMin = scalePreview?.zoomMin ?? savedZoomMin;
  // Журнал A2 (A2-phone.png): на телефоне по умолчанию два мастера на экран, остальные — прокруткой вбок
  const defaultMobileColumns = canSeeOthers && journalRights.viewStaffScope === 'all' ? 2 : 1;
  const mobileColumns = Math.min(scalePreview?.columns ?? savedMobileColumns ?? defaultMobileColumns, maxMobileColumns(groupBy));
  const openScale = () =>
    setScalePreview({ groupBy: savedGroupBy, zoomMin: savedZoomMin, columns: savedMobileColumns ?? defaultMobileColumns });
  const saveScale = () => {
    if (!scalePreview) return;
    if (scalePreview.groupBy !== savedGroupBy) setGroupByOverride(scalePreview.groupBy);
    if (scalePreview.zoomMin !== savedZoomMin) zoomMutation.mutate(scalePreview.zoomMin);
    if (view === 'day') setSavedMobileColumns(scalePreview.columns);
    setScalePreview(null);
  };


  // F-16-020: экземпляр ресурса, выбранный для недельного вида (fallback — первый экземпляр первого ресурса)
  const weekResourceOptions = resources.flatMap((r) => r.instances.map((inst) => ({ resource: r, instanceId: inst.id, instanceName: inst.name })));
  const effectiveWeekResourceInstanceId = weekResourceInstanceId || (weekResourceOptions[0] ? `${weekResourceOptions[0].resource.id}:${weekResourceOptions[0].instanceId}` : '');
  const weekResourceOption = weekResourceOptions.find((o) => `${o.resource.id}:${o.instanceId}` === effectiveWeekResourceInstanceId);
  const weekStaff = allStaff.find((s) => s.id === weekStaffId) ?? allStaff[0];

  const activeBooking = bookingId ? (bookingsQuery.data ?? []).find((b) => b.id === bookingId) : undefined;

  // F-01-025: при смешанном типе журнала клик по пустой ячейке сперва спрашивает «Запись / Событие».
  // Настроечного тумблера «Тип записи» (F-01-167) в этой пачке нет — читаем по функции сферы
  // (группы есть — «Смешанная», иначе «Индивидуальная», выбора не показываем совсем).
  // F-01-167: тип записи из настроек журнала («auto» — по функциям сферы, как было до этой пачки)
  const recordType = journalSettingsQuery.data?.recordType ?? 'auto';
  const effectiveRecordType = recordType === 'auto' ? (sphereHas('groups') ? 'mixed' : 'individual') : recordType;

  const startCreate = (staffIdForNew: Id, time: string) => {
    if (effectiveRecordType === 'group') {
      router.push(`/biz/groups?new=1&staff=${staffIdForNew}&start=${time}&date=${date}`);
      return;
    }
    // F-02-036: клик по пустому месту сетки всегда спрашивает «Запись / Событие (если есть) / Перерыв» —
    // раньше «Индивидуальная» создавала запись сразу, минуя выбор, и перерыв был доступен только через
    // меню имени сотрудника (F-02-026), не с самого пустого места.
    if (staffIdForNew) {
      setMixedTypeChoice({ staffId: staffIdForNew, time, showEvent: effectiveRecordType === 'mixed' });
      return;
    }
    openWindow({ new: '1', staff: staffIdForNew, start: time, date });
  };

  const handleCreate = (columnId: Id, time: string) => {
    const staffFromColumn = byPositionColumns.find((c) => c.id === columnId);
    const staffIdForNew = (staffFromColumn?.kind === 'staff' ? staffFromColumn.staff.id : undefined) ?? staffWithSchedule[0]?.id ?? '';
    startCreate(staffIdForNew, time);
  };

  // ── Журнал A2 ───────────────────────────────────────────────────────────────────────────────
  const hoursByStaff = hoursQuery.data ?? {};
  const services = servicesQuery.data ?? [];
  const lacquers = lacquersQuery.data ?? {};
  const servicesById = new Map(services.map((sv) => [sv.id, sv]));
  const toneOf = (b: (typeof visibleBookings)[number]) => bookingTone(b, lacquers[b.id], servicesById);
  // Итоги дня — по мастерам, которые сейчас на экране (фильтр «Все мастера» и должность учитываются)
  const shownStaffIds = byPositionColumns.map((c) => c.id);
  const totalsBookings = groupBy === 'staff' ? visibleBookings.filter((b) => shownStaffIds.includes(b.staffId)) : visibleBookings;
  const totals = dayTotals(
    totalsBookings,
    Object.fromEntries(shownStaffIds.map((id) => [id, hoursByStaff[id] ?? []])),
    Object.fromEntries(shownStaffIds.map((id) => [id, bookingsByColumn[id] ?? []])),
  );
  const nextQuarter = () => {
    const isToday = date === today();
    return isToday ? fromMinutes(Math.min(Math.ceil(toMinutes(nowYerevan().format('HH:mm')) / 15) * 15, 23 * 60)) : '10:00';
  };
  const canPackage = canCreate && services.length >= 2 && staffWithSchedule.length > 0;

  // «Найти окно» (FindSlotButton): услуги, которые делает кто-то из работающих сегодня; окна — по ВСЕМ записям мастера
  // (фильтр статусов в сетке скрывает записи, но не освобождает время), сегодня — не раньше «сейчас»
  const dayStaffIds = new Set(staffWithSchedule.map((s) => s.id));
  const slotServices = services.filter((sv) => sv.active && sv.kind === 'individual' && sv.staffIds.some((id) => dayStaffIds.has(id)));
  const slotService = slotServices.find((sv) => sv.id === slotServiceId);
  const slotGaps = (() => {
    if (!slotService || view !== 'day' || groupBy !== 'staff') return [];
    const activeByStaff: Record<Id, Booking[]> = {};
    for (const b of bookingsQuery.data ?? []) if (isActiveBooking(b)) (activeByStaff[b.staffId] ??= []).push(b);
    // Кресло/кабинет, без которых услугу не сделать (F-00-149): окно годится, только если есть свободный экземпляр
    const needed = resources.filter((r) => r.active && r.serviceIds.includes(slotService.id)).map((r) => ({ instanceIds: r.instances.map((i) => i.id) }));
    const resourceBusy = (bookingsQuery.data ?? [])
      .filter((b) => isActiveBooking(b) && b.resourceIds.length > 0)
      .map((b) => ({ instanceIds: b.resourceIds, from: toMinutes(b.start.slice(11, 16)), to: toMinutes(b.start.slice(11, 16)) + b.durationMin }));
    return findSlotGaps({
      staff: staffWithSchedule.filter((s) => slotService.staffIds.includes(s.id)).map((s) => ({ id: s.id, hours: hoursByStaff[s.id] ?? [] })),
      bookingsByStaff: activeByStaff,
      durationMin: slotService.durationMin,
      notBefore: date === today() ? toMinutes(nowYerevan().format('HH:mm')) : 0,
      resources: needed,
      resourceBusy,
    });
  })();
  const slotGapsByColumn: Record<Id, { from: number; to: number }[]> = {};
  for (const g of slotGaps) (slotGapsByColumn[g.staffId] ??= []).push({ from: g.from, to: g.to });
  const slotSuggestions = nearestSlots(slotGaps, byPositionColumns.map((c) => c.id));
  const pickSlot = (staffId: Id, time: string) => {
    if (!slotService) return;
    openWindow({ new: '1', staff: staffId, start: time, date, services: slotService.id });
  };
  const findSlotButton = canCreate && (canCreateBooking || loading) && view === 'day' && groupBy === 'staff' && (
    <FindSlotButton
      disabled={loading}
      services={slotServices}
      serviceId={slotService?.id ?? null}
      onServiceChange={setSlotServiceId}
      suggestions={slotSuggestions}
      staffById={new Map(allStaff.map((s) => [s.id, s]))}
      date={date}
      onPick={pickSlot}
    />
  );

  // Карточка → окно записи общим элементом (DESIGN.md → Motion): сначала карточка получает имя перехода (обычный
  // рендер), в следующем кадре навигация идёт внутри transition — имя «переезжает» на рамку окна. Без View Transitions
  // в браузере — просто открываем окно.
  const supportsSharedTransition = typeof document !== 'undefined' && 'startViewTransition' in document;
  function openBooking(id: Id) {
    if (!supportsSharedTransition) {
      openWindow({ booking: id });
      return;
    }
    setSharedBookingId(id);
    requestAnimationFrame(() => startSharedTransition(() => openWindow({ booking: id })));
  }
  // «N ждут подтверждения» и «опаздывает» в строках над журналом раскрывают панель «Требует внимания»
  const openAttention = () => {
    try {
      window.localStorage.setItem('journal.attention.open', '1');
    } catch {
      /* без памяти — не страшно */
    }
    window.dispatchEvent(new Event('journal:attention-open'));
  };
  // Владелец 01.10.2026: мастер без права видеть чужих (journal.others / «только свои») в «Требует внимания» и строке
  // «Сейчас» видит только своё — своих опоздавших, свои заявки, своё «Завтра не подтвердили»
  const ownOnlyStaffId = canSeeOthers && viewStaffScope === 'all' ? undefined : ownStaffId;
  const scopedBookings = ownOnlyStaffId ? visibleBookings.filter((b) => b.staffId === ownOnlyStaffId) : visibleBookings;
  const attentionProps = {
    date,
    businessId: businessId ?? '',
    bookings: scopedBookings,
    onlyStaffId: ownOnlyStaffId,
    clientsById,
    staff: staffWithSchedule,
    hoursByStaff,
    services,
    toneOf,
    onOpenBooking: (id: Id) => openBooking(id),
    onOpenWaitlist: () => setWaitlistOpen(true),
  };
  // Закрытие — собственный выход шторки (HoldWhileClosing), а не обратный общий переход: тот снимал окно за один
  // кадр и заново оборачивал карточку, пересоздавая её (scripts/flicker.mjs, journal-open).
  const closeBookingWindow = () => {
    setSharedBookingId(null);
    closeWindow();
  };

  const viewSwitch = (
    <SegmentedControl
      size="sm"
      aria-label={t('board.view.label')}
      value={view}
      onValueChange={(v) => {
        setView(v as JournalView);
        // Неделя открывается на мастере с графиком: у владельца без своих смен неделя была бы пустой
        if (v === 'week' && !staffWithSchedule.some((s) => s.id === weekStaffId) && staffWithSchedule[0]) setWeekStaffId(staffWithSchedule[0].id);
        else if (v === 'week' && !weekStaffId && allStaff[0]) setWeekStaffId(allStaff[0].id);
      }}
      options={[
        { value: 'day', label: t('board.view.day') },
        { value: 'week', label: t('board.view.week') },
        { value: 'month', label: t('board.view.month') },
      ]}
    />
  );
  // «Работают сейчас»: у кого текущая минута внутри рабочих часов
  const nowMinute = toMinutes(nowYerevan().format('HH:mm'));
  const workingNowIds = staffWithSchedule
    .filter((s) => (hoursByStaff[s.id] ?? []).some((h) => toMinutes(h.from) <= nowMinute && nowMinute < toMinutes(h.to)))
    .map((s) => s.id);
  const mastersPicker = (
    <MastersPicker
      view={view}
      staff={staffWithSchedule}
      hiddenStaffIds={hiddenStaffIds}
      onHiddenStaffChange={setHiddenStaffIds}
      canSeeOthers={canSeeOthers}
      groupBy={groupBy}
      onGroupByChange={setGroupByOverride}
      positions={positions}
      positionFilter={positionFilter}
      onPositionFilterChange={setPositionFilterOverride}
      resources={resources}
      resourceFilter={resourceFilter}
      onResourceFilterChange={setResourceFilterOverride}
      allStaff={allStaff}
      weekStaffId={weekStaff?.id ?? ''}
      onWeekStaffChange={setWeekStaffId}
      weekSubjectKind={weekSubjectKind}
      onWeekSubjectKindChange={setWeekSubjectKind}
      weekResourceOptions={weekResourceOptions}
      weekResourceInstanceId={effectiveWeekResourceInstanceId}
      onWeekResourceInstanceChange={setWeekResourceInstanceId}
      workingNowIds={date === today() ? workingNowIds : undefined}
      setsStaffId={ownStaffId}
      loading={loading}
    />
  );
  const newBookingButton =
    canCreate &&
    // qa/measure/journal/empty-d1.md #1: в пустом бизнесе (нет услуг или графика) кнопка неактивна с подсказкой почему
    (canCreateBooking || loading ? (
      <Button
        data-f="F-01-184 F-14-089 F-14-090"
        leftIcon={<Plus aria-hidden />}
        disabled={loading}
        onClick={() => startCreate(staffWithSchedule[0]?.id ?? '', nextQuarter())}
      >
        {/* 768–1279px — только «+»: иначе ряд кнопок выталкивает дату целиком */}
        <span className="md:max-xl:sr-only">{t('newBooking')}</span>
      </Button>
    ) : (
      <Tooltip content={newBookingDisabledReason}>
        <Button data-f="F-01-184" leftIcon={<Plus aria-hidden />} disabled>
          {t('newBooking')}
        </Button>
      </Tooltip>
    ));

  // Сетка дня не размонтируется при переходе на неделю/месяц — прячется: возврат к дню не пересобирает десятки
  // карточек (DESIGN.md → Performance: «День → Неделя → День» без рывка)
  const dayGrid = (
      // F-16-024: журнал ресурсов на телефоне — до 3 колонок экземпляров на экран, остальные прокруткой
      <DayGrid
        className={view === 'day' && dayLayout === 'columns' ? 'flex-1' : 'hidden'}
        date={date}
        columns={columns}
        bookingsByColumn={bookingsByColumn}
        clientsById={clientsById}
        services={services}
        extrasById={extrasQuery.data ?? {}}
        lacquersById={lacquers}
        bookingCategories={bookingCategoriesQuery.data ?? []}
        firstLineMode={journalSettingsQuery.data?.firstLineMode ?? 'clientName'}
        showPhones={journalRights.showPhones}
        zoomMin={effectiveZoomMin}
        staffMarkupMin={prefsQuery.data?.staffMarkupMin ?? {}}
        breakOverrideMin={prefsQuery.data?.breakOverrideMin ?? {}}
        breakCombineMode={prefsQuery.data?.breakCombineMode ?? 'longest'}
        canCreate={canCreate}
        canResize={canReschedule}
        onCreate={handleCreate}
        onOpen={openBooking}
        groupEventsByColumn={groupEventsByColumn}
        participantCountByEvent={participantCountByEvent}
        seriesDefsById={seriesDefsById}
        onOpenGroupEvent={openGroupEvent}
        hasServices={services.length > 0}
        hasStaff={allStaff.length > 0}
        allStaff={allStaff}
        allResources={resources}
        showCrossColumnInfo={journalSettingsQuery.data?.showOccupiedResourcesForStaff ?? false}
        columnsPerScreen={isMobile ? mobileColumns : undefined}
        slotGaps={slotService ? slotGapsByColumn : undefined}
        slotDurationMin={slotService?.durationMin}
        onPickSlot={pickSlot}
      />
  );
  // Виды дня «Обзор / Лента / Список» — те же колонки и записи, что у сетки; «Колонки» (DayGrid) при этом лишь скрыты
  const dayViewProps = {
    date,
    columns,
    bookingsByColumn,
    clientsById,
    services,
    toneOf,
    showPhones: journalRights.showPhones,
    canCreate,
    onCreate: handleCreate,
    onOpen: openBooking,
    slotGaps: slotService ? slotGapsByColumn : undefined,
    slotDurationMin: slotService?.durationMin,
    onPickSlot: pickSlot,
    groupEventsByColumn,
    participantCountByEvent,
    onOpenGroupEvent: openGroupEvent,
    className: 'flex-1',
  };
  const altDayView =
    view !== 'day' || dayLayout === 'columns' ? null : dayLayout === 'overview' ? (
      <DayOverview {...dayViewProps} />
    ) : dayLayout === 'timeline' ? (
      <DayTimeline {...dayViewProps} isPhone={isMobile} canMove={canReschedule} allResources={resources} />
    ) : (
      <DayList {...dayViewProps} />
    );
  const layoutIcons: Record<DayLayout, ReactNode> = {
    columns: <Columns3 aria-hidden />,
    overview: <Columns4 aria-hidden />,
    timeline: <ChartNoAxesGantt aria-hidden />,
    list: <List aria-hidden />,
  };
  // Подписи видны с 1280px; уже — только значки (подпись остаётся для чтения с экрана)
  const layoutSwitch = (withLabels: boolean) => (
    <SegmentedControl
      size="sm"
      fullWidth={withLabels}
      aria-label={t('board.layout.label')}
      value={dayLayout}
      onValueChange={(v) => setDayLayout(v as DayLayout)}
      options={DAY_LAYOUTS.map((l) => ({
        value: l,
        // В «⋯ Ещё» на телефоне — только подписи: с значками четыре вида не влезают в ширину
        icon: withLabels ? undefined : layoutIcons[l],
        label: <span className={withLabels ? undefined : 'sr-only xl:not-sr-only'}>{t(`board.layout.${l}`)}</span>,
      }))}
    />
  );

  const otherView =
    view === 'day' ? null : view === 'month' ? (
      <MonthGrid
        date={date}
        staffIds={staffForView.map((s) => s.id)}
        businessIds={activeBusinessIds}
        onPickDay={(d) => {
          setDate(d);
          setView('day');
        }}
      />
    ) : weekSubjectKind === 'resource' && weekResourceOption && businessId ? (
      <WeekGrid
        date={date}
        businessId={businessId}
        subject={{ kind: 'resource', resource: weekResourceOption.resource, instanceId: weekResourceOption.instanceId, instanceName: weekResourceOption.instanceName }}
        clientsById={clientsById}
        services={services}
        zoomMin={effectiveZoomMin}
        canCreate={canCreate}
        firstLineMode={journalSettingsQuery.data?.firstLineMode ?? 'clientName'}
        showPhones={journalRights.showPhones}
        onCreate={(d, time) => {
          setDate(d);
          // Пустая ячейка недели ресурса — тот же fallback-мастер, что у ресурсных колонок дня
          startCreate(staffWithSchedule[0]?.id ?? '', time);
        }}
        onOpen={(id) => openWindow({ booking: id })}
      />
    ) : weekSubjectKind === 'staff' && weekStaff && businessId ? (
      <WeekGrid
        date={date}
        businessId={businessId}
        subject={{ kind: 'staff', staff: weekStaff }}
        clientsById={clientsById}
        services={services}
        zoomMin={effectiveZoomMin}
        canCreate={canCreate}
        firstLineMode={journalSettingsQuery.data?.firstLineMode ?? 'clientName'}
        showPhones={journalRights.showPhones}
        onCreate={(d, time) => {
          setDate(d);
          startCreate(weekStaff.id, time);
        }}
        onOpen={(id) => openWindow({ booking: id })}
      />
    ) : (
      <EmptyDayState hasServices={services.length > 0} hasStaff={allStaff.length > 0} />
    );

  return (
    // F-01-001: отдельного режима «Администрирование» в этой архитектуре нет — кнопка в «⋯ Ещё» (JournalSidebar).
    // F-01-204: стартовая страница после входа — этот экран (redirect в src/app/biz/page.tsx).
    <div
      data-f="F-01-006 F-01-186 F-01-188 F-01-205 F-01-220 F-01-167 F-01-204 F-14-085 F-14-086 F-14-087 F-01-033 F-01-002"
      className="flex h-[calc(100dvh-148px)] min-h-[520px] flex-col md:h-[calc(100dvh-124px)] lg:h-[calc(100dvh-140px)]"
    >
      <h1 className="sr-only">{t('board.title')}</h1>
      <OfflineBanner />

      {isMobile ? (
        <div className="-mx-4 -mt-5 flex flex-col gap-3 pb-3">
          {/* Единая шапка телефона 56px + полоса недели (DESIGN.md → Journal 5, A2-phone.png): меню · месяц/салон ·
              поиск · колокольчик — вместо полосы каркаса над журналом и второй шапки под ней (F-01-187, F-01-017,
              F-01-007). Обе — сплошным белым блоком во всю ширину, как в макете. */}
          <div className="flex flex-col gap-2 border-b border-border bg-surface pb-2">
            <PhoneHeader
              date={date}
              salonName={businessQuery.data?.name}
              salonLoading={loading || businessQuery.isLoading}
              onOpenCalendar={() => setMobileCalendarOpen(true)}
              onOpenMenu={() => requestShellDrawerOpen()}
              onSearch={() => setClientsOpen(true)}
            />
            {view === 'day' && (
              <div className="px-3">
                <WeekStrip date={date} onDateChange={setDate} staffIds={staffForView.map((s) => s.id)} />
              </div>
            )}
          </div>
          {view === 'day' && (loading || businessId) && (
            // «Найти окно» и на телефоне — рядом с «Требует внимания»; панель открывается нижней шторкой
            // Плашка «ждут подтверждения» не сжимается кнопкой: не влезают рядом — кнопка уходит строкой ниже
            <div className="flex flex-wrap items-center gap-2 px-4">
              <div className="min-w-[60%] flex-1 empty:hidden">
                {loading ? (
                  // Типичный день: есть заявки, ждущие подтверждения, — плашка на своём месте уже при загрузке
                  <PendingBarSkeleton />
                ) : (
                  <AttentionSheetTrigger
                    {...attentionProps}
                    open={attentionSheetOpen}
                    onOpenChange={setAttentionSheetOpen}
                    title={t('board.attention.title')}
                  />
                )}
              </div>
              {findSlotButton}
            </div>
          )}
        </div>
      ) : (
        // Ряд управления 72px под полосой каркаса (полоса снова на месте на любой ширине, owner 27.09.2026):
        // переключатель филиала — в «⋯ Ещё» (JournalMoreSheet); уведомления и меню пользователя не дублируем
        // здесь второй раз — они уже в полосе каркаса выше.
        <div
          data-f="F-01-009 F-01-012 F-01-013 F-01-014 F-01-015"
          className="-mx-6 -mt-5 flex min-h-[72px] items-center gap-3 border-b border-border bg-surface px-4 lg:-mx-8 lg:-mt-7 lg:px-6"
        >
          <JournalDateNav date={date} onDateChange={setDate} view={view} staffIds={staffForView.map((s) => s.id)} />
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {viewSwitch}
            {mastersPicker}
            {findSlotButton}
            <IconButton variant="outline" icon={<Search aria-hidden />} label={t('board.search')} onClick={() => setClientsOpen(true)} />
            <IconButton
              data-f="F-01-010 F-01-011 F-01-016"
              variant="outline"
              icon={<MoreHorizontal aria-hidden />}
              label={t('board.more')}
              onClick={() => setMoreOpen(true)}
            />
            {newBookingButton}
          </div>
        </div>
      )}

      <div className="flex min-h-0 flex-1 gap-5 md:pt-4">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          {/* Итоги и «Требует внимания» смонтированы и в неделе/месяце (скрыты): возврат в день их не пересоздаёт */}
          {!isMobile && (
            <div className={view === 'day' ? 'flex flex-wrap items-center justify-between gap-x-4 gap-y-2' : 'hidden'}>
            {!loading && (
              <DayNow
                date={date}
                bookings={scopedBookings}
                clientsById={clientsById}
                staff={staffWithSchedule}
                services={services}
                onOpenBooking={(id) => openBooking(id)}
                onOpenAttention={openAttention}
                className="basis-full"
              />
            )}
            {loading ? <DayTotalsSkeleton /> : <DayTotals totals={totals} onPendingClick={openAttention} />}
            {layoutSwitch(false)}
            </div>
          )}
          {/* Карточка «перетекает» в окно записи — имя перехода через контекст, сетка дня при этом не перерисовывается */}
          {loading ? (
            <DayGridSkeleton
              className="flex-1"
              date={date}
              shape={gridShape}
              zoomMin={effectiveZoomMin}
              columnsPerScreen={isMobile ? mobileColumns : undefined}
            />
          ) : (
            <>
              <OpenBookingContext value={windowOpen ? bookingId : undefined}>{dayGrid}</OpenBookingContext>
              {altDayView}
              {otherView}
            </>
          )}
        </div>
        {!isMobile && (loading || businessId) && (
          <div className={view === 'day' ? 'contents' : 'hidden'}>
            <AttentionPanel {...attentionProps} loading={loading} />
          </div>
        )}
      </div>

      {!loading && (
      <>
      <HoldWhileClosing>
      {isMobile && scalePreview ? (
        <JournalScaleSheet
          open
          value={scalePreview}
          onChange={setScalePreview}
          onSave={saveScale}
          onCancel={() => setScalePreview(null)}
          showColumns={view === 'day'}
          canSwitchMode={canSeeOthers}
        />
      ) : null}
      </HoldWhileClosing>

      <JournalMoreSheet
        open={moreOpen}
        onOpenChange={setMoreOpen}
        date={date}
        onDateChange={setDate}
        businessId={businessId}
        locationId={activeLocationIds[0] ?? ''}
        staffIds={staffForView.map((s) => s.id)}
        showStatistics={journalRights.showStatistics}
        canAddStaff={canAddStaff}
        onAddStaff={() => setAddStaffOpen(true)}
        canPackage={canPackage}
        onNewPackage={() => setPackageOpen(true)}
        onOpenScale={isMobile ? openScale : undefined}
        onOpenClients={() => setClientsOpen(true)}
        isFavorite={isJournalFavorite}
        onToggleFavorite={businessId && ownStaffId ? () => favoriteMutation.mutate(JOURNAL_FAVORITE) : undefined}
        showWaitlist={showWaitlistTile}
        onOpenWaitlist={() => setWaitlistOpen(true)}
        onOpenStaffDay={(d, staffId) => {
          // «Загрузка недели»: день в журнале; клетка мастера — в сетке остаётся только он («Все мастера» вернут всех)
          setDate(d);
          setView('day');
          setHiddenStaffIds(staffId ? staffForView.filter((s) => s.id !== staffId).map((s) => s.id) : []);
        }}
        top={
          // Переключатель филиала уже есть в полосе каркаса выше — здесь тот же выбор доступен без «⋯ Ещё»
          // на телефоне (там своей полосы каркаса ряд управления не показывает).
          <div className="flex flex-col gap-3">
            {isMobile && viewSwitch}
            {isMobile && view === 'day' && layoutSwitch(true)}
            {isMobile && mastersPicker}
            <LocationSwitcher className="w-full" />
          </div>
        }
        grid={{
          hiddenStatuses,
          onHiddenStatusesChange: (list) => hiddenMutation.mutate(list),
          zoomMin: effectiveZoomMin,
          onZoomChange: (z) => zoomMutation.mutate(z),
          breakCombineMode: prefsQuery.data?.breakCombineMode ?? 'longest',
          onBreakCombineModeChange: (m) => breakModeMutation.mutate(m),
          splitByResourceEnabled: prefsQuery.data?.splitByResourceEnabled ?? false,
          onSplitByResourceChange: (v) => splitByResourceMutation.mutate(v),
          canEditSchedule,
        }}
      />

      <HoldWhileClosing>
      {packageOpen && businessId ? (
        <PackageCreateModal
          open={packageOpen}
          onOpenChange={setPackageOpen}
          businessId={businessId}
          locationId={activeLocationIds[0] ?? ''}
          date={date}
          services={services}
          staffList={allStaff}
          onCreated={() => bookingsQuery.refetch()}
        />
      ) : null}
      </HoldWhileClosing>

      <HoldWhileClosing>
      {addStaffOpen && businessId ? (
        <StaffScheduleModal
          open={addStaffOpen}
          onOpenChange={setAddStaffOpen}
          date={date}
          staffList={allStaff}
          onSaved={() => {
            staffQuery.refetch();
            hoursQuery.refetch();
          }}
        />
      ) : null}
      </HoldWhileClosing>

      {/* F-01-187: календарь загрузки месяца на телефоне — из заголовка «Сентябрь ⌄» */}
      {isMobile && (
        <Sheet open={mobileCalendarOpen} onOpenChange={setMobileCalendarOpen} title={t('sidebar.title')} side="bottom" size="md">
          <JournalSidebar
            inSheet
            collapsed={false}
            onToggleCollapsed={() => {}}
            date={date}
            onDateChange={(d) => {
              setDate(d);
              setMobileCalendarOpen(false);
            }}
            staffIds={staffForView.map((s) => s.id)}
            showWaitlist={showWaitlistTile}
            onOpenWaitlist={() => setWaitlistOpen(true)}
            businessId={businessId}
            locationId={activeLocationIds[0] ?? ''}
          />
        </Sheet>
      )}

      {/* F-01-017: клиенты и чат — по кнопке поиска, шторкой поверх журнала */}
      {businessId && (
        <Sheet open={clientsOpen} onOpenChange={setClientsOpen} title={t('rightPanel.toggle')} side="auto" size="md">
          <RightPanel
            inSheet
            businessId={businessId}
            date={date}
            onOpenBooking={(query) => {
              setClientsOpen(false);
              // Запись из поиска на другом дне: журнал сразу встаёт на её день, окно открывается поверх него
              if (query.date) setDate(query.date);
              openWindow(query);
            }}
            onOpenStaffWeek={(staffId) => {
              setClientsOpen(false);
              setWeekStaffId(staffId);
              setWeekSubjectKind('staff');
              setView('week');
            }}
          />
        </Sheet>
      )}

      {/* Закрытие по адресу снимало окно в том же кадре — держим его, пока шторка уезжает */}
      <HoldWhileClosing>
      {windowOpen && windowMounted ? (
        <BookingWindow
          // Другая запись или новые параметры новой записи («Записать на следующий визит» из открытого окна) — окно
          // собирается заново: состояние формы берётся из пропсов только при монтировании
          key={bookingId ?? `new:${newStaffParam ?? ''}:${date}:${newStartParam ?? ''}:${newClientParam ?? ''}:${newServicesParam ?? ''}`}
          open={windowOpen}
          onOpenChange={(open) => {
            if (!open) closeBookingWindow();
          }}
          booking={activeBooking}
          staffList={allStaff}
          initialStaffId={newStaffParam}
          initialClientId={newClientParam}
          initialPhone={newPhoneParam}
          initialName={newNameParam}
          initialServiceIds={newServicesParam ? newServicesParam.split(',') : undefined}
          date={date}
          initialTime={newStartParam}
          locationId={activeLocationIds[0] ?? ''}
          onSaved={(saved) => {
            bookingsQuery.refetch();
            if (isNew && waitlistParam && saved) void closeWaitlistEntry(waitlistParam, saved.id).catch(() => undefined);
          }}
        />
      ) : null}
      </HoldWhileClosing>

      {/* Второй конец общего элемента «карточка → окно»: невидимая рамка на месте окна записи */}
      {windowOpen && bookingId && (
        <SharedWindowFrame
          bookingId={bookingId}
          className="pointer-events-none fixed inset-x-0 bottom-0 z-[45] h-[90dvh] rounded-t-2xl sm:inset-y-0 sm:right-0 sm:left-auto sm:h-dvh sm:w-[min(60rem,calc(100vw-5rem))] sm:rounded-l-2xl sm:rounded-tr-none"
        />
      )}

      {businessId && (
        <FreeTodaySheet
          open={freeTodayOpen}
          onOpenChange={setFreeTodayOpen}
          businessId={businessId}
          date={today()}
          staff={staffWithSchedule}
          hoursByStaff={hoursByStaff}
          bookings={date === today() ? visibleBookings : undefined}
          services={services}
        />
      )}

      {businessId && (
        <ConfirmTomorrowSheet
          open={confirmTomorrowOpen}
          onOpenChange={setConfirmTomorrowOpen}
          businessIds={activeBusinessIds}
          onlyStaffId={ownOnlyStaffId}
          businessName={businessQuery.data?.name ?? ''}
          clientsById={clientsById}
          staff={allStaff}
          services={services}
          onOpenBooking={(id) => {
            setConfirmTomorrowOpen(false);
            setDate(addDays(today(), 1));
            openBooking(id);
          }}
        />
      )}

      {/* ⭐ Рабочий день: утренняя сводка, незакрытые визиты, итоги дня (открываются событием openWorkdaySheet) */}
      {businessId && (
        <WorkdaySheets
          businessId={businessId}
          date={date}
          onlyStaffId={ownOnlyStaffId}
          staff={allStaff}
          services={services}
          onOpenBooking={(id, day) => {
            if (day !== date) setDate(day);
            openBooking(id);
          }}
        />
      )}

      {businessId && (
        <WaitlistPanel
          open={waitlistOpen}
          onOpenChange={setWaitlistOpen}
          businessId={businessId}
          locationId={activeLocationIds[0] ?? ''}
          staffList={allStaff}
          date={date}
        />
      )}

      <HoldWhileClosing>
      {mixedTypeChoice ? (
        <MixedTypeChoice
          open
          onOpenChange={(o) => !o && setMixedTypeChoice(null)}
          onChooseRecord={() => {
            openWindow({ new: '1', staff: mixedTypeChoice.staffId, start: mixedTypeChoice.time, date });
            setMixedTypeChoice(null);
          }}
          onChooseEvent={
            mixedTypeChoice.showEvent
              ? () => {
                  router.push(`/biz/groups?new=1&staff=${mixedTypeChoice.staffId}&start=${mixedTypeChoice.time}&date=${date}`);
                  setMixedTypeChoice(null);
                }
              : undefined
          }
          onChooseBreak={() => {
            setBreakChoice({ staffId: mixedTypeChoice.staffId, time: mixedTypeChoice.time });
            setMixedTypeChoice(null);
          }}
        />
      ) : null}
      </HoldWhileClosing>

      {/* F-02-036: перерыв прямо с пустого места сетки — та же форма, что у «Изменить рабочее время» (F-02-026) */}
      <HoldWhileClosing>
      {breakChoice && businessId ? (
        <StaffScheduleModal
          open
          onOpenChange={(o) => !o && setBreakChoice(null)}
          date={date}
          staffList={allStaff}
          fixedStaffId={breakChoice.staffId}
          initialHours={hoursQuery.data?.[breakChoice.staffId]}
          initialBreakStart={breakChoice.time}
          onSaved={() => {
            hoursQuery.refetch();
            bookingsQuery.refetch();
          }}
        />
      ) : null}
      </HoldWhileClosing>

      </>
      )}

      {/* F-01-024, F-00-004: «+ Запись» у большого пальца на телефоне — то же, что клик по пустой ячейке сетки */}
      {/* Под открытым окном кнопка скрыта, а не снята: закрытие окна не пересоздаёт её */}
      {isMobile && (loading || businessId) && canCreate && (loading || staffWithSchedule.length > 0) && (
        <Fab
          data-f="F-01-184"
          className={windowOpen ? 'hidden' : undefined}
          extended
          icon={<Plus aria-hidden />}
          label={t('board.phone.fab')}
          onClick={() => {
            if (loading) return;
            const staffId = staffWithSchedule.find((s) => s.id === ownStaffId)?.id ?? staffWithSchedule[0]?.id ?? '';
            openWindow({ new: '1', staff: staffId, start: nextQuarter(), date });
          }}
        />
      )}

      {isMobile && <JournalBottomNav onMore={() => setMoreOpen(true)} />}

      {/* ⭐ Рабочий день №8 и №12: горячие клавиши (физические — любая раскладка), «Лента изменений», подсветка чужих правок */}
      <JournalWorkday
        ready={!loading}
        businessIds={activeBusinessIds}
        date={date}
        ownStaffId={ownStaffId}
        onlyStaffId={ownOnlyStaffId}
        onOpenBooking={(id) => openWindow({ booking: id })}
        keys={{
          // «N» — сразу окно новой записи (как «+ Запись» на телефоне), без выбора «Запись / Перерыв»
          newBooking:
            canCreate && canCreateBooking
              ? () => {
                  const staffId = staffWithSchedule.find((s) => s.id === ownStaffId)?.id ?? staffWithSchedule[0]?.id ?? '';
                  if (effectiveRecordType === 'group') startCreate(staffId, nextQuarter());
                  else openWindow({ new: '1', staff: staffId, start: nextQuarter(), date });
                }
              : undefined,
          search: () => setClientsOpen(true),
          today: () => setDate(today()),
          prevDay: () => setDate(shiftDate(date, view, -1)),
          nextDay: () => setDate(shiftDate(date, view, 1)),
          ...Object.fromEntries(
            DAY_LAYOUTS.map((l, i) => [
              `layout${i + 1}`,
              () => {
                setView('day');
                setDayLayout(l);
              },
            ]),
          ),
          close: slotServiceId ? () => setSlotServiceId(null) : undefined,
        }}
      />
    </div>
  );
}

/** Телефон: жёлтая плашка «N ждут подтверждения» и шторка «Требует внимания» по ней (useAttention — хук, поэтому своим компонентом) */
function AttentionSheetTrigger({
  open,
  onOpenChange,
  title,
  ...props
}: AttentionData & { open: boolean; onOpenChange: (open: boolean) => void; title: string }) {
  const phone = useIsMobile();
  const attention = useAttention({ ...props, pollReminders: phone });
  const tLate = useT('journal');
  const format = useFormat({ hourCycle: useJournalHourFormat() });
  return (
    <>
      {attention.late.length > 0 && (
        <AlertBar tone="danger" label={tLate('board.attention.lateTitle', { n: attention.late.length })} onClick={() => onOpenChange(true)} />
      )}
      {attention.overruns.length > 0 && <AlertBar tone="warning" label={tLate('board.attention.overrunTitle')} onClick={() => onOpenChange(true)} />}
      {attention.reported.length + attention.refunds.length > 0 && (
        <AlertBar tone="warning" label={tLate('board.attention.moneyTitle')} onClick={() => onOpenChange(true)} />
      )}
      {attention.pending.length > 0 && (
        <PendingBar count={attention.pending.length} byTime={format.time(attention.pending[0].start)} onClick={() => onOpenChange(true)} />
      )}
      <Sheet open={open} onOpenChange={onOpenChange} title={title} side="bottom" size="md">
        <AttentionContent
          {...props}
          attention={attention}
          onOpenBooking={(id) => {
            onOpenChange(false);
            props.onOpenBooking(id);
          }}
          onOpenWaitlist={() => {
            onOpenChange(false);
            props.onOpenWaitlist();
          }}
        />
      </Sheet>
    </>
  );
}
