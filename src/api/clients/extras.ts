'use client';

/** Всё вокруг карточки: комментарии, файлы, звонки, посетители, согласие на рекламу, приглашение в приложение, плитки окна записи. */
import type { AppActivity, BookingWindowSection, ClientCall, ClientComment, ClientFile, ClientProfile, ConsentMethod, VisitorInfo } from '@/domain/clients';
import { CLIENT_FILE_EXTENSIONS, CLIENT_FILE_MAX_MB, CLIENT_FILE_SERVER_MAX_MB, emptyProfile } from '@/domain/clients';
import type { Booking, Client, Id, ISODate, ISODateTime } from '@/domain/core';
import * as C from '@/api/clients/clients.server';
import * as S from '@/api/journal.server';
import { isApiMode } from '@/api/http';
import { readArea, readCore, mutateArea } from '@/api/area';
import { coreTx } from '@/api/core';
import { ApiError, request } from '@/api/request';
import { newId } from '@/lib/id';
import { nowDateTime } from '@/lib/date';

// ─────────────────────────── История комментариев (F-04-070) ───────────────────────────

export function listComments(clientId: Id): Promise<ClientComment[]> {
  if (isApiMode()) return C.listComments(C.bizOf(), clientId);
  return request(() => (readArea('clients').comments[clientId] ?? []).slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
}

export function addComment(input: { clientId: Id; authorId: Id; authorName: string; text: string }): Promise<ClientComment> {
  // authorId/authorName сервер берёт из сессии сам (не доверяет чужому вводу — 03 §2)
  if (isApiMode()) return C.addComment(C.bizOf(), input.clientId, input.text);
  return request(() => {
    const text = input.text.trim();
    if (!text) throw new ApiError('empty_comment', 'Комментарий пуст');
    const comment: ClientComment = {
      id: newId('cmt'),
      clientId: input.clientId,
      authorId: input.authorId,
      authorName: input.authorName,
      text,
      createdAt: nowDateTime(),
    };
    mutateArea('clients', (s) => {
      s.comments[input.clientId] = [...(s.comments[input.clientId] ?? []), comment];
    });
    return comment;
  });
}

export function deleteComment(clientId: Id, commentId: Id): Promise<void> {
  if (isApiMode()) return C.deleteComment(C.bizOf(), clientId, commentId);
  return request(() => {
    mutateArea('clients', (s) => {
      s.comments[clientId] = (s.comments[clientId] ?? []).filter((c) => c.id !== commentId);
    });
  });
}

// ─────────────────────────── Мобильное приложение (F-04-072) ───────────────────────────

/** null, а не undefined — иначе кэш запроса ругается «Query data cannot be undefined» у клиентов без активности в приложении */
export function getAppActivity(clientId: Id): Promise<AppActivity | null> {
  if (isApiMode()) return C.getAppActivity(C.bizOf(), clientId);
  return request(() => readArea('clients').appActivity[clientId] ?? null);
}

// ─────────────────────────── Согласие на рекламу (F-04-153, F-04-227) и анкета по ссылке (F-04-154) ────────

export function recordAdConsent(clientId: Id, given: boolean, method: ConsentMethod, recordedBy?: string): Promise<ClientProfile> {
  if (isApiMode()) {
    const businessId = C.bizOf();
    return C.recordAdConsent(businessId, clientId, given, method).then(async () => {
      const row = await C.getClientRow(businessId, clientId);
      return {
        discountPercent: row.discount,
        importanceClass: row.importanceClass,
        cardNumber: row.cardNumber,
        paidAmount: row.paid,
        lastName: row.lastName,
        middleName: row.middleName,
        additionalPhone: row.additionalPhone,
        avatar: row.avatar,
        importedSold: row.sold,
        nationalId: row.nationalId,
        adConsent: row.consent,
        birthdayGreetingOptOut: row.birthdayGreetingOptOut,
        locale: row.locale,
        preferredContact: row.preferredContact,
      };
    });
  }
  return request(
    () =>
      mutateArea('clients', (s) => {
        const prev = s.profiles[clientId] ?? emptyProfile();
        s.profiles[clientId] = { ...prev, adConsent: { given, at: nowDateTime(), method, recordedBy } };
      }).profiles[clientId],
  );
}

export interface ConsentFormInput {
  clientId: Id;
  name?: string;
  phone?: string;
  birthday?: string;
  adConsentGiven: boolean;
}

/** F-04-154: анкета по ссылке/QR — клиент заполняет с телефона, ответы попадают в карточку */
export function submitConsentForm(input: ConsentFormInput): Promise<Client> {
  if (isApiMode()) return C.submitConsentForm(C.bizOf(), input.clientId, { name: input.name?.trim() || undefined, birthday: input.birthday || undefined, adConsentGiven: input.adConsentGiven });
  return request(async () => {
    const client = readCore().clients.find((c) => c.id === input.clientId);
    if (!client) throw new ApiError('not_found', 'Клиент не найден');
    const patch: { name?: string; birthday?: string } = {};
    if (input.name?.trim()) patch.name = input.name.trim();
    if (input.birthday) patch.birthday = input.birthday;
    const updated = Object.keys(patch).length ? coreTx.update('clients', input.clientId, patch) : client;
    mutateArea('clients', (s) => {
      const prev = s.profiles[input.clientId] ?? emptyProfile();
      s.profiles[input.clientId] = {
        ...prev,
        adConsent: { given: input.adConsentGiven, at: nowDateTime(), method: 'link' },
      };
    });
    return updated;
  });
}

// ─────────────────────────── «⋯ Ещё» в мини-карточке окна записи (F-04-093) ───────────────────────────

export function getBookingWindowFavorites(): Promise<BookingWindowSection[]> {
  if (isApiMode()) return C.getSettings(C.bizOf()).then((s) => s.bookingWindowFavorites);
  return request(() => readArea('clients').bookingWindowFavorites);
}

export function toggleBookingWindowFavorite(section: BookingWindowSection): Promise<BookingWindowSection[]> {
  if (isApiMode()) return C.toggleBookingWindowFavorite(C.bizOf(), section);
  return request(
    () =>
      mutateArea('clients', (s) => {
        s.bookingWindowFavorites = s.bookingWindowFavorites.includes(section)
          ? s.bookingWindowFavorites.filter((x) => x !== section)
          : [...s.bookingWindowFavorites, section];
      }).bookingWindowFavorites,
  );
}

// ─────────────────────────── Файлы клиента (F-04-086) ───────────────────────────

export function listFiles(clientId: Id): Promise<ClientFile[]> {
  if (isApiMode()) return C.listFiles(C.bizOf(), clientId);
  return request(() => (readArea('clients').files[clientId] ?? []).slice().sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)));
}

export function addFile(input: { clientId: Id; name: string; ext: string; size: number; dataUrl: string; uploadedBy: string }): Promise<ClientFile> {
  // uploadedBy сервер берёт из сессии сам (03 §2)
  if (isApiMode()) return C.addFile(C.bizOf(), input.clientId, input);
  return request(() => {
    const ext = input.ext.toLowerCase();
    if (!(CLIENT_FILE_EXTENSIONS as readonly string[]).includes(ext)) throw new ApiError('bad_ext', 'Недопустимый формат файла');
    if (input.size > CLIENT_FILE_MAX_MB * 1024 * 1024) throw new ApiError('too_big', `Файл больше ${CLIENT_FILE_MAX_MB} МБ`);
    const file: ClientFile = {
      id: newId('file'),
      clientId: input.clientId,
      name: input.name,
      ext,
      size: input.size,
      dataUrl: input.dataUrl,
      uploadedAt: nowDateTime(),
      uploadedBy: input.uploadedBy,
    };
    mutateArea('clients', (s) => {
      s.files[input.clientId] = [...(s.files[input.clientId] ?? []), file];
    });
    return file;
  });
}

/** Предел файла клиента, МБ: сервер (10 — как у фото) или мок (data: URL в localStorage, как раньше) */
export function clientFileMaxMb(): number {
  return isApiMode() ? CLIENT_FILE_SERVER_MAX_MB : CLIENT_FILE_MAX_MB;
}

/**
 * Прикрепить файл к карточке (F-04-086). Режим `api` — файл уходит на сервер как есть (закрытое хранилище, 04.10.2026),
 * с процентом загрузки; мок — как раньше: data: URL в моковой базе.
 */
export async function uploadClientFile(
  input: { clientId: Id; file: File; uploadedBy: string },
  opts: { onProgress?: (fraction: number) => void; signal?: AbortSignal } = {},
): Promise<ClientFile> {
  if (isApiMode()) return C.uploadFile(C.bizOf(), input.clientId, input.file, opts);
  const dataUrl: string = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(input.file);
  });
  const ext = input.file.name.split('.').pop()?.toLowerCase() ?? '';
  return addFile({ clientId: input.clientId, name: input.file.name, ext, size: input.file.size, dataUrl, uploadedBy: input.uploadedBy });
}

/** Ссылка «Скачать»: файл на сервере — адрес скачивания через кабинет; старые строки и мок — data: URL */
export function clientFileHref(f: ClientFile): string {
  return f.contentUrl ?? f.dataUrl;
}

export function deleteFile(clientId: Id, fileId: string): Promise<void> {
  if (isApiMode()) return C.deleteFile(C.bizOf(), clientId, fileId);
  return request(() => {
    mutateArea('clients', (s) => {
      s.files[clientId] = (s.files[clientId] ?? []).filter((f) => f.id !== fileId);
    });
  });
}

/**
 * Звонки клиента (F-04-079). 🔒 Телефония нигде в проекте не подключена — список демо, с пометкой
 * «демо» на экране (правило 0.1). Пропущенные звонки оператора KOMPaaS попадали бы сюда так же.
 */
export function listCalls(clientId: Id): Promise<ClientCall[]> {
  // Р19: телефония — чужой сервис, настоящего обмена звонками нет — у сервера журнала звонков нет, значит и звонков нет
  if (isApiMode()) return Promise.resolve([]);
  return request(() => (readArea('clients').calls[clientId] ?? []).slice().sort((a, b) => b.at.localeCompare(a.at)));
}

// ─────────────────────────── Посетители (F-04-091) ───────────────────────────

/**
 * Люди, записанные на номер этого клиента (F-00-125 «для кого»: ребёнок/питомец/другое). Считаем по ВСЕМ
 * записям, включая мягко удалённые (deletedAt) — карточка не теряет посетителя, когда все записи удалены
 * (проверено прогоном на Altegio: «Посетители: …» остаётся).
 */
export function listVisitors(businessId: Id, clientId: Id): Promise<VisitorInfo[]> {
  if (isApiMode()) return S.listBookings({ businessId, clientId, includeDeleted: true }).then((bookings) => aggregateVisitors(bookings));
  return request(() => aggregateVisitors(readCore().bookings.filter((b) => b.businessId === businessId && b.clientId === clientId)));
}

/** Общая свёртка для мока и сервера — держит правило F-04-091 (visits считает только 'arrived' без deletedAt) в одном месте */
function aggregateVisitors(bookings: Booking[]): VisitorInfo[] {
  const map = new Map<string, VisitorInfo>();
  bookings
    .filter((b) => b.forWhom !== 'self' && b.visitorName?.trim())
    .forEach((b) => {
      const key = `${b.forWhom}:${b.visitorName}`;
      const row = map.get(key) ?? {
        key,
        name: b.visitorName!,
        forWhom: b.forWhom as VisitorInfo['forWhom'],
        visits: 0,
        lastVisit: undefined,
      };
      if (!b.deletedAt && b.status === 'arrived') row.visits += 1;
      if (!b.deletedAt) {
        const d = b.start.slice(0, 10) as ISODate;
        if (!row.lastVisit || d > row.lastVisit) row.lastVisit = d;
      }
      map.set(key, row);
    });
  return Array.from(map.values());
}

// ─────────────────────────── Приглашение старой базы в приложение (F-00-130) ───────────────────────────

export function getInvitedAt(clientId: Id): Promise<ISODateTime | null> {
  if (isApiMode()) return C.getInvitedAt(C.bizOf(), clientId);
  return request(() => readArea('clients').invitedAt[clientId] ?? null);
}

export function inviteToApp(clientId: Id): Promise<ISODateTime> {
  if (isApiMode()) return C.inviteToApp(C.bizOf(), clientId);
  return request(() => {
    const client = readCore().clients.find((c) => c.id === clientId);
    if (!client) throw new ApiError('not_found', 'Клиент не найден');
    if (client.appUserId) throw new ApiError('already_has_app', 'У клиента уже есть приложение');
    const at = nowDateTime();
    mutateArea('clients', (s) => {
      s.invitedAt[clientId] = at;
    });
    return at;
  });
}
