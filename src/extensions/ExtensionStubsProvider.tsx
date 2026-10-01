'use client';

import { createContext, useContext, type ReactNode } from 'react';

const StubsContext = createContext<ReadonlySet<string>>(new Set());

/** Список вкладов-заглушек ('host:area') от сервера (listStubPairs) — для useExtensions */
export function ExtensionStubsProvider({ stubs, children }: { stubs: readonly string[]; children: ReactNode }) {
  return <StubsContext.Provider value={new Set(stubs)}>{children}</StubsContext.Provider>;
}

/** Вклады-заглушки ('host:area'); вне провайдера (витрины /dev) — пусто, показываются все */
export function useExtensionStubs(): ReadonlySet<string> {
  return useContext(StubsContext);
}
