'use client';

/** Справочники раздела: категории, сотрудники и услуги для фильтров, черновые сертификаты и абонементы. */
import type { Certificate, ClientCategory, ProductPurchase, Subscription } from '@/domain/clients';
import type { Id } from '@/domain/core';
import * as C from '@/api/clients/clients.server';
import { listStaff as serverListStaff } from '@/api/staff.server';
import { isApiMode } from '@/api/http';
import { readArea, readCore, mutateArea } from '@/api/area';
import { coreTx, currentActor } from '@/api/core';
import { ApiError, request } from '@/api/request';

export function listCertificates(businessId: Id): Promise<Certificate[]> {
  return request(() => readArea('clients').certificates.filter((c) => c.businessId === businessId));
}

export function listSubscriptions(businessId: Id): Promise<Subscription[]> {
  return request(() => readArea('clients').subscriptions.filter((s) => s.businessId === businessId));
}

/** Лояльность одного клиента (F-04-093): сертификаты и абонементы с балансами — для мини-карточки в окне записи */
export function getClientLoyalty(businessId: Id, clientId: Id): Promise<{ certificates: Certificate[]; subscriptions: Subscription[] }> {
  if (isApiMode()) return C.getClientLoyalty(businessId, clientId);
  return request(() => {
    const state = readArea('clients');
    return {
      certificates: state.certificates.filter((c) => c.businessId === businessId && c.clientId === clientId),
      subscriptions: state.subscriptions.filter((s) => s.businessId === businessId && s.clientId === clientId),
    };
  });
}

/**
 * F-04-099: клиент по номеру карты/абонемента/сертификата — включается настройкой
 * showLoyaltySearchInBookingWindow (у нас пока нет карт лояльности как сущности раздела clients,
 * см. qa/requests/clients.md — ищем по номеру абонемента и сертификата).
 */
export function findClientByLoyaltyCode(businessId: Id, code: string): Promise<{ clientId: Id; clientName: string } | undefined> {
  if (isApiMode()) return C.findClientByLoyaltyCode(businessId, code);
  return request(() => {
    const trimmed = code.trim();
    if (!trimmed) return undefined;
    const state = readArea('clients');
    const needle = trimmed.toLowerCase();
    const sub = state.subscriptions.find((s) => s.businessId === businessId && s.code.toLowerCase() === needle);
    const cert = sub ? undefined : state.certificates.find((c) => c.businessId === businessId && c.code.toLowerCase() === needle);
    const clientId = sub?.clientId ?? cert?.clientId;
    if (!clientId) return undefined;
    const client = readCore().clients.find((c) => c.id === clientId && !c.deletedAt);
    if (!client) return undefined;
    return { clientId, clientName: client.name };
  });
}

export function listProductPurchases(businessId: Id): Promise<ProductPurchase[]> {
  return request(() => readArea('clients').productPurchases.filter((p) => p.businessId === businessId));
}

/** Срез записей, которого хватает конструктору фильтров «По визитам» (F-04-019…025) */
export function listClientBookingsIndex(businessId: Id) {
  return request(() =>
    readCore()
      .bookings.filter((b) => b.businessId === businessId && b.clientId && !b.deletedAt)
      .map((b) => ({
        clientId: b.clientId as Id,
        status: b.status,
        start: b.start,
        total: b.total,
        staffId: b.staffId,
        serviceIds: b.services.map((s) => s.serviceId),
      })),
  );
}

/** Сотрудники для фильтра «Сотрудник» (F-04-023) */
export function listStaffOptions(businessId: Id): Promise<{ value: Id; label: string }[]> {
  if (isApiMode()) return serverListStaff(businessId).then((rows) => rows.map((r) => ({ value: r.staff.id, label: r.staff.name })));
  return request(() =>
    readCore()
      .staff.filter((s) => s.businessId === businessId)
      .map((s) => ({ value: s.id, label: s.name })),
  );
}

/** Услуги для фильтра «Услуги» (F-04-024) — имя локализовано, экран сам picks по своему языку */
export function listServiceOptions(businessId: Id) {
  return request(() => readCore().services.filter((s) => s.businessId === businessId));
}

/** Категории клиента = теги ядра (F-04-029, F-00-188); справочник со счётчиками и цветом — F-04-109/110 */
export function listCategoryOptions(businessId: Id): Promise<string[]> {
  if (isApiMode()) return C.listCategoryOptions(businessId);
  return request(() => {
    const set = new Set<string>(Object.keys(readArea('clients').categoryColors[businessId] ?? {}));
    readCore()
      .clients.filter((c) => c.businessId === businessId && !c.deletedAt)
      .forEach((c) => c.tags.forEach((tag) => set.add(tag)));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ru'));
  });
}

/** Справочник категорий клиентов (F-04-109): название + цвет + сколько клиентов сейчас отмечено */
export function listCategories(businessId: Id): Promise<ClientCategory[]> {
  if (isApiMode()) return C.listCategories(businessId);
  return request(() => {
    const core = readCore();
    const state = readArea('clients');
    const counts = new Map<string, number>();
    core.clients
      .filter((c) => c.businessId === businessId && !c.deletedAt)
      .forEach((c) => c.tags.forEach((tag) => counts.set(tag, (counts.get(tag) ?? 0) + 1)));
    const colors = state.categoryColors[businessId] ?? {};
    const names = new Set<string>([...Object.keys(colors), ...counts.keys()]);
    return Array.from(names)
      .map((name) => ({
        name,
        // Без своего цвета — стабильный из имени, а не у всех один индиго (ux-r5 №20)
        color: colors[name] ?? String(2 + ([...name].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 0) % 7)),
        count: counts.get(name) ?? 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  });
}

/** Новая категория (F-04-110): «Новая категория» — название + цвет */
export function createCategory(name: string, color: string): Promise<void> {
  if (isApiMode()) return C.createCategory(C.bizOf(), name, color);
  return request(() => {
    const trimmed = name.trim();
    if (!trimmed) throw new ApiError('empty_category', 'Укажите название категории');
    const businessId = currentActor().businessId;
    if (!businessId) throw new ApiError('forbidden', 'No business in session');
    const known = [...Object.keys(readArea('clients').categoryColors[businessId] ?? {}), ...readCore().clients.filter((c) => c.businessId === businessId).flatMap((c) => c.tags)];
    const existing = known.find((n) => n.toLowerCase() === trimmed.toLowerCase());
    if (existing) throw new ApiError('duplicate_category', 'Такая категория уже есть');
    mutateArea('clients', (s) => {
      (s.categoryColors[businessId] ??= {})[trimmed] = color;
    });
  });
}

/** Правка категории (F-04-110): переименование переносит тег у всех клиентов, у кого он стоит */
export function updateCategory(businessId: Id, name: string, next: { name: string; color: string }): Promise<void> {
  if (isApiMode()) return C.updateCategory(businessId, name, next);
  return request(async () => {
    const trimmed = next.name.trim();
    if (!trimmed) throw new ApiError('empty_category', 'Укажите название категории');
    if (trimmed.toLowerCase() !== name.toLowerCase()) {
      const known = [...Object.keys(readArea('clients').categoryColors[businessId] ?? {}), ...readCore().clients.filter((c) => c.businessId === businessId).flatMap((c) => c.tags)];
      const existing = known.find((n) => n.toLowerCase() === trimmed.toLowerCase());
      if (existing) throw new ApiError('duplicate_category', 'Такая категория уже есть');
      const core = readCore();
      for (const c of core.clients.filter((c) => c.businessId === businessId && c.tags.includes(name))) {
        coreTx.update('clients', c.id, {
          tags: c.tags.map((t) => (t === name ? trimmed : t)),
        });
      }
    }
    mutateArea('clients', (s) => {
      const colors = (s.categoryColors[businessId] ??= {});
      if (trimmed !== name) delete colors[name];
      colors[trimmed] = next.color;
    });
  });
}

/** Удаление категории (F-04-110): тег снимается у всех клиентов, сами клиенты остаются */
export function deleteCategory(businessId: Id, name: string): Promise<void> {
  if (isApiMode()) return C.deleteCategory(businessId, name);
  return request(async () => {
    const core = readCore();
    for (const c of core.clients.filter((c) => c.businessId === businessId && c.tags.includes(name))) {
      coreTx.update('clients', c.id, {
        tags: c.tags.filter((t) => t !== name),
      });
    }
    mutateArea('clients', (s) => {
      if (s.categoryColors[businessId]) delete s.categoryColors[businessId][name];
    });
  });
}
