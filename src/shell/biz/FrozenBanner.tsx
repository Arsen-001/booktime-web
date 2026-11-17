'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Lock } from 'lucide-react';
import { coreList, useCoreGet } from '@/api/core';
import { useLocale } from 'next-intl';
import { setFrozenBusiness } from '@/api/identity';
import { useApiQuery } from '@/api/request';
import { subscriptionWarnings } from '@/api/settings';
import { useCan, useCurrent } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { useHideDigitalPurchases } from '@/lib/native/useNativeApp';
import { pickText } from '@/lib/text';

/**
 * Подписка заморожена — полоса на всех страницах кабинета (проход 17.11.2026). Сервер в заморозке разрешает только
 * чтение (423 frozen на любую запись), а кабинет выглядел как обычно: запись «Записать» падала с «Не получилось.
 * Попробуйте ещё раз». Владельцу — «Продлить» (оплата в /biz/billing), мастеру и администратору — что делать: продлит
 * владелец. Заканчивающийся срок и пробный месяц — по-прежнему только на «Подписке» и хабе настроек (SubscriptionBanner).
 */
export function FrozenBanner() {
  const t = useT('common');
  const locale = useLocale();
  const { businessId, ready, locationId, locationIds, networkId } = useCurrent();
  // Сеть, «Все филиалы»: заморожен только этот филиал — остальные работают (не «весь кабинет только для просмотра»).
  // Владелец 17.11.2026 (DESIGN.md №9): «Филиал Нор-Норк заморожен» — названием филиала, как в переключателе
  // филиалов (имя локации), а не «Manana Beauty · Нор-Норк»; тот же запрос, что у переключателя
  const allBranches = locationId === 'all';
  const businessQ = useCoreGet('businesses', allBranches ? (businessId ?? '') : '', { enabled: allBranches && Boolean(businessId) });
  const locationsQ = useApiQuery(['core', 'locations', ...locationIds], () => coreList('locations', (l) => locationIds.includes(l.id)), {
    enabled: allBranches && ready && locationIds.length > 0,
  });
  const networkQ = useCoreGet('networks', allBranches ? (networkId ?? '') : '', { enabled: allBranches && Boolean(networkId) });
  // Филиалы сети называются «Manana Beauty · Нор-Норк» — в полосе только сам филиал: «Филиал Нор-Норк заморожен»
  const prefix = networkQ.data?.name ? `${networkQ.data.name} · ` : undefined;
  const nameOf = (bizId: string) => {
    const loc = locationsQ.data?.find((l) => l.businessId === bizId);
    const full = loc ? pickText(loc.name, locale) : bizId === businessId ? businessQ.data?.name : undefined;
    return full && prefix && full.startsWith(prefix) ? full.slice(prefix.length) : full;
  };
  // «Все филиалы»: заморозку видно у ЛЮБОГО филиала, а не только у главного (хвост 17.11) — подписка у каждого своя
  const branchIds = allBranches ? [...new Set((locationsQ.data ?? []).map((l) => l.businessId))].filter((id) => id !== businessId) : [];
  const branchesQ = useApiQuery(
    ['shell', 'billing-warnings-branches', ...branchIds],
    () => Promise.all(branchIds.map((id) => subscriptionWarnings(id).then((w) => (w.some((x) => x.messageKey === 'billing.warning.frozen') ? id : null)).catch(() => null))),
    { enabled: ready && branchIds.length > 0 },
  );
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
  const frozenBranches = [...(frozen ? [businessId!] : []), ...((branchesQ.data ?? []).filter((x): x is string => Boolean(x)))];
  if (!frozenBranches.length) return null;
  const names = frozenBranches.map(nameOf).filter((x): x is string => Boolean(x));
  const owner = canBilling && !hidePurchases;
  return (
    <div role="status" className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
      <Lock aria-hidden className="size-4 shrink-0" />
      <span className="min-w-0 flex-1">
        {allBranches && names.length > 1
          ? t('frozen.branches', { names: names.join(', ') })
          : allBranches && names.length === 1
            ? t('frozen.branch', { name: names[0] })
            : owner
              ? t('frozen.owner')
              : t('frozen.staff')}
      </span>
      {owner && (
        <Link href="/biz/billing" className="inline-flex min-h-9 items-center rounded-lg bg-danger px-3 font-semibold text-primary-contrast hover:opacity-90">
          {t('frozen.renew')}
        </Link>
      )}
    </div>
  );
}
