'use client';

/** Карточка клиента: создание, правка, мягкое и полное удаление, журнал изменений. */
import type { ClientChangeLogEntry, ClientRow } from '@/domain/clients';
import { clientMoney, emptyProfile, extraPaidFromTotal } from '@/domain/clients';
import type { Client, Id } from '@/domain/core';
import * as C from '@/api/clients/clients.server';
import { isApiMode } from '@/api/http';
import { readArea, readCore, mutateArea } from '@/api/area';
import { assertCan, coreTx } from '@/api/core';
import { ApiError, request } from '@/api/request';
import { isOwnClient } from '@/domain/rules';
import { nowDateTime } from '@/lib/date';
import { DuplicatePhoneError, toRow, validatePhone, validateNationalId, logChange, deleteClientTx } from '@/api/clients/shared';
import type { ClientFormFields, CreateClientInput } from '@/api/clients/shared';

/** Только поля ядра — сервер (`ClientRow`, надмножество) в местах, где экрану нужен именно core-`Client` */
function toClient(r: ClientRow): Client {
  return {
    id: r.id,
    businessId: r.businessId,
    phone: r.phone,
    name: r.name,
    gender: r.gender,
    birthday: r.birthday,
    email: r.email,
    note: r.note,
    tags: r.tags,
    appUserId: r.appUserId,
    noShowCount: r.noShowCount,
    blocked: r.blocked,
    createdAt: r.createdAt,
  };
}

/** Журнал изменений клиента для карточки (F-04-137); без clientId — весь журнал бизнеса */
export function listClientChangeLog(businessId: Id, clientId?: Id): Promise<ClientChangeLogEntry[]> {
  if (isApiMode()) return C.listClientChangeLog(businessId, clientId);
  return request(() => {
    const all = readArea('clients').changeLog[businessId] ?? [];
    return (clientId ? all.filter((e) => e.clientId === clientId) : all).slice().sort((a, b) => b.at.localeCompare(a.at));
  });
}

/** Добавление клиента вручную формой (F-04-001, F-04-044, F-04-045…061) */
export function createClient(input: CreateClientInput): Promise<Client> {
  if (isApiMode()) {
    const { businessId, ...body } = input;
    return C.createClient(businessId, body).then(toClient);
  }
  return request(() => {
    assertCan('clients.edit');
    const name = input.name.trim();
    if (!name) throw new ApiError('name_required', 'Укажите имя клиента');
    const normalized = validatePhone(input.phone);
    const core = readCore();
    const existing = core.clients.find((c) => c.businessId === input.businessId && c.phone === normalized && !c.deletedAt);
    if (existing) {
      throw new DuplicatePhoneError(existing.id);
    }
    const client = coreTx.create('clients', {
      businessId: input.businessId,
      phone: normalized,
      name,
      gender: input.gender ?? 'unknown',
      birthday: input.birthday || undefined,
      tags: input.tags ?? [],
      note: input.note?.trim() || undefined,
      noShowCount: 0,
      createdAt: nowDateTime(),
      email: input.email?.trim() || undefined,
      blocked: input.blocked || undefined,
    });
    mutateArea('clients', (s) => {
      s.profiles[client.id] = {
        discountPercent: input.discountPercent ?? 0,
        importanceClass: input.importanceClass,
        cardNumber: input.cardNumber?.trim() || undefined,
        paidAmount: input.paidAmount ?? 0,
        lastName: input.lastName?.trim() || undefined,
        middleName: input.middleName?.trim() || undefined,
        additionalPhone: input.additionalPhone ? validatePhone(input.additionalPhone) : undefined,
        avatar: input.avatar,
        importedSold: input.importedSold ?? 0,
        nationalId: validateNationalId(input.nationalId),
        birthdayGreetingOptOut: input.birthdayGreetingOptOut || undefined,
        locale: input.locale,
        preferredContact: input.preferredContact,
      };
      if (input.customFieldValues && Object.keys(input.customFieldValues).length) {
        s.customFieldValues[client.id] = input.customFieldValues;
      }
    });
    return client;
  });
}

/**
 * Одна карточка клиента (ядро + профиль), для /biz/clients/[clientId] (F-00-128, F-04-066).
 *
 * F-04-199 (исправлено): раньше «только свои клиенты» (`!rights.seeAllClients`) применял только экран
 * списка (`onlyStaffId` в `listClients`) — прямой ссылкой на карточку мастер видел ЛЮБОГО клиента, потому
 * что api ничего не проверял. `restrictToStaffId` — то же правило (`isOwnClient` из ядра), что уже стоит
 * у бронирования (`domain/rules/visibility`), применённое к чтению карточки.
 */
export function getClientRow(businessId: Id, clientId: Id, businessIds?: Id[], restrictToStaffId?: Id): Promise<ClientRow> {
  if (isApiMode()) return C.getClientRow(businessId, clientId, businessIds, restrictToStaffId);
  return request(() => {
    // Сеть (F-00-050): карточку открывают из любого своего филиала — клиент ищется среди бизнесов сети
    const allowed = businessIds?.length ? [businessId, ...businessIds] : [businessId];
    const core = readCore();
    const client = core.clients.find((c) => c.id === clientId && allowed.includes(c.businessId) && !c.deletedAt);
    if (!client) throw new ApiError('not_found', 'Клиент не найден');
    // Не «удалён», а «не ваш клиент» — экран карточки показывает разное (мастер без права «все клиенты», F-04-199)
    if (restrictToStaffId && !isOwnClient(core, restrictToStaffId, { clientId: client.id, appUserId: client.appUserId })) {
      throw new ApiError('not_own_client', 'Клиент не найден среди ваших клиентов');
    }
    const state = readArea('clients');
    return toRow(client, state.profiles[client.id], state.broadcastHistory[client.id] ?? []);
  });
}

export interface UpdateClientInput extends ClientFormFields {
  clientId: Id;
  businessId: Id;
  /** Кто правит — для журнала изменений (⭐ F-00-040 → F-04-137); нет автора — «Система» */
  actorId?: Id;
  actorName?: string;
}

/** Поля, у которых меняется значение, попадают в журнал изменений под своим именем из формы клиента */
const CHANGE_LOG_FIELDS: readonly (keyof ClientFormFields)[] = [
  'name',
  'lastName',
  'middleName',
  'phone',
  'additionalPhone',
  'email',
  'birthday',
  'gender',
  'importanceClass',
  'cardNumber',
  'discountPercent',
  'blocked',
  'note',
  'tags',
  'paidAmount',
  'avatar',
  'nationalId',
  'locale',
  'preferredContact',
];

function fieldValuesEqual(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => v === b[i]);
  return (a ?? undefined) === (b ?? undefined) || (!a && !b);
}

/** Правка карточки клиента (F-04-062); подтверждение смены имени — на экране, до вызова */
export function updateClient(input: UpdateClientInput): Promise<ClientRow> {
  if (isApiMode()) {
    const { clientId, businessId, actorId: _actorId, actorName: _actorName, ...body } = input;
    // Журнал изменений — сервер сам сравнивает старое/новое и пишет audit_events (actorId/actorName — из сессии)
    return C.updateClient(businessId, clientId, body);
  }
  return request(() => {
    assertCan('clients.edit');
    const name = input.name.trim();
    if (!name) throw new ApiError('name_required', 'Укажите имя клиента');
    const normalized = validatePhone(input.phone);
    const core = readCore();
    const beforeClient = core.clients.find((c) => c.id === input.clientId);
    if (core.clients.some((c) => c.businessId === input.businessId && c.id !== input.clientId && c.phone === normalized && !c.deletedAt)) {
      throw new ApiError('duplicate_phone', 'Клиент с таким номером уже есть в базе');
    }
    const beforeProfile = readArea('clients').profiles[input.clientId] ?? emptyProfile();
    // «Оплачено» в форме — всё оплаченное; в профиль кладём только внесённое сверх оплат визитов (domain/clients/money)
    const arrivedOfClient = core.bookings.filter((b) => b.clientId === input.clientId && b.status === 'arrived' && !b.deletedAt);
    const { visitsPaid } = clientMoney(arrivedOfClient, readArea('clients').manualVisitPayments, 0, 0);
    const nextExtraPaid = input.paidAmount === undefined ? beforeProfile.paidAmount : extraPaidFromTotal(input.paidAmount, visitsPaid);
    const before: ClientFormFields | undefined = beforeClient && {
      name: beforeClient.name,
      lastName: beforeProfile.lastName,
      middleName: beforeProfile.middleName,
      phone: beforeClient.phone,
      additionalPhone: beforeProfile.additionalPhone,
      email: beforeClient.email,
      birthday: beforeClient.birthday,
      gender: beforeClient.gender,
      importanceClass: beforeProfile.importanceClass,
      cardNumber: beforeProfile.cardNumber,
      discountPercent: beforeProfile.discountPercent,
      blocked: beforeClient.blocked,
      note: beforeClient.note,
      tags: beforeClient.tags,
      paidAmount: beforeProfile.paidAmount,
      avatar: beforeProfile.avatar,
      nationalId: beforeProfile.nationalId,
      birthdayGreetingOptOut: beforeProfile.birthdayGreetingOptOut,
      locale: beforeProfile.locale,
      preferredContact: beforeProfile.preferredContact,
    };
    const client = coreTx.update('clients', input.clientId, {
      name,
      phone: normalized,
      gender: input.gender ?? 'unknown',
      birthday: input.birthday || undefined,
      email: input.email?.trim() || undefined,
      note: input.note?.trim() || undefined,
      tags: input.tags ?? [],
      blocked: input.blocked || undefined,
    });
    const state = mutateArea('clients', (s) => {
      const prev = s.profiles[input.clientId] ?? emptyProfile();
      s.profiles[input.clientId] = {
        ...prev,
        discountPercent: input.discountPercent ?? prev.discountPercent,
        importanceClass: input.importanceClass,
        cardNumber: input.cardNumber?.trim() || undefined,
        paidAmount: nextExtraPaid,
        lastName: input.lastName?.trim() || undefined,
        middleName: input.middleName?.trim() || undefined,
        additionalPhone: input.additionalPhone ? validatePhone(input.additionalPhone) : undefined,
        avatar: input.avatar ?? prev.avatar,
        nationalId: validateNationalId(input.nationalId) ?? prev.nationalId,
        birthdayGreetingOptOut: input.birthdayGreetingOptOut,
        locale: input.locale ?? prev.locale,
        preferredContact: input.preferredContact ?? prev.preferredContact,
      };
      if (input.customFieldValues) {
        s.customFieldValues[input.clientId] = {
          ...s.customFieldValues[input.clientId],
          ...input.customFieldValues,
        };
      }
    });
    if (before) {
      const after: ClientFormFields = {
        name,
        lastName: input.lastName,
        middleName: input.middleName,
        phone: normalized,
        additionalPhone: input.additionalPhone,
        email: input.email,
        birthday: input.birthday,
        // «Не указан» в форме — undefined, в базе — 'unknown': иначе каждая правка писала в журнал «Изменено: Пол»
        gender: input.gender ?? 'unknown',
        importanceClass: input.importanceClass,
        cardNumber: input.cardNumber,
        discountPercent: input.discountPercent,
        blocked: input.blocked,
        note: input.note,
        tags: input.tags,
        paidAmount: nextExtraPaid,
        avatar: input.avatar,
        nationalId: input.nationalId,
        birthdayGreetingOptOut: input.birthdayGreetingOptOut,
        locale: input.locale,
        preferredContact: input.preferredContact,
      };
      const changedFields = CHANGE_LOG_FIELDS.filter((f) => !fieldValuesEqual(before[f], after[f]));
      if (changedFields.length > 0) {
        logChange(input.businessId, {
          clientId: input.clientId,
          clientName: name,
          action: 'updated',
          changedFields,
          authorId: input.actorId,
          authorName: input.actorName,
        });
      }
    }
    return toRow(client, state.profiles[input.clientId], state.broadcastHistory[input.clientId] ?? []);
  });
}

/** Правка только примечания — из окна записи, не открывая карточку (F-04-095) */
export function updateClientNote(clientId: Id, note: string): Promise<Client> {
  if (isApiMode()) {
    const businessId = C.bizOf();
    return C.updateClientNote(businessId, clientId, note).then(() => C.getClientRow(businessId, clientId).then(toClient));
  }
  return request(() => {
    assertCan('clients.edit');
    return coreTx.update('clients', clientId, { note: note.trim() || undefined });
  });
}

/** Удаление клиента из карточки (F-04-074): право clients.delete проверяет и экран, и api */
export function deleteClient(businessId: Id, clientId: Id, actorId?: Id, actorName?: string): Promise<void> {
  if (isApiMode()) return C.deleteClient(businessId, clientId);
  return request(() => {
    assertCan('clients.delete');
    deleteClientTx(businessId, clientId, actorId, actorName);
  });
}

/**
 * F-04-211: удаление всех данных клиента по его требованию (GDPR) — в отличие от `deleteClient`
 * (мягкое удаление, F-04-137: имя/телефон остаются в удалённых записях отчётов, карточка «возвращается»
 * по тому же номеру, если клиент придёт снова), здесь телефон и все личные данные анонимизируются
 * НАВСЕГДА: возврата по номеру нет, а во всех прошлых записях/визитах остаётся только «Удалённый клиент».
 * Работает и с уже мягко удалённой карточкой (deletedAt уже стоит).
 */
const PURGED_CLIENT_NAME = 'Удалённый клиент';

export function purgeClientData(businessId: Id, clientId: Id, actorId?: Id, actorName?: string): Promise<void> {
  if (isApiMode()) return C.purgeClientData(businessId, clientId);
  return request(async () => {
    // Навсегда, право как у удаления (сервер: clients.delete)
    assertCan('clients.delete');
    const client = readCore().clients.find((c) => c.id === clientId && c.businessId === businessId);
    if (!client) throw new ApiError('not_found', 'Клиент не найден');
    const anonymizedPhone = `purged:${clientId}`;
    coreTx.update('clients', clientId, {
      name: PURGED_CLIENT_NAME,
      phone: anonymizedPhone,
      email: undefined,
      note: undefined,
      tags: [],
      birthday: undefined,
      deletedAt: client.deletedAt ?? nowDateTime(),
    });
    mutateArea('clients', (s) => {
      delete s.profiles[clientId];
      delete s.customFieldValues[clientId];
      delete s.comments[clientId];
      delete s.appActivity[clientId];
      delete s.broadcastHistory[clientId];
      delete s.files[clientId];
      delete s.calls[clientId];
      delete s.manualVisitPayments[clientId];
      s.profiles[clientId] = { ...emptyProfile(), purgedAt: nowDateTime() };
      // F-04-211: «Удалить полностью (по закону)» должно стирать имя и из ПРОШЛЫХ записей журнала —
      // иначе оно продолжает читаться в истории изменений после «полного» удаления.
      const list = s.changeLog[businessId] ?? [];
      s.changeLog[businessId] = list.map((e) => (e.clientId === clientId ? { ...e, clientName: PURGED_CLIENT_NAME } : e));
    });
    logChange(businessId, {
      clientId,
      clientName: PURGED_CLIENT_NAME,
      action: 'purged',
      authorId: actorId,
      authorName: actorName,
    });
  });
}

export function getCustomFieldValues(clientId: Id): Promise<Record<string, string>> {
  if (isApiMode()) return C.getCustomFieldValues(C.bizOf(), clientId);
  return request(() => readArea('clients').customFieldValues[clientId] ?? {});
}
