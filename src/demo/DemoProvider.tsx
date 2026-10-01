'use client';

import { useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { COOKIE_MAX_AGE, DEMO_COOKIES, type DemoSettings } from '@/demo/settings';
import { loadLocalUi, setLocationId, useDemoStore } from '@/demo/store';
import type { Id } from '@/domain/core';
import { addMinutes, nowDateTime } from '@/lib/date';
import { bootDb, useDb } from '@/mock/db';
import type { AreaStates } from '@/mock/slices';

interface DemoContextValue {
  settings: DemoSettings;
  /**
   * Применить демо-настройки: cookie + состояние + атрибуты <html>; смена языка перерисовывает страницу.
   * Смена персоны сбрасывает вошедшего клиента (appUser), если он не передан в том же вызове.
   * Вход клиента по коду: apply({ persona: 'client', appUser: user.id }).
   */
  apply: (patch: Partial<DemoSettings>) => void;
}

const Ctx = createContext<DemoContextValue | null>(null);

function writeCookie(name: string, value: string): void {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
}

/** Сколько минут после согласия при входе (areas.client.consents) вход считается «только что» */
const JUST_SIGNED_IN_MIN = 3;

/**
 * Кто только что вошёл по коду: самое свежее согласие при входе за последние минуты.
 * Временный мост: экраны входа раздела client зовут apply({ persona: 'client' }) без id — как только они
 * передадут appUser сами, это правило перестанет срабатывать (appUser в patch важнее).
 */
function justSignedIn(consents: Record<Id, string> | undefined): Id | undefined {
  if (!consents) return undefined;
  const since = addMinutes(nowDateTime(), -JUST_SIGNED_IN_MIN);
  let best: [Id, string] | undefined;
  for (const [id, at] of Object.entries(consents)) {
    if (at >= since && (!best || at > best[1])) best = [id, at];
  }
  return best?.[0];
}

/**
 * Корневой провайдер демо: настройки из cookie (пришли с сервера), подъём моковой базы,
 * синхронизация режима API. Монтируется один раз в src/app/layout.tsx.
 */
export function DemoProvider({ initial, children }: { initial: DemoSettings; children: ReactNode }) {
  const router = useRouter();
  const [settings, setSettings] = useState(initial);
  // Свежие согласия при входе — через подписку, а не рендер: apply зовут сразу после входа, до перерисовки
  const consents = useRef<Record<Id, string> | undefined>(undefined);

  useEffect(() => {
    loadLocalUi();
    void bootDb();
    return useDb.subscribe((s) => {
      consents.current = (s.areas as Partial<AreaStates>).client?.consents;
    });
  }, []);

  useEffect(() => {
    useDemoStore.setState({ api: settings.api });
  }, [settings.api]);

  const apply = (input: Partial<DemoSettings>) => {
    const patch = { ...input };
    const personaChanged = patch.persona !== undefined && patch.persona !== settings.persona;
    if (personaChanged && patch.appUser === undefined) {
      // Гость → клиент без id — это вход по коду: тот, кто только что дал согласие; иначе демо-клиент по умолчанию
      patch.appUser = (settings.persona === 'guest' && patch.persona === 'client' && justSignedIn(consents.current)) || '';
    }
    const next = { ...settings, ...patch };
    (Object.keys(patch) as (keyof DemoSettings)[]).forEach((key) => writeCookie(DEMO_COOKIES[key], String(next[key])));
    const root = document.documentElement;
    root.dataset.theme = next.theme;
    root.dataset.font = next.font;
    root.lang = next.lang;
    if (personaChanged || (patch.empty !== undefined && patch.empty !== settings.empty)) setLocationId(undefined);
    setSettings(next);
    if (patch.lang && patch.lang !== settings.lang) router.refresh();
  };

  return <Ctx.Provider value={{ settings, apply }}>{children}</Ctx.Provider>;
}

export function useDemoContext(): DemoContextValue {
  const value = useContext(Ctx);
  if (!value) throw new Error('useDemoContext: нет DemoProvider');
  return value;
}
