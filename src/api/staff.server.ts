'use client';

/**
 * Раздел «staff» на настоящем сервере (docs/backend/PLAN.md этап 3, docs/backend/02 §7). Функции src/api/staff.ts в
 * режиме `api` зовут эти; экран получает те же типы, что от мока. Права проверяет сервер — здесь их нет.
 *
 * Перечитывание: чтения объявляют метки core.staff / areas.staff (trackRead); запись зеркалит сотрудника в ядро
 * браузера (src/api/mirror.ts) и будит areas.staff — перечитываются и экраны раздела, и разделы, ещё живущие на моке.
 */
import { HttpApiError, http } from '@/api/http';
import { apiIdentity } from '@/api/identity';
import { mirrorCore, syncCore, unmirror } from '@/api/mirror';
import { ApiError, trackRead } from '@/api/request';
import type { Permission } from '@/config/permissions';
import type { Id, Staff } from '@/domain/core';
import type {
  DeletedStaffSnapshot,
  RightScope,
  StaffAccessInfo,
  StaffAuditEntry,
  StaffAuditFilter,
  StaffBusinessSecuritySettings,
  StaffCardSettings,
  StaffDismissInput,
  StaffExportEntry,
  StaffExportFilter,
  StaffInvite,
  StaffIpRestriction,
  StaffLegalInfo,
  StaffLoginEntry,
  StaffPosition,
  StaffRoleTemplateId,
} from '@/domain/staff';
import { useDb, notifyDbChange } from '@/mock/db';

export interface ServerStaffRow {
  staff: Staff;
  order: number;
}

export interface ServerPositionRow extends StaffPosition {
  staffCount: number;
  staffNames: string[];
}

interface ServerAccess {
  access: StaffAccessInfo;
  invite?: StaffInvite;
  staff: Staff;
}

/** Бизнес сотрудника: из зеркала ядра, иначе — текущий бизнес вошедшего */
export function bizOf(staffId?: Id): Id {
  const fromMirror = staffId ? useDb.getState().core.staff.find((s) => s.id === staffId)?.businessId : undefined;
  const id = fromMirror ?? apiIdentity()?.businessId;
  if (!id) throw new ApiError('forbidden', 'No business in session');
  return id;
}

const base = (businessId: Id) => `/v1/biz/${businessId}`;

/** Ошибка полей сервера (invalid_field + fields) → та же StaffValidationError, что у мока */
export async function withFieldErrors<T>(fn: () => Promise<T>, toFieldError: (field: 'name' | 'phone' | 'email', message: string) => Error): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof HttpApiError && e.code === 'invalid_field' && e.fields) {
      const field = (['name', 'phone', 'email'] as const).find((f) => e.fields?.[f]);
      if (field) throw toFieldError(field, e.message);
    }
    throw e;
  }
}

function changed(staff?: Staff | Staff[]): void {
  if (staff) mirrorCore({ staff: Array.isArray(staff) ? staff : [staff] });
  notifyDbChange('areas.staff', 'core.staff');
}

// ─────────── чтение ───────────

export function listStaff(businessId: Id): Promise<ServerStaffRow[]> {
  trackRead('core.staff', 'areas.staff');
  return http<ServerStaffRow[]>('GET', `${base(businessId)}/staff`);
}

export function getStaff(staffId: Id): Promise<Staff> {
  trackRead('core.staff', 'areas.staff');
  return http<Staff>('GET', `${base(bizOf(staffId))}/staff/${staffId}`);
}

export function listPositionRows(businessId: Id): Promise<ServerPositionRow[]> {
  trackRead('areas.staff');
  return http<ServerPositionRow[]>('GET', `${base(businessId)}/positions`);
}

export function getAccess(staffId: Id): Promise<ServerAccess> {
  trackRead('core.staff', 'areas.staff');
  return http<ServerAccess>('GET', `${base(bizOf(staffId))}/staff/${staffId}/access`);
}

export function listDeleted(businessId: Id): Promise<DeletedStaffSnapshot[]> {
  trackRead('areas.staff');
  return http<DeletedStaffSnapshot[]>('GET', `${base(businessId)}/staff/deleted`);
}

export function getRights(staffId: Id): Promise<{ fine: string[] | null; coarse: string[] | null; scopes: Record<string, RightScope> }> {
  trackRead('areas.staff');
  return http('GET', `${base(bizOf(staffId))}/staff/${staffId}/permissions`);
}

export function listChanges(filter: StaffAuditFilter): Promise<StaffAuditEntry[]> {
  trackRead('areas.staff');
  return http<StaffAuditEntry[]>('GET', `${base(filter.businessId)}/audit`, undefined, {
    query: { entity: filter.entity, entityId: filter.entityId, action: filter.action, actorStaffId: filter.actorStaffId },
  });
}

export function listRightsHistory(businessId: Id, staffId: Id): Promise<StaffAuditEntry[]> {
  trackRead('areas.staff');
  return http<StaffAuditEntry[]>('GET', `${base(businessId)}/staff/${staffId}/permissions/history`);
}

export async function listExports(filter: StaffExportFilter): Promise<StaffExportEntry[]> {
  trackRead('areas.staff');
  const rows = await http<StaffExportEntry[]>('GET', `${base(filter.businessId)}/exports-log`);
  return rows
    .filter((e) => !filter.actorStaffId || e.actorStaffId === filter.actorStaffId)
    .filter((e) => !filter.reportType || e.reportType === filter.reportType)
    .filter((e) => !filter.operationType || e.operationType === filter.operationType);
}

export function listLogins(businessId: Id): Promise<StaffLoginEntry[]> {
  trackRead('areas.staff');
  return http<StaffLoginEntry[]>('GET', `${base(businessId)}/logins`);
}

export function getSecurity(businessId: Id): Promise<StaffBusinessSecuritySettings> {
  trackRead('areas.staff', 'core.businesses');
  return http('GET', `${base(businessId)}/security`);
}

type Tab = 'legal' | 'card-settings' | 'push-prefs';
export function getTab<T>(staffId: Id, tab: Tab): Promise<T | null> {
  trackRead('areas.staff');
  return http<T | null>('GET', `${base(bizOf(staffId))}/staff/${staffId}/tabs/${tab}`);
}

// ─────────── запись ───────────

export interface ServerAddStaffInput {
  businessId: Id;
  locationIds: Id[];
  name: string;
  role: Staff['role'];
  phone?: string;
  email?: string;
  position?: string;
  specialty?: string;
  sphereIds: string[];
  asAssistant?: boolean;
  grantAccess?: boolean;
  roleTemplateId?: StaffRoleTemplateId;
}

export async function addStaff(input: ServerAddStaffInput): Promise<Staff> {
  const { businessId, ...body } = input;
  const res = await http<{ staff: Staff; inviteLink: string | null }>('POST', `${base(businessId)}/staff`, body, { idempotencyKey: crypto.randomUUID() });
  changed(res.staff);
  return res.staff;
}

export async function patchStaff(staffId: Id, patch: Record<string, unknown>): Promise<Staff> {
  const staff = await http<Staff>('PATCH', `${base(bizOf(staffId))}/staff/${staffId}`, patch);
  changed(staff);
  return staff;
}

export async function reorder(ids: Id[]): Promise<void> {
  if (!ids.length) return;
  await http('PUT', `${base(bizOf(ids[0]))}/staff/order`, { ids });
  await syncCore(bizOf(ids[0]));
  notifyDbChange('areas.staff');
}

export async function dismiss(staffId: Id, input: StaffDismissInput): Promise<Staff> {
  const staff = await http<Staff>('POST', `${base(bizOf(staffId))}/staff/${staffId}/fire`, input);
  changed(staff);
  return staff;
}

export async function restore(staffId: Id): Promise<Staff> {
  const staff = await http<Staff>('POST', `${base(bizOf(staffId))}/staff/${staffId}/restore`);
  changed(staff);
  return staff;
}

export async function remove(staffId: Id): Promise<void> {
  await http('DELETE', `${base(bizOf(staffId))}/staff/${staffId}`);
  unmirror('staff', staffId);
  notifyDbChange('areas.staff');
}

export async function undelete(businessId: Id, staffId: Id): Promise<Staff> {
  const staff = await http<Staff>('POST', `${base(businessId)}/staff/${staffId}/undelete`);
  changed(staff);
  return staff;
}

export async function setAccessEnabled(staffId: Id, enabled: boolean): Promise<ServerAccess> {
  const res = await http<ServerAccess>('PUT', `${base(bizOf(staffId))}/staff/${staffId}/access`, { enabled });
  changed(res.staff);
  return res;
}

export async function setAccessInfo(staffId: Id, info: string): Promise<ServerAccess> {
  const res = await http<ServerAccess>('PUT', `${base(bizOf(staffId))}/staff/${staffId}/access/info`, { info });
  notifyDbChange('areas.staff');
  return res;
}

export async function setRoleTemplate(staffId: Id, roleTemplateId: StaffRoleTemplateId): Promise<ServerAccess> {
  const res = await http<ServerAccess>('PUT', `${base(bizOf(staffId))}/staff/${staffId}/role-template`, { roleTemplateId });
  notifyDbChange('areas.staff');
  return res;
}

export async function setIpRestriction(staffId: Id, restriction: StaffIpRestriction): Promise<StaffIpRestriction> {
  const res = await http<StaffIpRestriction>('PUT', `${base(bizOf(staffId))}/staff/${staffId}/ip-restriction`, restriction);
  notifyDbChange('areas.staff');
  return res;
}

export async function reissueInvite(staffId: Id): Promise<{ invite: StaffInvite; link: string }> {
  const res = await http<{ invite: StaffInvite; link: string }>('POST', `${base(bizOf(staffId))}/staff/${staffId}/invite`);
  notifyDbChange('areas.staff');
  return res;
}

export async function revokeInvite(staffId: Id): Promise<StaffInvite> {
  const res = await http<StaffInvite>('DELETE', `${base(bizOf(staffId))}/staff/${staffId}/invite`);
  notifyDbChange('areas.staff');
  return res;
}

export async function transferAccess(input: { fromStaffId: Id; toStaffId: Id; deleteSource: boolean }): Promise<void> {
  const businessId = bizOf(input.fromStaffId);
  await http('POST', `${base(businessId)}/staff/transfer-access`, input);
  await syncCore(businessId);
  notifyDbChange('areas.staff');
}

export async function transferOwnership(fromStaffId: Id, toStaffId: Id): Promise<void> {
  const businessId = bizOf(fromStaffId);
  await http('POST', `${base(businessId)}/staff/${fromStaffId}/transfer-ownership`, { toStaffId });
  await syncCore(businessId);
  notifyDbChange('areas.staff');
}

export async function setRights(staffId: Id, fine: string[], coarse: Permission[]): Promise<void> {
  await http('PUT', `${base(bizOf(staffId))}/staff/${staffId}/permissions`, { fine, coarse });
  notifyDbChange('areas.staff', 'access');
}

export async function setRightScopes(staffId: Id, scopes: Record<string, RightScope>): Promise<void> {
  await http('PUT', `${base(bizOf(staffId))}/staff/${staffId}/permissions/scopes`, { scopes });
  notifyDbChange('areas.staff');
}

export async function setTab<T extends object>(staffId: Id, tab: Tab, value: T): Promise<T> {
  const res = await http<T>('PUT', `${base(bizOf(staffId))}/staff/${staffId}/tabs/${tab}`, { value });
  notifyDbChange('areas.staff');
  return res;
}

export async function addPosition(businessId: Id, name: string, description?: string): Promise<StaffPosition> {
  const res = await http<StaffPosition>('POST', `${base(businessId)}/positions`, { name, description });
  notifyDbChange('areas.staff');
  return res;
}

export async function renamePosition(id: Id, name: string, description?: string): Promise<StaffPosition> {
  const businessId = bizOf();
  const res = await http<StaffPosition>('PATCH', `${base(businessId)}/positions/${id}`, { name, description });
  await syncCore(businessId);
  notifyDbChange('areas.staff');
  return res;
}

export async function removePosition(id: Id): Promise<void> {
  await http('DELETE', `${base(bizOf())}/positions/${id}`);
  notifyDbChange('areas.staff');
}

export async function setSecurity(businessId: Id, value: boolean): Promise<StaffBusinessSecuritySettings> {
  const res = await http<StaffBusinessSecuritySettings>('PUT', `${base(businessId)}/security`, { blockHomeVisitDuringShift: value });
  await syncCore(businessId);
  return res;
}

export function logExport(input: { businessId: Id; reportType: string; isImport?: boolean; operationType: string }): Promise<void> {
  const { businessId, ...body } = input;
  return http('POST', `${base(businessId)}/exports-log`, body);
}

export type { StaffCardSettings, StaffLegalInfo };
