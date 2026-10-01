'use client';

import { useEffect } from 'react';
import { create } from 'zustand';

interface ShellDensityStore {
  /** Сколько смонтированных экранов попросили «плотный» каркас */
  dense: number;
  /** Сколько смонтированных экранов попросили спрятать верхнюю полосу каркаса (DESIGN.md → Journal 3) */
  hideHeader: number;
  /** Счётчик-«сигнал»: экран без доступа к состоянию каркаса просит открыть боковое меню телефона */
  drawerRequest: number;
}

export const useShellDensityStore = create<ShellDensityStore>(() => ({ dense: 0, hideHeader: 0, drawerRequest: 0 }));

/**
 * Страницы, чей вид каркаса известен по адресу — уже в первом кадре с сервера (хуки ниже срабатывают только после
 * гидрации: меню сворачивалось и полоса пропадала через кадр — «прыгает», DESIGN.md → «The skeleton IS the page»).
 * Экран с useDenseScreen()/useHideShellHeader() — добавьте его адрес и сюда.
 */
export const DENSE_PATHS: readonly string[] = ['/biz/journal'];
export const HEADERLESS_PATHS: readonly string[] = ['/biz/journal'];

/**
 * Экран сам служит верхней полосой каркаса (журнал A2, DESIGN.md → Journal 3): 72px-ряд управления —
 * самый верх страницы, отдельной полосы `WorkspaceShell` над ним быть не должно ни на телефоне, ни на
 * десктопе. Уведомления, меню пользователя и переключатель филиала при этом никуда не деваются — экран
 * сам показывает их (в ряду управления и в «⋯ Ещё»).
 *
 *   export function JournalScreen() { useHideShellHeader(); … }
 */
export function useHideShellHeader(): void {
  useEffect(() => {
    useShellDensityStore.setState((s) => ({ hideHeader: s.hideHeader + 1 }));
    return () => useShellDensityStore.setState((s) => ({ hideHeader: Math.max(0, s.hideHeader - 1) }));
  }, []);
}

/** Открыть выезжающее меню каркаса (телефон) из экрана, у которого нет своего доступа к состоянию каркаса. */
export function requestShellDrawerOpen(): void {
  useShellDensityStore.setState((s) => ({ drawerRequest: s.drawerRequest + 1 }));
}

/**
 * Экран просит каркас кабинета «плотный» вид: левое меню по умолчанию свёрнуто до рейки иконок (76 px), чтобы сетке
 * (журнал, график, отчёты, склад) досталось больше места. Если человек сам сворачивал/разворачивал меню — его выбор
 * сильнее и запоминается (sidebarManual в src/demo/store.ts).
 *
 *   export function JournalScreen() { useDenseScreen(); … }
 */
export function useDenseScreen(): void {
  useEffect(() => {
    useShellDensityStore.setState((s) => ({ dense: s.dense + 1 }));
    return () => useShellDensityStore.setState((s) => ({ dense: Math.max(0, s.dense - 1) }));
  }, []);
}
