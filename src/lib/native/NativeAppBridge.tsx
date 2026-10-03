'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isApiMode } from '@/api/http';
import { useSession } from '@/api/session';
import { bestEffort, callNative, nativeApp, onNative } from '@/lib/native/bridge';
import { registerNativePushToken } from '@/lib/native/push';

/**
 * Сайт внутри приложения BookTime / BookTime Business (booktime-mobile). В обычном браузере не делает ничего.
 *  - Пуши: после входа спрашивает разрешение (системное окно — один раз) и сохраняет FCM-токен телефона на сервере
 *    вместо Web Push; новый токен (Firebase его иногда меняет) — тоже. Нажали на пуш — открываем его страницу.
 *  - «Поделиться»: navigator.share → нативное меню (в WebView Android Web Share нет совсем).
 *  - Кнопка «Назад» Android: закрывает открытое окно (как Esc), иначе — шаг назад, на первом экране — сворачивает.
 *  - Цвет полосы под строкой состояния и её значков — под тему сайта; заставка прячется, как только сайт ожил.
 */
export function NativeAppBridge() {
  const router = useRouter();
  const session = useSession();
  const userId = isApiMode() ? session.data?.user.id : undefined;

  // Один раз: заставка, «Поделиться», «Назад», тема, переходы по пушам
  useEffect(() => {
    const app = nativeApp();
    if (!app) return;
    const offs: (() => void)[] = [];

    bestEffort(callNative('SplashScreen', 'hide'));

    // Тема сайта (data-theme на <html>) → цвет системных полос
    const root = document.documentElement;
    let dark: boolean | null = null;
    const syncChrome = () => {
      const next = root.dataset.theme === 'dark';
      if (next === dark) return;
      dark = next;
      bestEffort(callNative('BooktimeShell', 'setChrome', { dark: next }));
      bestEffort(callNative('SystemBars', 'setStyle', { style: next ? 'DARK' : 'LIGHT' }));
    };
    syncChrome();
    const observer = new MutationObserver(syncChrome);
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    offs.push(() => observer.disconnect());

    // «Поделиться» — нативное меню (файлы — только если WebView умеет сам, как WKWebView на iOS)
    const webShare = typeof navigator.share === 'function' ? navigator.share.bind(navigator) : undefined;
    const webCanShare = typeof navigator.canShare === 'function' ? navigator.canShare.bind(navigator) : undefined;
    const share = async (data?: ShareData) => {
      if (data?.files?.length) {
        if (webShare) return webShare(data);
        throw new DOMException('Sharing files is not supported', 'NotAllowedError');
      }
      try {
        await callNative('Share', 'share', { title: data?.title, text: data?.text, url: data?.url, dialogTitle: data?.title });
      } catch (e) {
        const message = e instanceof Error ? e.message.toLowerCase() : '';
        if (message.includes('cancel')) throw new DOMException('Share canceled', 'AbortError');
        throw new DOMException(e instanceof Error ? e.message : 'Share failed', 'AbortError');
      }
    };
    const canShare = (data?: ShareData) => (data?.files?.length ? Boolean(webCanShare?.(data)) : true);
    Object.defineProperty(navigator, 'share', { value: share, configurable: true, writable: true });
    Object.defineProperty(navigator, 'canShare', { value: canShare, configurable: true, writable: true });

    // «Назад» Android
    if (app.platform === 'android') {
      offs.push(
        onNative<{ canGoBack: boolean }>('App', 'backButton', ({ canGoBack }) => {
          if (document.querySelector('[role="dialog"], [role="alertdialog"]')) {
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
          } else if (canGoBack) {
            window.history.back();
          } else {
            bestEffort(callNative('App', 'minimizeApp'));
          }
        }),
      );
    }

    // Нажали на пуш: сервер кладёт путь сайта в data.url (booktime-backend, adapters/push/push.ts)
    offs.push(
      onNative<{ notification?: { data?: Record<string, unknown> } }>('FirebaseMessaging', 'notificationActionPerformed', (event) => {
        const raw = event.notification?.data?.url;
        if (typeof raw !== 'string' || !raw) return;
        try {
          const target = new URL(raw, window.location.origin);
          if (target.origin === window.location.origin) router.push(target.pathname + target.search + target.hash);
        } catch {
          // битая ссылка в пуше — остаёмся на текущем экране
        }
      }),
    );

    return () => offs.forEach((off) => off());
  }, [router]);

  // После входа: разрешение на пуши и токен телефона на сервер
  useEffect(() => {
    if (!userId || !nativeApp()) return;
    let cancelled = false;
    const register = (token: string | undefined) => {
      if (!cancelled && token) bestEffort(registerNativePushToken(token));
    };
    const off = onNative<{ token?: string }>('FirebaseMessaging', 'tokenReceived', (e) => register(e.token));
    const ask = async () => {
      let status = await callNative<{ receive: string }>('FirebaseMessaging', 'checkPermissions');
      if (status.receive === 'prompt' || status.receive === 'prompt-with-rationale') {
        status = await callNative<{ receive: string }>('FirebaseMessaging', 'requestPermissions');
      }
      if (status.receive !== 'granted') return;
      const { token } = await callNative<{ token: string }>('FirebaseMessaging', 'getToken');
      register(token);
    };
    // Firebase ещё не настроен в сборке (нет google-services.json / GoogleService-Info.plist) или нет сети — без пушей
    bestEffort(ask());
    return () => {
      cancelled = true;
      off();
    };
  }, [userId]);

  return null;
}
