'use client';

/**
 * Карточка человека в нашей панели: профиль, роли, подключения, записи, входы. Действия — в меню «⋯» шапки
 * (как у карточки бизнеса): «Завершить все сессии» и «Заблокировать / Разблокировать» — с подтверждением.
 * Без права (reviewer команды) или на своём аккаунте меню нет, внизу — пояснение почему.
 */
import { useState } from 'react';
import { LogOut, MoreHorizontal, ShieldBan, ShieldCheck } from 'lucide-react';
import { revokePlatformUserSessions, setPlatformUserBlocked } from '@/api/platform/users';
import { ApiError, useApiMutation } from '@/api/request';
import { BlockUserDialog } from '@/areas/platform/users/BlockUserDialog';
import { BookingsBlock, LinksBlock, LoginsBlock, ProfileBlock, RolesBlock, StatusBanner, UserCardSkeleton } from '@/areas/platform/users/UserCardSections';
import { usePlatformUser, useUserActionsAccess } from '@/areas/platform/users/useUsers';
import type { PlatformUserRow } from '@/domain/platform/types/users';
import { useT } from '@/i18n/useT';
import { DropdownMenu, type DropdownMenuItem } from '@/ui/DropdownMenu';
import { ErrorState } from '@/ui/ErrorState';
import { IconButton } from '@/ui/IconButton';
import { Sheet } from '@/ui/Sheet';
import { useConfirm, useToast } from '@/ui/Toast';

export function UserSheet({ row, onClose }: { row: PlatformUserRow; onClose: () => void }) {
  const t = useT('platform');
  const toast = useToast();
  const confirm = useConfirm();
  const q = usePlatformUser(row.id);
  const { canManage, selfId } = useUserActionsAccess();
  const [blocking, setBlocking] = useState(false);
  const unblock = useApiMutation((id: string) => setPlatformUserBlocked(id, false));
  const revoke = useApiMutation((id: string) => revokePlatformUserSessions(id));
  const card = q.data;
  const name = card?.name ?? row.name;
  const status = card?.status ?? row.status;
  const isSelf = selfId === row.id;
  const fail = (e: unknown) => toast.error(e instanceof ApiError && e.code === 'forbidden' ? t('users.forbidden') : t('users.actionFailed'));

  const doUnblock = async () => {
    const ok = await confirm({ title: t('users.unblock.title', { name }), description: t('users.unblock.text'), confirmLabel: t('users.unblock.confirm'), tone: 'primary' });
    if (!ok) return;
    try {
      await unblock.mutate(row.id);
      toast.success(t('users.unblock.done', { name }));
    } catch (e) {
      fail(e);
    }
  };
  const doRevoke = async () => {
    const ok = await confirm({ title: t('users.revoke.title', { name }), description: t('users.revoke.text'), confirmLabel: t('users.revoke.confirm'), tone: 'danger' });
    if (!ok) return;
    try {
      const res = await revoke.mutate(row.id);
      toast.success(t('users.revoke.done', { n: res.revoked }));
    } catch (e) {
      fail(e);
    }
  };

  const actionable = canManage && !isSelf && status !== 'deleted';
  const menu: DropdownMenuItem[] = actionable
    ? [
        { id: 'revoke', label: t('users.actions.revoke'), icon: <LogOut aria-hidden />, disabled: status === 'blocked', onSelect: () => void doRevoke() },
        status === 'blocked'
          ? { id: 'unblock', label: t('users.actions.unblock'), icon: <ShieldCheck aria-hidden />, onSelect: () => void doUnblock() }
          : { id: 'block', label: t('users.actions.block'), icon: <ShieldBan aria-hidden />, danger: true, onSelect: () => setBlocking(true) },
      ]
    : [];

  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      title={name}
      description={row.phoneMasked ?? undefined}
      size="md"
      headerActions={
        menu.length ? <DropdownMenu label={t('users.card.more')} trigger={(p) => <IconButton {...p} icon={<MoreHorizontal />} label={t('users.card.more')} size="sm" />} items={menu} /> : undefined
      }
    >
      <div className="flex flex-col gap-6">
        {q.isError ? (
          <ErrorState title={t('users.card.loadFailed')} onRetry={q.refetch} compact />
        ) : !card ? (
          <UserCardSkeleton />
        ) : (
          <>
            <StatusBanner card={card} />
            <ProfileBlock card={card} />
            <RolesBlock card={card} />
            <LinksBlock card={card} />
            <BookingsBlock card={card} />
            <LoginsBlock card={card} />
            {!actionable && status !== 'deleted' && <p className="text-sm text-muted">{isSelf ? t('users.actions.self') : t('users.actions.onlyAdmin')}</p>}
          </>
        )}
      </div>
      <BlockUserDialog userId={row.id} name={name} open={blocking} onOpenChange={setBlocking} />
    </Sheet>
  );
}
