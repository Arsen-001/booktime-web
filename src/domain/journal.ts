/**
 * Типы раздела «journal». Файл принадлежит разделу — пишите сюда свои сущности.
 * Ссылайтесь на сущности ядра по id (import type { Id } from '@/domain/core').
 */
import type {
  Id,
  ISODate,
  ISODateTime,
  Minutes,
  Money,
  TimeHM,
} from "@/domain/core";

/** Шаг сетки журнала, минут (F-01-015) */
export type JournalZoomMin = 5 | 10 | 15;

/** Группировка колонок дня (F-01-012) */
export type JournalGroupBy = "staff" | "resource";

/**
 * Разметка сетки у сотрудника (F-01-021) — доп. границы интервалов поверх шага сетки.
 * Место по ТЗ — карточка сотрудника (staff area); пока просьба не выполнена, настраивается здесь —
 * см. qa/requests/journal.md.
 */
export type StaffMarkupMin = 15 | 30 | 60 | 90 | 120;

/**
 * «Мои наборы» мастеров в журнале (⭐ наше, 29.09.2026): сотрудник сохраняет, кого показывать («Утренняя смена»),
 * и включает набор одним нажатием. Личное — у каждого сотрудника свои, на любом устройстве.
 */
export interface StaffSet {
  id: Id;
  name: string;
  staffIds: Id[];
}

/**
 * Вид дня в журнале (⭐ наше, 29.09.2026): «Колонки» — классическая сетка, как у Altegio; «Обзор» — все мастера
 * узкими колонками, весь день на одном экране; «Лента» — мастера строками, время вбок (15–20 мастеров без прокрутки
 * вбок); «Список» — все записи дня по времени. Личный выбор сотрудника.
 */
export type DayLayout = "columns" | "overview" | "timeline" | "list";

export interface JournalPrefs {
  /** Шаг сетки журнала, минут — общий на локацию (F-01-015) */
  zoomMin: JournalZoomMin;
  /** Статусы, скрытые фильтром воронки (F-01-014) — только индивидуальные записи */
  hiddenStatuses: string[];
  /** Разметка сетки по сотрудникам (F-01-021), id сотрудника → минуты, 0 = «не выбрано» */
  staffMarkupMin: Record<Id, StaffMarkupMin | 0>;
  /**
   * Правка технического перерыва под записью (F-01-032), id записи → минуты; 0 = перерыв удалён
   * (клик по перерыву → «Изменить»/«Удалить»). Без записи в карте — длительность по умолчанию
   * (buffer-after услуги).
   */
  breakOverrideMin: Record<Id, number>;
  /**
   * F-01-133: как считать общий технический перерыв визита из нескольких услуг с разными перерывами.
   * 'longest' (по умолчанию) — самый длинный из перерывов услуг визита; 'sum' — сумма всех, не больше
   * 60 минут. Место по ТЗ — настройка журнала (F-01-175, экран `/biz/journal/settings` — пачка b05,
   * ещё не построен); до тех пор переключатель временно живёт в шапке журнала.
   */
  breakCombineMode: "longest" | "sum";
  /**
   * F-01-132: при нескольких услугах с разными ресурсами — делить визит на отдельную запись на
   * каждую услугу, чтобы ресурс был занят только на время своей услуги (иначе все ресурсы визита
   * заняты на всё время визита целиком). Настройка журнала (F-01-174); экран `/biz/journal/settings`
   * ещё не построен (пачка b05) — переключатель временно в шапке журнала, как breakCombineMode выше.
   */
  splitByResourceEnabled: boolean;
}

// ─────────────────────────── Окно записи (пачка b02) ───────────────────────────

/**
 * Тип записи (справка F-01-167 «Тип записи», настройка вне этой пачки — экран настроек журнала
 * ещё не построен, см. qa/requests/journal.md). Пока читаем по функциям сферы: у сфер с группами
 * (фитнес, стоматология…) — «Смешанная» (F-01-025 предлагает «Запись/Событие»), у остальных —
 * «Индивидуальная» (выбора нет). Решение зафиксировано как assumed в отчёте.
 */
export type BookingKind = "individual" | "mixed";

/** Категория записи (F-01-051): 4 системные (нельзя менять/удалить) + свои */
export interface BookingCategoryDef {
  id: Id;
  /** Системная — подпись через словарь ('journal.category.<labelKey>'); своя — введённое имя */
  labelKey?:
    | "fullOnlinePayment"
    | "partialOnlinePayment"
    | "staffImportant"
    | "staffNotImportant";
  name?: string;
  colorIndex: number;
  system: boolean;
}

/** Тип своего дополнительного поля записи (F-01-053) */
export type CustomFieldType =
  "text" | "number" | "select" | "date" | "datetime";

export interface CustomFieldDef {
  id: Id;
  key: string;
  label: string;
  type: CustomFieldType;
  /** Значения через запятую — только для типа 'select' */
  options?: string[];
  /** «Всегда показывать в окне редактирования записи» → поле сразу в левой зоне, а не только в «Расширенных полях» */
  alwaysShow: boolean;
  requiredOnCreate: boolean;
  requiredOnArrived: boolean;
  editableByUser: boolean;
}

export type CustomFieldValue = string | number | null;

/**
 * Товар / абонемент / сертификат (F-01-060, F-01-211). Каталог склада (раздел «stock») и типов
 * лояльности (раздел «loyalty») ещё не построены (domain/stock.ts, domain/loyalty.ts пустые) —
 * временный демо-каталог в своём срезе, см. qa/requests/journal.md.
 */
export type GoodsKind = "product" | "subscription" | "certificate";

export interface GoodsCatalogItem {
  id: Id;
  name: string;
  kind: GoodsKind;
  price: Money;
  /** Остаток на демо-складе, шт (для абонементов/сертификатов не показываем) */
  stock: number;
  /** У этого типа абонемента/сертификата код обязателен при продаже */
  requiresCode: boolean;
  /**
   * F-01-080: у этого типа абонемента разрешено автосписание посещений (только kind='subscription').
   * Место по ТЗ — «тип абонемента» в разделе «Лояльность» (ещё не построен) — временно здесь.
   */
  autoWriteoffAllowed?: boolean;
}

/**
 * F-01-010: продажа товара/абонемента/сертификата без записи на день, прямо из «Продать ▾» журнала.
 * Настоящая продажа (касса, склад) принадлежит разделам «Склад»/«Финансы»/«Лояльность» (ещё не
 * построены) — временный демо-журнал продаж в своём срезе, см. qa/requests/journal.md.
 */
export interface QuickSaleRecord {
  id: Id;
  itemId: Id;
  itemName: string;
  kind: GoodsKind;
  qty: number;
  totalPrice: Money;
  paymentMethod: "cash" | "card";
  code?: string;
  createdAt: ISODateTime;
  /** F-04-219: продажа вне визита, привязанная к клиенту — идёт в его «Продано»/«Оплачено» и историю. */
  clientId?: Id;
  clientName?: string;
  cancelled?: boolean;
}

/**
 * Остаток посещений клиента по конкретному проданному абонементу (F-01-080). Сущность-хозяин —
 * раздел «Лояльность» (продажа абонемента, заморозка, возврат) — она ещё не построена
 * (`src/domain/loyalty.ts` пуст), временный демо-баланс в своём срезе, см. qa/requests/journal.md.
 */
export interface ClientSubscriptionBalance {
  id: Id;
  clientId: Id;
  /** GoodsCatalogItem.kind === 'subscription' */
  itemId: Id;
  remainingVisits: number;
  expiresAt: ISODate;
}

export type AutoWriteoffStatus = "written_off" | "not_written_off";

/** Итог автосписания визита с абонемента клиента (F-01-080) — хранится в BookingExtras, считается один раз. */
export interface AutoWriteoffInfo {
  status: AutoWriteoffStatus;
  /** Сумма к доплате — 0, если списано полностью */
  amountDue: Money;
  /** С какого баланса списано — нужно, чтобы вернуть посещение при отмене/удалении (F-01-120) */
  subscriptionId?: Id;
}

/** Строка товара/абонемента/сертификата в визите (F-01-060, F-01-211) */
export interface BookingGoodsLine {
  id: Id;
  itemId: Id;
  qty: number;
  price: Money;
  discountPct: number;
  sellerId: Id;
  code?: string;
  /** ⭐ Допродажа при записи: товар взят как сопутствующий к этой услуге (клиент онлайн или подсказка в окне) */
  upsellOf?: Id;
}

/** F-01-059: ассистент услуги — сотрудник и его доля вознаграждения, % */
export interface ServiceAssistant {
  staffId: Id;
  sharePct: number;
}

/** Скидка по строке услуги (F-01-058) — процент хранится отдельно, «Итог» пишется в Booking.services[i].price */
export interface BookingServiceLineExtra {
  discountPct: number;
  /** F-01-059: ассистенты этой строки услуги; нет поля/пусто — без ассистентов */
  assistants?: ServiceAssistant[];
}

/** Кто и как удалил запись (F-01-119) — Booking.deletedAt уже есть в ядре, автора/канал храним у себя */
export interface BookingDeletion {
  byName: string;
  /** Отменено клиентом (онлайн/по ссылке) — подпись «Удалено клиентом» вместо имени сотрудника */
  byClient: boolean;
  at: ISODateTime;
  /**
   * F-01-120: снимок того, что удаление обнулило (деньги, расходники, посещение абонемента) — чтобы
   * «Отменить» в течение 5 секунд (F-00-061) вернуло запись ровно в то состояние, в котором она была.
   */
  restore?: {
    paidAmount: Money;
    consumablesDeducted?: boolean;
    autoWriteoff?: AutoWriteoffInfo;
  };
}

/** Всё, что окно записи хранит помимо самой сущности Booking ядра (F-01-050…053, F-01-060, F-01-061, F-01-211) */
export interface BookingExtras {
  categoryIds: Id[];
  colorIndex?: number;
  customFieldValues: Record<string, CustomFieldValue>;
  goodsLines: BookingGoodsLine[];
  serviceLineExtras: BookingServiceLineExtra[];
  /** Сколько уже отмечено оплаченным демо-кнопкой «Оплатить» (реальные платежи — раздел finance, F-01-061 частично) */
  paidAmount: Money;
  /** Автор и время мягкого удаления (F-01-119) — записывается вместе с deleteBooking() */
  deletion?: BookingDeletion;
  /** F-01-080: результат автосписания с абонемента, посчитан один раз в момент начала записи */
  autoWriteoff?: AutoWriteoffInfo;
  /**
   * F-01-081: расходники по техкарте списаны при статусе «Клиент пришёл». Раньше — демо-флаг (раздел
   * «Склад» ещё не был построен); теперь настоящее списание ведёт `@/api/stock` (`ensureAutoWriteoffs`,
   * F-01-148), это поле осталось только как признак для истории/бейджа этой конкретной записи.
   */
  consumablesDeducted?: boolean;
  /**
   * F-01-149: техкарта, выбранная для конкретного визита (по индексу строки услуги) — по умолчанию
   * действует техкарта пары «услуга × мастер» из склада; здесь только явная замена на этот визит,
   * своего поля для этого ни в ядре, ни в `stock` нет.
   */
  techCardOverrides?: Record<number, Id>;
  /** F-01-113/134…136: id PackageGroup, если запись — часть пакета (комплекса) */
  packageGroupId?: Id;
  /** F-01-127: «Записывает другого посетителя» — само имя хранится в Booking.visitorName (ядро) */
  /**
   * F-01-138…143: строки оплаты визита — детализация того, что раньше был единственный `paidAmount`.
   * `paidAmount` остаётся суммой всех строк (или простым «Оплатить всё», когда строк ещё нет —
   * обратная совместимость со старыми вызовами `instantPayBooking`/строкой b04 «Клиент пришёл + сумма»).
   */
  payments?: JournalPaymentLine[];
  /**
   * F-01-116/F-01-124: решение по ручной предоплате при позднем переносе/неявке — что с
   * предоплатой при поздней отмене остаётся ❓ у Altegio (00-our-decisions.md F-00-098), поэтому
   * решение записано у нас в qa/questions/journal.md: держим/прощаем целиком (без кошелька, F-00-028,
   * «вернуть клиенту» — демо-жест, деньгами реально не двигает, как и остальная ручная предоплата).
   */
  prepaymentDecision?: PrepaymentDecision;
}

/** Решение администратора по внесённой предоплате при позднем переносе или неявке (F-01-116, F-01-124) */
export interface PrepaymentDecision {
  /** true — удержать (штраф, доход бизнеса), false — простить (вернуть клиенту) */
  kept: boolean;
  reason: "late_reschedule" | "no_show";
  decidedBy: string;
  decidedAt: ISODateTime;
  /** Решение принято автоматически (диалог закрыт без выбора) — по умолчанию штраф применяется (F-01-124) */
  auto?: boolean;
}

export const EMPTY_BOOKING_EXTRAS: BookingExtras = {
  categoryIds: [],
  customFieldValues: {},
  goodsLines: [],
  serviceLineExtras: [],
  paidAmount: 0,
};

// ─────────────────────────── Оплата визита (F-01-138…146, F-01-151, F-01-084) ───────────────────────────

/**
 * Способ оплаты одной строки окна «Оплата визита» (F-01-138 быстрая, F-01-139 раздельная).
 * `membership`/`certificate`/`card_bonus` списывают чужую (loyalty) сущность по id в `refId` —
 * саму сущность списывает `@/api/loyalty` (adjustMembership/adjustCertificate/adjustCardBalance),
 * журнал только вызывает и хранит ссылку. `personal_account` — демо: строка появляется в визите, но
 * баланс счёта не двигается (в `@/api/loyalty` нет мутации списания счёта) — см. qa/requests/journal.md.
 */
export type JournalPaymentMethod =
  | "cash"
  | "card"
  | "membership"
  | "certificate"
  | "card_bonus"
  | "promotion"
  | "personal_account";

export interface JournalPaymentLine {
  id: Id;
  method: JournalPaymentMethod;
  amount: Money;
  /** Готовая подпись строки — «Наличные — Основная касса», «Абонемент №…», «Скидка по акции …» */
  label: string;
  cashRegister?: string;
  /** id абонемента/сертификата/карты/счёта лояльности, если способ им платит (F-01-140) */
  refId?: Id;
  at: ISODateTime;
}

/** F-01-151: 13 статей платежа кабинета (⚠️ в справке их 12 — расхождение из ТЗ, оставляем как в кабинете) */
export type JournalLedgerCategory =
  | "materials"
  | "goods_purchase"
  | "salary"
  | "taxes"
  | "services"
  | "membership_sale"
  | "other_income"
  | "other_expense"
  | "topup"
  | "acquiring_fee"
  | "certificate_sale"
  | "penalty_writeoff";

export const JOURNAL_LEDGER_INCOME_CATEGORIES: JournalLedgerCategory[] = [
  "services",
  "membership_sale",
  "certificate_sale",
  "other_income",
  "topup",
  "penalty_writeoff",
];

export type JournalLedgerCounterpartyType = "contractor" | "client" | "staff";

/**
 * F-01-151/F-01-084: платёж, созданный из журнала минуя визит («Новый платёж» в левой панели —
 * закупки, зарплата, штраф). Настоящая касса и финансовые операции — раздел «Финансы» (не построен),
 * временный демо-леджер в своём срезе, см. qa/requests/journal.md.
 */
export interface JournalLedgerEntry {
  id: Id;
  locationId: Id;
  at: ISODateTime;
  category: JournalLedgerCategory;
  cashRegister: string;
  counterpartyType: JournalLedgerCounterpartyType;
  counterpartyName: string;
  amount: Money;
  comment?: string;
  canceled?: boolean;
  createdByStaffId?: Id;
}

// ─────────────────────────── Повторение записи (пачка b03, F-01-100…107) ───────────────────────────

export type RecurrenceFrequency =
  | "daily"
  | "weekdays"
  | "mon_wed_fri"
  | "tue_thu"
  | "weekly"
  | "monthly"
  | "yearly";

/**
 * Правило повтора. ⭐ По нашему решению интервал однозначен («каждые N дней/недель», N ≥ 1) —
 * без ловушки Altegio, где «Недель: 1» на самом деле значит «через неделю» (F-01-102).
 */
export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  /** Только для 'daily' и 'weekly' — «каждые N дней/недель» (по умолчанию 1 = без пропусков) */
  everyN: number;
  /** Только для 'weekly' — дни недели 0=Пн…6=Вс */
  weekdays: number[];
  time: TimeHM;
  startDate: ISODate;
  endMode: "count" | "date";
  count: number;
  endDate?: ISODate;
  /** «С клиентом» / «Без клиента» (F-01-105) */
  withClient: boolean;
}

export interface RecurrenceTemplate {
  id: Id;
  name: string;
  rule: RecurrenceRule;
}

/** Черновик окна записи (F-01-040) — снимок полей формы, переживает закрытие окна и перезагрузку страницы */
export type WindowDraftSnapshot = Record<string, unknown>;

// ─────────────────────────── b04: избранное, история, посетитель, пакеты ───────────────────────────

/**
 * F-01-005: закреплённый раздел кабинета. Звёздочка живёт только у заголовка журнала (`PageHeader`
 * не умеет её сама — foundation, см. qa/requests/journal.md); список хранится и показывается здесь,
 * готов принять записи от других разделов, когда просьба будет выполнена.
 */
export interface FavoriteSection {
  id: string;
  labelKey: string;
  href: string;
}

/** Строка истории изменений записи (F-01-096) */
export interface BookingHistoryEntry {
  id: Id;
  bookingId: Id;
  authorName: string;
  action: "created" | "updated" | "statusChanged" | "deleted" | "restored";
  /** Готовая человеко-читаемая строка «что стало» — считается в момент записи истории */
  summary: string;
  at: ISODateTime;
}

/**
 * F-01-129: история визитов посетителя — считается по записям того же клиента с тем же именем
 * посетителя (посетитель — не отдельная сущность, F-01-127); здесь только последний известный
 * снимок «сколько визитов», сама история — вычисляется на лету в api/journal.ts из listBookings.
 */
export interface VisitorNote {
  clientId: Id;
  visitorName: string;
  lastVisitAt?: ISODateTime;
}

/**
 * F-01-134…136: пакет (комплекс) — связанные записи у нескольких мастеров на одно посещение.
 * Готового «комплекса» как настройки услуги пока нет (раздел «Услуги» его не построил) — пакет
 * собирается прямо в окне записи из отдельных услуг; расчёт слотов — computePackageSlots() раздела
 * schedule (F-02-069), общая занятость мастеров пакета считается там же.
 */
export type PackageOrderMode = "parallel" | "sequential_one";

export interface PackageGroup {
  id: Id;
  businessId: Id;
  order: PackageOrderMode;
  /** id всех записей пакета — на них ставится PackageGroup.id в BookingExtras.packageGroupId */
  bookingIds: Id[];
  createdAt: ISODateTime;
}

/** Журнал импорта/выгрузки «Записей» (F-01-182, F-01-183) — «каждый видит только свои» */
export interface DataOpsLogEntry {
  id: Id;
  kind: "import" | "export";
  count: number;
  authorStaffId: Id;
  at: ISODateTime;
}

/**
 * F-01-189: «Текущий приём» — заключение врача по конкретному визиту (ключ — id записи).
 * Только в медицинских сферах (useSphere().has('medicalRecords'), F-00-145).
 */
export interface MedicalVisitNote {
  bookingId: Id;
  complaints: string;
  diseaseHistory: string;
  lifeHistory: string;
  chronicConditions: string;
  epidemiological: string;
  allergy: string;
  examination: string;
  procedures: string;
  diagnosis: string;
  prescriptions: string;
  recommendations: string;
  comment: string;
  authorName: string;
  updatedAt: ISODateTime;
}

/**
 * F-01-190: «Медкарта» — карта пациента (ключ — id клиента), поля адаптированы к Армении (без
 * ОМС/СНИЛС — российских документов; вместо них — местный полис/соц. номер, см. отчёт b-g1-2).
 */
export interface MedicalCard {
  clientId: Id;
  cardNumber: string;
  filledAt: ISODate;
  address: string;
  locality: string;
  documentNo: string;
  insurancePolicy: string;
  socialNumber: string;
  maritalStatus: string;
  education: string;
  employment: string;
  workplace: string;
  insuranceCompany: string;
  disability: string;
  bloodType: string;
  allergies: string;
  updatedAt: ISODateTime;
}

/** F-01-191: одна услуга плана лечения — минимальная цена на момент добавления (обновляется) */
export interface TreatmentPlanItem {
  id: Id;
  serviceId: Id;
  priceMin: number;
}

/** F-01-191: «План лечения» — список услуг по порядку для пациента; у клиента их может быть несколько */
export interface TreatmentPlan {
  id: Id;
  clientId: Id;
  title: string;
  items: TreatmentPlanItem[];
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface JournalWindowState {
  bookingCategories: BookingCategoryDef[];
  customFieldDefs: CustomFieldDef[];
  /** Закреплённые поля (F-01-048), ключ — id сотрудника (у каждого пользователя свои) */
  pinnedFields: Record<Id, string[]>;
  /**
   * F-01-069: звёздочка в «Еще» правой зоны окна записи закрепляет раздел карточки клиента плиткой
   * под именем — ключ тот же, что у pinnedFields (id сотрудника, у каждого свои). Профиль клиента и
   * История визитов — плитки всегда (не в этом списке, не снимаются).
   */
  clientCardPins: Record<Id, string[]>;
  /** Доп. данные визита по id записи (F-01-050…053, F-01-060, F-01-061, F-01-211) */
  extras: Record<Id, BookingExtras>;
  goodsCatalog: GoodsCatalogItem[];
  /** F-01-010: журнал продаж без записи («Продать ▾»), новые — в начале */
  quickSales: QuickSaleRecord[];
  /** Демо-балансы абонементов клиентов (F-01-080) */
  clientSubscriptions: ClientSubscriptionBalance[];
  /**
   * Услуги, у которых включено автосписание (F-01-080). Место по ТЗ — «Услуги → Расширенные
   * настройки» (раздел «Услуги») — временно здесь, см. qa/requests/journal.md.
   */
  autoWriteoffServiceIds: Id[];
  /** Черновики окна: ключ — id записи или 'new:<staff>:<date>:<time>' (F-01-040) */
  drafts: Record<string, WindowDraftSnapshot>;
  /** Интервал склейки записей клиента в визит, минут (F-01-041, настройка F-01-172 вне этой пачки) */
  visitIntervalMin: Minutes;
  /** Сохранённые шаблоны повтора (F-01-101) */
  recurrenceTemplates: RecurrenceTemplate[];
  /** Избранные разделы, ключ — id пользователя (сотрудника), F-01-005 */
  favorites: Record<Id, FavoriteSection[]>;
  /** История изменений по записям, F-01-096 */
  history: Record<Id, BookingHistoryEntry[]>;
  /** Пакеты (комплексы) записей, F-01-113/134…136 */
  packageGroups: Record<Id, PackageGroup>;
  /** Журнал импорта/выгрузки «Записей», F-01-182/183 */
  dataOpsLog: DataOpsLogEntry[];
  /** F-01-178: override прав блока «Журнал записей» по сотруднику; нет записи — умолчание по роли */
  staffJournalRights: Record<Id, Partial<JournalBlockRights>>;
  /** F-01-179: override прав блока «Окно записи» по сотруднику; нет записи — умолчание по роли */
  staffWindowRights: Record<Id, Partial<WindowRights>>;
  /** F-01-189: «Текущий приём» по id записи (медицинские сферы) */
  medicalVisits: Record<Id, MedicalVisitNote>;
  /** F-01-190: «Медкарта» по id клиента (медицинские сферы) */
  medicalCards: Record<Id, MedicalCard>;
  /** F-01-191: «Планы лечения» клиента, ключ — id клиента, значение — список планов */
  treatmentPlans: Record<Id, TreatmentPlan[]>;
  /**
   * F-01-070: примечание о клиенте, показанное в окне записи. Пока в разделе «Клиенты» нет
   * функции правки Client.note/tags (см. qa/requests/journal.md), накладка поверх ядра —
   * ключ id клиента; пусто/нет записи → показываем Client.note/tags из ядра как есть.
   */
  clientNoteOverrides: Record<Id, string>;
  clientTagOverrides: Record<Id, string[]>;
  /* F-01-156…162: заявки листа ожидания — больше не здесь: один лист бизнеса в срезе resources (владелец, 30.09.2026),
     панель журнала читает его через api/resources.ts; старое поле waitlistEntries переносится туда само */
  /** F-01-156: «панель остаётся открытой при работе и помнит открыта/закрыта после перезагрузки» — ключ id сотрудника */
  waitlistPanelOpen: Record<Id, boolean>;
  /** F-01-151/F-01-084: демо-леджер «Новый платёж» (не связан с визитом) */
  ledgerEntries: JournalLedgerEntry[];
}

// ─────────────────────────── Настройки «Цифровой журнал» (пачка b05, F-01-155, F-01-165…180) ───────────────────────────

/** F-01-167: тип записи, решает поведение клика по пустой ячейке. 'auto' — по функциям сферы (F-00-145), как было до этой настройки */
export type RecordTypeSetting = "auto" | "individual" | "mixed" | "group";

/** F-01-171: первая строка в блоке записи */
export type FirstLineMode = "service" | "clientName" | "phone";

/** F-01-172: правило склейки записей клиента в визит — конкретное число минут либо особые режимы.
 * Хранится через JournalWindowState.visitIntervalMin: 0 = «Каждая запись — отдельный визит»,
 * 1440 = «В течение дня все записи — один визит», иначе — число минут разрыва. */
export const VISIT_GAP_OPTIONS = [5, 10, 15, 20, 30, 45, 60, 120, 180, 360] as const;
export type VisitGapMinutes = (typeof VISIT_GAP_OPTIONS)[number];

export type VisitGroupingMode =
  | { kind: "perBooking" }
  | { kind: "allDay" }
  | { kind: "gapMinutes"; minutes: VisitGapMinutes };

/** F-01-178: ограничение доступа к истории расписания и записей */
export type HistoryWindowLimit =
  | "none"
  | "1d"
  | "3d"
  | "7d"
  | "1m"
  | "3m"
  | "6m"
  | "unlimited";

/** F-01-170: вид журнала по умолчанию при входе */
export type DefaultJournalView = "staff" | "resource";

/** F-01-221: формат часов в шапке журнала, окне записи и списках — '24' по умолчанию (рынок — Армения) */
export type JournalHourFormat = "24" | "12";

export interface JournalSettings {
  /** F-01-167 */
  recordType: RecordTypeSetting;
  /** F-01-170 */
  defaultView: DefaultJournalView;
  /** F-01-170: 'all' — все должности; иначе id должности. Для 'resource' — id ресурса по умолчанию */
  defaultPositionId: string;
  defaultResourceId: string;
  /** F-01-169 */
  showOccupiedResourcesForStaff: boolean;
  /** F-01-171 */
  firstLineMode: FirstLineMode;
  /** F-01-155 */
  waitlistEnabled: boolean;
  /** F-01-173 */
  allowOverlapOverNoShow: boolean;
  /** F-01-175: общий перерыв после каждой записи, минут; 0 = «Без перерыва» */
  defaultBreakAfterMin: number;
  /** F-01-176: «Показывать поле Отчество» — «Фамилия» переиспользует clients.getShowFullNameFields() (F-04-046) */
  patronymicEnabled: boolean;
  /** F-01-165/166: демо-имитация подключённой интеграции чата — без неё блок скрыт, как в Altegio */
  chatIntegrationConnected: boolean;
  /** F-01-165 */
  chatPopupEnabled: boolean;
  /**
   * F-01-059 «Оплачивать помощь в оказании услуги»: пока в разделе «Зарплата» нет своей настройки
   * (не наши пути), временный дом здесь — просьба переехать записана в qa/requests/journal.md.
   * Выключено — кнопка «+ Добавить ассистента» серая с подсказкой.
   */
  assistantPayEnabled: boolean;
  /** F-01-073: «Отображать в окне записи поиск по лояльности» — по умолчанию выключено */
  loyaltySearchEnabled: boolean;
  /**
   * F-01-221 «Формат даты и времени»: настоящее место по ТЗ — Администрирование → Настройки →
   * «Системные» (`/biz/settings/system`, раздел settings, ещё не построен) — просьба записана в
   * qa/requests/journal.md. До переезда действует на журнал, окно записи и списки записей здесь;
   * влияет на `useFormat({ hourCycle })` во всех наших экранах.
   */
  hourFormat: JournalHourFormat;
  /**
   * F-01-121: сколько дней после мягкого удаления запись ещё можно вернуть кнопкой «Восстановить»
   * (журнал «Удалённые» и отчёт «Изменения данных») — решение владельца (ANSWERS.md), срок настраиваемый,
   * по умолчанию 7. Позже этого срока доступно только «Создать заново» с подставленными данными.
   */
  deletionRestoreWindowDays: number;
  /**
   * F-01-221 «Город» (пояс локации, город регистрации бизнеса) — своего справочника городов не
   * заводим (нет других сфер использования), храним подпись как есть; по умолчанию Ереван
   * (⭐ рынок — Армения, F-00-002). Настоящее место — тот же экран `/biz/settings/system`.
   */
  timeZoneCity: string;
}

export const DEFAULT_JOURNAL_SETTINGS: JournalSettings = {
  recordType: "auto",
  defaultView: "staff",
  defaultPositionId: "all",
  defaultResourceId: "all",
  showOccupiedResourcesForStaff: false,
  // Журнал A2 (DESIGN.md, 26.09.2026): под крупным временем карточки — имя клиента, услуга строкой ниже
  firstLineMode: "clientName",
  waitlistEnabled: true,
  allowOverlapOverNoShow: true,
  defaultBreakAfterMin: 0,
  patronymicEnabled: false,
  chatIntegrationConnected: false,
  chatPopupEnabled: true,
  assistantPayEnabled: false,
  loyaltySearchEnabled: false,
  hourFormat: "24",
  timeZoneCity: "Ереван",
  deletionRestoreWindowDays: 7,
};

// ─────────────────────────── Права блоков «Журнал записей» и «Окно записи» (F-01-178, F-01-179) ───────────────────────────

/**
 * 8 прав блока «Журнал записей» (F-01-178). Тоньше грубых journal.view/edit/create/reschedule/others
 * фундамента (src/config/permissions.ts) — просьба записана в qa/requests/journal.md; пока — свой слой,
 * хранится по staffId (владелец/сеть/индивидуал видят всё всегда, см. lib/rights.ts).
 */
export interface JournalBlockRights {
  /** «Просматривать расписание и записи должностей»: true — все, false — только своя должность */
  viewAllPositions: boolean;
  /** «Просматривать расписание и записи сотрудников»: 'all' | 'own' (упрощение — без «выбранных») */
  viewStaffScope: "all" | "own";
  historyLimit: HistoryWindowLimit;
  /** «Изменять график работы и время для записи сотрудника в журнале» */
  editStaffSchedule: boolean;
  /** «Показывать номера телефонов» — сужает clients.phones, не расширяет его */
  showPhones: boolean;
  /** «Перенос записи» — перетаскивание и растягивание в СЕТКЕ (не в окне, см. WindowRights.changeStaffAndTime) */
  reschedule: boolean;
  /** «Показывать статистику» (сводка дня) */
  showStatistics: boolean;
  // Лист ожидания — одно право раздела resources «Видит лист ожидания» (viewWaitlist), решение владельца 01.10.2026
}

export function allJournalBlockRights(): JournalBlockRights {
  return {
    viewAllPositions: true,
    viewStaffScope: "all",
    historyLimit: "unlimited",
    editStaffSchedule: true,
    showPhones: true,
    reschedule: true,
    showStatistics: true,
  };
}

export function defaultAdminJournalRights(): JournalBlockRights {
  return { ...allJournalBlockRights(), historyLimit: "6m" };
}

export function defaultMasterJournalRights(): JournalBlockRights {
  return {
    viewAllPositions: true,
    viewStaffScope: "own",
    historyLimit: "7d",
    editStaffSchedule: false,
    showPhones: true,
    reschedule: true,
    showStatistics: false,
  };
}

/**
 * 31 право блока «Окно записи» (F-01-179). Группы из ТЗ: ассистенты (2), клиент (5), поля (2),
 * записи (11), удаление (3), товары (5), оплата (2), расходники (1).
 */
export interface WindowRights {
  manageAssistants: boolean;
  editAssistantShare: boolean;
  clientAccess: boolean;
  createClientInWindow: boolean;
  clientDropdown: boolean;
  showPhones: boolean;
  clientAccessNetwork: boolean;
  viewCustomFields: boolean;
  editCustomFields: boolean;
  createBookings: boolean;
  editBookings: boolean;
  editArrivedStatus: boolean;
  editArrivedPaid: boolean;
  editConfirmedStatus: boolean;
  editServicePrice: boolean;
  editServiceDiscount: boolean;
  changeStaffAndTime: boolean;
  changeDuration: boolean;
  editComment: boolean;
  editServiceComposition: boolean;
  deleteBookings: boolean;
  deleteArrivedBookings: boolean;
  deletePaidBookings: boolean;
  sellGoods: boolean;
  createGoodsTx: boolean;
  editGoodsTx: boolean;
  editGoodsPrice: boolean;
  editGoodsDiscount: boolean;
  takePayment: boolean;
  takePaymentFromClientAccount: boolean;
  editConsumables: boolean;
}

export function allWindowRights(): WindowRights {
  return {
    manageAssistants: true,
    editAssistantShare: true,
    clientAccess: true,
    createClientInWindow: true,
    clientDropdown: true,
    showPhones: true,
    clientAccessNetwork: true,
    viewCustomFields: true,
    editCustomFields: true,
    createBookings: true,
    editBookings: true,
    editArrivedStatus: true,
    editArrivedPaid: true,
    editConfirmedStatus: true,
    editServicePrice: true,
    editServiceDiscount: true,
    changeStaffAndTime: true,
    changeDuration: true,
    editComment: true,
    editServiceComposition: true,
    deleteBookings: true,
    deleteArrivedBookings: true,
    deletePaidBookings: true,
    sellGoods: true,
    createGoodsTx: true,
    editGoodsTx: true,
    editGoodsPrice: true,
    editGoodsDiscount: true,
    takePayment: true,
    takePaymentFromClientAccount: true,
    editConsumables: true,
  };
}

export function defaultAdminWindowRights(): WindowRights {
  return {
    ...allWindowRights(),
    manageAssistants: false,
    editAssistantShare: false,
    clientAccessNetwork: false,
    editArrivedPaid: false,
    deleteArrivedBookings: false,
    deletePaidBookings: false,
  };
}

export function defaultMasterWindowRights(): WindowRights {
  return {
    manageAssistants: false,
    editAssistantShare: false,
    clientAccess: true,
    createClientInWindow: true,
    clientDropdown: true,
    showPhones: true,
    clientAccessNetwork: false,
    viewCustomFields: true,
    editCustomFields: false,
    createBookings: true,
    editBookings: true,
    editArrivedStatus: true,
    editArrivedPaid: false,
    editConfirmedStatus: true,
    editServicePrice: false,
    editServiceDiscount: false,
    changeStaffAndTime: true,
    changeDuration: true,
    editComment: true,
    editServiceComposition: true,
    deleteBookings: true,
    deleteArrivedBookings: false,
    deletePaidBookings: false,
    sellGoods: true,
    createGoodsTx: true,
    editGoodsTx: false,
    editGoodsPrice: false,
    editGoodsDiscount: false,
    takePayment: true,
    takePaymentFromClientAccount: false,
    editConsumables: true,
  };
}

// ─────────────────────────── Оттенок лака в карточке записи (DESIGN.md → «C · Тон», F-00-094) ───────────────────────────

/**
 * Оттенок, выбранный под запись (F-00-094: «выбранный оттенок виден мастеру в записи»). Цвет — ДАННЫЕ (hex оттенка),
 * не токен темы: из него карточка журнала строит свой тон (src/ui/tone.ts).
 */
export interface BookingLacquer {
  name: string;
  hex: string;
}

// ─────────────────────────── «Предложить окно» из «Найти окно», напоминание о заявке (⭐ 29.09.2026) ───────────────────────────

/** Кому предлагаем окно: один лист ожидания (с «Сообщить, когда освободится» из приложения и виджета), горящее окно подписчикам */
export type SlotOfferChannel = "waitlist" | "hot";

/** Одно предложение свободного окна — след в журнале: кому, сколько человек, когда (строки сообщений — в журнале уведомлений) */
export interface SlotOffer {
  id: Id;
  businessId: Id;
  staffId: Id;
  serviceId: Id;
  date: ISODate;
  time: TimeHM;
  channels: SlotOfferChannel[];
  /** Сколько человек получили предложение (без повторов по телефону) */
  recipients: number;
  /** Скидка горящего окна из «Продвижения» (F-00-103), если она задана и окно ушло горящим */
  hotDiscountPercent?: number;
  createdAt: ISODateTime;
}

/** Повторное напоминание мастеру о заявке без ответа (awaiting_confirmation) — одно на шаг N минут */
export interface RequestReminder {
  id: Id;
  businessId: Id;
  bookingId: Id;
  /** Номер напоминания по заявке: 1, 2, 3 — ключ идемпотентности вместе с bookingId */
  step: number;
  at: ISODateTime;
  /** Срок ответа на момент напоминания — в тексте «ответьте до HH:MM» */
  deadline: ISODateTime;
}
