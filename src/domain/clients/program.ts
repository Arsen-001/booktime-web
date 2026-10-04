/** Типы раздела «clients», часть 2: программа лояльности, импорт/выгрузка, категории, визиты, файлы, сводка. */
import type { BookingStatus, Id, ISODate, ISODateTime, Money } from '@/domain/core';
import type { ImportanceClass } from '@/domain/clients/types';

// ─────────────────────────── Программа лояльности локации (F-04-114…122, 158) ───────────────────────────
// Автоправила: скидка/класс важности/категории по тратам, визитам и статусам записи. Отдельно от
// сетевой лояльности (раздел 06) — это старый, ограниченный движок локации (F-04-114).

export type LoyaltyBasis = 'sold' | 'paid' | 'visits';
export const LOYALTY_BASES: LoyaltyBasis[] = ['sold', 'paid', 'visits'];

/** Ступень скидки: «Продано/Оплачено/Визитов от … → N %» (F-04-115) */
export interface DiscountTier {
  id: string;
  basis: LoyaltyBasis;
  from: number;
  percent: number;
}

/** Порог класса важности по одному из трёх оснований (F-04-117); пусто = основание не используется */
export interface ClassTierThresholds {
  minSold?: number;
  minPaid?: number;
  minVisits?: number;
}

export type ClassRules = Record<ImportanceClass, ClassTierThresholds>;

export function emptyClassRules(): ClassRules {
  return { bronze: {}, silver: {}, gold: {} };
}

/** Условие автоправила категории (F-04-118/119/158) */
export type CategoryTriggerKind = 'sold' | 'paid' | 'visits' | 'inactiveDays' | 'statusArrived' | 'statusNoShow';
export const CATEGORY_TRIGGER_KINDS: CategoryTriggerKind[] = ['sold', 'paid', 'visits', 'inactiveDays', 'statusArrived', 'statusNoShow'];
/** Основания с числовым порогом; statusArrived/statusNoShow — событие без порога */
export const CATEGORY_TRIGGERS_WITH_THRESHOLD: CategoryTriggerKind[] = ['sold', 'paid', 'visits', 'inactiveDays'];

export interface CategoryAutoRule {
  id: string;
  trigger: CategoryTriggerKind;
  threshold?: number;
  category: string;
}

export interface LoyaltySettings {
  /** «Отмена скидки»: не посещал более N дней → скидка 0 (F-04-116) */
  cancelDiscountAfterDays: number;
  /** «Отмена класса важности»: не посещал более N дней → класс снят (F-04-117) */
  cancelClassAfterDays: number;
  /** «Уведомлять за»: 0/null = «Не уведомлять», иначе 1–15 дней (F-04-120) — у нас пуш, не SMS */
  discountEndWarnDays: number | null;
}

export function defaultLoyaltySettings(): LoyaltySettings {
  return {
    cancelDiscountAfterDays: 360,
    cancelClassAfterDays: 360,
    discountEndWarnDays: null,
  };
}

export interface LoyaltyProgram {
  /** Правила выключены по умолчанию у новой локации (F-04-114) */
  enabled: boolean;
  discountTiers: DiscountTier[];
  classRules: ClassRules;
  addRules: CategoryAutoRule[];
  removeRules: CategoryAutoRule[];
  settings: LoyaltySettings;
}

export function emptyLoyaltyProgram(): LoyaltyProgram {
  return {
    enabled: false,
    discountTiers: [],
    classRules: emptyClassRules(),
    addRules: [],
    removeRules: [],
    settings: defaultLoyaltySettings(),
  };
}

/** Что именно вызвало пересчёт (F-04-121: три момента) */
export type LoyaltyRecalcTrigger = 'manual' | 'programSaved' | 'statusArrived' | 'statusNoShow';

export interface LoyaltyRecalcChange {
  clientId: Id;
  discountBefore: number;
  discountAfter: number;
  classBefore?: ImportanceClass;
  classAfter?: ImportanceClass;
  categoriesAdded: string[];
  categoriesRemoved: string[];
}

// ─────────────────────────── Импорт / выгрузка (F-04-126…130, 158→177) ───────────────────────────

// Типы и правила импорта (колонки, телефоны, даты, шаблоны Altegio/DIKIDI, пачки) — src/domain/clients/importRules.ts

export interface ImportRunSummary {
  id: string;
  /** Бизнес, чья база загружалась */
  businessId?: Id;
  at: ISODateTime;
  authorName: string;
  /** Способ загрузки — F-04-206 «Операции с данными» показывает его рядом с автором */
  method: 'paste' | 'file';
  totalRows: number;
  createdCount: number;
  updatedCount: number;
  rejectedCount: number;
  /** Пропущено (уже в базе и нечего дополнить, повтор номера в файле); старые записи — без поля: total − остальные */
  skippedCount?: number;
}

export interface ExportLogEntry {
  id: string;
  at: ISODateTime;
  authorName: string;
  count: number;
  method: 'download' | 'email';
}

// ─────────────────────────── Справочник категорий клиентов (F-04-109/110) ───────────────────────────

export interface ClientCategory {
  name: string;
  color: string;
  /** Сколько клиентов сейчас отмечено этой категорией (тегом) */
  count: number;
}

// ─────────────────────────── Черновые данные лояльности для F-04-035 ───────────────────────────
// Настоящие сертификаты/абонементы строит раздел loyalty (см. qa/requests/clients.md) — здесь
// только то, что нужно, чтобы 13 подфильтров «По продажам» реально фильтровали список.

export interface Certificate {
  id: Id;
  businessId: Id;
  clientId: Id;
  name: string;
  total: Money;
  balance: Money;
  soldAt: ISODate;
  expiresAt: ISODate;
  /** F-04-099: номер сертификата — по нему клиента находят в окне записи */
  code: string;
}

export interface Subscription {
  id: Id;
  businessId: Id;
  clientId: Id;
  name: string;
  status: 'active' | 'expired';
  frozen: boolean;
  soldAt: ISODate;
  expiresAt: ISODate;
  totalVisits: number;
  remainingVisits: number;
  /** F-04-099: номер абонемента — по нему клиента находят в окне записи */
  code: string;
}

export interface ProductPurchase {
  id: Id;
  businessId: Id;
  clientId: Id;
  productName: string;
  boughtAt: ISODate;
}

// ─────────────────────────── История визитов (F-04-075…077, 156, 167, 179, 226) ───────────────────────────

/** «Все записи» / «Неоплаченные записи» / «Счетом клиента в долг» (F-04-076) */
export type HistoryFilter = 'all' | 'unpaid' | 'debt';
export const HISTORY_FILTERS: HistoryFilter[] = ['all', 'unpaid', 'debt'];

export type VisitPaymentStatus = 'paid' | 'unpaid' | 'debt';

export interface ClientVisitService {
  serviceId?: Id;
  /** Название, если строка не привязана к услуге из каталога (свободный ввод визита задним числом) */
  customName?: string;
  price: Money;
}

/** Строка «Истории визитов» — объединённые по visitId записи одного дня (F-01-041) */
export interface ClientVisit {
  /** id записи или visitId группы */
  id: Id;
  clientId: Id;
  date: ISODateTime;
  staffId: Id;
  services: ClientVisitService[];
  total: Money;
  paid: Money;
  paymentStatus: VisitPaymentStatus;
  method?: string;
  status: BookingStatus;
  /** Внесено мастером задним числом, без записи в календаре (F-00-129) */
  manual: boolean;
  groupEvent: boolean;
  photoIds: string[];
  note?: string;
}

// ─────────────────────────── Визит задним числом (F-00-129) ───────────────────────────

export interface PastVisitInput {
  businessId: Id;
  /** Не задан (сеть «все филиалы») — первый филиал бизнеса */
  locationId?: Id;
  /** Существующий клиент — или новый (`newClient`), заводится в том же запросе */
  clientId?: Id;
  newClient?: { name: string; phone: string };
  staffId: Id;
  date: ISODate;
  time: string;
  services: ClientVisitService[];
  paidAmount: Money;
  method?: string;
  note?: string;
  photos?: { name: string; ext: string; size: number; dataUrl: string }[];
}

// ─────────────────────────── Файлы клиента (F-04-086) ───────────────────────────

export const CLIENT_FILE_EXTENSIONS = ['jpeg', 'jpg', 'png', 'gif', 'doc', 'docx', 'pdf', 'xls', 'xlsx', 'txt'] as const;
export type ClientFileExt = (typeof CLIENT_FILE_EXTENSIONS)[number];
export const CLIENT_FILE_MAX_MB = 12;
/** На сервере (режим api, 04.10.2026) — до 10 МБ, как фото */
export const CLIENT_FILE_SERVER_MAX_MB = 10;

export interface ClientFile {
  id: string;
  clientId: Id;
  name: string;
  ext: string;
  size: number;
  /** Мок и старые строки сервера — файл целиком data: URL; файл в хранилище сервера — адрес скачивания (= contentUrl) */
  dataUrl: string;
  /** Сервер: скачать через кабинет (cookie сессии, право «Клиенты: просмотр»), Content-Disposition: attachment */
  contentUrl?: string;
  /** Сервер: файл в закрытом хранилище, а не data: URL в базе */
  stored?: boolean;
  mime?: string | null;
  uploadedAt: ISODateTime;
  uploadedBy: string;
  /** Файл прикреплён к визиту (фото работы, F-00-128 доп. к F-04-075) */
  visitId?: Id;
}

// ─────────────────────────── Своё напоминание и приглашение на повтор (F-04-100) ───────────────────────────
// Ключ — bookingId (запись уже сохранена: `registerAfterSave`). Не трогает общие настройки раздела
// «Уведомления» (журнал) — своё для ОДНОЙ записи поверх них.

export interface BookingReminder {
  bookingId: Id;
  /** Когда напомнить клиенту о визите (push/WhatsApp, как и разовое сообщение — F-00-120/121) */
  remindAt?: ISODateTime;
  /** Через сколько дней после визита пригласить клиента на повторный (0/undefined — не приглашать отдельно) */
  revisitInviteDays?: number;
}

// ─────────────────────────── Звонки (F-04-079) ───────────────────────────
// 🔒 телефония не подключена нигде в проекте — интерфейс на моках, с пометкой «демо» (правило 0.1).

export type CallDirection = 'incoming' | 'outgoing' | 'missed';

export interface ClientCall {
  id: string;
  clientId: Id;
  direction: CallDirection;
  at: ISODateTime;
  durationSec: number;
  hasRecording: boolean;
}

// ─────────────────────────── Посетители (F-04-091) ───────────────────────────

export type VisitorForWhom = 'child' | 'pet' | 'other';

export interface VisitorInfo {
  key: string;
  name: string;
  forWhom: VisitorForWhom;
  visits: number;
  lastVisit?: ISODate;
}

// ─────────────────────────── Сводка CRM (F-00-126, F-00-131) ───────────────────────────

export interface StaffSummaryRow {
  staffId: Id;
  name: string;
  revenue: Money;
  hoursBooked: number;
  visits: number;
}

export interface CrmSummary {
  revenue: Money;
  clientsCount: number;
  visitsCount: number;
  byStaff: StaffSummaryRow[];
  /** Сотрудник без права на отчёты — цифры только по его визитам (F-00-132) */
  ownOnly: boolean;
  /** F-04-125: клиенты без визитов «Клиент пришел» ДО начала периода — первый визит попал в период */
  newClients: number;
  /** F-04-125: были визиты и до периода — «не новых» */
  repeatClients: number;
  /**
   * F-04-123/185: не посещали дольше `lostAfterDays` этого бизнеса, считая от конца периода; посчитаны только
   * клиенты, у которых был хотя бы один визит когда-либо (никогда не приходившие — не «потерянные», а «новые»).
   */
  lostClients: number;
  /**
   * F-04-124/185 ⭐: то же правило «потерянного», но по всей сети (все локации с тем же `networkId`) — клиент,
   * посещающий другой филиал сети, для сети не потерян, даже если для этой локации потерян.
   */
  networkLostClients?: number;
  /** F-04-163: клиенты со статусом «Не пришёл», которых внутри периода перезаписали и они дошли («Клиент пришел») */
  rebookedNoShows: number;
}

/** Прошедшая по времени запись без отметки «пришёл/не пришёл» (F-00-127) */
export interface PendingMark {
  bookingId: Id;
  clientId?: Id;
  clientName: string;
  staffId: Id;
  staffName: string;
  start: ISODateTime;
  services: string;
  total: Money;
}
