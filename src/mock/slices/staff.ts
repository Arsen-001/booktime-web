import type { CoreData, Id } from "@/domain/core";
import type {
  DeletedStaffSnapshot,
  RightScope,
  StaffAccessInfo,
  StaffAuditEntry,
  StaffBusinessSecuritySettings,
  StaffCardSettings,
  StaffDismissal,
  StaffExportEntry,
  StaffInvite,
  StaffLegalInfo,
  StaffLoginEntry,
  StaffPosition,
  StaffSystemUser,
} from "@/domain/staff";
import {
  emptyStaffAccess,
  defaultRoleTemplateFor,
  emptyBusinessSecuritySettings,
} from "@/domain/staff";
import { newId } from "@/lib/id";
import { toISODate } from "@/lib/date";
import { defineSlice } from "@/mock/slice";

/**
 * Срез моковой базы раздела «staff». Принадлежит разделу.
 * order — порядок сотрудников (F-10-009/013), общий: мастера в календаре и в записи клиента читают его же.
 * legalInfo/cardSettings/masterPushPrefs — b02, карточка сотрудника (её вкладки «Настройки»/«Юр. информация»
 * и собственные пуши мастера, F-10-036/037/038/137); ключ — Staff.id.
 */
export interface StaffState {
  positions: StaffPosition[];
  order: Record<Id, number>;
  invites: StaffInvite[];
  systemUsers: StaffSystemUser[];
  audit: StaffAuditEntry[];
  legalInfo: Record<Id, StaffLegalInfo>;
  cardSettings: Record<Id, StaffCardSettings>;
  /** Персональный «на себя» тумблер пушей мастера (F-10-137) — staffId → тип уведомления → включено */
  masterPushPrefs: Record<Id, Record<string, boolean>>;
  /** Доступ и роль-шаблон (F-10-019/031, F-10-053…061) — ключ Staff.id */
  access: Record<Id, StaffAccessInfo>;
  /** Дата, причина и момент увольнения (F-10-040/042/043) — ключ Staff.id */
  dismissals: Record<Id, StaffDismissal>;
  /** Снимки удалённых навсегда сотрудников — только так возможно восстановление (F-10-044) */
  deleted: DeletedStaffSnapshot[];
  /**
   * Тонкие права редактора (F-10-032…090, F-10-160) — ключ Staff.id, значение — id строк каталога
   * `src/areas/staff/permissions/catalog.ts`. При «Сохранить» сводятся к грубым и уходят в ядро
   * (core setStaffPermissions), это лишь то, что видит и правит сам редактор (галочки, «изменено»).
   */
  rights: Record<Id, string[]>;
  /** Значения «▾» у строк прав (F-10-071) — ключ Staff.id → id строки каталога → ограничение */
  rightScopes: Record<Id, Record<string, RightScope>>;
  /** Журнал «Операции с данными» (F-10-102/103) — кто и как выгружал/загружал файлы */
  exports: StaffExportEntry[];
  /** Журнал входов (F-10-106, только в справке у Altegio — у нас в кабинете) */
  logins: StaffLoginEntry[];
  /** Настройки безопасности бизнеса (⭐ F-00-047) — ключ Business.id */
  businessSettings: Record<Id, StaffBusinessSecuritySettings>;
}

/** Демо-данные строим только для первых 3 бизнесов с сотрудниками — остальные остаются пустыми (в т. ч. ?empty=1) */
const SEEDED_BUSINESSES = 3;

function seed(core: CoreData, now: Date): StaffState {
  const positions: StaffPosition[] = [];
  const order: Record<Id, number> = {};
  const invites: StaffInvite[] = [];
  const systemUsers: StaffSystemUser[] = [];
  const today = toISODate(now);

  const businessesWithStaff = core.businesses
    .filter((b) => core.staff.some((s) => s.businessId === b.id))
    .slice(0, SEEDED_BUSINESSES);

  businessesWithStaff.forEach((business) => {
    const staffOfBiz = core.staff.filter((s) => s.businessId === business.id);
    // Должности — из того, что уже задано на сотрудниках (LocalizedText.ru), плюс порядок
    const seen = new Map<string, number>();
    staffOfBiz.forEach((s) => {
      if (s.position?.ru && !seen.has(s.position.ru))
        seen.set(s.position.ru, seen.size);
    });
    seen.forEach((idx, ru) => {
      positions.push({
        id: newId("stpos"),
        businessId: business.id,
        name: { ru },
        order: idx,
        createdAt: today,
      });
    });
    staffOfBiz.forEach((s, idx) => {
      order[s.id] = idx;
    });
    // Приглашённые, но ещё не принявшие — status: 'invited' у ядра (если есть демо-мастер в таком статусе)
    staffOfBiz
      .filter((s) => s.status === "invited")
      .forEach((s) => {
        invites.push({
          id: newId("stinv"),
          businessId: business.id,
          staffId: s.id,
          role: s.role === "admin" ? "admin" : "master",
          phone: s.phone,
          status: "pending",
          createdAt: today,
        });
      });
  });

  // Один демонстрационный системный пользователь для первого заполненного бизнеса (F-10-010) — помечен «демо» в UI
  if (businessesWithStaff[0]) {
    systemUsers.push({
      id: newId("stsys"),
      businessId: businessesWithStaff[0].id,
      label: "Онлайн-запись (виджет)",
      integrationKey: "online-widget",
      permissions: ["journal.create", "online.own"],
      connectedAt: today,
    });
  }

  // Доступ по умолчанию: владелец и администраторы включены, мастера без принятого приглашения — выключены,
  // приглашённые (invited) считаются включёнными (приглашение уже отправлено) — F-10-031.
  const access: Record<Id, StaffAccessInfo> = {};
  core.staff.forEach((s) => {
    const base = emptyStaffAccess(s.role);
    access[s.id] = {
      ...base,
      enabled: s.status !== "disabled" && s.role !== "master" ? true : s.status !== "disabled",
      roleTemplateId: defaultRoleTemplateFor(s.role),
    };
  });

  // Демо-журналы «Операции с данными» и «Входы» (F-10-102/103/106) — только для первого заполненного бизнеса
  const exports: StaffExportEntry[] = [];
  const logins: StaffLoginEntry[] = [];
  const businessSettings: Record<Id, StaffBusinessSecuritySettings> = {};
  businessesWithStaff.forEach((business) => {
    businessSettings[business.id] = emptyBusinessSecuritySettings();
  });
  const demoBiz = businessesWithStaff[0];
  const demoStaff = demoBiz
    ? core.staff.find((s) => s.businessId === demoBiz.id && s.role === "admin") ??
      core.staff.find((s) => s.businessId === demoBiz.id)
    : undefined;
  if (demoBiz && demoStaff) {
    exports.push(
      {
        id: newId("stexp"),
        businessId: demoBiz.id,
        actorStaffId: demoStaff.id,
        actorLabel: demoStaff.name,
        reportType: "clients",
        isImport: false,
        operationType: "emailLink",
        at: today,
      },
      {
        id: newId("stexp"),
        businessId: demoBiz.id,
        actorStaffId: demoStaff.id,
        actorLabel: demoStaff.name,
        reportType: "bookings",
        isImport: false,
        operationType: "browserDownload",
        at: today,
      },
    );
    logins.push(
      {
        id: newId("stlogin"),
        businessId: demoBiz.id,
        staffId: demoStaff.id,
        staffLabel: demoStaff.name,
        at: today,
        device: "Chrome · Windows",
        ip: "192.57.11.33",
        newDevice: false,
      },
      {
        id: newId("stlogin"),
        businessId: demoBiz.id,
        staffId: demoStaff.id,
        staffLabel: demoStaff.name,
        at: today,
        device: "Safari · iPhone",
        ip: "10.10.0.4",
        newDevice: true,
      },
    );
  }

  return {
    positions,
    order,
    invites,
    systemUsers,
    audit: [],
    legalInfo: {},
    cardSettings: {},
    masterPushPrefs: {},
    access,
    dismissals: {},
    deleted: [],
    rights: {},
    rightScopes: {},
    exports,
    logins,
    businessSettings,
  };
}

export const staffSlice = defineSlice<StaffState>({
  version: 5,
  seed,
});
