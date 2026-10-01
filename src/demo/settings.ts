import type { SphereId } from '@/domain/core';
import { isLocale, type Locale } from '@/i18n/config';
import { SPHERE_IDS } from '@/config/spheres';

/**
 * Демо-персоны. Задаются переключателем (плавающая кнопка) или адресом:
 *   ?demo=owner&sphere=nails&lang=ru&theme=light[&font=large][&api=slow|error][&empty=1]
 * Значения запоминаются в cookie (их ставит src/proxy.ts), поэтому сервер рисует сразу нужный язык и тему.
 *
 * Пустой бизнес (проверка пустых состояний): ?demo=owner&empty=1 — «Новый салон — пусто»,
 * ?demo=individual&empty=1 — «Новый мастер — пусто»; ?empty=0 — обратно к живому бизнесу.
 */
export const PERSONA_IDS = [
  'guest', // Гость — не вошёл
  'client', // Клиент приложения
  'individual', // Мастер-индивидуал
  'owner', // Владелец салона
  'admin', // Администратор салона
  'master', // Мастер в салоне
  'network', // Владелец сети (несколько филиалов)
  'platform', // Наша панель
] as const;
export type PersonaId = (typeof PERSONA_IDS)[number];

/** Персоны, у которых есть кабинет бизнеса */
export const BIZ_PERSONAS: PersonaId[] = ['individual', 'owner', 'admin', 'master', 'network'];

export type Theme = 'light' | 'dark';
export type FontScale = 'normal' | 'large';
/** Режим моковых ответов: normal — 150–400 мс; slow — 1,5–2,5 с; error — все запросы падают */
export type ApiMode = 'normal' | 'slow' | 'error';
/** '1' — владелец/индивидуал попадает в пустой бизнес (без услуг, мастеров, клиентов и записей) */
export type EmptyFlag = '0' | '1';

/** Персоны, у которых есть вариант «пустой бизнес» */
export const EMPTY_PERSONAS: PersonaId[] = ['owner', 'individual'];

export interface DemoSettings {
  persona: PersonaId;
  sphere: SphereId;
  lang: Locale;
  theme: Theme;
  font: FontScale;
  api: ApiMode;
  /** Пустой бизнес для owner/individual (EMPTY_PERSONAS); у остальных персон ничего не меняет */
  empty: EmptyFlag;
  /**
   * Кто вошёл в приложение клиента (AppUser.id) — пишет вход по коду. '' — демо-клиент по умолчанию
   * (первый пользователь приложения). Смена персоны в демо-кнопке сбрасывает.
   */
  appUser: string;
}

export const DEFAULT_DEMO: DemoSettings = {
  persona: 'owner',
  sphere: 'nails',
  lang: 'ru',
  theme: 'light',
  font: 'normal',
  api: 'normal',
  empty: '0',
  appUser: '',
};

/** Имена cookie */
export const DEMO_COOKIES: Record<keyof DemoSettings, string> = {
  persona: 'demo_persona',
  sphere: 'demo_sphere',
  lang: 'lang',
  theme: 'theme',
  font: 'font',
  api: 'demo_api',
  empty: 'demo_empty',
  appUser: 'demo_app_user',
};

/** Имена параметров адреса */
export const DEMO_PARAMS: Record<keyof DemoSettings, string> = {
  persona: 'demo',
  sphere: 'sphere',
  lang: 'lang',
  theme: 'theme',
  font: 'font',
  api: 'api',
  empty: 'empty',
  appUser: 'appUser',
};

const VALIDATORS: { [K in keyof DemoSettings]: (v: string) => boolean } = {
  persona: (v) => (PERSONA_IDS as readonly string[]).includes(v),
  sphere: (v) => (SPHERE_IDS as string[]).includes(v),
  lang: (v) => isLocale(v),
  theme: (v) => v === 'light' || v === 'dark',
  font: (v) => v === 'normal' || v === 'large',
  api: (v) => v === 'normal' || v === 'slow' || v === 'error',
  empty: (v) => v === '0' || v === '1',
  // Только форма id: есть ли такой пользователь, решает контекст (resolveDemoContext)
  appUser: (v) => v === '' || /^au_[A-Za-z0-9_-]{1,40}$/.test(v),
};

export function isValidDemoValue<K extends keyof DemoSettings>(key: K, value: string | undefined | null): boolean {
  return typeof value === 'string' && VALIDATORS[key](value);
}

/** Собрать настройки из любого источника «имя → строка» (cookie, параметры адреса) */
export function readDemoSettings(get: (key: keyof DemoSettings) => string | undefined | null): DemoSettings {
  const out = { ...DEFAULT_DEMO } as Record<keyof DemoSettings, string>;
  (Object.keys(DEFAULT_DEMO) as (keyof DemoSettings)[]).forEach((key) => {
    const value = get(key);
    if (isValidDemoValue(key, value)) out[key] = value as string;
  });
  return out as unknown as DemoSettings;
}

export const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Уточнения «кто я» поверх персоны: вошедший клиент приложения и пустой бизнес */
export interface DemoIdentity {
  appUserId?: string;
  empty?: boolean;
}

export function identityOf(settings: Pick<DemoSettings, 'appUser' | 'empty'>): DemoIdentity {
  return { appUserId: settings.appUser || undefined, empty: settings.empty === '1' };
}

/**
 * Те же уточнения из cookie браузера — для кода вне React (currentActor в api/core), чтобы «сервер» мока
 * и экраны видели одного и того же пользователя. На сервере Next — пусто.
 */
export function readIdentityCookies(): DemoIdentity {
  if (typeof document === 'undefined') return {};
  const read = (name: string) => {
    const pair = document.cookie.split('; ').find((p) => p.startsWith(`${name}=`));
    return pair ? decodeURIComponent(pair.slice(name.length + 1)) : undefined;
  };
  const appUser = read(DEMO_COOKIES.appUser);
  const empty = read(DEMO_COOKIES.empty);
  return identityOf({
    appUser: isValidDemoValue('appUser', appUser) ? (appUser as string) : '',
    empty: empty === '1' ? '1' : '0',
  });
}
