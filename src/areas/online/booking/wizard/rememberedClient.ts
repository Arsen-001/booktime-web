'use client';

import { useSyncExternalStore } from 'react';

/**
 * О14: клиент, который уже вошёл в «Личный кабинет» или подтверждал номер в этом браузере, не вводит имя, телефон
 * и код заново. Храним только номер и имя (не код) — в localStorage этого браузера; «Не вы?» стирает.
 */
const KEY = 'online.rememberedClient';
const CABINET_PHONE_KEY = 'online.cabinet.phone';
const EVENT = 'online-remembered-client';

export interface RememberedClient {
  phone: string;
  name?: string;
}

let cachedRaw: string | null | undefined;
let cachedValue: RememberedClient | undefined;

function read(): RememberedClient | undefined {
  let raw: string | null = null;
  let cabinet: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
    cabinet = window.localStorage.getItem(CABINET_PHONE_KEY);
  } catch {
    return undefined;
  }
  const composite = `${raw ?? ''}|${cabinet ?? ''}`;
  if (composite === cachedRaw) return cachedValue;
  cachedRaw = composite;
  try {
    const parsed = raw ? (JSON.parse(raw) as RememberedClient) : undefined;
    cachedValue = parsed?.phone ? parsed : cabinet ? { phone: cabinet } : undefined;
  } catch {
    cachedValue = cabinet ? { phone: cabinet } : undefined;
  }
  return cachedValue;
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener('storage', cb);
  };
}

export function useRememberedClient(): RememberedClient | undefined {
  return useSyncExternalStore(subscribe, read, () => undefined);
}

export function rememberClient(value: RememberedClient | undefined): void {
  try {
    if (value) window.localStorage.setItem(KEY, JSON.stringify(value));
    else {
      window.localStorage.removeItem(KEY);
      window.localStorage.removeItem(CABINET_PHONE_KEY);
    }
  } catch {
    /* приватный режим — просто не запомним */
  }
  window.dispatchEvent(new Event(EVENT));
}
