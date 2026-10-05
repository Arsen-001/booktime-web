'use client';

/**
 * Окно записи (пачка b02): F-01-025, F-01-037…045, F-01-047…058, F-01-060…066, F-01-211.
 * Три зоны (левая — параметры, центр — статус/состав визита, правая — клиент) плюс вкладки
 * вкладчиков хоста bookingWindow (F-01-037). Черновик формы переживает закрытие окна и
 * перезагрузку страницы (F-01-040) — хранится в своём срезе по ключу draftKey.
 */
import { startTransition, useDeferredValue, useEffect, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { CalendarPlus, ChevronRight, Copy, EyeOff, FastForward, FlagTriangleRight, Lock } from 'lucide-react';
import { useNowMinuteYerevan } from '@/areas/journal/lib/lateness';
import { canFinishEarly, canStartNow, useVisitTiming } from '@/areas/journal/lib/visitTiming';
import { findSameDaySlot, openNextVisit } from '@/areas/journal/lib/nextVisit';
import type { Booking, BookingStatus, Client, Id, ISODate, TimeHM, Workplace, Staff } from '@/domain/core';
import type { CustomFieldValue, JournalPaymentLine, WindowDraftSnapshot } from '@/domain/journal';
import type { BookingDraft as ExtBookingDraft } from '@/extensions/types';
import {
  addBookingCategory,
  attachLinkedBookings,
  checkLinkedBookings,
  clearDraft,
  decidePrepayment,
  deleteBookingWithAuthor,
  ensureAutoWriteoff,
  flushDraftSync,
  getBookingCategories,
  getBookingExtras,
  getCustomFieldDefs,
  getDeletionImpact,
  getFrequentServices,
  getJournalSettings,
  getGoodsCatalog,
  getLastClientService,
  getPackageSiblings,
  getPinnedFields,
  listOccupiedResourceInstanceIds,
  deleteWholePackage,
  findClientOverlap,
  hasOverlap,
  isWithinWorkingHours,
  loadDraft,
  logBookingHistory,
  resolveVisitId,
  syncArrivedConsequences,
  syncVisitStatus,
  saveDraft,
  setBookingBreakOverride,
  setBookingExtras,
  togglePinnedField,
  transferPackageTogether,
  undoDeleteBooking,
  markPrepaymentRefunded,
} from '@/api/journal';
import { getBookingPaymentSummary } from '@/api/finance';
import { changeBookingStatus, coreCreate, coreList, createBooking, findClientByPhone, updateBooking } from '@/api/core';
// F-01-207: личная скидка клиента — читаем как чужой раздел (clients), тот же приём, что у
// loyalty/network выше; только чтение, форма скидки живёт в карточке клиента.
import { getClientRow } from '@/api/clients/card';
// Л1: оплата визита и лояльность — один движок (@/api/loyalty): отмена оплаты возвращает и списанное лояльностью
import { cancelVisitPayments } from '@/api/loyalty';
import { ApiError, useApiMutation, useApiQuery } from '@/api/request';
import { listUpsellConfigs } from '@/api/services-upsell';
import { useCurrent } from '@/demo/hooks';
import { useExtensions } from '@/extensions/useExtensions';
import { ExtensionSlot } from '@/extensions/ExtensionSlot';
import { useSaveSteps } from '@/extensions/saveHooks';
import { useT } from '@/i18n/useT';
import { useFormat } from '@/i18n/useFormat';
import { useJournalHourFormat } from '@/areas/journal/lib/useJournalHourFormat';
import { useTDynamic } from '@/i18n/useTDynamic';
import { Skeleton } from '@/ui/Skeleton';
import { combine, nowDateTime, toMinutes } from '@/lib/date';
import { normalizePhone } from '@/lib/phone';
import { pickText } from '@/lib/text';
import { BOOKING_STATUS_META } from '@/domain/rules/booking-status';
import { effectiveBookingRules, freeCancelUntil, masterCancelRefund } from '@/domain/rules/booking-policy';
import { MAX_DURATION_MIN, MIN_DURATION_MIN } from '@/areas/journal/lib/grid';
import { canDeleteBooking, canEditBooking, useIsBeyondHistoryLimit, useJournalStaffScope, useWindowRights } from '@/areas/journal/lib/rights';
import type { UiGoodsLine, UiServiceLine } from '@/areas/journal/lib/lineTotals';
import { goodsLineTotal, serviceLineTotal, visitTotal } from '@/areas/journal/lib/lineTotals';
import { bookingCategoryLabel } from '@/areas/journal/lib/bookingCategoryLabel';
import { runBusy, succeeded } from '@/areas/journal/lib/tasks';
import { CenterZone, type CenterTab } from '@/areas/journal/components/booking-window/CenterZone';
import { ClientZone } from '@/areas/journal/components/booking-window/ClientZone';
import { ConsumablesTile } from '@/areas/journal/components/booking-window/ConsumablesTile';
import { ExpandedFieldsPanel } from '@/areas/journal/components/booking-window/ExpandedFieldsPanel';
import { HistoryPanel } from '@/areas/journal/components/booking-window/HistoryPanel';
import { PaymentPolicyBlock } from '@/areas/journal/components/booking-window/PaymentPolicyBlock';
import { LeftZone } from '@/areas/journal/components/booking-window/LeftZone';
import { PackageSiblingsPanel } from '@/areas/journal/components/booking-window/PackageSiblingsPanel';
import { PackageDraftPanel } from '@/areas/journal/components/booking-window/PackageDraftPanel';
import { usePackageDraft } from '@/areas/journal/components/booking-window/usePackageDraft';
import { linkedStarts, packageVisibleToStaff } from '@/domain/journalPackages';
import { isPackageBroken, toPackageServiceLite } from '@/api/resources';
import { PaymentSheet } from '@/areas/journal/components/booking-window/PaymentSheet';
import { RecurrenceForm } from '@/areas/journal/components/booking-window/RecurrenceForm';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { IconButton } from '@/ui/IconButton';
import { Sheet } from '@/ui/Sheet';
import { SWATCH_BG } from '@/ui/ColorSwatch';
import { Tabs } from '@/ui/Tabs';
import { useConfirm, useToast } from '@/ui/Toast';

export interface BookingWindowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking?: Booking;
  staffList: Staff[];
  initialStaffId?: Id;
  /** F-01-163: «Создать запись» из панели поиска клиента — подставляет клиента в новую запись */
  initialClientId?: Id;
  /** ?phone= (&name=): «Записать в филиал» из клиента сети — клиент этого филиала по номеру, иначе номер и имя в поля */
  initialPhone?: string;
  initialName?: string;
  date: string;
  initialTime?: string;
  locationId: Id;
  /** Аргумент — сохранённая запись (только после реального создания/правки, не после удаления) */
  onSaved: (booking?: Booking) => void;
  /** F-01-159: «Записать» из листа ожидания — комментарий и услуги заявки */
  initialComment?: string;
  initialServiceIds?: Id[];
}

interface DraftShape {
  staffId: string;
  workplace: Workplace;
  date: ISODate;
  time: TimeHM;
  durationMin: number;
  breakMin: number;
  status: BookingStatus;
  comment: string;
  phone: string;
  clientName: string;
  email: string;
  visitorEnabled?: boolean;
  visitorName?: string;
  matchedClientId?: Id;
  serviceLines: UiServiceLine[];
  goodsLines: UiGoodsLine[];
  categoryIds: Id[];
  colorIndex?: number;
  customFieldValues: Record<string, CustomFieldValue>;
  paidAmount: number;
  resourceIds: Id[];
  /** Версия записи, с которой снят черновик: запись с тех пор менялась (перенос, «Пришёл», оплата) — черновик устарел */
  bookingUpdatedAt?: string;
}

export function BookingWindow({
  open,
  onOpenChange,
  booking,
  staffList,
  initialStaffId,
  initialClientId,
  initialPhone,
  initialName,
  date: dateProp,
  initialTime,
  locationId,
  onSaved,
  initialComment,
  initialServiceIds,
}: BookingWindowProps) {
  const t = useT('journal');
  // Журнал A2 (DESIGN.md → Performance): три зоны окна — сотни компонентов. Шторка выезжает сразу со скелетоном, а
  // зоны монтируются не раньше чем через два кадра (выезд и перетекание карточки в окно не спотыкаются о монтирование)
  // и только когда запись уже подставлена в форму — см. bodyReady ниже.
  const [framesReady, setFramesReady] = useState(false);
  const [bodyWaitedTooLong, setBodyWaitedTooLong] = useState(false);
  useEffect(() => {
    let id2 = 0;
    const id1 = requestAnimationFrame(() => {
      id2 = requestAnimationFrame(() => startTransition(() => setFramesReady(true)));
    });
    // Страховка: данные не пришли за 2 с — показываем зоны как есть (дальше они заполнятся сами)
    const timer = setTimeout(() => startTransition(() => setBodyWaitedTooLong(true)), 2000);
    return () => {
      cancelAnimationFrame(id1);
      cancelAnimationFrame(id2);
      clearTimeout(timer);
    };
  }, []);
  const router = useRouter();
  const tc = useT('common');
  const format = useFormat({ hourCycle: useJournalHourFormat() });
  const tDyn = useTDynamic();
  const locale = useLocale();
  const toast = useToast();
  const confirm = useConfirm();
  const { businessId, staffId: ownStaffId, persona } = useCurrent();
  const isEdit = Boolean(booking);
  // F-01-037: у новой (несохранённой) записи не должно быть вкладок, которые работают только с уже
  // существующим визитом (списание расходников — списывать ещё нечего, пока нет booking.id); у
  // сохранённой записи видны все. Единственный вклад хоста, привязанный именно к сохранённой записи
  // сейчас — «stock» («Расходники»); остальные (finance/loyalty/resources/notify/online) осмысленны
  // и для черновика (оплата вперёд, применение сертификата к будущей услуге, источник записи).
  const NEW_BOOKING_HIDDEN_EXT_AREAS = new Set(['stock']);
  // F-01-098: вклад «online» в этот хост («Источник») сам рисует что-то только когда запись пришла
  // с онлайн-записи (source link/widget, см. src/areas/online/extensions/BookingWindow.tsx) — для
  // journal/app/phone/import/external он рендерит null. Пустая вкладка вводит в заблуждение (наш
  // собственный источник/автор — F-01-098 — уже виден на вкладке «Запись», F-01-181), поэтому хозяин
  // хоста прячет эту вкладку, когда она заведомо ничего не покажет.
  const bookingSource = booking?.source ?? 'journal';
  const onlineTabHasContent = bookingSource === 'link' || bookingSource === 'widget';
  // Фильтр вкладок — ниже, после всех хуков: значение, которое «живёт» через вызовы хуков, React Compiler не
  // запоминает (новый массив на каждый рендер перерисовывал вкладки и всё тело окна)
  const allExtEntries = useExtensions('bookingWindow');

  const [draftKey] = useState(() => booking?.id ?? `new:${initialStaffId ?? 'x'}:${dateProp}:${initialTime ?? '10:00'}`);

  const [activeMainTab, setActiveMainTab] = useState<'record' | string>('record');
  const [rightZoneHidden, setRightZoneHidden] = useState(false);
  const [expandedTileActive, setExpandedTileActive] = useState(false);
  const [repeatOpen, setRepeatOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [centerTab, setCenterTab] = useState<CenterTab>('services');

  const [staffId, setStaffId] = useState<Id>(booking?.staffId ?? initialStaffId ?? staffList[0]?.id ?? '');
  const [workplace, setWorkplace] = useState<Workplace>(booking?.workplace ?? 'salon');
  const [date, setDate] = useState<ISODate>(booking ? booking.start.slice(0, 10) : dateProp);
  const [time, setTime] = useState<TimeHM>(booking ? (booking.start.slice(11, 16) as TimeHM) : ((initialTime ?? '10:00') as TimeHM));
  const [durationMin, setDurationMin] = useState(booking?.durationMin ?? 60);
  const [breakMin, setBreakMin] = useState(0);
  const [status, setStatus] = useState<BookingStatus>(booking?.status ?? 'scheduled');
  const [comment, setComment] = useState(booking?.comment ?? '');
  const [phone, setPhone] = useState('');
  const [clientName, setClientName] = useState('');
  const [email, setEmail] = useState('');
  const [visitorEnabled, setVisitorEnabled] = useState(Boolean(booking?.visitorName));
  const [visitorName, setVisitorName] = useState(booking?.visitorName ?? '');
  const [matchedClient, setMatchedClient] = useState<Client | undefined>(undefined);
  const [serviceLines, setServiceLines] = useState<UiServiceLine[]>([]);
  const [goodsLines, setGoodsLines] = useState<UiGoodsLine[]>([]);
  const [categoryIds, setCategoryIds] = useState<Id[]>([]);
  const [colorIndex, setColorIndex] = useState<number | undefined>(undefined);
  // F-01-046: id экземпляров ресурсов (кресло/кабинет/аппарат), закреплённых за записью
  const [resourceIds, setResourceIds] = useState<Id[]>(booking?.resourceIds ?? []);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, CustomFieldValue>>({});
  const [paidAmount, setPaidAmount] = useState(0);
  // Оплаченное визита считает и касса (раздел finance: вкладка «Оплата», полученная предоплата) — окно берёт большее
  // из своих строк оплаты и сводки кассы, иначе после оплаты на «Оплате» журнал писал «оплачено 2 500» у оплаченного
  const financeSummaryQuery = useApiQuery(
    ['journal', 'finance-summary', businessId, booking?.id],
    () => getBookingPaymentSummary(businessId!, booking!.id),
    { enabled: Boolean(businessId && booking) },
  );
  const financePaid = financeSummaryQuery.data
    ? Math.max(0, (financeSummaryQuery.data.total ?? financeSummaryQuery.data.booking.total) - financeSummaryQuery.data.due)
    : 0;
  const shownPaid = Math.max(paidAmount, financePaid);
  const [saving, setSaving] = useState(false);
  // core-rules-4: договор сохранения (arch-a1 №9) — вклады регистрируют шаги «до»/«после»
  // сохранения записи, хозяин прогоняет их вокруг своей записи.
  const saveSteps = useSaveSteps();
  const [paying, setPaying] = useState(false);
  const [cancelingPayment, setCancelingPayment] = useState(false);
  // F-01-138…143: детальное окно «Оплата визита» вместо мгновенной отметки — открывается, только
  // если запись уже сохранена (нужен bookingId, чтобы писать строки оплаты).
  const [paymentSheetOpen, setPaymentSheetOpen] = useState(false);
  const [invalidCustomFields, setInvalidCustomFields] = useState<string[]>([]);

  const deleteMutation = useApiMutation(({ id, authorName }: { id: Id; authorName: string }) => deleteBookingWithAuthor(id, authorName));
  /** F-01-192: копия записи без политики оплаты/депозита и без оплаты (справка 360426) */
  const [duplicating, setDuplicating] = useState(false);
  const refundMutation = useApiMutation(markPrepaymentRefunded);
  const timing = useVisitTiming();
  const timingNow = useNowMinuteYerevan(booking?.start.slice(0, 10) ?? '');

  // F-01-085, F-01-179, F-01-180: права окна записи + окно прошлого (по статусу, оплате и дате)
  const windowRights = useWindowRights();
  const beyondHistory = useIsBeyondHistoryLimit(date);
  // F-01-178 (qa/full-test-0930/journal-perms.md): чужая запись по ссылке ?booking= у мастера без journal.others —
  // can('journal.view', { actorStaffId, targetStaffId }) = false, значит запись не видна вовсе: замок вместо данных
  const staffScope = useJournalStaffScope();
  const foreignLocked = Boolean(booking && staffScope.ownOnlyStaffId !== undefined && booking.staffId !== staffScope.ownOnlyStaffId);
  const canEditNow = canEditBooking(booking, paidAmount, windowRights) && !beyondHistory && !foreignLocked;
  const canDeleteNow = canDeleteBooking(booking, paidAmount, windowRights) && !beyondHistory && !foreignLocked;

  // F-01-175: у новой записи технический перерыв стартует со значения «после каждой записи» из
  // настроек журнала (пока в её составе нет услуги со своим bufferAfterMin — тогда главнее её перерыв,
  // применяется автоматически через combineBreakMin в DayGrid/расчётах длительности визита).
  const journalSettingsQuery = useApiQuery(['journal', 'settings-default-break'], getJournalSettings);

  // ─────────────────────────── Справочники ───────────────────────────

  const bookingClientId = booking?.clientId;
  const clientQuery = useApiQuery(['journal', 'booking-client', bookingClientId], () => coreList('clients', { id: bookingClientId ?? '' }), {
    enabled: Boolean(bookingClientId),
  });
  const initialClientQuery = useApiQuery(['journal', 'initial-client', initialClientId], () => coreList('clients', { id: initialClientId! }), {
    enabled: !isEdit && Boolean(initialClientId),
  });
  // ?phone=: клиент ищется в текущем бизнесе (филиале) по номеру; не нашёлся — { client: null }, подставим номер
  const initialPhoneQuery = useApiQuery(
    ['journal', 'initial-phone', businessId, initialPhone],
    async () => ({ client: (await findClientByPhone(businessId!, initialPhone!)) ?? null }),
    { enabled: !isEdit && !initialClientId && Boolean(initialPhone) && Boolean(businessId) },
  );
  // ⭐ Допродажа: сопутствующие услуг бизнеса — подсказка «Предложить клиенту» в составе визита
  const upsellConfigsQuery = useApiQuery(['services', 'upsellConfigs', businessId], () => listUpsellConfigs(businessId ?? ''), { enabled: Boolean(businessId) });
  const allServicesQuery = useApiQuery(['journal', 'all-services', businessId], () => coreList('services', { businessId: businessId! }), {
    enabled: Boolean(businessId),
  });
  const serviceCategoriesQuery = useApiQuery(
    ['journal', 'service-categories', businessId],
    () => coreList('serviceCategories', { businessId: businessId! }),
    { enabled: Boolean(businessId) },
  );
  // Ск3: товары — каталог склада локации визита (новая запись — текущей локации журнала)
  const goodsLocationId = booking?.locationId ?? locationId;
  const goodsCatalogQuery = useApiQuery(['journal', 'goods-catalog', businessId, goodsLocationId], () => getGoodsCatalog(goodsLocationId), {});
  const categoriesQuery = useApiQuery(['journal', 'booking-categories'], getBookingCategories, {});
  const customFieldDefsQuery = useApiQuery(['journal', 'custom-field-defs'], getCustomFieldDefs, {});
  const pinnedQuery = useApiQuery(['journal', 'pinned-fields', ownStaffId], () => getPinnedFields(ownStaffId ?? ''), {
    enabled: Boolean(ownStaffId),
  });
  const frequentQuery = useApiQuery(['journal', 'frequent-services', staffId], () => getFrequentServices(staffId), { enabled: Boolean(staffId) });
  const matchedClientId = matchedClient?.id;
  /** F-01-207: личная скидка клиента ставится на новую строку услуги сама; в самой строке
   * (ServiceLineRow.discountPct) её можно поменять или убрать, не заходя в карточку клиента. */
  const clientDiscountQuery = useApiQuery(
    ['journal', 'client-discount', businessId, matchedClientId],
    () => getClientRow(businessId!, matchedClientId!),
    { enabled: Boolean(businessId) && Boolean(matchedClientId) },
  );
  const personalDiscountPct = clientDiscountQuery.data?.discount ?? 0;
  const lastServiceQuery = useApiQuery(
    ['journal', 'last-client-service', matchedClientId, staffId],
    () => getLastClientService(matchedClientId ?? '', staffId),
    { enabled: Boolean(matchedClientId) && Boolean(staffId) },
  );
  const bookingId = booking?.id;
  const extrasQuery = useApiQuery(['journal', 'extras', bookingId], () => getBookingExtras(bookingId ?? ''), {
    enabled: isEdit && Boolean(bookingId),
  });
  const draftQuery = useApiQuery(['journal', 'draft', draftKey], () => loadDraft(draftKey), {});
  // Сами функции, а не весь объект запроса (он новый на каждый рендер): так обработчики ниже не меняются
  const refetchExtras = extrasQuery.refetch;
  const refetchCategories = categoriesQuery.refetch;
  // F-16-125/129/130: пакеты, добавленные из списка услуг этого окна, и их будущие связанные записи
  const packageDraft = usePackageDraft({ businessId, allServices: allServicesQuery.data ?? [], locale });
  // F-01-046: ресурсы локации + кто занят на текущее время записи (пересчитывается при смене даты/времени/длительности)
  const resourcesQuery = useApiQuery(['journal', 'location-resources', locationId], () => coreList('resources', { locationId, active: true }), {
    enabled: Boolean(locationId),
  });
  const occupiedResourceQuery = useApiQuery(
    ['journal', 'occupied-resource-instances', locationId, date, time, durationMin, booking?.id],
    () => listOccupiedResourceInstanceIds(locationId, combine(date, time), durationMin, booking?.id),
    { enabled: Boolean(locationId) },
  );

  // F-01-080: списание с абонемента считается «в момент начала записи», не при открытии окна — но
  // нам нужно где-то это посчитать один раз; ensureAutoWriteoff идемпотентен (второй вызов на ту же
  // запись ничего не меняет), поэтому дешёво зовём его при каждом открытии сохранённой записи, а
  // extrasQuery сам перечитается и покажет результат (state-s1 п.2: без ручного refetch).
  useEffect(() => {
    if (isEdit && booking?.id) ensureAutoWriteoff(booking.id).catch(() => {});
  }, [isEdit, booking?.id]);

  const pinnedFields = pinnedQuery.data ?? ['comment'];
  const pinMutation = useApiMutation((field: string) => togglePinnedField(ownStaffId ?? '', field));

  // Гонка: асинхронные подстановки (клиент записи, черновик) могут прийти уже ПОСЛЕ того, как
  // пользователь начал печатать — touchedRef ловит первую правку и запрещает подстановке переписать
  // уже введённое (иначе первые нажатия молча стирались бы более поздним ответом «сети»).
  const [touched, setTouched] = useState(false);
  function withTouch<A extends unknown[]>(fn: (...args: A) => void): (...args: A) => void {
    return (...args: A) => {
      setTouched(true);
      fn(...args);
    };
  }

  // decision-c3-3: отмена мастером — если предоплата внесена и оплачена, F-00-100 требует вернуть её
  // клиенту полностью; спрашиваем подтверждение суммой ДО того, как статус реально сменится.
  const handleStatusChange = async (next: BookingStatus) => {
    // Владелец 01.10.2026: «Пришёл» у сохранённой записи отмечается сразу, как кнопкой в «Требует внимания», —
    // обязательные поля записи его не держат (их проверяет только «Сохранить» формы)
    if (next === 'arrived' && isEdit && booking && booking.status !== 'arrived' && !touched) {
      const prev = booking.status;
      const name = clientName || booking.visitorName || t('block.noClient');
      try {
        await changeBookingStatus(booking.id, 'arrived', 'business');
        await syncArrivedConsequences(booking.id, 'arrived');
        setStatus('arrived');
        // «Ждёт предоплату» руками не ставится (canTransition) — у такой записи отмены в тосте нет
        toast.success(t('board.list.arrivedToast', { name }), prev === 'awaiting_prepayment' ? undefined : {
          action: {
            label: t('board.list.undo'),
            onClick: () => {
              void changeBookingStatus(booking.id, prev, 'business')
                .then(() => syncArrivedConsequences(booking.id, prev))
                .then(() => setStatus(prev))
                .catch(() => toast.error(tc('states.actionFailed')));
            },
          },
        });
      } catch {
        toast.error(tc('states.actionFailed'));
      }
      return;
    }
    if (next === 'cancelled_by_master' && booking) {
      const refund = masterCancelRefund(booking);
      if (refund > 0) {
        const ok = await confirm({
          title: t('window.cancelByMaster.refundTitle'),
          description: t('window.cancelByMaster.refundText', { amount: format.money(refund) }),
          tone: 'primary',
          confirmLabel: t('window.cancelByMaster.refundConfirm'),
        });
        if (!ok) return;
        // Тост и «Верните клиенту …» — после «Сохранить», когда отмена действительно записана
      }
    }
    // F-01-124 «Готово, когда»: «Не пришёл» с внесённой предоплатой спрашивает, оставить штраф
    // (доход бизнеса) или простить (вернуть клиенту) — по умолчанию (диалог закрыт/эскейп) штраф
    // применяется сам, как требует ТЗ («не решил до полуночи — штраф применяется сам»; у нас нет
    // бэкенда для настоящего таймера до полуночи, поэтому дефолт срабатывает сразу — см. assumed).
    if (next === 'no_show' && booking?.prepayment?.paid) {
      const actorName = staffList.find((s) => s.id === ownStaffId)?.name ?? t('window.deleteAuthorFallback');
      // По умолчанию (диалог закрыт эскейпом/бэкдропом — useConfirm тогда возвращает false) штраф
      // считается ВЗЯТЫМ — только явный клик «Простить» отменяет его (auto=true, если не «waive»).
      const waived = await confirm({
        title: t('window.noShowPenalty.title'),
        description: t('window.noShowPenalty.text', { amount: format.money(booking.prepayment.amount) }),
        tone: 'danger',
        confirmLabel: t('window.noShowPenalty.waive'),
        cancelLabel: t('window.noShowPenalty.keep'),
      });
      await decidePrepayment(booking.id, !waived, 'no_show', actorName, false).catch(() => {});
      refetchExtras();
    }
    withTouch(setStatus)(next);
  };

  // ─────────────────────────── Загрузка клиента записи (F-01-062…066) ───────────────────────────
  // Правка состояния «во время рендера» (не в эффекте) — официальный React-приём для подстройки
  // состояния под изменившиеся входные данные запроса, guard'ится сравнением с предыдущим id.

  const [clientLoadedFor, setClientLoadedFor] = useState<Id | undefined>(undefined);
  if (clientQuery.data?.[0] && clientLoadedFor !== booking?.clientId && !touched) {
    const c = clientQuery.data[0];
    setClientLoadedFor(booking?.clientId);
    setMatchedClient(c);
    setPhone(c.phone);
    setClientName(c.name);
    setEmail(c.email ?? '');
  }
  // F-01-163: «Создать запись» из панели поиска клиента подставляет клиента в СЛЕДУЮЩУЮ новую запись
  const [initialClientLoadedFor, setInitialClientLoadedFor] = useState<Id | undefined>(undefined);
  if (!isEdit && initialClientQuery.data?.[0] && initialClientLoadedFor !== initialClientId && !touched) {
    const c = initialClientQuery.data[0];
    setInitialClientLoadedFor(initialClientId);
    setMatchedClient(c);
    setPhone(c.phone);
    setClientName(c.name);
    setEmail(c.email ?? '');
  }

  const [initialPhoneLoadedFor, setInitialPhoneLoadedFor] = useState<string | undefined>(undefined);
  if (!isEdit && initialPhone && initialPhoneQuery.data && initialPhoneLoadedFor !== initialPhone && !touched) {
    const c = initialPhoneQuery.data.client;
    setInitialPhoneLoadedFor(initialPhone);
    if (c) {
      setMatchedClient(c);
      setPhone(c.phone);
      setClientName(c.name);
      setEmail(c.email ?? '');
    } else {
      setPhone(initialPhone);
      setClientName(initialName ?? '');
    }
  }

  // ─────────────────────────── Гидратация: черновик или сохранённая запись (F-01-040) ───────────────────────────

  const draftResolved = !draftQuery.isLoading && !draftQuery.isError;
  const catalogsReady = Boolean(extrasQuery.data && allServicesQuery.data && goodsCatalogQuery.data);
  // Черновик существующей записи берём, только если запись с тех пор не менялась: иначе окно показывало бы старый
  // статус и время, а «Сохранить» вернуло бы перенос/«Пришёл», сделанные в журнале
  const draftUsable =
    Boolean(draftQuery.data) && (!isEdit || (draftQuery.data as unknown as DraftShape).bookingUpdatedAt === booking?.updatedAt);
  const hydrationSource: 'draft' | 'booking' | 'empty' | undefined = !draftResolved
    ? undefined
    : draftUsable
      ? 'draft'
      : isEdit
        ? catalogsReady
          ? 'booking'
          : undefined
        : 'empty';

  // Л1: оплату визита проводят и окно «Оплата», и вкладка «Лояльность» — оплаченное в окне следует за строками
  // платежей визита (общий кэш ['journal','extras']), а не только за первой загрузкой записи.
  const extrasPaid = extrasQuery.data?.paidAmount;
  const [seenExtrasPaid, setSeenExtrasPaid] = useState(extrasPaid);
  if (extrasPaid !== seenExtrasPaid) {
    setSeenExtrasPaid(extrasPaid);
    if (extrasPaid !== undefined && seenExtrasPaid !== undefined) setPaidAmount(extrasPaid);
  }

  const [hydratedFrom, setHydratedFrom] = useState<string | undefined>(undefined);
  // Новая запись с услугами из адреса (следующий визит, лист ожидания) ждёт каталог услуг: иначе «пустая» гидратация
  // проходила раньше каталога и услуги с длительностью молча не подставлялись
  const waitsForServices = hydrationSource === 'empty' && Boolean(initialServiceIds?.length) && !allServicesQuery.data && !allServicesQuery.isError;
  if (hydrationSource && hydratedFrom !== hydrationSource && !waitsForServices) {
    setHydratedFrom(hydrationSource);
    if (hydrationSource === 'draft' && !touched) {
      const draft = draftQuery.data as unknown as DraftShape;
      setStaffId(draft.staffId);
      setWorkplace(draft.workplace);
      setDate(draft.date);
      setTime(draft.time);
      setDurationMin(draft.durationMin);
      setBreakMin(draft.breakMin);
      setStatus(draft.status);
      setComment(draft.comment);
      setPhone(draft.phone);
      setClientName(draft.clientName);
      setEmail(draft.email);
      setVisitorEnabled(Boolean(draft.visitorEnabled));
      setVisitorName(draft.visitorName ?? '');
      setServiceLines(draft.serviceLines ?? []);
      setGoodsLines(draft.goodsLines ?? []);
      setCategoryIds(draft.categoryIds ?? []);
      setColorIndex(draft.colorIndex);
      setCustomFieldValues(draft.customFieldValues ?? {});
      setPaidAmount(draft.paidAmount ?? 0);
      setResourceIds(draft.resourceIds ?? []);
    } else if (hydrationSource === 'booking' && booking && !touched) {
      const extras = extrasQuery.data!;
      const lines: UiServiceLine[] = booking.services.map((s, i) => {
        const svc = allServicesQuery.data!.find((x) => x.id === s.serviceId);
        const discountPct = extras.serviceLineExtras[i]?.discountPct ?? 0;
        const unitPrice =
          s.qty > 0 ? (discountPct < 100 ? Math.round(s.price / s.qty / (1 - discountPct / 100)) : Math.round(s.price / s.qty)) : s.price;
        return {
          serviceId: s.serviceId,
          staffId: s.staffId,
          name: svc ? pickText(svc.name, locale) : t('block.service'),
          durationMin: s.durationMin,
          qty: s.qty,
          unitPrice,
          discountPct,
          assistants: extras.serviceLineExtras[i]?.assistants,
          ...(s.upsellOf ? { upsellOf: s.upsellOf } : {}),
        };
      });
      setServiceLines(lines);
      const goods: UiGoodsLine[] = extras.goodsLines.map((g) => {
        const item = goodsCatalogQuery.data!.find((x) => x.id === g.itemId);
        return {
          id: g.id,
          itemId: g.itemId,
          name: item?.name ?? '',
          qty: g.qty,
          unitPrice: g.price,
          discountPct: g.discountPct,
          sellerId: g.sellerId,
          code: g.code,
          qtyLocked: item ? item.kind !== 'product' : false,
          ...(g.upsellOf ? { upsellOf: g.upsellOf } : {}),
        };
      });
      setGoodsLines(goods);
      setCategoryIds(extras.categoryIds);
      setColorIndex(extras.colorIndex);
      setCustomFieldValues(extras.customFieldValues);
      setPaidAmount(extras.paidAmount);
      setResourceIds(booking.resourceIds);
    } else if (hydrationSource === 'empty' && !touched && (initialComment || initialServiceIds) && allServicesQuery.data) {
      // F-01-159: «Записать» из заявки листа ожидания — окно новой записи заполнено услугами и
      // комментарием заявки (клиент — уже через initialClientId, как F-01-163).
      if (initialComment) setComment(initialComment);
      if (initialServiceIds && initialServiceIds.length > 0) {
        const lines: UiServiceLine[] = initialServiceIds
          .map((id) => allServicesQuery.data!.find((s) => s.id === id))
          .filter((s): s is NonNullable<typeof s> => Boolean(s))
          .map((s) => ({
            serviceId: s.id,
            staffId,
            name: pickText(s.name, locale),
            durationMin: s.durationMin,
            qty: 1,
            unitPrice: s.priceMin,
            discountPct: 0,
          }));
        if (lines.length > 0) {
          setServiceLines(lines);
          setDurationMin(lines.reduce((sum, l) => sum + l.durationMin, 0));
        }
      }
    }
  }

  // F-01-175: перерыв новой записи по умолчанию — то же самое «setState в теле рендера» (не в
  // эффекте), что гидратация выше; своя независимая метка, потому что готовность настроек журнала
  // не совпадает по времени с готовностью черновика/записи.
  // Зоны монтируются ОДИН раз — уже с подставленной записью/черновиком. Раньше они монтировались пустыми, и
  // подстановка тут же перерисовывала все три зоны синхронным рендером (~45 мс на CPU×4 при открытии окна).
  // useDeferredValue: смена «скелетон → зоны» рендерится в фоне кусками, а не одним длинным кадром.
  const dataSettled =
    hydratedFrom !== undefined ||
    draftQuery.isError ||
    extrasQuery.isError ||
    allServicesQuery.isError ||
    goodsCatalogQuery.isError ||
    bodyWaitedTooLong;
  const bodyReady = useDeferredValue(framesReady && dataSettled);
  // Второй шаг монтирования — кадром позже: правая зона (клиент, лояльность) и плитки под центром. Один коммит на
  // все три зоны давал кадр 50–67 мс на CPU×4 (qa/journal-redesign/open-diag.mjs); двумя — каждый укладывается в ~33.
  const [secondaryReady, setSecondaryReady] = useState(false);
  useEffect(() => {
    if (!bodyReady || secondaryReady) return;
    const id = requestAnimationFrame(() => startTransition(() => setSecondaryReady(true)));
    return () => cancelAnimationFrame(id);
  }, [bodyReady, secondaryReady]);
  // «Оплата визита» монтируется при первом открытии (закрытая шторка тоже гоняла свои запросы и рендер при открытии
  // окна записи); после — остаётся смонтированной, чтобы закрываться с анимацией.
  const [paymentSheetMounted, setPaymentSheetMounted] = useState(false);
  if (paymentSheetOpen && !paymentSheetMounted) setPaymentSheetMounted(true);

  const [defaultBreakApplied, setDefaultBreakApplied] = useState(false);
  if (!isEdit && !touched && !defaultBreakApplied && journalSettingsQuery.data !== undefined) {
    setDefaultBreakApplied(true);
    setBreakMin(journalSettingsQuery.data.defaultBreakAfterMin);
  }

  // ─────────────────────────── Автосохранение черновика (F-01-040) ───────────────────────────
  // latestSnapshotRef всегда хранит самый свежий снимок — нужен отдельному эффекту ниже, который
  // сбрасывает его в стор СИНХРОННО при закрытии окна (Escape/крестик/повторное открытие сразу
  // после). Раньше при быстром закрытии cleanup здесь просто гасил setTimeout и последняя правка
  // (введённая меньше чем за 400 мс до закрытия) терялась без следа — гонка, из-за которой
  // восстановление черновика срабатывало через раз.
  const latestSnapshotRef = useRef<DraftShape | undefined>(undefined);
  // «Отмена» внизу окна — отказ от введённого: черновик стирается и больше не пишется (ни таймером, ни при закрытии)
  const discardedRef = useRef(false);

  useEffect(() => {
    // Черновик — только когда человек что-то ввёл: снимок нетронутой записи потом перекрывал её свежие данные
    if (!hydratedFrom || !touched) return;
    const snapshot: DraftShape = {
      staffId,
      workplace,
      date,
      time,
      durationMin,
      breakMin,
      status,
      comment,
      phone,
      clientName,
      email,
      visitorEnabled,
      visitorName,
      serviceLines,
      goodsLines,
      categoryIds,
      colorIndex,
      customFieldValues,
      paidAmount,
      resourceIds,
      bookingUpdatedAt: booking?.updatedAt,
    };
    latestSnapshotRef.current = snapshot;
    const timer = setTimeout(() => {
      if (discardedRef.current) return;
      saveDraft(draftKey, snapshot as unknown as WindowDraftSnapshot).catch(() => {});
    }, 400);
    return () => clearTimeout(timer);
  }, [
    hydratedFrom,
    touched,
    booking?.updatedAt,
    draftKey,
    staffId,
    workplace,
    date,
    time,
    durationMin,
    breakMin,
    status,
    comment,
    phone,
    clientName,
    email,
    visitorEnabled,
    visitorName,
    serviceLines,
    goodsLines,
    categoryIds,
    colorIndex,
    customFieldValues,
    paidAmount,
    resourceIds,
  ]);

  useEffect(() => {
    return () => {
      if (latestSnapshotRef.current && !discardedRef.current) {
        flushDraftSync(draftKey, latestSnapshotRef.current as unknown as WindowDraftSnapshot);
      }
    };
  }, [draftKey]);

  // ─────────────────────────── Данные для зон ───────────────────────────

  const staff = staffList.find((s) => s.id === staffId);
  // F-00-017/048, F-01-042: «Дома» ставит себе только сам мастер — администратор/владелец записывают
  // мастера, но не решают за него, что он сегодня дома.
  const canPickHomeWorkplace = persona === 'master' && staff?.id === ownStaffId;
  // qa/measure/journal/g3-2-fix1.md (major, F-01-193): групповые услуги (kind 'group') не продаются
  // как индивидуальная запись — окно записи одного клиента к мастеру должно предлагать только
  // kind 'individual' (групповые услуги записываются через групповые события, раздел resources).
  // F-16-125: пакет виден мастеру, если он оказывает хотя бы одну его услугу (119203); «сломанный» пакет
  // (услуга стала групповой, F-16-124) не предлагается. F-16-129: услугу к связанной записи выбирают из
  // услуг ЕЁ мастера, пакеты в этом случае не показываются — пакет добавляется к визиту целиком.
  const allServicesList = allServicesQuery.data ?? [];
  const servicesById = new Map(allServicesList.map((s) => [s.id, s]));
  const pickerStaffId = packageDraft.targetStaffId ?? staffId;
  const staffServices = allServicesList.filter((s) => {
    if (!s.active || s.kind !== 'individual') return false;
    if (!s.servicePackage) return s.staffIds.includes(pickerStaffId);
    if (packageDraft.targetStaffId || s.servicePackage.items.length < 2) return false;
    if (isPackageBroken(s.servicePackage.items, toPackageServiceLite(allServicesList))) return false;
    return packageVisibleToStaff(
      s.servicePackage.items.map((i) => ({ staffIds: servicesById.get(i.serviceId)?.staffIds ?? [] })),
      staffId,
    );
  });
  /** Связанные записи пакетов — с началом каждой, как их создаст сохранение */
  const buildLinkedPlans = (mainStart: string) => {
    const starts = linkedStarts(mainStart, durationMin, packageDraft.linked);
    return packageDraft.linked
      .map((item, index) => ({
        staffId: item.staffId,
        start: starts[index] ?? mainStart,
        lines: item.lines.map((l) => ({ serviceId: l.serviceId, price: l.price, durationMin: l.durationMin })),
      }))
      .filter((plan) => plan.lines.length > 0);
  };
  const total = visitTotal(serviceLines, goodsLines);

  /**
   * F-01-112: перенос к мастеру, у которого уже выбранные услуги могут стоить иначе, требует
   * подтверждения — цена строк намеренно НЕ пересчитывается (её правят вручную).
   * 🔒 Каталог услуг ещё не хранит цену по мастеру раздельно (одна priceMin/priceMax на услугу) —
   * предупреждаем всегда, когда есть хоть одна строка услуги и мастер меняется, а не только при
   * подтверждённой разнице цены; см. qa/requests/journal.md.
   */
  const handleStaffChange = async (newStaffId: string) => {
    if (newStaffId === staffId) return;
    if (serviceLines.length > 0) {
      const ok = await confirm({
        title: t('window.staffPriceWarningTitle'),
        description: t('window.staffPriceWarningText'),
        tone: 'primary',
        confirmLabel: tc('actions.confirm'),
      });
      if (!ok) return;
    }
    setTouched(true);
    setStaffId(newStaffId);
  };

  const togglePin = (field: string) => {
    pinMutation.mutate(field).catch(() => {});
  };

  const toggleCategory = (id: Id) => {
    setTouched(true);
    setCategoryIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };
  const addCategory = (name: string, colorIdx: number) => {
    setTouched(true);
    addBookingCategory({ name, colorIndex: colorIdx })
      .then((def) => {
        refetchCategories();
        setCategoryIds((prev) => [...prev, def.id]);
      })
      .catch(() => toast.error(tc('states.actionFailed')));
  };
  const changeCustomField = (key: string, value: CustomFieldValue) => {
    setTouched(true);
    setCustomFieldValues((prev) => ({ ...prev, [key]: value }));
  };

  const renderFieldEditor = (key: string) => {
    if (key === 'comment') {
      return (
        <div data-f="F-01-050" className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-fg">{t('window.comment')}</span>
          <textarea
            value={comment}
            onChange={(e) => withTouch(setComment)(e.target.value)}
            rows={2}
            className="min-h-16 w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-fg"
          />
        </div>
      );
    }
    if (key === 'categories') {
      return (
        <div className="flex flex-col gap-1.5" data-f="F-15-125">
          <span className="text-sm font-medium text-fg">{t('window.expanded.categories')}</span>
          <div className="flex flex-wrap gap-1.5">
            {(categoriesQuery.data ?? []).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleCategory(c.id)}
                className={`min-h-8 rounded-full border px-2.5 text-xs ${categoryIds.includes(c.id) ? 'border-primary bg-primary-soft text-primary-text' : 'border-border text-muted'}`}
              >
                {bookingCategoryLabel(t, c)}
              </button>
            ))}
          </div>
        </div>
      );
    }
    if (key === 'color') {
      return (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-fg">{t('window.expanded.color')}</span>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((idx) => (
              <button
                key={idx}
                type="button"
                aria-label={String(idx)}
                onClick={() => setColorIndex(idx)}
                className={`size-6 rounded-full ${SWATCH_BG[idx]} ${colorIndex === idx ? 'ring-2 ring-offset-2 ring-primary' : ''}`}
              />
            ))}
          </div>
        </div>
      );
    }
    if (key.startsWith('custom:')) {
      const fieldKey = key.slice('custom:'.length);
      const def = (customFieldDefsQuery.data ?? []).find((d) => d.key === fieldKey);
      if (!def) return null;
      return (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-fg">{def.label}</span>
          <input
            value={String(customFieldValues[def.key] ?? '')}
            onChange={(e) => changeCustomField(def.key, e.target.value)}
            disabled={!def.editableByUser}
            className="min-h-10 w-full rounded-xl border border-border bg-surface px-3.5 text-fg"
          />
        </div>
      );
    }
    return null;
  };

  const expandedPanel = (
    <ExpandedFieldsPanel
      title={expandedTileActive ? t('window.left.expandedTile') : undefined}
      onHide={expandedTileActive ? () => setExpandedTileActive(false) : undefined}
      comment={comment}
      onCommentChange={withTouch(setComment)}
      commentEditable
      categories={categoriesQuery.data ?? []}
      selectedCategoryIds={categoryIds}
      onToggleCategory={toggleCategory}
      onAddCategory={addCategory}
      colorIndex={colorIndex}
      onColorChange={withTouch(setColorIndex)}
      customFieldDefs={customFieldDefsQuery.data ?? []}
      customFieldValues={customFieldValues}
      onCustomFieldChange={changeCustomField}
      invalidCustomFieldKeys={invalidCustomFields}
      pinnedFields={pinnedFields}
      onTogglePin={togglePin}
    />
  );

  // ─────────────────────────── Сохранение (F-01-038, F-01-039, F-01-041, F-01-053, F-01-066) ───────────────────────────

  // F-01-011: без этой проверки статус «Клиент пришёл» тихо не сохранялся ни разу — тестировщик
  // видел общий тост «Не получилось» на 3 разных записях и решил, что статус вообще не сохраняется.
  // На деле блокирует одно обязательное «при статусе Клиент пришёл» поле (consentDate, домен
  // journal.ts §CUSTOM_FIELD_DEFS) — доступное только в «Расширенных полях». Тост теперь называет
  // поле по имени и раскрывает панель, вместо немого «попробуйте ещё раз».
  // Владелец 01.10.2026: поле «обязательно при Пришёл» не держит «Пришёл» (ни кнопкой, ни «Сохранить») — только
  // напоминание тостом; блокирует сохранение лишь «обязательно при создании»
  const validateCustomFields = (): { missing: string[]; labels: string[]; softLabels: string[] } => {
    const defs = customFieldDefsQuery.data ?? [];
    const empty = (key: string) => {
      const v = customFieldValues[key];
      return v === undefined || v === null || v === '';
    };
    const missingDefs = defs.filter((d) => d.requiredOnCreate && !isEdit && empty(d.key));
    const softDefs = defs.filter((d) => d.requiredOnArrived && status === 'arrived' && empty(d.key) && !missingDefs.includes(d));
    const missing = missingDefs.map((d) => d.key);
    setInvalidCustomFields(missing);
    return { missing, labels: missingDefs.map((d) => d.label), softLabels: softDefs.map((d) => d.label) };
  };

  // «Отмена» — отказаться от введённого (раньше она делала то же, что ✕ и «Скрыть окно»: черновик оставался и
  // возвращался при следующем открытии, хотя человек нажал «Отмена»). Есть правки — сначала спрашиваем.
  // ✕ и «Скрыть окно, не потеряв введённое» по-прежнему сохраняют черновик (F-01-040).
  const cancelWindow = async () => {
    if (touched) {
      const ok = await confirm({
        title: t('window.discard.title'),
        description: t('window.discard.text'),
        tone: 'danger',
        confirmLabel: t('window.discard.ok'),
        cancelLabel: t('window.discard.keep'),
      });
      if (!ok) return;
    }
    discardedRef.current = true;
    clearDraft(draftKey).catch(() => {});
    onOpenChange(false);
  };

  const handleSave = async () => {
    if (!staffId) return;
    if (durationMin < MIN_DURATION_MIN || durationMin > MAX_DURATION_MIN) {
      toast.error(t('window.durationError'));
      return;
    }
    const customFieldsCheck = validateCustomFields();
    if (customFieldsCheck.missing.length === 0 && customFieldsCheck.softLabels.length > 0) {
      toast.warning(t('window.customFieldsArrivedReminder', { fields: customFieldsCheck.softLabels.join(', ') }));
    }
    if (customFieldsCheck.missing.length > 0) {
      toast.error(t('window.customFieldsMissingToast', { fields: customFieldsCheck.labels.join(', ') }));
      setExpandedTileActive(true);
      // Панель раскрылась, но поле могло остаться ниже края окна — «не найти» (seams-проверка 28.09): подводим к
      // первому незаполненному полю и ставим в него фокус
      const firstMissing = customFieldsCheck.missing[0];
      window.setTimeout(() => {
        const field = document.querySelector<HTMLElement>(`[data-custom-field="${firstMissing}"]`);
        if (!field) return;
        field.scrollIntoView({ block: 'center', behavior: 'smooth' });
        field.querySelector<HTMLElement>('input, select, textarea, button[aria-haspopup]')?.focus({ preventScroll: true });
      }, 80);
      return;
    }

    const start = combine(date, time);

    // F-01-116 «Готово, когда»: поздний перенос записи с (внесённой) предоплатой спрашивает,
    // удерживать ли её — дедлайн считаем ядровым правилом (domain/rules/booking-policy, CONVENTIONS
    // §0.1/§18) от ИСХОДНОГО времени записи, не от нового (иначе перенос сам бы отодвигал свой же срок).
    if (isEdit && booking && booking.prepayment?.paid && start !== booking.start) {
      const rules = effectiveBookingRules(
        undefined,
        staffList.find((s) => s.id === booking.staffId),
      );
      const deadline = freeCancelUntil(booking, rules);
      if (nowDateTime() >= deadline) {
        const actorName = staffList.find((s) => s.id === ownStaffId)?.name ?? t('window.deleteAuthorFallback');
        const waived = await confirm({
          title: t('window.latePenalty.title'),
          description: t('window.latePenalty.text', { amount: format.money(booking.prepayment.amount) }),
          tone: 'danger',
          confirmLabel: t('window.latePenalty.waive'),
          cancelLabel: t('window.latePenalty.keep'),
        });
        await decidePrepayment(booking.id, !waived, 'late_reschedule', actorName, false).catch(() => {});
        refetchExtras();
      }
    }

    const normalizedPhone = phone ? normalizePhone(phone) : undefined;
    const hasPartialClientInfo = (Boolean(phone) && !normalizedPhone) || (!phone && (clientName || email));
    // F-01-039: сохранение БЕЗ клиента вообще (не только с частично введёнными данными) тоже
    // спрашивает подтверждение — «Создать без клиента?» / «Отмена» возвращает в окно без потерь.
    const willSaveWithoutClient = !normalizedPhone && !matchedClient && !booking?.clientId;
    if (hasPartialClientInfo || willSaveWithoutClient) {
      const ok = await confirm({
        title: t('window.noClientConfirmTitle'),
        description: t('window.noClientConfirmText'),
        confirmLabel: t('window.noClientConfirmOk'),
        tone: 'primary',
      });
      if (!ok) return;
    }

    // У этого клиента уже есть другая запись, пересекающаяся по времени (у любого мастера) — предупредить, не запрещать
    const overlapClientId = matchedClient?.id ?? booking?.clientId;
    if (overlapClientId && (!booking || start !== booking.start || durationMin !== booking.durationMin)) {
      const clash = await findClientOverlap(overlapClientId, start, durationMin, booking?.id).catch(() => undefined);
      if (clash) {
        const svc = clash.serviceId ? servicesById.get(clash.serviceId) : undefined;
        const ok = await confirm({
          title: t('window.clientOverlapTitle'),
          description: t('window.clientOverlapText', {
            time: format.time(clash.start),
            master: staffList.find((x) => x.id === clash.staffId)?.name ?? '',
            service: svc ? svc.name[locale] || svc.name.ru : '',
          }),
          confirmLabel: t('window.clientOverlapOk'),
          tone: 'primary',
        });
        if (!ok) return;
      }
    }

    // try…catch…finally — в runBusy (src/areas/journal/lib/tasks.ts): иначе React Compiler пропускает окно целиком
    await runBusy(setSaving, async () => {
      const overlapped = await hasOverlap(staffId, start, durationMin, booking?.id);
      if (overlapped) {
        toast.error(t('window.overlapError'));
        return;
      }

      // F-16-125: все мастера пакета должны быть свободны и работать в это время — проверяем связанные
      // записи ДО сохранения этой, чтобы не записать половину пакета.
      const linkedPlans = buildLinkedPlans(start);
      if (linkedPlans.some((plan) => !plan.staffId)) {
        toast.error(t('window.packageDraft.noStaffError'));
        return;
      }
      if (linkedPlans.length > 0) {
        const problems = await checkLinkedBookings(linkedPlans);
        if (problems.length > 0) {
          const names = [...new Set(problems.map((p) => staffList.find((s) => s.id === p.staffId)?.name ?? p.staffId))].join(', ');
          toast.error(t('window.packageDraft.linkedBusyError', { names }));
          return;
        }
      }

      // core-rules-4: шаги «до сохранения» вкладов (лояльность, финансы…) — бросят с тостом хозяина,
      // если что-то у них не сходится (например, не выбрана карта лояльности для обязательного списания).
      const beforeOk = await succeeded(() =>
        saveSteps.runBefore({
          staffId,
          clientId: matchedClient?.id ?? booking?.clientId,
          start,
          durationMin,
          services: serviceLines.map((line) => ({
            serviceId: line.serviceId,
            staffId: line.staffId,
            price: serviceLineTotal(line),
            durationMin: line.durationMin,
            qty: line.qty,
          })),
          resourceIds: booking?.resourceIds ?? [],
          workplace,
          source: booking?.source ?? 'journal',
          status,
          comment: comment || undefined,
          total,
        }),
      );
      if (!beforeOk) {
        toast.error(tc('states.actionFailed'));
        return;
      }

      // «Вне графика» спрашиваем, только когда время ставится: при отмене / неявке или без смены мастера и времени
      // вопрос «Всё равно создать запись?» лишний (final-api.md: отмена мастером спрашивала про график)
      const closing = (['cancelled_by_client', 'cancelled_by_master', 'no_show'] as BookingStatus[]).includes(status);
      const sameSlot = Boolean(booking && booking.staffId === staffId && booking.start === start && booking.durationMin === durationMin);
      const withinHours = closing || sameSlot || (await isWithinWorkingHours(staffId, start, durationMin));
      if (!withinHours) {
        const ok = await confirm({ title: t('window.outsideHoursTitle'), description: t('window.outsideHoursText'), tone: 'primary' });
        if (!ok) return;
      }

      let clientId = matchedClient?.id ?? booking?.clientId;
      if (normalizedPhone && !matchedClient) {
        const existing = await findClientByPhone(businessId!, normalizedPhone);
        if (existing) clientId = existing.id;
        else {
          const client = await coreCreate('clients', {
            businessId: businessId!,
            phone: normalizedPhone,
            name: clientName || normalizedPhone,
            email: email || undefined,
            gender: 'unknown',
            tags: [],
            noShowCount: 0,
            createdAt: nowDateTime(),
          });
          clientId = client.id;
        }
      } else if (!normalizedPhone && !matchedClient) {
        clientId = undefined;
      }

      const visitId = await resolveVisitId(clientId, date, start, durationMin, booking?.id);
      const serviceLinesForCore = serviceLines.map((line) => ({
        serviceId: line.serviceId,
        staffId: line.staffId,
        price: serviceLineTotal(line),
        durationMin: line.durationMin,
        qty: line.qty,
        // ⭐ Допродажа: пометка строки переживает правку записи (счётчик «Допродано» в карточке услуги)
        ...(line.upsellOf ? { upsellOf: line.upsellOf } : {}),
      }));

      const visitorNameForSave = visitorEnabled ? visitorName.trim() || undefined : undefined;

      let savedBooking: Booking;
      if (isEdit && booking) {
        // F-01-113: пакет нельзя разорвать переносом одной записи — переносим все связанные на ту же
        // разницу во времени, спросив подтверждение.
        const deltaMin = toMinutes(start.slice(11, 16)) - toMinutes(booking.start.slice(11, 16));
        const dateChanged = start.slice(0, 10) !== booking.start.slice(0, 10);
        if (extrasQuery.data?.packageGroupId && (deltaMin !== 0 || dateChanged)) {
          const siblings = await getPackageSiblings(booking.id);
          if (siblings.length > 0) {
            const ok = await confirm({
              title: t('window.package.transferTitle'),
              description: t('window.package.transferText'),
              tone: 'primary',
              confirmLabel: tc('actions.confirm'),
            });
            if (!ok) return;
          }
        }
        // Статус — отдельным вызовом changeBookingStatus (F-01-076, F-01-081, F-01-082): он же считает
        // +1/−1 неявок клиента при входе/выходе из «Не пришёл» (F-00-071) — прямой updateBooking(...,
        // { status }) эти последствия пропускал бы.
        savedBooking = await updateBooking(
          booking.id,
          {
            staffId,
            workplace,
            start,
            durationMin,
            services: serviceLinesForCore,
            clientId,
            comment: comment || undefined,
            visitId,
            visitorName: visitorNameForSave,
            resourceIds,
          },
          // F-01-033: та же запись, что грузило окно — второе одновременное сохранение получит 'conflict'
          booking.updatedAt,
        );
        if (extrasQuery.data?.packageGroupId && (deltaMin !== 0 || dateChanged)) {
          const authorName = staffList.find((s) => s.id === ownStaffId)?.name ?? t('window.deleteAuthorFallback');
          await transferPackageTogether(booking.id, deltaMin, authorName);
        }
        if (status !== booking.status) {
          // «Ждёт предоплату» — статус, который ставит только создание записи с предоплатой
          // (canTransition запрещает сотруднику ставить его руками) — правим полем напрямую.
          savedBooking =
            status === 'awaiting_prepayment'
              ? await updateBooking(savedBooking.id, { status })
              : await changeBookingStatus(savedBooking.id, status, 'business');
          // F-01-081: последствия «Клиент пришёл» (демо-списание расходников) и их откат при возврате
          // в любой другой статус — считаются заново при каждой смене статуса, входим в «Пришёл» или
          // выходим из него.
          if (status === 'arrived' || booking.status === 'arrived') {
            await syncArrivedConsequences(savedBooking.id, status);
          }
          // F-00-100: отменил мастер — внесённую предоплату возвращают полностью; в записи «Верните клиенту …» и «Вернул»,
          // в «Требует внимания» — строка возврата (сервер ставит refundDue сам, моковое ядро — нет)
          const refund = status === 'cancelled_by_master' ? masterCancelRefund(booking) : 0;
          if (refund > 0 && savedBooking.prepayment && !savedBooking.prepayment.refundDue && !savedBooking.prepayment.refundedAt) {
            savedBooking = await updateBooking(savedBooking.id, { prepayment: { ...savedBooking.prepayment, refundDue: refund } });
          }
          if (refund > 0) toast.success(t('window.cancelByMaster.refundToast', { amount: format.money(refund) }));
        }
      } else {
        savedBooking = await createBooking({
          businessId: businessId!,
          locationId,
          staffId,
          clientId,
          start,
          durationMin,
          status,
          services: serviceLinesForCore,
          resourceIds,
          workplace,
          source: 'journal',
          createdBy: ownStaffId ?? staffId,
          forWhom: 'self',
          comment: comment || undefined,
          visitId,
          visitorName: visitorNameForSave,
        });
      }

      const authorNameForHistory = staffList.find((s) => s.id === ownStaffId)?.name ?? t('window.deleteAuthorFallback');

      // F-01-096: история должна показывать, ЧТО реально изменилось (проверено: правка посетителя
      // писалась как «10:00, 6 000 ֏», хотя ни время, ни цена не менялись) — сравниваем сохранённые
      // поля со старой записью и пишем по одной строке на каждое изменённое поле, а не одну и ту же
      // «время + сумма» на любую правку. Смена статуса — отдельной строкой действием "statusChanged"
      // (F-01-099 «Готово когда»: три переноса видны цепочкой, потому что каждый — своя строка).
      const staffNameOf = (id: Id) => staffList.find((s) => s.id === id)?.name ?? id;
      const serviceNameOf = (id: Id) => {
        const svc = allServicesQuery.data?.find((s) => s.id === id);
        return svc ? pickText(svc.name, locale) : id;
      };
      const oldServiceKey = (booking?.services ?? [])
        .map((l) => `${l.serviceId}:${l.qty}`)
        .sort()
        .join('|');
      const newServiceKey = serviceLinesForCore
        .map((l) => `${l.serviceId}:${l.qty}`)
        .sort()
        .join('|');

      if (isEdit && booking) {
        const changes: string[] = [];
        if (booking.start !== start) {
          changes.push(
            t('window.history.fields.time', {
              from: `${format.date(booking.start.slice(0, 10), 'short')} ${format.time(booking.start)}`,
              to: `${format.date(start.slice(0, 10), 'short')} ${format.time(start)}`,
            }),
          );
        }
        if (booking.staffId !== staffId) {
          changes.push(t('window.history.fields.staff', { from: staffNameOf(booking.staffId), to: staffNameOf(staffId) }));
        }
        if (oldServiceKey !== newServiceKey) {
          changes.push(t('window.history.fields.services', { value: serviceLinesForCore.map((l) => serviceNameOf(l.serviceId)).join(', ') }));
        }
        if ((booking.clientId ?? '') !== (clientId ?? '')) {
          changes.push(t('window.history.fields.client'));
        }
        if ((booking.visitorName ?? '') !== (visitorNameForSave ?? '')) {
          changes.push(
            t('window.history.fields.visitor', {
              from: booking.visitorName || t('window.history.fields.none'),
              to: visitorNameForSave || t('window.history.fields.none'),
            }),
          );
        }
        if (booking.workplace !== workplace) {
          changes.push(t('window.history.fields.workplace'));
        }
        if ((booking.comment ?? '') !== (comment || '')) {
          changes.push(t('window.history.fields.comment'));
        }
        if (booking.total !== total) {
          changes.push(t('window.history.fields.total', { from: format.money(booking.total), to: format.money(total) }));
        }

        if (changes.length > 0) {
          await logBookingHistory(savedBooking.id, authorNameForHistory, 'updated', changes.join('; '));
        }
        if (status !== booking.status) {
          await logBookingHistory(
            savedBooking.id,
            authorNameForHistory,
            'statusChanged',
            t('window.history.summaryStatusChanged', {
              from: tDyn(`common.${BOOKING_STATUS_META[booking.status].labelKey}`),
              to: tDyn(`common.${BOOKING_STATUS_META[status].labelKey}`),
            }),
          );
        }
        if (changes.length === 0 && status === booking.status) {
          // Открыли и сохранили без единой правки (кнопка неактивна без touched — сюда практически
          // не попасть, но не оставлять запись совсем без строки на редкий случай программного save).
          await logBookingHistory(savedBooking.id, authorNameForHistory, 'updated', t('window.history.summaryNoChanges'));
        }
      } else {
        await logBookingHistory(
          savedBooking.id,
          authorNameForHistory,
          'created',
          t('window.history.summaryCreated', { time: format.time(start), total: format.money(total) }),
        );
      }

      await setBookingExtras(savedBooking.id, {
        categoryIds,
        colorIndex,
        customFieldValues,
        goodsLines: goodsLines.map((l) => ({
          id: l.id,
          itemId: l.itemId,
          qty: l.qty,
          price: l.unitPrice,
          discountPct: l.discountPct,
          sellerId: l.sellerId,
          code: l.code,
          ...(l.upsellOf ? { upsellOf: l.upsellOf } : {}),
        })),
        serviceLineExtras: serviceLines.map((l) => ({ discountPct: l.discountPct, assistants: l.assistants })),
        paidAmount,
      });
      if (linkedPlans.length > 0) {
        await attachLinkedBookings({
          mainBookingId: savedBooking.id,
          businessId: businessId!,
          locationId,
          clientId,
          createdBy: ownStaffId ?? staffId,
          order: packageDraft.added.some((p) => p.mode === 'parallel') ? 'parallel' : 'sequential_one',
          plans: linkedPlans,
        });
        packageDraft.reset();
      }
      if (breakMin > 0) await setBookingBreakOverride(savedBooking.id, breakMin);
      // F-01-041: несколько записей клиента, склеенных в визит, меняют статус все разом
      if (visitId) await syncVisitStatus(visitId, status, savedBooking.id);

      // core-rules-4: шаги «после сохранения» — запись хозяина уже есть, вклады пишут своё (оплата,
      // списание карты лояльности…) своими api; ошибка вклада не откатывает уже сохранённую запись.
      await saveSteps.runAfter(savedBooking.id, {
        staffId,
        clientId,
        start,
        durationMin,
        services: serviceLinesForCore,
        resourceIds,
        workplace,
        source: booking?.source ?? 'journal',
        status,
        comment: comment || undefined,
        total,
      });

      clearDraft(draftKey).catch(() => {});
      toast.success(tc('states.saved'));
      onSaved(savedBooking);
      onOpenChange(false);
    }, (err) => {
      // F-01-033: второе одновременное сохранение той же записи — свой текст, а не общее «не получилось»
      const code = err instanceof ApiError ? err.code : undefined;
      // F-16-012: единственный аппарат/кабинет уже занят в это время — сказать это, а не «не получилось»
      toast.error(code === 'conflict' ? tc('bookingErrors.conflict') : code === 'resource_unavailable' ? tc('bookingErrors.resource_unavailable') : tc('states.actionFailed'));
    });
  };

  // F-01-118: ⭐ вместо системного «вы уверены?» — удаляем сразу и даём 5 секунд на «Отменить»
  // (F-00-061); F-01-119 запоминает, кто удалил — своя запись в extras, ядро своего автора не хранит.
  const handleDelete = async () => {
    if (!booking) return;
    // F-01-136: у пакетной записи спрашиваем сразу «весь пакет» или «только эту услугу» — до
    // предупреждения об оплате, чтобы не пугать денежным диалогом того, кто хочет снять только одну.
    let deleteWholePkg = false;
    if (extrasQuery.data?.packageGroupId) {
      const siblings = await getPackageSiblings(booking.id);
      if (siblings.length > 0) {
        deleteWholePkg = await confirm({
          title: t('window.package.deleteTitle'),
          description: t('window.package.deleteWholeText'),
          tone: 'danger',
          confirmLabel: t('window.package.deleteWholeConfirm'),
          cancelLabel: t('window.package.deleteOneInstead'),
        });
      }
    }
    // F-01-120: удаление ОПЛАЧЕННОЙ записи предупреждает, что именно уйдёт из кассы/склада/абонемента,
    // прежде чем действовать — «Отменить» на 5 секунд (F-00-061) остаётся общей защитой от случайного
    // удаления, а это предупреждение — специально для денег.
    const impact = await getDeletionImpact(booking.id);
    if (impact.paidAmount > 0 || impact.consumablesReturned || impact.subscriptionVisitReturned) {
      const parts = [
        impact.paidAmount > 0 ? t('window.deleteImpact.money', { amount: format.money(impact.paidAmount) }) : undefined,
        impact.consumablesReturned ? t('window.deleteImpact.consumables') : undefined,
        impact.subscriptionVisitReturned ? t('window.deleteImpact.subscription') : undefined,
      ].filter(Boolean);
      const ok = await confirm({
        title: t('window.deleteImpact.title'),
        description: parts.join(' · '),
        tone: 'danger',
        confirmLabel: tc('actions.delete'),
      });
      if (!ok) return;
    }
    const authorName = staffList.find((s) => s.id === ownStaffId)?.name ?? t('window.deleteAuthorFallback');
    try {
      if (deleteWholePkg) {
        // F-01-136 «удалить пакет»: связанные записи пакета уходят без отдельного «Отменить» на
        // каждую — тост один, общий (undo вернул бы только эту, оставив пакет разорванным).
        await deleteWholePackage(booking.id, authorName);
        toast.success(t('window.package.deletedWholeToast'));
      } else {
        await deleteMutation.mutate({ id: booking.id, authorName });
        clearDraft(draftKey).catch(() => {});
        // F-01-118: тост ТЗ — «Запись отменена» (не общее tc('states.deleted')).
        toast.success(t('window.deleteToast'), {
          action: {
            label: t('window.deleteUndo'),
            onClick: () => {
              undoDeleteBooking(booking.id)
                .then(() => onSaved())
                .catch(() => toast.error(tc('states.actionFailed')));
            },
          },
          durationMs: 5000,
        });
      }
      onSaved();
      onOpenChange(false);
    } catch {
      toast.error(tc('states.actionFailed'));
    }
  };

  // F-01-083: «Оплатить» сам ставит «Клиент пришёл» — статус должен сохраниться в ядре сразу же
  // (changeBookingStatus), а не только в локальном состоянии окна, иначе кнопка «Оплатить» ничего
  // не переживает при перезагрузке страницы (оплата сохранялась, статус — нет).
  const handlePay = async () => {
    // F-01-138: запись уже сохранена — открываем окно «Оплата визита» (способы, раздельная оплата,
    // лояльность первой, чек). Новую (ещё не сохранённую) запись оплатить нечем писать — старое
    // мгновенное поведение остаётся как было, до первого «Сохранить».
    if (isEdit && booking) {
      setPaymentSheetOpen(true);
      return;
    }
    await runBusy(
      setPaying,
      async () => {
        setPaidAmount(total);
        toast.success(tc('states.saved'));
      },
      () => toast.error(tc('states.actionFailed')),
    );
  };

  // F-01-142: строки оплаты записаны (payBookingLines/cancelPaymentLine в PaymentSheet) — тут только
  // подхватить сумму в локальный стейт и, как раньше делал handlePay, довести статус до «Клиент пришёл».
  const handlePaymentSheetPaid = async (extras: { paidAmount: number; payments: JournalPaymentLine[] }) => {
    setPaidAmount(extras.paidAmount);
    // Деньги окна идут через кассу (режим api): «Оплачено» берёт max(журнал, касса) — обе сводки перечитываем,
    // иначе после возврата окно держит старые 5 000 «Оплачено полностью» до повторного открытия (final-api.md)
    refetchExtras();
    financeSummaryQuery.refetch();
    // F-01-083: оплата ставит «Пришёл» из любого статуса до прихода (как «Оплатить» в «Списке»)
    if (booking && (['scheduled', 'awaiting_confirmation', 'client_confirmed', 'awaiting_prepayment'] as BookingStatus[]).includes(status)) {
      await changeBookingStatus(booking.id, 'arrived', 'business');
      await syncArrivedConsequences(booking.id, 'arrived'); // F-01-081/F-01-083
      setStatus('arrived');
    }
  };

  // F-01-079: снять отметку оплаты — визит становится «оплачен не полностью»
  const handleCancelPayment = async () => {
    if (!booking) return;
    await runBusy(
      setCancelingPayment,
      async () => {
        // Л1/Л6: вместе с платежами возвращается списанное лояльностью и снимается кэшбэк за визит
        await cancelVisitPayments({ businessId: booking.businessId, locationId, bookingId: booking.id, visit: { lines: [] } });
        setPaidAmount(0);
        toast.success(tc('states.saved'));
      },
      () => toast.error(tc('states.actionFailed')),
    );
  };

  const noServiceSelected = serviceLines.length === 0 && goodsLines.length === 0;
  const noClientEntered = !phone && !clientName && !matchedClient;
  const saveLabel = isEdit
    ? t('window.save.saveChanges')
    : noServiceSelected && noClientEntered
      ? t('window.save.createEmpty')
      : t('window.save.create');

  const extDraft: ExtBookingDraft = {
    staffId,
    clientId: matchedClient?.id ?? booking?.clientId,
    start: combine(date, time),
    durationMin,
    services: serviceLines.map((line) => ({
      serviceId: line.serviceId,
      staffId: line.staffId,
      price: serviceLineTotal(line),
      durationMin: line.durationMin,
      qty: line.qty,
      // Л4: цена по прайсу и личная скидка строки — вкладке «Лояльность», чтобы скидка на визит была одна
      unitPrice: line.unitPrice,
      discountPct: line.discountPct,
    })),
    resourceIds: booking?.resourceIds ?? [],
    workplace,
    source: booking?.source ?? 'journal',
    status,
    comment,
    forWhom: booking?.forWhom ?? 'self',
    total,
  };

  // core-rules-4: вклад может поправить черновик (скидка, ресурс, комментарий…) — принимаем только поля,
  // у которых в окне есть свой setState; остальные патчи (services/clientId — своя сложная форма
  // ввода) молча игнорируются, вклад в этом случае пишет через свой bookingId в registerAfterSave.
  const handleExtDraftChange = (patch: Partial<ExtBookingDraft>) => {
    if (patch.workplace !== undefined) setWorkplace(patch.workplace);
    if (patch.resourceIds !== undefined) setResourceIds(patch.resourceIds);
    if (patch.comment !== undefined) setComment(patch.comment ?? '');
    if (patch.status !== undefined) setStatus(patch.status);
    if (patch.start !== undefined) {
      setDate(patch.start.slice(0, 10) as ISODate);
      setTime(patch.start.slice(11, 16) as TimeHM);
    }
  };

  // ⭐ Запись на сдачу (05.10.2026): вкладка «Сдача заказа» (раздел orders) — только у записи на услугу «Приём заказа»
  const isIntakeBookingOpen = isEdit && Boolean(booking?.services.some((l) => servicesById.get(l.serviceId)?.kind === 'intake'));
  const extEntries = allExtEntries.filter(
    (e) => (isEdit || !NEW_BOOKING_HIDDEN_EXT_AREAS.has(e.area)) && (e.area !== 'online' || onlineTabHasContent) && (e.area !== 'orders' || isIntakeBookingOpen),
  );
  const activeExtEntry = extEntries.find((e) => e.area === activeMainTab);

  // F-01-178/F-01-180: ограничение истории раньше гасило только Save/Delete (canEditNow/canDeleteNow)
  // — ТЗ требует «не открывает записи старше недели», то есть саму запись за окном не видно, а не
  // только недоступно менять; ниже подменяем всё тело окна на замок, footer (Cancel/Save) не трогаем —
  // Save и так задизейблен через canEditNow.
  const beyondHistoryLocked = isEdit && beyondHistory;

  // Зоны окна — отдельными значениями ДО return: React Compiler запоминает каждую со своими зависимостями. Внутри
  // тернарника JSX их не запоминал — каждый ответ «сети» перерисовывал все три зоны (qa/journal-redesign/open-diag.mjs).
  const leftZone = (
    <LeftZone
      isEdit={isEdit}
      staff={staff}
      staffList={staffList}
      onDelete={isEdit && canDeleteNow ? handleDelete : undefined}
      deleting={deleteMutation.isPending}
      // F-01-179 «Изменять сотрудника и время записи»/«Изменять длительность»: у СОХРАНЁННОЙ
      // записи без права поля заблокированы (lockSchedule/lockDuration ниже), «Создавать
      // записи» их не ограничивает.
      lockSchedule={isEdit && !windowRights.changeStaffAndTime}
      lockDuration={isEdit && !windowRights.changeDuration}
      onStaffChange={handleStaffChange}
      workplace={workplace}
      onWorkplaceChange={withTouch(setWorkplace)}
      canPickHomeWorkplace={canPickHomeWorkplace}
      date={date}
      onDateChange={withTouch(setDate)}
      time={time}
      onTimeChange={withTouch(setTime)}
      durationMin={durationMin}
      onDurationChange={withTouch(setDurationMin)}
      breakMin={breakMin}
      onBreakChange={withTouch(setBreakMin)}
      pinnedFields={pinnedFields}
      renderPinnedField={renderFieldEditor}
      expandedTileActive={expandedTileActive}
      onToggleExpandedTile={() => setExpandedTileActive((v) => !v)}
      onOpenRepeat={isEdit ? () => setRepeatOpen(true) : undefined}
      onOpenHistory={isEdit ? () => setHistoryOpen(true) : undefined}
      bookingId={booking?.id}
      clientId={matchedClient?.id ?? booking?.clientId}
      clientName={matchedClient?.name ?? clientName}
      authorName={staffList.find((s) => s.id === ownStaffId)?.name ?? t('window.deleteAuthorFallback')}
      resources={resourcesQuery.data ?? []}
      resourceIds={resourceIds}
      onResourceIdsChange={withTouch(setResourceIds)}
      occupiedResourceInstanceIds={occupiedResourceQuery.data}
    />
  );
  const centerZone = (
    <CenterZone
      isEdit={isEdit}
      status={status}
      onStatusChange={handleStatusChange}
      activeTab={centerTab}
      onActiveTabChange={setCenterTab}
      services={staffServices}
      categories={serviceCategoriesQuery.data ?? []}
      frequentServices={frequentQuery.data ?? []}
      lastClientServiceId={lastServiceQuery.data}
      serviceLines={serviceLines}
      upsellConfigs={upsellConfigsQuery.data}
      onAddService={(service, upsellOf) => {
        setTouched(true);
        // F-16-125/130: пакет — все его услуги попадают в визит: услуги мастера окна строками
        // этой записи, остальные — связанными записями (блок ниже). Второй пакет ложится рядом.
        if (service.servicePackage) {
          const own = packageDraft.addPackage(service, staffId);
          const ownMin = own.reduce((n, l) => n + l.durationMin, 0);
          setServiceLines((prev) => [
            ...prev,
            ...own.map((l) => ({
              serviceId: l.serviceId,
              staffId,
              name: l.name,
              durationMin: l.durationMin,
              qty: 1,
              unitPrice: l.price,
              discountPct: personalDiscountPct,
              packageId: l.packageId,
            })),
          ]);
          if (ownMin > 0) setDurationMin((prev) => (serviceLines.length === 0 ? ownMin : prev + ownMin));
          toast.success(t('window.packageDraft.addedToast', { name: pickText(service.name, locale) }));
          return;
        }
        // F-16-129: сначала выбрали запись другого мастера пакета — услуга уходит в неё
        if (packageDraft.target !== 'main') {
          packageDraft.addServiceToLinked(packageDraft.target, service);
          toast.success(t('window.serviceLine.added'));
          return;
        }
        setServiceLines((prev) => [
          ...prev,
          {
            serviceId: service.id,
            staffId,
            name: pickText(service.name, locale),
            durationMin: service.durationMin,
            qty: 1,
            unitPrice: service.priceMin,
            // F-01-207: личная скидка клиента подставляется сама — строку можно поменять
            // или убрать прямо в ServiceLineRow, карточку клиента трогать не нужно.
            discountPct: personalDiscountPct,
            ...(upsellOf ? { upsellOf } : {}),
          },
        ]);
        // qa/measure/journal/ux-r2.md #1: первая услуга должна ЗАМЕНЯТЬ длительность записи
        // своей, а не прибавляться к нулю по умолчанию (10:00–11:00) — иначе запись остаётся
        // часовой даже когда услуга занимает 2 часа или 20 минут.
        setDurationMin((prev) => (serviceLines.length === 0 ? service.durationMin : prev + service.durationMin));
        // F-01-046: «Услуга с привязанным ресурсом подставляет его сама» — первый свободный
        // экземпляр ресурса, у которого serviceIds включает эту услугу.
        const boundResource = (resourcesQuery.data ?? []).find((r) => r.serviceIds.includes(service.id));
        if (boundResource) {
          const freeInstance = boundResource.instances.find(
            (i) => !resourceIds.includes(i.id) && !occupiedResourceQuery.data?.has(i.id),
          );
          if (freeInstance) {
            setResourceIds((prev) => [...prev, freeInstance.id]);
          }
        }
        // Без тоста «Услуга добавлена»: строка появляется в составе визита прямо под рукой, а тост на каждый клик
        // двигал стопку уведомлений (scripts/flicker.mjs, journal-create)
      }}
      onUpdateServiceLine={(index, patch) => {
        setTouched(true);
        setServiceLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
      }}
      onRemoveServiceLine={(index) => {
        setTouched(true);
        setServiceLines((prev) => prev.filter((_, i) => i !== index));
      }}
      goodsCatalog={goodsCatalogQuery.data ?? []}
      goodsLines={goodsLines}
      staffOptions={staffList}
      assistantPayEnabled={journalSettingsQuery.data?.assistantPayEnabled}
      onAddGoods={(item, upsellOf) => {
        setTouched(true);
        setGoodsLines((prev) => [
          ...prev,
          {
            id: `local-${prev.length}-${item.id}`,
            itemId: item.id,
            name: item.name,
            qty: 1,
            unitPrice: item.price,
            discountPct: 0,
            sellerId: staffId,
            qtyLocked: item.kind !== 'product',
            ...(upsellOf ? { upsellOf } : {}),
          },
        ]);
        toast.success(t('window.goodsLine.added'));
      }}
      onUpdateGoodsLine={(id, patch) => {
        setTouched(true);
        setGoodsLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
      }}
      onRemoveGoodsLine={(id) => {
        setTouched(true);
        // F-01-213 «Готово, когда»: удаление ОПЛАЧЕННОГО товара из визита с «Сохранить»
        // снимает его сумму с оплаты, услуга остаётся оплаченной — иначе paidAmount после
        // удаления товара продолжал бы считать визит оплаченным на старую (большую) сумму.
        const removed = goodsLines.find((l) => l.id === id);
        if (removed && paidAmount > 0) {
          setPaidAmount((prev) => Math.max(0, prev - goodsLineTotal(removed)));
          toast.info(t('window.goodsLine.removedPaidToast'));
        }
        setGoodsLines((prev) => prev.filter((l) => l.id !== id));
      }}
      paidAmount={shownPaid}
      onPay={handlePay}
      paying={paying}
      canPay={windowRights.takePayment}
      onCancelPayment={isEdit ? handleCancelPayment : undefined}
      cancelingPayment={cancelingPayment}
      expandedTileActive={expandedTileActive}
      expandedFieldsPanel={expandedPanel}
      packagePanel={
        <PackageDraftPanel
          draft={packageDraft}
          mainStart={combine(date, time)}
          mainDurationMin={durationMin}
          mainStaffName={staff?.name ?? ''}
          serviceLines={serviceLines}
          staffList={staffList}
          onRemovePackage={(packageId) => {
            setTouched(true);
            const removedMin = serviceLines.filter((l) => l.packageId === packageId).reduce((n, l) => n + l.durationMin * l.qty, 0);
            setServiceLines((prev) => prev.filter((l) => l.packageId !== packageId));
            if (removedMin > 0) setDurationMin((prev) => Math.max(MIN_DURATION_MIN, prev - removedMin));
            packageDraft.removePackage(packageId);
          }}
        />
      }
      timingActions={
        // Решение 01.10: заявка закрыта переносом (клиент взял окно, предложенное мастером) — «Перенесена на …», а не просто «Отменил клиент»
        isEdit && booking?.cancelReason === 'rescheduled' && booking.rescheduledTo ? (
          <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm text-fg">
            {tc('bookingCancelReason.rescheduledTo', { date: format.dateTime(booking.rescheduledTo) })}
          </p>
        ) : isEdit && booking && !touched && (canFinishEarly(booking, timingNow) || canStartNow(booking, timingNow) || (booking.status === 'arrived' && booking.clientId)) ? (
          <div className="flex flex-wrap gap-2" data-f="F-00-058">
            {booking.status === 'arrived' && booking.clientId && (
              <Button
                size="sm"
                variant="secondary"
                leftIcon={<CalendarPlus aria-hidden />}
                onClick={() => {
                  onOpenChange(false);
                  openNextVisit(booking.id);
                }}
              >
                {t('board.nextVisit.button')}
              </Button>
            )}
            {canStartNow(booking, timingNow) && (
              <Button size="sm" variant="secondary" leftIcon={<FastForward aria-hidden />} onClick={() => void timing.startNow(booking).then((ok) => ok && onOpenChange(false))}>
                {t('board.timing.startNow')}
              </Button>
            )}
            {canFinishEarly(booking, timingNow) && (
              <Button size="sm" variant="secondary" leftIcon={<FlagTriangleRight aria-hidden />} onClick={() => void timing.finishNow(booking).then((ok) => ok && onOpenChange(false))}>
                {t('board.timing.finishEarly')}
              </Button>
            )}
          </div>
        ) : undefined
      }
      paymentPolicy={
        isEdit && booking?.prepayment ? (
          <PaymentPolicyBlock
            prepayment={booking.prepayment}
            freeCancelUntil={freeCancelUntil(
              booking,
              effectiveBookingRules(
                undefined,
                staffList.find((s) => s.id === booking.staffId),
              ),
            )}
            now={nowDateTime()}
            decision={extrasQuery.data?.prepaymentDecision}
            cancelledLate={booking.cancelledLate}
            refunding={refundMutation.isPending}
            onRefunded={() => {
              refundMutation
                .mutate(booking.id)
                .then(() => toast.success(t("window.policy.refundedToast")))
                .catch(() => toast.error(tc("states.actionFailed")));
            }}
          />
        ) : undefined
      }
    />
  );
  const clientZone = (
    <ClientZone
      businessId={businessId!}
      locationId={locationId}
      phone={phone}
      onPhoneChange={withTouch(setPhone)}
      clientName={clientName}
      onClientNameChange={withTouch(setClientName)}
      email={email}
      onEmailChange={withTouch(setEmail)}
      matchedClient={matchedClient}
      onSelectClient={(c) => {
        setMatchedClient(c);
        setPhone(c.phone);
        setClientName(c.name);
        setEmail(c.email ?? '');
      }}
      recordData={
        isEdit && booking
          ? {
              createdAt: booking.createdAt,
              paymentStatus: paidAmount <= 0 ? 'unpaid' : paidAmount < total ? 'partial' : 'paid',
              source: booking.source,
              createdByLabel:
                booking.createdBy === 'client'
                  ? t('window.right.authorClient')
                  : (staffList.find((s) => s.id === booking.createdBy)?.name ?? t('window.right.authorUnknown')),
            }
          : undefined
      }
      visitorEnabled={visitorEnabled}
      onVisitorEnabledChange={withTouch(setVisitorEnabled)}
      visitorName={visitorName}
      onVisitorNameChange={withTouch(setVisitorName)}
      clientId={matchedClient?.id ?? booking?.clientId}
    />
  );

  const tabItems = [{ value: 'record', label: t('window.tabs.record') }, ...extEntries.map((e) => ({ value: e.area, label: tDyn(e.labelKey) }))];
  // Тело окна — значением до return: React Compiler запоминает его целиком, и шторка не перерисовывает содержимое,
  // когда меняется только подвал (кнопка «Сохранить»).
  const windowBody = (
    <>
      {/* F-01-185: то же самое окно (статус, состав услуг/товаров, оплата, удаление) — здесь, а не в
          отдельном мобильном приложении (в проекте его нет, см. JournalScreen.tsx): Sheet отзывчив и
          на телефоне 390×844, и на десктопе, работает с тем же общим стором. */}
      <div data-f="F-01-037 F-01-185 F-14-091" className="flex flex-col gap-4">
        {!bodyReady || (isEdit && !staffScope.ready) ? (
          <div aria-busy className="flex flex-col gap-4">
            <Skeleton variant="rect" className="h-10 w-48 rounded-lg" />
            <Skeleton variant="rect" className="h-64 w-full rounded-xl" />
            <Skeleton lines={4} />
          </div>
        ) : foreignLocked ? (
          <div
            data-f="F-01-178"
            data-foreign-lock=""
            className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border-strong bg-surface-2 px-4 py-10 text-center"
          >
            <Lock aria-hidden className="size-8 text-muted" />
            <p className="font-medium text-fg">{t('window.foreignTitle')}</p>
            <p className="max-w-sm text-sm text-muted">{t('window.foreignText')}</p>
          </div>
        ) : beyondHistoryLocked ? (
          <div
            data-f="F-01-178 F-01-180 F-10-133 F-10-134 F-10-136"
            className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border-strong bg-surface-2 px-4 py-10 text-center"
          >
            <Lock aria-hidden className="size-8 text-muted" />
            <p className="font-medium text-fg">{t('window.beyondHistoryTitle')}</p>
            <p className="max-w-sm text-sm text-muted">{t('window.beyondHistoryText')}</p>
          </div>
        ) : (
          <>
            <Tabs
              value={activeMainTab}
              onValueChange={setActiveMainTab}
              items={tabItems}
            />

            {/* Три зоны — друг под другом. Sheet size="lg" ограничен 42rem (общий компонент, см. qa/requests/journal.md:
            «шире size для Sheet» — нужен для F-01-037 «панель ~75% экрана» с зонами БОК О БОК на десктопе);
            на этой ширине колонки 280+1fr+260 не помещаются и вылезают за край при lg: (он смотрит на
            ширину ЭКРАНА, не панели) — вместо теснящегося макета зоны идут одна под одной, без вылета. */}
            {activeMainTab !== 'record' && activeExtEntry ? (
              <ExtensionSlot
                entry={activeExtEntry}
                props={{
                  mode: isEdit ? 'edit' : 'create',
                  bookingId: booking?.id,
                  businessId: businessId!,
                  locationId,
                  draft: extDraft,
                  onDraftChange: handleExtDraftChange,
                  registerBeforeSave: saveSteps.registerBeforeSave,
                  registerAfterSave: saveSteps.registerAfterSave,
                }}
              />
            ) : (
              // F-01-037: три зоны бок о бок на широкой панели. Sheet size="xl" (min(60rem, 100vw-5rem))
              // + @container на контенте шторки (Sheet.tsx) дают колонке реальную ширину независимо от
              // экрана — @4xl (56rem) переключает на строку, когда 280px + гибкий центр + 260px реально
              // помещаются; уже, включая телефон, зоны идут одна под одной, как раньше.
              <div className="flex flex-col gap-6 @4xl:flex-row @4xl:items-start @4xl:gap-4">
                <div className="flex min-w-0 flex-col gap-4 @4xl:w-72 @4xl:shrink-0">
                  {leftZone}

                  {repeatOpen && booking && (
                    <RecurrenceForm
                      booking={booking}
                      onHide={() => setRepeatOpen(false)}
                      authorName={staffList.find((s) => s.id === ownStaffId)?.name ?? t('window.deleteAuthorFallback')}
                    />
                  )}

                  {historyOpen && booking && <HistoryPanel bookingId={booking.id} onHide={() => setHistoryOpen(false)} />}

                  {secondaryReady && isEdit && booking && (
                    <PackageSiblingsPanel
                      bookingId={booking.id}
                      onOpenSibling={(siblingId) => {
                        onOpenChange(false);
                        router.push(`/biz/journal?booking=${siblingId}`);
                      }}
                    />
                  )}
                </div>

                <div className="flex min-w-0 flex-1 flex-col gap-4">
                  {centerZone}

                  {paymentSheetMounted && isEdit && booking && businessId && (
                    <PaymentSheet
                      open={paymentSheetOpen}
                      onOpenChange={setPaymentSheetOpen}
                      businessId={businessId}
                      locationId={locationId}
                      bookingId={booking.id}
                      total={total}
                      paidAmount={shownPaid}
                      payments={extrasQuery.data?.payments ?? []}
                      clientPhone={matchedClient?.phone ?? phone}
                      clientId={matchedClient?.id ?? booking.clientId}
                      visitLines={serviceLines.map((l) => ({ serviceId: l.serviceId, price: serviceLineTotal(l), listPrice: Math.round(l.unitPrice * l.qty) }))}
                      onPaid={handlePaymentSheetPaid}
                    />
                  )}

                  {isEdit && extrasQuery.data?.autoWriteoff && (
                    <div
                      data-f="F-01-080 F-01-081"
                      className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface-2 px-3.5 py-2.5"
                    >
                      {extrasQuery.data.autoWriteoff.status === 'written_off' && (
                        <Badge tone="success" size="sm">
                          {t('window.autoWriteoff.written')}
                        </Badge>
                      )}
                      {extrasQuery.data.autoWriteoff.status === 'not_written_off' && (
                        <>
                          <Badge tone="warning" size="sm">
                            {t('window.autoWriteoff.notWritten')}
                          </Badge>
                          <span className="text-xs text-muted">
                            {t('window.autoWriteoff.amountDue', { amount: format.money(extrasQuery.data.autoWriteoff.amountDue) })}
                          </span>
                        </>
                      )}
                    </div>
                  )}

                  {secondaryReady && isEdit && booking && businessId && (
                    <ConsumablesTile
                      businessId={businessId}
                      locationId={locationId}
                      bookingId={booking.id}
                      status={status}
                      services={booking.services}
                      techCardOverrides={extrasQuery.data?.techCardOverrides}
                    />
                  )}
                </div>

                <div className="min-w-0 @4xl:w-72 @4xl:shrink-0">
                  {rightZoneHidden ? (
                    <button
                      type="button"
                      onClick={() => setRightZoneHidden(false)}
                      className="flex h-fit items-center gap-1 self-start rounded-full border border-border px-3 py-2 text-sm text-muted hover:bg-surface-2"
                    >
                      <ChevronRight aria-hidden className="size-4" />
                      {t('window.right.show')}
                    </button>
                  ) : (
                    <div className="flex flex-col gap-3">
                      <div className="flex justify-end">
                        <IconButton icon={<EyeOff aria-hidden />} label={t('window.right.hide')} size="sm" onClick={() => setRightZoneHidden(true)} />
                      </div>
                      {secondaryReady ? (
                        clientZone
                      ) : (
                        // Форма зоны клиента (карточка клиента, «Написать», кнопки профиля, примечание, лояльность),
                        // чтобы приход зоны не толкал окно
                        <div aria-busy className="flex flex-col gap-3">
                          <Skeleton variant="rect" className="h-16 w-full rounded-xl" />
                          <Skeleton variant="rect" className="h-8 w-2/3 rounded-lg" />
                          <Skeleton variant="rect" className="h-20 w-full rounded-xl" />
                          <Skeleton variant="rect" className="h-24 w-full rounded-xl" />
                          <Skeleton variant="rect" className="h-28 w-full rounded-xl" />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? t('window.editTitle') : t('window.createTitle')}
      description={foreignLocked ? undefined : staff?.name}
      size="xl"
      // Телефон: шторка снизу сразу во всю свою высоту — зоны окна, которые монтируются кадром позже (secondaryReady),
      // и ответы «сети» не растягивают её вверх на глазах (сдвиг 0.15, scripts/flicker.mjs journal-open@phone)
      classNames={{ panel: 'max-md:h-[90dvh]' }}
      // F-01-037 «Готово, когда»: «окно открывается справа, сетка слева видна» — не только видна, но
      // и рабочая (кликабельна) рядом с окном записи. `Sheet.modal=false` (только на десктопе — на
      // телефоне шторка всегда модальная, см. src/ui/Sheet.tsx) снимает затемнение и ловушку фокуса,
      // без нового общего компонента.
      modal={false}
      headerActions={
        <div className="flex items-center gap-1">
          {isEdit && windowRights.createBookings && !foreignLocked && !beyondHistory && (
            <span data-f="F-01-192">
              <IconButton
                icon={<Copy aria-hidden />}
                label={t('window.duplicate')}
                variant="ghost"
                disabled={duplicating}
                className="rounded-full text-muted hover:text-fg"
                onClick={async () => {
                  if (!booking) return;
                  // Решение 01.10.2026: не копия на то же время (двойная запись), а новая запись с тем же клиентом,
                  // мастером и услугами — в ближайшее свободное окно мастера в этот день; «Записать» — за человеком
                  setDuplicating(true);
                  try {
                    const start = await findSameDaySlot(booking);
                    if (!start) toast.info(t('window.duplicateNoSlot'));
                    const sp = new URLSearchParams({ new: '1', staff: booking.staffId, date: booking.start.slice(0, 10) });
                    if (start) sp.set('start', start);
                    if (booking.clientId) sp.set('client', booking.clientId);
                    if (booking.services.length) sp.set('services', booking.services.map((l) => l.serviceId).join(','));
                    router.push(`/biz/journal?${sp.toString()}`);
                  } finally {
                    setDuplicating(false);
                  }
                }}
              />
            </span>
          )}
          <IconButton
            icon={<ChevronRight aria-hidden />}
            label={t('window.collapseHide')}
            variant="ghost"
            className="rounded-full text-muted hover:text-fg"
            onClick={() => onOpenChange(false)}
          />
        </div>
      }
      footer={
        <div
          data-f="F-01-038 F-01-039 F-01-040 F-01-041 F-01-066 F-01-085 F-01-179 F-01-180 F-04-063 F-04-065 F-04-092"
          className="flex w-full items-center justify-end gap-2"
        >
          <Button type="button" variant="outline" onClick={cancelWindow}>
            {tc('actions.cancel')}
          </Button>
          <Button type="button" data-f="F-01-116 F-16-128" loading={saving} disabled={isEdit ? !touched || !canEditNow : !canEditNow} onClick={handleSave}>
            {saveLabel}
          </Button>
        </div>
      }
    >
      {windowBody}
    </Sheet>
  );
}
