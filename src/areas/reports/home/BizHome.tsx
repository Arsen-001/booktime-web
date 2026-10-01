'use client';

/**
 * Вход в кабинет `/biz`: у кого есть право отчётов — главная владельца, у остальных — журнал (F-01-204).
 * Мастера и администратора без отчётов сервер отправляет в журнал сразу (src/app/biz/page.tsx); здесь — запасной
 * путь, когда права пришли с сервера или владелец снял право (решает useCan, а не персона).
 */
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useCan, useCurrent } from '@/demo/hooks';
import { OwnerHomeScreen } from './OwnerHomeScreen';

export function BizHome() {
  const router = useRouter();
  const { ready } = useCurrent();
  const canView = useCan('reports.view');
  useEffect(() => {
    if (ready && !canView) router.replace('/biz/journal');
  }, [ready, canView, router]);
  return <OwnerHomeScreen />;
}
