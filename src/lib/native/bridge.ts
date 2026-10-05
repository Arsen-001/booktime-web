/**
 * Сайт внутри приложения BookTime / BookTime Business (booktime-mobile: Capacitor, режим удалённого адреса).
 * Приложение открывает booktime.am в своём WebView и встраивает в страницу мост `window.Capacitor` — через него
 * сайт зовёт нативные плагины. Пакетов Capacitor в сайте нет: хватает того, что приложение кладёт в window.
 *
 *   const app = nativeApp();                       // null — обычный браузер
 *   if (app?.platform === 'ios') …
 *   await callNative('Share', 'share', { url });   // плагин.метод → Promise
 *   const off = onNative('FirebaseMessaging', 'tokenReceived', (e) => …);
 *
 * Плагины приложения: FirebaseMessaging (пуши FCM), Share, SplashScreen, App, SystemBars,
 * BooktimeShell (диплинки, цвет системных полос), BooktimeAuth (вход через Apple и Google).
 */

export type NativePlatform = 'ios' | 'android';
export type NativeAppKind = 'client' | 'business';

export interface NativeApp {
  platform: NativePlatform;
  /** Какое приложение: «BookTime» (клиент) или «BookTime Business» */
  app: NativeAppKind;
}

interface CapacitorBridge {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  nativePromise?: <T>(plugin: string, method: string, options?: unknown) => Promise<T>;
  addListener?: (plugin: string, event: string, callback: (data: unknown) => void) => { remove: () => void | Promise<void> };
}

declare global {
  interface Window {
    Capacitor?: CapacitorBridge;
  }
}

function bridge(): CapacitorBridge | null {
  if (typeof window === 'undefined') return null;
  const cap = window.Capacitor;
  return cap?.isNativePlatform?.() ? cap : null;
}

/** Строка браузера приложения: «… BookTimeApp/client» (appendUserAgent в booktime-mobile/shared/config.ts) */
const UA_APP = /BookTimeApp\/(client|business)/;

/**
 * Какое приложение по строке браузера (её видит и сервер — заголовок user-agent, и proxy): null — не наше приложение.
 * Так сервер с первого кадра рисует Business без клиентских вкладок (src/lib/native/NativeAppKind.tsx, src/proxy.ts).
 */
export function nativeAppKindFromUserAgent(userAgent: string | null | undefined): NativeAppKind | null {
  return (UA_APP.exec(userAgent ?? '')?.[1] as NativeAppKind | undefined) ?? null;
}

/** Открыт ли сайт в нашем приложении; null — обычный браузер (или сервер Next) */
export function nativeApp(): NativeApp | null {
  const cap = bridge();
  if (!cap) return null;
  const platform = cap.getPlatform?.();
  if (platform !== 'ios' && platform !== 'android') return null;
  const app = nativeAppKindFromUserAgent(navigator.userAgent) ?? (location.pathname.startsWith('/biz') ? 'business' : 'client');
  return { platform, app };
}

/** Ошибка плагина: code — 'canceled', 'not_configured', 'unavailable', 'failed'… */
export class NativeError extends Error {
  readonly code: string;
  constructor(code: string, message?: string) {
    super(message ?? code);
    this.code = code;
  }
}

/** Вызвать метод нативного плагина. Не в приложении — NativeError('unavailable') */
export async function callNative<T = void>(plugin: string, method: string, options: Record<string, unknown> = {}): Promise<T> {
  const cap = bridge();
  if (!cap?.nativePromise) throw new NativeError('unavailable', 'Not inside the BookTime app');
  try {
    return await cap.nativePromise<T>(plugin, method, options);
  } catch (e) {
    const err = e as { code?: string; message?: string } | undefined;
    throw new NativeError(err?.code ?? 'failed', err?.message);
  }
}

/** Подписаться на событие плагина; вернёт отписку. Не в приложении — пустая отписка */
export function onNative<T = unknown>(plugin: string, event: string, callback: (data: T) => void): () => void {
  const cap = bridge();
  if (!cap?.addListener) return () => {};
  const handle = cap.addListener(plugin, event, (data) => callback(data as T));
  return () => void handle.remove();
}

/**
 * Нативный вызов «по возможности» (спрятать заставку, цвет полос, сохранить токен): не вышло — сайт работает
 * как раньше, человеку сообщать нечего. Одно место, где ошибка намеренно не показывается.
 */
export function bestEffort(promise: Promise<unknown>): void {
  promise.catch(() => undefined); // arch-ok — намеренно: см. выше
}
