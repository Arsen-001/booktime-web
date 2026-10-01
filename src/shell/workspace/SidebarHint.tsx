'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { SidebarChoice } from '@/demo/store';

const SidebarHintContext = createContext<SidebarChoice | undefined>(undefined);

/** Выбор меню из cookie (сервер знает его до первого кадра) — пока браузер не прочитал свой (loadLocalUi) */
export function useSidebarHint(): SidebarChoice | undefined {
  return useContext(SidebarHintContext);
}

export function SidebarHintProvider({ value, children }: { value: SidebarChoice | undefined; children: ReactNode }) {
  return <SidebarHintContext.Provider value={value}>{children}</SidebarHintContext.Provider>;
}
