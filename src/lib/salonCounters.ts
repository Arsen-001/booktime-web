/**
 * Счётчики салона на его публичной странице /b/<slug> и в записи (F-03-118 Meta Pixel, F-03-119 GA4, F-03-121 события).
 *
 * Это НЕ наша аналитика (src/lib/analytics.ts — без cookie, обезличенная). Пиксель Meta и Google Analytics салона ставят
 * сторонние cookie, поэтому:
 *   - по умолчанию ничего не грузится; скрипты подключаются только после «Разрешить» посетителя (согласие — на каждый
 *     салон отдельно, хранится в localStorage этого браузера, на наш сервер не уходит);
 *   - Do Not Track / Global Privacy Control и наши приложения iOS/Android — не грузим и не спрашиваем;
 *   - в демо (без сервера) скрипты не грузятся: в моковых данных ID выдуманные — события пишутся в консоль, если
 *     включена отладка аналитики (NEXT_PUBLIC_ANALYTICS_DEBUG=1);
 *   - уходят только имена шагов (service_selected, time_selected, booked…), без имён, телефонов и услуг.
 *
 * ID проверяются по формату и на сервере (online.schemas updateLinkBody), и здесь — в адрес скрипта не попадёт мусор.
 */
import { dataMode } from '@/api/mode';
import { ANALYTICS_DEBUG, privacySignal, sanitizeUrl } from '@/lib/analytics';
import { GA4_STREAM_ID_RE, META_PIXEL_ID_RE } from '@/domain/online';
import { nativeApp } from '@/lib/native/bridge';

/**
 * Не подключаем вовсе: «Не отслеживать» / GPC, а также наши приложения iOS и Android — пиксель Meta внутри приложения
 * был бы «отслеживанием» по правилам App Store (ATT) и Google Play (docs/store/privacy-answers.md: tracking — нет)
 */
function countersBlocked(): boolean {
  return privacySignal() || nativeApp() !== null;
}

export interface SalonCounterIds {
  metaPixelId?: string;
  ga4StreamId?: string;
}

export type SalonConsent = 'granted' | 'denied';

/** Валидные ID счётчиков ссылки; нет ни одного — undefined (баннер согласия не показываем вовсе) */
export function salonCounterIds(link: SalonCounterIds | undefined): SalonCounterIds | undefined {
  const meta = link?.metaPixelId?.trim();
  const ga = link?.ga4StreamId?.trim().toUpperCase();
  const out: SalonCounterIds = {
    metaPixelId: meta && META_PIXEL_ID_RE.test(meta) ? meta : undefined,
    ga4StreamId: ga && GA4_STREAM_ID_RE.test(ga) ? ga : undefined,
  };
  return out.metaPixelId || out.ga4StreamId ? out : undefined;
}

// ─────────────────────────── Согласие посетителя ───────────────────────────

const CONSENT_KEY = (businessId: string) => `bt_salon_counters:${businessId}`;
const listeners = new Set<() => void>();
/** Хранилище закрыто (приватный режим) — решение живёт до перезагрузки вкладки */
const memoryConsent = new Map<string, SalonConsent>();

export function readSalonConsent(businessId: string): SalonConsent | undefined {
  if (typeof window === 'undefined') return undefined;
  if (countersBlocked()) return 'denied';
  try {
    const v = localStorage.getItem(CONSENT_KEY(businessId));
    return v === 'granted' || v === 'denied' ? v : undefined;
  } catch {
    return undefined;
  }
}

export function writeSalonConsent(businessId: string, value: SalonConsent): void {
  try {
    localStorage.setItem(CONSENT_KEY(businessId), value);
  } catch {
    memoryConsent.set(businessId, value);
  }
  for (const l of listeners) l();
}

/** Для useSyncExternalStore: решение меняется на этой же вкладке (баннер) */
export function subscribeSalonConsent(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function salonConsentSnapshot(businessId: string): SalonConsent | 'unknown' {
  return readSalonConsent(businessId) ?? memoryConsent.get(businessId) ?? 'unknown';
}

// ─────────────────────────── Скрипты и события ───────────────────────────

type Fbq = ((...args: unknown[]) => void) & { callMethod?: (...args: unknown[]) => void; queue: unknown[]; loaded?: boolean; version?: string; push?: unknown };
type CounterWindow = Window & { fbq?: Fbq; _fbq?: Fbq; dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void };

/** Подключённые на этой вкладке счётчики (страница салона и запись — одна вкладка, грузим один раз) */
const active: SalonCounterIds = {};

function addScript(src: string): void {
  if (document.querySelector(`script[src="${src}"]`)) return;
  const el = document.createElement('script');
  el.async = true;
  el.src = src;
  document.head.appendChild(el);
}

function loadMeta(id: string): void {
  const w = window as CounterWindow;
  if (!w.fbq) {
    // Официальная заглушка fbq: вызовы копятся в очереди, пока не загрузится fbevents.js
    const fbq = function (...args: unknown[]) {
      if (fbq.callMethod) fbq.callMethod(...args);
      else fbq.queue.push(args);
    } as Fbq;
    fbq.queue = [];
    fbq.loaded = true;
    fbq.version = '2.0';
    fbq.push = fbq;
    w.fbq = fbq;
    w._fbq = fbq;
    addScript('https://connect.facebook.net/en_US/fbevents.js');
  }
  w.fbq!('init', id);
}

function loadGa(id: string): void {
  const w = window as CounterWindow;
  if (!w.gtag) {
    w.dataLayer = w.dataLayer ?? [];
    w.gtag = function gtag() {
      // gtag.js ждёт именно объект arguments
      // eslint-disable-next-line prefer-rest-params
      w.dataLayer!.push(arguments);
    };
    w.gtag('js', new Date());
  }
  addScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`);
  // Просмотр страницы шлём сами (salonPageView) — и при переходах внутри сайта; адрес — без личного (sanitizeUrl)
  w.gtag('config', id, { send_page_view: false, page_location: sanitizeUrl(window.location.href) });
}

/** Посетитель разрешил — подключить счётчики салона (повторный вызов с теми же ID ничего не делает) */
export function loadSalonCounters(ids: SalonCounterIds): void {
  if (typeof window === 'undefined' || countersBlocked()) return;
  if (dataMode() !== 'api') {
    if (ANALYTICS_DEBUG) console.info('[salon-counters] demo: scripts not loaded', ids);
    Object.assign(active, ids);
    return;
  }
  if (ids.metaPixelId && active.metaPixelId !== ids.metaPixelId) {
    loadMeta(ids.metaPixelId);
    active.metaPixelId = ids.metaPixelId;
  }
  if (ids.ga4StreamId && active.ga4StreamId !== ids.ga4StreamId) {
    loadGa(ids.ga4StreamId);
    active.ga4StreamId = ids.ga4StreamId;
  }
}

/** Просмотр страницы салона или записи */
export function salonPageView(): void {
  salonCounterEvent('page_view');
}

/** Стандартные события Meta к нашим шагам: реклама в Instagram оптимизируется по ним без настройки */
const META_STANDARD: Record<string, string> = { page_view: 'PageView', service_selected: 'ViewContent', time_selected: 'AddToCart', booked: 'Schedule' };

/**
 * Событие записи (F-03-121) — в подключённые счётчики салона. Не подключены (нет согласия, нет ID) — ничего.
 * Имена — как в списке событий виджета: service_selected, master_selected, date_selected, time_selected, booked…
 */
export function salonCounterEvent(type: string): void {
  try {
    if (typeof window === 'undefined' || (!active.metaPixelId && !active.ga4StreamId)) return;
    if (dataMode() !== 'api') {
      if (ANALYTICS_DEBUG) console.info('[salon-counters]', type);
      return;
    }
    const w = window as CounterWindow;
    if (active.metaPixelId && w.fbq) {
      const standard = META_STANDARD[type];
      if (standard) w.fbq('track', standard);
      if (type !== 'page_view') w.fbq('trackCustom', type);
    }
    if (active.ga4StreamId && w.gtag) {
      w.gtag('event', type, type === 'page_view' ? { page_location: sanitizeUrl(window.location.href), page_title: document.title } : {});
    }
  } catch {
    // счётчики салона не должны ломать запись
  }
}
