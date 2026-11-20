/**
 * Типы раздела «staff» (Сотрудники, роли, права, безопасность). Файл принадлежит разделу.
 * Сущности ядра (Staff, StaffRole, StaffStatus, Business…) — из '@/domain/core' по id.
 */
import type {
  Id,
  ISODate,
  LocalizedText,
  Staff,
  StaffRole,
} from "@/domain/core";
import { nowYerevan, parse } from "@/lib/date";
import { nameScript, translitName, type NameLocale } from "@/lib/translit";

// ─────────────────────────── Должности (F-10-008, F-10-015) ───────────────────────────

/** Каталог должностей бизнеса; Staff.position хранит выбранное имя (LocalizedText), а не ссылку на id. */
export interface StaffPosition {
  id: Id;
  businessId: Id;
  name: LocalizedText;
  /** Необязательное описание должности (F-10-047) */
  description?: string;
  order: number;
  createdAt: ISODate;
}

// ─────────────────────────── Карточка сотрудника (F-10-024…039, F-10-097…098, F-10-119, F-10-137) ───────────────────────────

/**
 * Вкладки карточки (С15 обзора «Сотрудники», 27.09.2026): было 9 — не помещались даже на 1440, «График работы»
 * пряталась за стрелкой. Стало 5: юр. данные и настройки — свёрнутыми блоками внизу «Информации», онлайн-запись
 * вместе с графиком, уведомления вместе с доступом. Старые адреса ?tab=… ведут в новую вкладку (normalizeCardTab).
 */
export type StaffCardTab = "info" | "services" | "schedule" | "payroll" | "access";

export const STAFF_CARD_TABS: StaffCardTab[] = ["info", "services", "schedule", "payroll", "access"];

/** ?tab= из старых ссылок (online, legal, settings, notifications) → новая вкладка */
export function normalizeCardTab(raw: string | null | undefined): StaffCardTab {
  switch (raw) {
    case "services":
    case "payroll":
    case "access":
    case "schedule":
      return raw;
    case "online":
      return "schedule";
    case "notifications":
      return "access";
    default:
      return "info";
  }
}

export type StaffGender = "unknown" | "male" | "female";

/** Юр. информация сотрудника (F-10-038) — видна только владельцу и интеграциям с доступом к сотрудникам */
export interface StaffLegalInfo {
  firstName?: string;
  lastName?: string;
  middleName?: string;
  citizenship?: string;
  gender?: StaffGender;
  passportNo?: string;
  taxId?: string;
  insuranceNo?: string;
  hiredAt?: ISODate;
  permitEndAt?: ISODate;
  extraPhone?: string;
}

export function emptyStaffLegalInfo(): StaffLegalInfo {
  return { gender: "unknown" };
}

/**
 * Настройки карточки, которых нет в ядре и не покрыты чужими вкладами (F-10-036 внешний ID, F-10-037
 * ассистирование). Остальное вкладки «Настройки» (F-10-034/035/098) уже строит schedule во вкладке
 * «График работы» (StaffAccessSection/StaffGoogleSection) — см. qa/build/staff-b02.md.
 */
export interface StaffCardSettings {
  /** Показывать рейтинг мастера на его странице онлайн-записи (С18) — по умолчанию да */
  showRating?: boolean;
  /** Доступен для ассистирования (F-10-037) — по умолчанию выключено */
  assistantAvailable?: boolean;
  /** Внешний ID для интеграций (F-10-036) */
  externalId?: string;
  /** «Данные клиента — отправлять имя и номер телефона» в уведомлениях сотруднику (F-10-097) — выключено в пробном кабинете */
  sendClientContactsInNotify?: boolean;
}

export function emptyStaffCardSettings(): StaffCardSettings {
  return { assistantAvailable: false, sendClientContactsInNotify: false };
}

/** Черновик редактируемых полей карточки (вкладка «Информация», F-10-025) */
export interface StaffInfoDraft {
  /** Имя как вписали (кабинет, поиск) — значение поля на языке, которым имя вписали впервые */
  name: string;
  /**
   * Имя на трёх языках для клиентов (владелец 17.11.2026): пустые языки при открытии карточки заполнены переводом букв
   * из `name` — их можно поправить (staffNameDraft)
   */
  nameI18n: Record<NameLocale, string>;
  specialty: string;
  position: string;
  phone: string;
  email: string;
  /** «О себе» на трёх языках (С18): клиент видит текст на своём языке, пустой — русский */
  bio: { ru: string; hy: string; en: string };
  hiredAt: ISODate;
}

export const NAME_LOCALES: readonly NameLocale[] = ["ru", "hy", "en"];

/** Имя на трёх языках для карточки: вписанное в nameI18n, иначе перевод букв из `name` (auto — что заполнено само) */
export function staffNameDraft(s: Pick<Staff, "name" | "nameI18n">): { names: Record<NameLocale, string>; auto: Record<NameLocale, boolean> } {
  const source = nameScript(s.name) ?? "ru";
  const names = {} as Record<NameLocale, string>;
  const auto = {} as Record<NameLocale, boolean>;
  for (const l of NAME_LOCALES) {
    const own = l === source ? s.name : s.nameI18n?.[l]?.trim();
    names[l] = own || translitName(s.name, l);
    auto[l] = !own;
  }
  return { names, auto };
}

/** Какое из трёх имён — «как вписали» (Staff.name): язык прежнего имени, пустое — первое заполненное ru → hy → en */
export function mainStaffName(prevName: string, names: Record<NameLocale, string>): string {
  const source = nameScript(prevName) ?? "ru";
  return names[source].trim() || NAME_LOCALES.map((l) => names[l].trim()).find(Boolean) || "";
}

export function staffToInfoDraft(s: Staff): StaffInfoDraft {
  return {
    name: s.name,
    nameI18n: staffNameDraft(s).names,
    specialty: s.specialty?.ru ?? "",
    position: s.position?.ru ?? "",
    phone: s.phone,
    email: s.email ?? "",
    bio: { ru: s.bio?.ru ?? "", hy: s.bio?.hy ?? "", en: s.bio?.en ?? "" },
    hiredAt: s.hiredAt,
  };
}

// ─────────────────────────── Приглашения (F-10-016, F-00-042) ───────────────────────────

export type StaffInviteRole = Extract<StaffRole, "admin" | "master">;
export type StaffInviteStatus = "pending" | "accepted" | "revoked";

/** Приглашение сотрудника: мастер приглашается по номеру, администратор — логином/паролем от владельца */
export interface StaffInvite {
  id: Id;
  businessId: Id;
  staffId: Id;
  role: StaffInviteRole;
  phone?: string;
  email?: string;
  status: StaffInviteStatus;
  createdAt: ISODate;
}

// ─────────────────────────── Системные пользователи (F-10-010) ───────────────────────────

/** Технический пользователь подключённой интеграции — не занимает платное место */
export interface StaffSystemUser {
  id: Id;
  businessId: Id;
  label: string;
  integrationKey: string;
  permissions: string[];
  connectedAt: ISODate;
}

// ─────────────────────────── Журнал изменений (⭐ F-00-040) ───────────────────────────

/**
 * Общий журнал изменений; пишут все разделы через staff.api logChange(). Читают staff (/biz/staff/log)
 * и другие разделы (история прав F-10-070, история записи F-01-096 — читают тем же listChanges()).
 */
export interface StaffAuditEntry {
  id: Id;
  businessId: Id;
  entity: string;
  entityId: Id;
  action: string;
  actorStaffId?: Id;
  actorLabel: string;
  before?: unknown;
  after?: unknown;
  at: ISODate;
}

export interface StaffAuditFilter {
  businessId: Id;
  entity?: string;
  entityId?: Id;
  actorStaffId?: Id;
  /** 'created' | 'updated' | 'deleted' | 'restored' — сводится по action-строке (F-10-100) */
  action?: string;
}

// ─────────────────────────── Список сотрудников (F-10-005…013) ───────────────────────────

/** Вкладки списка (С7/С8/С3): «Работают» — одна таблица с должностями-разделителями, «Архив» — уволенные и удалённые */
export type StaffGroupTab = "team" | "archive" | "system";
export type StaffStatusFilter = "working" | "all" | "fired";
export type StaffLicenseFilter = "all" | "paid" | "free";

export interface StaffListFilters {
  status: StaffStatusFilter;
  license: StaffLicenseFilter;
  positionName?: string | null;
}

export function emptyStaffFilters(): StaffListFilters {
  return { status: "working", license: "all" };
}

export function activeStaffFilterCount(f: StaffListFilters): number {
  let n = 0;
  if (f.status !== "working") n++;
  if (f.license !== "all") n++;
  if (f.positionName) n++;
  return n;
}

export type StaffSortField = "order" | "name" | "role" | "status";
export interface StaffListSort {
  field: StaffSortField;
  dir: "asc" | "desc";
}
export const DEFAULT_STAFF_SORT: StaffListSort = { field: "order", dir: "asc" };

/** Поиск по части имени, телефона или email (F-10-006) */
export function matchesStaffSearch(s: Staff, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const hay = `${s.name} ${s.phone} ${s.email ?? ""}`.toLowerCase();
  return hay.includes(needle);
}

/** Уволенные/удалённые скрыты по умолчанию (F-10-007) */
export function matchesStaffStatusFilter(
  s: Staff,
  filter: StaffStatusFilter,
): boolean {
  if (filter === "all") return true;
  if (filter === "fired") return s.status === "fired";
  return s.status !== "fired";
}

export function matchesStaffLicenseFilter(
  paid: boolean,
  filter: StaffLicenseFilter,
): boolean {
  if (filter === "all") return true;
  return filter === "paid" ? paid : !paid;
}

export function sortStaffRows<T extends { staff: Staff; order: number }>(
  rows: T[],
  sort: StaffListSort,
): T[] {
  const dir = sort.dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    switch (sort.field) {
      case "name":
        return a.staff.name.localeCompare(b.staff.name) * dir;
      case "role":
        return a.staff.role.localeCompare(b.staff.role) * dir;
      case "status":
        return a.staff.status.localeCompare(b.staff.status) * dir;
      case "order":
      default:
        return (a.order - b.order) * dir;
    }
  });
}

/**
 * Порядок мастеров в журнале и в записи клиента (С1): новая позиция одного сотрудника относительно другого.
 * ids — ВЕСЬ порядок бизнеса (не видимая часть списка): иначе перенумерация видимых сталкивалась с номерами
 * скрытых и «Выше» двигало чужую строку.
 */
export function applyStaffMove(ids: Id[], staffId: Id, targetId: Id, place: "before" | "after"): Id[] {
  if (staffId === targetId) return ids;
  const rest = ids.filter((id) => id !== staffId);
  const at = rest.indexOf(targetId);
  if (at < 0) return ids;
  rest.splice(place === "before" ? at : at + 1, 0, staffId);
  return rest;
}

/** Стабильный порядок бизнеса: номер из среза staff, при равных — кто раньше пришёл, затем id */
export function orderedStaffIds(staff: Pick<Staff, "id" | "hiredAt">[], order: Record<Id, number>): Id[] {
  return [...staff]
    .sort(
      (a, b) =>
        (order[a.id] ?? 9999) - (order[b.id] ?? 9999) ||
        a.hiredAt.localeCompare(b.hiredAt) ||
        a.id.localeCompare(b.id),
    )
    .map((s) => s.id);
}

/**
 * Ассистент (С9): бесплатное место — отмечен в карточке («Ассистент, без своих записей») или должность так
 * и называется («Ассистент мастера»). Одно правило для списка, карточки и расчёта подписки.
 */
export function isAssistantStaff(s: Pick<Staff, "assistantOnly" | "position">): boolean {
  if (s.assistantOnly) return true;
  const name = `${s.position?.ru ?? ""} ${s.position?.en ?? ""} ${s.position?.hy ?? ""}`.toLowerCase();
  return /ассистент|assistant|օգնական/.test(name);
}

// ─────────────────────────── Доступ, приглашения (F-10-019, F-10-020, F-10-031, F-10-131) ───────────────────────────

/**
 * Доступ сотрудника в кабинет: включение/отключение, служебная заметка и назначенная роль-шаблон.
 * Не путать с core Staff.status ('invited'/'disabled') — тот управляется этими же функциями api/staff.ts,
 * access.info и access.roleTemplateId живут только в срезе staff (F-00-039/040).
 */
export interface StaffAccessInfo {
  enabled: boolean;
  info?: string;
  roleTemplateId?: StaffRoleTemplateId;
  /**
   * «Вход только с IP салона» (F-10-091, ответ 22, 20.11.2026): кабинет этого салона — только с адресов салона
   * (SalonIpSettings.ips), проверка на каждом запросе. Владельца не касается никогда
   */
  salonIpOnly?: boolean;
}

/**
 * Вход администратора по логину (F-00-034/038): что видит владелец. Пароль не показывается никогда — владелец видит
 * его один раз, когда выдаёт; mustChangePassword — администратор ещё не сменил выданный пароль при первом входе.
 */
export interface StaffPasswordLogin {
  login: string;
  mustChangePassword: boolean;
  /** Когда администратор сам сменил пароль */
  changedAt?: string;
  /** Когда владелец выдал (или сбросил) пароль */
  issuedAt: string;
}

/** Логин: латиница, цифры, точка, дефис, подчёркивание; 3–64 знака (как на сервере, staff.service setLogin) */
export const STAFF_LOGIN_RE = /^[a-z0-9._-]{3,64}$/;
export const STAFF_PASSWORD_MIN = 6;

export function normalizeStaffLogin(value: string): string {
  return value.trim().toLowerCase();
}

/** Слабый пароль — короче 6 знаков или совпадает с логином (как isWeakPassword сервера) */
export function isWeakStaffPassword(password: string, login: string): boolean {
  return password.length < STAFF_PASSWORD_MIN || password.length > 128 || password.trim().toLowerCase() === normalizeStaffLogin(login);
}

export function emptyStaffAccess(role: StaffRole): StaffAccessInfo {
  return {
    enabled: role !== "master",
    roleTemplateId: defaultRoleTemplateFor(role),
  };
}

// ─────────────────────────── «Вход только с IP салона» (F-10-091, ответ 22) ───────────────────────────
// Те же правила, что у сервера (booktime-backend src/common/http/salon-ip.ts) — тесты с обеих сторон на одних примерах.

/** Попытка открыть кабинет не с адреса салона: одна на сотрудника и адрес — сколько раз и когда последняя */
export interface SalonIpAttempt {
  id: Id;
  staffId: Id;
  staffName: string;
  ip: string;
  attempts: number;
  /** 'YYYY-MM-DDTHH:mm', Ереван */
  firstAt: string;
  lastAt: string;
}

/** Адреса салона (общие для всех с галочкой), адрес смотрящего сейчас и ещё закрытые попытки за 30 дней */
export interface SalonIpSettings {
  ips: string[];
  currentIp: string;
  attempts: SalonIpAttempt[];
}

/** Демо без сервера: «адрес», с которого открыт кабинет в этом браузере (настоящий знает только сервер) */
export const DEMO_CLIENT_IP = '46.70.12.34';

/** '::ffff:37.252.64.10' → '37.252.64.10'; IPv6 — строчными; пробелы по краям прочь */
export function normalizeIp(raw: string): string {
  const ip = raw.trim().toLowerCase();
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(ip);
  return mapped ? mapped[1] : ip;
}

function ipv4Bytes(ip: string): number[] | null {
  const parts = ip.split('.');
  if (parts.length !== 4 || !parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255)) return null;
  return parts.map(Number);
}

/** IPv6 → 16 байт ('2a00:cc0::1', хвост IPv4 тоже); не IPv6 — null */
function ipv6Bytes(ip: string): number[] | null {
  if (!ip.includes(':') || !/^[0-9a-f:.]+$/.test(ip)) return null;
  let s = ip;
  const v4 = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(s);
  let tail4: number[] = [];
  if (v4) {
    const b = ipv4Bytes(v4[1]);
    if (!b) return null;
    tail4 = b;
    s = s.slice(0, v4.index);
    if (s.endsWith(':') && !s.endsWith('::')) s = s.slice(0, -1);
  }
  const halves = s.split('::');
  if (halves.length > 2) return null;
  const groups = (x: string) => (x ? x.split(':') : []);
  const head = groups(halves[0]);
  const tail = halves.length === 2 ? groups(halves[1]) : [];
  const total = 8 - tail4.length / 2;
  const fill = halves.length === 2 ? total - head.length - tail.length : 0;
  if (fill < (halves.length === 2 ? 1 : 0) || head.length + tail.length + fill !== total) return null;
  const all = [...head, ...Array<string>(fill).fill('0'), ...tail];
  if (!all.every((g) => /^[0-9a-f]{1,4}$/.test(g))) return null;
  return [...all.flatMap((g) => [parseInt(g, 16) >> 8, parseInt(g, 16) & 255]), ...tail4];
}

function ipBytes(raw: string): number[] | null {
  const ip = normalizeIp(raw);
  return ipv4Bytes(ip) ?? ipv6Bytes(ip);
}

/** Адрес или сеть: '37.252.64.10', '37.252.64.0/24', '2a00:cc0:1:2::/64' (как isValidIpRange сервера) */
export function isValidIpRange(range: string): boolean {
  const parts = range.trim().split('/');
  if (parts.length > 2) return false;
  const bytes = ipBytes(parts[0]);
  if (!bytes) return false;
  if (parts.length === 1) return true;
  return /^\d{1,3}$/.test(parts[1]) && Number(parts[1]) <= bytes.length * 8;
}

/** Адрес внутри сети: первые N бит совпадают (без /N — точное совпадение) */
function inRange(ip: number[], range: string): boolean {
  const [base, prefixStr] = range.trim().split('/');
  const net = ipBytes(base);
  if (!net || net.length !== ip.length) return false;
  const bits = prefixStr === undefined ? net.length * 8 : Number(prefixStr);
  for (let i = 0; i < net.length; i++) {
    const take = Math.max(0, Math.min(8, bits - i * 8));
    if (take === 0) break;
    const mask = (0xff << (8 - take)) & 0xff;
    if ((net[i] & mask) !== (ip[i] & mask)) return false;
  }
  return true;
}

/** Пускает ли список салона этот адрес; пустой список — закрыто для всех адресов; ошибочные строки пропускаются */
export function ipAllowedBy(ranges: readonly string[], rawIp: string): boolean {
  const ip = ipBytes(rawIp);
  if (!ip) return false;
  return ranges.some((r) => isValidIpRange(r) && inRange(ip, r));
}

/**
 * Что добавить по кнопке «Добавить этот адрес»: IPv4 — сам адрес; IPv6 — его сеть /64 (последние 64 бита адреса
 * телефон и ноутбук меняют каждый день, сеть салона — одна). '2a00:cc0:1:2:a:b:c:d' → '2a00:cc0:1:2::/64'
 */
export function salonAddressFor(rawIp: string): string | null {
  const ip = normalizeIp(rawIp);
  if (ipv4Bytes(ip)) return ip;
  const b = ipv6Bytes(ip);
  if (!b) return null;
  const groups = [0, 1, 2, 3].map((i) => ((b[i * 2] << 8) | b[i * 2 + 1]).toString(16));
  return `${groups.join(':')}::/64`;
}

// ─────────────────────────── 8 шаблонов ролей (F-10-053…064) ───────────────────────────

export type StaffRoleTemplateId =
  | "systemManager"
  | "viewer"
  | "specialist"
  | "admin"
  | "callCenter"
  | "accountant"
  | "manager"
  | "owner";

export interface StaffRoleTemplateDef {
  id: StaffRoleTemplateId;
  /** Ключ messages/staff.json → roleTemplates.<id>.title / .description */
  titleKey: StaffRoleTemplateId;
  /** Наш базовый уровень прав (F-00-037/039): владелец/администратор/мастер */
  baseRole: StaffRole;
  /** Бесплатная роль по умолчанию, пока нет графика и прав на изменение (F-10-053/055/056) */
  freeByDefault: boolean;
}

/** Порядок — как в кабинете (F-10-053) */
export const ROLE_TEMPLATES: StaffRoleTemplateDef[] = [
  { id: "systemManager", titleKey: "systemManager", baseRole: "admin", freeByDefault: true },
  { id: "viewer", titleKey: "viewer", baseRole: "admin", freeByDefault: true },
  { id: "specialist", titleKey: "specialist", baseRole: "master", freeByDefault: false },
  { id: "admin", titleKey: "admin", baseRole: "admin", freeByDefault: false },
  { id: "callCenter", titleKey: "callCenter", baseRole: "admin", freeByDefault: false },
  { id: "accountant", titleKey: "accountant", baseRole: "admin", freeByDefault: false },
  { id: "manager", titleKey: "manager", baseRole: "admin", freeByDefault: false },
  { id: "owner", titleKey: "owner", baseRole: "owner", freeByDefault: false },
];

export function roleTemplate(id: StaffRoleTemplateId | undefined): StaffRoleTemplateDef {
  return ROLE_TEMPLATES.find((r) => r.id === id) ?? ROLE_TEMPLATES[2];
}

/**
 * Название шаблона роли в текстах кабинета (F-10-151, ⭐ по нашему решению): роль «Специалист» называется
 * словом сферы салона («мастер» / «врач» / «тренер»), остальные роли — как в messages/staff.json.
 * `masterTerm` — `useTerms().master` из `@/demo/hooks` (не импортируем хук сюда — типы раздела не «use client»).
 */
export function roleTemplateLabel(
  id: StaffRoleTemplateId,
  translatedTitle: string,
  masterTerm: string,
): string {
  if (id === "specialist" && masterTerm) {
    return masterTerm.charAt(0).toUpperCase() + masterTerm.slice(1);
  }
  return translatedTitle;
}

/** Роль-шаблон по умолчанию для приглашения (F-10-019: «Специалист» по умолчанию) */
export function defaultRoleTemplateFor(role: StaffRole): StaffRoleTemplateId {
  if (role === "owner") return "owner";
  if (role === "admin") return "admin";
  return "specialist";
}

/** Роли, которые можно выдать сотруднику с ролью core `admin` (F-10-053: остальные — мастеру или владельцу) */
export const ADMIN_ROLE_TEMPLATES: StaffRoleTemplateId[] = [
  "systemManager",
  "viewer",
  "admin",
  "callCenter",
  "accountant",
  "manager",
];

// ─────────────────────────── Слово подтверждения (⭐ F-00-061, F-10-155) ───────────────────────────

/** Удаление сотрудника (F-10-041, F-10-155) — одно и то же слово во всех разделах (наше решение) */
export const DELETE_CONFIRM_WORD = "DELETE";

// ─────────────────────────── Увольнение и удаление (F-10-040…045) ───────────────────────────

export interface StaffDismissal {
  staffId: Id;
  date: ISODate;
  reason: string;
  /** Когда увольнение вступило в силу; нет — ещё запланировано на `date` (С3: дата в будущем) */
  firedAt?: ISODate;
  /** Запланировано: до `date` сотрудник работает и остаётся в графике */
  scheduled?: boolean;
}

/** Что сделать с будущей записью увольняемого (С3): передать другому, отменить с уведомлением клиента или оставить */
export type FutureBookingDecision =
  | { bookingId: Id; action: "reassign"; toStaffId: Id }
  | { bookingId: Id; action: "cancel" }
  | { bookingId: Id; action: "keep" };

export interface StaffDismissInput {
  date: ISODate;
  reason: string;
}

/** Снимок удалённого сотрудника — хранится в срезе staff, чтобы восстановление (F-10-044) не требовало core */
export interface DeletedStaffSnapshot {
  id: Id;
  businessId: Id;
  snapshot: Staff;
  access?: StaffAccessInfo;
  deletedAt: ISODate;
}

export type RestoreWindow = "immediate" | "blocked" | "available";

/**
 * Правило восстановления (F-10-044): первые 24 часа — можно сразу; дальше заблокировано до 30 дней с
 * момента увольнения/удаления, затем снова можно.
 */
export function restoreWindowFromDates(since: Date, now: Date): RestoreWindow {
  const hours = (now.getTime() - since.getTime()) / 36e5;
  if (hours <= 24) return "immediate";
  if (hours <= 24 * 30) return "blocked";
  return "available";
}

/** Текущее состояние восстановления по ISO-моменту увольнения/удаления, «сейчас» — по Еревану */
export function staffRestoreWindow(sinceISODateTime: ISODate): RestoreWindow {
  return restoreWindowFromDates(
    parse(sinceISODateTime).toDate(),
    nowYerevan().toDate(),
  );
}

// ─────────────────────────── Редактор прав: значение «▾» у строки (F-10-071) ───────────────────────────

export type RightScopePeriod = "always" | "today" | "week" | "month";
export type RightScopeTarget = "all" | "selected";

/** Ограничение конкретной строки прав по периоду и по кругу сотрудников/должностей — своя надстройка над правом */
export interface RightScope {
  period: RightScopePeriod;
  target: RightScopeTarget;
  /** Имена сотрудников/должностей, когда target === 'selected' (F-10-071: «всех / выбранных») */
  selectedLabels: string[];
}

export function defaultRightScope(): RightScope {
  return { period: "always", target: "all", selectedLabels: [] };
}

// ─────────────────────────── Журнал выгрузок (F-10-102, F-10-103) ───────────────────────────

export type StaffExportReportType =
  | "clients"
  | "bookings"
  | "loyaltyCards"
  | "memberships"
  | "deposits"
  | "certificates"
  | "staffReport"
  | "customReport";
export type StaffExportOperationType = "fileUpload" | "excelCopy" | "emailLink" | "browserDownload";

export interface StaffExportEntry {
  id: Id;
  businessId: Id;
  actorStaffId?: Id;
  actorLabel: string;
  reportType: StaffExportReportType;
  isImport: boolean;
  operationType: StaffExportOperationType;
  at: ISODate;
}

export interface StaffExportFilter {
  businessId: Id;
  actorStaffId?: Id;
  reportType?: StaffExportReportType;
  operationType?: StaffExportOperationType;
}

// ─────────────────────────── Журнал входов (F-10-106) ───────────────────────────

export interface StaffLoginEntry {
  id: Id;
  businessId: Id;
  staffId: Id;
  staffLabel: string;
  at: ISODate;
  device: string;
  ip: string;
  newDevice: boolean;
}

// ─────────────────────────── Настройки безопасности бизнеса (⭐ F-00-047) ───────────────────────────

export interface StaffBusinessSecuritySettings {
  /** Запретить мастерам домашние записи в часы своей смены в салоне */
  blockHomeVisitDuringShift: boolean;
}

export function emptyBusinessSecuritySettings(): StaffBusinessSecuritySettings {
  return { blockHomeVisitDuringShift: false };
}

// ─────────────────────────── Передача владения (F-10-149) ───────────────────────────

/** Слово подтверждения для передачи роли «Владелец» другому сотруднику — необратимо для передающего */
export const TRANSFER_OWNER_CONFIRM_WORD = "OWNER";
