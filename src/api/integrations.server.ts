/**
 * Реализация раздела «integrations» через сервер (booktime-backend, PLAN.md §7, этап 17, docs/backend/02 §17).
 * Зовётся из src/api/integrations.ts при `isApiMode()`: ключи, вебхуки, подключения (этап 17) и с этапа 21
 * (сдача, попытка 6) маркетплейс целиком — каталог, отзывы, подписки, настройки конкретных приложений,
 * промоблоки, кабинет разработчика, заявки партнёрам (Р19: без настоящего обмена с чужими приложениями).
 */
import { http } from '@/api/http';
import type { Id } from '@/domain/core';
import type {
  AiAssistantToken,
  AiTokenScope,
  AppInstall,
  AppReview,
  CatalogApp,
  DevApp,
  DeveloperAccount,
  PartnerApplication,
  PromoBlock,
  PromoBlockDraft,
  WhoToCallCandidate,
  InstallTestResult,
  IntegrationSystemUser,
  WebhookAddress,
  PartnerApiKey,
  UserApiToken,
  WebhookConfig,
  WebhookDelivery,
  WebhookEntity,
} from '@/domain/integrations';

const b = (businessId: Id) => `/v1/biz/${businessId}/integrations`;
const csv = (ids: Id[]) => ids.join(',');

// ─────────────────────────── Подключения (Р19: только статус) ───────────────────────────

export function listInstalled(businessId: Id, locationIds: Id[]): Promise<AppInstall[]> {
  if (!locationIds.length) return Promise.resolve([]);
  return http('GET', `${b(businessId)}/installs`, undefined, { query: { locationIds: csv(locationIds) } });
}

export function countInstalledForBusiness(businessId: Id): Promise<number> {
  return http<{ count: number }>('GET', `${b(businessId)}/installs/count`).then((r) => r.count);
}

export function getInstall(businessId: Id, appId: Id, locationId: Id): Promise<AppInstall | undefined> {
  return http<AppInstall | null>('GET', `${b(businessId)}/installs/one`, undefined, { query: { appId, locationId } }).then((v) => v ?? undefined);
}

export function listLiveInstallLocationIds(businessId: Id, appId: Id, locationIds: Id[]): Promise<Id[]> {
  if (!locationIds.length) return Promise.resolve([]);
  return http('GET', `${b(businessId)}/installs/live-locations`, undefined, { query: { appId, locationIds: csv(locationIds) } });
}

export interface ConnectAppServerInput {
  appId: Id;
  locationIds: Id[];
  scopes: string[];
  /** Считает вызывающий локально из своего каталога (CatalogApp.builtin) — сервер каталога не хранит */
  instant: boolean;
}

export function connectApp(businessId: Id, input: ConnectAppServerInput): Promise<AppInstall[]> {
  return http('POST', `${b(businessId)}/installs`, input);
}

export function demoActivatePartner(businessId: Id, installId: Id): Promise<AppInstall> {
  return http('POST', `${b(businessId)}/installs/${installId}/activate`);
}

export function disconnectApp(businessId: Id, installId: Id): Promise<void> {
  return http('POST', `${b(businessId)}/installs/${installId}/disconnect`).then(() => undefined);
}

export function listSystemUsers(businessId: Id, locationId: Id): Promise<IntegrationSystemUser[]> {
  return http('GET', `${b(businessId)}/installs/system-users`, undefined, { query: { locationId } });
}

// ─────────────────────────── API-ключи (F-13-052/053/071/072) ───────────────────────────

export function listPartnerApiKeys(businessId: Id): Promise<PartnerApiKey[]> {
  return http('GET', `${b(businessId)}/api-keys/partner`);
}

export function issuePartnerApiKey(businessId: Id): Promise<PartnerApiKey> {
  return http('POST', `${b(businessId)}/api-keys/partner`);
}

export function revokePartnerApiKey(businessId: Id, keyId: Id): Promise<void> {
  return http('DELETE', `${b(businessId)}/api-keys/${keyId}`).then(() => undefined);
}

export function listUserApiTokens(businessId: Id): Promise<UserApiToken[]> {
  return http('GET', `${b(businessId)}/api-keys/userToken`);
}

export function issueUserApiToken(businessId: Id, label: string): Promise<UserApiToken> {
  return http('POST', `${b(businessId)}/api-keys/user-token`, { label });
}

export function revokeUserApiToken(businessId: Id, tokenId: Id): Promise<void> {
  return http('DELETE', `${b(businessId)}/api-keys/${tokenId}`).then(() => undefined);
}

export function listAiTokens(businessId: Id): Promise<AiAssistantToken[]> {
  return http('GET', `${b(businessId)}/api-keys/aiAssistant`);
}

export function issueAiToken(businessId: Id, scope: AiTokenScope): Promise<AiAssistantToken> {
  return http('POST', `${b(businessId)}/api-keys/ai-token`, { scope });
}

export function revokeAiToken(businessId: Id, tokenId: Id): Promise<void> {
  return http('DELETE', `${b(businessId)}/api-keys/${tokenId}`).then(() => undefined);
}

// ─────────────────────────── Вебхуки (F-13-062…070) ───────────────────────────

export function getWebhookConfig(businessId: Id): Promise<WebhookConfig> {
  return http('GET', `${b(businessId)}/webhooks`);
}

export function setWebhooksEnabled(businessId: Id, enabled: boolean): Promise<WebhookConfig> {
  return http('PUT', `${b(businessId)}/webhooks/enabled`, { enabled });
}

export function setWebhookEntities(businessId: Id, entities: WebhookEntity[]): Promise<WebhookConfig> {
  return http('PUT', `${b(businessId)}/webhooks/entities`, { entities });
}

export function listWebhookDeliveries(businessId: Id): Promise<WebhookDelivery[]> {
  return http('GET', `${b(businessId)}/webhooks/deliveries`);
}

// ─────────────────────────── Ревью 27.09 — нужно от сервера (в booktime-backend этих маршрутов пока нет) ───────────────────────────

export function sendInstallTest(businessId: Id, installId: Id): Promise<InstallTestResult> {
  return http('POST', `${b(businessId)}/installs/${installId}/test`);
}

export function addWebhookAddress(businessId: Id, url: string): Promise<{ address: WebhookAddress; secret: string }> {
  return http('POST', `${b(businessId)}/webhooks/addresses`, { url });
}

export function removeWebhookAddress(businessId: Id, addressId: Id): Promise<void> {
  return http('DELETE', `${b(businessId)}/webhooks/addresses/${addressId}`).then(() => undefined);
}

export function rotateWebhookSecret(businessId: Id, addressId: Id): Promise<string> {
  return http<{ secret: string }>('POST', `${b(businessId)}/webhooks/addresses/${addressId}/secret`).then((r) => r.secret);
}

export function retryWebhookDelivery(businessId: Id, deliveryId: Id): Promise<WebhookDelivery> {
  return http('POST', `${b(businessId)}/webhooks/deliveries/${deliveryId}/retry`);
}

// ═══════════════════ Этап 21 (сдача, попытка 6): маркетплейс интеграций на сервере ═══════════════════
// Каталог, отзывы, подписки, настройки конкретных приложений, промоблоки, кабинет разработчика, заявки партнёрам.

const catalogUrl = '/v1/integrations/catalog';

export interface CatalogQuery {
  categoryId?: string;
  q?: string;
  country?: 'AM' | 'all';
  channel?: string;
  capability?: string;
  appKind?: string;
}

export function listCatalog(q: CatalogQuery): Promise<CatalogApp[]> {
  return http('GET', catalogUrl, undefined, { query: { ...q } });
}

/** Весь каталог (со скрытыми карточками) — чтобы достроить имя/каналы у подключений; держим минуту в памяти */
let catalogCache: { at: number; promise: Promise<CatalogApp[]> } | undefined;
export function catalogAll(): Promise<CatalogApp[]> {
  if (!catalogCache || Date.now() - catalogCache.at > 60_000) {
    const promise = http<CatalogApp[]>('GET', `${catalogUrl}/all`);
    catalogCache = { at: Date.now(), promise };
    promise.catch(() => {
      if (catalogCache?.promise === promise) catalogCache = undefined;
    });
  }
  return catalogCache.promise;
}

export function listFeaturedApps(country: 'AM' | 'all'): Promise<CatalogApp[]> {
  return http('GET', `${catalogUrl}/featured`, undefined, { query: { country } });
}

export function listCategoryCounts(country: 'AM' | 'all'): Promise<{ categoryId: CatalogApp['categoryId']; count: number }[]> {
  return http('GET', `${catalogUrl}/category-counts`, undefined, { query: { country } });
}

export function getCatalogApp(appId: Id): Promise<CatalogApp> {
  return http('GET', `${catalogUrl}/apps/${encodeURIComponent(appId)}`);
}

export function getCatalogAppByCode(code: string): Promise<CatalogApp> {
  return http('GET', `${catalogUrl}/by-code/${encodeURIComponent(code)}`);
}

export function listReviews(appId: Id): Promise<AppReview[]> {
  return http('GET', `${catalogUrl}/apps/${encodeURIComponent(appId)}/reviews`);
}

export function addReview(businessId: Id, input: { appId: Id; rating: number; text: string }): Promise<AppReview> {
  return http<AppReview>('POST', `${b(businessId)}/reviews`, input).then((r) => {
    catalogCache = undefined; // рейтинг карточки пересчитан сервером
    return r;
  });
}

export function isSubscribedToCategory(businessId: Id, categoryId: string): Promise<boolean> {
  return http<{ subscribed: boolean }>('GET', `${b(businessId)}/category-subscriptions/${encodeURIComponent(categoryId)}`).then((r) => r.subscribed);
}

export function subscribeToCategory(businessId: Id, categoryId: string): Promise<void> {
  return http('POST', `${b(businessId)}/category-subscriptions`, { categoryId }).then(() => undefined);
}

/** Настройки/демо-кнопки конкретного подключения (b03/b04/b05) — одна команда на действие */
export type InstallAction =
  | { action: 'payPartner' | 'refund' | 'approveSender' | 'approveMeta' | 'interceptReview' | 'loyaltyVisit' | 'fastSign' }
  | { action: 'smsAuth'; authKey: string; senderName: string }
  | { action: 'topUp'; amountAmd: number }
  | { action: 'sendTestMessage'; pricePerMessageAmd: number }
  | { action: 'whatsappMode'; mode: 'default' | 'own' }
  | { action: 'cascadeOrder'; order: string[] }
  | { action: 'chatbotTest'; channels: string[]; canConfirm: boolean }
  | { action: 'negativeIntercept'; on: boolean }
  | { action: 'retentionRun'; days: number }
  | { action: 'kommoMode'; mode: string }
  | { action: 'kommoDedupe'; dedupe: boolean }
  | { action: 'gaAdd'; streamId: string; formLabel: string }
  | { action: 'gaUpdate'; streamPk: Id; streamId: string; formLabel: string }
  | { action: 'gaDelete'; streamPk: Id };

export function installAction<R = unknown>(businessId: Id, installId: Id, action: InstallAction): Promise<{ install: AppInstall; result?: R }> {
  return http('POST', `${b(businessId)}/installs/${installId}/action`, action);
}

export function listPromoBlocks(businessId: Id): Promise<PromoBlock[]> {
  return http('GET', `${b(businessId)}/promo-blocks`);
}

export function createPromoBlock(businessId: Id, locationId: Id, draft: PromoBlockDraft): Promise<PromoBlock> {
  return http('POST', `${b(businessId)}/promo-blocks`, { locationId, draft });
}

export function updatePromoBlock(businessId: Id, blockId: Id, draft: PromoBlockDraft): Promise<PromoBlock> {
  return http('POST', `${b(businessId)}/promo-blocks/${blockId}`, { draft });
}

export function setPromoBlockEnabled(businessId: Id, blockId: Id, enabled: boolean): Promise<PromoBlock> {
  return http('POST', `${b(businessId)}/promo-blocks/${blockId}/enabled`, { enabled });
}

export function deletePromoBlock(businessId: Id, blockId: Id): Promise<void> {
  return http('DELETE', `${b(businessId)}/promo-blocks/${blockId}`).then(() => undefined);
}

export function getDeveloperAccount(businessId: Id): Promise<DeveloperAccount | undefined> {
  return http<DeveloperAccount | null | undefined>('GET', `${b(businessId)}/developer`).then((v) => v ?? undefined);
}

export function registerDeveloper(businessId: Id, input: Omit<DeveloperAccount, 'businessId' | 'ownerStaffId' | 'createdAt'>): Promise<DeveloperAccount> {
  return http('POST', `${b(businessId)}/developer`, input);
}

export function listDevApps(businessId: Id): Promise<DevApp[]> {
  return http('GET', `${b(businessId)}/dev-apps`);
}

export function getDevApp(businessId: Id, devAppId: Id): Promise<DevApp> {
  return http('GET', `${b(businessId)}/dev-apps/${devAppId}`);
}

export function getDevAppByCode(businessId: Id, code: string): Promise<DevApp> {
  return http('GET', `${b(businessId)}/dev-apps/by-code/${encodeURIComponent(code)}`);
}

export function createDevApp(businessId: Id, input: { name: string; appCode: string; categoryId: string; isPrivate: boolean }): Promise<DevApp> {
  return http('POST', `${b(businessId)}/dev-apps`, input);
}

export function devAppAction(businessId: Id, devAppId: Id, action: { action: string } & Record<string, unknown>): Promise<DevApp> {
  return http('POST', `${b(businessId)}/dev-apps/${devAppId}/action`, action);
}

export function hasAppliedToPartner(businessId: Id, appId: Id): Promise<boolean> {
  return http<{ applied: boolean }>('GET', `${b(businessId)}/partner-applications/${encodeURIComponent(appId)}`).then((r) => r.applied);
}

export function applyToPartner(businessId: Id, appId: Id): Promise<PartnerApplication> {
  return http('POST', `${b(businessId)}/partner-applications`, { appId });
}

export function demoIncomingCall<T>(businessId: Id): Promise<T> {
  return http('GET', `${b(businessId)}/demo-incoming-call`);
}

export function listWhoToCallCandidates(businessId: Id, locationId: Id): Promise<WhoToCallCandidate[]> {
  return http('GET', `${b(businessId)}/who-to-call`, undefined, { query: { locationId } });
}

export interface IdentifiersServer {
  locations: { id: Id; name: import('@/domain/core').LocalizedText }[];
  staff: { id: Id; name: string }[];
  services: { id: Id; name: import('@/domain/core').LocalizedText }[];
}

export function getIdentifiers(businessId: Id): Promise<IdentifiersServer> {
  return http('GET', `${b(businessId)}/identifiers`);
}
