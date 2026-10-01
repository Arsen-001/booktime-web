/**
 * Типы раздела «clients». Файл принадлежит разделу — пишите сюда свои сущности.
 * Ссылайтесь на сущности ядра по id (import type { Id } from '@/domain/core').
 *
 * Ядро (src/domain/core.ts) уже хранит про клиента: businessId, phone, name, gender, birthday,
 * email, note, tags (используем как категории, F-04-029/109), appUserId (наличие приложения,
 * F-04-027/028), noShowCount, blocked (запрет онлайн-записи, F-04-056), createdAt.
 * Здесь — то, чего в ядре нет: профиль (скидка, класс важности, номер карты, «Оплачено»),
 * настройки списка (колонки), фильтры и черновые данные для фильтров «По продажам» (F-04-035),
 * пока раздел loyalty не построил настоящие сертификаты/абонементы.
 */
import type { BookingStatus, Gender, Id, ISODate, ISODateTime, LocaleCode, Money } from '@/domain/core';

// ─────────────────────────── Профиль клиента (F-04-053…059, 165, 166) ───────────────────────────

export type ImportanceClass = 'gold' | 'silver' | 'bronze';
export const IMPORTANCE_CLASSES: ImportanceClass[] = ['gold', 'silver', 'bronze'];

/** Значения фильтра «Важность клиента» (F-04-033): три класса + «Без класса» (не хранится на клиенте) */
export type ImportanceFilterValue = ImportanceClass | 'none';
export const IMPORTANCE_FILTER_VALUES: ImportanceFilterValue[] = [...IMPORTANCE_CLASSES, 'none'];

/** Данные о клиенте, которых нет в ядре. Ключ записи — Client.id. */
export interface ClientProfile {
  discountPercent: number;
  importanceClass?: ImportanceClass;
  cardNumber?: string;
  /**
   * Внесено на счёт СВЕРХ оплат визитов: аванс, перенос остатка из старой программы, ручная поправка
   * (F-04-059, F-04-166 «старый способ»). «Оплачено» на экране = оплаты визитов + это число
   * (правило одно — `clientMoney` в src/domain/clients/money.ts). «Продано» здесь не хранится:
   * копится из визитов «Пришёл» (F-04-165), руками не правится.
   */
  paidAmount: Money;
  /** F-04-046: видны только при включённой настройке (ClientsState.showFullNameFields) */
  lastName?: string;
  middleName?: string;
  /** F-04-050 */
  additionalPhone?: string;
  /** F-04-069: data URL, уменьшенный ImageUpload'ом */
  avatar?: string;
  /**
   * F-04-129/177: сумма из импорта Excel (или загруженных остатков счёта), которая ПРИБАВЛЯЕТСЯ к
   * «Продано», а не заменяет его — «Продано» иначе целиком вычисляется из визитов «Клиент пришёл».
   * Повторная загрузка того же файла удваивает это число (это осознанное, задокументированное поведение).
   */
  importedSold: Money;
  /** F-04-192: необязательный национальный номер (12 цифр); интеграция с медсистемами — не решена */
  nationalId?: string;
  /** F-04-153/227: согласие на рекламные рассылки — дата, способ, кто зафиксировал */
  adConsent?: ConsentRecord;
  /** F-04-213: исключить из поздравлений с днём рождения (по умолчанию включены) */
  birthdayGreetingOptOut?: boolean;
  /**
   * F-04-228: язык клиента без приложения — выбирает мастер в карточке; у клиента из приложения язык
   * берётся из его приложения (appUser.locale), это поле игнорируется.
   */
  locale?: LocaleCode;
  /** F-04-211: удалено полностью по запросу клиента (GDPR) — телефон анонимизирован, возврата по номеру нет */
  purgedAt?: ISODateTime;
  /**
   * F-04-066 (исправлено): как клиент просит связываться — например «Просит не звонить, только WhatsApp».
   * По умолчанию `call`. Первой кнопкой и в липкой полосе карточки — именно этот канал, не всегда «Позвонить».
   */
  preferredContact?: PreferredContact;
}

export const PREFERRED_CONTACT_VALUES = ['call', 'wa', 'tg', 'viber'] as const;
export type PreferredContact = (typeof PREFERRED_CONTACT_VALUES)[number];

export function emptyProfile(): ClientProfile {
  return { discountPercent: 0, paidAmount: 0, importedSold: 0 };
}

// ─────────────────────────── Согласие на рекламу (F-04-153, F-04-154, F-04-227) ───────────────────────────

export type ConsentMethod = 'widget' | 'paper' | 'link';

export interface ConsentRecord {
  given: boolean;
  at: ISODateTime;
  method: ConsentMethod;
  /** Кто зафиксировал (имя сотрудника) — для бумажной анкеты и анкеты по ссылке */
  recordedBy?: string;
}

// ─────────────────────────── Права доступа: «Клиентская база» (F-04-194…204) ───────────────────────────
// 26 тонких прав из ТЗ; фундаментальный список src/config/permissions.ts даёт только грубые
// clients.view/phones/edit/export/delete — тоньше пока нет (просьба в qa/requests/clients.md), поэтому
// раздел держит их в своём срезе (ClientsState.staffRights) поверх грубых прав.

export const FINE_RIGHT_IDS = [
  // F-04-194: контакты
  'contactsInList',
  'contactsInCard',
  // F-04-195: правка карточки, лояльность, примечание, ФИО
  'editClient',
  'viewLoyalty',
  'viewNote',
  'editNote',
  'viewFullName',
  'editFullName',
  // F-04-196: удаление и выгрузка
  'deleteClients',
  'exportList',
  // F-04-197: комментарии
  'viewComments',
  'addComments',
  'deleteOwnComments',
  'deleteOthersComments',
  // F-04-198: файлы и доп. поля
  'viewFiles',
  'uploadFiles',
  'deleteFiles',
  'viewCustomFields',
  'editCustomFields',
  // F-04-199: область видимости и история
  'seeAllClients',
  'viewHistory',
  // F-04-200: счета клиента
  'viewAccounts',
  'openAccount',
  'topUpAccount',
  'viewAccountHistory',
  // F-04-201: окно записи
  'bookingWindowClientData',
  'bookingWindowCreateClients',
  // F-04-204: справочник категорий
  'manageCategories',
  // F-04-084: правка лояльности клиента из карточки и окна записи (8 из 8, справка 279583 §«Доступ»)
  'loyaltyIssueDeleteCards',
  'loyaltyTopUpCardBalance',
  'loyaltyEditSubscriptionBalance',
  'loyaltyEditSubscriptionExpiry',
  'loyaltyViewSubscriptionHistory',
  'loyaltyEditCertificateBalance',
  'loyaltyEditCertificateExpiry',
  'loyaltyPayWithoutCode',
  // F-04-150: «Медицинские документы» — просмотр + печать/редактирование по трём разделам визита
  'medicalCurrentVisitView',
  'medicalCurrentVisitEdit',
  'medicalCardsView',
  'medicalCardsEdit',
  'medicalTreatmentPlansView',
  'medicalTreatmentPlansEdit',
  // F-04-184: доступ к данным клиентов по сети (галочка в «Окно записи», выключена по умолчанию даже у владельца)
  'networkClientDataAccess',
] as const;
export type FineRight = (typeof FINE_RIGHT_IDS)[number];

export const FINE_RIGHT_GROUPS: { titleKey: string; rights: FineRight[] }[] = [
  { titleKey: 'contacts', rights: ['contactsInList', 'contactsInCard'] },
  { titleKey: 'edit', rights: ['editClient', 'viewLoyalty', 'viewNote', 'editNote', 'viewFullName', 'editFullName'] },
  { titleKey: 'deleteExport', rights: ['deleteClients', 'exportList'] },
  { titleKey: 'comments', rights: ['viewComments', 'addComments', 'deleteOwnComments', 'deleteOthersComments'] },
  { titleKey: 'filesFields', rights: ['viewFiles', 'uploadFiles', 'deleteFiles', 'viewCustomFields', 'editCustomFields'] },
  { titleKey: 'scope', rights: ['seeAllClients', 'viewHistory'] },
  { titleKey: 'accounts', rights: ['viewAccounts', 'openAccount', 'topUpAccount', 'viewAccountHistory'] },
  { titleKey: 'bookingWindow', rights: ['bookingWindowClientData', 'bookingWindowCreateClients'] },
  { titleKey: 'categories', rights: ['manageCategories'] },
  {
    titleKey: 'loyaltyRights',
    rights: [
      'loyaltyIssueDeleteCards',
      'loyaltyTopUpCardBalance',
      'loyaltyEditSubscriptionBalance',
      'loyaltyEditSubscriptionExpiry',
      'loyaltyViewSubscriptionHistory',
      'loyaltyEditCertificateBalance',
      'loyaltyEditCertificateExpiry',
      'loyaltyPayWithoutCode',
    ],
  },
  {
    titleKey: 'medicalDocs',
    rights: ['medicalCurrentVisitView', 'medicalCurrentVisitEdit', 'medicalCardsView', 'medicalCardsEdit', 'medicalTreatmentPlansView', 'medicalTreatmentPlansEdit'],
  },
  { titleKey: 'networkAccess', rights: ['networkClientDataAccess'] },
];

export type ClientsFineRights = Record<FineRight, boolean>;

export function allFineRights(value: boolean): ClientsFineRights {
  return Object.fromEntries(FINE_RIGHT_IDS.map((id) => [id, value])) as ClientsFineRights;
}

/** Права мастера по умолчанию (F-04-199 ⭐: видит только своих клиентов; без удаления/выгрузки/чужих комментариев) */
export function defaultMasterFineRights(): ClientsFineRights {
  return {
    ...allFineRights(true),
    deleteClients: false,
    exportList: false,
    deleteOthersComments: false,
    editFullName: false,
    manageCategories: false,
    seeAllClients: false,
    // F-00-132 ещё не решено владельцем: пока суммы клиента мастеру не показываем, владелец может включить (ux-r2 №7)
    viewAccounts: false,
    openAccount: false,
    topUpAccount: false,
    // F-04-084: мастер по умолчанию не двигает деньги в лояльности (тот же принцип, что и со счётом выше)
    loyaltyTopUpCardBalance: false,
    loyaltyEditSubscriptionBalance: false,
    loyaltyEditSubscriptionExpiry: false,
    loyaltyEditCertificateBalance: false,
    loyaltyEditCertificateExpiry: false,
    // F-04-150: медицинские документы — владелец включает отдельно, по умолчанию выключены и мастеру, и админу
    medicalCurrentVisitEdit: false,
    medicalCardsEdit: false,
    medicalTreatmentPlansEdit: false,
    // F-04-184: выключено по умолчанию даже у владельца (источник — экран «Владелец», единственная снятая галочка)
    networkClientDataAccess: false,
  };
}

/** Права администратора по умолчанию — почти всё, кроме удаления/выгрузки/пополнения счёта, ⭐ F-00-039 */
export function defaultAdminFineRights(): ClientsFineRights {
  return {
    ...allFineRights(true),
    deleteClients: false,
    exportList: false,
    topUpAccount: false,
    // F-04-084: та же осторожность с деньгами лояльности, что и со счётом клиента выше
    loyaltyTopUpCardBalance: false,
    loyaltyEditSubscriptionBalance: false,
    loyaltyEditSubscriptionExpiry: false,
    loyaltyEditCertificateBalance: false,
    loyaltyEditCertificateExpiry: false,
    // F-04-150: владелец включает печать/редактирование медицинских документов отдельно, по умолчанию выключено
    medicalCurrentVisitEdit: false,
    medicalCardsEdit: false,
    medicalTreatmentPlansEdit: false,
    // F-04-184: выключено по умолчанию даже у владельца (источник — экран «Владелец»)
    networkClientDataAccess: false,
  };
}

// ─────────────────────────── Доп. поля клиента (F-04-060) ───────────────────────────
// Полноценный конструктор доп. полей (типы, обязательность) — F-04-139…145, отдельная пачка.
// Здесь — минимум, чтобы «созданное доп. поле видно в форме и сохраняется»: текстовые поля бизнеса.

/** F-04-140: тип значения доп. поля — определяет, каким контролом оно вводится и показывается */
export const CUSTOM_FIELD_TYPES = ['text', 'number', 'list', 'date'] as const;
export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];

export interface CustomFieldDef {
  id: string;
  label: string;
  /** F-04-140. Старые поля (до этой пачки) не хранили тип — читаем как 'text' (см. api/clients/settings.ts) */
  type: CustomFieldType;
  /** F-04-140: варианты списка — только для type 'list' */
  options?: string[];
  /** F-04-142: обязательность — в форме клиента и в виджете онлайн-записи */
  required: boolean;
  /** F-04-145: «ключ-значение для API» — стабильный идентификатор поля для внешних интеграций */
  apiKey: string;
  /** F-04-145: «Пользователь может редактировать» — клиент правит поле сам (в приложении/виджете), не только бизнес */
  editableByClient: boolean;
  /** F-04-141: видно в карточке клиента сразу, а не под ссылкой «Дополнительные параметры» */
  alwaysShowInClientCard: boolean;
  /** F-04-141: видно в правом блоке окна записи клиента, а не скрыто */
  alwaysShowInBookingWindow: boolean;
}

// ─────────────────────────── История комментариев (F-04-070) ───────────────────────────

export interface ClientComment {
  id: string;
  clientId: Id;
  authorId: Id;
  authorName: string;
  text: string;
  createdAt: ISODateTime;
}

// ─────────────────────────── Журнал изменений клиента (⭐ F-00-040 → F-04-137) ───────────────────────────

export type ClientChangeAction = 'created' | 'updated' | 'deleted' | 'merged' | 'purged';

export interface ClientChangeLogEntry {
  id: string;
  clientId: Id;
  /** Имя клиента на момент записи — видно и после удаления карточки, когда клиента в базе уже нет */
  clientName: string;
  action: ClientChangeAction;
  authorId: Id;
  authorName: string;
  /** Короткое пояснение, что именно изменилось — «Телефон, email», «Удалён», «Объединён с …» */
  summary: string;
  at: ISODateTime;
}

// ─────────────────────────── Активность в приложении (F-04-072) ───────────────────────────

export type AppPlatform = 'ios' | 'android';

export interface AppActivity {
  platform: AppPlatform;
  lastUsedAt: ISODateTime;
}

// ─────────────────────────── Колонки таблицы (F-04-003…005) ───────────────────────────

export const CLIENT_COLUMN_IDS = ['name', 'phone', 'email', 'sold', 'balance', 'visits', 'discount', 'lastVisit', 'firstVisit'] as const;
export type ClientColumnId = (typeof CLIENT_COLUMN_IDS)[number];

export const MAX_PINNED_COLUMNS = 5;

export interface ColumnsPrefs {
  /** Какие колонки показаны (порядок — порядок показа; 'name' всегда первой и всегда включена) */
  visible: ClientColumnId[];
  /** Закреплённые колонки (идут первыми сразу после «Имя»), не больше MAX_PINNED_COLUMNS */
  pinned: ClientColumnId[];
}

/**
 * По умолчанию 7 колонок влезают в 1440 без прокрутки (ux-r1 №7): email (почти у всех пуст) и «первый визит»
 * включаются в меню колонок.
 */
export function defaultColumnsPrefs(): ColumnsPrefs {
  return { visible: CLIENT_COLUMN_IDS.filter((id) => id !== 'email' && id !== 'firstVisit'), pinned: [] };
}

/** Настройки клиентской базы — у каждого бизнеса свои (arch-a1 №2): колонки, порог «давно не были», поля */
export interface ClientsBizSettings {
  autoSaveChatLeads: boolean;
  /** Дни без визита, после которых клиент попадает в «Давно не были» (F-04-014) */
  lostAfterDays: number;
  /** F-04-046: поля «Фамилия»/«Отчество» в форме, карточке и окне записи */
  showFullNameFields: boolean;
  /** F-04-060 */
  customFieldDefs: CustomFieldDef[];
  /**
   * F-04-099: «Настройки → Цифровой журнал → Работа с клиентами → Отображать в окне записи поиск по
   * лояльности» — раздел journal эту настройку не построил (qa/requests/clients.md), поэтому временно
   * живёт здесь, как и F-04-046. По умолчанию выключена (как в ТЗ).
   */
  showLoyaltySearchInBookingWindow: boolean;
}

export function defaultBizSettings(): ClientsBizSettings {
  return {
    autoSaveChatLeads: false,
    lostAfterDays: 60,
    showFullNameFields: true,
    customFieldDefs: [],
    showLoyaltySearchInBookingWindow: false,
  };
}

// ─────────────────────────── Сегменты (F-04-011…016) ───────────────────────────

export type SegmentId = 'due' | 'new' | 'repeat' | 'lost' | 'subscriptionEnding' | 'chatLeads';
export const SEGMENT_IDS: SegmentId[] = ['due', 'new', 'repeat', 'lost', 'subscriptionEnding', 'chatLeads'];

/** Категория, которой помечаются клиенты, автосохранённые из чата (F-04-016, F-04-187) */
export const CHAT_LEAD_TAG = 'Лид из чата';

// ─────────────────────────── Конструктор фильтров (F-04-017…035) ───────────────────────────

export type FilterGroupId = 'visits' | 'clients' | 'sales';
export const FILTER_GROUP_IDS: FilterGroupId[] = ['visits', 'clients', 'sales'];
export type FilterLogic = 'and' | 'or';

export interface DateRangeValue {
  from?: ISODate;
  to?: ISODate;
}
export interface NumberRangeValue {
  from?: number;
  to?: number;
}
export type Presence = 'has' | 'none';
export type TriState = 'yes' | 'no';

export interface VisitsFilters {
  presence?: Presence;
  presenceRange?: DateRangeValue;
  status?: BookingStatus[];
  visitsCount?: NumberRangeValue;
  period?: DateRangeValue;
  staffIds?: Id[];
  serviceIds?: Id[];
  serviceAmount?: NumberRangeValue;
}

export interface ClientsFilters {
  gender?: (Gender | 'unset')[];
  /** Установил наше приложение (F-04-027/028 — у Altegio это два разных фильтра на один и тот же признак, у нас один) */
  hasMobileApp?: TriState;
  categoryTags?: string[];
  sold?: NumberRangeValue;
  balance?: NumberRangeValue;
  broadcastPeriod?: DateRangeValue;
  importance?: ImportanceFilterValue[];
  birthdayPeriod?: DateRangeValue;
  age?: NumberRangeValue;
}

export interface CertificateFilter {
  name?: string;
  used?: TriState;
  balance?: NumberRangeValue;
  expiringSoon?: boolean;
  soldAt?: DateRangeValue;
}

export interface SubscriptionFilter {
  name?: string;
  used?: TriState;
  status?: 'active' | 'expired';
  frozen?: boolean;
  expiringSoon?: boolean;
  soldAt?: DateRangeValue;
  remainingVisits?: NumberRangeValue;
}

export interface SalesFilters {
  productNames?: string[];
  certificate?: CertificateFilter;
  subscription?: SubscriptionFilter;
}

export interface ClientsFilterState {
  logic: Record<FilterGroupId, FilterLogic>;
  visits: VisitsFilters;
  clients: ClientsFilters;
  sales: SalesFilters;
}

export function emptyFilterState(): ClientsFilterState {
  return {
    logic: { visits: 'and', clients: 'and', sales: 'and' },
    visits: {},
    clients: {},
    sales: {},
  };
}

/** Быстрая подборка «Часто не приходят» (F-04-157) — не сегмент ТЗ, но стоит в том же ряду чипов */
export type QuickPickId = SegmentId | 'noShow';

export type ClientsSortColumn = ClientColumnId;
export interface ClientsSort {
  columnId: ClientsSortColumn;
  dir: 'asc' | 'desc';
}

/** По умолчанию — кто был недавно, сверху; клиенты без визитов — в конце (demo-q1, core-k1) */
export const DEFAULT_CLIENTS_SORT: ClientsSort = { columnId: 'lastVisit', dir: 'desc' };

/** Запрос списка клиентов: всё считает api (arch-a1 №1), экран держит только состояние фильтров */
export interface ClientListQuery {
  businessId: Id;
  /** Филиалы, выбранные переключателем (сеть, F-00-050): клиенты бизнесов этих филиалов */
  locationIds?: Id[];
  search?: string;
  pick?: QuickPickId | null;
  filters?: ClientsFilterState;
  sort?: ClientsSort | null;
  /** Без права «все клиенты» (F-04-199) — только клиенты, у которых был визит к этому мастеру */
  onlyStaffId?: Id;
  page: number;
  pageSize: number;
  /** Отдать страницу, на которой стоит этот клиент (только что добавленный — F-04-061) */
  revealId?: Id;
}

export interface ClientListPage {
  rows: ClientRow[];
  /** Сколько нашлось с поиском/подборкой/фильтрами */
  total: number;
  /** Сколько клиентов в базе вообще (без поиска и фильтров) — для пустого состояния «база пуста» */
  baseTotal: number;
  /** id всех найденных — для действий «ко всем найденным» (без строк целиком) */
  ids: Id[];
  /** Числа на чипах подборок — по всей базе, без поиска и фильтров */
  pickCounts: Record<QuickPickId, number>;
  /** Номер отданной страницы: при `revealId` — та, где стоит этот клиент (новый клиент виден сразу, F-04-061) */
  page: number;
}

// ─────────────────────────── Строка списка (вычислено из ядра + профиль) ───────────────────────────

export interface ClientRow {
  id: Id;
  businessId: Id;
  name: string;
  phone: string;
  email?: string;
  gender: Gender;
  birthday?: ISODate;
  note?: string;
  tags: string[];
  appUserId?: Id;
  noShowCount: number;
  /** Отмены (клиентом или мастером) за всё время — наше дополнение к карточке (F-04-226) */
  cancelCount: number;
  blocked?: boolean;
  createdAt: ISODateTime;
  cardNumber?: string;
  discount: number;
  importanceClass?: ImportanceClass;
  sold: Money;
  paid: Money;
  balance: Money;
  visits: number;
  firstVisit?: ISODate;
  lastVisit?: ISODate;
  /**
   * ⭐ «Пора снова» (F-00-084, F-00-119): последний визит + интервал повтора его услуги (Service.repeatIntervalDays,
   * берём самый короткий из услуг визита). Нет поля — у услуг интервала нет или клиент уже записан на будущее.
   */
  dueAt?: ISODate;
  /** Даты, когда клиенту уходила рассылка (пуш) — F-04-032 */
  broadcastDates: ISODate[];
  lastName?: string;
  middleName?: string;
  additionalPhone?: string;
  avatar?: string;
  /** F-04-192 */
  nationalId?: string;
  /** F-04-153/227 */
  consent?: ConsentRecord;
  /** F-04-213 */
  birthdayGreetingOptOut?: boolean;
  /** F-04-228 */
  locale?: LocaleCode;
  /** F-04-066 */
  preferredContact?: PreferredContact;
}

// ─────────────────────────── Журнал массовых рассылок (F-04-038…040) ───────────────────────────
// По нашему решению два вида пуша (в мобильные приложения / в Altegio.me) слиты в один канал —
// пуш в наше приложение клиента (F-00-114). Запись в журнале нужна, чтобы «отправленная рассылка
// видна в отчёте сообщений» (F-04-038 «Готово, когда») была видна где-то в интерфейсе; полноценный
// отчёт «Сообщения» строит раздел reports — здесь минимальный журнал раздела (см. qa/requests/clients.md).
export type BroadcastChannel = 'sms' | 'push' | 'whatsapp';

export interface BroadcastMessage {
  id: string;
  businessId: Id;
  channel: BroadcastChannel;
  text: string;
  audienceCount: number;
  sentAt: ISODateTime;
  /** F-04-100: сообщение из окна записи адресовано одному клиенту, а не рассылке */
  clientId?: Id;
  /** F-04-100: «Тип в отчёте сообщений — сообщение из окна записи» */
  source?: 'bulk' | 'bookingWindow';
}

// ─────────────────────────── Мини-карточка в окне записи, «⋯ Ещё» (F-04-093) ───────────────────────────

export type BookingWindowSection = 'profile' | 'history' | 'loyalty' | 'stats' | 'messages' | 'invoices' | 'files';
export const BOOKING_WINDOW_SECTIONS: BookingWindowSection[] = ['profile', 'history', 'loyalty', 'stats', 'messages', 'invoices', 'files'];
/** Профиль клиента и История визитов отмечены звездой по умолчанию (справка Altegio) */
export const DEFAULT_BOOKING_WINDOW_FAVORITES: BookingWindowSection[] = ['profile', 'history'];
