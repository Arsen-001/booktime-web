'use client';

import { create } from 'zustand';
import type { ApiMode } from '@/demo/settings';
import type { Id } from '@/domain/core';

/**
 * Клиентское UI-состояние демо, которому не нужен сервер:
 *   api        — копия режима ответов для src/api/client.ts (читается вне React);
 *   locationId — выбранный филиал в верхней полосе кабинета ('all' — все доступные);
 *   networkId  — выбранная сеть в переключателе «Филиалы и сети» (у кого их несколько, F-11-021);
 *   sidebarCollapsed — меню кабинета свёрнуто;
 *   sidebarManual — человек сам сворачивал/разворачивал меню: дальше его выбор действует везде, и в журнале
 *     (иначе журнал по умолчанию сворачивает меню до иконок, useDenseScreen).
 * Персона, сфера, язык и тема — в React-контексте DemoProvider (их знает и сервер, из cookie).
 */
interface DemoUiStore {
  api: ApiMode;
  locationId: Id | 'all' | undefined;
  networkId: Id | undefined;
  sidebarCollapsed: boolean;
  sidebarManual: boolean;
  /** Сохранённое из браузера уже прочитано (loadLocalUi) — до этого каркас берёт выбор меню из cookie сервера */
  uiLoaded: boolean;
}

export const useDemoStore = create<DemoUiStore>(() => ({
  api: 'normal',
  locationId: undefined,
  networkId: undefined,
  sidebarCollapsed: false,
  sidebarManual: false,
  uiLoaded: false,
}));

/**
 * Выбор человека «меню свёрнуто/развёрнуто» — ещё и в cookie: сервер рисует меню сразу в нужном виде, а не
 * развёрнутым, чтобы через кадр свернуть (DESIGN.md → «The skeleton IS the page»). Нет cookie — выбора не было.
 */
export const SIDEBAR_COOKIE = 'bp-sidebar';
export type SidebarChoice = 'collapsed' | 'expanded';

const LOCAL_KEY = 'bp-demo-ui';

export function loadLocalUi(): void {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) {
      useDemoStore.setState({ uiLoaded: true });
      return;
    }
    const parsed = JSON.parse(raw) as Partial<Pick<DemoUiStore, 'locationId' | 'networkId' | 'sidebarCollapsed' | 'sidebarManual'>>;
    useDemoStore.setState({
      locationId: parsed.locationId,
      networkId: parsed.networkId,
      sidebarCollapsed: Boolean(parsed.sidebarCollapsed),
      sidebarManual: Boolean(parsed.sidebarManual),
      uiLoaded: true,
    });
  } catch {
    /* нет сохранённого — остаются значения по умолчанию */
    useDemoStore.setState({ uiLoaded: true });
  }
}

function saveLocalUi(): void {
  const { locationId, networkId, sidebarCollapsed, sidebarManual } = useDemoStore.getState();
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify({ locationId, networkId, sidebarCollapsed, sidebarManual }));
  } catch {
    /* хранилище недоступно — не страшно */
  }
}

export function setLocationId(locationId: Id | 'all' | undefined): void {
  useDemoStore.setState({ locationId });
  saveLocalUi();
}

/** Выбор сети в переключателе (F-11-021): кабинет сети открывает именно её */
export function setNetworkId(networkId: Id | undefined): void {
  useDemoStore.setState({ networkId });
  saveLocalUi();
}

/** Человек сам свернул/развернул меню — выбор запоминается и сильнее «плотного» экрана (журнал) */
export function setSidebarCollapsed(sidebarCollapsed: boolean): void {
  useDemoStore.setState({ sidebarCollapsed, sidebarManual: true });
  saveLocalUi();
  document.cookie = `${SIDEBAR_COOKIE}=${sidebarCollapsed ? 'collapsed' : 'expanded'}; path=/; max-age=31536000; samesite=lax`;
}
