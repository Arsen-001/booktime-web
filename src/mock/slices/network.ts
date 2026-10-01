import type {
  BranchSubscription,
  NetworkAnalyticsSettings,
  NetworkAuditEntry,
  NetworkBroadcastLogEntry,
  NetworkCallRecord,
  NetworkExportLogEntry,
  NetworkExtras,
  NetworkField,
  NetworkGoodsArchiveEntry,
  NetworkGoodsCategory,
  NetworkOffDayType,
  NetworkPayrollRun,
  NetworkPlanCell,
  NetworkPosition,
  NetworkServiceLock,
  NetworkSubdivision,
  NetworkTelephony,
  NetworkTelephonyRoute,
  NetworkTelephonyRule,
  NetworkUser,
} from "@/domain/network";
import { defineSlice } from "@/mock/slice";
import { addDays, datePart } from "@/lib/date";
import type { Id } from "@/domain/core";

/**
 * Срез моковой базы раздела «network». Принадлежит разделу.
 * Сама сеть и филиалы — в ядре (Network/Business/Location); здесь — то, чего в ядре нет (см. domain/network.ts).
 */
export interface NetworkState {
  extras: Record<Id, NetworkExtras>;
  subscriptions: BranchSubscription[];
  users: NetworkUser[];
  plans: NetworkPlanCell[];
  subdivisions: NetworkSubdivision[];
  serviceCategoryLinks: Record<
    Id,
    { networkId: Id; subdivisionId?: Id; onlineName?: string }
  >;
  goodsCategories: NetworkGoodsCategory[];
  telephony: Record<Id, NetworkTelephony>;
  exportLog: NetworkExportLogEntry[];
  broadcastLog: NetworkBroadcastLogEntry[];
  analyticsSettings: Record<Id, NetworkAnalyticsSettings>;
  /** b03: запреты цены/описания у сетевых услуг (F-11-082/083), ключ — `NetworkServiceLock.key` */
  serviceLocks: NetworkServiceLock[];
  positions: NetworkPosition[];
  offDayTypes: NetworkOffDayType[];
  payrollRuns: NetworkPayrollRun[];
  goodsArchive: NetworkGoodsArchiveEntry[];
  /** F-11-100: порядок сотрудников сети (ключи — имя, как и группировка сетевых сотрудников) */
  staffOrder: Record<Id, string[]>;
  /** b04: доп. поля записи/клиента (F-11-126…134) */
  fields: NetworkField[];
  /** b04: телефония — маршруты, правила, звонки (F-11-147…152) */
  telephonyRoutes: NetworkTelephonyRoute[];
  telephonyRules: NetworkTelephonyRule[];
  calls: NetworkCallRecord[];
  /** f1: журнал «Изменения данных» сети (F-11-023) */
  auditLog: NetworkAuditEntry[];
  /** f1: телефоны, отказавшиеся от рекламных рассылок сети — «Не отправлять» (F-11-058) */
  marketingOptOut: string[];
}

export const networkSlice = defineSlice<NetworkState>({
  version: 6,
  seed: (core, now) => {
    const extras: Record<Id, NetworkExtras> = {};
    const users: NetworkUser[] = [];
    const telephony: Record<Id, NetworkTelephony> = {};
    const auditLog: NetworkAuditEntry[] = [];
    for (const network of core.networks) {
      extras[network.id] = {
        order: [...network.businessIds],
        smsBalance: 12000,
        pendingDeletions: {},
      };
      auditLog.push({
        id: `net-audit-${network.id}-created`,
        networkId: network.id,
        action: "created",
        authorName:
          core.staff.find((s) => s.id === network.ownerStaffId)?.name ??
          "Владелец",
        at: network.createdAt,
      });
      const owner = core.staff.find((s) => s.id === network.ownerStaffId);
      users.push({
        id: `net-user-${network.id}-owner`,
        networkId: network.id,
        name: owner?.name ?? "Владелец",
        phone: owner?.phone,
        email: owner?.email,
        permissions: [
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
        ],
        lastVisitAt: now.toISOString().slice(0, 16),
        isOwner: true,
      });
      telephony[network.id] = {
        networkId: network.id,
        token: `NET-${network.id.toUpperCase()}-TOKEN`,
        connected: false,
      };
    }
    const today = datePart(now.toISOString().slice(0, 16));
    const subscriptions: BranchSubscription[] = core.businesses
      .filter((b) => b.status === "active")
      .map((b, i) => ({
        businessId: b.id,
        until: addDays(today, 60 + ((i * 37) % 300)),
      }));
    const offDayTypes: NetworkOffDayType[] = core.networks.flatMap((n) => [
      {
        id: `net-off-${n.id}-vacation`,
        networkId: n.id,
        name: "Отпуск",
        colorIndex: 5,
        businessIds: [...n.businessIds],
        system: true,
      },
      {
        id: `net-off-${n.id}-sick`,
        networkId: n.id,
        name: "Больничный",
        colorIndex: 6,
        businessIds: [...n.businessIds],
        system: true,
      },
    ]);
    return {
      extras,
      subscriptions,
      users,
      plans: [],
      subdivisions: [],
      serviceCategoryLinks: {},
      goodsCategories: [],
      telephony,
      exportLog: [],
      broadcastLog: [],
      analyticsSettings: Object.fromEntries(
        core.networks.map((n) => [
          n.id,
          { networkId: n.id, lostClientDays: 60 },
        ]),
      ),
      serviceLocks: [],
      positions: [],
      offDayTypes,
      payrollRuns: [],
      goodsArchive: [],
      staffOrder: {},
      fields: [],
      telephonyRoutes: core.networks.map((n) => ({
        id: `net-route-${n.id}-default`,
        networkId: n.id,
        name: "По умолчанию",
        isDefault: true,
        userIds: users
          .filter((u) => u.networkId === n.id && u.isOwner)
          .map((u) => u.id),
        businessIds: [...n.businessIds],
        historyStorage: "network" as const,
        createdAt: now.toISOString().slice(0, 16),
      })),
      telephonyRules: [],
      auditLog,
      marketingOptOut: [],
      calls: core.networks.flatMap((n) =>
        Array.from({ length: 6 }, (_, i) => ({
          id: `net-call-${n.id}-${i}`,
          networkId: n.id,
          phone: `+374${10000000 + i * 137}`,
          direction: (i % 3 === 0 ? "out" : "in") as "in" | "out",
          status: (i % 4 === 3 ? "missed" : "accepted") as
            "accepted" | "missed",
          durationSec: i % 4 === 3 ? 0 : 40 + i * 23,
          at: `${addDays(today, -i)}T${String(9 + i).padStart(2, "0")}:15`,
          hasRecording: i % 4 !== 3,
          routeId: `net-route-${n.id}-default`,
          businessId: n.businessIds[i % n.businessIds.length],
        })),
      ),
    };
  },
});
