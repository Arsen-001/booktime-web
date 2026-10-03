'use client';

import { useState } from 'react';
import type { GoogleSignInResult, PendingGoogle } from '@/api/client';
import { ClientCodeLogin } from '@/areas/client/login/ClientCodeLogin';
import { GoogleSignIn, PendingGoogleNote } from '@/areas/client/login/GoogleSignIn';
import type { AppUser } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { useToast } from '@/ui/Toast';

/**
 * Вход прямо в записи (F-00-032, F-14-007/008): тот же вход, что на экране «Вход» — «Войти через Google» (03.10.2026;
 * привязанный Google сразу записывает, непривязанный — номер и код один раз) или имя, номер, канал кода, согласие;
 * четвёртая цифра кода сразу записывает. После входа — onVerified(user), запись создаёт экран.
 */
export function GuestLogin({ onVerified, submitLabel, busy }: { onVerified: (user: AppUser) => Promise<void>; submitLabel: string; busy: boolean }) {
  const t = useT('client');
  const toast = useToast();
  const [pending, setPending] = useState<PendingGoogle | undefined>(undefined);

  const onGoogle = async (r: GoogleSignInResult) => {
    if (r.kind === 'linkRequired') {
      setPending(r.pending);
      return;
    }
    if (!r.user) {
      toast.error(t('login.google.failed'));
      return;
    }
    await onVerified(r.user);
  };

  return (
    <div className="flex flex-col gap-4">
      {pending ? (
        <PendingGoogleNote pending={pending} onCancel={() => setPending(undefined)} />
      ) : (
        <GoogleSignIn
          app="client"
          consent
          onResult={(r) => void onGoogle(r)}
          footer={<p className="text-center text-sm text-muted">{t('login.google.consentNote')}</p>}
        />
      )}
      <ClientCodeLogin
        key={pending?.token ?? 'phone'}
        google={pending}
        submitLabel={submitLabel}
        busy={busy}
        onVerified={async (user) => {
          if (pending && user.googleLinked === false) toast.error(t('login.google.linkFailed'));
          await onVerified(user);
        }}
      />
    </div>
  );
}
