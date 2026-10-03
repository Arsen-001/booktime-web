'use client';

/**
 * «Вход через Google» в профиле (03.10.2026): привязать Google к вошедшему по номеру — дальше вход в одно нажатие,
 * показать почту привязанного, отвязать. Номер остаётся главным входом (docs/design/DESIGN.md, «Войти через Google»).
 * Нет Client ID на живом сайте — карточки нет. Демо — привязка имитируется (настоящего Google нет).
 */
import { useState } from 'react';
import { Check } from 'lucide-react';
import { getGoogleLink, linkGoogle, unlinkGoogle } from '@/api/client';
import { useApiMutation, useApiQuery } from '@/api/request';
import { GisButton, GoogleMark, useGoogleMode } from '@/areas/client/login/GoogleSignIn';
import { loginErrorText } from '@/areas/client/login/loginError';
import type { Id } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { useToast } from '@/ui/Toast';

export function GoogleAccountCard({ appUserId }: { appUserId: Id }) {
  const t = useT('client');
  const toast = useToast();
  const mode = useGoogleMode();
  const [unlinkOpen, setUnlinkOpen] = useState(false);
  const key = ['client', 'google-link', appUserId];
  const q = useApiQuery(key, () => getGoogleLink(appUserId), { enabled: mode === 'gis' || mode === 'mock' });
  const link = useApiMutation((idToken?: string) => linkGoogle(appUserId, idToken), { invalidates: [key] });
  const unlink = useApiMutation(() => unlinkGoogle(appUserId), { invalidates: [key] });

  if ((mode !== 'gis' && mode !== 'mock') || !q.data?.enabled) return null;
  const email = q.data.email;

  const runLink = async (idToken?: string) => {
    if (link.isPending) return;
    try {
      await link.mutate(idToken);
      toast.success(t('profile.google.linkedToast'));
    } catch (e) {
      toast.error(loginErrorText(t, e, t('profile.google.failed')));
    }
  };

  const runUnlink = async () => {
    try {
      await unlink.mutate(undefined);
      toast.success(t('profile.google.unlinkedToast'));
    } catch (e) {
      toast.error(loginErrorText(t, e, t('profile.google.failed')));
      throw e;
    }
  };

  return (
    <Card padding="md" className="flex flex-col gap-3" data-f="F-00-032">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2">
          <GoogleMark />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="text-sm font-semibold text-fg">{t('profile.google.title')}</p>
          <p className="text-sm text-muted">{email ? t('profile.google.linkedText') : t('profile.google.text')}</p>
        </div>
      </div>
      {email ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="inline-flex min-w-0 items-center gap-1.5 text-sm font-medium text-success">
            <Check aria-hidden className="size-4 shrink-0" />
            <span className="min-w-0 truncate">{email}</span>
          </p>
          <Button variant="ghost" size="sm" onClick={() => setUnlinkOpen(true)}>
            {t('profile.google.unlink')}
          </Button>
        </div>
      ) : mode === 'gis' ? (
        <GisButton onCredential={(token) => void runLink(token)} busy={link.isPending} />
      ) : (
        <div className="flex flex-col gap-1.5">
          <Button variant="secondary" leftIcon={<GoogleMark />} loading={link.isPending} onClick={() => void runLink()}>
            {t('login.google.button')}
          </Button>
          <p className="text-xs text-muted">{t('profile.google.demoNote')}</p>
        </div>
      )}
      <ConfirmDialog
        open={unlinkOpen}
        onOpenChange={setUnlinkOpen}
        title={t('profile.google.unlinkTitle')}
        description={t('profile.google.unlinkText')}
        confirmLabel={t('profile.google.unlink')}
        onConfirm={runUnlink}
      />
    </Card>
  );
}
