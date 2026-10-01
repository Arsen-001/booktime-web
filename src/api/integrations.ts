'use client';

/**
 * API раздела «integrations» (пачка b01 — каталог, «Установлено», карточка, подключение/отключение).
 * Принадлежит разделу. Функции — async поверх request(); свой срез — readArea/mutateArea; сущности ядра —
 * только чтение через readCore().
 *
 * PLAN.md §7, этап 17 (docs/backend/02 §17, Р19) + этап 21 (сдача, попытка 6): в режиме `api` ВСЁ уходит на
 * сервер (`@/api/integrations.server`) — ключи, вебхуки, подключения, а с этапа 21 и каталог приложений, отзывы,
 * подписки на категории, настройки/демо-кнопки конкретных приложений (b03/b04/b05), промоблоки, кабинет
 * разработчика и заявки партнёрам. Р19 не нарушен: с чужими приложениями по-прежнему нет настоящего обмена —
 * сервер хранит статус и настройки. Ветка мока ниже — демо-сборка (NEXT_PUBLIC_DATA=mock).
 */
import { ApiError, request } from '@/api/request';
import { mutateArea, readArea, readCore } from '@/api/area';
import { assertCan, currentActor } from '@/api/core';
import { isApiMode } from '@/api/http';
import * as Server from '@/api/integrations.server';
import type { Id } from '@/domain/core';
import {
  activationDeadline,
  buildWhoToCallMessage,
  canAddGaStream,
  canSubmitDevAppForReview,
  defaultWebhookConfig,
  canRefundLastPayment,
  emptyDevAppAbout,
  emptyDevAppDevSettings,
  emptyDevAppMonetization,
  emptyDevAppPublicationTexts,
  extendPaidUntil,
  generateDemoToken,
  isActivationOverdue,
  isInstallLive,
  isValidApiFieldKey,
  isValidGaStreamId,
  isValidPromoBlockDraft,
  isValidWebhookUrl,
  maskToken,
  WHO_TO_CALL_MAX,
  type InstallTestResult,
  type WebhookAddress,
  type AiAssistantToken,
  type AiTokenScope,
  type AppChannel,
  type AppInstall,
  type AppReview,
  type ReviewAuthorRole,
  type CatalogApp,
  type DevApp,
  type DevAppAboutText,
  type DevAppDevSettings,
  type DevAppEventType,
  type DevAppLocale,
  type DevAppMonetization,
  type DevAppPublicationTexts,
  type DevAppStatus,
  type DeveloperAccount,
  type GaDataStream,
  type IntegrationCategoryId,
  type IntegrationSystemUser,
  type KommoSyncMode,
  type NotifyAppKind,
  type NotifyCapability,
  type PartnerApiKey,
  type PartnerApplication,
  type PromoBlock,
  type PromoBlockDraft,
  type RequestedScope,
  type UserApiToken,
  type WebhookConfig,
  type WebhookDelivery,
  type WebhookEntity,
  type WhoToCallCandidate,
  ALL_CATEGORY_IDS,
  HIDDEN_CATEGORY_IDS,
  VISIBLE_CATEGORY_IDS,
} from '@/domain/integrations';
import { appHasChatCapability } from '@/areas/integrations/catalog';
import { addMinutes, nowDateTime } from '@/lib/date';
import { newId } from '@/lib/id';
import { pickText, slugify } from '@/lib/text';

const AREA = 'integrations' as const;

/** Этап 17: «своё настоящее» на сервере ключуется businessId — вошедший всегда состоит в бизнесе */
function requireBusinessId(): Id {
  const { businessId } = currentActor();
  if (!businessId) throw new ApiError('not_found');
  return businessId;
}

function withOverdue(install: AppInstall, nowIso = nowDateTime()): AppInstall {
  // И4: секрет, сохранённый в подключении, наружу уходит только маской — целиком его не показывает ни один экран
  const safe = install.authKey ? { ...install, authKey: maskToken(install.authKey) } : install;
  if (isActivationOverdue(safe, nowIso)) return { ...safe, status: 'error', errorText: safe.errorText ?? 'activationExpired' };
  return safe;
}

// ─────────────────────────── Каталог и поиск (F-13-002, F-13-003, F-13-004, F-13-027) ───────────────────────────

export interface ListAppsInput {
  categoryId?: IntegrationCategoryId;
  q?: string;
  country?: 'AM' | 'all';
  /** F-13-140: фильтры витрины категории «Уведомления» */
  channel?: AppChannel;
  capability?: NotifyCapability;
  appKind?: NotifyAppKind;
}

function matchesQuery(app: CatalogApp, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const haystack = [app.name, app.subtitle, app.description ?? '', ...app.features].join(' ').toLowerCase();
  if (haystack.includes(needle)) return true;
  if (needle.includes('book') || needle.includes('запис')) return app.categoryId === 'widgets' || app.categoryId === 'social';
  if (needle.includes('chat') || needle.includes('чат')) return (app.channels ?? []).length > 0 || app.categoryId === 'chatbots';
  return false;
}

/** Витрина/категория — по умолчанию только видимые категории и страна «Армения» (⭐ F-00-002) */
export function listApps(input: ListAppsInput = {}): Promise<CatalogApp[]> {
  if (isApiMode()) return Server.listCatalog({ ...input });
  return request(() => {
    const apps = readArea(AREA).apps;
    const country = input.country ?? 'AM';
    return apps
      .filter((a) => !a.hiddenFromCatalog)
      .filter((a) => (input.categoryId ? a.categoryId === input.categoryId : !HIDDEN_CATEGORY_IDS.includes(a.categoryId)))
      .filter((a) => (country === 'AM' ? a.countries.includes('AM') || a.builtin : true))
      .filter((a) => matchesQuery(a, input.q ?? ''))
      .filter((a) => (input.channel ? (a.channels ?? []).includes(input.channel) : true))
      .filter((a) => (input.capability ? (a.notifyCapabilities ?? []).includes(input.capability) : true))
      .filter((a) => (input.appKind ? a.notifyAppKind === input.appKind : true))
      .sort(
        (a, b) =>
          (a.featuredRank ?? 99) - (b.featuredRank ?? 99) ||
          (b.builtin ? 1 : 0) - (a.builtin ? 1 : 0) ||
          (a.price.model === 'comingSoon' ? 1 : 0) - (b.price.model === 'comingSoon' ? 1 : 0) ||
          b.installsCount - a.installsCount,
      );
  });
}

/** Ревью 27.09 (И10): «Начните с этого» — Google Календарь, запись через Google, перенос из Altegio/DIKIDI */
export function listFeaturedApps(country: 'AM' | 'all' = 'AM'): Promise<CatalogApp[]> {
  if (isApiMode()) return Server.listFeaturedApps(country);
  return request(() =>
    readArea(AREA)
      .apps.filter((a) => a.featuredRank !== undefined && !a.hiddenFromCatalog)
      .filter((a) => (country === 'AM' ? a.countries.includes('AM') || a.builtin : true))
      .sort((a, b) => (a.featuredRank ?? 0) - (b.featuredRank ?? 0)),
  );
}

/** И6: статусы подключения в текущих филиалах по id приложения — для значка на плитках каталога */
export function listInstallStatuses(locationIds: Id[]): Promise<Record<Id, AppInstall['status']>> {
  return listInstalled(locationIds).then((rows) => {
    const out: Record<Id, AppInstall['status']> = {};
    for (const { install } of rows) {
      // «Подключено» важнее «ждём» и ошибок, если приложение стоит в нескольких филиалах
      if (out[install.appId] !== 'connected') out[install.appId] = install.status;
    }
    return out;
  });
}

export function getApp(appId: Id): Promise<CatalogApp> {
  if (isApiMode()) return Server.getCatalogApp(appId);
  return request(() => {
    const app = readArea(AREA).apps.find((a) => a.id === appId);
    if (!app) throw new ApiError('not_found');
    return app;
  });
}

/** F-13-013: прямая ссылка mp_<номер>_<имя> */
export function getAppByCode(code: string): Promise<CatalogApp> {
  if (isApiMode()) return Server.getCatalogAppByCode(code);
  return request(() => {
    const app = readArea(AREA).apps.find((a) => a.code === code);
    if (!app) throw new ApiError('not_found');
    return app;
  });
}

/**
 * F-13-033/F-13-046: та же короткая ссылка «на приложение», выданная из кабинета разработчика, — до
 * публикации приложения в витрине (черновик, на модерации) и всегда для непубличного. Ищем только среди
 * СВОИХ приложений (ownerStaffId), чтобы чужим кодом чужой черновик не открыть.
 */
export function getDevAppByCode(code: string): Promise<DevApp> {
  if (isApiMode()) return Server.getDevAppByCode(requireBusinessId(), code);
  return request(() => {
    const { staffId } = currentActor();
    const app = readArea(AREA).devApps.find((a) => a.appCode === code && a.ownerStaffId === staffId);
    if (!app) throw new ApiError('not_found');
    return app;
  });
}

export interface CategoryCount {
  categoryId: IntegrationCategoryId;
  count: number;
}

/** F-13-003: непустые категории для блоков «Обзора» (только видимые) */
export function listCategoryCounts(country: 'AM' | 'all' = 'AM'): Promise<CategoryCount[]> {
  if (isApiMode()) return Server.listCategoryCounts(country);
  return request(() => {
    const apps = readArea(AREA).apps.filter((a) => !a.hiddenFromCatalog).filter((a) => (country === 'AM' ? a.countries.includes('AM') || a.builtin : true));
    return VISIBLE_CATEGORY_IDS.map((categoryId) => ({ categoryId, count: apps.filter((a) => a.categoryId === categoryId).length }));
  });
}

// ─────────────────────────── Отзывы (F-13-011) ───────────────────────────

export function listReviews(appId: Id): Promise<AppReview[]> {
  if (isApiMode()) return Server.listReviews(appId);
  return request(() => readArea(AREA).reviews.filter((r) => r.appId === appId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
}

export interface AddReviewInput {
  appId: Id;
  businessId: Id;
  rating: number;
  text: string;
}

function reviewAuthorRole(persona: string): ReviewAuthorRole {
  if (persona === 'owner' || persona === 'individual' || persona === 'network') return 'owner';
  if (persona === 'admin') return 'admin';
  return 'staff';
}

export function addReview(input: AddReviewInput): Promise<AppReview> {
  if (isApiMode()) return Server.addReview(input.businessId, { appId: input.appId, rating: input.rating, text: input.text });
  return request(() => {
    const installed = readArea(AREA).installs.some((i) => i.appId === input.appId && i.businessId === input.businessId && isInstallLive(i.status));
    if (!installed) throw new ApiError('not_installed', 'Оставить отзыв можно после подключения');
    const review: AppReview = {
      id: newId('iarev'),
      appId: input.appId,
      businessId: input.businessId,
      // QA 30.09: роль, а не русская подпись в данных — переводится на экране (ru/en/hy)
      authorRole: reviewAuthorRole(currentActor().persona),
      rating: Math.max(1, Math.min(5, Math.round(input.rating))),
      text: input.text.trim(),
      createdAt: nowDateTime(),
    };
    mutateArea(AREA, (s) => {
      s.reviews.unshift(review);
      const app = s.apps.find((a) => a.id === input.appId);
      if (app) {
        const total = s.reviews.filter((r) => r.appId === input.appId);
        app.reviewsCount = total.length;
        app.rating = Math.round((total.reduce((sum, r) => sum + r.rating, 0) / total.length) * 10) / 10;
      }
      return s;
    });
    return review;
  });
}

// ─────────────────────────── Подписка на пустую категорию (F-13-005) ───────────────────────────

export function isSubscribedToCategory(businessId: Id, categoryId: IntegrationCategoryId): Promise<boolean> {
  if (isApiMode()) return Server.isSubscribedToCategory(businessId, categoryId);
  return request(() => readArea(AREA).subscriptions.some((s) => s.businessId === businessId && s.categoryId === categoryId));
}

export function subscribeToCategory(businessId: Id, categoryId: IntegrationCategoryId): Promise<void> {
  if (isApiMode()) return Server.subscribeToCategory(businessId, categoryId);
  return request(() => {
    mutateArea(AREA, (s) => {
      if (!s.subscriptions.some((x) => x.businessId === businessId && x.categoryId === categoryId)) {
        s.subscriptions.push({ businessId, categoryId, createdAt: nowDateTime() });
      }
      return s;
    });
  });
}

// ─────────────────────────── Установлено (F-13-007) ───────────────────────────

export interface InstalledRow {
  install: AppInstall;
  app: CatalogApp;
}

function mergeInstalledRows(installs: AppInstall[], apps: CatalogApp[] = readArea(AREA).apps): InstalledRow[] {
  return installs
    .map((install) => ({ install, app: apps.find((a) => a.id === install.appId) }))
    .filter((row): row is InstalledRow => Boolean(row.app))
    .sort((a, b) => (b.app.builtin ? 1 : 0) - (a.app.builtin ? 1 : 0) || b.install.connectedAt.localeCompare(a.install.connectedAt));
}

/** Подключённые в переданных филиалах — connected/pendingActivation/autoDisconnected/error; отключённое не показываем */
export function listInstalled(locationIds: Id[]): Promise<InstalledRow[]> {
  if (isApiMode()) return Promise.all([Server.listInstalled(requireBusinessId(), locationIds), Server.catalogAll()]).then(([rows, apps]) => mergeInstalledRows(rows, apps));
  return request(() => {
    const nowIso = nowDateTime();
    return mergeInstalledRows(
      readArea(AREA)
        .installs.filter((i) => locationIds.includes(i.locationId) && i.status !== 'disconnected')
        .map((i) => withOverdue(i, nowIso)),
    );
  });
}

/** Счётчик для пункта меню и вклада в хаб настроек — по всему бизнесу, не только текущему филиалу */
export function countInstalledForBusiness(businessId: Id): Promise<number> {
  if (isApiMode()) return Server.countInstalledForBusiness(businessId);
  return request(() => readArea(AREA).installs.filter((i) => i.businessId === businessId && i.status !== 'disconnected').length);
}

export function getInstall(appId: Id, locationId: Id): Promise<AppInstall | undefined> {
  if (isApiMode()) return Server.getInstall(requireBusinessId(), appId, locationId);
  return request(() => {
    const install = readArea(AREA).installs.find((i) => i.appId === appId && i.locationId === locationId && i.status !== 'disconnected');
    return install ? withOverdue(install) : undefined;
  });
}

/** F-13-015: филиалы, где приложение уже живо (connected/pendingActivation) — их нельзя выбрать в ConnectSheet */
export function listLiveInstallLocationIds(appId: Id, locationIds: Id[]): Promise<Id[]> {
  if (isApiMode()) return Server.listLiveInstallLocationIds(requireBusinessId(), appId, locationIds);
  return request(() => {
    const nowIso = nowDateTime();
    return readArea(AREA)
      .installs.filter((i) => i.appId === appId && locationIds.includes(i.locationId) && i.status !== 'disconnected')
      .map((i) => withOverdue(i, nowIso))
      .filter((i) => isInstallLive(i.status))
      .map((i) => i.locationId);
  });
}

/** Только чтение для других разделов (online/journal): подключено ли приложение в филиале */
export function isInstalled(appId: Id, locationId: Id): Promise<boolean> {
  if (isApiMode()) return Server.getInstall(requireBusinessId(), appId, locationId).then((install) => Boolean(install && isInstallLive(install.status)));
  return request(() => {
    const install = readArea(AREA).installs.find((i) => i.appId === appId && i.locationId === locationId && i.status !== 'disconnected');
    return Boolean(install && isInstallLive(withOverdue(install).status));
  });
}

export interface ChatConnection {
  appId: Id;
  appName: string;
}

/**
 * F-13-167/168: только чтение для journal — подключён ли в филиале живой партнёр с чатом (см.
 * `appHasChatCapability` в `@/areas/integrations/catalog`). До подключения панель «Чат» в журнале
 * только объясняет и ведёт сюда; после — показывает переписку внутри журнала и окна визита.
 */
export function getChatConnection(locationId: Id): Promise<ChatConnection | undefined> {
  if (isApiMode()) {
    return Promise.all([Server.listInstalled(requireBusinessId(), [locationId]), Server.catalogAll()]).then(([installs, apps]) => {
      const live = installs.find((i) => isInstallLive(i.status) && appHasChatCapability(apps.find((a) => a.id === i.appId)?.name ?? ''));
      if (!live) return undefined;
      const app = apps.find((a) => a.id === live.appId);
      return app ? { appId: app.id, appName: app.name } : undefined;
    });
  }
  return request(() => {
    const { apps, installs } = readArea(AREA);
    const nowIso = nowDateTime();
    const live = installs
      .filter((i) => i.locationId === locationId && i.status !== 'disconnected')
      .map((i) => withOverdue(i, nowIso))
      .find((i) => isInstallLive(i.status) && appHasChatCapability(apps.find((a) => a.id === i.appId)?.name ?? ''));
    if (!live) return undefined;
    const app = apps.find((a) => a.id === live.appId);
    return app ? { appId: app.id, appName: app.name } : undefined;
  });
}

/**
 * F-13-156: только чтение для других разделов — есть ли в филиале живое приложение-канал уведомлений
 * (SMS-агрегатор, WhatsApp, чат-бот и т.п.). Другие экраны используют её вместо своей копии статуса,
 * чтобы показать причину («подключите канал») вместо того, чтобы функция «молчала» без объяснения.
 */
export function hasConnectedChannel(locationId: Id, channel: AppChannel): Promise<boolean> {
  if (isApiMode()) {
    return Promise.all([Server.listInstalled(requireBusinessId(), [locationId]), Server.catalogAll()]).then(([installs, apps]) => {
      return installs.some((i) => {
        if (!isInstallLive(i.status)) return false;
        const app = apps.find((a) => a.id === i.appId);
        return Boolean(app?.channels?.includes(channel));
      });
    });
  }
  return request(() => {
    const nowIso = nowDateTime();
    const apps = readArea(AREA).apps;
    return readArea(AREA).installs.some((i) => {
      if (i.locationId !== locationId || i.status === 'disconnected') return false;
      if (!isInstallLive(withOverdue(i, nowIso).status)) return false;
      const app = apps.find((a) => a.id === i.appId);
      return Boolean(app?.channels?.includes(channel));
    });
  });
}

// ─────────────────────────── Подключение и отключение (F-13-014…018, F-13-020, F-13-021) ───────────────────────────

export interface ConnectAppInput {
  appId: Id;
  businessId: Id;
  locationIds: Id[];
  scopes: RequestedScope[];
}

export async function connectApp(input: ConnectAppInput): Promise<AppInstall[]> {
  // Этап 21 (попытка 6): каталог на сервере — «только владелец», «скоро» и «встроенное = мгновенно» проверяет он сам
  if (isApiMode()) return Server.connectApp(input.businessId, { appId: input.appId, locationIds: input.locationIds, scopes: input.scopes, instant: false });
  const app = await request(() => {
    assertCan('integrations.manage');
    const found = readArea(AREA).apps.find((a) => a.id === input.appId);
    if (!found) throw new ApiError('not_found');
    if (found.ownerOnly && currentActor().persona !== 'owner') throw new ApiError('owner_only', 'Подключить может только владелец');
    if (!input.locationIds.length) throw new ApiError('validation', 'Выберите хотя бы один филиал');
    if (found.price.model === 'comingSoon') throw new ApiError('coming_soon', 'Пока недоступно в Армении');
    return found;
  });

  const nowIso = nowDateTime();
  return request(() => {
    let created: AppInstall[] = [];
    mutateArea(AREA, (s) => {
      s.installs = s.installs.filter((i) => !(i.appId === app.id && input.locationIds.includes(i.locationId)));
      created = input.locationIds.map((locationId): AppInstall =>
        app.builtin
          ? { id: newId('iai'), appId: app.id, businessId: input.businessId, locationId, status: 'connected', grantedScopes: input.scopes, connectedAt: nowIso, activatedAt: nowIso }
          : {
              id: newId('iai'),
              appId: app.id,
              businessId: input.businessId,
              locationId,
              status: 'pendingActivation',
              grantedScopes: input.scopes,
              connectedAt: nowIso,
              activatesBy: activationDeadline(nowIso),
            },
      );
      s.installs.push(...created);
      return s;
    });
    return created;
  });
}

/** Демо-кнопка «Партнёр активировал» (F-13-018) — переводит в «Подключено» и заводит ссылку на системного пользователя */
export function demoActivatePartner(installId: Id): Promise<AppInstall> {
  if (isApiMode()) return Server.demoActivatePartner(requireBusinessId(), installId);
  return request(() => {
    assertCan('integrations.manage');
    const nowIso = nowDateTime();
    let updated: AppInstall | undefined;
    mutateArea(AREA, (s) => {
      const install = s.installs.find((i) => i.id === installId);
      if (!install) throw new ApiError('not_found');
      install.status = 'connected';
      install.activatedAt = nowIso;
      install.paidUntil = extendPaidUntil(nowIso);
      install.systemUserId = install.systemUserId ?? newId('iasu');
      updated = install;
      return s;
    });
    if (!updated) throw new ApiError('not_found');
    return updated;
  });
}

/**
 * F-13-019/F-13-059: системные пользователи, реально появившиеся из подключённых приложений локации —
 * в отличие от независимого списка `staff.systemUsers` (свой срез раздела «staff»), здесь пользователь
 * существует, только пока `install.status === 'connected'`, и пропадает сам при отключении/автоотключении.
 */
export function listSystemUsers(locationId: Id): Promise<IntegrationSystemUser[]> {
  if (isApiMode()) {
    return Promise.all([Server.listSystemUsers(requireBusinessId(), locationId), Server.catalogAll()]).then(([rows, apps]) => {
      return rows.map((r) => ({ ...r, appName: apps.find((a) => a.id === r.appId)?.name ?? r.appId }));
    });
  }
  return request(() => {
    const area = readArea(AREA);
    return area.installs
      .filter((i) => i.locationId === locationId && i.status === 'connected' && i.systemUserId)
      .map((i) => {
        const app = area.apps.find((a) => a.id === i.appId);
        return {
          id: i.systemUserId!,
          appId: i.appId,
          appName: app?.name ?? i.appId,
          installId: i.id,
          businessId: i.businessId,
          locationId: i.locationId,
          grantedScopes: i.grantedScopes,
          connectedAt: i.connectedAt,
          // F-13-059: своя интеграция (не через маркетплейс) — платно; здесь все установки идут из
          // каталога маркетплейса, поэтому бесплатны. Платный случай — тестовая установка разработчиком
          // собственного приложения у себя (см. `testInstallDevAppAtOwnLocation`, GeneralInfoTab).
          billedInSubscription: false,
        } satisfies IntegrationSystemUser;
      });
  });
}

export function disconnectApp(installId: Id): Promise<void> {
  if (isApiMode()) return Server.disconnectApp(requireBusinessId(), installId);
  return request(() => {
    assertCan('integrations.manage');
    mutateArea(AREA, (s) => {
      const install = s.installs.find((i) => i.id === installId);
      if (!install) throw new ApiError('not_found');
      if (install.appId.startsWith('ia_builtin')) throw new ApiError('builtin_locked', 'Это приложение нельзя отключить');
      install.status = 'disconnected';
      install.disconnectedAt = nowDateTime();
      return s;
    });
  });
}

/** F-13-021: восстановление после «оплаты» подписки партнёра (имитация) */
/** F-13-043: имитация оплаты подписки партнёра через API — продлевает «оплачено до» и пишет запись
 * в историю оплат, чтобы было что вернуть (F-13-044). */
export function demoPayPartnerSubscription(installId: Id): Promise<AppInstall> {
  if (isApiMode()) return installAct(installId, { action: 'payPartner' });
  return request(() => {
    assertCan('integrations.manage');
    const nowIso = nowDateTime();
    let updated: AppInstall | undefined;
    mutateArea(AREA, (s) => {
      const install = s.installs.find((i) => i.id === installId);
      if (!install) throw new ApiError('not_found');
      const app = s.apps.find((a) => a.id === install.appId);
      const paidUntil = extendPaidUntil(nowIso);
      install.status = 'connected';
      install.paidUntil = paidUntil;
      install.errorText = undefined;
      install.paymentHistory = [
        ...(install.paymentHistory ?? []),
        {
          id: newId('iapay'),
          amount: app?.price.amount ?? 0,
          currency: app?.price.currency ?? 'AMD',
          paidUntil,
          createdAt: nowIso,
        },
      ];
      updated = install;
      return s;
    });
    if (!updated) throw new ApiError('not_found');
    return updated;
  });
}

// ─────────────────────────── b03: настройки конкретных приложений (AppSettingsTab) ───────────────────────────

/** Этап 21 (попытка 6): в режиме api настройка/демо-кнопка подключения — команда серверу, ответ — подключение */
function installAct(installId: Id, action: Server.InstallAction): Promise<AppInstall> {
  return Server.installAction(requireBusinessId(), installId, action).then((r) => r.install);
}

function updateInstall(installId: Id, patch: (install: AppInstall) => void): Promise<AppInstall> {
  return request(() => {
    assertCan('integrations.manage');
    let updated: AppInstall | undefined;
    mutateArea(AREA, (s) => {
      const install = s.installs.find((i) => i.id === installId);
      if (!install) throw new ApiError('not_found');
      patch(install);
      updated = install;
      return s;
    });
    if (!updated) throw new ApiError('not_found');
    return updated;
  });
}

export interface SetSmsAggregatorAuthInput {
  installId: Id;
  /** Пусто — оставить сохранённый ключ (меняется только имя отправителя) */
  authKey: string;
  senderName: string;
}

/** F-13-155: сохраняет «Ключ авторизации» и «Имя отправителя SMS» — имя уходит на (демо) одобрение оператором */
export function setSmsAggregatorAuth(input: SetSmsAggregatorAuthInput): Promise<AppInstall> {
  if (!input.senderName.trim()) throw new ApiError('validation', 'Заполните имя отправителя');
  if (isApiMode()) return installAct(input.installId, { action: 'smsAuth', authKey: input.authKey, senderName: input.senderName });
  return updateInstall(input.installId, (install) => {
    if (!input.authKey.trim() && !install.authKey) throw new ApiError('validation', 'Заполните ключ авторизации');
    if (input.authKey.trim()) install.authKey = input.authKey.trim();
    install.senderName = input.senderName.trim();
    install.senderNameStatus = 'pending';
  });
}

/** F-13-155: демо-кнопка «Оператор одобрил имя» — после неё рассылка становится доступна (canSendBulkSms) */
export function demoApproveSenderName(installId: Id): Promise<AppInstall> {
  if (isApiMode()) return installAct(installId, { action: 'approveSender' });
  return updateInstall(installId, (install) => {
    install.senderNameStatus = 'approved';
  });
}

/** F-13-141: пополнение баланса сообщений — отдельно на каждый филиал (install ключуется по locationId) */
export function topUpMessageBalance(installId: Id, amountAmd: number): Promise<AppInstall> {
  if (amountAmd <= 0) throw new ApiError('validation', 'Сумма пополнения должна быть больше нуля');
  if (isApiMode()) return installAct(installId, { action: 'topUp', amountAmd });
  return updateInstall(installId, (install) => {
    install.messageBalanceAmd = (install.messageBalanceAmd ?? 0) + amountAmd;
  });
}

export interface DemoSendMessageResult {
  outcome: 'sent' | 'insufficientFunds';
  balanceAmd: number;
}

/** F-13-141 «Готово, когда»: без баланса сообщение не уходит — демо списывает цену за сообщение из плашки «Цена» */
export function demoSendTestMessage(installId: Id, pricePerMessageAmd: number): Promise<DemoSendMessageResult> {
  if (isApiMode()) {
    return Server.installAction<DemoSendMessageResult>(requireBusinessId(), installId, { action: 'sendTestMessage', pricePerMessageAmd }).then((r) => r.result as DemoSendMessageResult);
  }
  let result: DemoSendMessageResult | undefined;
  return updateInstall(installId, (install) => {
    const balance = install.messageBalanceAmd ?? 0;
    if (balance >= pricePerMessageAmd) {
      install.messageBalanceAmd = balance - pricePerMessageAmd;
      result = { outcome: 'sent', balanceAmd: install.messageBalanceAmd };
    } else {
      result = { outcome: 'insufficientFunds', balanceAmd: balance };
    }
  }).then(() => result!);
}

/** F-13-142/F-13-143: номер, с которого уходят сообщения — по умолчанию (Altegio) или свой (Meta) */
export function setWhatsappNumberMode(installId: Id, mode: 'default' | 'own'): Promise<AppInstall> {
  if (isApiMode()) return installAct(installId, { action: 'whatsappMode', mode });
  return updateInstall(installId, (install) => {
    install.whatsappNumberMode = mode;
    if (mode === 'default') install.metaTemplatesApproved = true;
  });
}

// ─── f2: чат-боты уведомлений (notifyAppKind === 'chatbot') — F-13-144…153 ───

/** F-13-146/F-13-147: сохранить порядок каскада (первый недоступный канал пропускается на следующий) */
export function setCascadeOrder(installId: Id, order: AppChannel[]): Promise<AppInstall> {
  if (isApiMode()) return installAct(installId, { action: 'cascadeOrder', order });
  return updateInstall(installId, (install) => {
    install.cascadeOrder = order;
  });
}

/**
 * F-13-144/145/146/148/149/150/151/153 «Готово, когда»: демо-проверка доставки — идёт по `cascadeOrder`
 * (или по каналам приложения) и «доставляется» не первым каналом, чтобы каскад был видимым эффектом, а не
 * только настройкой; при `canConfirm` дополнительно демо-подтверждает запись клиентом («ответил да»).
 */
export function demoTestChatbotDelivery(
  installId: Id,
  channels: AppChannel[],
  canConfirm: boolean,
): Promise<AppInstall> {
  if (isApiMode()) return installAct(installId, { action: 'chatbotTest', channels, canConfirm });
  return updateInstall(installId, (install) => {
    const order = install.cascadeOrder?.length ? install.cascadeOrder : channels;
    const deliveredVia = order[order.length > 1 ? 1 : 0] ?? order[0] ?? 'whatsapp';
    install.lastChatbotTest = { at: nowDateTime(), deliveredVia, confirmed: canConfirm };
  });
}

/** F-13-152 «Готово, когда»: низкая оценка уходит владельцу вместо публикации на картах */
export function setNegativeReviewIntercept(installId: Id, on: boolean): Promise<AppInstall> {
  if (isApiMode()) return installAct(installId, { action: 'negativeIntercept', on });
  return updateInstall(installId, (install) => {
    install.negativeReviewIntercept = on;
  });
}

export function demoInterceptNegativeReview(installId: Id): Promise<AppInstall> {
  if (isApiMode()) return installAct(installId, { action: 'interceptReview' });
  return updateInstall(installId, (install) => {
    install.interceptedReviewsCount = (install.interceptedReviewsCount ?? 0) + 1;
  });
}

/** F-13-147/152 «Готово, когда» (возврат «уснувших»): демо-рассылка находит клиентов, не бывавших N+ дней */
export function demoRunRetentionCampaign(installId: Id, days: number): Promise<AppInstall> {
  if (isApiMode()) return installAct(installId, { action: 'retentionRun', days });
  return updateInstall(installId, (install) => {
    const clients = readCore().clients ?? [];
    const base = clients.length;
    // Демо: доля «уснувших» стабильна по installId+days, чтобы число не прыгало на каждый клик без причины.
    const seed = (installId.length + days) % 7;
    install.lastRetentionRunCount = base > 0 ? Math.max(1, Math.round((base / 4) * (0.6 + seed / 10))) : 0;
  });
}

/** F-13-142 «Готово, когда»: пока Meta не одобрила 3 базовых шаблона, интеграция не активна — демо-кнопка одобрения */
export function demoApproveMetaTemplates(installId: Id): Promise<AppInstall> {
  if (isApiMode()) return installAct(installId, { action: 'approveMeta' });
  return updateInstall(installId, (install) => {
    install.metaTemplatesApproved = true;
  });
}

/** F-13-174/F-13-175/F-13-176/F-13-211: демо-симулятор — «визит» ставит штамп/обновляет карту клиента в Wallet */
export function simulateLoyaltyVisit(installId: Id): Promise<AppInstall> {
  if (isApiMode()) return installAct(installId, { action: 'loyaltyVisit' });
  return updateInstall(installId, (install) => {
    install.demoLoyaltyStamps = (install.demoLoyaltyStamps ?? 0) + 1;
  });
}

// ─────────────────────────── b03: промоблок в виджете записи (F-13-172) ───────────────────────────

export function listPromoBlocks(businessId: Id): Promise<PromoBlock[]> {
  if (isApiMode()) return Server.listPromoBlocks(businessId);
  return request(() => readArea(AREA).promoBlocks.filter((b) => b.businessId === businessId));
}

export interface SavePromoBlockInput {
  businessId: Id;
  locationId: Id;
  draft: PromoBlockDraft;
}

export function createPromoBlock(input: SavePromoBlockInput): Promise<PromoBlock> {
  if (isApiMode()) return Server.createPromoBlock(input.businessId, input.locationId, input.draft);
  return request(() => {
    assertCan('integrations.manage');
    if (!isValidPromoBlockDraft(input.draft)) throw new ApiError('validation', 'Проверьте длину текста и заполните хотя бы один экран показа');
    const block: PromoBlock = {
      id: newId('ipb'),
      businessId: input.businessId,
      locationId: input.locationId,
      headline: input.draft.headline.trim(),
      description: input.draft.description.trim(),
      hasImage: input.draft.hasImage,
      icon: input.draft.icon,
      buttonText: input.draft.buttonText.trim() || undefined,
      buttonHref: input.draft.buttonHref.trim() || undefined,
      placements: input.draft.placements,
      enabled: true,
      createdAt: nowDateTime(),
    };
    mutateArea(AREA, (s) => {
      s.promoBlocks.push(block);
      return s;
    });
    return block;
  });
}

export function updatePromoBlock(blockId: Id, draft: PromoBlockDraft): Promise<PromoBlock> {
  if (isApiMode()) return Server.updatePromoBlock(requireBusinessId(), blockId, draft);
  return request(() => {
    assertCan('integrations.manage');
    if (!isValidPromoBlockDraft(draft)) throw new ApiError('validation', 'Проверьте длину текста и заполните хотя бы один экран показа');
    let updated: PromoBlock | undefined;
    mutateArea(AREA, (s) => {
      const block = s.promoBlocks.find((b) => b.id === blockId);
      if (!block) throw new ApiError('not_found');
      block.headline = draft.headline.trim();
      block.description = draft.description.trim();
      block.hasImage = draft.hasImage;
      block.icon = draft.icon;
      block.buttonText = draft.buttonText.trim() || undefined;
      block.buttonHref = draft.buttonHref.trim() || undefined;
      block.placements = draft.placements;
      updated = block;
      return s;
    });
    if (!updated) throw new ApiError('not_found');
    return updated;
  });
}

export function setPromoBlockEnabled(blockId: Id, enabled: boolean): Promise<PromoBlock> {
  if (isApiMode()) return Server.setPromoBlockEnabled(requireBusinessId(), blockId, enabled);
  return request(() => {
    assertCan('integrations.manage');
    let updated: PromoBlock | undefined;
    mutateArea(AREA, (s) => {
      const block = s.promoBlocks.find((b) => b.id === blockId);
      if (!block) throw new ApiError('not_found');
      block.enabled = enabled;
      updated = block;
      return s;
    });
    if (!updated) throw new ApiError('not_found');
    return updated;
  });
}

export function deletePromoBlock(blockId: Id): Promise<void> {
  if (isApiMode()) return Server.deletePromoBlock(requireBusinessId(), blockId);
  return request(() => {
    assertCan('integrations.manage');
    mutateArea(AREA, (s) => {
      s.promoBlocks = s.promoBlocks.filter((b) => b.id !== blockId);
      return s;
    });
  });
}

// ─────────────────────────── Филиалы для листа подключения (F-13-015) ───────────────────────────

export interface LocationOption {
  id: Id;
  name: string;
}

export function listLocationOptions(locationIds: Id[], locale: import('@/domain/core').LocaleCode): Promise<LocationOption[]> {
  if (isApiMode()) {
    return Server.getIdentifiers(requireBusinessId()).then((v) =>
      locationIds.flatMap((id) => {
        const l = v.locations.find((x) => x.id === id);
        return l ? [{ id: l.id, name: pickText(l.name, locale) }] : [];
      }),
    );
  }
  return request(() => {
    const locations = readCore().locations;
    return locationIds
      .map((id) => locations.find((l) => l.id === id))
      .filter((l): l is NonNullable<typeof l> => Boolean(l))
      .map((l) => ({ id: l.id, name: pickText(l.name, locale) }));
  });
}

// ─────────────────────────── b05: всплывающая карточка входящего звонка — имитация (F-13-093) ───────────────────────────

export interface DemoIncomingCall {
  phone: string;
  isKnown: boolean;
  clientId?: Id;
  clientName?: string;
  lastVisitAt?: string;
}

/** F-13-093 «Готово, когда»: «Проверить звонок» в карточке АТС показывает клиента бизнеса (телефон, имя,
 * последний визит) либо «новый номер» — без обращения к настоящей телефонии (раздел только интерфейс). */
export function demoIncomingCall(businessId: Id): Promise<DemoIncomingCall> {
  if (isApiMode()) return Server.demoIncomingCall<DemoIncomingCall>(businessId);
  return request(() => {
    const core = readCore();
    const clients = core.clients.filter((c) => c.businessId === businessId && !c.deletedAt);
    const known = clients.length > 0 && Math.random() > 0.35;
    if (known) {
      const client = clients[Math.floor(Math.random() * clients.length)];
      const lastBooking = core.bookings
        .filter((b) => b.clientId === client.id)
        .sort((a, b) => (a.start < b.start ? 1 : -1))[0];
      return {
        phone: client.phone,
        isKnown: true,
        clientId: client.id,
        clientName: client.name,
        lastVisitAt: lastBooking?.start,
      };
    }
    const digits = Array.from({ length: 6 }, () => Math.floor(Math.random() * 10)).join('');
    return { phone: `+374 ${digits.slice(0, 2)} ${digits.slice(2)}`, isKnown: false };
  });
}

// ─────────────────────────── Входы из других разделов (F-13-026) ───────────────────────────

export interface IntegrationsHrefInput {
  appId?: Id;
  categoryId?: IntegrationCategoryId;
  from?: string;
}

/** Чистая функция-ссылка — для кнопок других разделов («online → каталог уведомлений» и т. п.) */
export function integrationsHref(input: IntegrationsHrefInput): string {
  const from = input.from ? `?from=${encodeURIComponent(input.from)}` : '';
  if (input.appId) return `/biz/integrations/apps/${input.appId}${from}`;
  if (input.categoryId) return `/biz/integrations/category/${input.categoryId}${from}`;
  return `/biz/integrations${from}`;
}

export { ALL_CATEGORY_IDS };

// ═══════════════════════════ Кабинет разработчика (F-13-028…046, пачка b02) ═══════════════════════════

function requireStaffId(): Id {
  const { staffId } = currentActor();
  if (!staffId) throw new ApiError('forbidden', 'Нужен сотрудник-владелец');
  return staffId;
}

/** F-13-028 «Готово, когда»: кабинет виден только тому, кто его завёл — ключ ownerStaffId, не businessId */
export function getDeveloperAccount(): Promise<DeveloperAccount | undefined> {
  if (isApiMode()) return Server.getDeveloperAccount(requireBusinessId());
  return request(() => {
    const staffId = requireStaffId();
    return readArea(AREA).developerAccounts.find((d) => d.ownerStaffId === staffId);
  });
}

export interface RegisterDeveloperInput {
  companyName: string;
  purpose: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  contactWebsite?: string;
  partnerBearer?: string;
}

export function registerDeveloper(input: RegisterDeveloperInput): Promise<DeveloperAccount> {
  if (isApiMode()) return Server.registerDeveloper(requireBusinessId(), input);
  return request(() => {
    assertCan('integrations.manage');
    const staffId = requireStaffId();
    const { businessId } = currentActor();
    if (!businessId) throw new ApiError('not_found');
    const account: DeveloperAccount = { businessId, ownerStaffId: staffId, createdAt: nowDateTime(), ...input };
    mutateArea(AREA, (s) => {
      if (!s.developerAccounts.some((d) => d.ownerStaffId === staffId)) s.developerAccounts.push(account);
    });
    return account;
  });
}

/** F-13-032: «Мои приложения» разработчика (только свои — по ownerStaffId) */
export function listDevApps(): Promise<DevApp[]> {
  if (isApiMode()) return Server.listDevApps(requireBusinessId());
  return request(() => {
    const staffId = requireStaffId();
    return readArea(AREA)
      .devApps.filter((a) => a.ownerStaffId === staffId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  });
}

export function getDevApp(devAppId: Id): Promise<DevApp> {
  if (isApiMode()) return Server.getDevApp(requireBusinessId(), devAppId);
  return request(() => {
    const staffId = requireStaffId();
    const app = readArea(AREA).devApps.find((a) => a.id === devAppId && a.ownerStaffId === staffId);
    if (!app) throw new ApiError('not_found');
    return app;
  });
}

/** F-13-030: название → латинский ID приложения (правится только на этом шаге) */
export function suggestDevAppCode(name: string): string {
  return slugify(name);
}

export interface CreateDevAppInput {
  name: string;
  appCode: string;
  categoryId: IntegrationCategoryId;
  isPrivate: boolean;
}

export function createDevApp(input: CreateDevAppInput): Promise<DevApp> {
  if (isApiMode()) return Server.createDevApp(requireBusinessId(), input);
  return request(() => {
    assertCan('integrations.manage');
    const staffId = requireStaffId();
    const { businessId } = currentActor();
    if (!businessId) throw new ApiError('not_found');
    const code = input.appCode.trim();
    if (!code) throw new ApiError('invalid_code');
    const taken = readArea(AREA).devApps.some((a) => a.appCode === code);
    if (taken) throw new ApiError('code_taken');
    const app: DevApp = {
      id: newId('iad'),
      ownerStaffId: staffId,
      businessId,
      name: input.name.trim(),
      appCode: code,
      categoryId: input.categoryId,
      isPrivate: input.isPrivate,
      status: 'draft',
      about: emptyDevAppAbout(),
      devSettings: emptyDevAppDevSettings(),
      apiAccess: { permissions: [] },
      monetization: emptyDevAppMonetization(),
      publication: emptyDevAppPublicationTexts(),
      events: [],
      createdAt: nowDateTime(),
    };
    mutateArea(AREA, (s) => {
      s.devApps.push(app);
    });
    return app;
  });
}

/** Этап 21 (попытка 6): правка своего приложения разработчика в режиме api — команда серверу */
function devAppAct(devAppId: Id, action: { action: string } & Record<string, unknown>): Promise<DevApp> {
  return Server.devAppAction(requireBusinessId(), devAppId, action);
}

function withOwnedDevApp(devAppId: Id, mutate: (app: DevApp) => void): Promise<DevApp> {
  return request(() => {
    assertCan('integrations.manage');
    const staffId = requireStaffId();
    let updated: DevApp | undefined;
    mutateArea(AREA, (s) => {
      const app = s.devApps.find((a) => a.id === devAppId && a.ownerStaffId === staffId);
      if (!app) throw new ApiError('not_found');
      mutate(app);
      updated = app;
    });
    if (!updated) throw new ApiError('not_found');
    return updated;
  });
}

/** F-13-034: галерея (счётчик до 5), видео, описание/возможности/FAQ на выбранном языке интерфейса */
export interface UpdateDevAppAboutInput {
  locale: DevAppLocale;
  galleryCount?: number;
  videoUrl?: string;
  text: DevAppAboutText;
}

export function updateDevAppAbout(devAppId: Id, input: UpdateDevAppAboutInput): Promise<DevApp> {
  if (isApiMode()) return devAppAct(devAppId, { action: 'about', ...input });
  return withOwnedDevApp(devAppId, (app) => {
    if (input.galleryCount !== undefined) app.about.galleryCount = Math.max(0, Math.min(5, input.galleryCount));
    if (input.videoUrl !== undefined) app.about.videoUrl = input.videoUrl.trim() || undefined;
    app.about.byLocale[input.locale] = {
      description: input.text.description.slice(0, 3000),
      features: input.text.features.filter((f) => f.trim()).slice(0, 20),
      faq: input.text.faq.slice(0, 50).map((f) => ({ q: f.q.slice(0, 100), a: f.a.slice(0, 1000) })),
    };
  });
}

export function updateDevAppDevSettings(devAppId: Id, patch: Partial<DevAppDevSettings>): Promise<DevApp> {
  if (isApiMode()) return devAppAct(devAppId, { action: 'devSettings', patch });
  return withOwnedDevApp(devAppId, (app) => {
    app.devSettings = { ...app.devSettings, ...patch };
  });
}

export interface UpdateDevAppApiAccessInput {
  systemUserId: string;
  permissions: string[];
}

/** F-13-036: после сохранения User ID выдаётся User token */
export function updateDevAppApiAccess(devAppId: Id, input: UpdateDevAppApiAccessInput): Promise<DevApp> {
  if (isApiMode()) return devAppAct(devAppId, { action: 'apiAccess', ...input });
  return withOwnedDevApp(devAppId, (app) => {
    app.apiAccess = {
      systemUserId: input.systemUserId.trim() || undefined,
      permissions: input.permissions,
      userToken: input.systemUserId.trim() ? (app.apiAccess.userToken ?? generateDemoToken('utok')) : undefined,
    };
  });
}

function pushDevAppEvent(app: DevApp, type: DevAppEventType): void {
  app.events.push({ id: newId('iaev'), type, at: nowDateTime() });
}

/** F-13-035 «Готово, когда»: без Registration Redirect Url на модерацию не отправить */
export function submitDevAppForReview(devAppId: Id): Promise<DevApp> {
  if (isApiMode()) return devAppAct(devAppId, { action: 'submit' });
  return withOwnedDevApp(devAppId, (app) => {
    if (!canSubmitDevAppForReview(app)) throw new ApiError('registration_url_required');
    app.status = 'review';
    app.rejectReason = undefined;
    pushDevAppEvent(app, 'submitted');
  });
}

/** F-13-047/F-13-048: демо-решение модерации — пока нет очереди у platform (`qa/requests/integrations.md`),
 * разработчик сам «проверяет» своё приложение теми же критериями, что покажет живая модерация. */
export function demoModerateDevApp(devAppId: Id, decision: Extract<DevAppStatus, 'published' | 'rejected'>): Promise<DevApp> {
  if (isApiMode()) return devAppAct(devAppId, { action: 'moderate', decision });
  return withOwnedDevApp(devAppId, (app) => {
    if (app.status !== 'review') throw new ApiError('not_in_review');
    app.status = decision;
    app.rejectReason = decision === 'rejected' ? 'demoRejected' : undefined;
    pushDevAppEvent(app, decision);
  }).then((app) => {
    // QA 01.10 (решение владельца): одобренное приложение попадает в каталог со своим code — прямая ссылка
    // и «Ссылка для отзыва» из кабинета разработчика открывают карточку. Непубличное — только по ссылке.
    // Отдельной записью после withOwnedDevApp, а не вложенным mutateArea.
    if (decision === 'published') {
      mutateArea(AREA, (s) => {
        const developer = s.developerAccounts.find((d) => d.ownerStaffId === app.ownerStaffId)?.companyName ?? app.name;
        const next = catalogAppFromDevApp(app, developer);
        const i = s.apps.findIndex((a) => a.id === next.id);
        if (i >= 0) s.apps[i] = { ...s.apps[i], ...next, rating: s.apps[i].rating, reviewsCount: s.apps[i].reviewsCount };
        else s.apps.push(next);
        return s;
      });
    }
    return app;
  });
}

/** Карточка каталога из приложения разработчика: тот же id (iad_…), code = ID приложения, тексты «О приложении» */
function catalogAppFromDevApp(app: DevApp, developer: string): CatalogApp {
  const texts = app.about.byLocale.ru ?? app.about.byLocale.en ?? app.about.byLocale.hy;
  const m = app.monetization;
  const price: CatalogApp['price'] = !m.isPaid
    ? { model: 'free' }
    : m.trialDays
      ? { model: 'trialDays', trialDays: m.trialDays }
      : { model: 'fromPrice', amount: m.priceAmount ?? 0, currency: m.currency ?? 'AMD' };
  const subtitle = texts?.description?.split('\n')[0]?.slice(0, 120) || app.name;
  return {
    id: app.id,
    code: app.appCode,
    categoryId: app.categoryId,
    name: app.name,
    subtitle,
    description: texts?.description,
    developer,
    websiteUrl: app.devSettings.registrationUrl || undefined,
    rating: 0,
    reviewsCount: 0,
    installsCount: 0,
    price,
    countries: ['AM'],
    worksOnTrial: true,
    ownerOnly: false,
    requestedScopes: ['bookings'],
    registrationMode: 'website',
    multiLocation: app.devSettings.allowMultiLocation,
    features: texts?.features ?? [],
    faq: texts?.faq,
    plans: m.tariffPlans,
    hiddenFromCatalog: app.isPrivate || undefined,
  };
}

/** F-13-046: неопубликованное приложение подключается к локации своего разработчика и работает полностью —
 *  используем тот же механизм подключения (installs), только appId — из кабинета разработчика (iad_...). */
export function testInstallDevAppAtOwnLocation(devAppId: Id, _locationId: Id): Promise<DevApp> {
  if (isApiMode()) return devAppAct(devAppId, { action: 'testInstall', locationId: _locationId });
  return withOwnedDevApp(devAppId, (app) => {
    app.testInstalledAt = nowDateTime();
    pushDevAppEvent(app, 'testInstalled');
  });
}

/** F-13-045: отключение тестовой установки — тем же путём отправляем вебхук «отключено» (имитация,
 * события пишутся в журнал приложения, а не летят наружу). */
export function testUninstallDevAppAtOwnLocation(devAppId: Id): Promise<DevApp> {
  if (isApiMode()) return devAppAct(devAppId, { action: 'testUninstall' });
  return withOwnedDevApp(devAppId, (app) => {
    app.testInstalledAt = undefined;
    pushDevAppEvent(app, 'testUninstalled');
    if (app.devSettings.webhookUrl || app.devSettings.callbackUrl) {
      pushDevAppEvent(app, 'disabled');
    }
  });
}

/** F-13-037 «Готово, когда»: бесплатно/платно, цена, валюта, пробный период */
export function updateDevAppMonetization(devAppId: Id, patch: Partial<DevAppMonetization>): Promise<DevApp> {
  if (isApiMode()) return devAppAct(devAppId, { action: 'monetization', patch });
  return withOwnedDevApp(devAppId, (app) => {
    app.monetization = { ...app.monetization, ...patch };
  });
}

/** F-13-047: тексты инструкций — «можно менять после сохранения» */
export function updateDevAppPublicationTexts(devAppId: Id, patch: Partial<DevAppPublicationTexts>): Promise<DevApp> {
  if (isApiMode()) return devAppAct(devAppId, { action: 'publication', patch });
  return withOwnedDevApp(devAppId, (app) => {
    app.publication = { ...app.publication, ...patch };
  });
}

/** F-13-038 «Готово, когда»: «Загрузить сетку тарифов» разбирает файл на 3 демо-тарифа (без настоящего
 * парсинга Excel — раздел только интерфейс) и кладёт их в «Тарифы» карточки приложения. */
export function uploadDevAppTariffSheet(devAppId: Id, fileName: string): Promise<DevApp> {
  if (isApiMode()) return devAppAct(devAppId, { action: 'tariffSheet', fileName });
  return withOwnedDevApp(devAppId, (app) => {
    const currency = app.monetization.currency ?? 'AMD';
    const base = app.monetization.priceAmount ?? (currency === 'AMD' ? 9900 : 19);
    app.monetization.tariffPlans = [
      { name: 'Старт', price: base, currency, period: 'month', features: ['1 филиал', 'Базовые функции'] },
      { name: 'Бизнес', price: Math.round(base * 2.2), currency, period: 'month', features: ['До 5 филиалов', 'Приоритетная поддержка'] },
      { name: 'Сеть', price: Math.round(base * 4.5), currency, period: 'month', features: ['Без ограничения филиалов', 'Персональный менеджер'] },
    ];
    app.monetization.tariffSheetUploadedAt = nowDateTime();
    app.monetization.tariffSheetFileName = fileName;
  });
}

// ─────────────────────────── b05: оплата подписки партнёра — история, возврат (F-13-043, F-13-044) ───────────────────────────

function withOwnedInstall(installId: Id, mutate: (install: AppInstall) => void): Promise<AppInstall> {
  return request(() => {
    assertCan('integrations.manage');
    let updated: AppInstall | undefined;
    mutateArea(AREA, (s) => {
      const install = s.installs.find((i) => i.id === installId);
      if (!install) throw new ApiError('not_found');
      mutate(install);
      updated = install;
    });
    if (!updated) throw new ApiError('not_found');
    return updated;
  });
}

/** F-13-044 «Готово, когда»: возврат отмечает последнюю оплату возвращённой и не трогает уже истёкший срок */
export function refundLastPartnerPayment(installId: Id): Promise<AppInstall> {
  if (isApiMode()) return installAct(installId, { action: 'refund' });
  return withOwnedInstall(installId, (install) => {
    if (!canRefundLastPayment(install.paymentHistory)) throw new ApiError('nothing_to_refund');
    const last = install.paymentHistory!.at(-1)!;
    last.refundedAt = nowDateTime();
  });
}

// ─────────────────────────── API-ключи и токены (F-13-052, F-13-053) ───────────────────────────

export function listPartnerApiKeys(businessId: Id): Promise<PartnerApiKey[]> {
  if (isApiMode()) return Server.listPartnerApiKeys(businessId);
  return request(() => readArea(AREA).partnerApiKeys.filter((k) => k.businessId === businessId));
}

/** F-13-052 «Готово, когда»: ключ выдаётся и виден — показываем токен только в момент выпуска (arch-a1) */
export function issuePartnerApiKey(businessId: Id): Promise<PartnerApiKey> {
  if (isApiMode()) return Server.issuePartnerApiKey(businessId);
  return request(() => {
    assertCan('integrations.manage');
    const key: PartnerApiKey = { id: newId('iapk'), businessId, token: generateDemoToken('pk_live'), createdAt: nowDateTime() };
    mutateArea(AREA, (s) => {
      s.partnerApiKeys.push(key);
    });
    return key;
  });
}

export function revokePartnerApiKey(keyId: Id): Promise<void> {
  if (isApiMode()) return Server.revokePartnerApiKey(requireBusinessId(), keyId);
  return request(() => {
    assertCan('integrations.manage');
    mutateArea(AREA, (s) => {
      const key = s.partnerApiKeys.find((k) => k.id === keyId);
      if (!key) throw new ApiError('not_found');
      key.revokedAt = nowDateTime();
    });
  });
}

export function listUserApiTokens(businessId: Id): Promise<UserApiToken[]> {
  if (isApiMode()) return Server.listUserApiTokens(businessId);
  return request(() => readArea(AREA).userApiTokens.filter((t) => t.businessId === businessId));
}

export function issueUserApiToken(businessId: Id, label: string): Promise<UserApiToken> {
  if (isApiMode()) return Server.issueUserApiToken(businessId, label);
  return request(() => {
    assertCan('integrations.manage');
    const token: UserApiToken = { id: newId('iaut'), businessId, label: label.trim() || 'User token', token: generateDemoToken('utok'), createdAt: nowDateTime() };
    mutateArea(AREA, (s) => {
      s.userApiTokens.push(token);
    });
    return token;
  });
}

export function revokeUserApiToken(tokenId: Id): Promise<void> {
  if (isApiMode()) return Server.revokeUserApiToken(requireBusinessId(), tokenId);
  return request(() => {
    assertCan('integrations.manage');
    mutateArea(AREA, (s) => {
      const token = s.userApiTokens.find((t) => t.id === tokenId);
      if (!token) throw new ApiError('not_found');
      token.revokedAt = nowDateTime();
    });
  });
}

// ─────────────────────────── ИИ-токен / MCP (F-13-071, F-13-072) ───────────────────────────

export function listAiTokens(businessId: Id): Promise<AiAssistantToken[]> {
  if (isApiMode()) return Server.listAiTokens(businessId);
  return request(() => readArea(AREA).aiTokens.filter((t) => t.businessId === businessId));
}

export function issueAiToken(businessId: Id, scope: AiTokenScope): Promise<AiAssistantToken> {
  if (isApiMode()) return Server.issueAiToken(businessId, scope);
  return request(() => {
    assertCan('integrations.manage');
    const token: AiAssistantToken = { id: newId('iaai'), businessId, scope, token: generateDemoToken('ai'), createdAt: nowDateTime() };
    mutateArea(AREA, (s) => {
      s.aiTokens.push(token);
    });
    return token;
  });
}

export function revokeAiToken(tokenId: Id): Promise<void> {
  if (isApiMode()) return Server.revokeAiToken(requireBusinessId(), tokenId);
  return request(() => {
    assertCan('integrations.manage');
    mutateArea(AREA, (s) => {
      const token = s.aiTokens.find((t) => t.id === tokenId);
      if (!token) throw new ApiError('not_found');
      token.revokedAt = nowDateTime();
    });
  });
}

// ─────────────────────────── Идентификаторы для внешних систем (F-13-056) ───────────────────────────

export interface IdentifiersView {
  businessId: Id;
  locations: { id: Id; name: string }[];
  staff: { id: Id; name: string }[];
  services: { id: Id; name: string }[];
}

export function getIdentifiers(businessId: Id, locale: import('@/domain/core').LocaleCode): Promise<IdentifiersView> {
  if (isApiMode()) {
    return Server.getIdentifiers(businessId).then((v) => ({
      businessId,
      locations: v.locations.map((l) => ({ id: l.id, name: pickText(l.name, locale) })),
      staff: v.staff,
      services: v.services.map((x) => ({ id: x.id, name: pickText(x.name, locale) })),
    }));
  }
  return request(() => {
    const core = readCore();
    return {
      businessId,
      locations: core.locations.filter((l) => l.businessId === businessId).map((l) => ({ id: l.id, name: pickText(l.name, locale) })),
      staff: core.staff.filter((s) => s.businessId === businessId).map((s) => ({ id: s.id, name: s.name })),
      services: core.services.filter((s) => s.businessId === businessId).map((s) => ({ id: s.id, name: pickText(s.name, locale) })),
    };
  });
}

export { isValidApiFieldKey };

// ─────────────────────────── Вебхуки (F-13-062…070) ───────────────────────────

export function getWebhookConfig(businessId: Id): Promise<WebhookConfig> {
  if (isApiMode()) return Server.getWebhookConfig(businessId).then(maskWebhookConfig);
  return request(() => maskWebhookConfig(readArea(AREA).webhookConfigs.find((c) => c.businessId === businessId) ?? defaultWebhookConfig(businessId)));
}

export function setWebhooksEnabled(businessId: Id, enabled: boolean): Promise<WebhookConfig> {
  if (isApiMode()) return Server.setWebhooksEnabled(businessId, enabled);
  return request(() => {
    assertCan('integrations.manage');
    let updated!: WebhookConfig;
    mutateArea(AREA, (s) => {
      let cfg = s.webhookConfigs.find((c) => c.businessId === businessId);
      if (!cfg) {
        cfg = defaultWebhookConfig(businessId);
        s.webhookConfigs.push(cfg);
      }
      cfg.enabled = enabled;
      updated = cfg;
    });
    return updated;
  });
}

export function setWebhookEntities(businessId: Id, entities: WebhookEntity[]): Promise<WebhookConfig> {
  if (isApiMode()) return Server.setWebhookEntities(businessId, entities);
  return request(() => {
    assertCan('integrations.manage');
    let updated!: WebhookConfig;
    mutateArea(AREA, (s) => {
      let cfg = s.webhookConfigs.find((c) => c.businessId === businessId);
      if (!cfg) {
        cfg = defaultWebhookConfig(businessId);
        s.webhookConfigs.push(cfg);
      }
      cfg.entities = entities;
      updated = cfg;
    });
    return updated;
  });
}

export function listWebhookDeliveries(businessId: Id): Promise<WebhookDelivery[]> {
  if (isApiMode()) return Server.listWebhookDeliveries(businessId);
  return request(() =>
    readArea(AREA)
      .webhookDeliveries.filter((d) => d.businessId === businessId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
  );
}

// ─────────────────────────── b04: Google Analytics — потоки данных (F-13-079, F-13-080) ───────────────────────────

function findInstallOrThrow(installId: Id): AppInstall {
  const install = readArea(AREA).installs.find((i) => i.id === installId);
  if (!install) throw new ApiError('not_found');
  return install;
}

export function addGaStream(installId: Id, streamId: string, formLabel: string): Promise<AppInstall> {
  if (isApiMode()) return installAct(installId, { action: 'gaAdd', streamId, formLabel });
  return request(() => {
    assertCan('integrations.manage');
    const trimmedId = streamId.trim().toUpperCase();
    const trimmedLabel = formLabel.trim();
    const install = findInstallOrThrow(installId);
    if (!isValidGaStreamId(trimmedId)) throw new ApiError('invalid_stream_id');
    if (!canAddGaStream(install.gaStreams ?? [], trimmedLabel)) throw new ApiError('duplicate_stream_form');
    let updated!: AppInstall;
    mutateArea(AREA, (s) => {
      const target = s.installs.find((i) => i.id === installId)!;
      const stream: GaDataStream = { id: newId('igs'), streamId: trimmedId, formLabel: trimmedLabel, createdAt: nowDateTime() };
      target.gaStreams = [...(target.gaStreams ?? []), stream];
      updated = target;
    });
    return updated;
  });
}

export function updateGaStream(installId: Id, streamPk: Id, streamId: string, formLabel: string): Promise<AppInstall> {
  if (isApiMode()) return installAct(installId, { action: 'gaUpdate', streamPk, streamId, formLabel });
  return request(() => {
    assertCan('integrations.manage');
    const trimmedId = streamId.trim().toUpperCase();
    const trimmedLabel = formLabel.trim();
    const install = findInstallOrThrow(installId);
    if (!isValidGaStreamId(trimmedId)) throw new ApiError('invalid_stream_id');
    if (!canAddGaStream(install.gaStreams ?? [], trimmedLabel, streamPk)) throw new ApiError('duplicate_stream_form');
    let updated!: AppInstall;
    mutateArea(AREA, (s) => {
      const target = s.installs.find((i) => i.id === installId)!;
      target.gaStreams = (target.gaStreams ?? []).map((g) => (g.id === streamPk ? { ...g, streamId: trimmedId, formLabel: trimmedLabel } : g));
      updated = target;
    });
    return updated;
  });
}

/** F-13-080: удаление убирает связь только у нас — в самом GA данные остаются */
export function deleteGaStream(installId: Id, streamPk: Id): Promise<AppInstall> {
  if (isApiMode()) return installAct(installId, { action: 'gaDelete', streamPk });
  return request(() => {
    assertCan('integrations.manage');
    let updated!: AppInstall;
    mutateArea(AREA, (s) => {
      const target = s.installs.find((i) => i.id === installId)!;
      target.gaStreams = (target.gaStreams ?? []).filter((g) => g.id !== streamPk);
      updated = target;
    });
    return updated;
  });
}

// ─────────────────────────── b04: «Кого позвать» — Beauty AI — GPT (F-13-110, F-13-111) ───────────────────────────

/** F-13-111: до 10 клиентов на завтрашнее свободное окно, с готовым текстом; демо — детерминированный
 *  выбор по клиентам бизнеса локации (реального расписания у раздела «Интеграции» нет — читаем только клиентов). */
export function listWhoToCallCandidates(locationId: Id): Promise<WhoToCallCandidate[]> {
  if (isApiMode()) return Server.listWhoToCallCandidates(requireBusinessId(), locationId);
  return request(() => {
    const core = readCore();
    const location = core.locations.find((l) => l.id === locationId);
    if (!location) return [];
    const clients = core.clients.filter((c) => c.businessId === location.businessId && !c.deletedAt).slice(0, WHO_TO_CALL_MAX);
    const staff = core.staff.filter((s) => s.businessId === location.businessId && s.locationIds.includes(locationId));
    const tomorrow = addMinutes(nowDateTime(), 24 * 60);
    return clients.map((client, idx) => {
      const staffMember = staff[idx % Math.max(staff.length, 1)];
      const staffName = staffMember?.name ?? 'мастера';
      const timeLabel = `${10 + (idx % 8)}:00`;
      const firstName = client.name.split(' ')[0] ?? client.name;
      return {
        clientId: client.id,
        clientName: client.name,
        staffName,
        slotTime: tomorrow,
        reason: idx % 2 === 0 ? 'usualTime' : 'dueForService',
        message: buildWhoToCallMessage(firstName, staffName, timeLabel),
      } satisfies WhoToCallCandidate;
    });
  });
}

// ─────────────────────────── b04: Kommo / amoCRM (F-13-178) ───────────────────────────

export function setKommoSyncMode(installId: Id, mode: KommoSyncMode): Promise<AppInstall> {
  if (isApiMode()) return installAct(installId, { action: 'kommoMode', mode });
  return request(() => {
    assertCan('integrations.manage');
    let updated!: AppInstall;
    mutateArea(AREA, (s) => {
      const target = s.installs.find((i) => i.id === installId)!;
      target.kommoSyncMode = mode;
      updated = target;
    });
    return updated;
  });
}

export function setKommoDedupe(installId: Id, dedupe: boolean): Promise<AppInstall> {
  if (isApiMode()) return installAct(installId, { action: 'kommoDedupe', dedupe });
  return request(() => {
    assertCan('integrations.manage');
    let updated!: AppInstall;
    mutateArea(AREA, (s) => {
      const target = s.installs.find((i) => i.id === installId)!;
      target.kommoDedupe = dedupe;
      updated = target;
    });
    return updated;
  });
}

// ─────────────────────────── b04: FastSign — демо-заполнение анкеты (F-13-181) ───────────────────────────

export function demoFillFastSignForm(installId: Id): Promise<AppInstall> {
  if (isApiMode()) return installAct(installId, { action: 'fastSign' });
  return request(() => {
    let updated!: AppInstall;
    mutateArea(AREA, (s) => {
      const target = s.installs.find((i) => i.id === installId)!;
      target.fastSignFilledCount = (target.fastSignFilledCount ?? 0) + 1;
      updated = target;
    });
    return updated;
  });
}

// ─────────────────────────── b04: заявка партнёру напрямую (F-13-137) ───────────────────────────

export function hasAppliedToPartner(appId: Id, businessId: Id): Promise<boolean> {
  if (isApiMode()) return Server.hasAppliedToPartner(businessId, appId);
  return request(() => readArea(AREA).partnerApplications.some((a) => a.appId === appId && a.businessId === businessId));
}

export function applyToPartner(appId: Id, businessId: Id): Promise<PartnerApplication> {
  if (isApiMode()) return Server.applyToPartner(businessId, appId);
  return request(() => {
    assertCan('integrations.manage');
    let created!: PartnerApplication;
    mutateArea(AREA, (s) => {
      const existing = s.partnerApplications.find((a) => a.appId === appId && a.businessId === businessId);
      if (existing) {
        created = existing;
        return;
      }
      created = { id: newId('ipa'), appId, businessId, createdAt: nowDateTime() };
      s.partnerApplications.push(created);
    });
    return created;
  });
}

// ─────────────────────────── Ревью 27.09 (И2): «работает ли» — проверка подключения ───────────────────────────

/**
 * «Отправить тест»: партнёру уходит проверочное событие, ответ пишется в подключение (lastTest, lastEventAt).
 * Сервер (этап 17) этого пока не умеет — в режиме api запрос уйдёт на POST …/installs/:id/test (см. отчёт).
 */
export function sendInstallTest(installId: Id): Promise<InstallTestResult> {
  if (isApiMode()) return Server.sendInstallTest(requireBusinessId(), installId);
  return request(() => {
    assertCan('integrations.manage');
    const nowIso = nowDateTime();
    let result!: InstallTestResult;
    mutateArea(AREA, (s) => {
      const install = s.installs.find((i) => i.id === installId);
      if (!install) throw new ApiError('not_found');
      if (install.status !== 'connected') throw new ApiError('not_connected', 'Проверить можно только подключённое приложение');
      // Демо: партнёр отвечает, если нет ошибки «неверный ключ» за последние сутки
      const badKey = (install.recentErrors ?? []).some((e) => e.reason === 'invalidCredentials' && e.at >= addMinutes(nowIso, -24 * 60));
      result = badKey ? { at: nowIso, ok: false, reason: 'invalidCredentials' } : { at: nowIso, ok: true };
      install.lastTest = result;
      if (result.ok) {
        install.lastEventAt = nowIso;
        install.lastEventKind = 'sync';
      }
      return s;
    });
    return result;
  });
}

// ─────────────────────────── Ревью 27.09 (И13): адреса вебхуков, секрет подписи, повтор доставки ───────────────────────────

export interface AddWebhookAddressResult {
  address: WebhookAddress;
  /** Секрет подписи целиком — только в ответе на создание; дальше конфигурация отдаёт маску */
  secret: string;
}

function maskWebhookConfig(cfg: WebhookConfig): WebhookConfig {
  return { ...cfg, addresses: cfg.addresses.map((a) => (a.signingSecret ? { ...a, signingSecret: maskToken(a.signingSecret) } : a)) };
}

function newWebhookSecret(): string {
  return generateDemoToken('whsec');
}

/** Проверочный запрос на адрес: отвечает 2xx — адрес добавлен и получает секрет подписи; нет — причина */
export function addWebhookAddress(businessId: Id, url: string): Promise<AddWebhookAddressResult> {
  if (isApiMode()) return Server.addWebhookAddress(businessId, url);
  return request(() => {
    assertCan('integrations.manage');
    const clean = url.trim();
    if (!isValidWebhookUrl(clean)) throw new ApiError('invalid_url', 'Нужен адрес https://…');
    // Демо проверочного запроса: хост со словом «fail» или «localhost» не отвечает
    if (/fail|localhost|127\.0\.0\.1/i.test(clean)) throw new ApiError('webhook_unreachable', 'Адрес не ответил на проверочный запрос');
    const secret = newWebhookSecret();
    const nowIso = nowDateTime();
    const address: WebhookAddress = { id: newId('iwha'), url: clean, createdAt: nowIso, legacy: false, signingSecret: secret, verifiedAt: nowIso };
    mutateArea(AREA, (s) => {
      let cfg = s.webhookConfigs.find((c) => c.businessId === businessId);
      if (!cfg) {
        cfg = defaultWebhookConfig(businessId);
        s.webhookConfigs.push(cfg);
      }
      if (cfg.addresses.some((a) => a.url === clean)) throw new ApiError('duplicate', 'Такой адрес уже добавлен');
      cfg.addresses.push(address);
      return s;
    });
    return { address: { ...address, signingSecret: maskToken(secret) }, secret };
  });
}

export function removeWebhookAddress(businessId: Id, addressId: Id): Promise<void> {
  if (isApiMode()) return Server.removeWebhookAddress(businessId, addressId);
  return request(() => {
    assertCan('integrations.manage');
    mutateArea(AREA, (s) => {
      const cfg = s.webhookConfigs.find((c) => c.businessId === businessId);
      if (cfg) cfg.addresses = cfg.addresses.filter((a) => a.id !== addressId);
      return s;
    });
  });
}

/** Новый секрет подписи: старый перестаёт подходить сразу; новый — целиком только в этом ответе */
export function rotateWebhookSecret(businessId: Id, addressId: Id): Promise<string> {
  if (isApiMode()) return Server.rotateWebhookSecret(businessId, addressId);
  return request(() => {
    assertCan('integrations.manage');
    const secret = newWebhookSecret();
    mutateArea(AREA, (s) => {
      const address = s.webhookConfigs.find((c) => c.businessId === businessId)?.addresses.find((a) => a.id === addressId);
      if (!address) throw new ApiError('not_found');
      address.signingSecret = secret;
      return s;
    });
    return secret;
  });
}

/** «Повторить» неудачную доставку из журнала */
export function retryWebhookDelivery(businessId: Id, deliveryId: Id): Promise<WebhookDelivery> {
  if (isApiMode()) return Server.retryWebhookDelivery(businessId, deliveryId);
  return request(() => {
    assertCan('integrations.manage');
    let updated!: WebhookDelivery;
    mutateArea(AREA, (s) => {
      const d = s.webhookDeliveries.find((x) => x.id === deliveryId && x.businessId === businessId);
      if (!d) throw new ApiError('not_found');
      d.attempts = (d.attempts ?? 1) + 1;
      d.status = 'delivered';
      d.failReason = undefined;
      updated = { ...d };
      return s;
    });
    return updated;
  });
}

// ─────────────────────────── Ревью 27.09 (И9): интеграции клиентской базы — общий источник для /biz/clients ───────────────────────────

export type ClientBaseIntegrationKind = 'chat' | 'telephony' | 'crm' | 'bots' | 'calendar' | 'webhook';

export interface ClientBaseIntegration {
  kind: ClientBaseIntegrationKind;
  /** Живое подключение (connected/pendingActivation) или включённые вебхуки с адресом */
  status: 'connected' | 'pending' | 'none';
  /** Имя подключённого приложения, если есть */
  appName?: string;
  /** Куда вести «Подключить»/«Открыть»: карточка приложения, категория каталога или вкладка вебхуков */
  href: string;
}

const GOOGLE_CALENDAR_NAME = 'Google Календарь';

/**
 * Для /biz/clients/integrations: те же подключения, что на «Установлено», — экран клиентов берёт статусы
 * отсюда, а не держит свою копию «не подключено». Только чтение.
 */
export async function listClientBaseIntegrations(businessId: Id, locationIds: Id[]): Promise<ClientBaseIntegration[]> {
  const [rows, webhooks] = await Promise.all([listInstalled(locationIds), getWebhookConfig(businessId)]);
  const apps = isApiMode() ? await Server.catalogAll() : await request(() => readArea(AREA).apps);
  const live = rows.filter((r) => isInstallLive(r.install.status));
  const pick = (kind: ClientBaseIntegrationKind, match: (app: CatalogApp) => boolean, fallbackHref: string): ClientBaseIntegration => {
    const row = live.find((r) => match(r.app));
    if (row) return { kind, status: row.install.status === 'connected' ? 'connected' : 'pending', appName: row.app.name, href: `/biz/integrations/apps/${row.app.id}` };
    return { kind, status: 'none', href: fallbackHref };
  };
  const calendar = apps.find((a) => a.name === GOOGLE_CALENDAR_NAME);
  return [
    pick('chat', (a) => appHasChatCapability(a.name), '/biz/integrations/category/widgets'),
    pick('telephony', (a) => a.categoryId === 'telephony', '/biz/integrations/category/telephony'),
    pick('crm', (a) => a.categoryId === 'crm', '/biz/integrations/category/crm'),
    pick('bots', (a) => a.categoryId === 'aiAssistants' || a.categoryId === 'chatbots', '/biz/integrations/category/aiAssistants'),
    pick('calendar', (a) => a.name === GOOGLE_CALENDAR_NAME, calendar ? `/biz/integrations/apps/${calendar.id}` : '/biz/integrations/category/other'),
    {
      kind: 'webhook',
      status: webhooks.enabled && webhooks.addresses.length > 0 ? 'connected' : 'none',
      href: '/biz/integrations/api?tab=webhooks',
    },
  ];
}
