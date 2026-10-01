/**
 * ПРАВА — одна функция для api и экранов (F-00-039, F-10, arch-a1 №8).
 *   can(persona, 'clients.export', { overrides })                    — есть ли право
 *   can('master', 'journal.edit', { actorStaffId, targetStaffId })    — с учётом «чужих записей» (journal.others)
 * В экране — useCan(permission) (src/demo/hooks, считает то же); в api — assertCan() из src/api/core.ts,
 * которая бросает ApiError('forbidden'). Проверка `persona === 'owner'` вместо права — нельзя (сторож A8).
 */
import { PERSONA_PERMISSIONS, type Permission } from '@/config/permissions';
import type { Id } from '@/domain/core';
import type { PersonaId } from '@/demo/settings';

export interface PermissionContext {
  /** Права администратора, выставленные владельцем (setStaffPermissions); действуют только для персоны admin */
  overrides?: readonly Permission[];
  /** Кто действует (Staff.id) */
  actorStaffId?: Id;
  /** Чья запись/чей график (Staff.id) — для прав на «чужое» */
  targetStaffId?: Id;
}

/**
 * Право работает только вместе с базовым (F-01-024: «создавать записи» — вместе с journal.edit;
 * телефоны/выгрузка/правка клиентов — только тому, кто видит клиентов).
 */
export const PERMISSION_REQUIRES: Partial<Record<Permission, readonly Permission[]>> = {
  'journal.edit': ['journal.view'],
  'journal.create': ['journal.view', 'journal.edit'],
  'journal.reschedule': ['journal.view', 'journal.edit'],
  'journal.others': ['journal.view'],
  'clients.phones': ['clients.view'],
  'clients.edit': ['clients.view'],
  'clients.export': ['clients.view'],
  'clients.delete': ['clients.view', 'clients.edit'],
  'services.edit': ['services.view'],
  'stock.edit': ['stock.view'],
  'finance.edit': ['finance.view'],
  'payroll.manage': ['payroll.view'],
};

/** Права, для которых важно «своё/чужое»: на записи другого мастера нужно ещё journal.others */
const OWN_SCOPED: readonly Permission[] = ['journal.view', 'journal.edit', 'journal.create', 'journal.reschedule'];

/** Набор прав персоны (у администратора — галочки владельца, если заданы) */
export function permissionsOf(persona: PersonaId, overrides?: readonly Permission[]): ReadonlySet<Permission> {
  return new Set(persona === 'admin' && overrides ? overrides : PERSONA_PERMISSIONS[persona]);
}

/** Есть ли у персоны право в этом контексте */
export function can(persona: PersonaId, permission: Permission, ctx: PermissionContext = {}): boolean {
  const set = permissionsOf(persona, ctx.overrides);
  return canWith(set, permission, ctx);
}

/** То же по готовому набору прав (usePermissions() в экране, currentActor().permissions в api) */
export function canWith(set: ReadonlySet<Permission>, permission: Permission, ctx: Omit<PermissionContext, 'overrides'> = {}): boolean {
  if (!set.has(permission)) return false;
  if (PERMISSION_REQUIRES[permission]?.some((p) => !set.has(p))) return false;
  const foreign = Boolean(ctx.actorStaffId && ctx.targetStaffId && ctx.actorStaffId !== ctx.targetStaffId);
  if (foreign && OWN_SCOPED.includes(permission) && !set.has('journal.others')) return false;
  return true;
}

/**
 * Права, которые сейчас не проверяет ни один экран и ни одна функция api (ревью arch-a1, 25.09.2026).
 * Разделы-хозяева обязаны начать их проверять — список в qa/measure/<id>/core-rules.md.
 */
export const UNCHECKED_PERMISSIONS: readonly Permission[] = [
  'clients.phones',
  'clients.export',
  'clients.edit',
  'journal.create',
  'journal.reschedule',
];
