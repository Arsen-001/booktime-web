/**
 * Пуш-токен приложения (FCM) на сервере: сохранить после входа, удалить перед выходом — чтобы пуши прежнего
 * человека не приходили на телефон, на котором вошёл другой. Только внутри приложения (src/lib/native/bridge.ts).
 */
import { deletePushToken, savePushToken } from '@/api/push';
import { nativeApp } from '@/lib/native/bridge';

const STORAGE_KEY = 'bt-native-push-token';

function remembered(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function remember(token: string | null): void {
  try {
    if (token) localStorage.setItem(STORAGE_KEY, token);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // нет хранилища — переживём: сервер сам перепривяжет токен при следующем входе (upsert по токену)
  }
}

/** Сохранить FCM-токен этого телефона за вошедшим человеком */
export async function registerNativePushToken(token: string): Promise<void> {
  const app = nativeApp();
  if (!app || !token) return;
  await savePushToken({ app: app.app, platform: app.platform, token });
  remember(token);
}

/** Перед выходом: убрать токен этого телефона у человека (ошибки не мешают выйти) */
export async function forgetNativePushToken(): Promise<void> {
  const token = remembered();
  if (!token || !nativeApp()) return;
  try {
    await deletePushToken(token);
  } catch {
    // сеть или сессия уже истекла — сервер всё равно погасит токен при первой неудачной отправке
  }
  remember(null);
}
