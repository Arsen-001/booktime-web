import { newId } from "@/lib/id";
import type {
  ClientSubscriptionBalance,
  BookingCategoryDef,
  CustomFieldDef,
  GoodsCatalogItem,
  JournalLedgerEntry,
  JournalPrefs,
  JournalSettings,
  JournalWindowState,
  BookingLacquer,
  StaffSet,
  DayLayout,
  SlotOffer,
  RequestReminder,
} from "@/domain/journal";
import { DEFAULT_JOURNAL_SETTINGS, EMPTY_BOOKING_EXTRAS } from "@/domain/journal";
import { addDays, today } from "@/lib/date";
import { defineSlice } from "@/mock/slice";

/**
 * Срез моковой базы раздела «journal». Принадлежит разделу.
 * Храните здесь свои данные (ключ — id сущностей ядра). Меняете форму — поднимите version.
 */
export interface JournalState extends JournalWindowState {
  prefs: JournalPrefs;
  /** Настройки страницы «Цифровой журнал» (F-01-168), пачка b05 */
  settings: JournalSettings;
  /** Палитра оттенков лака салона (F-00-094) — из неё карточка журнала берёт тон записи (DESIGN.md «C · Тон») */
  lacquerShades: BookingLacquer[];
  /**
   * «Мои наборы» мастеров, id сотрудника → его наборы (⭐ 29.09.2026). Поле добавлено без подъёма version: у уже
   * засеянной базы его досыпает fillMissingAreas (src/mock/db.ts) — журнал пользователя не пересевается.
   */
  staffSets: Record<string, StaffSet[]>;
  /** id сотрудника → выбранный вид дня (⭐ 29.09.2026); досыпается так же, как staffSets */
  dayLayouts: Record<string, DayLayout>;
  /** «Предложить окно» из «Найти окно» (⭐ 29.09.2026), новые впереди; досыпается так же, как staffSets */
  slotOffers: SlotOffer[];
  /** Напоминания мастеру о заявках без ответа (⭐ 29.09.2026); досыпается так же */
  requestReminders: RequestReminder[];
}

const SYSTEM_CATEGORIES: BookingCategoryDef[] = [
  {
    id: newId("bc"),
    labelKey: "fullOnlinePayment",
    colorIndex: 3,
    system: true,
  },
  {
    id: newId("bc"),
    labelKey: "partialOnlinePayment",
    colorIndex: 7,
    system: true,
  },
  { id: newId("bc"), labelKey: "staffImportant", colorIndex: 1, system: true },
  {
    id: newId("bc"),
    labelKey: "staffNotImportant",
    colorIndex: 5,
    system: true,
  },
];

/**
 * Пять демо-полей — по одному на тип (F-01-053). В интерфейсе ещё нет конструктора полей (экран
 * настроек сети не входит в эту пачку) — сиды играют роль уже созданных владельцем полей.
 * ⭐ F-00-004: скорость важнее полноты полей — ни одно демо-поле не обязательно «при создании»
 * (это держало бы быструю запись постоянного клиента дольше 3 нажатий); «обязательное при статусе
 * Клиент пришёл» показано на одном поле (consentDate) — проверить проще, ломает меньше сценариев.
 */
const CUSTOM_FIELD_DEFS: CustomFieldDef[] = [
  {
    id: newId("cf"),
    key: "contractNo",
    label: "Номер договора",
    type: "text",
    alwaysShow: false,
    requiredOnCreate: false,
    requiredOnArrived: false,
    editableByUser: true,
  },
  {
    id: newId("cf"),
    key: "externalId",
    label: "ID во внешней CRM",
    type: "number",
    alwaysShow: false,
    requiredOnCreate: false,
    requiredOnArrived: false,
    editableByUser: true,
  },
  {
    id: newId("cf"),
    key: "channel",
    label: "Откуда узнали",
    type: "select",
    options: ["Инстаграм", "Рекомендация", "Прошёл мимо", "Сайт"],
    alwaysShow: true,
    requiredOnCreate: false,
    requiredOnArrived: false,
    editableByUser: true,
  },
  {
    id: newId("cf"),
    key: "consentDate",
    label: "Дата согласия на обработку данных",
    type: "date",
    alwaysShow: false,
    requiredOnCreate: false,
    requiredOnArrived: true,
    editableByUser: true,
  },
  {
    id: newId("cf"),
    key: "nextCheckupAt",
    label: "Следующий осмотр",
    type: "datetime",
    alwaysShow: false,
    requiredOnCreate: false,
    requiredOnArrived: false,
    editableByUser: false,
  },
];

const GOODS_CATALOG: GoodsCatalogItem[] = [
  {
    id: newId("gd"),
    name: "Шампунь профессиональный 250 мл",
    kind: "product",
    price: 6500,
    stock: 14,
    requiresCode: false,
  },
  {
    id: newId("gd"),
    name: "Масло для кутикулы",
    kind: "product",
    price: 2800,
    stock: 22,
    requiresCode: false,
  },
  {
    id: newId("gd"),
    name: "Воск для укладки",
    kind: "product",
    price: 4200,
    stock: 3,
    requiresCode: false,
  },
  {
    id: newId("gd"),
    name: "Крем для рук подарочный",
    kind: "product",
    price: 3100,
    stock: 0,
    requiresCode: false,
  },
  {
    id: newId("gd"),
    name: "Абонемент «5 визитов»",
    kind: "subscription",
    price: 45000,
    stock: 999,
    requiresCode: true,
    autoWriteoffAllowed: true,
  },
  {
    id: newId("gd"),
    name: "Абонемент «10 визитов»",
    kind: "subscription",
    price: 82000,
    stock: 999,
    requiresCode: true,
    autoWriteoffAllowed: true,
  },
  {
    id: newId("gd"),
    name: "Сертификат 20 000 ֏",
    kind: "certificate",
    price: 20000,
    stock: 999,
    requiresCode: false,
  },
  {
    id: newId("gd"),
    name: "Сертификат 50 000 ֏",
    kind: "certificate",
    price: 50000,
    stock: 999,
    requiresCode: false,
  },
];

export const journalSlice = defineSlice<JournalState>({
  // F-01-121: добавлено JournalSettings.deletionRestoreWindowDays (срок восстановления удалённой записи)
  // 15: первая строка карточки по умолчанию — имя клиента, палитра лаков lacquerShades (журнал A2, DESIGN.md)
  // 16 (owner 27.09.2026): отменённые записи по умолчанию скрыты в сетке дня (hiddenStatuses) — в мокапе их
  // не рисуют, они остаются в списке записей и истории клиента (не в этом срезе), только сетка их прятала.
  version: 16,
  seed: (core) => {
    // F-01-080 (демо, разделы «Лояльность»/«Услуги» ещё не построены): у первой услуги каждого
    // бизнеса включаем автосписание, и заводим абонемент с остатком у части клиентов бизнеса —
    // иначе значкам «Списано»/«Не списано» неоткуда взяться на демо-данных.
    const autoWriteoffServiceIds = Array.from(
      new Set(core.services.filter((s) => s.active).map((s) => s.businessId)),
    )
      .map(
        (businessId) =>
          core.services.find((s) => s.businessId === businessId && s.active)
            ?.id,
      )
      .filter((id): id is string => Boolean(id));
    const subscriptionItem = GOODS_CATALOG.find(
      (g) => g.kind === "subscription" && g.autoWriteoffAllowed,
    );
    const clientSubscriptions: ClientSubscriptionBalance[] = subscriptionItem
      ? core.clients
          .filter((_, i) => i % 4 === 0)
          .map((c, i) => ({
            id: newId("csub"),
            clientId: c.id,
            itemId: subscriptionItem.id,
            // Часть абонементов уже почти исчерпана — чтобы встречалось и «Не списано, доплата».
            remainingVisits: i % 3 === 0 ? 0 : 5,
            expiresAt: addDays(today(), 30),
          }))
      : [];

    const ledgerEntries: JournalLedgerEntry[] = [];

    // F-00-097: предоплата, полученная до визита, — строка оплаты визита, как после «Деньги пришли»
    // (recordPrepaymentLineSync). Без неё засеянные предоплаченные записи просили в журнале всю сумму, а не остаток.
    const extras: JournalState["extras"] = Object.fromEntries(
      core.bookings
        .filter((b) => b.prepayment?.paid && b.prepayment.amount > 0 && !b.deletedAt)
        .map((b) => [
          b.id,
          {
            ...EMPTY_BOOKING_EXTRAS,
            paidAmount: b.prepayment!.amount,
            payments: [{ id: newId("pay"), method: "cash" as const, amount: b.prepayment!.amount, label: "prepayment", at: b.createdAt }],
          },
        ]),
    );

    return {
      prefs: {
        zoomMin: 15,
        // Owner 27.09.2026: мокап (A2-wide.png) не рисует отменённые записи в сетке дня — по умолчанию они
        // скрыты фильтром воронки (F-01-014, JournalToolbar «Статус»), но запись никуда не пропадает: список
        // записей (RecordsScreen) и история клиента читают bookings напрямую, этот фильтр их не касается.
        // Хочет посмотреть отменённые прямо в сетке — включает их обратно тем же переключателем в «⋯».
        hiddenStatuses: ["cancelled_by_client", "cancelled_by_master"],
        staffMarkupMin: {},
        breakOverrideMin: {},
        breakCombineMode: "longest",
        splitByResourceEnabled: false,
      },
      settings: { ...DEFAULT_JOURNAL_SETTINGS },
      bookingCategories: SYSTEM_CATEGORIES,
      customFieldDefs: CUSTOM_FIELD_DEFS,
      pinnedFields: {},
      clientCardPins: {},
      extras,
      goodsCatalog: GOODS_CATALOG,
      quickSales: [],
      clientSubscriptions,
      autoWriteoffServiceIds,
      drafts: {},
      // F-01-172: умолчание Altegio — «интервал более 15 минут» (VERIFY-findings C6)
      visitIntervalMin: 15,
      recurrenceTemplates: [],
      favorites: {},
      history: {},
      packageGroups: {},
      dataOpsLog: [],
      staffJournalRights: {},
      staffWindowRights: {},
      medicalVisits: {},
      medicalCards: {},
      treatmentPlans: {},
      clientNoteOverrides: {},
      clientTagOverrides: {},
      waitlistPanelOpen: {},
      ledgerEntries,
      lacquerShades: LACQUER_SHADES,
      staffSets: {},
      dayLayouts: {},
      slotOffers: [],
      requestReminders: [],
    };
  },
});

/**
 * Палитра оттенков лака салона (F-00-094) — демо-данные: цвет здесь данные, а не токен темы (tokens-ok).
 * Запись услуги с выбором оттенка (Service.shadeChoice) получает один из них — см. listBookingLacquers.
 */
const LACQUER_SHADES: BookingLacquer[] = [
  { name: 'Nude 012', hex: '#e9c6bd' }, // tokens-ok
  { name: 'Cherry 207', hex: '#9b1b30' }, // tokens-ok
  { name: 'Rose milk', hex: '#e3a9c1' }, // tokens-ok
  { name: 'Navy 402', hex: '#1f3a5f' }, // tokens-ok
  { name: 'Sage 118', hex: '#8fb9a8' }, // tokens-ok
  { name: 'Emerald 305', hex: '#2e7d6b' }, // tokens-ok
  { name: 'Latte 051', hex: '#cdb49a' }, // tokens-ok
  { name: 'Lilac 233', hex: '#9b86d1' }, // tokens-ok
  { name: 'Coral 144', hex: '#e8836b' }, // tokens-ok
  { name: 'Plum 390', hex: '#6b2d5c' }, // tokens-ok
];
