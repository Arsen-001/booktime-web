'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight, Clock, LogOut, Pencil, Trash2, User } from 'lucide-react';
import { deleteMyClientAccount, getClientProfile, setProfilePhoto, setTimeFormat, updateProfileName } from '@/api/client';
import { HttpApiError, isApiMode } from '@/api/http';
import { useApiMutation, useApiQuery } from '@/api/request';
import { SESSION_KEY, cancelMyAccountDeletion, getAccount, logout, setSessionMode } from '@/api/session';
import { useApplyDemo, useDemo } from '@/demo/hooks';
import { GoogleAccountCard } from '@/areas/client/profile/GoogleAccountCard';
import { TelegramRemindersCard } from '@/areas/client/profile/TelegramRemindersCard';
import { InviteFriendsEntry } from '@/areas/client/referral/InviteFriendsEntry';
import { useClientSession } from '@/areas/client/ui/useClientSession';
import type { Id } from '@/domain/core';
import type { TimeFormat } from '@/domain/client';
import { CLIENT_LOCALES, type Locale } from '@/i18n/config';
import { useClientFormat } from '@/areas/client/useClientFormat';
import { useT } from '@/i18n/useT';
import { useExtensions } from '@/extensions/useExtensions';
import { ExtensionSlot } from '@/extensions/ExtensionSlot';
import { Badge } from '@/ui/Badge';
import { Button, LinkButton } from '@/ui/Button';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { Card } from '@/ui/Card';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { IconButton } from '@/ui/IconButton';
import { ImageUpload } from '@/ui/ImageUpload';
import { Modal } from '@/ui/Modal';
import { Input } from '@/ui/Input';
import { FormField } from '@/ui/FormField';
import { PageHeader } from '@/ui/PageHeader';
import { ReplayHintsButton } from '@/ui/onboarding/ReplayHintsButton';
import { SectionCard } from '@/ui/SectionCard';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { SkeletonText } from '@/ui/Skeleton';
import { Switch } from '@/ui/Switch';
import { useToast } from '@/ui/Toast';

const LANG_LABEL: Record<Locale, string> = { ru: 'Русский', hy: 'Հայերեն', en: 'English' };

/** Профиль клиента (F-14-059…062, F-00-124) */
export function ProfileScreen() {
  const t = useT('client');
  const { appUserId, signedIn } = useClientSession();
  const apply = useApplyDemo();
  const router = useRouter();
  const signOut = useApiMutation(logout, { invalidates: [SESSION_KEY] });

  // Гость — сразу приглашение; вошедший — страница с первого кадра (имя и телефон — полосами, пока нет данных)
  if (!signedIn) {
    return (
      <EmptyState
        icon={<User aria-hidden className="size-8 text-muted" />}
        title={t('profile.needLoginTitle')}
        description={t('profile.needLoginHint')}
        action={
          <LinkButton href="/login?next=/profile">{t('profile.goLogin')}</LinkButton>
        }
      />
    );
  }

  const handleLogout = async () => {
    // Живой сайт: сессия закрывается на сервере (cookie снимается); демо — просто персона «гость»
    if (isApiMode()) await signOut.mutate(undefined).catch(() => undefined);
    apply({ persona: 'guest', appUser: '' });
    router.push('/');
  };

  return <ProfileBody appUserId={appUserId} onLogout={() => void handleLogout()} />;
}

function ProfileBody({ appUserId, onLogout }: { appUserId: Id | undefined; onLogout: () => void }) {
  const t = useT('client');
  const fmt = useClientFormat();
  const toast = useToast();
  const settings = useDemo();
  const apply = useApplyDemo();
  const router = useRouter();
  const [nameOpen, setNameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const removeAccount = useApiMutation((id: Id) => deleteMyClientAccount(id));
  const uid = appUserId ?? '';
  // Живой сайт: сервер удаляет аккаунт через 25 дней после запроса, до того — «Отменить удаление» (POST /v1/me/account/delete/cancel)
  const accountQ = useApiQuery(['me', 'account'], getAccount, { enabled: isApiMode() });
  const cancelDeletion = useApiMutation(() => cancelMyAccountDeletion(), { invalidates: [['me', 'account']] });
  const deletionAt = accountQ.data?.deletionAt ?? null;

  // Один вход и переключатель «Я клиент / Мой бизнес» (В-21, C1): на живом сайте — режим сессии на сервере;
  // бизнеса у человека нет — ведём на регистрацию бизнеса. Демо — переключение на бизнес-персону.
  const switchMode = useApiMutation(() => setSessionMode('business'), { invalidates: [SESSION_KEY] });
  const switchToBusiness = async () => {
    if (isApiMode()) {
      try {
        await switchMode.mutate(undefined);
      } catch (e) {
        if (e instanceof HttpApiError && e.code === 'no_business') {
          router.push('/register-business');
          return;
        }
        toast.error(t('profile.actionFailed'));
        return;
      }
      router.push('/biz');
      return;
    }
    apply({ persona: 'owner' });
    router.push('/biz');
  };
  const extEntries = useExtensions('clientProfile');
  const q = useApiQuery(['client-profile', uid], () => getClientProfile(uid), { enabled: Boolean(appUserId) });
  const setFormat = useApiMutation((f: TimeFormat) => setTimeFormat(uid, f));

  if (q.isError) return <ErrorState onRetry={q.refetch} />;
  // До данных — та же страница: фото-поле, имя и телефон полосами, настройки настоящие (выключены)
  const loading = !q.data;
  const appUser = q.data?.appUser;
  const photoUrl = q.data?.photoUrl;
  const timeFormat = q.data?.timeFormat;
  const noShowCount = q.data?.noShowCount ?? 0;

  const handlePhoto = async (urls: string[]) => {
    if (!appUserId) return;
    try {
      await setProfilePhoto(uid, urls[0]);
      void q.refetch();
    } catch {
      toast.error(t('profile.actionFailed'));
    }
  };

  // В-34: удаление аккаунта клиентом — профиль, избранное и дневник стираются, записи у мастеров остаются без связи.
  // Живой сайт: запрос на удаление через 25 дней — остаёмся в профиле, видно дату и «Отменить удаление».
  // Демо (данные в браузере): стирается сразу.
  const handleDelete = async () => {
    try {
      await removeAccount.mutate(uid);
      if (isApiMode()) {
        const at = (await getAccount().catch(() => null))?.deletionAt;
        void accountQ.refetch();
        toast.success(at ? t('profile.deleteScheduled', { date: fmt.date(at) }) : t('profile.deleteRequested'));
        return;
      }
      toast.success(t('profile.deleteDone'));
      onLogout();
    } catch {
      toast.error(t('profile.actionFailed'));
    }
  };

  const handleCancelDeletion = async () => {
    try {
      await cancelDeletion.mutate(undefined);
      toast.success(t('profile.deleteCanceled'));
    } catch {
      toast.error(t('profile.actionFailed'));
    }
  };

  const handleFormat = async (value: string) => {
    try {
      await setFormat.mutate(value as TimeFormat);
      void q.refetch();
    } catch {
      toast.error(t('profile.actionFailed'));
    }
  };

  return (
    <div data-f="F-14-059" aria-busy={loading || undefined} className="flex flex-col gap-5 pb-6">
      <PageHeader title={t('profile.title')} />

      {deletionAt && (
        <Card data-f="F-14-062" padding="md" className="flex flex-col gap-3 border-danger/40 bg-danger-soft">
          <div className="flex items-start gap-3">
            <Clock aria-hidden className="mt-0.5 size-5 shrink-0 text-danger" />
            <div className="flex flex-col gap-1">
              <p className="font-medium text-fg">{t('profile.deletePendingTitle', { date: fmt.date(deletionAt) })}</p>
              <p className="text-sm text-muted">{t('profile.deletePendingText')}</p>
            </div>
          </div>
          <Button variant="outline" className="self-start" loading={cancelDeletion.isPending} onClick={() => void handleCancelDeletion()}>
            {t('profile.deleteCancel')}
          </Button>
        </Card>
      )}

      <Card padding="md" className="flex items-center gap-4">
        <div className="w-20 shrink-0">
          <ImageUpload
            value={photoUrl ? [photoUrl] : []}
            onValueChange={(v) => void handlePhoto(v)}
            max={1}
            aspect="square"
            label={t('profile.photoCta')}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-lg font-semibold text-fg">{appUser ? appUser.name : <SkeletonText width="12ch" />}</p>
            <IconButton
              disabled={loading}
              icon={<Pencil aria-hidden className="size-4" />}
              label={t('profile.editName')}
              variant="ghost"
              size="sm"
              onClick={() => setNameOpen(true)}
            />
          </div>
          <p className="text-sm text-muted">{appUser ? fmt.phone(appUser.phone) : <SkeletonText width="16ch" />}</p>
          {noShowCount > 0 && (
            <Badge tone="warning" className="mt-1.5">
              {t('profile.noShowCount', { count: noShowCount })}
            </Badge>
          )}
        </div>
      </Card>

      <SectionCard title={t('profile.settingsTitle')}>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-fg">{t('profile.languageLabel')}</span>
            <SegmentedControl
              fullWidth
              value={settings.lang}
              onValueChange={(v) => apply({ lang: v as Locale })}
              options={CLIENT_LOCALES.map((l) => ({ value: l, label: LANG_LABEL[l] }))}
            />
          </div>

          <div data-f="F-14-061" className="flex flex-col gap-2">
            <span className="text-sm font-medium text-fg">{t('profile.timeFormatLabel')}</span>
            <SegmentedControl
              fullWidth
              value={timeFormat ?? '24'}
              onValueChange={(v) => void handleFormat(v)}
              options={[
                { value: '24', label: t('profile.timeFormat24') },
                { value: '12', label: t('profile.timeFormat12') },
              ]}
            />
          </div>

          <div data-f="F-00-124">
            <Switch
              checked={settings.font === 'large'}
              onCheckedChange={(checked) => apply({ font: checked ? 'large' : 'normal' })}
              label={t('profile.largeFontLabel')}
              description={t('profile.largeFontHint')}
              labelPosition="start"
              classNames={{ root: 'w-full flex-row justify-between' }}
            />
          </div>

          <Link
            href="/profile/notifications"
            className="flex min-h-11 items-center justify-between rounded-lg px-1 text-sm font-medium text-fg hover:bg-surface-2"
          >
            {t('profile.notificationsLink')}
            <ChevronRight aria-hidden className="size-4 text-muted" />
          </Link>

          <Link
            href="/memberships"
            data-f="F-14-037"
            className="flex min-h-11 items-center justify-between rounded-lg px-1 text-sm font-medium text-fg hover:bg-surface-2"
          >
            {t('profile.membershipsLink')}
            <ChevronRight aria-hidden className="size-4 text-muted" />
          </Link>

          <Link
            href="/certificates"
            data-f="F-14-040"
            className="flex min-h-11 items-center justify-between rounded-lg px-1 text-sm font-medium text-fg hover:bg-surface-2"
          >
            {t('profile.certificatesLink')}
            <ChevronRight aria-hidden className="size-4 text-muted" />
          </Link>

          <Link
            href="/loyalty-cards"
            data-f="F-14-054"
            className="flex min-h-11 items-center justify-between rounded-lg px-1 text-sm font-medium text-fg hover:bg-surface-2"
          >
            {t('profile.loyaltyCardsLink')}
            <ChevronRight aria-hidden className="size-4 text-muted" />
          </Link>

          {/* Помощь: частые вопросы, связь с нами, документы (/support — Support URL приложений, 05.10.2026) */}
          <Link
            href="/support"
            data-f="F-00-182"
            className="flex min-h-11 items-center justify-between rounded-lg px-1 text-sm font-medium text-fg hover:bg-surface-2"
          >
            {t('profile.supportLink')}
            <ChevronRight aria-hidden className="size-4 text-muted" />
          </Link>

          <ReplayHintsButton variant="ghost" size="sm" className="w-fit" doneMessage={t('profile.hintsReset')}>
            {t('profile.replayHints')}
          </ReplayHintsButton>
        </div>
      </SectionCard>

      {appUserId && <InviteFriendsEntry appUserId={appUserId} />}

      {appUserId && <TelegramRemindersCard appUserId={appUserId} />}

      {appUserId && <GoogleAccountCard appUserId={appUserId} />}

      {appUserId && extEntries.map((entry) => (
        <ExtensionSlot key={entry.area} entry={entry} props={{ appUserId }} />
      ))}

      <div data-f="F-00-036">
        <Button variant="outline" fullWidth onClick={() => void switchToBusiness()}>
          {t('profile.myBusinessLink')}
        </Button>
        <p className="mt-1.5 text-center text-xs text-muted">{t('profile.myBusinessHint')}</p>
      </div>

      <Button data-f="F-14-062" variant="outline" className="text-danger" leftIcon={<LogOut aria-hidden />} onClick={onLogout}>
        {t('profile.logout')}
      </Button>

      {!deletionAt && (
        <div data-f="F-14-062" className="flex flex-col items-center gap-1 pt-2">
          <Button variant="ghost" className="text-danger hover:bg-danger-soft" leftIcon={<Trash2 aria-hidden />} onClick={() => setDeleteOpen(true)}>
            {t('profile.deleteAccount')}
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        tone="danger"
        title={t('profile.deleteTitle')}
        description={t('profile.deleteText')}
        confirmLabel={t('profile.deleteConfirm')}
        cancelLabel={t('profile.deleteKeep')}
        onConfirm={handleDelete}
      />

      {appUserId && appUser && (
        <NameModal open={nameOpen} onOpenChange={setNameOpen} appUserId={appUserId} initialName={appUser.name} onSaved={() => void q.refetch()} />
      )}
    </div>
  );
}

function NameModal({
  open,
  onOpenChange,
  appUserId,
  initialName,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appUserId: Id;
  initialName: string;
  onSaved: () => void;
}) {
  const t = useT('client');
  const tc = useT('common');
  const toast = useToast();
  const [name, setName] = useState(initialName);
  const submit = useApiMutation((n: string) => updateProfileName(appUserId, n));

  const handleSubmit = async () => {
    if (!name.trim()) return;
    try {
      await submit.mutate(name.trim());
      toast.success(t('profile.nameSaved'));
      onOpenChange(false);
      onSaved();
    } catch {
      toast.error(t('profile.actionFailed'));
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (v) setName(initialName);
      }}
      title={t('profile.editName')}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tc('actions.cancel')}
          </Button>
          <Button onClick={() => void handleSubmit()} loading={submit.isPending} disabled={!name.trim()}>
            {tc('actions.save')}
          </Button>
        </>
      }
    >
      <FormField label={t('profile.nameLabel')} required>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </FormField>
    </Modal>
  );
}
