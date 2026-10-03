'use client';

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useLocale } from 'next-intl';
import { GOOGLE_CLIENT_ID, googleSignInAvailable, signInWithGoogle, type GoogleSignInResult, type PendingGoogle } from '@/api/client';
import { isApiMode } from '@/api/http';
import { useApiMutation } from '@/api/request';
import { SESSION_KEY } from '@/api/session';
import { loginErrorText } from '@/areas/client/login/loginError';
import { useT } from '@/i18n/useT';
import { track } from '@/lib/analytics';
import { Button } from '@/ui/Button';
import { Spinner } from '@/ui/Spinner';
import { useToast } from '@/ui/Toast';

/**
 * «Войти через Google» (03.10.2026). Живой сайт — кнопка Google Identity Services (их собственная, по правилам бренда
 * Google; скрипт https://accounts.google.com/gsi/client грузится только на экране входа) → ID token → сервер. Без
 * NEXT_PUBLIC_GOOGLE_CLIENT_ID кнопки нет. Демо — наша кнопка того же вида: сразу вход демо-персоной, без Google.
 * Google не привязан к номеру — onResult({ kind: 'linkRequired' }): экран просит номер и код один раз.
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
  const signIn = useApiMutation(signInWithGoogle, { invalidates: [SESSION_KEY] });

  if (mode === 'off') return null;

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

  return (
    <div data-f="F-00-032" className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        {mode === 'gis' ? (
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

/** Google не привязан: «Google: anna@gmail.com — подтвердите номер один раз, привяжем Google к нему» */
export function PendingGoogleNote({ pending, onCancel }: { pending: PendingGoogle; onCancel: () => void }) {
  const t = useT('client');
  return (
    <div className="flex flex-col gap-1 rounded-lg bg-primary-soft p-4 text-sm text-fg" role="status">
      <div className="flex items-center gap-2 font-medium">
        <GoogleMark />
        <span className="min-w-0 truncate">{pending.email}</span>
      </div>
      <p className="text-muted">{t('login.google.pendingText')}</p>
      <Button variant="link" size="sm" className="-ml-1 self-start" onClick={onCancel}>
        {t('login.google.pendingCancel')}
      </Button>
    </div>
  );
}
