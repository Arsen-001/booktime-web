/**
 * Токены пушей на сервере (booktime-backend: POST/DELETE /v1/me/push-tokens, модель PushToken).
 * Сейчас их сохраняет только приложение (src/lib/native/NativeAppBridge.tsx): FCM-токен устройства, platform —
 * android | ios (сервер шлёт их через FCM; на iOS FCM доставляет поверх APNs). Web Push сайта — позже (docs/PWA.md).
 */
import { http } from '@/api/http';

export interface PushTokenInput {
  app: 'client' | 'business';
  platform: 'web' | 'android' | 'ios';
  /** FCM-токен или endpoint подписки Web Push */
  token: string;
  /** Подписка Web Push целиком (только web) */
  subscription?: Record<string, unknown>;
}

export function savePushToken(input: PushTokenInput): Promise<void> {
  return http('POST', '/v1/me/push-tokens', input);
}

export function deletePushToken(token: string): Promise<void> {
  return http('DELETE', '/v1/me/push-tokens', { token });
}
