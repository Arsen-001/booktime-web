'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { NativeAppKind } from '@/lib/native/bridge';

const NativeAppKindContext = createContext<NativeAppKind | null>(null);

/**
 * Какое наше приложение открыло сайт — по строке браузера «… BookTimeApp/business», которую сервер видит в запросе
 * (корневой layout → getNativeAppKind). Поэтому сервер и первый кадр уже знают, что это Business, и клиентские
 * вкладки там не мелькают. null — обычный браузер.
 */
export function useNativeAppKind(): NativeAppKind | null {
  return useContext(NativeAppKindContext);
}

/** Сайт открыт в приложении «BookTime Business»: только кабинет — без клиентских вкладок и меню, вход только бизнеса */
export function useInBusinessApp(): boolean {
  return useNativeAppKind() === 'business';
}

export function NativeAppKindProvider({ value, children }: { value: NativeAppKind | null; children: ReactNode }) {
  return <NativeAppKindContext.Provider value={value}>{children}</NativeAppKindContext.Provider>;
}
