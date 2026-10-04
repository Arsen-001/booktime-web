'use client';

import { useSyncExternalStore } from 'react';
import { nativeApp, type NativeApp } from '@/lib/native/bridge';

const noop = () => () => {};
let cached: NativeApp | null | undefined;
const snapshot = () => (cached === undefined ? (cached = nativeApp()) : cached);

/**
 * Открыт ли сайт в нашем приложении (iOS / Android); null — браузер. На сервере и в первом кадре — null,
 * поэтому разметка сервера и браузера совпадает; приложение узнаётся сразу после гидрации.
 */
export function useNativeApp(): NativeApp | null {
  return useSyncExternalStore(noop, snapshot, () => null);
}

/**
 * Магазины приложений (App Store 3.1.1, Google Play «Payments») не разрешают продавать цифровое — подписку BookTime,
 * монеты и то, что за них покупается, — мимо своих платёжных систем и запрещают ссылки на оплату снаружи. Поэтому в
 * приложениях на iOS и Android такие экраны и кнопки скрыты; в браузере всё как раньше.
 */
export function useHideDigitalPurchases(): boolean {
  return useNativeApp() !== null;
}
