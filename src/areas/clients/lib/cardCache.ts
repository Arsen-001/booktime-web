import type { ClientRow } from '@/domain/clients';
import type { Id } from '@/domain/core';
import { seedApiQuery } from '@/api/request';

/** Ключ строки клиента карточки (ClientCardScreen) — один на карточку и на подсев из списка */
export function clientRowKey(businessId: Id | undefined, clientId: Id, businessIds: Id[] | undefined, restrictToStaffId: Id | undefined) {
  return ['clients', 'row', businessId, clientId, businessIds, restrictToStaffId] as const;
}

/**
 * Строка из списка — сразу в кэш карточки: переход «список → карточка» показывает имя, профиль и деньги в первом же
 * кадре, а не скелетон всей страницы, который потом сдвигал раскладку (scripts/flicker.mjs, clients-open).
 */
export function seedClientRow(row: ClientRow, businessId: Id | undefined, businessIds: Id[] | undefined, restrictToStaffId: Id | undefined) {
  seedApiQuery(clientRowKey(businessId, row.id, businessIds, restrictToStaffId), row);
}
