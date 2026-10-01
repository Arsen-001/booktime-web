'use client';

import { ClientCodeLogin } from '@/areas/client/login/ClientCodeLogin';
import type { AppUser } from '@/domain/core';

/**
 * Вход прямо в записи (F-00-032, F-14-007/008): тот же вход по коду, что на экране «Вход» (ClientCodeLogin) —
 * имя, номер, WhatsApp / Telegram (SMS — запасной, на шаге кода), согласие; четвёртая цифра кода сразу записывает.
 * После кода — onVerified(user), запись создаёт экран.
 */
export function GuestLogin({ onVerified, submitLabel, busy }: { onVerified: (user: AppUser) => Promise<void>; submitLabel: string; busy: boolean }) {
  return <ClientCodeLogin submitLabel={submitLabel} busy={busy} onVerified={onVerified} />;
}
