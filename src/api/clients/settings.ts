'use client';

/** Настройки клиентской базы по бизнесу (arch-a1 №2) и тонкие права сотрудников. */
import type { BookingReminder, ClientsFineRights, CustomFieldDef, CustomFieldType } from '@/domain/clients';
import { CHAT_LEAD_TAG } from '@/domain/clients';
import type { Client, Id, ISODateTime } from '@/domain/core';
import * as C from '@/api/clients/clients.server';
import { isApiMode } from '@/api/http';
import { readArea, mutateArea } from '@/api/area';
import { coreTx } from '@/api/core';
import { ApiError, request } from '@/api/request';
import { newId } from '@/lib/id';
import { nowDateTime } from '@/lib/date';
import { bizOf, bizSettings, patchBizSettings } from '@/api/clients/shared';

export function listCustomFieldDefs(businessId?: Id): Promise<CustomFieldDef[]> {
  if (isApiMode()) return C.listCustomFieldDefs(C.bizOf(businessId));
  return request(() => bizSettings(bizOf(businessId)).customFieldDefs);
}

/** F-04-145: «ключ-значение для API» — латиница/цифры/подчёркивание из подписи, с числовым суффиксом при повторе */
function slugifyApiKey(label: string, taken: Set<string>): string {
  const translit: Record<string, string> = {
    а: 'a',
    б: 'b',
    в: 'v',
    г: 'g',
    д: 'd',
    е: 'e',
    ё: 'e',
    ж: 'zh',
    з: 'z',
    и: 'i',
    й: 'y',
    к: 'k',
    л: 'l',
    м: 'm',
    н: 'n',
    о: 'o',
    п: 'p',
    р: 'r',
    с: 's',
    т: 't',
    у: 'u',
    ф: 'f',
    х: 'h',
    ц: 'ts',
    ч: 'ch',
    ш: 'sh',
    щ: 'sch',
    ъ: '',
    ы: 'y',
    ь: '',
    э: 'e',
    ю: 'yu',
    я: 'ya',
  };
  const base =
    label
      .trim()
      .toLowerCase()
      .split('')
      .map((ch) => translit[ch] ?? ch)
      .join('')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'field';
  let key = base;
  let n = 2;
  while (taken.has(key)) {
    key = `${base}_${n}`;
    n += 1;
  }
  return key;
}

export interface AddCustomFieldDefInput {
  businessId: Id;
  label: string;
  type?: CustomFieldType;
  options?: string[];
  required?: boolean;
  editableByClient?: boolean;
  alwaysShowInClientCard?: boolean;
  alwaysShowInBookingWindow?: boolean;
}

export function addCustomFieldDef(input: AddCustomFieldDefInput): Promise<CustomFieldDef> {
  if (isApiMode()) {
    const { businessId, ...body } = input;
    return C.addCustomFieldDef(businessId, body);
  }
  return request(() => {
    const trimmed = input.label.trim();
    if (!trimmed) throw new ApiError('empty_label', 'Укажите название поля');
    const type = input.type ?? 'text';
    const options = type === 'list' ? (input.options ?? []).map((o) => o.trim()).filter(Boolean) : undefined;
    if (type === 'list' && (!options || options.length < 2)) throw new ApiError('list_needs_options', 'Добавьте хотя бы два варианта списка');
    const existing = bizSettings(input.businessId).customFieldDefs;
    const def: CustomFieldDef = {
      id: newId('cf'),
      label: trimmed,
      type,
      options,
      required: input.required ?? false,
      apiKey: slugifyApiKey(trimmed, new Set(existing.map((d) => d.apiKey))),
      editableByClient: input.editableByClient ?? false,
      alwaysShowInClientCard: input.alwaysShowInClientCard ?? false,
      alwaysShowInBookingWindow: input.alwaysShowInBookingWindow ?? false,
    };
    patchBizSettings(input.businessId, { customFieldDefs: [...existing, def] });
    return def;
  });
}

/**
 * F-04-144: удаление доп. поля. ТЗ не говорит явно, что происходит с уже заполненными значениями
 * (❓ в блоке ТЗ) — вывод там же: «исчезают»; здесь удаляем и определение, и значение поля из всех
 * клиентов бизнеса, чтобы карточка не хранила осиротевший `customFieldValues[id]`.
 */
export function deleteCustomFieldDef(input: { businessId: Id; fieldId: Id }): Promise<void> {
  if (isApiMode()) return C.deleteCustomFieldDef(input.businessId, input.fieldId);
  return request(() => {
    const existing = bizSettings(input.businessId).customFieldDefs;
    if (!existing.some((d) => d.id === input.fieldId)) throw new ApiError('not_found', 'Поле уже удалено');
    patchBizSettings(input.businessId, { customFieldDefs: existing.filter((d) => d.id !== input.fieldId) });
    mutateArea('clients', (s) => {
      for (const clientId of Object.keys(s.customFieldValues)) {
        if (input.fieldId in s.customFieldValues[clientId]) {
          delete s.customFieldValues[clientId][input.fieldId];
        }
      }
    });
  });
}

// ─────────────────────────── Настройка «Фамилия/Отчество» (F-04-046) ───────────────────────────

export function getShowFullNameFields(businessId?: Id): Promise<boolean> {
  if (isApiMode()) return C.getSettings(C.bizOf(businessId)).then((s) => s.showFullNameFields);
  return request(() => bizSettings(bizOf(businessId)).showFullNameFields);
}

// ─────────────────────────── Права «Клиентская база» по сотруднику (F-04-194…204) ───────────────────────────

/** Override сотрудника (пусто, если владелец ничего не настраивал — экран берёт умолчание по роли) */
export function getStaffFineRights(staffId: Id): Promise<Partial<ClientsFineRights> | undefined> {
  if (isApiMode()) return C.getStaffFineRights(C.bizOf(), staffId);
  return request(() => readArea('clients').staffRights[staffId]);
}

export function setStaffFineRights(staffId: Id, rights: Partial<ClientsFineRights>): Promise<Partial<ClientsFineRights>> {
  if (isApiMode()) return C.setStaffFineRights(C.bizOf(), staffId, rights);
  return request(
    () =>
      mutateArea('clients', (s) => {
        s.staffRights[staffId] = rights;
      }).staffRights[staffId]!,
  );
}

export function setShowFullNameFields(input: { businessId: Id; value: boolean }): Promise<boolean> {
  if (isApiMode()) return C.setShowFullNameFields(input.businessId, input.value);
  return request(() => patchBizSettings(input.businessId, { showFullNameFields: input.value }).showFullNameFields);
}

// ─────────────────────────── Поиск по лояльности в окне записи (F-04-099) ───────────────────────────

export function getShowLoyaltySearchInBookingWindow(businessId?: Id): Promise<boolean> {
  if (isApiMode()) return C.getSettings(C.bizOf(businessId)).then((s) => s.showLoyaltySearchInBookingWindow);
  return request(() => bizSettings(bizOf(businessId)).showLoyaltySearchInBookingWindow);
}

export function setShowLoyaltySearchInBookingWindow(input: { businessId: Id; value: boolean }): Promise<boolean> {
  if (isApiMode()) return C.setShowLoyaltySearchInBookingWindow(input.businessId, input.value);
  return request(
    () => patchBizSettings(input.businessId, { showLoyaltySearchInBookingWindow: input.value }).showLoyaltySearchInBookingWindow,
  );
}

// ─────────────────────────── Лиды из чата (F-04-016, F-04-187) ───────────────────────────
// Переключатель живёт в настройках журнала (раздел journal, «Чат»); без businessId — текущий бизнес.

export function getAutoSaveChatLeads(businessId?: Id): Promise<boolean> {
  if (isApiMode()) return C.getSettings(C.bizOf(businessId)).then((s) => s.autoSaveChatLeads);
  return request(() => bizSettings(bizOf(businessId)).autoSaveChatLeads);
}

export function setAutoSaveChatLeads(value: boolean, businessId?: Id): Promise<boolean> {
  if (isApiMode()) return C.setAutoSaveChatLeads(C.bizOf(businessId), value);
  return request(() => patchBizSettings(bizOf(businessId), { autoSaveChatLeads: value }).autoSaveChatLeads);
}

let chatLeadCounter = 0;

/**
 * Что сделает хук чата, когда кто-то впервые напишет (F-04-016 «Готово, когда»): карточка с меткой «из чата».
 * Кнопку демонстрации держат настройки журнала — на экране базы её нет.
 */
export function simulateChatLead(businessId: Id): Promise<Client> {
  if (isApiMode()) return C.simulateChatLead(businessId);
  return request(() => {
    if (!bizSettings(businessId).autoSaveChatLeads) {
      throw new ApiError('chat_autosave_off', 'Автосохранение лидов из чата выключено');
    }
    chatLeadCounter += 1;
    return coreTx.create('clients', {
      businessId,
      phone: `+374007${String(900000 + chatLeadCounter).padStart(6, '0')}`,
      name: 'No name',
      gender: 'unknown',
      tags: [CHAT_LEAD_TAG],
      noShowCount: 0,
      createdAt: nowDateTime(),
    });
  });
}

export function getLostAfterDays(businessId?: Id): Promise<number> {
  if (isApiMode()) return C.getSettings(C.bizOf(businessId)).then((s) => s.lostAfterDays);
  return request(() => bizSettings(bizOf(businessId)).lostAfterDays);
}

export function setLostAfterDays(input: { businessId: Id; days: number }): Promise<number> {
  if (isApiMode()) return C.setLostAfterDays(input.businessId, input.days);
  return request(() => {
    if (!Number.isFinite(input.days) || input.days < 7 || input.days > 365) throw new ApiError('invalid_days', 'От 7 до 365 дней');
    return patchBizSettings(input.businessId, { lostAfterDays: Math.round(input.days) }).lostAfterDays;
  });
}

// ─────────────────────────── Своё напоминание и приглашение на повтор (F-04-100) ───────────────────────────

export function getBookingReminder(bookingId: Id): Promise<BookingReminder | undefined> {
  if (isApiMode()) return C.getBookingReminder(C.bizOf(), bookingId);
  return request(() => readArea('clients').bookingReminders[bookingId]);
}

export function setBookingReminder(bookingId: Id, patch: { remindAt?: ISODateTime; revisitInviteDays?: number }): Promise<BookingReminder> {
  if (isApiMode()) {
    return request(async () => {
      if (patch.revisitInviteDays !== undefined && (patch.revisitInviteDays < 0 || patch.revisitInviteDays > 365)) {
        throw new ApiError('invalid_days', 'От 0 до 365 дней');
      }
      return C.setBookingReminder(C.bizOf(), bookingId, patch);
    });
  }
  return request(() => {
    if (patch.revisitInviteDays !== undefined && (patch.revisitInviteDays < 0 || patch.revisitInviteDays > 365)) {
      throw new ApiError('invalid_days', 'От 0 до 365 дней');
    }
    return mutateArea('clients', (s) => {
      const current = s.bookingReminders[bookingId] ?? { bookingId };
      s.bookingReminders[bookingId] = { ...current, ...patch };
    }).bookingReminders[bookingId]!;
  });
}
