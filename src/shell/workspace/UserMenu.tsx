'use client';

import { ArrowLeftRight, LogOut, Smartphone, UserRound } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { coreGet } from '@/api/core';
import { isApiMode } from '@/api/http';
import { useApiMutation, useApiQuery } from '@/api/request';
import { PLATFORM_SESSION_KEY, SESSION_KEY, logout, platformLogout, setSessionMode } from '@/api/session';
import { useApplyDemo, useCurrent, useDemo } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { Avatar } from '@/ui/Avatar';
import { DropdownChevron } from '@/ui/DropdownChevron';
import { DropdownMenu, type DropdownMenuItem } from '@/ui/DropdownMenu';
import { Skeleton, SkeletonText } from '@/ui/Skeleton';

/** Меню пользователя в верхней полосе: кто я, переход в приложение клиента, выход */
export function UserMenu({ kind }: { kind: 'biz' | 'platform' }) {
  const t = useT('common');
  const router = useRouter();
  const apply = useApplyDemo();
  const { persona } = useDemo();
  const { staffId } = useCurrent();
  // Через api, а не из стора напрямую (arch-a1 S5)
  const { data: staff, isLoading: staffQueryLoading } = useApiQuery(['core', 'staff', staffId], () => coreGet('staff', staffId!), {
    enabled: Boolean(staffId),
  });
  const staffLoading = kind === 'biz' && (staffQueryLoading || (Boolean(staffId) && !staff));
  // Живой сайт: выход и «в приложение клиента» — через сессию сервера (PLAN.md §8.2); демо — только персона
  const signOut = useApiMutation(() => (kind === 'platform' ? platformLogout() : logout()), {
    invalidates: [kind === 'platform' ? PLATFORM_SESSION_KEY : SESSION_KEY],
  });
  const toClient = useApiMutation(() => setSessionMode('client'), { invalidates: [SESSION_KEY] });
  const name = kind === 'platform' ? t('demo.personas.platform') : (staff?.name ?? t(`demo.personas.${persona}`));

  const items: DropdownMenuItem[] = [
    {
      id: 'who',
      groupLabel: (
        <span className="flex flex-col">
          <span className="font-semibold text-fg">{name}</span>
          <span className="text-xs text-muted">{t(`demo.personas.${persona}`)}</span>
        </span>
      ),
    },
    ...(kind === 'biz' && staffId
      ? [{ id: 'profile', label: t('shell.myProfile'), icon: <UserRound />, href: `/biz/staff/${staffId}` }]
      : []),
    {
      id: 'client',
      label: t('shell.toClientApp'),
      icon: <Smartphone />,
      href: '/',
      onSelect: () => {
        // Вход логином администратора — только кабинет: сервер ответит forbidden, клиентская часть откроется гостем
        if (isApiMode() && kind === 'biz') void toClient.mutate(undefined).catch(() => undefined);
      },
    },
    ...(kind === 'platform'
      ? [{ id: 'biz', label: t('shell.toBizCabinet'), icon: <ArrowLeftRight />, href: '/biz' }]
      : []),
    { id: 'sep', separator: true },
    {
      id: 'logout',
      label: <span data-f="F-10-157">{t('actions.logout')}</span>,
      icon: <LogOut />,
      onSelect: () => {
        const done = () => {
          apply({ persona: 'guest' });
          router.push(kind === 'platform' && isApiMode() ? '/platform/login' : '/');
        };
        if (isApiMode()) void signOut.mutate(undefined).finally(done);
        else done();
      },
    },
  ];

  return (
    <DropdownMenu
      align="end"
      label={t('shell.userMenu')}
      items={items}
      trigger={(props) => (
        <button
          {...props}
          type="button"
          aria-label={staffLoading ? t('shell.userMenu') : `${t('shell.userMenu')}: ${name}`}
          className="flex min-h-11 items-center gap-2 rounded-xl px-1.5 hover:bg-surface-2 lg:pr-3"
        >
          {/* Пока сотрудник читается — серый кружок и полоса вместо «Владелец салона», который потом сменился бы
              именем: имя в полосе постоянной ширины, колокольчик и поиск слева не сдвигаются.
              Уже 1024px (планшет) — только аватар: место отдаём поиску; имя — в подписи кнопки и в шапке меню */}
          {staffLoading ? (
            <Skeleton variant="circle" className="size-8" />
          ) : (
            <Avatar name={name} size="sm" colorIndex={staff?.colorIndex} />
          )}
          <span className="hidden w-36 truncate text-left text-sm font-medium text-fg lg:inline">
            {staffLoading ? <SkeletonText width="80%" /> : name}
          </span>
          <DropdownChevron open={props['aria-expanded']} className="hidden lg:block" />
        </button>
      )}
    />
  );
}
