/**
 * Типы раздела «network». Файл принадлежит разделу — пишите сюда свои сущности.
 * Ссылайтесь на сущности ядра по id (import type { Id } from '@/domain/core').
 *
 * Сама сеть (Network) и её филиалы (Business/Location) — сущности ЯДРА (src/domain/core.ts), доступные
 * через generic coreList/coreCreate/coreUpdate/coreRemove. Здесь — только то, чего в ядре нет (b01: заказано
 * в qa/requests/network.md — порядок филиалов и мягкое удаление сети пока свои).
 */
import type { Id, ISODate, ISODateTime } from "@/domain/core";

/** 71 право сети сгруппированы по разделам меню (F-11-024…F-11-035); b01 хранит их плоским списком меток. */
export type NetworkPermissionKey =
  | "settings"
  | "users"
  | "clients"
  | "records"
  | "staff"
  | "services"
  | "goods"
  | "loyalty"
  | "accounts"
  /** F-06-177 (точечная правка CONVENTIONS §1 третий проход, qa/requests/loyalty.md 2026-09-25):
   * «Доступ к разделу Онлайн-продажи» — третье право сети из блока «Лояльность / Счета клиентов /
   * Онлайн-продажи»; открывает /biz/loyalty/online-sales для пользователя сети. */
  | "onlineSales"
  | "telephony"
  | "plans"
  | "analytics"
  | "fields"
  | "subdivisions"
  | "migrations"
  /** F-09-097 (payroll, точечная правка по CONVENTIONS §1 «второй проход», qa/requests/payroll.md
   * 2026-09-26): «Расчёт зарплат» — одна галочка без вложенных прав (открывает /biz/network/staff/payroll
   * целиком, как в ТЗ: без неё раздел не виден). */
  | "payroll";

export interface NetworkUser {
  id: Id;
  networkId: Id;
  name: string;
  phone?: string;
  email?: string;
  permissions: NetworkPermissionKey[];
  /** Сеть7: доступ по филиалам — бизнесы сети, которые видит пользователь; не задано — все филиалы */
  businessIds?: Id[];
  lastVisitAt?: ISODateTime;
  /** Владелец — есть всегда, права полные, удалить нельзя (F-11-024) */
  isOwner?: boolean;
  /** Логин для входа — только у пользователей, созданных без аккаунта (F-11-026) */
  login?: string;
  /** Приглашение отправлено, но человек ещё не зашёл (F-11-025) */
  pending?: boolean;
  /** F-11-030: как часто присылать письмо о выполнении плана */
  planReportFrequency?: "off" | "daily" | "weekly" | "monthly";
}

/** Поле записи или клиента сети (F-11-126…134) */
export type NetworkFieldKind = "booking" | "client";
export type NetworkFieldDataType =
  "text" | "number" | "list" | "date" | "datetime";

export interface NetworkField {
  id: Id;
  networkId: Id;
  kind: NetworkFieldKind;
  name: string;
  dataType: NetworkFieldDataType;
  /** только латиница, цифры и «. - _» (F-11-127) */
  apiKey: string;
  /** значения через запятую — только для dataType === 'list' (F-11-129) */
  listOptions: string[];
  editableByUser: boolean;
  showInAdmin: boolean;
  alwaysShowInBookingWindow: boolean;
  requiredOnCreate: boolean;
  requiredOnArrived: boolean;
  /** только у поля клиента (F-11-128) */
  alwaysShowInClientCard: boolean;
  /** «Дата и время» в виджет не выводится, даже если включено (F-11-129) */
  showInWidget: boolean;
  requiredInWidget: boolean;
  businessIds: Id[];
  createdAt: ISODateTime;
}

/** Маршрут звонка сети (F-11-148): кто получает всплывающую карточку, где хранится история */
export type NetworkCallHistoryStorage =
  "network" | "networkAndNotified" | "locationOnly";

export interface NetworkTelephonyRoute {
  id: Id;
  networkId: Id;
  name: string;
  isDefault: boolean;
  userIds: Id[];
  businessIds: Id[];
  historyStorage: NetworkCallHistoryStorage;
  createdAt: ISODateTime;
}

/** Правило маршрутизации (F-11-149): номер/SIP → маршрут */
export interface NetworkTelephonyRule {
  id: Id;
  networkId: Id;
  kind: "phone" | "sip";
  /** только цифры */
  identifier: string;
  routeId: Id;
}

/** Запись истории звонков сети (F-11-150, F-11-152) */
export interface NetworkCallRecord {
  id: Id;
  networkId: Id;
  phone: string;
  direction: "in" | "out";
  status: "accepted" | "missed";
  durationSec: number;
  at: ISODateTime;
  hasRecording: boolean;
  /** маршрут, разрешивший звонок этой локации; нет — звонок не был никуда разрешён (F-11-152) */
  routeId?: Id;
  businessId?: Id;
}

export type NetworkPlanKind = "revenue" | "clients" | "avgCheck";

export interface NetworkPlanCell {
  networkId: Id;
  businessId: Id;
  kind: NetworkPlanKind;
  /** 'YYYY-MM' */
  month: string;
  value: number;
}

export interface NetworkSubdivision {
  id: Id;
  networkId: Id;
  name: string;
  categoryIds: Id[];
}

export interface NetworkServiceCategoryLink {
  id: Id;
  networkId: Id;
  name: string;
  servicesCount: number;
  subdivisionId?: Id;
}

export interface NetworkGoodsCategory {
  id: Id;
  networkId: Id;
  name: string;
  parentId?: Id;
}

export interface NetworkTelephony {
  networkId: Id;
  token: string;
  connected: boolean;
}

/** Свойства сети, которых пока нет в ядре (b01: своими руками, см. qa/requests/network.md) */
export interface NetworkExtras {
  /** Порядок филиалов — первый может стать «Главным» (F-11-016/017) */
  order: Id[];
  /** Мягкое удаление сети (F-11-019/020) */
  deletedAt?: ISODateTime;
  /**
   * Баланс главной локации для оплаты сетевых рассылок, в драмах (F-11-057). Своей кассы у нас нет —
   * ассамед демо-число; списывается при отправке SMS, при нехватке рассылка получает статус
   * «Недостаточно средств» вместо отправки.
   */
  smsBalance?: number;
  /** Запросы на удаление локации через поддержку (F-11-011) — ключ businessId, значение — когда запрошено */
  pendingDeletions?: Record<Id, ISODateTime>;
}

/** Журнал «Изменения данных» сети — своя копия (F-11-023): создание/переименование/удаление/восстановление */
export type NetworkAuditAction = "created" | "renamed" | "deleted" | "restored";

export interface NetworkAuditEntry {
  id: Id;
  networkId: Id;
  action: NetworkAuditAction;
  authorName: string;
  at: ISODateTime;
  detail?: string;
}

/** Демо-срок лицензии филиала для переключателя (F-11-002); в ядре подписок ещё нет — см. qa/requests/network.md */
export interface BranchSubscription {
  businessId: Id;
  until: ISODate;
}

/** Класс важности клиента — считаем от суммы трат по сети (нет отдельного поля в ядре, b02: assumed) */
export type NetworkImportanceClass = "gold" | "silver" | "bronze" | "none";

/** Журнал выгрузок сети (F-11-044, F-11-076): каждая выгрузка уходит письмом со ссылкой на месяц */
export interface NetworkExportLogEntry {
  id: Id;
  networkId: Id;
  at: ISODateTime;
  authorName: string;
  kind: "clients" | "records" | "staff";
  count: number;
  /** Ссылка «живёт» месяц с момента создания (F-11-044) */
  expiresAt: ISODateTime;
}

/** Настройки аналитики сети (F-11-072): срок, после которого клиент без визитов считается потерянным */
export interface NetworkAnalyticsSettings {
  networkId: Id;
  lostClientDays: number;
}

/** Сетевая рассылка (F-11-054, F-11-060, F-11-164): фиксируем факт отправки для тоста и истории клиента */
export interface NetworkBroadcastLogEntry {
  id: Id;
  networkId: Id;
  channel: "sms" | "push";
  scope: "selected" | "found";
  recipients: number;
  text: string;
  at: ISODateTime;
  /** «Недостаточно средств» — тариф и баланс главной локации (F-11-057) */
  status: "sent" | "insufficientFunds";
  /** Стоимость в драмах — 0 у push (F-11-057) */
  cost: number;
  /** Сколько получателей исключено по «Не отправлять» (F-11-058) */
  optedOut: number;
}

/**
 * b03: раздача сетевых услуг/товаров/сотрудников по филиалам — запреты и переводы (F-11-082, F-11-083, F-11-086).
 * Услуги/сотрудники самой сети — это ядровые Service/Staff с совпадающим именем в нескольких Business (как и
 * в b01/b02); отдельная запись здесь хранит только то, чего у Service нет: запрет менять цену/описание в филиале.
 */
export interface NetworkServiceLock {
  /** Ключ — то же имя услуги, что группирует её по сети (`service.name.ru || service.id`) */
  key: string;
  networkId: Id;
  priceLocked: boolean;
  descriptionLocked: boolean;
  /** «Название для онлайн-записи» — в ядре у Service его нет (см. qa/requests/network.md) */
  onlineName?: string;
}

/** Сетевая должность (F-11-104…106) */
export interface NetworkPosition {
  id: Id;
  networkId: Id;
  name: string;
  description?: string;
  /** «Требования» — обязательные кадровые поля (F-11-105) */
  requirements: string[];
  /** «Назначать только в сети» — нельзя выбрать в филиале как обычную должность */
  networkOnly: boolean;
  /** Действует в филиалах (по умолчанию пусто — нигде) */
  businessIds: Id[];
  /** Услуги должности (F-11-106) */
  servicesMode: "off" | "strict";
  serviceIds: Id[];
  keepPriceAndDuration: boolean;
  createdAt: ISODateTime;
}

/** Тип нерабочего дня сети (F-11-108) */
export interface NetworkOffDayType {
  id: Id;
  networkId: Id;
  name: string;
  comment?: string;
  /** 1..8 → токен chart-N (ColorSwatch), как и цвет сотрудника в журнале */
  colorIndex: number;
  businessIds: Id[];
  system?: boolean;
}

/** Расчёт зарплаты сети (F-11-109) — пока свой лог факта запуска, см. qa/requests/network.md (нет api payroll для сети) */
export interface NetworkPayrollRun {
  id: Id;
  networkId: Id;
  period: { from: ISODate; to: ISODate };
  businessIds: Id[];
  staffCount: number;
  createdAt: ISODateTime;
  authorName: string;
}

/** Архив сетевого товара (F-11-118) — свой архив поверх `NetworkGoodsCategory`/сетевой группы товара */
export interface NetworkGoodsArchiveEntry {
  id: Id;
  networkId: Id;
  kind: "category" | "good";
  /** Имя, по которому товары/категории сети группируются в филиалах (как и услуги — по имени) */
  name: string;
  archivedAt: ISODateTime;
}
