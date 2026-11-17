'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Lock } from 'lucide-react';
import { useCoreGet } from '@/api/core';
import { setFrozenBusiness } from '@/api/identity';
import { useApiQuery } from '@/api/request';
import { subscriptionWarnings } from '@/api/settings';
import { useCan, useCurrent } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { useHideDigitalPurchases } from '@/lib/native/useNativeApp';

/**
 * Подписка заморожена — полоса на всех страницах кабинета (проход 17.11.2026). Сервер в заморозке разрешает только
 * чтение (423 frozen на любую запись), а кабинет выглядел как обычно: запись «Записать» падала с «Не получилось.
 * Попробуйте ещё раз». Владельцу — «Продлить» (оплата в /biz/billing), мастеру и администратору — что делать: продлит
 * владелец. Заканчивающийся срок и пробный месяц — по-прежнему только на «Подписке» и хабе настроек (SubscriptionBanner).
 */
export function FrozenBanner() {
  const t = useT('common');
  const { businessId, ready, locationId } = useCurrent();
  // Сеть, «Все филиалы»: заморожен только этот филиал — остальные работают (не «весь кабинет только для просмотра»)
  const allBranches = locationId === 'all';
  const businessQ = useCoreGet('businesses', allBranches ? (businessId ?? '') : '', { enabled: allBranches && Boolean(businessId) });
  const canBilling = useCan('billing.manage');
  const hidePurchases = useHideDigitalPurchases();
  const q = useApiQuery(['shell', 'billing-warnings', businessId], () => subscriptionWarnings(businessId!), {
    enabled: ready && Boolean(businessId),
  });
  const frozen = q.data?.some((w) => w.messageKey === 'billing.warning.frozen');
  // Кабинет «только просмотр» для всех экранов (usePermissions, useReadOnly): кнопки изменений неактивны или скрыты
  useEffect(() => {
    if (businessId && q.data) setFrozenBusiness(businessId, Boolean(frozen));
  }, [businessId, q.data, frozen]);
  if (!frozen) return null;
  const owner = canBilling && !hidePurchases;
  return (
    <div role="status" className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
      <Lock aria-hidden className="size-4 shrink-0" />
      <span className="min-w-0 flex-1">
        {allBranches && businessQ.data ? t('frozen.branch', { name: businessQ.data.name }) : owner ? t('frozen.owner') : t('frozen.staff')}
      </span>
      {owner && (
        <Link href="/biz/billing" className="inline-flex min-h-9 items-center rounded-lg bg-danger px-3 font-semibold text-primary-contrast hover:opacity-90">
          {t('frozen.renew')}
        </Link>
      )}
    </div>
  );
}
