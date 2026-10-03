/**
 * Аналитика посещений и воронок (03.10.2026; решение — docs/design/DESIGN.md «Аналитика», включение — docs/DEPLOY.md).
 *
 * Один вход для экранов: `track(event, props)` со списком событий ниже (типы не дают отправить лишнее). Куда уходит —
 * решают провайдеры: Vercel Web Analytics (просмотры страниц сам; свои события — только на платном тарифе Vercel) и
 * PostHog (воронки; только если задан NEXT_PUBLIC_POSTHOG_KEY, грузится отдельным куском после страницы).
 *
 * Отправляем только с живого сайта: сборка `NEXT_PUBLIC_DATA=api` и `NEXT_PUBLIC_VERCEL_ENV=production`
 * (booktime.am). Демо (мок), staging, разработка — ничего. Do Not Track / Global Privacy Control — ничего.
 * Личных данных нет: ни имён, ни телефонов, ни текста поиска — только id бизнеса, сфера, район, шаги и источник.
 * В адресах страниц вырезаем строку запроса (кроме utm_*) и токены/телефоны в пути (sanitizeUrl).
 *
 * Отладка без отправки: `NEXT_PUBLIC_ANALYTICS_DEBUG=1` при сборке/дев-сервере — события пишутся в консоль (console.info).
 */
import { useEffect, useRef } from 'react';

// ─────────────────────────── События ───────────────────────────

/** Откуда запись: публичная ссылка салона, виджет на чужом сайте, установленное приложение (PWA), каталог BookTime */
export type BookingSource = 'link' | 'widget' | 'app' | 'catalog';

/** Каналы трафика — грубо, по utm и referrer */
export type TrafficChannel = 'campaign' | 'search' | 'social' | 'referral' | 'direct';

export interface AnalyticsEvents {
  // Клиент: главная/каталог → страница салона → услуга/время → вход → запись
  /** Страница салона/мастера. page: public — /b/<slug>, place — карточка места в каталоге, master — карточка мастера */
  place_viewed: { businessId: string; sphere?: string; district?: string; page: 'public' | 'place' | 'master' };
  booking_started: { businessId: string; sphere?: string; source: BookingSource; slotPreselected?: boolean };
  slot_selected: { businessId: string; source: BookingSource };
  /** Форма входа по номеру показана. context: booking — прямо в записи, login — экран «Вход» */
  login_shown: { context: 'booking' | 'login' };
  login_completed: { method: 'code' | 'google' };
  booking_created: { businessId: string; sphere?: string; source: BookingSource; prepayment: boolean };
  /** Поиск в каталоге: длина запроса (не сам текст) и сколько нашлось */
  search: { query_length: number; results: number; sphere?: string; district?: string };
  // Салон: «для бизнеса» → регистрация → первая услуга → первый мастер → первая запись
  business_signup_started: Record<string, never>;
  business_signup_completed: { businessId: string; sphere: string; type: 'salon' | 'individual' };
  first_service_created: { businessId: string };
  first_staff_added: { businessId: string };
  /** TODO(сервер): «первая запись салона» точно знает только сервер (запись приходит от клиента, не из кабинета) */
  first_booking_created: { businessId: string };
}

export type AnalyticsEventName = keyof AnalyticsEvents;

/** К этим событиям добавляем источник: первый заход (90 дней) и текущий визит */
const ATTRIBUTED: ReadonlySet<AnalyticsEventName> = new Set(['booking_created', 'business_signup_completed']);

/**
 * Vercel принимает у своего события не больше 2 свойств (тариф Pro; 8 — с Web Analytics Plus) — отдаём главные.
 * Остальное и источник — только в PostHog.
 */
const VERCEL_KEYS: Partial<Record<AnalyticsEventName, string[]>> = {
  place_viewed: ['page', 'sphere'],
  booking_started: ['source', 'sphere'],
  slot_selected: ['source'],
  login_completed: ['method'],
  booking_created: ['source', 'prepayment'],
  search: ['results', 'sphere'],
  business_signup_completed: ['sphere', 'type'],
};

type Props = Record<string, string | number | boolean | null | undefined>;

// ─────────────────────────── Включено ли ───────────────────────────

export const ANALYTICS_DEBUG = process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === '1';
export const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY ?? '';
export const POSTHOG_HOST = (process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com').replace(/\/$/, '');

/** Сборка живого сайта: настоящий сервер и production на Vercel. Демо, staging и разработка — нет */
export const ANALYTICS_BUILD = process.env.NEXT_PUBLIC_DATA === 'api' && process.env.NEXT_PUBLIC_VERCEL_ENV === 'production';

/** Человек попросил не отслеживать: Do Not Track или Global Privacy Control */
export function privacySignal(): boolean {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean; msDoNotTrack?: string };
  const win = typeof window === 'undefined' ? undefined : (window as Window & { doNotTrack?: string });
  return nav.globalPrivacyControl === true || nav.doNotTrack === '1' || nav.doNotTrack === 'yes' || nav.msDoNotTrack === '1' || win?.doNotTrack === '1';
}

/** Можно ли отправлять в этом браузере (на сервере Next — нет) */
export function analyticsEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return ANALYTICS_BUILD && !privacySignal();
}

// ─────────────────────────── Провайдеры ───────────────────────────

/** Провайдер: получает уже очищенные свойства. Подключаются в AnalyticsScripts после монтирования */
export interface AnalyticsProvider {
  name: string;
  track: (event: AnalyticsEventName, props: Props) => void;
}

const providers: AnalyticsProvider[] = [];
/** События до подключения провайдеров (PostHog грузится отдельно) — не теряем, отдаём, когда подключится */
const queue: { event: AnalyticsEventName; props: Props }[] = [];
const QUEUE_MAX = 50;

export function registerAnalyticsProvider(provider: AnalyticsProvider): void {
  if (providers.some((p) => p.name === provider.name)) return;
  providers.push(provider);
  for (const item of queue) provider.track(item.event, item.props);
}

/** Все провайдеры подключены — очередь больше не нужна */
export function flushAnalyticsQueue(): void {
  queue.length = 0;
}

export function vercelProps(event: AnalyticsEventName, props: Props): Props {
  const keys = VERCEL_KEYS[event] ?? Object.keys(props).slice(0, 2);
  const out: Props = {};
  for (const k of keys) if (props[k] !== undefined) out[k] = props[k];
  return out;
}

// ─────────────────────────── Отправка ───────────────────────────

/** Отправить событие. Вне живого сайта — ничего (в отладке — строка в консоли). Никогда не бросает */
export function track<E extends AnalyticsEventName>(event: E, props: AnalyticsEvents[E]): void {
  try {
    if (typeof window === 'undefined') return;
    const clean: Props = {};
    for (const [k, v] of Object.entries(props as Props)) if (v !== undefined) clean[k] = v;
    if (ATTRIBUTED.has(event)) Object.assign(clean, attributionProps());
    if (ANALYTICS_DEBUG) {
      console.info('[analytics]', event, clean);
      return;
    }
    if (!analyticsEnabled()) return;
    if (queue.length < QUEUE_MAX) queue.push({ event, props: clean });
    for (const p of providers) p.track(event, clean);
  } catch {
    // аналитика не должна ломать запись или вход
  }
}

/**
 * Событие один раз за показ экрана, когда данные готовы (props = undefined — ещё грузится).
 * Ключ — по значимым полям: другой салон на том же экране — новое событие.
 */
export function useTrackOnce<E extends AnalyticsEventName>(event: E, props: AnalyticsEvents[E] | undefined): void {
  const sent = useRef<string | undefined>(undefined);
  const key = props ? `${event}:${JSON.stringify(props)}` : undefined;
  useEffect(() => {
    if (!key || !props || sent.current === key) return;
    sent.current = key;
    track(event, props);
    // props сравниваются через key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

/** Источник записи в приложении клиента: установленное на телефон (PWA) или каталог в браузере */
export function appBookingSource(): BookingSource {
  try {
    return window.matchMedia('(display-mode: standalone)').matches ? 'app' : 'catalog';
  } catch {
    return 'catalog';
  }
}

// ─────────────────────────── Адреса без личного ───────────────────────────

/** Сегменты пути, где лежит секрет или номер: заменяем шаблоном маршрута */
const MASKED_PATHS: [RegExp, string][] = [
  [/^\/claim\/[^/]+/, '/claim/[token]'],
  [/^\/s\/[^/]+/, '/s/[code]'],
  [/^\/biz\/onboarding\/invite\/[^/]+/, '/biz/onboarding/invite/[token]'],
  [/^\/biz\/network\/clients\/[^/]+/, '/biz/network/clients/[phone]'],
  [/^\/biz\/integrations\/e\/[^/]+/, '/biz/integrations/e/[code]'],
];

/** Путь без секретов: /claim/abc → /claim/[token] */
export function sanitizePath(path: string): string {
  for (const [re, to] of MASKED_PATHS) if (re.test(path)) return path.replace(re, to);
  return path;
}

/** Адрес без личного: строка запроса — только utm_*, хеш — прочь, токены и номера в пути — шаблоном */
export function sanitizeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    const keep = new URLSearchParams();
    u.searchParams.forEach((v, k) => {
      if (k.startsWith('utm_')) keep.set(k, v);
    });
    const qs = keep.toString();
    return `${u.origin}${sanitizePath(u.pathname)}${qs ? `?${qs}` : ''}`;
  } catch {
    return '';
  }
}

// ─────────────────────────── Источник (UTM, referrer) ───────────────────────────

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const;
type Touch = Partial<Record<(typeof UTM_KEYS)[number], string>> & { referrer?: string; channel: TrafficChannel; landing: string; at: number };

/** Первый заход — 90 дней (localStorage, на наш сервер не уходит); текущий визит — sessionStorage */
const FIRST_KEY = 'bt_attr_first';
const SESSION_KEY = 'bt_attr_session';
export const FIRST_TOUCH_DAYS = 90;

const SEARCH_RE = /(^|\.)(google|bing|yandex|duckduckgo|yahoo|baidu|ecosia|search\.brave)\./;
const SOCIAL_RE = /(^|\.)(instagram|facebook|fb|t|telegram|tiktok|vk|ok|linkedin|youtube|twitter|x|threads|pinterest|whatsapp)\.(com|me|org|ru|net|co)$|^l\.instagram\.com$|^lm\.facebook\.com$/;

function channelOf(utmSource: string | undefined, referrerHost: string | undefined): TrafficChannel {
  if (utmSource) return 'campaign';
  if (!referrerHost) return 'direct';
  if (SEARCH_RE.test(referrerHost)) return 'search';
  if (SOCIAL_RE.test(referrerHost)) return 'social';
  return 'referral';
}

function readTouch(storage: Storage, key: string): Touch | undefined {
  try {
    const raw = storage.getItem(key);
    return raw ? (JSON.parse(raw) as Touch) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Запомнить, откуда пришли: при каждом заходе на сайт (первая страница вкладки). Первый заход — не переписываем
 * 90 дней; визит — свой на вкладку. Только домен referrer, не весь адрес (в нём бывает личное).
 */
export function captureAttribution(): void {
  if (typeof window === 'undefined') return;
  try {
    if (sessionStorage.getItem(SESSION_KEY)) return;
    const params = new URLSearchParams(window.location.search);
    let referrer: string | undefined;
    try {
      const host = document.referrer ? new URL(document.referrer).hostname : '';
      referrer = host && host !== window.location.hostname && !host.endsWith('.booktime.am') && host !== 'booktime.am' ? host : undefined;
    } catch {
      referrer = undefined;
    }
    const touch: Touch = { channel: 'direct', landing: sanitizePath(window.location.pathname), at: Date.now() };
    for (const k of UTM_KEYS) {
      const v = params.get(k)?.trim().slice(0, 100);
      if (v) touch[k] = v;
    }
    if (referrer) touch.referrer = referrer;
    touch.channel = channelOf(touch.utm_source, referrer);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(touch));
    const first = readTouch(localStorage, FIRST_KEY);
    if (!first || Date.now() - first.at > FIRST_TOUCH_DAYS * 86_400_000) localStorage.setItem(FIRST_KEY, JSON.stringify(touch));
  } catch {
    // хранилище закрыто — события уйдут без источника
  }
}

function touchProps(touch: Touch | undefined, prefix: string): Props {
  if (!touch) return {};
  const out: Props = { [`${prefix}channel`]: touch.channel, [`${prefix}landing`]: touch.landing };
  if (touch.referrer) out[`${prefix}referrer`] = touch.referrer;
  for (const k of UTM_KEYS) if (touch[k]) out[`${prefix}${k}`] = touch[k];
  return out;
}

/** Источник для событий регистрации и записи: first_* — первый заход (90 дней), session_* — этот визит */
export function attributionProps(): Props {
  try {
    return { ...touchProps(readTouch(localStorage, FIRST_KEY), 'first_'), ...touchProps(readTouch(sessionStorage, SESSION_KEY), 'session_') };
  } catch {
    return {};
  }
}

// ─────────────────────────── Вехи салона (первая услуга, первый мастер) ───────────────────────────

const MILESTONES_KEY = (businessId: string) => `bt_an_ms:${businessId}`;
type Milestones = { services: boolean; staff: boolean };

/** Регистрация прошла в этом браузере — с этого момента ждём первую услугу и первого мастера */
export function startBusinessMilestones(businessId: string, type: 'salon' | 'individual'): void {
  if (!analyticsEnabled() && !ANALYTICS_DEBUG) return;
  try {
    // Индивидуал сам себе мастер — «первого мастера» у него не ждём
    localStorage.setItem(MILESTONES_KEY(businessId), JSON.stringify({ services: false, staff: type === 'individual' } satisfies Milestones));
  } catch {
    // нет хранилища — без вех
  }
}

/**
 * Чек-лист первых шагов показал «сделано» — отправить first_* один раз. Только для бизнеса, зарегистрированного
 * в этом браузере после запуска аналитики (иначе старые салоны дали бы ложные «первые» события).
 * Точный учёт (другое устройство, сотрудник) — TODO(сервер).
 */
export function reportBusinessMilestones(businessId: string, done: { services: boolean; staff: boolean }): void {
  try {
    const raw = localStorage.getItem(MILESTONES_KEY(businessId));
    if (!raw) return;
    const seen = JSON.parse(raw) as Milestones;
    let changed = false;
    if (done.services && !seen.services) {
      seen.services = true;
      changed = true;
      track('first_service_created', { businessId });
    }
    if (done.staff && !seen.staff) {
      seen.staff = true;
      changed = true;
      track('first_staff_added', { businessId });
    }
    if (seen.services && seen.staff) localStorage.removeItem(MILESTONES_KEY(businessId));
    else if (changed) localStorage.setItem(MILESTONES_KEY(businessId), JSON.stringify(seen));
  } catch {
    // нет хранилища — без вех
  }
}
