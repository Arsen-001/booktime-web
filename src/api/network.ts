"use client";

/**
 * API раздела «network». Принадлежит разделу.
 *
 * Сеть и филиалы — сущности ЯДРА (Network/Business/Location в core.ts): чтение — через readCore() внутри
 * request(), запись — через coreCreate/coreUpdate (generic CRUD ядра, arch-a1). То, чего в ядре ещё нет
 * (порядок филиалов, мягкое удаление сети, срок подписки филиала, пользователи/планы/подразделения/
 * телефония сети) — в своём срезе src/mock/slices/network.ts, см. qa/requests/network.md.
 */
import type {
  Booking,
  Business,
  Client,
  Id,
  ISODate,
  ISODateTime,
  LocalizedText,
  Location,
  Network,
  Service,
  ServiceCategory,
  Staff,
} from "@/domain/core";
import type {
  NetworkAnalyticsSettings,
  NetworkAuditAction,
  NetworkAuditEntry,
  NetworkBroadcastLogEntry,
  NetworkExportLogEntry,
  NetworkGoodsArchiveEntry,
  NetworkGoodsCategory,
  NetworkImportanceClass,
  NetworkOffDayType,
  NetworkPayrollRun,
  NetworkPermissionKey,
  NetworkPlanCell,
  NetworkPlanKind,
  NetworkPosition,
  NetworkSubdivision,
  NetworkUser,
} from "@/domain/network";
import type { LogMessage } from "@/domain/notify";
import type { Good } from "@/domain/stock";
import * as Server from "@/api/network.server";
import * as SettingsServer from "@/api/settings.server";
import {
  coreCreate,
  coreRemove,
  coreTx,
  coreUpdate,
  currentActor,
  listBookings,
} from "@/api/core";
import { mutateArea, readArea, readCore } from "@/api/area";
import { createSettlementSheet } from "@/api/finance";
import { ApiError, getQueryClient, request } from "@/api/request";
import { http, isApiMode } from "@/api/http";
import { mirrorCore, syncCore } from "@/api/mirror";
import { SESSION_KEY } from "@/api/session";
import { addDays, datePart, nowDateTime, today } from "@/lib/date";
import { newId } from "@/lib/id";
import * as stockApi from "@/api/stock";
import { occupiesTime } from "@/domain/rules/booking-status";

export const ALL_NETWORK_PERMISSIONS: NetworkPermissionKey[] = [
  "settings",
  "users",
  "clients",
  "records",
  "staff",
  "services",
  "goods",
  "loyalty",
  "accounts",
  "telephony",
  "plans",
  "analytics",
  "fields",
  "subdivisions",
  "migrations",
  "payroll",
];

/**
 * Сеть1: чтение и запись кабинета сети — только с правом network.manage и только своей сети (бизнес или сотрудник
 * вошедшего входит в неё). Раньше по прямому адресу/id админ чужого салона видел чужую сеть целиком.
 */
function assertNetworkAccess(networkId: Id, sections?: NetworkPermissionKey[]): void {
  const actor = currentActor();
  // 01.10.2026: пользователь сети (добавлен в «Пользователи» по телефону) тоже входит в кабинет сети — с её правами
  if (!actor.permissions.has("network.manage")) {
    const row = networkMemberRow(networkId, actor.staffId);
    if (!row) throw new ApiError("forbidden", "Нет права network.manage");
    if (sections?.length && !row.isOwner && !sections.some((k) => row.permissions.includes(k)))
      throw new ApiError("forbidden", `Нет права сети: ${sections.join(" / ")}`);
    return;
  }
  const network = readCore().networks.find((n) => n.id === networkId);
  if (!network) return; // «нет такой сети» — ответит сама функция (not_found)
  const mine =
    network.ownerStaffId === actor.staffId ||
    (actor.businessId !== undefined && network.businessIds.includes(actor.businessId));
  if (!mine) throw new ApiError("forbidden", "Чужая сеть");
}

function netRequest<T>(networkId: Id, fn: () => T | Promise<T>): Promise<T> {
  return request(() => {
    assertNetworkAccess(networkId);
    return fn();
  });
}

/**
 * 01.10.2026: то же, что netRequest, плюс право раздела сети (F-11-029…035) — как useNetworkAccess на экране:
 * пользователю сети с одной галочкой «Клиенты» аналитика и настройки отвечают forbidden, а не только скрыты.
 */
function netRequestIn<T>(
  section: NetworkPermissionKey | NetworkPermissionKey[],
  networkId: Id,
  fn: () => T | Promise<T>,
): Promise<T> {
  return request(() => {
    assertNetworkAccess(networkId, Array.isArray(section) ? section : [section]);
    return fn();
  });
}

/** Строка «Пользователи» сети для сотрудника: связь по телефону (приглашают по номеру, F-11-025) */
function networkMemberRow(networkId: Id, staffId: Id | undefined): NetworkUser | undefined {
  if (!staffId) return undefined;
  const phone = readCore().staff.find((st) => st.id === staffId)?.phone;
  if (!phone) return undefined;
  return readArea("network").users.find((u) => u.networkId === networkId && u.phone === phone);
}

export interface MyNetworkAccess {
  /** Может войти в кабинет сети: владелец (network.manage) или пользователь сети */
  member: boolean;
  /** Права в сети (F-11-029…035); у владельца — все */
  permissions: NetworkPermissionKey[];
}

/**
 * 01.10.2026 (решение владельца): права пользователя сети реально режут меню и экраны кабинета сети.
 * Владелец / network.manage — все права; пользователь сети — права своей строки по сетям, куда входит его бизнес.
 */
export function getMyNetworkAccess(staffId: Id | undefined, businessId: Id | undefined, canManage: boolean): Promise<MyNetworkAccess> {
  if (canManage) return Promise.resolve({ member: true, permissions: ALL_NETWORK_PERMISSIONS });
  if (isApiMode()) {
    if (!businessId) return Promise.resolve({ member: false, permissions: [] });
    return Server.getMyNetworkAccess(businessId).then((a) => ({ member: a.member, permissions: a.permissions }));
  }
  return request(() => {
    const networks = readCore().networks.filter(
      (n) => !isDeleted(n.id) && (!businessId || n.businessIds.includes(businessId)),
    );
    const rows = networks
      .map((n) => networkMemberRow(n.id, staffId))
      .filter((u): u is NetworkUser => Boolean(u));
    if (!rows.length) return { member: false, permissions: [] };
    if (rows.some((u) => u.isOwner)) return { member: true, permissions: ALL_NETWORK_PERMISSIONS };
    return { member: true, permissions: [...new Set(rows.flatMap((u) => u.permissions))] };
  });
}

function isDeleted(networkId: Id): boolean {
  return Boolean(readArea("network").extras[networkId]?.deletedAt);
}

function orderOf(networkId: Id, businessIds: Id[]): Id[] {
  const saved = readArea("network").extras[networkId]?.order ?? [];
  const known = saved.filter((id) => businessIds.includes(id));
  const missing = businessIds.filter((id) => !known.includes(id));
  return [...known, ...missing];
}

/** F-11-023: своя копия журнала «Изменения данных» — фиксирует действия с сетью, автор — текущий актор */
function pushAudit(
  networkId: Id,
  action: NetworkAuditAction,
  detail?: string,
): void {
  const staffId = currentActor().staffId;
  const authorName =
    (staffId && readCore().staff.find((s) => s.id === staffId)?.name) ||
    "Владелец";
  mutateArea("network", (s) => {
    const entry: NetworkAuditEntry = {
      id: newId("net-audit"),
      networkId,
      action,
      authorName,
      at: nowDateTime(),
      detail,
    };
    s.auditLog = [entry, ...s.auditLog].slice(0, 200);
  });
}

/** F-11-023: журнал «Изменения данных» сети, новые сверху */
export function listNetworkAuditLog(networkId: Id): Promise<NetworkAuditEntry[]> {
  if (isApiMode()) return Server.listNetworkAuditLog(networkId);
  return netRequestIn("settings", networkId, () =>
    readArea("network")
      .auditLog.filter((e) => e.networkId === networkId)
      .sort((a, b) => b.at.localeCompare(a.at)),
  );
}

// ─────────────────────────── Устройство сети (F-11-001…F-11-021) ───────────────────────────

/**
 * 01.10.2026: одновременные ensureNetwork одного бизнеса (каркас, шлюз и экран сети читают её параллельно) заводили
 * ДВЕ сети салона — пользователи сети попадали в одну, а ядро видело другую. Создание — одно на бизнес за раз.
 */
const ensuring = new Map<Id, Promise<unknown>>();

/** Сеть текущего бизнеса; у одиночного салона создаётся сама, из одной локации (F-11-001, F-11-006) */
export function ensureNetwork(businessId: Id, networkId?: Id): Promise<Network> {
  // По очереди на бизнес: второй вызов ждёт первый и уже находит созданную им сеть
  const prev = ensuring.get(businessId) ?? Promise.resolve();
  const p = prev.catch(() => undefined).then(() => ensureNetworkOnce(businessId, networkId));
  ensuring.set(businessId, p);
  void p.catch(() => undefined).finally(() => {
    if (ensuring.get(businessId) === p) ensuring.delete(businessId);
  });
  return p;
}

async function ensureNetworkOnce(
  businessId: Id,
  networkId?: Id,
): Promise<Network> {
  const found = await request(() => {
    const core = readCore();
    // Выбранная сеть — только если текущий бизнес в неё входит (выбор из другой персоны не подхватываем)
    const picked = networkId
      ? core.networks.find((x) => x.id === networkId && x.businessIds.includes(businessId))
      : undefined;
    if (picked && !isDeleted(picked.id)) return picked;
    const live = core.networks.find(
      (n) => n.businessIds.includes(businessId) && !isDeleted(n.id),
    );
    if (live) return live;
    // Решение владельца 01.10.2026: удалённую сеть НЕ подменяем новой — возвращаем её, экран сети
    // предлагает «Восстановить сеть» или «Создать сеть» (isNetworkDeleted), новая сама не заводится
    return (
      picked ??
      core.networks.find((n) => n.businessIds.includes(businessId) && isDeleted(n.id))
    );
  });
  if (found) return found;
  // Сеть1: сеть заводит себе только тот, у кого есть network.manage (владелец) — админу чужого салона
  // «сеть» больше не создаётся сама по заходу на /biz/network
  const business = await request(() => {
    const b = readCore().businesses.find((x) => x.id === businessId);
    if (!b) throw new ApiError("not_found");
    return b;
  }, { permission: "network.manage" });
  // Живой сайт: сеть одиночного салона тоже заводит сервер (F-11-006) — id сети должен быть серверным
  if (isApiMode())
    return createNetwork({
      name: business.name,
      businessIds: [businessId],
      mainBusinessId: businessId,
      ownerStaffId: business.ownerStaffId,
    });
  const created = await coreCreate("networks", {
    name: business.name,
    ownerStaffId: business.ownerStaffId,
    businessIds: [businessId],
    createdAt: nowDateTime(),
    mainBusinessId: businessId,
  });
  await request(() =>
    mutateArea("network", (s) => {
      s.extras[created.id] = { order: [businessId] };
      s.telephony[created.id] = {
        networkId: created.id,
        token: `NET-${created.id.toUpperCase()}-TOKEN`,
        connected: false,
      };
      if (!s.users.some((u) => u.networkId === created.id)) {
        // Имя строки владельца в «Пользователях» сети — это ЧЕЛОВЕК (владелец), не название бизнеса (F-11-024)
        const owner = readCore().staff.find(
          (st) => st.id === business.ownerStaffId,
        );
        s.users.push({
          id: newId("net-user"),
          networkId: created.id,
          name: owner?.name ?? business.name,
          phone: owner?.phone ?? business.phone,
          permissions: ALL_NETWORK_PERMISSIONS,
          lastVisitAt: nowDateTime(),
          isOwner: true,
        });
      }
    }),
  );
  return created;
}

/**
 * Список «Сети»: без staffId — сети, куда входит бизнес (окно записи локации, F-11-052); со staffId — сети, где
 * человек владелец или пользователь сети (переключатель, F-11-002/F-11-005: «вас не добавили» — если нигде).
 * Пользователь сети связан с сотрудником по телефону (приглашают по номеру, F-11-025).
 */
export function listMyNetworks(businessId?: Id, staffId?: Id): Promise<Network[]> {
  if (isApiMode()) return businessId ? Server.listMyNetworks(businessId) : Promise.resolve([]);
  return request(() => {
    const core = readCore();
    if (staffId) {
      const phone = core.staff.find((st) => st.id === staffId)?.phone;
      const users = readArea("network").users;
      return core.networks
        .filter(
          (n) =>
            !isDeleted(n.id) &&
            (n.ownerStaffId === staffId ||
              (phone !== undefined && users.some((u) => u.networkId === n.id && u.phone === phone))),
        )
        .sort((a, b) => a.name.localeCompare(b.name));
    }
    if (!businessId) return [];
    return core.networks
      .filter(
        (n) => n.businessIds.includes(businessId) && !isDeleted(n.id),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  });
}

/** Список «Филиалы» переключателя: все свои локации со сроком подписки (F-11-002) */
export function listMyBranches(
  ownerStaffId?: Id,
  businessIds?: Id[],
): Promise<{ business: Business; until?: ISODate }[]> {
  if (isApiMode()) {
    // Этап 21 (сдача): бизнесы — зеркало сервера (снимок своих бизнесов), срок — подписка каждого с сервера
    const own = readCore().businesses.filter((b) => b.status !== "draft" && (b.ownerStaffId === ownerStaffId || businessIds?.includes(b.id)));
    return Promise.all(
      own.map((business) =>
        SettingsServer.getSubscription(business.id)
          .then((sub) => ({ business, until: sub.paidUntil }))
          .catch(() => ({ business, until: undefined })),
      ),
    );
  }
  return request(() => {
    const core = readCore();
    const own = core.businesses.filter(
      (b) =>
        b.status !== "draft" &&
        (b.ownerStaffId === ownerStaffId || businessIds?.includes(b.id)),
    );
    const subs = readArea("network").subscriptions;
    return own.map((business) => ({
      business,
      until: subs.find((s) => s.businessId === business.id)?.until,
    }));
  });
}

export function getNetwork(networkId: Id): Promise<Network> {
  if (isApiMode()) return Server.getNetwork(networkId);
  return netRequest(networkId, () => {
    const n = readCore().networks.find((x) => x.id === networkId);
    if (!n) throw new ApiError("not_found");
    return n;
  });
}

// ─────────── живой сайт: устройство сети на сервере (docs/backend/PLAN.md этап 3, 02 §15) ───────────
// Порядок филиалов, телефония, пользователи сети и прочее — пока в срезе network (этап 15).

type ServerNetwork = Network & { deleted: boolean };

/** После правки сети на сервере: сеть и её бизнесы — в ядро браузера, «кто я» (роль «сеть») — перечитать */
async function afterNetworkWrite(n: ServerNetwork, alsoBusinessIds: Id[] = []): Promise<Network> {
  const { deleted: _deleted, ...network } = n;
  mirrorCore({ networks: [network] });
  const first = n.businessIds[0] ?? alsoBusinessIds[0];
  if (first) await syncCore(first).catch(() => undefined);
  await getQueryClient().invalidateQueries({ queryKey: SESSION_KEY });
  return network;
}

export async function createNetwork(input: {
  name: string;
  businessIds: Id[];
  mainBusinessId?: Id;
  ownerStaffId: Id;
}): Promise<Network> {
  const name = input.name.trim();
  if (!name) throw new ApiError("validation", "name required");
  if (input.businessIds.length === 0)
    throw new ApiError("validation", "businessIds required");
  // Живой сайт: сеть создаёт сервер (роль «сеть» у владельца), срез раздела заводится так же, как в демо
  const created = isApiMode()
    ? await afterNetworkWrite(
        await http<ServerNetwork>("POST", "/v1/net", {
          name,
          businessIds: input.businessIds,
          mainBusinessId: input.mainBusinessId,
        }),
      )
    : await coreCreate("networks", {
        name,
        ownerStaffId: input.ownerStaffId,
        businessIds: input.businessIds,
        createdAt: nowDateTime(),
        mainBusinessId: input.mainBusinessId ?? input.businessIds[0],
      });
  await request(() =>
    mutateArea("network", (s) => {
      s.extras[created.id] = { order: input.businessIds };
      s.telephony[created.id] = {
        networkId: created.id,
        token: `NET-${created.id.toUpperCase()}-TOKEN`,
        connected: false,
      };
      s.users.push({
        id: newId("net-user"),
        networkId: created.id,
        name:
          readCore().staff.find((st) => st.id === input.ownerStaffId)?.name ??
          "Владелец",
        permissions: ALL_NETWORK_PERMISSIONS,
        lastVisitAt: nowDateTime(),
        isOwner: true,
      });
    }),
  );
  pushAudit(created.id, "created", name);
  return created;
}

export async function renameNetwork(networkId: Id, name: string): Promise<Network> {
  const trimmed = name.trim();
  if (!trimmed) throw new ApiError("validation", "name required");
  if (isApiMode())
    return afterNetworkWrite(await http<ServerNetwork>("PATCH", `/v1/net/${networkId}`, { name: trimmed }));
  await netRequestIn("settings", networkId, () => undefined);
  const updated = await coreUpdate("networks", networkId, { name: trimmed });
  pushAudit(networkId, "renamed", trimmed);
  return updated;
}

export interface NetworkLocationRow {
  business: Business;
  location?: Location;
  isMain: boolean;
  until?: ISODate;
}

/** Список «Локации» настроек сети, в сохранённом порядке (F-11-016) */
export function listNetworkLocations(
  networkId: Id,
): Promise<NetworkLocationRow[]> {
  if (isApiMode()) return Server.listNetworkLocations(networkId);
  return netRequest(networkId, () => {
    const core = readCore();
    const network = core.networks.find((n) => n.id === networkId);
    if (!network) throw new ApiError("not_found");
    const order = orderOf(networkId, network.businessIds);
    const subs = readArea("network").subscriptions;
    return order
      .map((businessId) => core.businesses.find((b) => b.id === businessId))
      .filter((b): b is Business => Boolean(b))
      .map((business) => ({
        business,
        location: core.locations.find((l) => l.businessId === business.id),
        isMain:
          (network.mainBusinessId ?? network.businessIds[0]) === business.id,
        until: subs.find((s) => s.businessId === business.id)?.until,
      }));
  });
}

/** Свои локации, ещё не в этой сети — для «Добавить» (F-11-014, F-11-016) */
export function listAddableLocations(
  networkId: Id | undefined,
  ownerStaffId?: Id,
): Promise<Business[]> {
  if (isApiMode())
    // Этап 21 (лейн network): ядро браузера в api-режиме уже зеркалит Business/Network с сервера (afterNetworkWrite,
    // syncCore) — тот же читатель, что мок-ветка ниже, отмечен явно ради аудита фасадов.
    return request(() => {
      const core = readCore();
      const network = networkId
        ? core.networks.find((n) => n.id === networkId)
        : undefined;
      const already = new Set(network?.businessIds ?? []);
      return core.businesses.filter(
        (b) =>
          b.status !== "draft" &&
          b.ownerStaffId === ownerStaffId &&
          !already.has(b.id),
      );
    });
  return request(() => {
    const core = readCore();
    const network = networkId
      ? core.networks.find((n) => n.id === networkId)
      : undefined;
    const already = new Set(network?.businessIds ?? []);
    return core.businesses.filter(
      (b) =>
        b.status !== "draft" &&
        b.ownerStaffId === ownerStaffId &&
        !already.has(b.id),
    );
  });
}

export async function addLocationToNetwork(
  networkId: Id,
  businessId: Id,
): Promise<void> {
  if (isApiMode()) {
    await afterNetworkWrite(await http<ServerNetwork>("POST", `/v1/net/${networkId}/businesses`, { businessId }));
    await request(() =>
      mutateArea("network", (s) => {
        const extras = (s.extras[networkId] ??= { order: [] });
        if (!extras.order.includes(businessId)) extras.order = [...extras.order, businessId];
      }),
    );
    return;
  }
  const network = await getNetwork(networkId);
  if (network.businessIds.includes(businessId)) return;
  await coreUpdate("networks", networkId, {
    businessIds: [...network.businessIds, businessId],
  });
  await request(() =>
    mutateArea("network", (s) => {
      const extras = (s.extras[networkId] ??= { order: [] });
      extras.order = [...extras.order, businessId];
    }),
  );
}

/** Выход локации из сети (F-11-013): пропадает из сетевых отчётов, счета клиентов и история остаются */
export async function removeLocationFromNetwork(
  networkId: Id,
  businessId: Id,
): Promise<void> {
  if (isApiMode()) {
    await afterNetworkWrite(await http<ServerNetwork>("DELETE", `/v1/net/${networkId}/businesses/${businessId}`), [businessId]);
    await syncCore(businessId).catch(() => undefined);
    return;
  }
  const network = await getNetwork(networkId);
  const nextIds = network.businessIds.filter((id) => id !== businessId);
  const patch: Partial<Network> = { businessIds: nextIds };
  if (network.mainBusinessId === businessId) patch.mainBusinessId = nextIds[0];
  await coreUpdate("networks", networkId, patch);
  await request(() =>
    mutateArea("network", (s) => {
      const extras = s.extras[networkId];
      if (extras) extras.order = extras.order.filter((id) => id !== businessId);
    }),
  );
}

export async function reorderNetworkLocations(
  networkId: Id,
  orderedBusinessIds: Id[],
): Promise<void> {
  if (isApiMode()) {
    await Server.reorderNetworkLocations(networkId, orderedBusinessIds);
    return;
  }
  await request(() =>
    mutateArea("network", (s) => {
      (s.extras[networkId] ??= { order: [] }).order = orderedBusinessIds;
    }),
  );
}

/** Главной становится только первая строка списка (F-11-017) */
export async function setMainLocation(
  networkId: Id,
  businessId: Id,
): Promise<void> {
  if (isApiMode()) {
    const rows = await Server.listNetworkLocations(networkId);
    if (rows[0]?.business.id !== businessId)
      throw new ApiError("validation", "must_be_first");
    await afterNetworkWrite(await http<ServerNetwork>("PATCH", `/v1/net/${networkId}`, { mainBusinessId: businessId }));
    return;
  }
  const order = readOrderSnapshot(networkId);
  if (order[0] !== businessId)
    throw new ApiError("validation", "must_be_first");
  await coreUpdate("networks", networkId, { mainBusinessId: businessId });
}

function readOrderSnapshot(networkId: Id): Id[] {
  return readArea("network").extras[networkId]?.order ?? [];
}

export async function softDeleteNetwork(networkId: Id): Promise<void> {
  // Сервер закрывает роль «сеть» сразу; отметка удаления в срезе остаётся для экранов сети (этап 15)
  if (isApiMode()) await afterNetworkWrite(await http<ServerNetwork>("DELETE", `/v1/net/${networkId}`));
  return netRequestIn("settings", networkId, () => {
    mutateArea("network", (s) => {
      (s.extras[networkId] ??= { order: [] }).deletedAt = nowDateTime();
    });
    pushAudit(networkId, "deleted");
  });
}

export async function restoreNetwork(networkId: Id): Promise<void> {
  if (isApiMode()) await afterNetworkWrite(await http<ServerNetwork>("POST", `/v1/net/${networkId}/restore`));
  return netRequestIn("settings", networkId, () => {
    const core = readCore();
    if (!core.networks.some((n) => n.id === networkId))
      throw new ApiError("not_found");
    mutateArea("network", (s) => {
      if (s.extras[networkId]) s.extras[networkId].deletedAt = undefined;
    });
    pushAudit(networkId, "restored");
  });
}

export function isNetworkDeleted(networkId: Id): Promise<boolean> {
  if (isApiMode()) return http<ServerNetwork>("GET", `/v1/net/${networkId}`).then((n) => n.deleted);
  return request(() => isDeleted(networkId));
}

// ─────────────────────────── Номер локации, лицензия, удаление (F-11-007, F-11-011, F-11-012) ───────────────────────────

/**
 * ⭐ по нашему решению: каждый филиал платит 4 000 ֏ × наибольшее из (мастеров, 2) — F-00-013/049, F-11-012.
 * Неоплата одного филиала не морозит другой (F-00-017) — считаем по каждому филиалу отдельно, суммы не связаны.
 */
export const LOCATION_LICENSE_UNIT_PRICE = 4000;

export interface NetworkLicenseRow {
  businessId: Id;
  businessName: string;
  /** F-11-007: номер локации — тот же id, что виден в адресе страниц раздела */
  locationNumber: string;
  mastersCount: number;
  monthly: number;
}

/** F-11-012: лицензия по каждому филиалу сети отдельно — сумма и число мастеров, взятых в расчёт */
export function getNetworkLicenseSummary(networkId: Id): Promise<NetworkLicenseRow[]> {
  if (isApiMode()) {
    // Этап 21 (сдача): филиалы в сохранённом порядке — сервер; мастера — зеркало сотрудников своих бизнесов
    return Server.listNetworkLocations(networkId).then((rows) => {
      const staff = readCore().staff;
      return rows.map(({ business }) => {
        const mastersCount = staff.filter((s) => s.businessId === business.id && s.role === "master" && s.status !== "fired").length;
        return { businessId: business.id, businessName: business.name, locationNumber: business.id, mastersCount, monthly: LOCATION_LICENSE_UNIT_PRICE * Math.max(mastersCount, 2) };
      });
    });
  }
  return netRequestIn("settings", networkId, () => {
    const core = readCore();
    const network = core.networks.find((n) => n.id === networkId);
    if (!network) throw new ApiError("not_found");
    return orderOf(networkId, network.businessIds)
      .map((businessId) => core.businesses.find((b) => b.id === businessId))
      .filter((b): b is Business => Boolean(b))
      .map((business) => {
        const mastersCount = core.staff.filter(
          (s) =>
            s.businessId === business.id &&
            s.role === "master" &&
            s.status !== "fired",
        ).length;
        return {
          businessId: business.id,
          businessName: business.name,
          locationNumber: business.id,
          mastersCount,
          monthly: LOCATION_LICENSE_UNIT_PRICE * Math.max(mastersCount, 2),
        };
      });
  });
}

/** F-11-011: своей кнопки удаления локации нет — заявка в поддержку; фиксируем факт запроса */
export function requestLocationDeletion(
  networkId: Id,
  businessId: Id,
): Promise<void> {
  if (isApiMode()) return Server.requestLocationDeletion(networkId, businessId);
  return request(() => {
    mutateArea("network", (s) => {
      const extras = (s.extras[networkId] ??= { order: [] });
      (extras.pendingDeletions ??= {})[businessId] = nowDateTime();
    });
  });
}

export function getLocationDeletionRequest(
  networkId: Id,
  businessId: Id,
): Promise<ISODateTime | undefined> {
  if (isApiMode()) return Server.listLocationDeletionRequests(networkId).then((all) => all[businessId]);
  return request(
    () => readArea("network").extras[networkId]?.pendingDeletions?.[businessId],
  );
}

// ─────────────────────────── «Принадлежность к сети» локации (F-11-022) ───────────────────────────

export interface LocationNetworkRow {
  network: Network;
  locationsCount: number;
  isMain: boolean;
}

/** F-11-022: все сети, куда входит локация, и какая из них главная (Business.networkId) */
export function listLocationNetworks(businessId: Id): Promise<LocationNetworkRow[]> {
  if (isApiMode()) {
    // Этап 21 (сдача): у бизнеса на сервере одна сеть (Business.networkId) — она же главная
    return Server.listMyNetworks(businessId).then((networks) => {
      const mainId = readCore().businesses.find((b) => b.id === businessId)?.networkId ?? networks[0]?.id;
      return networks.map((network) => ({ network, locationsCount: network.businessIds.length, isMain: network.id === mainId }));
    });
  }
  return request(() => {
    const core = readCore();
    const business = core.businesses.find((b) => b.id === businessId);
    if (!business) throw new ApiError("not_found");
    const networks = core.networks.filter(
      (n) => n.businessIds.includes(businessId) && !isDeleted(n.id),
    );
    const mainId = business.networkId ?? networks[0]?.id;
    return networks.map((network) => ({
      network,
      locationsCount: network.businessIds.length,
      isMain: network.id === mainId,
    }));
  });
}

/** F-11-022: «принадлежность к сети» — назначить, какая из сетей локации главная */
export function setMainNetworkForLocation(
  businessId: Id,
  networkId: Id,
): Promise<void> {
  if (isApiMode())
    // Этап 21 (лейн network): на сервере Business.networkId — единственное поле (docs/backend 02 §15), у локации
    // не бывает больше одной сети одновременно — «сделать сеть главной» уже верно самим фактом членства;
    // coreUpdate('businesses', …) НЕ ведёт бы на сервер (общий CRUD ядра пишет только в мок для этой коллекции) —
    // действие сводится к проверке, что локация правда состоит в названной сети.
    return netRequestIn("settings", networkId, () => {
      const business = readCore().businesses.find((b) => b.id === businessId);
      if (!business) throw new ApiError("not_found");
      if (business.networkId !== networkId) throw new ApiError("validation", "not_a_member");
    });
  return request(async () => {
    const core = readCore();
    const business = core.businesses.find((b) => b.id === businessId);
    if (!business) throw new ApiError("not_found");
    const network = core.networks.find((n) => n.id === networkId);
    if (!network || !network.businessIds.includes(businessId))
      throw new ApiError("validation", "not_a_member");
    await coreUpdate("businesses", businessId, { networkId });
  });
}

// ─────────────────────────── Пользователи сети (F-11-024) ───────────────────────────

export function listNetworkUsers(networkId: Id): Promise<NetworkUser[]> {
  if (isApiMode()) return Server.listNetworkUsers(networkId);
  return netRequestIn(["users", "telephony"], networkId, () =>
    readArea("network").users.filter((u) => u.networkId === networkId),
  );
}

// ─────────────────────────── Клиенты сети (F-11-040…044, F-11-163, F-11-164) ───────────────────────────

/**
 * Класс важности — не отдельное поле ядра (нет такого поля у Client, b02: assumed, см. qa/requests/network.md).
 * Считаем от суммы трат по сети: ≥100 000 ֏ — золото, ≥30 000 — серебро, >0 — бронза, 0 — без класса.
 */
export function importanceOf(spend: number): NetworkImportanceClass {
  if (spend >= 100_000) return "gold";
  if (spend >= 30_000) return "silver";
  if (spend > 0) return "bronze";
  return "none";
}

export interface NetworkClientRow {
  phone: string;
  name: string;
  email?: string;
  gender: "male" | "female" | "unknown";
  spend: number;
  visitsCount: number;
  lastVisitAt?: string;
  locationsCount: number;
  memberLocationIds: Id[];
  visitedLocationIds: Id[];
  onlineBooked: boolean;
  importance: NetworkImportanceClass;
  smsReceivedAt?: string;
  clientIds: Id[];
}

export interface NetworkClientFilters {
  query?: string;
  sort?: "name" | "spend" | "visits";
  memberLocationIds?: Id[];
  visitedLocationIds?: Id[];
  gender?: "male" | "female" | "unknown";
  onlineOnly?: boolean;
  importance?: NetworkImportanceClass;
  spendMin?: number;
  spendMax?: number;
  visitsMin?: number;
  visitsMax?: number;
  hasBookingsFrom?: ISODate;
  hasBookingsTo?: ISODate;
  noBookingsFrom?: ISODate;
  noBookingsTo?: ISODate;
  smsReceived?: "received" | "notReceived";
  smsFrom?: ISODate;
  smsTo?: ISODate;
}

const ONLINE_BOOKING_SOURCES = new Set(["app", "link", "widget"]);

/** F-11-041/042: считает все строки базы сети без фильтров (для базы под фильтрами и «Показать») */
function computeNetworkClientRows(networkId: Id): NetworkClientRow[] {
  const core = readCore();
  const network = core.networks.find((n) => n.id === networkId);
  if (!network) throw new ApiError("not_found");
  const businessIds = new Set(network.businessIds);
  const clients = core.clients.filter(
    (c) => businessIds.has(c.businessId) && !c.deletedAt,
  );
  const notify = readArea("notify");
  const byPhone = new Map<string, NetworkClientRow>();
  for (const client of clients) {
    const bookings = core.bookings.filter((b) => b.clientId === client.id);
    const arrived = bookings.filter((b) => b.status === "arrived");
    const spend = arrived.reduce((sum, b) => sum + b.total, 0);
    const lastVisitAt = arrived
      .map((b) => b.start)
      .sort()
      .at(-1);
    const onlineBooked = bookings.some((b) =>
      ONLINE_BOOKING_SOURCES.has(b.source),
    );
    const log = notify.log[client.businessId] ?? [];
    const smsReceivedAt = log
      .filter((m) => m.clientId === client.id && m.channel === "sms")
      .map((m) => m.createdAt)
      .sort()
      .at(-1);
    const row = byPhone.get(client.phone);
    if (!row) {
      byPhone.set(client.phone, {
        phone: client.phone,
        name: client.name,
        email: client.email,
        gender: client.gender,
        spend,
        visitsCount: arrived.length,
        lastVisitAt,
        locationsCount: 1,
        memberLocationIds: [client.businessId],
        visitedLocationIds: arrived.length ? [client.businessId] : [],
        onlineBooked,
        importance: importanceOf(spend),
        smsReceivedAt,
        clientIds: [client.id],
      });
    } else {
      row.spend += spend;
      row.visitsCount += arrived.length;
      row.locationsCount += 1;
      row.memberLocationIds.push(client.businessId);
      if (arrived.length) row.visitedLocationIds.push(client.businessId);
      row.onlineBooked = row.onlineBooked || onlineBooked;
      row.importance = importanceOf(row.spend);
      row.clientIds.push(client.id);
      if (
        smsReceivedAt &&
        (!row.smsReceivedAt || smsReceivedAt > row.smsReceivedAt)
      )
        row.smsReceivedAt = smsReceivedAt;
      if (lastVisitAt && (!row.lastVisitAt || lastVisitAt > row.lastVisitAt))
        row.lastVisitAt = lastVisitAt;
    }
  }
  return Array.from(byPhone.values());
}

/** F-11-041: поиск запускается «Показать», не на лету — кнопка живёт в экране, здесь только сам фильтр */
export function listNetworkClients(
  networkId: Id,
  filters: NetworkClientFilters = {},
): Promise<NetworkClientRow[]> {
  if (isApiMode()) return Server.listNetworkClients(networkId, filters);
  return netRequestIn("clients", networkId, () => {
    let rows = computeNetworkClientRows(networkId);
    const q = filters.query?.trim().toLowerCase();
    if (q) {
      const qDigits = q.replace(/\D/g, "");
      rows = rows.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          (qDigits && r.phone.replace(/\D/g, "").includes(qDigits)) ||
          (r.email ?? "").toLowerCase().includes(q),
      );
    }
    if (filters.memberLocationIds?.length) {
      rows = rows.filter((r) =>
        filters.memberLocationIds!.some((id) =>
          r.memberLocationIds.includes(id),
        ),
      );
    }
    if (filters.visitedLocationIds?.length) {
      rows = rows.filter((r) =>
        filters.visitedLocationIds!.some((id) =>
          r.visitedLocationIds.includes(id),
        ),
      );
    }
    if (filters.gender) rows = rows.filter((r) => r.gender === filters.gender);
    if (filters.onlineOnly) rows = rows.filter((r) => r.onlineBooked);
    if (filters.importance)
      rows = rows.filter((r) => r.importance === filters.importance);
    if (filters.spendMin != null)
      rows = rows.filter((r) => r.spend >= filters.spendMin!);
    if (filters.spendMax != null)
      rows = rows.filter((r) => r.spend <= filters.spendMax!);
    if (filters.visitsMin != null)
      rows = rows.filter((r) => r.visitsCount >= filters.visitsMin!);
    if (filters.visitsMax != null)
      rows = rows.filter((r) => r.visitsCount <= filters.visitsMax!);
    if (filters.hasBookingsFrom || filters.hasBookingsTo) {
      rows = rows.filter((r) => {
        const v = r.lastVisitAt ? datePart(r.lastVisitAt) : undefined;
        if (!v) return false;
        if (filters.hasBookingsFrom && v < filters.hasBookingsFrom)
          return false;
        if (filters.hasBookingsTo && v > filters.hasBookingsTo) return false;
        return true;
      });
    }
    if (filters.noBookingsFrom || filters.noBookingsTo) {
      // «Нет записей от—до»: последний визит раньше начала окна (или визитов не было вовсе)
      rows = rows.filter((r) => {
        const v = r.lastVisitAt ? datePart(r.lastVisitAt) : undefined;
        if (!v) return true;
        if (filters.noBookingsFrom && v >= filters.noBookingsFrom) return false;
        return true;
      });
    }
    if (filters.smsReceived === "received") {
      rows = rows.filter((r) => Boolean(r.smsReceivedAt));
      if (filters.smsFrom || filters.smsTo) {
        rows = rows.filter((r) => {
          const v = r.smsReceivedAt ? datePart(r.smsReceivedAt) : undefined;
          if (!v) return false;
          if (filters.smsFrom && v < filters.smsFrom) return false;
          if (filters.smsTo && v > filters.smsTo) return false;
          return true;
        });
      }
    } else if (filters.smsReceived === "notReceived") {
      rows = rows.filter((r) => !r.smsReceivedAt);
    }
    const sort = filters.sort ?? "name";
    rows.sort((a, b) => {
      if (sort === "spend") return b.spend - a.spend;
      if (sort === "visits") return b.visitsCount - a.visitsCount;
      return a.name.localeCompare(b.name, "ru");
    });
    return rows;
  });
}

// ─────────────────────────── Действия над базой сети (F-11-043, F-11-054, F-11-164) ───────────────────────────

/**
 * F-11-054/060/164: SMS/Push рассылка сегмента сети. Одному клиенту нескольких филиалов уходит одно сообщение
 * (аргумент — телефоны, уже склеенные по F-11-041). Реального провайдера нет — фиксируем факт отправки, чтобы
 * тост и история клиента (F-11-048) были честными; текст пишем в LogMessage каждой затронутой локации.
 */
/** F-11-057: цена SMS сетевой рассылки, драм за получателя; push — 0 (F-11-055, бесплатно в Altegio.me) */
export const NETWORK_SMS_UNIT_PRICE = 30;

/** F-11-056: рассылка сети уходит через SMS-провайдера главной локации (Интеграции → Уведомления) */
export function getNetworkSmsChannelStatus(
  networkId: Id,
): Promise<{ connected: boolean; mainBusinessName: string }> {
  if (isApiMode()) return Server.getNetworkSmsStatus(networkId).then(({ connected, mainBusinessName }) => ({ connected, mainBusinessName }));
  return request(() => {
    const core = readCore();
    const network = core.networks.find((n) => n.id === networkId);
    if (!network) throw new ApiError("not_found");
    const mainBusinessId = network.mainBusinessId ?? network.businessIds[0];
    const mainBusinessName =
      core.businesses.find((b) => b.id === mainBusinessId)?.name ?? "—";
    const connected = Boolean(
      readArea("notify").smsSettings[mainBusinessId]?.connected,
    );
    return { connected, mainBusinessName };
  });
}

/** F-11-057: баланс главной локации, с которого списывается оплата сетевых рассылок */
export function getNetworkSmsBalance(networkId: Id): Promise<number> {
  if (isApiMode()) return Server.getNetworkSmsStatus(networkId).then((r) => r.balance);
  return netRequestIn("clients", networkId, () => readArea("network").extras[networkId]?.smsBalance ?? 0);
}

/** F-11-058: список клиентов сети, отказавшихся от рекламных рассылок («Не отправлять») */
export function listNetworkMarketingOptOut(networkId: Id): Promise<string[]> {
  if (isApiMode()) return Server.listNetworkMarketingOptOut(networkId);
  void networkId; // список общий по номеру телефона, сеть не разделяет его (F-00-128)
  return request(() => [...readArea("network").marketingOptOut]);
}

/**
 * Этап 21 (лейн network): подпись без networkId (F-00-128) — в api-режиме сервер узнаёт филиал (и через него
 * сеть) из `currentActor().businessId`, тем же приёмом, что и остальные гейты сети (см. docstring
 * `NetworkCatalogService.setMarketingOptOutByBusiness` на бэкенде).
 */
export function setNetworkMarketingOptOut(
  phone: string,
  optOut: boolean,
): Promise<void> {
  if (isApiMode()) {
    const businessId = currentActor().businessId;
    if (!businessId) return Promise.reject(new ApiError("forbidden"));
    return Server.setNetworkMarketingOptOut(businessId, phone, optOut);
  }
  return request(() => {
    mutateArea("network", (s) => {
      const set = new Set(s.marketingOptOut);
      if (optOut) set.add(phone);
      else set.delete(phone);
      s.marketingOptOut = [...set];
    });
  });
}

export function sendNetworkBroadcast(input: {
  networkId: Id;
  channel: "sms" | "push";
  scope: "selected" | "found";
  phones: string[];
  text: string;
}): Promise<NetworkBroadcastLogEntry> {
  if (isApiMode()) {
    if (!input.text.trim() || !input.phones.length) return Promise.reject(new ApiError("validation"));
    return Server.sendNetworkBroadcast(input);
  }
  return netRequestIn("clients", input.networkId, () => {
    if (!input.text.trim()) throw new ApiError("validation");
    if (!input.phones.length) throw new ApiError("validation");
    const core = readCore();
    const network = core.networks.find((n) => n.id === input.networkId);
    if (!network) throw new ApiError("not_found");

    // F-11-058: клиенты с «Не отправлять» исключены из сетевой рассылки
    const optOut = new Set(readArea("network").marketingOptOut);
    const phones = input.phones.filter((p) => !optOut.has(p));
    const optedOut = input.phones.length - phones.length;

    if (input.channel === "sms") {
      // F-11-056: без подключённого SMS-провайдера главной локации рассылка не уходит
      const mainBusinessId = network.mainBusinessId ?? network.businessIds[0];
      const connected = Boolean(
        readArea("notify").smsSettings[mainBusinessId]?.connected,
      );
      if (!connected) throw new ApiError("validation", "sms_not_connected");
    }

    const phoneSet = new Set(phones);
    const clients = core.clients.filter(
      (c) =>
        network.businessIds.includes(c.businessId) && phoneSet.has(c.phone),
    );

    // F-11-057: тариф и баланс — главной локации; при нехватке рассылка не уходит, статус «Недостаточно средств»
    const cost = input.channel === "sms" ? phones.length * NETWORK_SMS_UNIT_PRICE : 0;
    const balance = readArea("network").extras[input.networkId]?.smsBalance ?? 0;
    const insufficientFunds = input.channel === "sms" && cost > balance;

    let entry: NetworkBroadcastLogEntry | undefined;
    mutateArea("network", (s) => {
      entry = {
        id: newId("netbc"),
        networkId: input.networkId,
        channel: input.channel,
        scope: input.scope,
        recipients: phones.length,
        text: input.text,
        at: nowDateTime(),
        status: insufficientFunds ? "insufficientFunds" : "sent",
        cost,
        optedOut,
      };
      s.broadcastLog = [entry, ...s.broadcastLog].slice(0, 100);
      if (!insufficientFunds && cost > 0) {
        const extras = (s.extras[input.networkId] ??= { order: [] });
        extras.smsBalance = (extras.smsBalance ?? 0) - cost;
      }
    });
    mutateArea("notify", (s) => {
      for (const client of clients) {
        const list =
          s.log[client.businessId] ?? (s.log[client.businessId] = []);
        list.unshift({
          id: newId("log"),
          businessId: client.businessId,
          createdAt: nowDateTime(),
          typeLabel: {
            ru: "Рассылка сети",
            hy: "Ցանցային ուղարկում",
            en: "Network broadcast",
          },
          channel: input.channel === "sms" ? "sms" : "push",
          status: insufficientFunds ? "notDelivered" : "sent",
          contact: client.phone,
          text: { ru: input.text, hy: input.text, en: input.text },
          clientId: client.id,
        });
      }
    });
    return entry!;
  });
}

/** F-11-055 / F-00-114: не больше 3 сетевых пушей в неделю — считаем по своему логу отправок */
export function getNetworkPushWeekCount(networkId: Id): Promise<number> {
  if (isApiMode()) {
    const weekAgo = addDays(today(), -7);
    return Server.listNetworkBroadcastLog(networkId).then((rows) => rows.filter((e) => e.channel === "push" && datePart(e.at) >= weekAgo).length);
  }
  return request(() => {
    const weekAgo = addDays(today(), -7);
    return readArea("network").broadcastLog.filter(
      (e) =>
        e.networkId === networkId &&
        e.channel === "push" &&
        datePart(e.at) >= weekAgo,
    ).length;
  });
}

export function listNetworkBroadcastLog(
  networkId: Id,
): Promise<NetworkBroadcastLogEntry[]> {
  if (isApiMode()) return Server.listNetworkBroadcastLog(networkId);
  return netRequestIn("clients", networkId, () =>
    readArea("network").broadcastLog.filter((e) => e.networkId === networkId),
  );
}

/** F-11-044/076: выгрузка не скачивается — письмо со ссылкой на месяц + строка в журнале выгрузок */
export function exportNetworkClients(input: {
  networkId: Id;
  scope: "found" | "all";
  count: number;
  authorName: string;
  kind?: "clients" | "records" | "staff";
}): Promise<NetworkExportLogEntry> {
  if (isApiMode()) return Server.exportNetworkClients(input);
  return netRequestIn("clients", input.networkId, () => {
    // Сеть11: «вся база» — это все клиенты сети (один человек = один телефон), а не строки текущего поиска
    let count = input.count;
    if (input.scope === "all" && (input.kind ?? "clients") === "clients") {
      const core = readCore();
      const businessIds = core.networks.find((n) => n.id === input.networkId)?.businessIds ?? [];
      count = new Set(
        core.clients.filter((c) => businessIds.includes(c.businessId) && !c.deletedAt).map((c) => c.phone),
      ).size;
    }
    let entry: NetworkExportLogEntry | undefined;
    mutateArea("network", (s) => {
      entry = {
        id: newId("netexp"),
        networkId: input.networkId,
        at: nowDateTime(),
        authorName: input.authorName,
        kind: input.kind ?? "clients",
        count,
        expiresAt: `${addDays(today(), 30)}T00:00`,
      };
      s.exportLog = [entry, ...s.exportLog].slice(0, 100);
    });
    return entry!;
  });
}

export function listNetworkExportLog(
  networkId: Id,
): Promise<NetworkExportLogEntry[]> {
  if (isApiMode()) return Server.listNetworkExportLog(networkId);
  return netRequestIn("clients", networkId, () =>
    readArea("network")
      .exportLog.filter((e) => e.networkId === networkId)
      .sort((a, b) => b.at.localeCompare(a.at)),
  );
}

/**
 * F-11-163: единственная найденная галочка, открывающая клиенту данные по всей сети, — «Доступ к данным
 * клиентов по сети» (F-11-038). У владельца — всегда true. Реальная галочка по сотруднику филиала живёт в
 * правах локации (staff), которых сейчас нет (см. qa/requests/network.md) — пока считаем по членству в
 * NetworkUser сети, как ближайший эквивалент права.
 */
// ─────────────────────────── Карточка клиента сети (F-11-045…050) ───────────────────────────

export interface NetworkClientLocationRow {
  businessId: Id;
  businessName: string;
  clientId: Id;
  category: string;
  discountPct: number;
  spend: number;
}

export interface NetworkClientCard {
  phone: string;
  name: string;
  email?: string;
  gender: "male" | "female" | "unknown";
  birthday?: ISODate;
  byLocation: NetworkClientLocationRow[];
}

/** F-11-045: «Карточка клиента» по локациям — данные показаны отдельно по каждой посещённой локации */
export function getNetworkClientCard(
  networkId: Id,
  phone: string,
): Promise<NetworkClientCard> {
  if (isApiMode()) return Server.getNetworkClientCard(networkId, phone);
  return netRequestIn("clients", networkId, () => {
    const core = readCore();
    const network = core.networks.find((n) => n.id === networkId);
    if (!network) throw new ApiError("not_found");
    const loyalty = readArea("loyalty");
    const clients = core.clients.filter(
      (c) =>
        network.businessIds.includes(c.businessId) &&
        c.phone === phone &&
        !c.deletedAt,
    );
    if (!clients.length) throw new ApiError("not_found");
    const first = clients[0];
    const byLocation: NetworkClientLocationRow[] = clients.map((c) => {
      const arrived = core.bookings.filter(
        (b) => b.clientId === c.id && b.status === "arrived",
      );
      const spend = arrived.reduce((sum, b) => sum + b.total, 0);
      const card = loyalty.cards.find((cc) => cc.clientId === c.id);
      return {
        businessId: c.businessId,
        businessName:
          core.businesses.find((b) => b.id === c.businessId)?.name ?? "—",
        clientId: c.id,
        category: c.tags[0] ?? "—",
        discountPct: card?.maxPercentDiscount ?? 0,
        spend,
      };
    });
    return {
      phone: first.phone,
      name: first.name,
      email: first.email,
      gender: first.gender,
      birthday: first.birthday,
      byLocation,
    };
  });
}

export interface NetworkClientVisit {
  booking: Booking;
  businessId: Id;
  businessName: string;
  serviceNames: string[];
}

/** F-11-047: все записи клиента во всех локациях сети, с названием филиала у каждого визита */
export function getNetworkClientHistory(
  networkId: Id,
  phone: string,
): Promise<NetworkClientVisit[]> {
  if (isApiMode()) return networkId ? Server.getNetworkClientHistory(networkId, phone) : Promise.resolve([]);
  return request(() => {
    const core = readCore();
    const network = core.networks.find((n) => n.id === networkId);
    if (!network) throw new ApiError("not_found");
    const clientIds = new Set(
      core.clients
        .filter(
          (c) =>
            network.businessIds.includes(c.businessId) && c.phone === phone,
        )
        .map((c) => c.id),
    );
    return core.bookings
      .filter((b) => b.clientId && clientIds.has(b.clientId))
      .map((b) => ({
        booking: b,
        businessId: b.businessId,
        businessName:
          core.businesses.find((biz) => biz.id === b.businessId)?.name ?? "—",
        serviceNames: b.services.map(
          (line) =>
            core.services.find((s) => s.id === line.serviceId)?.name.ru ??
            line.serviceId,
        ),
      }))
      .sort((a, b) => b.booking.start.localeCompare(a.booking.start));
  });
}

/** F-11-048: все сообщения клиенту по всем каналам во всех локациях сети (типы, статусы доставки) */
export function getNetworkClientMessages(
  networkId: Id,
  phone: string,
): Promise<
  Array<{ businessId: Id; businessName: string; message: LogMessage }>
> {
  if (isApiMode()) return Server.getNetworkClientMessages(networkId, phone);
  return netRequestIn("clients", networkId, () => {
    const core = readCore();
    const network = core.networks.find((n) => n.id === networkId);
    if (!network) throw new ApiError("not_found");
    const notify = readArea("notify");
    const rows: Array<{
      businessId: Id;
      businessName: string;
      message: LogMessage;
    }> = [];
    for (const businessId of network.businessIds) {
      const log = notify.log[businessId] ?? [];
      const businessName =
        core.businesses.find((b) => b.id === businessId)?.name ?? "—";
      for (const m of log) {
        if (m.contact === phone)
          rows.push({ businessId, businessName, message: m });
      }
    }
    return rows.sort((a, b) =>
      b.message.createdAt.localeCompare(a.message.createdAt),
    );
  });
}

/**
 * Этап 21 (лейн network): стала асинхронной — в режиме api `NetworkUser` живёт на сервере (`Server.listNetworkUsers`),
 * `readArea("network").users` в браузере пуст/устарел. Раньше функция была синхронной и звалась из рендера
 * `ClientZone.tsx` — теперь вызывающая сторона держит её за `useApiQuery`, как соседний `networksQuery` рядом.
 */
export async function canSeeNetworkClientData(
  networkId: Id,
  staffId: Id | undefined,
  isOwner: boolean,
): Promise<boolean> {
  if (isOwner) return true;
  if (!staffId) return false;
  const core = readCore();
  // Владелец сети — всегда (персона «сеть» заходит сотрудником-владельцем)
  if (core.networks.find((n) => n.id === networkId)?.ownerStaffId === staffId) return true;
  // Сеть6: пользователь сети связан с сотрудником ТЕЛЕФОНОМ (у NetworkUser нет staffId); раньше id пользователя
  // сравнивался с id сотрудника подстрокой — не совпадал никогда, и «Данные сети» не видел никто.
  const staffBusinessId = core.staff.find((x) => x.id === staffId)?.businessId;
  // Режим api: список пользователей сети доступен только с правом «Пользователи» — спрашиваем свои права у сервера
  if (isApiMode()) {
    if (!staffBusinessId) return false;
    const mine = await Server.getMyNetworkAccess(staffBusinessId);
    return mine.networkId === networkId && mine.member && mine.permissions.includes("clients");
  }
  const phone = core.staff.find((x) => x.id === staffId)?.phone;
  if (!phone) return false;
  const digits = (v: string) => v.replace(/\D/g, "");
  const users = readArea("network").users;
  return users.some(
    (u) =>
      u.networkId === networkId &&
      !u.pending &&
      (u.isOwner || u.permissions.includes("clients")) &&
      // Сеть7: доступ по филиалам — сотрудник филиала вне списка пользователя данных сети не видит
      (u.isOwner || !u.businessIds || u.businessIds.includes(staffBusinessId ?? "")) &&
      Boolean(u.phone) &&
      digits(u.phone!) === digits(phone),
  );
}

// ─────────────────────────── Записи сети (F-11-075) ───────────────────────────

export interface NetworkRecordFilters {
  businessId?: Id;
  onlineOnly?: boolean;
  cancelled?: "all" | "cancelled" | "notCancelled";
  /** Сеть10: период по дате визита (включительно); не задан — все */
  from?: ISODate;
  to?: ISODate;
}

const CANCELLED_STATUSES = new Set([
  "no_show",
  "cancelled_by_client",
  "cancelled_by_master",
]);
const ONLINE_SOURCES = new Set(["app", "link", "widget"]);

export function listNetworkRecords(
  networkId: Id,
  filters: NetworkRecordFilters = {},
): Promise<Booking[]> {
  if (isApiMode()) return Server.listNetworkRecords(networkId, filters);
  return netRequestIn("records", networkId, async () => {
    const core = readCore();
    const network = core.networks.find((n) => n.id === networkId);
    if (!network) throw new ApiError("not_found");
    const businessIds = filters.businessId
      ? [filters.businessId]
      : network.businessIds;
    const rows = await listBookings({ businessIds });
    return rows.filter((b) => {
      if (filters.from && datePart(b.start) < filters.from) return false;
      if (filters.to && datePart(b.start) > filters.to) return false;
      if (filters.onlineOnly && !ONLINE_SOURCES.has(b.source)) return false;
      if (
        filters.cancelled === "cancelled" &&
        !CANCELLED_STATUSES.has(b.status)
      )
        return false;
      if (
        filters.cancelled === "notCancelled" &&
        CANCELLED_STATUSES.has(b.status)
      )
        return false;
      return true;
    });
  });
}

export interface NetworkRecordsPage {
  rows: Booking[];
  total: number;
  page: number;
}

/**
 * Сеть10: записи сети постранично, новые сверху. Раньше экран получал все записи сети разом (635 строк,
 * 33 700 px страницы, старые сверху); теперь страница — pageSize строк, счёт — total.
 */
export async function listNetworkRecordsPage(
  networkId: Id,
  filters: NetworkRecordFilters & { page: number; pageSize: number },
): Promise<NetworkRecordsPage> {
  const all = await listNetworkRecords(networkId, filters);
  const sorted = [...all].sort((a, b) => b.start.localeCompare(a.start));
  const pages = Math.max(1, Math.ceil(sorted.length / filters.pageSize));
  const page = Math.min(Math.max(1, filters.page), pages);
  return {
    rows: sorted.slice((page - 1) * filters.pageSize, page * filters.pageSize),
    total: sorted.length,
    page,
  };
}

// ─────────────────────────── Аналитика сети (F-11-062, F-11-063) ───────────────────────────

export interface NetworkAnalyticsSummary {
  revenue: number;
  revenueDelta: number;
  servicesRevenue: number;
  servicesRevenueDelta: number;
  goodsRevenue: number;
  goodsRevenueDelta: number;
  avgCheck: number;
  avgCheckDelta: number;
  avgCheckServices: number;
  avgCheckServicesDelta: number;
  occupancy: number;
  occupancyDelta: number;
  /** Сеть12: значения прошлого такого же периода — при пустом/крошечном прошлом экран пишет «было X», а не «+1103 %» */
  previous: {
    revenue: number;
    servicesRevenue: number;
    goodsRevenue: number;
    avgCheck: number;
    avgCheckServices: number;
    occupancy: number;
  };
}

function summaryFor(
  core: ReturnType<typeof readCore>,
  businessIds: Id[],
  from: ISODate,
  to: ISODate,
) {
  const arrived = core.bookings.filter(
    (b) =>
      businessIds.includes(b.businessId) &&
      b.status === "arrived" &&
      datePart(b.start) >= from &&
      datePart(b.start) <= to,
  );
  const servicesRevenue = arrived.reduce(
    (sum, b) =>
      sum + b.services.reduce((s, line) => s + line.price * line.qty, 0),
    0,
  );
  const revenue = arrived.reduce((sum, b) => sum + b.total, 0);
  const goodsRevenue = Math.max(0, revenue - servicesRevenue);
  const withPhone = arrived.filter((b) => b.clientId);
  const avgCheck = arrived.length ? revenue / arrived.length : 0;
  const avgCheckServices = arrived.length
    ? servicesRevenue / arrived.length
    : 0;
  const workedMinutes = arrived.reduce((sum, b) => sum + b.durationMin, 0);
  const staffCount =
    new Set(
      core.staff
        .filter(
          (s) => businessIds.includes(s.businessId) && s.status === "active",
        )
        .map((s) => s.id),
    ).size || 1;
  const periodDays = Math.max(1, daysBetween(from, to));
  const availableMinutes = staffCount * periodDays * 8 * 60;
  const occupancy = availableMinutes
    ? Math.min(100, Math.round((workedMinutes / availableMinutes) * 100))
    : 0;
  void withPhone;
  return {
    revenue,
    servicesRevenue,
    goodsRevenue,
    avgCheck,
    avgCheckServices,
    occupancy,
  };
}

function daysBetween(from: ISODate, to: ISODate): number {
  return (
    Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000) +
    1
  );
}

function delta(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export function getNetworkAnalyticsSummary(
  networkId: Id,
  from: ISODate,
  to: ISODate,
): Promise<NetworkAnalyticsSummary> {
  if (isApiMode()) return Server.getNetworkAnalyticsSummary(networkId, from, to);
  return netRequestIn("analytics", networkId, () => {
    const core = readCore();
    const network = core.networks.find((n) => n.id === networkId);
    if (!network) throw new ApiError("not_found");
    const businessIds = network.businessIds;
    const span = daysBetween(from, to);
    const prevTo = addDays(from, -1);
    const prevFrom = addDays(from, -span);
    const cur = summaryFor(core, businessIds, from, to);
    const prev = summaryFor(core, businessIds, prevFrom, prevTo);
    return {
      revenue: cur.revenue,
      revenueDelta: delta(cur.revenue, prev.revenue),
      servicesRevenue: cur.servicesRevenue,
      servicesRevenueDelta: delta(cur.servicesRevenue, prev.servicesRevenue),
      goodsRevenue: cur.goodsRevenue,
      goodsRevenueDelta: delta(cur.goodsRevenue, prev.goodsRevenue),
      avgCheck: cur.avgCheck,
      avgCheckDelta: delta(cur.avgCheck, prev.avgCheck),
      avgCheckServices: cur.avgCheckServices,
      avgCheckServicesDelta: delta(cur.avgCheckServices, prev.avgCheckServices),
      occupancy: cur.occupancy,
      occupancyDelta: delta(cur.occupancy, prev.occupancy),
      previous: prev,
    };
  });
}

export function defaultAnalyticsRange(): { from: ISODate; to: ISODate } {
  const to = today();
  return { from: addDays(to, -29), to };
}

// ─────────────── Аналитика сети: клиенты/записи/детализации/планы/отчёты (F-11-064…F-11-078) ───────────────

export interface NetworkAnalyticsBreakdown {
  newClients: number;
  returningClients: number;
  lostClients: number;
  totalBookings: number;
  cancelledBookings: number;
  completedBookings: number;
  pendingBookings: number;
  bySource: Record<string, number>;
  byStatus: Record<string, number>;
}

export function getNetworkAnalyticsSettings(
  networkId: Id,
): Promise<NetworkAnalyticsSettings> {
  if (isApiMode()) return Server.getNetworkAnalyticsSettings(networkId);
  return request(
    () =>
      readArea("network").analyticsSettings[networkId] ?? {
        networkId,
        lostClientDays: 60,
      },
  );
}

/** F-11-072: срок сети отдельен от настройки локации, меняет «потерянных» только в отчётах сети */
export function setNetworkLostClientDays(
  networkId: Id,
  days: number,
): Promise<void> {
  if (isApiMode()) return Server.setNetworkLostClientDays(networkId, days);
  return request(() => {
    if (!Number.isFinite(days) || days <= 0) throw new ApiError("validation");
    mutateArea("network", (s) => {
      s.analyticsSettings[networkId] = { networkId, lostClientDays: days };
    });
  });
}

/** F-11-073: клиент потерян для сети, если ни в одной локации сети не был дольше `lostClientDays` дней */
function lastVisitByPhone(
  core: ReturnType<typeof readCore>,
  businessIds: Id[],
): Map<string, string> {
  const last = new Map<string, string>();
  const phoneOf = new Map(core.clients.map((c) => [c.id, c.phone]));
  for (const b of core.bookings) {
    if (!businessIds.includes(b.businessId) || b.status !== "arrived") continue;
    const phone = b.clientId ? phoneOf.get(b.clientId) : undefined;
    if (!phone) continue;
    const cur = last.get(phone);
    if (!cur || b.start > cur) last.set(phone, b.start);
  }
  return last;
}

export function getNetworkAnalyticsBreakdown(
  networkId: Id,
  from: ISODate,
  to: ISODate,
): Promise<NetworkAnalyticsBreakdown> {
  if (isApiMode()) return Server.getNetworkAnalyticsBreakdown(networkId, from, to);
  return netRequestIn("analytics", networkId, async () => {
    const core = readCore();
    const network = core.networks.find((n) => n.id === networkId);
    if (!network) throw new ApiError("not_found");
    const businessIds = network.businessIds;
    const settings = await getNetworkAnalyticsSettings(networkId);
    const all = core.bookings.filter((b) => businessIds.includes(b.businessId));
    const inPeriod = all.filter(
      (b) => datePart(b.start) >= from && datePart(b.start) <= to,
    );
    const arrived = inPeriod.filter((b) => b.status === "arrived");
    const phoneOf = new Map(core.clients.map((c) => [c.id, c.phone]));
    const firstVisitByPhone = new Map<string, string>();
    for (const b of core.bookings) {
      if (!businessIds.includes(b.businessId) || b.status !== "arrived")
        continue;
      const phone = b.clientId ? phoneOf.get(b.clientId) : undefined;
      if (!phone) continue;
      const cur = firstVisitByPhone.get(phone);
      if (!cur || b.start < cur) firstVisitByPhone.set(phone, b.start);
    }
    const phonesInPeriod = new Set(
      arrived
        .map((b) => (b.clientId ? phoneOf.get(b.clientId) : undefined))
        .filter((p): p is string => Boolean(p)),
    );
    let newClients = 0;
    let returningClients = 0;
    for (const phone of phonesInPeriod) {
      const first = firstVisitByPhone.get(phone);
      if (first && datePart(first) >= from) newClients += 1;
      else returningClients += 1;
    }
    const lastVisit = lastVisitByPhone(core, businessIds);
    const cutoff = addDays(to, -settings.lostClientDays);
    let lostClients = 0;
    for (const [, last] of lastVisit) {
      if (datePart(last) <= cutoff) lostClients += 1;
    }
    const CANCELLED_LIKE = new Set([
      "no_show",
      "cancelled_by_client",
      "cancelled_by_master",
      "deleted",
    ]);
    const PENDING_LIKE = new Set(["awaiting_confirmation", "scheduled"]);
    const bySource: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    for (const b of inPeriod) {
      bySource[b.source] = (bySource[b.source] ?? 0) + 1;
      byStatus[b.status] = (byStatus[b.status] ?? 0) + 1;
    }
    return {
      newClients,
      returningClients,
      lostClients,
      totalBookings: inPeriod.length,
      cancelledBookings: inPeriod.filter((b) => CANCELLED_LIKE.has(b.status))
        .length,
      completedBookings: arrived.length,
      pendingBookings: inPeriod.filter((b) => PENDING_LIKE.has(b.status))
        .length,
      bySource,
      byStatus,
    };
  });
}

export interface NetworkLocationDetailRow {
  businessId: Id;
  businessName: string;
  revenue: number;
  servicesRevenue: number;
  goodsRevenue: number;
  avgCheck: number;
  avgCheckServices: number;
  occupancy: number;
  newClients: number;
  notNewClients: number;
  totalBookings: number;
  cancelled: number;
  completed: number;
  pending: number;
}

/** F-11-065: сравнение локаций сети за период, строка «Итого» — на экране (сумма/среднее по строкам) */
export function getNetworkLocationsDetail(
  networkId: Id,
  from: ISODate,
  to: ISODate,
  subdivisionId?: Id,
): Promise<NetworkLocationDetailRow[]> {
  if (isApiMode())
    return Server.getNetworkLocationsDetail(networkId, from, to, subdivisionId);
  return netRequestIn("analytics", networkId, () => {
    const core = readCore();
    const network = core.networks.find((n) => n.id === networkId);
    if (!network) throw new ApiError("not_found");
    const categoryIds = subdivisionId
      ? new Set(
          readArea("network").subdivisions.find((s) => s.id === subdivisionId)
            ?.categoryIds ?? [],
        )
      : undefined;
    const rows: NetworkLocationDetailRow[] = [];
    const phoneOf = new Map(core.clients.map((c) => [c.id, c.phone]));
    for (const businessId of network.businessIds) {
      const business = core.businesses.find((b) => b.id === businessId);
      if (!business) continue;
      const s = summaryFor(core, [businessId], from, to);
      // Сеть12: здесь был лишний запрос getNetworkAnalyticsBreakdown по всей сети на КАЖДЫЙ филиал, результат
      // которого не использовался (void) — всё ниже считается напрямую
      const bookings = core.bookings.filter(
        (b) =>
          b.businessId === businessId &&
          datePart(b.start) >= from &&
          datePart(b.start) <= to &&
          (!categoryIds ||
            b.services.some((line) => {
              const svc = core.services.find((sv) => sv.id === line.serviceId);
              return svc && categoryIds.has(svc.categoryId);
            })),
      );
      const arrived = bookings.filter((b) => b.status === "arrived");
      const firstVisitByPhone = new Map<string, string>();
      for (const b of core.bookings) {
        if (b.businessId !== businessId || b.status !== "arrived") continue;
        const phone = b.clientId ? phoneOf.get(b.clientId) : undefined;
        if (!phone) continue;
        const cur = firstVisitByPhone.get(phone);
        if (!cur || b.start < cur) firstVisitByPhone.set(phone, b.start);
      }
      let newClients = 0;
      let notNewClients = 0;
      const seen = new Set<string>();
      for (const b of arrived) {
        const phone = b.clientId ? phoneOf.get(b.clientId) : undefined;
        if (!phone || seen.has(phone)) continue;
        seen.add(phone);
        const first = firstVisitByPhone.get(phone);
        if (first && datePart(first) >= from) newClients += 1;
        else notNewClients += 1;
      }
      const CANCELLED_LIKE = new Set([
        "no_show",
        "cancelled_by_client",
        "cancelled_by_master",
        "deleted",
      ]);
      const PENDING_LIKE = new Set(["awaiting_confirmation", "scheduled"]);
      rows.push({
        businessId,
        businessName: business.name,
        revenue: s.revenue,
        servicesRevenue: s.servicesRevenue,
        goodsRevenue: s.goodsRevenue,
        avgCheck: s.avgCheck,
        avgCheckServices: s.avgCheckServices,
        occupancy: s.occupancy,
        newClients,
        notNewClients,
        totalBookings: bookings.length,
        cancelled: bookings.filter((b) => CANCELLED_LIKE.has(b.status)).length,
        completed: arrived.length,
        pending: bookings.filter((b) => PENDING_LIKE.has(b.status)).length,
      });
    }
    return rows;
  });
}

export interface NetworkDailyDetailRow {
  date: ISODate;
  businessId: Id;
  businessName: string;
  revenue: number;
  servicesSharePct: number;
  goodsSharePct: number;
  avgCheck: number;
  occupancy: number;
  newClients: number;
  totalBookings: number;
}

/** F-11-066: те же метрики по каждой локации на каждую дату периода (сильные/слабые дни) */
export function getNetworkDailyDetail(
  networkId: Id,
  from: ISODate,
  to: ISODate,
): Promise<NetworkDailyDetailRow[]> {
  if (isApiMode()) return Server.getNetworkDailyDetail(networkId, from, to);
  return netRequestIn("analytics", networkId, () => {
    const core = readCore();
    const network = core.networks.find((n) => n.id === networkId);
    if (!network) throw new ApiError("not_found");
    const rows: NetworkDailyDetailRow[] = [];
    const span = Math.max(1, daysBetween(from, to));
    for (let i = 0; i < span; i++) {
      const date = addDays(from, i);
      for (const businessId of network.businessIds) {
        const business = core.businesses.find((b) => b.id === businessId);
        if (!business) continue;
        const s = summaryFor(core, [businessId], date, date);
        const bookings = core.bookings.filter(
          (b) => b.businessId === businessId && datePart(b.start) === date,
        );
        const newClients = new Set(
          bookings
            .filter((b) => b.status === "arrived" && b.clientId)
            .map((b) => b.clientId),
        ).size;
        rows.push({
          date,
          businessId,
          businessName: business.name,
          revenue: s.revenue,
          servicesSharePct: s.revenue
            ? Math.round((s.servicesRevenue / s.revenue) * 100)
            : 0,
          goodsSharePct: s.revenue
            ? Math.round((s.goodsRevenue / s.revenue) * 100)
            : 0,
          avgCheck: s.avgCheck,
          occupancy: s.occupancy,
          newClients,
          totalBookings: bookings.length,
        });
      }
    }
    return rows;
  });
}

export type NetworkParamMetric =
  | "revenueSold"
  | "revenuePaid"
  | "avgCheck"
  | "occupancy"
  | "newClients"
  | "totalBookings"
  | "cancelled"
  | "completed"
  | "pending";

export const NETWORK_PARAM_METRICS: NetworkParamMetric[] = [
  "revenueSold",
  "revenuePaid",
  "avgCheck",
  "occupancy",
  "newClients",
  "totalBookings",
  "cancelled",
  "completed",
  "pending",
];

export interface NetworkParamSeriesRow {
  businessId: Id;
  businessName: string;
  points: { key: string; value: number }[];
}

function bucketKey(date: ISODate, groupBy: "day" | "month" | "year"): string {
  if (groupBy === "year") return date.slice(0, 4);
  if (groupBy === "month") return date.slice(0, 7);
  return date;
}

/** F-11-067: один показатель по всем локациям во времени, группировка по дням/месяцам/годам */
export function getNetworkParamSeries(
  networkId: Id,
  metric: NetworkParamMetric,
  groupBy: "day" | "month" | "year",
  from: ISODate,
  to: ISODate,
): Promise<NetworkParamSeriesRow[]> {
  if (isApiMode())
    return Server.getNetworkParamSeries(networkId, metric, groupBy, from, to);
  return netRequestIn("analytics", networkId, () => {
    const core = readCore();
    const network = core.networks.find((n) => n.id === networkId);
    if (!network) throw new ApiError("not_found");
    const CANCELLED_LIKE = new Set([
      "no_show",
      "cancelled_by_client",
      "cancelled_by_master",
      "deleted",
    ]);
    const PENDING_LIKE = new Set(["awaiting_confirmation", "scheduled"]);
    const rows: NetworkParamSeriesRow[] = [];
    const span = Math.max(1, daysBetween(from, to));
    for (const businessId of network.businessIds) {
      const business = core.businesses.find((b) => b.id === businessId);
      if (!business) continue;
      const buckets = new Map<string, number[]>();
      for (let i = 0; i < span; i++) {
        const date = addDays(from, i);
        const key = bucketKey(date, groupBy);
        const bookings = core.bookings.filter(
          (b) => b.businessId === businessId && datePart(b.start) === date,
        );
        const arrived = bookings.filter((b) => b.status === "arrived");
        let value = 0;
        if (metric === "revenueSold")
          value = arrived.reduce((s, b) => s + b.total, 0);
        else if (metric === "revenuePaid")
          value = arrived
            .filter((b) => b.prepayment?.paid !== false)
            .reduce((s, b) => s + b.total, 0);
        else if (metric === "avgCheck")
          value = arrived.length
            ? arrived.reduce((s, b) => s + b.total, 0) / arrived.length
            : 0;
        else if (metric === "occupancy")
          value = summaryFor(core, [businessId], date, date).occupancy;
        else if (metric === "newClients")
          value = new Set(arrived.map((b) => b.clientId).filter(Boolean)).size;
        else if (metric === "totalBookings") value = bookings.length;
        else if (metric === "cancelled")
          value = bookings.filter((b) => CANCELLED_LIKE.has(b.status)).length;
        else if (metric === "completed") value = arrived.length;
        else if (metric === "pending")
          value = bookings.filter((b) => PENDING_LIKE.has(b.status)).length;
        const arr = buckets.get(key) ?? [];
        arr.push(value);
        buckets.set(key, arr);
      }
      const avgMetrics = new Set<NetworkParamMetric>(["avgCheck", "occupancy"]);
      const points = Array.from(buckets.entries())
        .map(([key, values]) => ({
          key,
          value: avgMetrics.has(metric)
            ? Math.round(values.reduce((s, v) => s + v, 0) / values.length)
            : Math.round(values.reduce((s, v) => s + v, 0)),
        }))
        .sort((a, b) => a.key.localeCompare(b.key));
      rows.push({ businessId, businessName: business.name, points });
    }
    return rows;
  });
}

export interface NetworkPlanExecutionRow {
  businessId: Id;
  businessName: string;
  revenue: number;
  planAmount: number;
  pctOfPlan: number;
  daysInMonth: number;
  dayPlan: number;
  avgDailyRevenue: number;
  remainingTotal: number;
  remainingDays: number;
  remainingPerDay: number;
  underPerDay: number;
  forecast: number;
}

/** Этап 21 (сдача): факт и план с сервера, производные поля — те же формулы, что у мока ниже */
async function planExecutionFromServer(networkId: Id, month: string, kind: NetworkPlanKind): Promise<NetworkPlanExecutionRow[]> {
  const cells = await Server.getNetworkPlanExecution(networkId, month, kind);
  const monthStart = `${month}-01` as ISODate;
  const daysInMonth = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
  const monthEnd = addDays(monthStart, daysInMonth - 1);
  const elapsedDays = today().slice(0, 7) === month ? Math.max(1, daysBetween(monthStart, today())) : today() > monthEnd ? daysInMonth : 0;
  const names = new Map(readCore().businesses.map((b) => [b.id, b.name]));
  return cells.map((c) => {
    const revenue = c.actual;
    const planAmount = c.value;
    const dayPlan = daysInMonth ? Math.round(planAmount / daysInMonth) : 0;
    const avgDailyRevenue = elapsedDays ? Math.round(revenue / elapsedDays) : 0;
    const remainingTotal = planAmount - revenue;
    const remainingDays = Math.max(0, daysInMonth - elapsedDays);
    const remainingPerDay = remainingDays ? Math.round(remainingTotal / remainingDays) : 0;
    return {
      businessId: c.businessId,
      businessName: names.get(c.businessId) ?? "—",
      revenue,
      planAmount,
      pctOfPlan: planAmount ? Math.round((revenue / planAmount) * 100) : 0,
      daysInMonth,
      dayPlan,
      avgDailyRevenue,
      remainingTotal,
      remainingDays,
      remainingPerDay,
      underPerDay: remainingPerDay - dayPlan,
      forecast: avgDailyRevenue * daysInMonth,
    };
  });
}

/** F-11-068/078: план месяца против факта, по трём типам плана */
export function getNetworkPlanExecution(
  networkId: Id,
  month: string,
  kind: NetworkPlanKind,
): Promise<NetworkPlanExecutionRow[]> {
  if (isApiMode()) return planExecutionFromServer(networkId, month, kind);
  return netRequestIn(["analytics", "plans"], networkId, () => {
    const core = readCore();
    const network = core.networks.find((n) => n.id === networkId);
    if (!network) throw new ApiError("not_found");
    const monthStart = `${month}-01` as ISODate;
    const daysInMonth = new Date(
      Number(month.slice(0, 4)),
      Number(month.slice(5, 7)),
      0,
    ).getDate();
    const monthEnd = addDays(monthStart, daysInMonth - 1);
    const isCurrentMonth = today().slice(0, 7) === month;
    const elapsedDays = isCurrentMonth
      ? Math.max(1, daysBetween(monthStart, today()))
      : today() > monthEnd
        ? daysInMonth
        : 0;
    const plans = readArea("network").plans.filter(
      (p) => p.networkId === networkId && p.kind === kind && p.month === month,
    );
    const rows: NetworkPlanExecutionRow[] = [];
    for (const businessId of network.businessIds) {
      const business = core.businesses.find((b) => b.id === businessId);
      if (!business) continue;
      const planAmount =
        plans.find((p) => p.businessId === businessId)?.value ?? 0;
      const arrived = core.bookings.filter(
        (b) =>
          b.businessId === businessId &&
          b.status === "arrived" &&
          datePart(b.start) >= monthStart &&
          datePart(b.start) <= monthEnd,
      );
      const revenue =
        kind === "clients"
          ? new Set(arrived.map((b) => b.clientId).filter(Boolean)).size
          : kind === "avgCheck"
            ? arrived.length
              ? Math.round(
                  arrived.reduce((s, b) => s + b.total, 0) / arrived.length,
                )
              : 0
            : arrived.reduce((s, b) => s + b.total, 0);
      const dayPlan = daysInMonth ? Math.round(planAmount / daysInMonth) : 0;
      const avgDailyRevenue = elapsedDays
        ? Math.round(revenue / elapsedDays)
        : 0;
      const remainingTotal = planAmount - revenue;
      const remainingDays = Math.max(0, daysInMonth - elapsedDays);
      const remainingPerDay = remainingDays
        ? Math.round(remainingTotal / remainingDays)
        : 0;
      const underPerDay = remainingPerDay - dayPlan;
      const forecast = avgDailyRevenue * daysInMonth;
      rows.push({
        businessId,
        businessName: business.name,
        revenue,
        planAmount,
        pctOfPlan: planAmount ? Math.round((revenue / planAmount) * 100) : 0,
        daysInMonth,
        dayPlan,
        avgDailyRevenue,
        remainingTotal,
        remainingDays,
        remainingPerDay,
        underPerDay,
        forecast,
      });
    }
    return rows;
  });
}

export interface NetworkServiceReportRow {
  serviceId: Id;
  name: string;
  categoryName: string;
  count: number;
  revenue: number;
  avgPrice: number;
  pctOfRevenue: number;
}

/** F-11-069: без себестоимости/зарплаты — их источники (stock, payroll) ещё не отданы разделу (qa/requests/network.md) */
export function getNetworkServicesReport(
  networkId: Id,
  from: ISODate,
  to: ISODate,
  filters: { businessId?: Id; staffId?: Id } = {},
): Promise<NetworkServiceReportRow[]> {
  if (isApiMode())
    return Server.getNetworkServicesReport(networkId, from, to, filters);
  return netRequestIn("analytics", networkId, () => {
    const core = readCore();
    const network = core.networks.find((n) => n.id === networkId);
    if (!network) throw new ApiError("not_found");
    const businessIds = filters.businessId
      ? [filters.businessId]
      : network.businessIds;
    const arrived = core.bookings.filter(
      (b) =>
        businessIds.includes(b.businessId) &&
        b.status === "arrived" &&
        datePart(b.start) >= from &&
        datePart(b.start) <= to &&
        (!filters.staffId || b.staffId === filters.staffId),
    );
    const totalRevenue = arrived.reduce((s, b) => s + b.total, 0);
    const byService = new Map<
      Id,
      { count: number; revenue: number; name: string; categoryName: string }
    >();
    for (const b of arrived) {
      for (const line of b.services) {
        const svc = core.services.find((s) => s.id === line.serviceId);
        const cat = svc
          ? core.serviceCategories.find((c) => c.id === svc.categoryId)
          : undefined;
        const key = line.serviceId;
        const cur = byService.get(key) ?? {
          count: 0,
          revenue: 0,
          name: svc?.name.ru ?? "—",
          categoryName: cat?.name.ru ?? "—",
        };
        cur.count += line.qty;
        cur.revenue += line.price * line.qty;
        byService.set(key, cur);
      }
    }
    return Array.from(byService.entries())
      .map(([serviceId, v]) => ({
        serviceId,
        name: v.name,
        categoryName: v.categoryName,
        count: v.count,
        revenue: v.revenue,
        avgPrice: v.count ? Math.round(v.revenue / v.count) : 0,
        pctOfRevenue: totalRevenue
          ? Math.round((v.revenue / totalRevenue) * 1000) / 10
          : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  });
}

export interface NetworkStaffReportRow {
  staffId: Id;
  name: string;
  position: string;
  revenue: number;
  visitsCount: number;
  avgCheck: number;
  clientsCount: number;
  servicesSum: number;
  servicesCount: number;
  avgCheckServices: number;
  hoursWorked: number;
  hourCost: number;
  pctOfRevenue: number;
}

/** F-11-070: смены одного сетевого мастера из разных филиалов сводятся в одну строку */
export function getNetworkStaffReport(
  networkId: Id,
  from: ISODate,
  to: ISODate,
  businessId?: Id,
): Promise<NetworkStaffReportRow[]> {
  if (isApiMode())
    return Server.getNetworkStaffReport(networkId, from, to, businessId);
  return netRequestIn("analytics", networkId, () => {
    const core = readCore();
    const network = core.networks.find((n) => n.id === networkId);
    if (!network) throw new ApiError("not_found");
    const businessIds = businessId ? [businessId] : network.businessIds;
    const arrived = core.bookings.filter(
      (b) =>
        businessIds.includes(b.businessId) &&
        b.status === "arrived" &&
        datePart(b.start) >= from &&
        datePart(b.start) <= to,
    );
    const totalRevenue = arrived.reduce((s, b) => s + b.total, 0);
    const byStaff = new Map<
      Id,
      {
        revenue: number;
        visits: number;
        clients: Set<Id>;
        servicesSum: number;
        servicesCount: number;
        minutes: number;
      }
    >();
    for (const b of arrived) {
      const cur = byStaff.get(b.staffId) ?? {
        revenue: 0,
        visits: 0,
        clients: new Set<Id>(),
        servicesSum: 0,
        servicesCount: 0,
        minutes: 0,
      };
      cur.revenue += b.total;
      cur.visits += 1;
      if (b.clientId) cur.clients.add(b.clientId);
      cur.servicesSum += b.services.reduce((s, l) => s + l.price * l.qty, 0);
      cur.servicesCount += b.services.reduce((s, l) => s + l.qty, 0);
      cur.minutes += b.durationMin;
      byStaff.set(b.staffId, cur);
    }
    const rows: NetworkStaffReportRow[] = [];
    for (const [staffId, v] of byStaff) {
      const staff = core.staff.find((s) => s.id === staffId);
      const hoursWorked = Math.round((v.minutes / 60) * 10) / 10;
      rows.push({
        staffId,
        name: staff?.name ?? "—",
        position: staff?.position?.ru ?? "—",
        revenue: v.revenue,
        visitsCount: v.visits,
        avgCheck: v.visits ? Math.round(v.revenue / v.visits) : 0,
        clientsCount: v.clients.size,
        servicesSum: v.servicesSum,
        servicesCount: v.servicesCount,
        avgCheckServices: v.visits ? Math.round(v.servicesSum / v.visits) : 0,
        hoursWorked,
        hourCost: hoursWorked ? Math.round(v.revenue / hoursWorked) : 0,
        pctOfRevenue: totalRevenue
          ? Math.round((v.revenue / totalRevenue) * 1000) / 10
          : 0,
      });
    }
    return rows.sort((a, b) => b.revenue - a.revenue);
  });
}

export interface NetworkHrReportRow {
  staffId: Id;
  name: string;
  phone: string;
  businessName: string;
  position: string;
  hiredAt: ISODate;
  fired: boolean;
}

export interface NetworkHrReportFilters {
  query?: string;
  fired?: "fired" | "notFired";
}

/**
 * F-11-071: «Дата создания сотрудника», «Уволены» (дата) и «ИНН» ещё не поля ядра Staff (только `hiredAt` и
 * `status`) — используем то, что есть, и пишем запрос на недостающие поля в qa/requests/network.md.
 */
export function getNetworkHrReport(
  networkId: Id,
  filters: NetworkHrReportFilters = {},
): Promise<NetworkHrReportRow[]> {
  if (isApiMode()) return Server.getNetworkHrReport(networkId, filters);
  return netRequestIn("analytics", networkId, () => {
    const core = readCore();
    const network = core.networks.find((n) => n.id === networkId);
    if (!network) throw new ApiError("not_found");
    let rows = core.staff
      .filter((s) => network.businessIds.includes(s.businessId))
      .map((s) => ({
        staffId: s.id,
        name: s.name,
        phone: s.phone,
        businessName:
          core.businesses.find((b) => b.id === s.businessId)?.name ?? "—",
        position: s.position?.ru ?? "—",
        hiredAt: s.hiredAt,
        fired: s.status === "fired",
      }));
    const q = filters.query?.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.phone.replace(/\D/g, "").includes(q.replace(/\D/g, "")),
      );
    }
    if (filters.fired === "fired") rows = rows.filter((r) => r.fired);
    if (filters.fired === "notFired") rows = rows.filter((r) => !r.fired);
    return rows.sort((a, b) => b.hiredAt.localeCompare(a.hiredAt));
  });
}

// ─────────────────────────── Планы (F-11-077) ───────────────────────────

export function listNetworkPlans(networkId: Id): Promise<NetworkPlanCell[]> {
  if (isApiMode()) return Server.listNetworkPlans(networkId);
  return request(() =>
    readArea("network").plans.filter((p) => p.networkId === networkId),
  );
}

export function setNetworkPlanCell(input: {
  networkId: Id;
  businessId: Id;
  kind: NetworkPlanKind;
  month: string;
  value: number;
}): Promise<void> {
  if (isApiMode()) return Server.setNetworkPlanCell(input);
  return request(() => {
    mutateArea("network", (s) => {
      const found = s.plans.find(
        (p) =>
          p.networkId === input.networkId &&
          p.businessId === input.businessId &&
          p.kind === input.kind &&
          p.month === input.month,
      );
      if (found) found.value = input.value;
      else s.plans.push({ ...input });
    });
  });
}

// ─────────────────────────── Услуги сети: категории и миграция (F-11-079, F-11-087, F-11-094) ───────────────────────────

export interface NetworkCategoryRow {
  key: string;
  category: ServiceCategory;
  servicesCount: number;
  businessCount: number;
  /** Значок сети (F-11-079): категория есть в двух и более филиалах сети — вывод, пока в ядре нет отдельного
   * признака «создана в сети» (см. qa/requests/network.md, b03) */
  isNetwork: boolean;
}

/** Сетевые категории услуг (b01: только чтение реального каталога — раздача по филиалам делает b03) */
export function listNetworkServiceCategories(
  networkId: Id,
): Promise<NetworkCategoryRow[]> {
  if (isApiMode()) return Server.listNetworkServiceCategories(networkId);
  return request(() => {
    const core = readCore();
    const network = core.networks.find((n) => n.id === networkId);
    if (!network) throw new ApiError("not_found");
    const byName = new Map<string, NetworkCategoryRow>();
    for (const category of core.serviceCategories.filter((c) =>
      network.businessIds.includes(c.businessId),
    )) {
      const key = category.name.ru || category.id;
      const servicesCount = core.services.filter(
        (s) => s.categoryId === category.id,
      ).length;
      const row = byName.get(key);
      if (row) {
        row.servicesCount += servicesCount;
        row.businessCount += 1;
        row.isNetwork = row.businessCount > 1;
      } else {
        byName.set(key, {
          key,
          category,
          servicesCount,
          businessCount: 1,
          isNetwork: false,
        });
      }
    }
    return Array.from(byName.values());
  });
}

export interface ServiceMigrationRow {
  service: Service;
  availableIn: Id[];
}

/** Таблица «Услуга / Доступно в локациях» (F-11-087); b01 — обзор, раздача по филиалам в b03 */
export function listServiceMigrationRows(
  networkId: Id,
): Promise<ServiceMigrationRow[]> {
  if (isApiMode()) return Server.listServiceMigrationRows(networkId);
  return request(() => {
    const core = readCore();
    const network = core.networks.find((n) => n.id === networkId);
    if (!network) throw new ApiError("not_found");
    const byName = new Map<string, ServiceMigrationRow>();
    for (const service of core.services.filter((s) =>
      network.businessIds.includes(s.businessId),
    )) {
      const key = service.name.ru || service.id;
      const row = byName.get(key);
      if (row) row.availableIn.push(service.businessId);
      else byName.set(key, { service, availableIn: [service.businessId] });
    }
    return Array.from(byName.values());
  });
}

export function listNetworkSubdivisions(
  networkId: Id,
): Promise<NetworkSubdivision[]> {
  if (isApiMode()) return Server.listNetworkSubdivisions(networkId);
  return request(() =>
    readArea("network").subdivisions.filter((s) => s.networkId === networkId),
  );
}

export function createNetworkSubdivision(
  networkId: Id,
  name: string,
): Promise<NetworkSubdivision> {
  const trimmed = name.trim();
  if (!trimmed)
    return Promise.reject(new ApiError("validation", "name required"));
  if (isApiMode()) return Server.createNetworkSubdivision(networkId, trimmed);
  return request(() => {
    const item: NetworkSubdivision = {
      id: newId("subdiv"),
      networkId,
      name: trimmed,
      categoryIds: [],
    };
    mutateArea("network", (s) => {
      s.subdivisions.push(item);
    });
    return item;
  });
}

// ─────────────────────────── Сотрудники сети (F-11-097) ───────────────────────────

export interface NetworkStaffFilters {
  positionId?: string;
  status?: "active" | "deleted" | "all";
  fired?: "fired" | "working" | "all";
}

export function listNetworkStaff(
  networkId: Id,
  filters: NetworkStaffFilters = {},
): Promise<Staff[]> {
  if (isApiMode()) return Server.listNetworkStaff(networkId, filters);
  return request(() => {
    const core = readCore();
    const network = core.networks.find((n) => n.id === networkId);
    if (!network) throw new ApiError("not_found");
    return core.staff.filter((s) => {
      if (!network.businessIds.includes(s.businessId)) return false;
      if (
        filters.status === "active" &&
        s.status !== "active" &&
        s.status !== "invited"
      )
        return false;
      if (filters.status === "deleted" && s.status !== "disabled") return false;
      if (filters.fired === "fired" && s.status !== "fired") return false;
      if (filters.fired === "working" && s.status === "fired") return false;
      if (filters.positionId && s.position?.ru !== filters.positionId)
        return false;
      return true;
    });
  });
}

export function listNetworkPositions(networkId: Id): Promise<string[]> {
  if (isApiMode()) return Server.listNetworkPositions(networkId);
  return request(() => {
    const core = readCore();
    const network = core.networks.find((n) => n.id === networkId);
    if (!network) return [];
    const set = new Set<string>();
    for (const s of core.staff) {
      if (network.businessIds.includes(s.businessId) && s.position?.ru)
        set.add(s.position.ru);
    }
    return Array.from(set);
  });
}

// ─────────────────────────── Товары сети (F-11-111) ───────────────────────────

export function listNetworkGoodsCategories(
  networkId: Id,
): Promise<NetworkGoodsCategory[]> {
  if (isApiMode()) return Server.listNetworkGoodsCategories(networkId);
  return request(() =>
    readArea("network").goodsCategories.filter(
      (c) => c.networkId === networkId,
    ),
  );
}

export function createNetworkGoodsCategory(
  networkId: Id,
  name: string,
  parentId?: Id,
): Promise<NetworkGoodsCategory> {
  const trimmed = name.trim();
  if (!trimmed)
    return Promise.reject(new ApiError("validation", "name required"));
  return request(() => {
    const item: NetworkGoodsCategory = {
      id: newId("goodscat"),
      networkId,
      name: trimmed,
      parentId,
    };
    mutateArea("network", (s) => {
      s.goodsCategories.push(item);
    });
    return item;
  });
}

export function searchNetworkGoods(
  networkId: Id,
  query: string,
): Promise<Good[]> {
  if (isApiMode()) return Server.searchNetworkGoods(networkId, query);
  return request(() => {
    const core = readCore();
    const network = core.networks.find((n) => n.id === networkId);
    if (!network) throw new ApiError("not_found");
    const goods = readArea("stock").goods.filter((g) =>
      network.businessIds.includes(g.businessId),
    );
    const q = query.trim().toLowerCase();
    if (!q) return goods.slice(0, 50);
    return goods
      .filter(
        (g) =>
          g.name.toLowerCase().includes(q) ||
          g.sku?.toLowerCase().includes(q) ||
          g.barcode?.includes(q),
      )
      .slice(0, 50);
  });
}

// ─────────────────────────── Телефония (F-11-146) ───────────────────────────

export function getNetworkTelephony(
  networkId: Id,
): Promise<{ networkId: Id; token: string; connected: boolean }> {
  if (isApiMode()) return Server.getNetworkTelephony(networkId);
  return request(() => {
    const t = readArea("network").telephony[networkId];
    if (!t) throw new ApiError("not_found");
    return t;
  });
}

export function connectNetworkTelephony(networkId: Id): Promise<void> {
  if (isApiMode()) return Server.connectNetworkTelephony(networkId);
  return request(() => {
    mutateArea("network", (s) => {
      const t = s.telephony[networkId];
      if (t) t.connected = true;
    });
  });
}

// ═══════════════════ b03 · Сетевые услуги: категории, форма, миграция, пакеты ═══════════════════
// Сетевая услуга/категория — это ядровые Service/ServiceCategory с одинаковым именем в нескольких
// Business сети (как и было в b01/b02: значок сети — по совпадению имени). Запреты цены/описания
// живут в своём срезе (serviceLocks), т.к. в ядре у Service их нет — qa/requests/network.md.

function serviceKeyOf(s: Pick<Service, "name" | "id">): string {
  return s.name.ru?.trim() || s.id;
}
function categoryKeyOf(c: Pick<ServiceCategory, "name" | "id">): string {
  return c.name.ru?.trim() || c.id;
}

function networkBusinesses(networkId: Id): {
  core: ReturnType<typeof readCore>;
  network: Network;
} {
  const core = readCore();
  const network = core.networks.find((n) => n.id === networkId);
  if (!network) throw new ApiError("not_found");
  return { core, network };
}

/** F-11-080: создать/переименовать сетевую категорию услуг в отмеченных филиалах */
export async function saveNetworkServiceCategory(
  networkId: Id,
  input: {
    key?: string;
    name: LocalizedText;
    onlineName?: LocalizedText;
    subdivisionId?: Id;
    businessIds: Id[];
  },
): Promise<{ key: string }> {
  if (isApiMode()) return Server.saveNetworkServiceCategory(networkId, input);
  // arch-a1: одна операция сети = много отдельных request() (каждый coreCreate/coreUpdate/coreRemove — свой),
  // а не один внешний request(), который их оборачивает — вложенный request() ломает запись (see qa/build).
  if (!input.name.ru?.trim()) throw new ApiError("validation", "name required");
  if (!input.businessIds.length)
    throw new ApiError("validation", "no locations");
  const { core, network } = networkBusinesses(networkId);
  const existing = input.key
    ? core.serviceCategories.filter(
        (c) =>
          network.businessIds.includes(c.businessId) &&
          categoryKeyOf(c) === input.key,
      )
    : [];
  const existingByBusiness = new Map(existing.map((c) => [c.businessId, c]));
  let newKey = input.key ?? "";
  for (const businessId of input.businessIds) {
    const found = existingByBusiness.get(businessId);
    if (found) {
      await coreUpdate("serviceCategories", found.id, {
        name: input.name,
      } as Partial<ServiceCategory>);
      newKey = categoryKeyOf({ ...found, name: input.name });
    } else {
      const created = await coreCreate("serviceCategories", {
        businessId,
        name: input.name,
        order: core.serviceCategories.filter((c) => c.businessId === businessId)
          .length,
      } as Omit<ServiceCategory, "id">);
      newKey = categoryKeyOf(created);
    }
  }
  // ушла из филиала, где раньше была — удаляем (список локаций = точный состав)
  for (const c of existing) {
    if (!input.businessIds.includes(c.businessId))
      await coreRemove("serviceCategories", c.id);
  }
  // «Название для онлайн-записи» и подразделение — в ядре у ServiceCategory их нет (см. qa/requests/network.md),
  // храним рядом в своём срезе привязанными к ключу категории.
  await request(() =>
    mutateArea("network", (s) => {
      s.serviceCategoryLinks[newKey] = {
        networkId,
        subdivisionId: input.subdivisionId,
        onlineName: input.onlineName?.ru,
      };
    }),
  );
  return { key: newKey };
}

export interface NetworkServiceCategoryDetail {
  key: string;
  name: LocalizedText;
  onlineName?: string;
  subdivisionId?: Id;
  businessIds: Id[];
}

/** Карточка сетевой категории для формы редактирования (F-11-080) */
export function getNetworkServiceCategory(
  networkId: Id,
  key: string,
): Promise<NetworkServiceCategoryDetail | undefined> {
  if (isApiMode()) return Server.getNetworkServiceCategory(networkId, key);
  return request(() => {
    const { core, network } = networkBusinesses(networkId);
    const rows = core.serviceCategories.filter(
      (c) =>
        network.businessIds.includes(c.businessId) && categoryKeyOf(c) === key,
    );
    if (!rows.length) return undefined;
    const link = readArea("network").serviceCategoryLinks[key];
    return {
      key,
      name: rows[0].name,
      onlineName: link?.onlineName,
      subdivisionId: link?.subdivisionId,
      businessIds: rows.map((r) => r.businessId),
    };
  });
}

export interface NetworkServiceDetail {
  key: string;
  service: Service;
  businessIds: Id[];
  priceLocked: boolean;
  descriptionLocked: boolean;
  onlineName?: string;
}

/** F-11-081: карточка сетевой услуги (данные + в каких филиалах уже есть + запреты) */
export function getNetworkService(
  networkId: Id,
  key: string,
): Promise<NetworkServiceDetail | undefined> {
  if (isApiMode()) return Server.getNetworkService(networkId, key);
  return request(() => {
    const { core, network } = networkBusinesses(networkId);
    const rows = core.services.filter(
      (s) =>
        network.businessIds.includes(s.businessId) && serviceKeyOf(s) === key,
    );
    if (!rows.length) return undefined;
    const lock = readArea("network").serviceLocks.find(
      (l) => l.networkId === networkId && l.key === key,
    );
    return {
      key,
      service: rows[0],
      businessIds: rows.map((r) => r.businessId),
      priceLocked: lock?.priceLocked ?? false,
      descriptionLocked: lock?.descriptionLocked ?? false,
      onlineName: lock?.onlineName,
    };
  });
}

export interface NetworkServiceFormInput {
  key?: string;
  name: LocalizedText;
  onlineName?: LocalizedText;
  categoryKey: string;
  kind: "individual" | "group";
  description?: LocalizedText;
  priceMin: number;
  priceMax?: number;
  durationMin: number;
  capacity?: number;
  priceLocked: boolean;
  descriptionLocked: boolean;
  businessIds: Id[];
  /**
   * Сеть4: цена в филиалах, где услуга уже есть. 'all' — одна цена всем (как раньше), 'keepLocal' — местные
   * цены остаются, новая цена только у новых копий. Не задано — 'all'.
   */
  priceMode?: "all" | "keepLocal";
}

/** Сеть4: что сделает сохранение сетевой услуги в каждом филиале — показывается ДО записи */
export interface NetworkServiceSaveRow {
  businessId: Id;
  businessName: string;
  action: "create" | "update" | "remove";
  /** Цена в филиале сейчас (update/remove) */
  currentPriceMin?: number;
  currentPriceMax?: number;
  /** Категории с таким именем в филиале нет — создастся */
  createsCategory: boolean;
  /** Будущие живые записи с этой услугой (remove — их услуга пропадёт из каталога) */
  futureBookings: number;
}

export function previewNetworkServiceSave(
  networkId: Id,
  input: Pick<NetworkServiceFormInput, "key" | "categoryKey" | "businessIds">,
): Promise<NetworkServiceSaveRow[]> {
  if (isApiMode()) return Server.previewNetworkServiceSave(networkId, input);
  return netRequestIn("services", networkId, () => {
    const { core, network } = networkBusinesses(networkId);
    const existing = input.key
      ? core.services.filter(
          (sv) => network.businessIds.includes(sv.businessId) && serviceKeyOf(sv) === input.key,
        )
      : [];
    const now = nowDateTime();
    const futureOf = (serviceId: Id) =>
      core.bookings.filter(
        (b) => b.start >= now && occupiesTime(b) && b.services.some((l) => l.serviceId === serviceId),
      ).length;
    const nameOf = (id: Id) => core.businesses.find((b) => b.id === id)?.name ?? id;
    const rows: NetworkServiceSaveRow[] = [];
    for (const businessId of input.businessIds) {
      const found = existing.find((sv) => sv.businessId === businessId);
      rows.push({
        businessId,
        businessName: nameOf(businessId),
        action: found ? "update" : "create",
        currentPriceMin: found?.priceMin,
        currentPriceMax: found?.priceMax,
        createsCategory: !core.serviceCategories.some(
          (c) => c.businessId === businessId && categoryKeyOf(c) === input.categoryKey,
        ),
        futureBookings: 0,
      });
    }
    for (const sv of existing) {
      if (input.businessIds.includes(sv.businessId)) continue;
      rows.push({
        businessId: sv.businessId,
        businessName: nameOf(sv.businessId),
        action: "remove",
        currentPriceMin: sv.priceMin,
        currentPriceMax: sv.priceMax,
        createsCategory: false,
        futureBookings: futureOf(sv.id),
      });
    }
    return rows;
  });
}

/** F-11-081/082/083: сохранить сетевую услугу (создание/правка) в отмеченных филиалах + запреты */
export async function saveNetworkService(
  networkId: Id,
  input: NetworkServiceFormInput,
): Promise<{ key: string }> {
  if (isApiMode()) return Server.saveNetworkService(networkId, input);
  if (!input.name.ru?.trim()) throw new ApiError("validation", "name required");
  if (!input.businessIds.length)
    throw new ApiError("validation", "no locations");
  if (input.priceMax != null && input.priceMax < input.priceMin)
    throw new ApiError("validation", "price range");
  const { core, network } = networkBusinesses(networkId);
  const existing = input.key
    ? core.services.filter(
        (s) =>
          network.businessIds.includes(s.businessId) &&
          serviceKeyOf(s) === input.key,
      )
    : [];
  const existingByBusiness = new Map(existing.map((s) => [s.businessId, s]));
  let newKey = input.key ?? "";
  for (const businessId of input.businessIds) {
    let category = core.serviceCategories.find(
      (c) =>
        c.businessId === businessId && categoryKeyOf(c) === input.categoryKey,
    );
    // Сеть4: категории в филиале нет — создаём её (раньше услуга молча не попадала в этот филиал)
    if (!category) {
      const sample = core.serviceCategories.find(
        (c) => network.businessIds.includes(c.businessId) && categoryKeyOf(c) === input.categoryKey,
      );
      category = await coreCreate("serviceCategories", {
        businessId,
        name: sample?.name ?? { ru: input.categoryKey },
        order: core.serviceCategories.filter((c) => c.businessId === businessId).length,
      } as Omit<ServiceCategory, "id">);
    }
    const found = existingByBusiness.get(businessId);
    const keepLocalPrice = Boolean(found) && input.priceMode === "keepLocal";
    const patch = {
      name: input.name,
      description: input.description,
      categoryId: category.id,
      kind: input.kind,
      durationMin: input.durationMin,
      ...(keepLocalPrice ? {} : { priceMin: input.priceMin, priceMax: input.priceMax }),
      capacity: input.capacity,
    };
    if (found) {
      await coreUpdate("services", found.id, patch as Partial<Service>);
      newKey = serviceKeyOf({ ...found, name: input.name });
    } else {
      const created = await coreCreate("services", {
        businessId,
        sphereId:
          core.businesses.find((b) => b.id === businessId)?.sphereIds[0] ??
          "beauty",
        photos: [],
        materials: [],
        staffIds: [],
        workplaces: ["salon"],
        onlineBookable: true,
        active: true,
        order: core.services.filter((s) => s.businessId === businessId).length,
        ...patch,
      } as Omit<Service, "id">);
      newKey = serviceKeyOf(created);
    }
  }
  for (const s of existing) {
    if (!input.businessIds.includes(s.businessId))
      await coreRemove("services", s.id);
  }
  await request(() =>
    mutateArea("network", (s) => {
      const others = s.serviceLocks.filter(
        (l) => !(l.networkId === networkId && l.key === newKey),
      );
      s.serviceLocks = [
        ...others,
        {
          key: newKey,
          networkId,
          priceLocked: input.priceLocked,
          descriptionLocked: input.descriptionLocked,
          onlineName: input.onlineName?.ru,
        },
      ];
    }),
  );
  return { key: newKey };
}

/** F-11-088/091: «Добавить в филиалы» — копирует услугу (по имени) в отмеченные, где её ещё нет */
export async function addServiceToLocations(
  networkId: Id,
  key: string,
  targetBusinessIds: Id[],
): Promise<void> {
  if (!targetBusinessIds.length)
    throw new ApiError("validation", "no locations");
  if (isApiMode())
    return Server.addServiceToLocations(networkId, key, targetBusinessIds);
  const { core, network } = networkBusinesses(networkId);
  const rows = core.services.filter(
    (s) =>
      network.businessIds.includes(s.businessId) && serviceKeyOf(s) === key,
  );
  if (!rows.length) throw new ApiError("not_found");
  const source = rows[0];
  const categoryName = core.serviceCategories.find(
    (c) => c.id === source.categoryId,
  )?.name;
  for (const businessId of targetBusinessIds) {
    if (rows.some((r) => r.businessId === businessId)) continue; // уже есть — F-11-088 не показывает такие
    let category = core.serviceCategories.find(
      (c) => c.businessId === businessId && c.name.ru === categoryName?.ru,
    );
    if (!category) {
      category = await coreCreate("serviceCategories", {
        businessId,
        name: categoryName ?? { ru: "Без категории" },
        order: core.serviceCategories.filter((c) => c.businessId === businessId)
          .length,
      } as Omit<ServiceCategory, "id">);
    }
    await coreCreate("services", {
      businessId,
      categoryId: category.id,
      sphereId: source.sphereId,
      name: source.name,
      description: source.description,
      kind: source.kind,
      durationMin: source.durationMin,
      durationMax: source.durationMax,
      priceMin: source.priceMin,
      priceMax: source.priceMax,
      photos: [],
      materials: [],
      staffIds: [],
      workplaces: source.workplaces,
      onlineBookable: source.onlineBookable,
      active: true,
      order: core.services.filter((s) => s.businessId === businessId).length,
      shadeChoice: source.shadeChoice,
      capacity: source.capacity,
    } as Omit<Service, "id">);
  }
}

/** F-11-089: «Удалить из филиалов» — только там, где услуга реально есть */
export async function removeServiceFromLocations(
  networkId: Id,
  key: string,
  businessIds: Id[],
): Promise<void> {
  if (isApiMode())
    return Server.removeServiceFromLocations(networkId, key, businessIds);
  const { core, network } = networkBusinesses(networkId);
  const rows = core.services.filter(
    (s) =>
      network.businessIds.includes(s.businessId) &&
      serviceKeyOf(s) === key &&
      businessIds.includes(s.businessId),
  );
  for (const s of rows) await coreRemove("services", s.id);
}

/**
 * F-11-090: «Синхронизировать» — состав филиалов услуги становится РОВНО businessIds: где отсутствует —
 * создаётся копия источника, где есть, но не отмечено — удаляется. Остальные поля берутся из источника.
 */
export async function syncServiceToLocations(
  networkId: Id,
  key: string,
  businessIds: Id[],
): Promise<{ removedFrom: Id[]; addedTo: Id[] }> {
  if (isApiMode())
    return Server.syncServiceToLocations(networkId, key, businessIds);
  const { core, network } = networkBusinesses(networkId);
  const rows = core.services.filter(
    (s) =>
      network.businessIds.includes(s.businessId) && serviceKeyOf(s) === key,
  );
  if (!rows.length) throw new ApiError("not_found");
  const removedFrom = rows
    .filter((r) => !businessIds.includes(r.businessId))
    .map((r) => r.businessId);
  const addedTo = businessIds.filter(
    (id) => !rows.some((r) => r.businessId === id),
  );
  for (const r of rows) {
    if (removedFrom.includes(r.businessId)) await coreRemove("services", r.id);
  }
  if (addedTo.length) await addServiceToLocations(networkId, key, addedTo);
  return { removedFrom, addedTo };
}

/** F-11-093: «Объединить» — дубли (разные имена) сливаются в одну сетевую услугу под новым именем */
export async function mergeNetworkServices(
  networkId: Id,
  keys: string[],
  newName: LocalizedText,
): Promise<{ key: string }> {
  if (isApiMode()) return Server.mergeNetworkServices(networkId, keys, newName);
  if (keys.length < 2) throw new ApiError("validation", "need 2+");
  if (!newName.ru?.trim()) throw new ApiError("validation", "name required");
  const { core, network } = networkBusinesses(networkId);
  let newKey = "";
  for (const key of keys) {
    const rows = core.services.filter(
      (s) =>
        network.businessIds.includes(s.businessId) && serviceKeyOf(s) === key,
    );
    for (const r of rows) {
      const updated = await coreUpdate("services", r.id, {
        name: newName,
      } as Partial<Service>);
      newKey = serviceKeyOf(updated);
    }
  }
  return { key: newKey };
}

export interface NetworkPackageRow {
  key: string;
  service: Service;
  businessIds: Id[];
}

/** F-11-095: сетевые пакеты — Service.servicePackage, сгруппированные по имени как и обычные услуги */
export function listNetworkPackages(
  networkId: Id,
): Promise<NetworkPackageRow[]> {
  if (isApiMode()) return Server.listNetworkPackages(networkId);
  return request(() => {
    const { core, network } = networkBusinesses(networkId);
    const byKey = new Map<string, NetworkPackageRow>();
    for (const s of core.services.filter(
      (s) => network.businessIds.includes(s.businessId) && s.servicePackage,
    )) {
      const key = serviceKeyOf(s);
      const row = byKey.get(key);
      if (row) row.businessIds.push(s.businessId);
      else byKey.set(key, { key, service: s, businessIds: [s.businessId] });
    }
    return Array.from(byKey.values());
  });
}

/** F-11-095: создать сетевой пакет из 2–10 сетевых услуг в отмеченных филиалах */
export async function createNetworkPackage(
  networkId: Id,
  input: {
    name: LocalizedText;
    itemKeys: string[];
    mode: "parallel" | "sequentialSame" | "sequentialAny";
    businessIds: Id[];
  },
): Promise<{ key: string }> {
  if (!input.name.ru?.trim()) throw new ApiError("validation", "name required");
  if (isApiMode()) return Server.createNetworkPackage(networkId, input);
  if (input.itemKeys.length < 2 || input.itemKeys.length > 10)
    throw new ApiError("validation", "2..10 items");
  if (!input.businessIds.length)
    throw new ApiError("validation", "no locations");
  const { core } = networkBusinesses(networkId);
  let newKey = "";
  for (const businessId of input.businessIds) {
    const category =
      core.serviceCategories.find((c) => c.businessId === businessId) ??
      (await coreCreate("serviceCategories", {
        businessId,
        name: { ru: "Пакеты" },
        order: 0,
      } as Omit<ServiceCategory, "id">));
    const itemServices = input.itemKeys
      .map((k) =>
        core.services.find(
          (s) => s.businessId === businessId && serviceKeyOf(s) === k,
        ),
      )
      .filter((s): s is Service => Boolean(s));
    if (itemServices.length !== input.itemKeys.length) continue; // не все услуги раздали в этот филиал
    const totalDuration = itemServices.reduce(
      (sum, s) => sum + s.durationMin,
      0,
    );
    const totalPrice = itemServices.reduce((sum, s) => sum + s.priceMin, 0);
    const created = await coreCreate("services", {
      businessId,
      categoryId: category.id,
      sphereId: itemServices[0].sphereId,
      name: input.name,
      kind: "individual",
      durationMin: totalDuration,
      priceMin: totalPrice,
      photos: [],
      materials: [],
      staffIds: [],
      workplaces: ["salon"],
      onlineBookable: true,
      active: true,
      order: core.services.filter((s) => s.businessId === businessId).length,
      servicePackage: {
        items: itemServices.map((s, i) => ({ serviceId: s.id, order: i })),
        mode: input.mode,
      },
    } as Omit<Service, "id">);
    newKey = serviceKeyOf(created);
  }
  if (!newKey)
    throw new ApiError(
      "validation",
      "services not distributed to any location",
    );
  return { key: newKey };
}

// ═══════════════════ b03 · Сетевые сотрудники и должности ═══════════════════

function staffKeyOf(s: Pick<Staff, "name" | "id">): string {
  return s.name.trim() || s.id;
}

export interface NetworkStaffDetail {
  key: string;
  staff: Staff;
  businessIds: Id[];
}

/** F-11-099: карточка сетевого сотрудника — во всех филиалах, где он есть */
export function getNetworkStaffMember(
  networkId: Id,
  key: string,
): Promise<NetworkStaffDetail | undefined> {
  if (isApiMode()) return Server.getNetworkStaffMember(networkId, key);
  return request(() => {
    const { core, network } = networkBusinesses(networkId);
    const rows = core.staff.filter(
      (s) =>
        network.businessIds.includes(s.businessId) && staffKeyOf(s) === key,
    );
    if (!rows.length) return undefined;
    return { key, staff: rows[0], businessIds: rows.map((r) => r.businessId) };
  });
}

export interface NetworkStaffFormInput {
  key?: string;
  name: string;
  phone: string;
  email?: string;
  position?: LocalizedText;
  bio?: LocalizedText;
  businessIds: Id[];
}

/** F-11-098/099: создание/правка сетевого сотрудника — данные + «Филиалы» (галочки) */
export async function saveNetworkStaffMember(
  networkId: Id,
  input: NetworkStaffFormInput,
): Promise<{ key: string }> {
  if (isApiMode()) return Server.saveNetworkStaffMember(networkId, input);
  if (!input.name.trim()) throw new ApiError("validation", "name required");
  if (!input.phone.trim()) throw new ApiError("validation", "phone required");
  if (!input.businessIds.length)
    throw new ApiError("validation", "no locations");
  const { core, network } = networkBusinesses(networkId);
  const locations = await listNetworkLocations(networkId);
  const existing = input.key
    ? core.staff.filter(
        (s) =>
          network.businessIds.includes(s.businessId) &&
          staffKeyOf(s) === input.key,
      )
    : [];
  const existingByBusiness = new Map(existing.map((s) => [s.businessId, s]));
  let newKey = input.key ?? "";
  for (const businessId of input.businessIds) {
    const loc = locations.find((l) => l.business.id === businessId)?.location;
    const found = existingByBusiness.get(businessId);
    const patch = {
      name: input.name,
      phone: input.phone,
      email: input.email,
      position: input.position,
      bio: input.bio,
    };
    if (found) {
      await coreUpdate("staff", found.id, patch as Partial<Staff>);
      newKey = staffKeyOf({ ...found, name: input.name });
    } else {
      const created = await coreCreate("staff", {
        businessId,
        locationIds: loc ? [loc.id] : [],
        role: "master",
        sphereIds: [],
        photos: [],
        materials: [],
        workplaces: ["salon"],
        accepts: "all",
        calendarVisibility: "all",
        calendarMode: "free",
        // В-03: новый мастер по умолчанию «с подтверждением» — мастер сам переключает на «сразу»
        confirmMode: "manual",
        colorIndex: (core.staff.length % 8) + 1,
        serviceIds: [],
        status: "active",
        hiredAt: today(),
        ...patch,
      } as Omit<Staff, "id">);
      newKey = staffKeyOf(created);
    }
  }
  for (const s of existing) {
    if (!input.businessIds.includes(s.businessId))
      await coreRemove("staff", s.id);
  }
  return { key: newKey };
}

/** F-11-100: порядок сотрудников сети — общий индекс, применяется в журнале/записи (свой срез) */
export function reorderNetworkStaffOrder(
  networkId: Id,
  orderedKeys: string[],
): Promise<void> {
  if (isApiMode())
    return Server.reorderNetworkStaffOrder(networkId, orderedKeys);
  return request(() => {
    mutateArea("network", (s) => {
      s.staffOrder = { ...s.staffOrder, [networkId]: orderedKeys };
    });
  });
}

export function getNetworkStaffOrder(networkId: Id): Promise<string[]> {
  if (isApiMode()) return Server.getNetworkStaffOrder(networkId);
  return request(() => readArea("network").staffOrder?.[networkId] ?? []);
}

/** F-11-101: уволить / удалить (мягко, status=disabled) / восстановить сетевого сотрудника — во всех филиалах */
export async function setNetworkStaffLifecycle(
  networkId: Id,
  key: string,
  action: "fire" | "delete" | "restore" | "reinstate",
): Promise<void> {
  if (isApiMode())
    return Server.setNetworkStaffLifecycle(networkId, key, action);
  const { core, network } = networkBusinesses(networkId);
  const rows = core.staff.filter(
    (s) => network.businessIds.includes(s.businessId) && staffKeyOf(s) === key,
  );
  const status =
    action === "fire" ? "fired" : action === "delete" ? "disabled" : "active";
  for (const s of rows)
    await coreUpdate("staff", s.id, { status } as Partial<Staff>);
}

/** F-11-102: «Перенести всех»/одного из филиала в сеть — копирует по имени в остальные филиалы сети */
export async function migrateStaffToNetwork(
  networkId: Id,
  fromBusinessId: Id,
  staffIds: Id[] | "all",
): Promise<{ moved: number }> {
  if (isApiMode())
    return Server.migrateStaffToNetwork(networkId, fromBusinessId, staffIds);
  const { core, network } = networkBusinesses(networkId);
  const locations = await listNetworkLocations(networkId);
  const source = core.staff.filter(
    (s) =>
      s.businessId === fromBusinessId &&
      (staffIds === "all" || staffIds.includes(s.id)) &&
      s.status !== "disabled",
  );
  let moved = 0;
  for (const s of source) {
    const targets = network.businessIds.filter((id) => id !== fromBusinessId);
    for (const businessId of targets) {
      const already = core.staff.some(
        (o) => o.businessId === businessId && staffKeyOf(o) === staffKeyOf(s),
      );
      if (already) continue;
      const loc = locations.find((l) => l.business.id === businessId)?.location;
      await coreCreate("staff", {
        businessId,
        locationIds: loc ? [loc.id] : [],
        name: s.name,
        phone: s.phone,
        email: s.email,
        role: s.role,
        position: s.position,
        sphereIds: s.sphereIds,
        avatarUrl: s.avatarUrl,
        bio: s.bio,
        photos: [],
        materials: [],
        workplaces: s.workplaces,
        accepts: s.accepts,
        calendarVisibility: s.calendarVisibility,
        calendarMode: s.calendarMode,
        confirmMode: s.confirmMode,
        colorIndex: s.colorIndex,
        serviceIds: [],
        status: "active",
        hiredAt: today(),
      } as Omit<Staff, "id">);
      moved += 1;
    }
  }
  return { moved };
}

/** F-11-103: «Объединить» — дубли сотрудников сливаются под именем ведущей записи, настройки берутся с неё */
export async function mergeNetworkStaff(
  networkId: Id,
  keys: string[],
  primaryKey: string,
): Promise<{ key: string }> {
  if (keys.length < 2) throw new ApiError("validation", "need 2+");
  if (isApiMode()) return Server.mergeNetworkStaff(networkId, keys, primaryKey);
  const { core, network } = networkBusinesses(networkId);
  const primaryRow = core.staff.find(
    (s) =>
      network.businessIds.includes(s.businessId) &&
      staffKeyOf(s) === primaryKey,
  );
  if (!primaryRow) throw new ApiError("not_found");
  for (const key of keys) {
    if (key === primaryKey) continue;
    const rows = core.staff.filter(
      (s) =>
        network.businessIds.includes(s.businessId) && staffKeyOf(s) === key,
    );
    for (const r of rows) {
      await coreUpdate("staff", r.id, {
        name: primaryRow.name,
        position: primaryRow.position,
        bio: primaryRow.bio,
      } as Partial<Staff>);
    }
  }
  return { key: staffKeyOf({ ...primaryRow }) };
}

/** F-11-104…106: сетевые должности — список и форма (CRUD в своём срезе) */
export function listNetworkPositionEntities(
  networkId: Id,
): Promise<NetworkPosition[]> {
  if (isApiMode()) return Server.listNetworkPositionEntities(networkId);
  return request(() =>
    readArea("network").positions.filter((p) => p.networkId === networkId),
  );
}

export function getNetworkPositionEntity(
  networkId: Id,
  positionId: Id,
): Promise<NetworkPosition | undefined> {
  return request(() =>
    readArea("network").positions.find(
      (p) => p.networkId === networkId && p.id === positionId,
    ),
  );
}

export interface NetworkPositionInput {
  name: string;
  description?: string;
  requirements: string[];
  networkOnly: boolean;
  businessIds: Id[];
  servicesMode: "off" | "strict";
  serviceIds: string[];
  keepPriceAndDuration: boolean;
}

export function saveNetworkPosition(
  networkId: Id,
  input: NetworkPositionInput,
  positionId?: Id,
): Promise<NetworkPosition> {
  if (!input.name.trim())
    return Promise.reject(new ApiError("validation", "name required"));
  if (isApiMode())
    return Server.saveNetworkPosition(networkId, input, positionId);
  return request(() => {
    let saved!: NetworkPosition;
    mutateArea("network", (s) => {
      if (positionId) {
        const existing = s.positions.find(
          (p) => p.id === positionId && p.networkId === networkId,
        );
        if (!existing) throw new ApiError("not_found");
        Object.assign(existing, input, { name: input.name.trim() });
        saved = existing;
      } else {
        saved = {
          id: newId("netpos"),
          networkId,
          createdAt: nowDateTime(),
          ...input,
          name: input.name.trim(),
        };
        s.positions.push(saved);
      }
    });
    return saved;
  });
}

export function deleteNetworkPosition(
  networkId: Id,
  positionId: Id,
): Promise<void> {
  if (isApiMode()) return Server.deleteNetworkPosition(networkId, positionId);
  return request(() => {
    mutateArea("network", (s) => {
      s.positions = s.positions.filter(
        (p) => !(p.id === positionId && p.networkId === networkId),
      );
    });
  });
}

/**
 * F-11-108: типы нерабочих дней сети. `saveNetworkOffDayType`/`deleteNetworkOffDayType` ниже НЕ переведены
 * этим заходом (этап 21, лейн network+reports) — сервер (`NetworkCatalogService.saveOffDayType`) пока умеет
 * только создание, а мок ещё поддерживает правку по `id`; таких вызовов из `src/areas` сейчас нет
 * (`node scripts/facade-audit.mjs` их не числит), поэтому список — реальный, форма/удаление — на моке.
 */
export function listNetworkOffDayTypes(
  networkId: Id,
): Promise<NetworkOffDayType[]> {
  if (isApiMode()) return Server.listNetworkOffDayTypes(networkId);
  return request(() =>
    readArea("network").offDayTypes.filter((o) => o.networkId === networkId),
  );
}

export function saveNetworkOffDayType(
  networkId: Id,
  input: {
    name: string;
    comment?: string;
    colorIndex: number;
    businessIds: Id[];
  },
  id?: Id,
): Promise<NetworkOffDayType> {
  if (!input.name.trim())
    return Promise.reject(new ApiError("validation", "name required"));
  if (isApiMode()) return Server.saveNetworkOffDayType(networkId, input, id);
  return request(() => {
    let saved!: NetworkOffDayType;
    mutateArea("network", (s) => {
      if (id) {
        const existing = s.offDayTypes.find(
          (o) => o.id === id && o.networkId === networkId,
        );
        if (!existing) throw new ApiError("not_found");
        Object.assign(existing, input, { name: input.name.trim() });
        saved = existing;
      } else {
        saved = {
          id: newId("netoff"),
          networkId,
          ...input,
          name: input.name.trim(),
        };
        s.offDayTypes.push(saved);
      }
    });
    return saved;
  });
}

export function deleteNetworkOffDayType(networkId: Id, id: Id): Promise<void> {
  if (isApiMode()) return Server.deleteNetworkOffDayType(networkId, id);
  return request(() => {
    const type = readArea("network").offDayTypes.find((o) => o.id === id);
    if (type?.system) throw new ApiError("validation", "system type");
    mutateArea("network", (s) => {
      s.offDayTypes = s.offDayTypes.filter(
        (o) => !(o.id === id && o.networkId === networkId),
      );
    });
  });
}

/**
 * F-11-109: расчёт зарплат сети — «Создать ведомость и начислить». Пока пишем факт запуска в свой лог
 * (расчёт по правилам — api payroll не отдаёт сетевую функцию, см. qa/requests/network.md).
 */
export function listNetworkPayrollRuns(
  networkId: Id,
): Promise<NetworkPayrollRun[]> {
  if (isApiMode()) return Server.listNetworkPayrollRuns(networkId);
  return request(() =>
    readArea("network")
      .payrollRuns.filter((r) => r.networkId === networkId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
  );
}

/**
 * F-09-096 (payroll, точечная правка по CONVENTIONS §1 «второй проход», qa/requests/payroll.md
 * 2026-09-26): «Создать ведомость и начислить» реально считает и начисляет зарплату по каждому
 * сотруднику каждого выбранного салона — раньше только записывала факт запуска (headcount) без
 * единой ведомости. Движок расчёта принимает businessId по одному (finance's createSettlementSheet,
 * та же функция, что вызывает payroll/StatementNewScreen) — сеть вызывает его в цикле по своим
 * businessIds и суммирует, как договорено с payroll в qa/requests/payroll.md. Один сотрудник без прав
 * или без визитов за период не должен остановить весь сетевой прогон — ошибка по нему проглатывается,
 * остальные ведомости всё равно создаются.
 */
export function createNetworkPayrollRun(
  networkId: Id,
  input: { from: ISODate; to: ISODate; businessIds: Id[]; authorName: string },
): Promise<NetworkPayrollRun> {
  return request(async () => {
    if (!input.businessIds.length)
      throw new ApiError("validation", "no locations");
    // api: readCore() зеркалит только те бизнесы, чьи экраны уже открывали в этой сессии — для чужого филиала
    // сети список сотрудников там может быть пуст. listNetworkStaff бьёт в сервер напрямую (F-11-097).
    const staffList = isApiMode()
      ? (await Server.listNetworkStaff(networkId, { status: "active" })).filter(
          (s) => input.businessIds.includes(s.businessId),
        )
      : readCore().staff.filter(
          (s) =>
            input.businessIds.includes(s.businessId) &&
            s.status !== "disabled" &&
            s.status !== "fired",
        );
    let staffCount = 0;
    for (const s of staffList) {
      try {
        await createSettlementSheet(
          s.businessId,
          s.id,
          `${input.from}T00:00`,
          `${input.to}T23:59`,
          input.authorName ? `${input.authorName} · /group_payroll` : undefined,
          false,
        );
        staffCount += 1;
      } catch {
        // не роняем весь сетевой прогон из-за одного сотрудника — см. комментарий выше
      }
    }
    if (isApiMode())
      return Server.addNetworkPayrollRun(networkId, {
        from: input.from,
        to: input.to,
        businessIds: input.businessIds,
        staffCount,
        authorName: input.authorName,
      });
    const run: NetworkPayrollRun = {
      id: newId("netpay"),
      networkId,
      period: { from: input.from, to: input.to },
      businessIds: input.businessIds,
      staffCount,
      createdAt: nowDateTime(),
      authorName: input.authorName,
    };
    mutateArea("network", (s) => {
      s.payrollRuns = [run, ...s.payrollRuns];
    });
    return run;
  });
}

// ═══════════════════ b03 · Сетевой склад: категории, товары, раздача, архив, остатки ═══════════════════

export interface NetworkGoodsCategoryDetail extends NetworkGoodsCategory {
  businessIds: Id[];
}

/** F-11-112: карточка сетевой категории товаров (своя коллекция + вкладка «Филиалы») */
export function getNetworkGoodsCategoryDetail(
  networkId: Id,
  id: Id,
): Promise<NetworkGoodsCategoryDetail | undefined> {
  if (isApiMode()) return Server.getNetworkGoodsCategoryDetail(networkId, id);
  return request(() => {
    const cat = readArea("network").goodsCategories.find(
      (c) => c.id === id && c.networkId === networkId,
    );
    if (!cat) return undefined;
    const core = readCore();
    const network = core.networks.find((n) => n.id === networkId);
    const businessIds = (network?.businessIds ?? []).filter((bId) =>
      readArea("stock").categories.some(
        (c) => c.businessId === bId && c.name === cat.name,
      ),
    );
    return { ...cat, businessIds };
  });
}

/** F-11-112: сохранить категорию товаров сети — создаёт/переименовывает stock-категорию в отмеченных филиалах */
export async function saveNetworkGoodsCategory(
  networkId: Id,
  input: { id?: Id; name: string; parentId?: Id; businessIds: Id[] },
): Promise<NetworkGoodsCategory> {
  if (!input.name.trim()) throw new ApiError("validation", "name required");
  if (isApiMode()) return Server.saveNetworkGoodsCategory(networkId, input);
  const locations = await listNetworkLocations(networkId);
  let saved!: NetworkGoodsCategory;
  await request(() =>
    mutateArea("network", (s) => {
      if (input.id) {
        const existing = s.goodsCategories.find(
          (c) => c.id === input.id && c.networkId === networkId,
        );
        if (!existing) throw new ApiError("not_found");
        existing.name = input.name.trim();
        existing.parentId = input.parentId;
        saved = existing;
      } else {
        saved = {
          id: newId("goodscat"),
          networkId,
          name: input.name.trim(),
          parentId: input.parentId,
        };
        s.goodsCategories.push(saved);
      }
    }),
  );
  for (const businessId of input.businessIds) {
    const loc = locations.find((l) => l.business.id === businessId)?.location;
    if (!loc) continue;
    const existingCat = readArea("stock").categories.find(
      (c) => c.businessId === businessId && c.name === saved.name,
    );
    if (!existingCat) {
      await stockApi.createCategory(businessId, loc.id, { name: saved.name });
    }
  }
  return saved;
}

export interface NetworkGoodsProductRow {
  key: Id;
  good: Good;
  businessIds: Id[];
}

/** F-11-113: карточка сетевого товара (по networkGroupId, F-08-130) */
export function getNetworkGoodsProduct(
  networkId: Id,
  groupId: Id,
): Promise<NetworkGoodsProductRow | undefined> {
  if (isApiMode()) return Server.getNetworkGoodsProduct(networkId, groupId);
  return request(() => {
    const { network } = networkBusinesses(networkId);
    const rows = readArea("stock").goods.filter(
      (g) =>
        network.businessIds.includes(g.businessId) &&
        (g.networkGroupId === groupId || g.id === groupId),
    );
    if (!rows.length) return undefined;
    const source = rows.find((r) => r.isNetworkSource) ?? rows[0];
    return {
      key: source.id,
      good: source,
      businessIds: rows.map((r) => r.businessId),
    };
  });
}

/** F-11-113: создать сетевой товар в первом отмеченном филиале и раздать по остальным (F-08-135) */
export async function saveNetworkGoodsProduct(
  networkId: Id,
  input: {
    groupId?: Id;
    name: string;
    categoryId: Id;
    salePrice: number;
    costPrice: number;
    comment?: string;
    businessIds: Id[];
  },
): Promise<NetworkGoodsProductRow> {
  if (isApiMode()) return Server.saveNetworkGoodsProduct(networkId, input);
  if (!input.name.trim()) throw new ApiError("validation", "name required");
  if (!input.businessIds.length)
    throw new ApiError("validation", "no locations");
  const locations = await listNetworkLocations(networkId);
  const goodInput: stockApi.GoodInput = {
    categoryId: input.categoryId,
    name: input.name.trim(),
    saleUnit: "pcs",
    writeoffUnit: "pcs",
    unitRatio: 1,
    salePrice: input.salePrice,
    costPrice: input.costPrice,
    taxSystem: "default",
    taxRate: "default",
    criticalStock: 0,
    desiredStock: 0,
    showToClients: false,
    comment: input.comment,
  };
  if (input.groupId) {
    const existing = readArea("stock").goods.find(
      (g) => g.id === input.groupId,
    );
    if (!existing) throw new ApiError("not_found");
    await stockApi.updateGood(existing.businessId, existing.id, {
      ...goodInput,
      categoryId: existing.categoryId,
    });
    const already = readArea("stock").goods.filter(
      (g) => g.networkGroupId === (existing.networkGroupId ?? existing.id),
    );
    const missing = input.businessIds.filter(
      (id) =>
        id !== existing.businessId && !already.some((g) => g.businessId === id),
    );
    if (missing.length)
      await stockApi.copyGoodToLocationsNetworked(
        existing.businessId,
        existing.id,
        missing,
      );
    const result = await getNetworkGoodsProduct(
      networkId,
      existing.networkGroupId ?? existing.id,
    );
    return result!;
  }
  const firstBusinessId = input.businessIds[0];
  const loc = locations.find(
    (l) => l.business.id === firstBusinessId,
  )?.location;
  if (!loc) throw new ApiError("validation", "no location");
  const created = await stockApi.createGood(firstBusinessId, loc.id, goodInput);
  const rest = input.businessIds.slice(1);
  if (rest.length)
    await stockApi.copyGoodToLocationsNetworked(
      firstBusinessId,
      created.id,
      rest,
    );
  const result = await getNetworkGoodsProduct(networkId, created.id);
  return result!;
}

/** F-11-114: «Добавить все товары в локацию» — копирует все сетевые (уже раздаваемые ≥2 филиалам) товары в цель */
export async function addAllGoodsToLocation(
  networkId: Id,
  targetBusinessId: Id,
): Promise<{ added: number }> {
  if (isApiMode())
    return Server.addAllGoodsToLocation(networkId, targetBusinessId);
  const { network } = networkBusinesses(networkId);
  const goods = readArea("stock").goods.filter(
    (g) => network.businessIds.includes(g.businessId) && g.isNetworkSource,
  );
  let added = 0;
  for (const g of goods) {
    const exists = readArea("stock").goods.some(
      (o) =>
        o.businessId === targetBusinessId &&
        o.networkGroupId === (g.networkGroupId ?? g.id),
    );
    if (exists) continue;
    await stockApi.copyGoodToLocationsNetworked(g.businessId, g.id, [
      targetBusinessId,
    ]);
    added += 1;
  }
  return { added };
}

/** F-11-114/118: архивировать выбранные сетевые товары во всех филиалах, где они есть */
export async function archiveNetworkGoods(
  networkId: Id,
  groupIds: Id[],
): Promise<void> {
  if (isApiMode()) return Server.archiveNetworkGoods(networkId, groupIds);
  const { network } = networkBusinesses(networkId);
  for (const groupId of groupIds) {
    const rows = readArea("stock").goods.filter(
      (g) =>
        network.businessIds.includes(g.businessId) &&
        (g.networkGroupId === groupId || g.id === groupId),
    );
    for (const r of rows) await stockApi.archiveGood(r.businessId, r.id);
    if (rows.length) {
      await request(() =>
        mutateArea("network", (s) => {
          s.goodsArchive = [
            {
              id: newId("goodsarch"),
              networkId,
              kind: "good",
              name: rows[0].name,
              archivedAt: nowDateTime(),
            },
            ...s.goodsArchive,
          ];
        }),
      );
    }
  }
}

export interface NetworkGoodsArchiveRow extends NetworkGoodsArchiveEntry {
  restorable: boolean;
}

/** F-11-118: архив товаров сети — «Восстановить» доступно, только если товар остался сетевым (2+ филиала) */
export function listNetworkGoodsArchive(
  networkId: Id,
): Promise<NetworkGoodsArchiveRow[]> {
  if (isApiMode()) return Server.listNetworkGoodsArchive(networkId);
  return request(() => {
    const { network } = networkBusinesses(networkId);
    return readArea("network")
      .goodsArchive.filter((a) => a.networkId === networkId)
      .map((a) => {
        const rows = readArea("stock").goods.filter(
          (g) =>
            network.businessIds.includes(g.businessId) && g.name === a.name,
        );
        return { ...a, restorable: rows.length >= 2 };
      });
  });
}

export async function restoreNetworkGoods(
  networkId: Id,
  name: string,
): Promise<void> {
  if (isApiMode()) return Server.restoreNetworkGoods(networkId, name);
  const { network } = networkBusinesses(networkId);
  const rows = readArea("stock").goods.filter(
    (g) => network.businessIds.includes(g.businessId) && g.name === name,
  );
  for (const r of rows) await stockApi.restoreGood(r.businessId, r.id);
  await request(() =>
    mutateArea("network", (s) => {
      s.goodsArchive = s.goodsArchive.filter(
        (a) => !(a.networkId === networkId && a.name === name),
      );
    }),
  );
}

export async function deleteNetworkGoodsArchiveEntry(
  networkId: Id,
  id: Id,
): Promise<void> {
  if (isApiMode())
    return Server.deleteNetworkGoodsArchiveEntry(networkId, id);
  await request(() =>
    mutateArea("network", (s) => {
      s.goodsArchive = s.goodsArchive.filter(
        (a) => !(a.id === id && a.networkId === networkId),
      );
    }),
  );
}

/** F-11-116: «Миграция в сеть» — перенос категорий/товаров филиала в сеть (раздача по остальным, F-08-135) */
export async function migrateGoodsToNetwork(
  networkId: Id,
  fromBusinessId: Id,
  goodIds: Id[] | "all",
): Promise<{ moved: number }> {
  if (isApiMode())
    return Server.migrateGoodsToNetwork(networkId, fromBusinessId, goodIds);
  const { network } = networkBusinesses(networkId);
  const targets = network.businessIds.filter((id) => id !== fromBusinessId);
  const source = readArea("stock").goods.filter(
    (g) =>
      g.businessId === fromBusinessId &&
      !g.archived &&
      (goodIds === "all" || goodIds.includes(g.id)),
  );
  let moved = 0;
  for (const g of source) {
    if (!targets.length) continue;
    await stockApi.copyGoodToLocationsNetworked(fromBusinessId, g.id, targets);
    moved += 1;
  }
  return { moved };
}

/** F-11-117: «Объединить» — категория/товар филиала объединяется с сетевым (настройки — с сетевого) */
export async function mergeGoodIntoNetworkGroup(
  networkId: Id,
  localGoodId: Id,
  networkGroupId: Id,
): Promise<void> {
  if (isApiMode())
    return Server.mergeGoodIntoNetworkGroup(networkId, localGoodId, networkGroupId);
  const local = readArea("stock").goods.find((g) => g.id === localGoodId);
  const source = readArea("stock").goods.find((g) => g.id === networkGroupId);
  if (!local || !source) throw new ApiError("not_found");
  await stockApi.updateGood(local.businessId, local.id, {
    categoryId: local.categoryId,
    name: source.name,
    saleUnit: source.saleUnit,
    writeoffUnit: source.writeoffUnit,
    unitRatio: source.unitRatio,
    salePrice: local.salePrice,
    costPrice: local.costPrice,
    taxSystem: source.taxSystem,
    taxRate: source.taxRate,
    criticalStock: local.criticalStock,
    desiredStock: local.desiredStock,
    showToClients: source.showToClients,
    clientName: source.clientName,
  });
  // Пишем в чужой срез напрямую — просьба в qa/requests/network.md: нужна функция stockApi.setGoodNetworkGroup().
  await request(() =>
    mutateArea("stock", (s) => {
      const g = s.goods.find((x: Good) => x.id === local.id);
      if (g) {
        g.networkGroupId = source.networkGroupId ?? source.id;
        g.isNetworkSource = false;
      }
    }),
  );
}

export interface NetworkGoodsStockRow {
  key: Id;
  name: string;
  byBusiness: { businessId: Id; qty: number }[];
  total: number;
}

/** F-11-120: остатки каждого сетевого товара по филиалам (чтение складов филиалов через api stock) */
export async function getNetworkGoodsStock(
  networkId: Id,
): Promise<NetworkGoodsStockRow[]> {
  if (isApiMode()) return Server.getNetworkGoodsStock(networkId);
  const { network } = networkBusinesses(networkId);
  const groups = new Map<Id, Good[]>();
  for (const g of readArea("stock").goods.filter(
    (g) => network.businessIds.includes(g.businessId) && g.networkGroupId,
  )) {
    const key = g.networkGroupId!;
    groups.set(key, [...(groups.get(key) ?? []), g]);
  }
  const rows: NetworkGoodsStockRow[] = [];
  for (const [key, list] of groups) {
    if (list.length < 2) continue;
    const byBusiness = await Promise.all(
      list.map(async (g) => ({
        businessId: g.businessId,
        qty: (await stockApi.computeLevels(g.businessId, g.id)).reduce(
          (sum, l) => sum + l.qty,
          0,
        ),
      })),
    );
    rows.push({
      key,
      name: list[0].name,
      byBusiness,
      total: byBusiness.reduce((sum, b) => sum + b.qty, 0),
    });
  }
  return request(() => rows);
}

export type { Client };

// ═══════════════════ b03fix1 · Вклады network в serviceCard/staffCard (host ждёт регистрации в
// src/extensions/pairs.ts — qa/requests/network.md) ═══════════════════

export interface ServiceCardNetworkInfo {
  networkId: Id;
  key: string;
  priceLocked: boolean;
  descriptionLocked: boolean;
  businessCount: number;
}

/** F-11-082/083: сетевой ли этот локальный сервис и что заблокировано (для serviceCard host) */
/**
 * Сеть4: услуги бизнеса, чью цену сеть запретила менять в филиалах (F-11-082) — раздел «Услуги» по этому списку
 * закрывает правку цены (строка каталога, карточка услуги). Одним запросом на бизнес, а не по услуге.
 */
export function listPriceLockedServiceIds(businessId: Id): Promise<Id[]> {
  if (isApiMode()) return Server.listPriceLockedServiceIds(businessId);
  return request(() => {
    const core = readCore();
    const network = core.networks.find((n) => n.businessIds.includes(businessId));
    if (!network) return [];
    const locks = readArea("network").serviceLocks.filter((l) => l.networkId === network.id && l.priceLocked);
    if (!locks.length) return [];
    const keys = new Set(locks.map((l) => l.key));
    const siblings = new Map<string, number>();
    for (const sv of core.services) {
      if (network.businessIds.includes(sv.businessId)) siblings.set(serviceKeyOf(sv), (siblings.get(serviceKeyOf(sv)) ?? 0) + 1);
    }
    return core.services
      .filter((sv) => sv.businessId === businessId && keys.has(serviceKeyOf(sv)) && (siblings.get(serviceKeyOf(sv)) ?? 0) >= 2)
      .map((sv) => sv.id);
  });
}

export function getServiceNetworkInfo(
  serviceId: Id,
): Promise<ServiceCardNetworkInfo | undefined> {
  if (isApiMode()) return Server.getServiceNetworkInfo(serviceId);
  return request(() => {
    const core = readCore();
    const service = core.services.find((s) => s.id === serviceId);
    if (!service) return undefined;
    const network = core.networks.find((n) =>
      n.businessIds.includes(service.businessId),
    );
    if (!network) return undefined;
    const key = serviceKeyOf(service);
    const siblingCount = core.services.filter(
      (s) =>
        network.businessIds.includes(s.businessId) && serviceKeyOf(s) === key,
    ).length;
    if (siblingCount < 2) return undefined; // не раздано больше чем в 1 филиал — не считается сетевым
    const lock = readArea("network").serviceLocks.find(
      (l) => l.networkId === network.id && l.key === key,
    );
    return {
      networkId: network.id,
      key,
      priceLocked: lock?.priceLocked ?? false,
      descriptionLocked: lock?.descriptionLocked ?? false,
      businessCount: siblingCount,
    };
  });
}

export interface StaffCardNetworkInfo {
  networkId: Id;
  key: string;
  businessCount: number;
}

/** F-11-099: сетевой ли этот локальный сотрудник — правка только в сети (для staffCard host) */
export function getStaffNetworkInfo(
  staffId: Id,
): Promise<StaffCardNetworkInfo | undefined> {
  if (isApiMode()) return Server.getStaffNetworkInfo(staffId);
  return request(() => {
    const core = readCore();
    const staff = core.staff.find((s) => s.id === staffId);
    if (!staff) return undefined;
    const network = core.networks.find((n) =>
      n.businessIds.includes(staff.businessId),
    );
    if (!network) return undefined;
    const key = staffKeyOf(staff);
    const siblingCount = core.staff.filter(
      (s) =>
        network.businessIds.includes(s.businessId) && staffKeyOf(s) === key,
    ).length;
    if (siblingCount < 2) return undefined;
    return { networkId: network.id, key, businessCount: siblingCount };
  });
}

// ═══════════════════ b04 · Доп. поля, пользователи и права, телефония, новые филиалы (F-11-008…010,
// F-11-025…036, F-11-127…133, F-11-147…152, F-11-156, F-11-161) ═══════════════════

import type {
  NetworkCallHistoryStorage,
  NetworkCallRecord,
  NetworkField,
  NetworkFieldDataType,
  NetworkFieldKind,
  NetworkTelephonyRoute,
  NetworkTelephonyRule,
} from "@/domain/network";
import { toCsv } from "@/lib/csv";

// ─────────────────────── Доп. поля сети (F-11-126…134) ───────────────────────

const FIELD_API_KEY_RE = /^[a-zA-Z0-9._-]+$/;

export interface NetworkFieldInput {
  kind: NetworkFieldKind;
  name: string;
  dataType: NetworkFieldDataType;
  apiKey: string;
  listOptions: string[];
  editableByUser: boolean;
  showInAdmin: boolean;
  alwaysShowInBookingWindow: boolean;
  requiredOnCreate: boolean;
  requiredOnArrived: boolean;
  alwaysShowInClientCard: boolean;
  showInWidget: boolean;
  requiredInWidget: boolean;
  businessIds: Id[];
}

export function listNetworkFields(
  networkId: Id,
  kind?: NetworkFieldKind,
): Promise<NetworkField[]> {
  if (isApiMode()) return Server.listNetworkFields(networkId, kind);
  return request(() =>
    readArea("network").fields.filter(
      (f) => f.networkId === networkId && (!kind || f.kind === kind),
    ),
  );
}

/** F-11-127/128/129/130/131: одна форма для полей записи и клиента, валидация ключа API и локаций */
export function saveNetworkField(
  networkId: Id,
  input: NetworkFieldInput,
  id?: Id,
): Promise<NetworkField> {
  if (isApiMode()) return Server.saveNetworkField(networkId, input, id);
  return netRequestIn("fields", networkId, () => {
    const name = input.name.trim();
    if (!name) throw new ApiError("validation", "name required");
    const apiKey = input.apiKey.trim();
    if (!apiKey || !FIELD_API_KEY_RE.test(apiKey))
      throw new ApiError("validation", "invalid_api_key");
    const network = readCore().networks.find((n) => n.id === networkId);
    if (!network) throw new ApiError("not_found");
    // F-11-130: у сети из одного филиала поле отмечено само; иначе нужен хотя бы один
    const businessIds =
      network.businessIds.length === 1
        ? [...network.businessIds]
        : input.businessIds;
    if (!businessIds.length)
      throw new ApiError("validation", "locations_required");
    // F-11-129: «Дата и время» никогда не выводится в виджет
    const showInWidget =
      input.dataType === "datetime" ? false : input.showInWidget;
    const listOptions =
      input.dataType === "list"
        ? input.listOptions.map((o) => o.trim()).filter(Boolean)
        : [];
    let saved: NetworkField | undefined;
    mutateArea("network", (s) => {
      const dup = s.fields.find(
        (f) =>
          f.networkId === networkId &&
          f.kind === input.kind &&
          f.apiKey === apiKey &&
          f.id !== id,
      );
      if (dup) throw new ApiError("validation", "api_key_taken");
      if (id) {
        const existing = s.fields.find((f) => f.id === id);
        if (!existing) throw new ApiError("not_found");
        Object.assign(existing, {
          name,
          dataType: input.dataType,
          apiKey,
          listOptions,
          editableByUser: input.editableByUser,
          showInAdmin: input.showInAdmin,
          alwaysShowInBookingWindow: input.alwaysShowInBookingWindow,
          requiredOnCreate: input.requiredOnCreate,
          requiredOnArrived: input.requiredOnArrived,
          alwaysShowInClientCard: input.alwaysShowInClientCard,
          showInWidget,
          requiredInWidget: showInWidget ? input.requiredInWidget : false,
          businessIds,
        });
        saved = existing;
      } else {
        const created: NetworkField = {
          id: newId("netfield"),
          networkId,
          kind: input.kind,
          name,
          dataType: input.dataType,
          apiKey,
          listOptions,
          editableByUser: input.editableByUser,
          showInAdmin: input.showInAdmin,
          alwaysShowInBookingWindow: input.alwaysShowInBookingWindow,
          requiredOnCreate: input.requiredOnCreate,
          requiredOnArrived: input.requiredOnArrived,
          alwaysShowInClientCard: input.alwaysShowInClientCard,
          showInWidget,
          requiredInWidget: showInWidget ? input.requiredInWidget : false,
          businessIds,
          createdAt: nowDateTime(),
        };
        s.fields.push(created);
        saved = created;
      }
    });
    return saved!;
  });
}

/** F-11-132: удаление поля подтверждается словом (проверка слова — в экране, здесь сама операция) */
export function deleteNetworkField(networkId: Id, id: Id): Promise<void> {
  if (isApiMode()) return Server.deleteNetworkField(networkId, id);
  return netRequestIn("fields", networkId, () => {
    mutateArea("network", (s) => {
      const field = s.fields.find(
        (f) => f.id === id && f.networkId === networkId,
      );
      if (!field) throw new ApiError("not_found");
      s.fields = s.fields.filter((f) => f.id !== id);
    });
  });
}

// ─────────────────────── Пользователи сети (F-11-025…036) ───────────────────────

/** F-11-036: правило оплаты — первый администратор бесплатно, дальше — по 2 000 ֏ (наше решение) */
export const NETWORK_USER_FREE_COUNT = 1;
export const NETWORK_USER_PRICE = 2000;

export interface NetworkUserPricingInfo {
  freeCount: number;
  pricePerExtra: number;
  paidUsersCount: number;
  hasPaidLocation: boolean;
}

function hasPaidLocationSync(networkId: Id): boolean {
  const core = readCore();
  const network = core.networks.find((n) => n.id === networkId);
  if (!network) return false;
  const subs = readArea("network").subscriptions;
  const t = today();
  return network.businessIds.some((id) => {
    const sub = subs.find((s) => s.businessId === id);
    return Boolean(sub && sub.until >= t);
  });
}

/** F-11-027/036: правило оплаты и условие приглашения — видно до добавления пользователя */
export function getNetworkUserPricing(
  networkId: Id,
): Promise<NetworkUserPricingInfo> {
  if (isApiMode()) return Server.getNetworkUserPricing(networkId);
  return request(() => {
    const users = readArea("network").users.filter(
      (u) => u.networkId === networkId && !u.pending,
    );
    return {
      freeCount: NETWORK_USER_FREE_COUNT,
      pricePerExtra: NETWORK_USER_PRICE,
      paidUsersCount: Math.max(0, users.length - NETWORK_USER_FREE_COUNT),
      hasPaidLocation: hasPaidLocationSync(networkId),
    };
  });
}

/** F-11-025: приглашение по телефону — если такой сотрудник уже есть в аккаунте, добавляем сразу; иначе — «в ожидании» */
export function inviteNetworkUser(
  networkId: Id,
  phone: string,
): Promise<NetworkUser> {
  if (isApiMode()) return Server.inviteNetworkUser(networkId, phone);
  return netRequestIn("users", networkId, () => {
    if (!hasPaidLocationSync(networkId))
      throw new ApiError("validation", "no_paid_location");
    const trimmed = phone.trim();
    if (!trimmed) throw new ApiError("validation", "phone required");
    const existing = readArea("network").users.find(
      (u) => u.networkId === networkId && u.phone === trimmed,
    );
    if (existing) throw new ApiError("validation", "already_member");
    const core = readCore();
    const staff = core.staff.find((s) => s.phone === trimmed);
    let created: NetworkUser | undefined;
    mutateArea("network", (s) => {
      created = {
        id: newId("net-user"),
        networkId,
        name: staff?.name ?? trimmed,
        phone: trimmed,
        email: staff?.email,
        permissions: [],
        pending: !staff,
      };
      s.users.push(created);
    });
    return created!;
  });
}

export interface CreateNetworkUserInput {
  name: string;
  phone?: string;
  login: string;
  password: string;
}

/** F-11-026: пользователь без аккаунта — создаётся сразу с логином и паролем (пароль не хранится, демо) */
export function createNetworkUser(
  networkId: Id,
  input: CreateNetworkUserInput,
): Promise<NetworkUser> {
  if (isApiMode()) return Server.createNetworkUser(networkId, input);
  return netRequestIn("users", networkId, () => {
    if (!hasPaidLocationSync(networkId))
      throw new ApiError("validation", "no_paid_location");
    const name = input.name.trim();
    const login = input.login.trim();
    if (!name || !login || !input.password)
      throw new ApiError("validation", "fields required");
    let created: NetworkUser | undefined;
    mutateArea("network", (s) => {
      if (s.users.some((u) => u.networkId === networkId && u.login === login))
        throw new ApiError("validation", "login_taken");
      created = {
        id: newId("net-user"),
        networkId,
        name,
        phone: input.phone?.trim() || undefined,
        login,
        permissions: [],
      };
      s.users.push(created);
    });
    return created!;
  });
}

export function updateNetworkUser(
  networkId: Id,
  id: Id,
  patch: { name: string; phone?: string; email?: string },
): Promise<NetworkUser> {
  if (isApiMode()) return Server.updateNetworkUser(networkId, id, patch);
  return netRequestIn("users", networkId, () => {
    const name = patch.name.trim();
    if (!name) throw new ApiError("validation", "name required");
    let updated: NetworkUser | undefined;
    mutateArea("network", (s) => {
      const user = s.users.find(
        (u) => u.id === id && u.networkId === networkId,
      );
      if (!user) throw new ApiError("not_found");
      user.name = name;
      user.phone = patch.phone?.trim() || undefined;
      user.email = patch.email?.trim() || undefined;
      updated = user;
    });
    return updated!;
  });
}

/** F-11-028: владельца убрать нельзя */
export function removeNetworkUser(networkId: Id, id: Id): Promise<void> {
  if (isApiMode()) return Server.removeNetworkUser(networkId, id);
  return netRequestIn("users", networkId, () => {
    mutateArea("network", (s) => {
      const user = s.users.find(
        (u) => u.id === id && u.networkId === networkId,
      );
      if (!user) throw new ApiError("not_found");
      if (user.isOwner) throw new ApiError("validation", "cannot_remove_owner");
      s.users = s.users.filter((u) => u.id !== id);
    });
  });
}

/** F-11-029…035: группы прав сети — «Снять все» / «Дать все» считаются на экране, здесь только запись набора */
export function setNetworkUserPermissions(
  networkId: Id,
  id: Id,
  permissions: NetworkPermissionKey[],
  /** Сеть7: филиалы, к которым у пользователя доступ; undefined — не менять, [] нельзя (хотя бы один) */
  businessIds?: Id[],
): Promise<NetworkUser> {
  if (isApiMode()) return Server.setNetworkUserPermissions(networkId, id, permissions, businessIds);
  return netRequestIn("users", networkId, () => {
    if (businessIds && !businessIds.length) throw new ApiError("validation", "no locations");
    const network = readCore().networks.find((n) => n.id === networkId);
    let updated: NetworkUser | undefined;
    mutateArea("network", (s) => {
      const user = s.users.find(
        (u) => u.id === id && u.networkId === networkId,
      );
      if (!user) throw new ApiError("not_found");
      if (user.isOwner) return; // владельцу права не меняем — они всегда полные
      user.permissions = permissions;
      if (businessIds) {
        const own = businessIds.filter((b) => network?.businessIds.includes(b));
        // все филиалы сети = без ограничения (новый филиал тоже будет виден)
        user.businessIds = own.length === network?.businessIds.length ? undefined : own;
      }
      updated = user;
    });
    return updated ?? readArea("network").users.find((u) => u.id === id)!;
  });
}

/** F-11-030: как часто присылать письмо о выполнении плана */
export function setNetworkUserPlanReportFrequency(
  networkId: Id,
  id: Id,
  frequency: "off" | "daily" | "weekly" | "monthly",
): Promise<void> {
  return request(() => {
    mutateArea("network", (s) => {
      const user = s.users.find(
        (u) => u.id === id && u.networkId === networkId,
      );
      if (!user) throw new ApiError("not_found");
      user.planReportFrequency = frequency;
    });
  });
}

// ─────────────────────── Телефония сети (F-11-147…152) ───────────────────────

export interface NetworkTelephonyRouteInput {
  name: string;
  userIds: Id[];
  businessIds: Id[];
  historyStorage: NetworkCallHistoryStorage;
}

export function listNetworkTelephonyRoutes(
  networkId: Id,
): Promise<NetworkTelephonyRoute[]> {
  if (isApiMode()) return Server.listNetworkTelephonyRoutes(networkId);
  return request(() =>
    readArea("network").telephonyRoutes.filter(
      (r) => r.networkId === networkId,
    ),
  );
}

export function saveNetworkTelephonyRoute(
  networkId: Id,
  input: NetworkTelephonyRouteInput,
  id?: Id,
): Promise<NetworkTelephonyRoute> {
  if (isApiMode()) {
    if (!input.name.trim()) return Promise.reject(new ApiError("validation", "name required"));
    if (!input.businessIds.length) return Promise.reject(new ApiError("validation", "locations_required"));
    return Server.saveNetworkTelephonyRoute(networkId, { ...input, name: input.name.trim() }, id);
  }
  return request(() => {
    const name = input.name.trim();
    if (!name) throw new ApiError("validation", "name required");
    if (!input.businessIds.length)
      throw new ApiError("validation", "locations_required");
    let saved: NetworkTelephonyRoute | undefined;
    mutateArea("network", (s) => {
      if (id) {
        const existing = s.telephonyRoutes.find((r) => r.id === id);
        if (!existing) throw new ApiError("not_found");
        Object.assign(existing, {
          name,
          userIds: input.userIds,
          businessIds: input.businessIds,
          historyStorage: input.historyStorage,
        });
        saved = existing;
      } else {
        const created: NetworkTelephonyRoute = {
          id: newId("net-route"),
          networkId,
          name,
          isDefault: false,
          userIds: input.userIds,
          businessIds: input.businessIds,
          historyStorage: input.historyStorage,
          createdAt: nowDateTime(),
        };
        s.telephonyRoutes.push(created);
        saved = created;
      }
    });
    return saved!;
  });
}

export function listNetworkTelephonyRules(
  networkId: Id,
): Promise<NetworkTelephonyRule[]> {
  if (isApiMode()) return Server.listNetworkTelephonyRules(networkId);
  return request(() =>
    readArea("network").telephonyRules.filter((r) => r.networkId === networkId),
  );
}

const RULE_DIGITS_RE = /^\d+$/;

/** F-11-149: идентификатор — только цифры; звонок на номер уходит по маршруту его правила (F-11-149) */
export function saveNetworkTelephonyRule(
  networkId: Id,
  input: { kind: "phone" | "sip"; identifier: string; routeId: Id },
): Promise<NetworkTelephonyRule> {
  if (isApiMode()) {
    const identifier = input.identifier.trim();
    if (!identifier || !RULE_DIGITS_RE.test(identifier)) return Promise.reject(new ApiError("validation", "digits_only"));
    if (!input.routeId) return Promise.reject(new ApiError("validation", "route_required"));
    return Server.saveNetworkTelephonyRule(networkId, { ...input, identifier });
  }
  return request(() => {
    const identifier = input.identifier.trim();
    if (!identifier || !RULE_DIGITS_RE.test(identifier))
      throw new ApiError("validation", "digits_only");
    if (!input.routeId) throw new ApiError("validation", "route_required");
    let created: NetworkTelephonyRule | undefined;
    mutateArea("network", (s) => {
      if (
        s.telephonyRules.some(
          (r) => r.networkId === networkId && r.identifier === identifier,
        )
      )
        throw new ApiError("validation", "identifier_taken");
      created = {
        id: newId("net-rule"),
        networkId,
        kind: input.kind,
        identifier,
        routeId: input.routeId,
      };
      s.telephonyRules.push(created);
    });
    return created!;
  });
}

export function deleteNetworkTelephonyRule(
  networkId: Id,
  id: Id,
): Promise<void> {
  if (isApiMode()) return Server.deleteNetworkTelephonyRule(networkId, id);
  return request(() => {
    mutateArea("network", (s) => {
      s.telephonyRules = s.telephonyRules.filter(
        (r) => !(r.id === id && r.networkId === networkId),
      );
    });
  });
}

/** F-11-150: история звонков сети; для конкретной локации — только те, что разрешил ей маршрут */
export function listNetworkCalls(
  networkId: Id,
  businessId?: Id,
): Promise<NetworkCallRecord[]> {
  // Р19: чужая АТС — сервер хранит только настройки, звонков не знает; фильтр по маршруту на пустом списке не нужен
  if (isApiMode()) return Server.listNetworkCalls(networkId);
  return request(() => {
    const rows = readArea("network").calls.filter(
      (c) => c.networkId === networkId,
    );
    if (!businessId) return rows.sort((a, b) => b.at.localeCompare(a.at));
    const routes = readArea("network").telephonyRoutes.filter(
      (r) => r.networkId === networkId && r.businessIds.includes(businessId),
    );
    const routeIds = new Set(routes.map((r) => r.id));
    return rows
      .filter((c) => c.routeId && routeIds.has(c.routeId))
      .sort((a, b) => b.at.localeCompare(a.at));
  });
}

/** F-11-152: последний ПРИНЯТЫЙ звонок сети — подсказка «что проверить», если новые не приходят */
export function getLastAcceptedNetworkCall(
  networkId: Id,
): Promise<NetworkCallRecord | undefined> {
  if (isApiMode()) return Server.listNetworkCalls(networkId).then((rows) => rows.filter((c) => c.status === "accepted").sort((a, b) => b.at.localeCompare(a.at))[0]);
  return request(
    () =>
      readArea("network")
        .calls.filter(
          (c) => c.networkId === networkId && c.status === "accepted",
        )
        .sort((a, b) => b.at.localeCompare(a.at))[0],
  );
}

// ─────────────────────── Новые филиалы (F-11-008…010, F-11-156) ───────────────────────

export interface NetworkBranchDailyStat {
  businessId: Id;
  revenue: number;
  bookingsCount: number;
}

/** F-11-156: статистика каждого филиала за один день — для быстрого переключения в приложении */
export function getNetworkBranchDailyStats(
  businessIds: Id[],
  date: ISODate,
): Promise<NetworkBranchDailyStat[]> {
  if (isApiMode()) {
    if (!businessIds.length) return Promise.resolve([]);
    // Фасад не несёт businessId/networkId (F-11-156) — маршрут по филиалу ПЕРВОГО запрошенного бизнеса, тот
    // же приём, что у setNetworkMarketingOptOut рядом (F-11-058): сервер сам пересекает businessIds с
    // бизнесами ЕГО сети, чужой филиал в список не проникает.
    return Server.getNetworkBranchDailyStats(businessIds[0], businessIds, date);
  }
  return request(() => {
    const core = readCore();
    return businessIds.map((businessId) => {
      // Сеть5: как в журнале — без отменённых и удалённых (occupiesTime = isActiveBooking журнала)
      const bookings = core.bookings.filter(
        (b) => b.businessId === businessId && datePart(b.start) === date && occupiesTime(b),
      );
      const arrived = bookings.filter((b) => b.status === "arrived");
      return {
        businessId,
        revenue: arrived.reduce((sum, b) => sum + b.total, 0),
        bookingsCount: bookings.length,
      };
    });
  });
}

/** Сеть14: сводные финансы сети по филиалам за период — выручка визитов, число визитов, средний чек, отмены */
export interface NetworkFinanceRow {
  businessId: Id;
  businessName: string;
  revenue: number;
  visits: number;
  avgCheck: number;
  cancelled: number;
}

export function getNetworkFinanceSummary(
  networkId: Id,
  from: ISODate,
  to: ISODate,
): Promise<NetworkFinanceRow[]> {
  if (isApiMode()) return Server.getNetworkFinanceSummary(networkId, from, to);
  return netRequestIn("analytics", networkId, () => {
    const { core, network } = networkBusinesses(networkId);
    return network.businessIds.map((businessId) => {
      const inPeriod = core.bookings.filter(
        (b) => b.businessId === businessId && !b.deletedAt && datePart(b.start) >= from && datePart(b.start) <= to,
      );
      const arrived = inPeriod.filter((b) => b.status === "arrived");
      const revenue = arrived.reduce((sum, b) => sum + b.total, 0);
      return {
        businessId,
        businessName: core.businesses.find((b) => b.id === businessId)?.name ?? businessId,
        revenue,
        visits: arrived.length,
        avgCheck: arrived.length ? Math.round(revenue / arrived.length) : 0,
        cancelled: inPeriod.filter((b) => !occupiesTime(b)).length,
      };
    });
  });
}

/**
 * F-11-009: перенос услуг/сотрудников/товаров в новый филиал из уже существующего (наше решение — сразу,
 * без менеджера внедрения). Несколько операций подряд, как и `migrateGoodsToNetwork` выше в этом файле:
 * каждый вызов — своя транзакция (coreCreate / stockApi.*), здесь только последовательность и подсчёт.
 */
export async function copyBranchData(input: {
  networkId: Id;
  fromBusinessId: Id;
  toBusinessId: Id;
  services: boolean;
  staff: boolean;
  goods: boolean;
}): Promise<{
  servicesCopied: number;
  staffCopied: number;
  goodsCopied: number;
}> {
  const network = await getNetwork(input.networkId);
  if (
    !network.businessIds.includes(input.fromBusinessId) ||
    !network.businessIds.includes(input.toBusinessId)
  )
    throw new ApiError("validation", "not_in_network");
  let servicesCopied = 0;
  let staffCopied = 0;
  let goodsCopied = 0;
  if (isApiMode()) {
    // Этап 21 «Сдача»: услуги и товары копирует сервер одной командой; сотрудников — обычный addStaff филиала
    // (тот же путь, что saveNetworkStaffMember), без телефона: номер исходного мастера занят его карточкой.
    const res = await Server.copyBranchServicesAndGoods(input.networkId, {
      fromBusinessId: input.fromBusinessId,
      toBusinessId: input.toBusinessId,
      services: input.services,
      goods: input.goods,
    });
    if (input.staff) {
      const { addStaff, listStaff } = await import("@/api/staff.server");
      const locations = await listNetworkLocations(input.networkId);
      const toLoc = locations.find((l) => l.business.id === input.toBusinessId)?.location;
      for (const { staff: st } of await listStaff(input.fromBusinessId)) {
        if (st.status === "fired") continue;
        await addStaff({
          businessId: input.toBusinessId,
          locationIds: toLoc ? [toLoc.id] : [],
          name: st.name,
          // владелец у бизнеса один — его копия в новом филиале становится администратором
          role: st.role === "owner" ? "admin" : st.role,
          email: st.email,
          position: st.position?.ru,
          specialty: st.specialty?.ru,
          sphereIds: st.sphereIds,
        });
        staffCopied += 1;
      }
    }
    await syncCore(input.toBusinessId).catch(() => undefined);
    return { servicesCopied: res.servicesCopied, staffCopied, goodsCopied: res.goodsCopied };
  }
  if (input.services) {
    const services = readCore().services.filter(
      (s) => s.businessId === input.fromBusinessId,
    );
    for (const svc of services) {
      const { id: _id, ...rest } = svc;
      void _id;
      await coreCreate("services", { ...rest, businessId: input.toBusinessId });
      servicesCopied += 1;
    }
  }
  const toLocation = readCore().locations.find(
    (l) => l.businessId === input.toBusinessId,
  );
  if (input.staff) {
    const staff = readCore().staff.filter(
      (s) => s.businessId === input.fromBusinessId,
    );
    for (const st of staff) {
      const { id: _id, phone: _phone, locationIds: _loc, ...rest } = st;
      void _id;
      void _phone;
      void _loc;
      await coreCreate("staff", {
        ...rest,
        businessId: input.toBusinessId,
        locationIds: toLocation ? [toLocation.id] : [],
        // копия — телефон исходного мастера занят на его карточке, ставим временную заглушку (F-11-009: демо-перенос)
        phone: `+374${String(90000000 + (staffCopied % 9999999))}`,
      });
      staffCopied += 1;
    }
  }
  if (input.goods) {
    const goods = readArea("stock").goods.filter(
      (g: Good) => g.businessId === input.fromBusinessId && !g.archived,
    );
    if (toLocation) {
      for (const g of goods) {
        await stockApi.copyGoodToLocationsNetworked(
          input.fromBusinessId,
          g.id,
          [toLocation.id],
        );
        goodsCopied += 1;
      }
    }
  }
  return { servicesCopied, staffCopied, goodsCopied };
}

/** F-11-010: экспорт услуг локации в CSV («Excel»), без колонки ID (F-11-010) */
export async function exportBusinessServicesCsv(businessId: Id): Promise<string> {
  if (isApiMode()) {
    const S = await import("@/api/services.server");
    const [services, categories] = await Promise.all([S.listServices(businessId), S.listCategories(businessId)]);
    const rows = services.map((s) => [
      s.name.ru || s.name.en || "",
      categories.find((c) => c.id === s.categoryId)?.name.ru ?? "",
      String(s.priceMin),
      String(s.durationMin),
    ]);
    return toCsv(rows, ["Название", "Категория", "Цена", "Длительность"]);
  }
  return request(() => {
    const core = readCore();
    const rows = core.services
      .filter((s) => s.businessId === businessId)
      .map((s) => [
        s.name.ru || s.name.en || "",
        core.serviceCategories.find((c) => c.id === s.categoryId)?.name.ru ??
          "",
        String(s.priceMin),
        String(s.durationMin),
      ]);
    return toCsv(rows, ["Название", "Категория", "Цена", "Длительность"]);
  });
}

/** F-11-010: импорт из CSV в другую локацию — создаёт новые услуги, старые не трогает, ≤500 строк */
export async function importBusinessServicesCsv(
  targetBusinessId: Id,
  rows: { name: string; category: string; price: number; duration: number }[],
): Promise<number> {
  if (isApiMode()) {
    const clipped = rows.slice(0, 500);
    if (!clipped.length) throw new ApiError("validation", "empty");
    const created = await Server.importBusinessServicesCsv(targetBusinessId, clipped);
    await syncCore(targetBusinessId).catch(() => undefined);
    return created;
  }
  return request(() => {
    const clipped = rows.slice(0, 500);
    if (!clipped.length) throw new ApiError("validation", "empty");
    const core = readCore();
    const business = core.businesses.find((b) => b.id === targetBusinessId);
    if (!business) throw new ApiError("not_found");
    let created = 0;
    for (const row of clipped) {
      const name = row.name.trim();
      if (!name) continue;
      let category = core.serviceCategories.find(
        (c) => c.businessId === targetBusinessId && c.name.ru === row.category,
      );
      if (!category && row.category.trim()) {
        category = coreTx.create("serviceCategories", {
          businessId: targetBusinessId,
          name: { ru: row.category, hy: row.category, en: row.category },
          order: 999,
        }) as ServiceCategory;
      }
      coreTx.create("services", {
        businessId: targetBusinessId,
        categoryId:
          category?.id ??
          core.serviceCategories.find((c) => c.businessId === targetBusinessId)
            ?.id ??
          "",
        sphereId: business.sphereIds[0],
        name: { ru: name, hy: name, en: name },
        kind: "individual",
        durationMin: row.duration || 30,
        priceMin: row.price || 0,
        photos: [],
        materials: [],
        staffIds: [],
        workplaces: [],
        onlineBookable: true,
        active: true,
        order: 999,
      });
      created += 1;
    }
    return created;
  });
}
