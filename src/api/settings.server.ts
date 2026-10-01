'use client';

/**
 * Раздел «settings» на настоящем сервере (booktime-backend, PLAN.md §7, этап 18; docs/backend/02 §18, 06 §2–5).
 * Функции src/api/settings.ts в режиме `api` зовут эти; экран получает те же типы, что от мока.
 *
 * Деньги и сроки считает сервер: цены лежат в его таблице (В-01), скидка промокода зависит от срока оплаты
 * (В-13: 10/15/25 % за 3/6/12 мес.), монеты — журнал движений (06 §2.2), пакеты — В-15. Права проверяет сервер.
 *
 * Перечитывание: чтения объявляют метку areas.settings (trackRead), запись будит её (notifyDbChange). Бренд,
 * контакты, галерея и «основные» меняют бизнес и филиал — после записи ядро браузера пересинхронизируется
 * (syncCore), чтобы разделы, читающие бизнес из ядра, увидели новое.
 */
import { http } from '@/api/http';
import { syncCore } from '@/api/mirror';
import { trackRead } from '@/api/request';
import type { CoinMove, Id } from '@/domain/core';
import type {
  BillingPaymentMethod,
  CoinPackage,
  CompanyProfileSummary,
  HelpRequest,
  Invoice,
  InvoicePurpose,
  LegalInfo,
  MobileAppOrderRequest,
  NotificationPrefs,
  OnboardingStep,
  PriceQuote,
  PriceRuleChange,
  RecordCategory,
  SeatLine,
  SettingsChangeLogEntry,
  SettingsChangeSection,
  SphereRequest,
  StartPage,
  Subscription,
  SubscriptionPayment,
  SubscriptionWarning,
  SystemSettings,
} from '@/domain/settings';
import { notifyDbChange } from '@/mock/db';

const biz = (businessId: Id) => `/v1/biz/${businessId}`;
const newKey = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

function read<T>(fn: () => Promise<T>): Promise<T> {
  trackRead('areas.settings');
  return fn();
}
async function write<T>(fn: () => Promise<T>, opts?: { sync?: Id }): Promise<T> {
  const res = await fn();
  if (opts?.sync) await syncCore(opts.sync);
  notifyDbChange('areas.settings');
  return res;
}

// ─────────── подписка ───────────

export interface ServerSubscriptionView extends Subscription {
  status: 'active' | 'freeMonth' | 'trial' | 'endingSoon' | 'frozen';
  daysLeft: number;
  quote: PriceQuote;
  serverStatus: 'unpaid' | 'trial_free' | 'active' | 'grace' | 'frozen' | 'cancelled' | 'left';
  graceUntil?: string;
  readOnly: boolean;
}

export const getSubscription = (businessId: Id) => read(() => http<ServerSubscriptionView>('GET', `${biz(businessId)}/billing`));
export const quotePrice = (businessId: Id, months: number) => read(() => http<PriceQuote>('GET', `${biz(businessId)}/billing/quote`, undefined, { query: { months } }));
export const getBillingSeats = (businessId: Id) => read(() => http<SeatLine[]>('GET', `${biz(businessId)}/billing/seats`));
export const previewPriceChange = (businessId: Id, delta: { masters?: number; admins?: number }) =>
  http<{ before: number; after: number }>('POST', `${biz(businessId)}/billing/preview`, delta);
export const subscriptionWarnings = (businessId: Id) => read(() => http<SubscriptionWarning[]>('GET', `${biz(businessId)}/billing/warnings`));
export const toggleAutoRenew = (businessId: Id, autoRenew: boolean) =>
  write(() => http<Subscription>('PUT', `${biz(businessId)}/billing/autorenew`, { autoRenew }));
export const setPaymentDocsEmail = (businessId: Id, value: boolean) =>
  write(() => http<Subscription>('PUT', `${biz(businessId)}/billing/docs-email`, { value }));

/** Оплата (F-15-070/083/084): сервер продлевает срок и тратит промокод; «счёт для фирмы» — неоплаченный счёт */
export async function pay(businessId: Id, months: number, method: BillingPaymentMethod) {
  return write(() => http<{ invoiceId: Id | null; status: 'paid' | 'unpaid' | 'pending' }>('POST', `${biz(businessId)}/billing/pay`, { months, method }, { idempotencyKey: newKey() }), { sync: businessId });
}

export const listPayments = (businessId: Id) => read(() => http<SubscriptionPayment[]>('GET', `${biz(businessId)}/billing/charges`));
export const listInvoices = (businessId: Id, purpose?: InvoicePurpose) =>
  read(() => http<Invoice[]>('GET', `${biz(businessId)}/billing/invoices`, undefined, { query: { purpose } }));
export const getInvoice = (businessId: Id, invoiceId: Id) => read(() => http<Invoice>('GET', `${biz(businessId)}/billing/invoices/${invoiceId}`));
export const listPriceRuleChanges = (businessId: Id) => read(() => http<PriceRuleChange[]>('GET', `${biz(businessId)}/billing/price-rules`));

// ─────────── монеты ───────────

export const getCoinBalance = (businessId: Id) => read(() => http<{ balance: number }>('GET', `${biz(businessId)}/coins`).then((r) => r.balance));
export const listCoinMoves = (q: { businessId: Id; area?: string; kinds?: CoinMove['kind'][] }) =>
  read(() => http<CoinMove[]>('GET', `${biz(q.businessId)}/coins/entries`, undefined, { query: { area: q.area, kinds: q.kinds?.join(',') } }));
export const listCoinPackages = (businessId: Id) => read(() => http<CoinPackage[]>('GET', `${biz(businessId)}/coins/packages`));
export const purchaseCoinPackage = (businessId: Id, packageId: string) =>
  write(() => http<CoinMove>('POST', `${biz(businessId)}/coins/buy`, { packageId }, { idempotencyKey: newKey() }));
export const spendCoins = (input: { businessId: Id; amount: number; reason: string; area: string; refId?: Id }) =>
  write(() => http<CoinMove>('POST', `${biz(input.businessId)}/coins/spend`, { amount: input.amount, reason: input.reason, area: input.area, refId: input.refId }, { idempotencyKey: newKey() }));

// ─────────── компания ───────────

export const getLegalInfo = (businessId: Id) => read(() => http<LegalInfo>('GET', `${biz(businessId)}/company/legal`));
export const saveLegalInfo = (businessId: Id, legal: LegalInfo) => write(() => http<LegalInfo>('PUT', `${biz(businessId)}/company/legal`, legal));
export const saveBillingAddress = (businessId: Id, billingAddress: string) =>
  write(() => http<LegalInfo>('PUT', `${biz(businessId)}/company/billing-address`, { billingAddress }));
export const getSystemSettings = (businessId: Id) => read(() => http<SystemSettings>('GET', `${biz(businessId)}/company/system`));
export const saveSystemSettings = (businessId: Id, input: Omit<SystemSettings, 'businessId'> & { internalName?: string }) =>
  write(() => http<SystemSettings>('PUT', `${biz(businessId)}/company/system`, input), { sync: businessId });

export interface ServerBrand {
  brandName: string;
  descriptionRu: string;
  descriptionAutoLangs: ('hy' | 'en')[];
  logoUrl?: string;
}
export const getBrand = (businessId: Id) => read(() => http<ServerBrand>('GET', `${biz(businessId)}/company/brand`));
export const saveBrand = (businessId: Id, input: { brandName: string; descriptionRu: string; logoUrl?: string }) =>
  write(() => http<ServerBrand>('PUT', `${biz(businessId)}/company/brand`, input), { sync: businessId });
export const getContacts = <T>(businessId: Id) => read(() => http<T>('GET', `${biz(businessId)}/company/contacts`));
export const getGallery = (businessId: Id) => read(() => http<string[]>('GET', `${biz(businessId)}/company/gallery`));
export const saveContacts = <T>(businessId: Id, input: { addressRu: string; yandexMapsUrl?: string; hoursText?: string; phones: string[]; socials: Record<string, unknown> }) =>
  write(() => http<T>('PUT', `${biz(businessId)}/company/contacts`, input), { sync: businessId });
export const saveGallery = (businessId: Id, photos: string[]) => write(() => http<string[]>('PUT', `${biz(businessId)}/company/gallery`, { photos }), { sync: businessId });
export const getCompanyProfile = (businessId: Id) => read(() => http<CompanyProfileSummary>('GET', `${biz(businessId)}/company/profile`));
export const getOnboardingChecklist = (businessId: Id) => read(() => http<OnboardingStep[]>('GET', `${biz(businessId)}/onboarding/checklist`));
export const getSettingsChangeLog = (businessId: Id, section?: SettingsChangeSection) =>
  read(() => http<SettingsChangeLogEntry[]>('GET', `${biz(businessId)}/company/change-log`, undefined, { query: { section } }));

export const listRecordCategories = (businessId: Id) => read(() => http<RecordCategory[]>('GET', `${biz(businessId)}/record-categories`));
export const saveRecordCategory = (businessId: Id, id: Id | undefined, input: { name: string; colorIndex: number; icon?: string }) =>
  write(() => (id ? http<RecordCategory>('PATCH', `${biz(businessId)}/record-categories/${id}`, input) : http<RecordCategory>('POST', `${biz(businessId)}/record-categories`, input)));
export const deleteRecordCategory = (businessId: Id, id: Id) => write(() => http<void>('DELETE', `${biz(businessId)}/record-categories/${id}`));

export const getOnboarding = (businessId: Id) => read(() => http<{ goals?: string[]; tourSeen?: boolean }>('GET', `${biz(businessId)}/onboarding`));
export const saveOnboarding = (businessId: Id, input: { goals?: string[]; tourSeen?: boolean }) =>
  write(() => http<{ goals?: string[]; tourSeen?: boolean }>('PUT', `${biz(businessId)}/onboarding`, input));

// ─────────── вебхуки «для разработчиков» (F-15-119, этап 21 «Сдача», лейн rest) ───────────

export interface ServerWebhookSettings {
  businessId: Id;
  enabled: boolean;
  url?: string;
  entities: string[];
}
export const getWebhooks = (businessId: Id) => read(() => http<ServerWebhookSettings>('GET', `${biz(businessId)}/company/webhooks`));
export const saveWebhooks = (businessId: Id, input: { enabled: boolean; url?: string; entities: string[] }) =>
  write(() => http<ServerWebhookSettings>('PUT', `${biz(businessId)}/company/webhooks`, input));

// ─────────── подтверждение почты сотрудника (F-15-150, этап 21 «Сдача», лейн rest) ───────────

export interface ServerEmailStatus {
  email?: string;
  emailVerified: boolean;
  emailConfirmSentAt?: string;
}
export const getEmailStatus = (businessId: Id) => read(() => http<ServerEmailStatus>('GET', `${biz(businessId)}/me/email`));
export const sendEmailConfirmationApi = (businessId: Id, email?: string) =>
  write(() => http<ServerEmailStatus>('POST', `${biz(businessId)}/me/email/send-confirmation`, { email }));
export const confirmEmailDemoApi = (businessId: Id) => write(() => http<ServerEmailStatus>('POST', `${biz(businessId)}/me/email/confirm-demo`));

// ─────────── обращения ───────────

export const listHelpRequests = (businessId: Id) => read(() => http<HelpRequest[]>('GET', `${biz(businessId)}/help-requests`));
export const createHelpRequest = (businessId: Id, topic: HelpRequest['topic'], message: string) =>
  write(() => http<HelpRequest>('POST', `${biz(businessId)}/help-requests`, { topic, message }));
export const listMobileAppOrderRequests = (businessId: Id) => read(() => http<MobileAppOrderRequest[]>('GET', `${biz(businessId)}/mobile-app-requests`));
export const createMobileAppOrderRequest = (businessId: Id) => write(() => http<MobileAppOrderRequest>('POST', `${biz(businessId)}/mobile-app-requests`));
export const listSphereRequests = (businessId: Id) => read(() => http<SphereRequest[]>('GET', `${biz(businessId)}/sphere-requests`));
export const getSphereRequest = (businessId: Id, id: Id) => read(() => http<SphereRequest>('GET', `${biz(businessId)}/sphere-requests/${id}`));
export const submitSphereRequest = (businessId: Id, name: string, message?: string) =>
  write(() => http<SphereRequest>('POST', `${biz(businessId)}/sphere-requests`, { name, message }));

// ─────────── личные настройки сотрудника ───────────

export interface ServerPrefs {
  notificationPrefs: NotificationPrefs;
  startPage?: StartPage;
  startLocationId?: Id;
}
export const getPrefs = (businessId: Id) => http<ServerPrefs>('GET', `${biz(businessId)}/me/prefs`);
export const savePrefs = (businessId: Id, input: { notificationPrefs?: NotificationPrefs; startPage?: StartPage | null; startLocationId?: Id | null }) =>
  write(() => http<ServerPrefs>('PUT', `${biz(businessId)}/me/prefs`, input));
