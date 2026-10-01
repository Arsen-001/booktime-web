'use client';

/**
 * Раздел «clients» на настоящем сервере (docs/backend/PLAN.md этап 5, `01` §5, `02` §6). Функции src/api/clients/*
 * в режиме `api` зовут эти; экран получает те же типы, что от мока. Права проверяет сервер — здесь их нет.
 *
 * Рассылки CRM (bulkAudience/bulkSendMessage/bulkSendPush/listMessageLog/listClientMessages/sendBookingWindowMessage)
 * и анкета клиента (submitConsentForm, под сессией бизнеса) — на сервере с этапа 21 (сдача, попытка 4).
 *
 * Зеркало: клиенты НЕ входят в общий снимок /core (mirror.ts — K8, «10 000 клиентов не поместятся в ответ»);
 * сюда кладутся только клиенты, которых коснулся этот раздел (mirrorClients/unmirrorClient), чтобы разделы,
 * ещё живущие на моке (журнал, online, notify…), видели тех же клиентов, что и CRM — в пределах уже открытого.
 */
import { apiIdentity } from '@/api/identity';
import { HttpApiError, http } from '@/api/http';
import { mirrorClients, unmirrorClient } from '@/api/mirror';
import { ApiError, trackRead } from '@/api/request';
import { DuplicatePhoneError } from '@/api/clients/shared';
import type { Client, Id } from '@/domain/core';
import type {
  AppActivity,
  BookingWindowSection,
  BroadcastMessage,
  Certificate,
  ClientCategory,
  ClientChangeLogEntry,
  ClientColumnId,
  ClientComment,
  ClientFile,
  ClientListPage,
  ClientListQuery,
  ClientRow,
  ClientsFineRights,
  ColumnsPrefs,
  CustomFieldDef,
  ExportLogEntry,
  ImportColumnTarget,
  ImportRowResult,
  ImportRunSummary,
  Subscription,
} from '@/domain/clients';

export function bizOf(businessId?: Id): Id {
  const id = businessId ?? apiIdentity()?.businessId;
  if (!id) throw new ApiError('forbidden', 'No business in session');
  return id;
}

const base = (businessId: Id) => `/v1/biz/${businessId}`;

/** Только поля ядра (Client мока) — для зеркала (mirror.ts): остальное (скидка, сумма…) — свои поля ClientRow */
function toCoreClient(r: ClientRow): Client {
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

function mirrorRow(row: ClientRow): ClientRow {
  mirrorClients([toCoreClient(row)]);
  return row;
}

async function withDuplicate<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof HttpApiError && e.code === 'duplicate_phone' && e.fields?.existingClientId) {
      throw new DuplicatePhoneError(e.fields.existingClientId);
    }
    throw e;
  }
}

// ─────────── список / поиск (K8: фильтр и подсчёт — на сервере) ───────────

export async function listClients(query: ClientListQuery): Promise<ClientListPage> {
  trackRead('areas.clients');
  const page = await http<ClientListPage>('POST', `${base(query.businessId)}/clients/search`, {
    locationIds: query.locationIds,
    search: query.search,
    pick: query.pick,
    filters: query.filters,
    sort: query.sort,
    onlyStaffId: query.onlyStaffId,
    page: query.page,
    pageSize: query.pageSize,
    revealId: query.revealId,
  });
  mirrorClients(page.rows.map(toCoreClient));
  return page;
}

export async function listClientRows(businessId: Id): Promise<ClientRow[]> {
  trackRead('areas.clients');
  const rows = await http<ClientRow[]>('GET', `${base(businessId)}/clients`);
  mirrorClients(rows.map(toCoreClient));
  return rows;
}

export function getColumnsPrefs(businessId: Id, staffId?: Id): Promise<ColumnsPrefs> {
  trackRead('areas.clients');
  return http<ColumnsPrefs>('GET', `${base(businessId)}/clients/columns`, undefined, { query: { staffId } });
}

export function setVisibleColumns(input: { businessId: Id; staffId?: Id; visible: ClientColumnId[] }): Promise<ColumnsPrefs> {
  return http<ColumnsPrefs>('PUT', `${base(input.businessId)}/clients/columns`, { staffId: input.staffId, visible: input.visible });
}

export function togglePinnedColumn(input: { businessId: Id; staffId?: Id; id: ClientColumnId }): Promise<ColumnsPrefs> {
  return http<ColumnsPrefs>('PUT', `${base(input.businessId)}/clients/columns/pin`, { staffId: input.staffId, id: input.id });
}

// ─────────── карточка (F-04-044…074) ───────────

export async function createClient(businessId: Id, body: Record<string, unknown>): Promise<ClientRow> {
  const row = await withDuplicate(() => http<ClientRow>('POST', `${base(businessId)}/clients`, body, { idempotencyKey: crypto.randomUUID() }));
  return mirrorRow(row);
}

export async function getClientRow(businessId: Id, clientId: Id, businessIds?: Id[], restrictToStaffId?: Id): Promise<ClientRow> {
  trackRead('areas.clients');
  const row = await http<ClientRow>('GET', `${base(businessId)}/clients/${clientId}`, undefined, {
    query: { locationIds: businessIds?.length ? businessIds.join(',') : undefined, onlyStaffId: restrictToStaffId },
  });
  return mirrorRow(row);
}

export async function updateClient(businessId: Id, clientId: Id, body: Record<string, unknown>, version?: number): Promise<ClientRow> {
  const row = await withDuplicate(() => http<ClientRow>('PATCH', `${base(businessId)}/clients/${clientId}`, body, { version }));
  return mirrorRow(row);
}

export function updateClientNote(businessId: Id, clientId: Id, note: string): Promise<void> {
  return http('PATCH', `${base(businessId)}/clients/${clientId}/note`, { note });
}

export async function deleteClient(businessId: Id, clientId: Id): Promise<void> {
  await http('DELETE', `${base(businessId)}/clients/${clientId}`);
  unmirrorClient(clientId);
}

export function purgeClientData(businessId: Id, clientId: Id): Promise<void> {
  return http('POST', `${base(businessId)}/clients/${clientId}/anonymize`);
}

export function getCustomFieldValues(businessId: Id, clientId: Id): Promise<Record<string, string>> {
  return http('GET', `${base(businessId)}/clients/${clientId}/fields`);
}

export function listClientChangeLog(businessId: Id, clientId?: Id): Promise<ClientChangeLogEntry[]> {
  trackRead('areas.clients');
  return http<ClientChangeLogEntry[]>('GET', clientId ? `${base(businessId)}/clients/${clientId}/changelog` : `${base(businessId)}/clients/changelog`);
}

// ─────────── дубли: объединение и массовое удаление (F-04-135…137, F-04-042) ───────────

export async function mergeClients(businessId: Id, keepId: Id, duplicateId: Id): Promise<void> {
  await http('POST', `${base(businessId)}/clients/merge`, { keepId, duplicateId });
  unmirrorClient(duplicateId);
}

export async function bulkDeleteClients(businessId: Id, clientIds: Id[]): Promise<void> {
  await http('POST', `${base(businessId)}/clients/bulk-delete`, { clientIds });
  clientIds.forEach(unmirrorClient);
}

export function bulkAddCategory(businessId: Id, clientIds: Id[], category: string, color?: string): Promise<void> {
  return http('POST', `${base(businessId)}/clients/bulk-category`, { clientIds, category, color });
}

// ─────────── категории (F-04-109/110) ───────────

export function listCategories(businessId: Id): Promise<ClientCategory[]> {
  trackRead('areas.clients');
  return http<ClientCategory[]>('GET', `${base(businessId)}/client-categories`);
}

export function listCategoryOptions(businessId: Id): Promise<string[]> {
  trackRead('areas.clients');
  return http<string[]>('GET', `${base(businessId)}/client-categories/options`);
}

export function createCategory(businessId: Id, name: string, color: string): Promise<void> {
  return http('POST', `${base(businessId)}/client-categories`, { name, color });
}

export function updateCategory(businessId: Id, name: string, next: { name: string; color: string }): Promise<void> {
  return http('PATCH', `${base(businessId)}/client-categories/${encodeURIComponent(name)}`, next);
}

export function deleteCategory(businessId: Id, name: string): Promise<void> {
  return http('DELETE', `${base(businessId)}/client-categories/${encodeURIComponent(name)}`);
}

// ─────────── комментарии (F-04-070) ───────────

export function listComments(businessId: Id, clientId: Id): Promise<ClientComment[]> {
  trackRead('areas.clients');
  return http<ClientComment[]>('GET', `${base(businessId)}/clients/${clientId}/comments`);
}

export function addComment(businessId: Id, clientId: Id, text: string): Promise<ClientComment> {
  return http<ClientComment>('POST', `${base(businessId)}/clients/${clientId}/comments`, { text });
}

export function deleteComment(businessId: Id, clientId: Id, commentId: Id): Promise<void> {
  return http('DELETE', `${base(businessId)}/clients/${clientId}/comments/${commentId}`);
}

// ─────────── файлы (F-04-086) ───────────

export function listFiles(businessId: Id, clientId: Id): Promise<ClientFile[]> {
  trackRead('areas.clients');
  return http<ClientFile[]>('GET', `${base(businessId)}/clients/${clientId}/files`);
}

export function addFile(businessId: Id, clientId: Id, input: { name: string; ext: string; size: number; dataUrl: string }): Promise<ClientFile> {
  return http<ClientFile>('POST', `${base(businessId)}/clients/${clientId}/files`, input);
}

export function deleteFile(businessId: Id, clientId: Id, fileId: string): Promise<void> {
  return http('DELETE', `${base(businessId)}/clients/${clientId}/files/${fileId}`);
}

// ─────────── приложение клиента (F-04-072, F-00-130) ───────────

export function getAppActivity(businessId: Id, clientId: Id): Promise<AppActivity | null> {
  return http<AppActivity | null>('GET', `${base(businessId)}/clients/${clientId}/app`);
}

export function getInvitedAt(businessId: Id, clientId: Id): Promise<string | null> {
  return http<string | null>('GET', `${base(businessId)}/clients/${clientId}/invited-at`);
}

export function inviteToApp(businessId: Id, clientId: Id): Promise<string> {
  return http<string>('POST', `${base(businessId)}/clients/${clientId}/invite`);
}

// ─────────── согласие на рекламу (F-04-153/227) ───────────

export function recordAdConsent(businessId: Id, clientId: Id, given: boolean, method: 'widget' | 'paper' | 'link') {
  return http('POST', `${base(businessId)}/clients/${clientId}/consent`, { given, method });
}

// ─────────── доп. поля (F-04-060, 139…145) ───────────

export function listCustomFieldDefs(businessId: Id): Promise<CustomFieldDef[]> {
  trackRead('areas.clients');
  return http<CustomFieldDef[]>('GET', `${base(businessId)}/client-fields`);
}

export function addCustomFieldDef(businessId: Id, input: Record<string, unknown>): Promise<CustomFieldDef> {
  return http<CustomFieldDef>('POST', `${base(businessId)}/client-fields`, input);
}

export function deleteCustomFieldDef(businessId: Id, fieldId: Id): Promise<void> {
  return http('DELETE', `${base(businessId)}/client-fields/${fieldId}`);
}

// ─────────── настройки базы (arch-a1 №2) ───────────

export interface ServerClientsSettings {
  autoSaveChatLeads: boolean;
  lostAfterDays: number;
  showFullNameFields: boolean;
  customFieldDefs: CustomFieldDef[];
  showLoyaltySearchInBookingWindow: boolean;
  /** F-04-093, этап 21 «Сдача» */
  bookingWindowFavorites: BookingWindowSection[];
}

export function getSettings(businessId: Id): Promise<ServerClientsSettings> {
  trackRead('areas.clients');
  return http<ServerClientsSettings>('GET', `${base(businessId)}/clients/settings`);
}

export function setShowFullNameFields(businessId: Id, value: boolean): Promise<boolean> {
  return http<boolean>('PUT', `${base(businessId)}/clients/settings/show-full-name`, { value });
}

export function setShowLoyaltySearchInBookingWindow(businessId: Id, value: boolean): Promise<boolean> {
  return http<boolean>('PUT', `${base(businessId)}/clients/settings/show-loyalty-search`, { value });
}

export function setAutoSaveChatLeads(businessId: Id, value: boolean): Promise<boolean> {
  return http<boolean>('PUT', `${base(businessId)}/clients/settings/auto-save-chat-leads`, { value });
}

export function setLostAfterDays(businessId: Id, days: number): Promise<number> {
  return http<number>('PUT', `${base(businessId)}/clients/settings/lost-after-days`, { days });
}

export function toggleBookingWindowFavorite(businessId: Id, section: BookingWindowSection): Promise<BookingWindowSection[]> {
  return http<BookingWindowSection[]>('PUT', `${base(businessId)}/clients/settings/booking-window-favorites/toggle`, { section });
}

export async function simulateChatLead(businessId: Id): Promise<Client> {
  const row = await http<{ id: Id; businessId: Id; name: string; phone: string }>('POST', `${base(businessId)}/clients/simulate-chat-lead`);
  const client: Client = { id: row.id, businessId: row.businessId, name: row.name, phone: row.phone, gender: 'unknown', tags: [], noShowCount: 0, createdAt: new Date().toISOString() };
  mirrorClients([client]);
  return client;
}

// ─────────── лояльность клиента в окне записи (F-04-093/099, этап 21 «rest») ───────────

export function getClientLoyalty(businessId: Id, clientId: Id): Promise<{ certificates: Certificate[]; subscriptions: Subscription[] }> {
  return http('GET', `${base(businessId)}/loyalty/clients/${clientId}/assets`);
}

export function findClientByLoyaltyCode(businessId: Id, code: string): Promise<{ clientId: Id; clientName: string } | undefined> {
  return http('GET', `${base(businessId)}/loyalty/find-by-code`, undefined, { query: { code } });
}

// ─────────── своё напоминание и приглашение на повтор (F-04-100, этап 21 «rest») ───────────

export function getBookingReminder(businessId: Id, bookingId: Id): Promise<{ bookingId: Id; remindAt?: string; revisitInviteDays?: number }> {
  return http('GET', `${base(businessId)}/bookings/${bookingId}/reminder`);
}

export function setBookingReminder(
  businessId: Id,
  bookingId: Id,
  patch: { remindAt?: string; revisitInviteDays?: number },
): Promise<{ bookingId: Id; remindAt?: string; revisitInviteDays?: number }> {
  return http('PUT', `${base(businessId)}/bookings/${bookingId}/reminder`, patch);
}

// ─────────── тонкие права «Клиентская база» (F-04-194…204) ───────────

export function getStaffFineRights(businessId: Id, staffId: Id): Promise<Partial<ClientsFineRights> | undefined> {
  return http<Partial<ClientsFineRights> | undefined>('GET', `${base(businessId)}/staff/${staffId}/client-fine-rights`);
}

export function setStaffFineRights(businessId: Id, staffId: Id, rights: Partial<ClientsFineRights>): Promise<Partial<ClientsFineRights>> {
  return http<Partial<ClientsFineRights>>('PUT', `${base(businessId)}/staff/${staffId}/client-fine-rights`, rights);
}

// ─────────── импорт (F-04-126…129) ───────────

export function runImport(
  businessId: Id,
  authorName: string,
  mapping: ImportColumnTarget[],
  rows: string[][],
  method: ImportRunSummary['method'],
): Promise<{ results: ImportRowResult[]; summary: ImportRunSummary }> {
  return http('POST', `${base(businessId)}/clients/import`, { authorName, mapping, rows, method });
}

export function listImportRuns(businessId: Id): Promise<ImportRunSummary[]> {
  return http<ImportRunSummary[]>('GET', `${base(businessId)}/clients/import-runs`);
}

// ─────────── выгрузка (F-04-130, P4) ───────────

export function exportClients(input: { businessId: Id; locationIds?: Id[]; ids: Id[]; authorName: string; fileName: string }): Promise<ClientRow[]> {
  const { businessId, ...body } = input;
  return http<ClientRow[]>('POST', `${base(businessId)}/clients/export`, body);
}

export function listExportLog(businessId: Id): Promise<ExportLogEntry[]> {
  return http<ExportLogEntry[]>('GET', `${base(businessId)}/clients/export-log`);
}

// ─────────── рассылки CRM, журнал сообщений, анкета (F-04-038…040, F-04-100, F-04-154; этап 21, сдача) ───────────

export function bulkAudience(businessId: Id, clientIds: Id[]): Promise<{ sms: Id[]; push: Id[] }> {
  if (!clientIds.length) return Promise.resolve({ sms: [], push: [] });
  return http<{ sms: Id[]; push: Id[] }>('POST', `${base(businessId)}/clients/bulk/audience`, { clientIds });
}

export function bulkSendMessage(businessId: Id, clientIds: Id[], text: string): Promise<number> {
  return http<{ sent: number }>('POST', `${base(businessId)}/clients/bulk/sms`, { clientIds, text }).then((r) => r.sent);
}

export function bulkSendPush(businessId: Id, clientIds: Id[], text: string): Promise<number> {
  return http<{ sent: number }>('POST', `${base(businessId)}/clients/bulk/push`, { clientIds, text }).then((r) => r.sent);
}

export function listMessageLog(businessId: Id, range: { from: string; to: string }): Promise<BroadcastMessage[]> {
  trackRead('areas.clients');
  return http<BroadcastMessage[]>('GET', `${base(businessId)}/client-messages`, undefined, { query: range });
}

export function listClientMessages(businessId: Id, clientId: Id): Promise<BroadcastMessage[]> {
  trackRead('areas.clients');
  return http<BroadcastMessage[]>('GET', `${base(businessId)}/clients/${clientId}/messages`);
}

export function sendBookingWindowMessage(input: { businessId: Id; clientId: Id; text: string; channel: 'push' | 'whatsapp' }): Promise<void> {
  const { businessId, ...body } = input;
  return http<{ ok: true }>('POST', `${base(businessId)}/clients/booking-window-message`, body).then(() => undefined);
}

export function submitConsentForm(businessId: Id, clientId: Id, body: { name?: string; birthday?: string; adConsentGiven: boolean }): Promise<Client> {
  return http<Client>('POST', `${base(businessId)}/clients/${clientId}/consent-form`, body);
}
