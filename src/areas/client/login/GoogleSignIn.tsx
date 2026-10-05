'use client';

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useLocale } from 'next-intl';
import type { GoogleSignInResult, PendingGoogle } from '@/api/client';
import { GOOGLE_CLIENT_ID, googleSignInAvailable, signInWithApple, signInWithGoogle } from '@/api/client-auth';
import { isApiMode } from '@/api/http';
import { useApiMutation } from '@/api/request';
import { SESSION_KEY } from '@/api/session';
import { loginErrorText } from '@/areas/client/login/loginError';
import { useT } from '@/i18n/useT';
import { track } from '@/lib/analytics';
import { callNative, nativeApp, NativeError, type NativePlatform } from '@/lib/native/bridge';
import { Button } from '@/ui/Button';
import { Spinner } from '@/ui/Spinner';
import { useToast } from '@/ui/Toast';

/**
 * «Войти через Google» (03.10.2026). Живой сайт — кнопка Google Identity Services (их собственная, по правилам бренда
 * Google; скрипт https://accounts.google.com/gsi/client грузится только на экране входа) → ID token → сервер. Без
 * NEXT_PUBLIC_GOOGLE_CLIENT_ID кнопки нет. Демо — наша кнопка того же вида: сразу вход демо-персоной, без Google.
 * Google не привязан к номеру — onResult({ kind: 'linkRequired' }): экран просит номер и код один раз.
 *
 * Внутри приложения BookTime (booktime-mobile, src/lib/native): Google не пускает свой вход во встроенный WebView,
 * поэтому кнопка зовёт нативный вход Google (BooktimeAuth) — тот же ID token и тот же сервер. На iOS рядом — «Продолжить
 * с Apple» (правило App Store 4.8: есть Google — должен быть и Apple); в браузере кнопки Apple нет.
 */

type GoogleMode = 'loading' | 'gis' | 'mock' | 'off';

/** Режим кнопки: на сервере Next — по сборке; в браузере — с учётом ?data=api при разработке (без рассинхрона гидрации) */
function serverMode(): GoogleMode {
  if (process.env.NEXT_PUBLIC_DATA === 'api') return GOOGLE_CLIENT_ID ? 'gis' : 'off';
  return 'loading';
}
function clientMode(): GoogleMode {
  if (!googleSignInAvailable()) return 'off';
  return isApiMode() ? 'gis' : 'mock';
}
const noSubscribe = () => () => {};

export function useGoogleMode(): GoogleMode {
  return useSyncExternalStore(noSubscribe, clientMode, serverMode);
}

// ─────────── Вход внутри приложения (нативные Google и Apple) ───────────

interface NativeAuth {
  platform: NativePlatform;
  google: boolean;
  apple: boolean;
}

const nativePlatform = () => nativeApp()?.platform ?? null;

/** null — обычный браузер; undefined — приложение, ещё спрашиваем, что настроено; иначе — что доступно */
function useNativeAuth(): NativeAuth | null | undefined {
  const platform = useSyncExternalStore(noSubscribe, nativePlatform, () => null);
  const [available, setAvailable] = useState<{ google: boolean; apple: boolean } | undefined>(undefined);
  useEffect(() => {
    if (!platform) return;
    let cancelled = false;
    callNative<{ google: boolean; apple: boolean }>('BooktimeAuth', 'available')
      .then((r) => !cancelled && setAvailable({ google: Boolean(r.google), apple: Boolean(r.apple) }))
      .catch(() => !cancelled && setAvailable({ google: false, apple: false }));
    return () => {
      cancelled = true;
    };
  }, [platform]);
  if (!platform) return null;
  return available ? { platform, ...available } : undefined;
}

/** Значок Apple для «Продолжить с Apple» (Apple HIG: логотип цвета текста кнопки) */
export function AppleMark() {
  return (
    <svg viewBox="0 0 73 73" aria-hidden className="size-5 fill-current">
      <path d="M47.11,11.51 C49.89,8.52 51.41,4.3 51.15,0.07 C47.36,0.07 42.93,2.31 40.19,5.56 C38,8.31 35.68,12.53 36.52,16.79 C40.44,17.25 44.66,14.76 47.11,11.51 Z M50.82,17.72 C44.91,17.72 39.68,20.97 36.94,20.97 C33.99,20.97 29.78,17.55 25.01,17.72 C18.81,17.84 13.12,21.52 9.87,26.92 C7.68,30.76 6.79,35.28 6.84,39.92 C6.92,48.7 10.38,57.86 14.43,63.72 C17.55,68.16 21.05,72.93 26.02,72.93 C30.49,72.93 32.18,69.93 38,69.93 C43.44,69.93 45.17,72.93 49.89,72.93 C54.82,72.93 58.11,68.41 61.06,63.94 C64.77,58.7 66,53.72 66.16,53.55 C66,53.55 56.64,49.75 56.3,38.91 C56.3,29.41 64.01,25.15 64.31,24.94 C60.13,18.44 53.35,17.72 50.82,17.72 Z" />
    </svg>
  );
}

/** Ключ текста про привязку: «Google привязан…» или «Apple ID привязан…» */
export function pendingTextKey<K extends 'linked' | 'linkFailed'>(pending: PendingGoogle, key: K) {
  return pending.provider === 'apple' ? (`login.apple.${key}` as const) : (`login.google.${key}` as const);
}

// ─────────── Google Identity Services ───────────

interface GisCredentialResponse {
  credential: string;
}
interface GisApi {
  initialize(config: { client_id: string; callback: (r: GisCredentialResponse) => void; auto_select?: boolean; cancel_on_tap_outside?: boolean; ux_mode?: 'popup' | 'redirect'; itp_support?: boolean; context?: 'signin' | 'signup' | 'use' }): void;
  renderButton(
    parent: HTMLElement,
    options: { type?: 'standard'; theme?: 'outline' | 'filled_blue' | 'filled_black'; size?: 'large' | 'medium'; text?: 'signin_with' | 'continue_with'; shape?: 'rectangular' | 'pill'; logo_alignment?: 'left' | 'center'; width?: number; locale?: string },
  ): void;
}
declare global {
  interface Window {
    google?: { accounts?: { id?: GisApi } };
  }
}

const GIS_SRC = 'https://accounts.google.com/gsi/client';
let gisLoading: Promise<GisApi> | null = null;
/** Google инициализируется один раз на страницу; ответ идёт кнопке, отрисованной последней (на экране входа видна одна) */
let gisReady = false;
let activeCredential: ((token: string) => void) | null = null;

function loadGis(): Promise<GisApi> {
  const ready = window.google?.accounts?.id;
  if (ready) return Promise.resolve(ready);
  gisLoading ??= new Promise<GisApi>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.onload = () => {
      const api = window.google?.accounts?.id;
      if (api) resolve(api);
      else reject(new Error('gis: no api'));
    };
    script.onerror = () => {
      gisLoading = null;
      script.remove();
      reject(new Error('gis: load failed'));
    };
    document.head.appendChild(script);
  });
  return gisLoading;
}

export function GisButton({ onCredential, busy }: { onCredential: (token: string) => void; busy: boolean }) {
  const t = useT('client');
  const locale = useLocale();
  const ref = useRef<HTMLDivElement>(null);
  const handler = useRef(onCredential);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    handler.current = onCredential;
  });

  useEffect(() => {
    let cancelled = false;
    const own = (token: string) => handler.current(token);
    loadGis()
      .then((api) => {
        const el = ref.current;
        if (cancelled || !el) return;
        if (!gisReady) {
          api.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: (r) => activeCredential?.(r.credential),
            auto_select: false,
            cancel_on_tap_outside: true,
            ux_mode: 'popup',
            itp_support: true,
            context: 'signin',
          });
          gisReady = true;
        }
        activeCredential = own;
        el.replaceChildren();
        api.renderButton(el, {
          type: 'standard',
          theme: document.documentElement.dataset.theme === 'dark' ? 'filled_black' : 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          logo_alignment: 'center',
          width: Math.max(200, Math.min(400, Math.round(el.getBoundingClientRect().width))),
          locale,
        });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (activeCredential === own) activeCredential = null;
    };
  }, [locale]);

  if (failed) return <p className="flex min-h-12 items-center justify-center text-center text-sm text-muted md:min-h-11">{t('login.google.loadFailed')}</p>;

  return (
    <div className="relative min-h-12 md:min-h-11" aria-busy={busy || undefined}>
      <div ref={ref} className="flex min-h-12 items-center justify-center md:min-h-11" />
      {busy && (
        <div className="absolute inset-0 flex items-center justify-center rounded-md bg-surface/80">
          <Spinner size="sm" label={t('login.google.checking')} />
        </div>
      )}
    </div>
  );
}

/** Значок Google — файл бренда из /public (цвета Google — данные, не токены) */
export function GoogleMark() {
  // eslint-disable-next-line @next/next/no-img-element -- маленький svg-значок, оптимизация next/image не нужна
  return <img src="/brand/google-g.svg" alt="" aria-hidden className="size-5" />;
}

export interface GoogleSignInProps {
  /** Каким входом: клиент или кабинет бизнеса */
  app: 'client' | 'business';
  onResult: (result: GoogleSignInResult) => void;
  /** Клиент: кнопка под текстом «Продолжая, вы принимаете соглашение» — согласие (F-14-008) */
  consent?: boolean;
  /** Под кнопкой — например, «Продолжая, вы принимаете соглашение» */
  footer?: ReactNode;
}

/** Кнопка «Войти через Google» и разделитель «или по номеру» под ней. Нет Client ID на живом сайте — ничего. */
export function GoogleSignIn({ app, onResult, consent, footer }: GoogleSignInProps) {
  const t = useT('client');
  const toast = useToast();
  const mode = useGoogleMode();
  const native = useNativeAuth();
  const signIn = useApiMutation(signInWithGoogle, { invalidates: [SESSION_KEY] });
  const appleSignIn = useApiMutation(signInWithApple, { invalidates: [SESSION_KEY] });
  const [nativeBusy, setNativeBusy] = useState<'google' | 'apple' | null>(null);

  // В приложении: Google — нативный (если настроен и в приложении, и на сайте), Apple — только iOS
  const nativeGoogle = Boolean(native?.google) && mode !== 'off';
  const nativeApple = native?.platform === 'ios' && Boolean(native.apple);
  if (native === null ? mode === 'off' : native !== undefined && !nativeGoogle && !nativeApple) return null;

  const run = async (idToken?: string) => {
    if (signIn.isPending) return;
    try {
      const result = await signIn.mutate({ idToken, app, consent });
      if (result.kind === 'signedIn' && app === 'client') track('login_completed', { method: 'google' });
      onResult(result);
    } catch (e) {
      toast.error(loginErrorText(t, e, t('login.google.failed')));
    }
  };

  const runNativeGoogle = async () => {
    if (nativeBusy || signIn.isPending) return;
    setNativeBusy('google');
    try {
      // Демо (без сервера) — сразу вход демо-персоной, как у кнопки на сайте
      const token = isApiMode() ? (await callNative<{ idToken: string }>('BooktimeAuth', 'signInWithGoogle')).idToken : undefined;
      await run(token);
    } catch (e) {
      if (!(e instanceof NativeError && e.code === 'canceled')) toast.error(t('login.google.failed'));
    } finally {
      setNativeBusy(null);
    }
  };

  const runApple = async () => {
    if (nativeBusy || appleSignIn.isPending) return;
    setNativeBusy('apple');
    try {
      const apple = isApiMode() ? await callNative<{ identityToken: string; authorizationCode?: string | null; name: string | null }>('BooktimeAuth', 'signInWithApple') : undefined;
      try {
        onResult(await appleSignIn.mutate({ identityToken: apple?.identityToken, authorizationCode: apple?.authorizationCode, name: apple?.name, app, consent }));
      } catch (e) {
        toast.error(loginErrorText(t, e, t('login.apple.failed')));
      }
    } catch (e) {
      if (!(e instanceof NativeError && e.code === 'canceled')) toast.error(t('login.apple.failed'));
    } finally {
      setNativeBusy(null);
    }
  };

  return (
    <div data-f="F-00-032" className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        {native !== null ? (
          native === undefined ? (
            <div className="min-h-12 md:min-h-11" aria-hidden />
          ) : (
            <>
              {nativeApple && (
                <Button variant="outline" size="lg" fullWidth leftIcon={<AppleMark />} loading={nativeBusy === 'apple'} onClick={() => void runApple()}>
                  {t('login.apple.button')}
                </Button>
              )}
              {nativeGoogle && (
                <Button variant="outline" size="lg" fullWidth leftIcon={<GoogleMark />} loading={nativeBusy === 'google'} onClick={() => void runNativeGoogle()}>
                  {t('login.google.button')}
                </Button>
              )}
            </>
          )
        ) : mode === 'gis' ? (
          <GisButton onCredential={(token) => void run(token)} busy={signIn.isPending} />
        ) : mode === 'mock' ? (
          <Button variant="outline" size="lg" fullWidth leftIcon={<GoogleMark />} loading={signIn.isPending} onClick={() => void run()}>
            {t('login.google.button')}
          </Button>
        ) : (
          <div className="min-h-12 md:min-h-11" aria-hidden />
        )}
        {footer}
      </div>
      <div className="flex items-center gap-3 text-sm text-muted" role="separator">
        <span className="h-px flex-1 bg-border" />
        <span>{t('login.google.orPhone')}</span>
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}

/** Google (или Apple ID) не привязан: «Google: anna@gmail.com — подтвердите номер один раз, привяжем Google к нему» */
export function PendingGoogleNote({ pending, onCancel }: { pending: PendingGoogle; onCancel: () => void }) {
  const t = useT('client');
  const apple = pending.provider === 'apple';
  return (
    <div className="flex flex-col gap-1 rounded-lg bg-primary-soft p-4 text-sm text-fg" role="status">
      <div className="flex items-center gap-2 font-medium">
        {apple ? <AppleMark /> : <GoogleMark />}
        <span className="min-w-0 truncate">{pending.email ?? pending.name ?? t('login.apple.pendingFallback')}</span>
      </div>
      <p className="text-muted">{t(apple ? 'login.apple.pendingText' : 'login.google.pendingText')}</p>
      <Button variant="link" size="sm" className="-ml-1 self-start" onClick={onCancel}>
        {t(apple ? 'login.apple.pendingCancel' : 'login.google.pendingCancel')}
      </Button>
    </div>
  );
}
