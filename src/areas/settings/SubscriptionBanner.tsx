'use client';

/**
 * Полоса предупреждений о подписке (F-15-064, F-15-058, F-00-023, F-15-092): «бесплатный месяц/подписка
 * заканчивается через N дней» или «заморожено» — тон растёт от жёлтого к красному, когда до конца лицензии
 * остаётся 1 день (наше решение: предупреждать за 7, 3 и 1 день). Нужна на ВСЕХ страницах кабинета —
 * фундаментальный слот ещё не готов (qa/requests/settings.md, b01 §2), поэтому пока подключена только на
 * наших маршрутах (/biz/billing, /biz/coins) через их layout.tsx. Другие разделы получают те же данные
 * напрямую из subscriptionWarnings().
 */
import Link from 'next/link';
import { AlertTriangle, Gift } from 'lucide-react';
import { getSubscription, INTRO_TRIAL_DAYS } from '@/api/settings';
import { useApiQuery } from '@/api/request';
import { useCan, useCurrent } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { useHideDigitalPurchases } from '@/lib/native/useNativeApp';
import { Skeleton, SkeletonText } from '@/ui/Skeleton';
import { useSkeletonCount } from '@/ui/hooks/useSkeletonCount';

export function SubscriptionBanner() {
  const t = useT('settings');
  const { businessId, ready } = useCurrent();
  // Полоса ведёт на /biz/billing — без billing.manage там «Нет прав» (F-15-069); мастеру и администратору её не
  // показываем (QA 30.09: мастер видел «Осталось 3 дня — продлите» на хабе настроек и быстром старте)
  const canBilling = useCan('billing.manage');
  // «Продлите» — призыв оплатить; в приложениях iOS/Android оплаты нет (App Store 3.1.1) — полосы тоже нет
  const hidePurchases = useHideDigitalPurchases();
  const q = useApiQuery(
    ['settings', 'subscription', businessId],
    () => getSubscription(businessId ?? ''),
    { enabled: ready && Boolean(businessId) && canBilling },
  );

  const loading = !ready || q.isLoading;
  const shows = (status: string) => status === 'frozen' || status === 'endingSoon' || status === 'freeMonth' || status === 'trial';
  // Полоса была в прошлый раз (у демо-салона срок скоро кончается) — до ответа на её месте та же полоса с полосой
  // текста: пришли данные — ничего не сдвинулось (DESIGN.md «The skeleton IS the page»)
  const remembered = useSkeletonCount('subscription-banner', { loading, count: q.data ? Number(shows(q.data.status)) : undefined, fallback: 1 });
  if (!canBilling || hidePurchases) return null;
  if (loading) {
    if (!remembered) return null;
    return (
      <div aria-busy className="flex items-center gap-2 rounded-lg bg-surface-2 px-4 py-2.5 text-sm text-muted">
        <AlertTriangle aria-hidden className="size-4 shrink-0" />
        {/* Текст полосы на телефоне — в две строки, шире — в одну */}
        <span className="flex-1">
          <Skeleton lines={2} className="sm:hidden" />
          <SkeletonText width="48ch" className="max-sm:hidden" />
        </span>
      </div>
    );
  }
  if (q.isError || !q.data) return null;
  const sub = q.data;
  if (!shows(sub.status)) return null;

  const tone =
    sub.status === 'frozen'
      ? 'danger'
      : sub.status === 'endingSoon'
        ? sub.daysLeft <= 1
          ? 'danger'
          : 'warning'
        : 'primary';

  return (
    <Link
      href="/biz/billing"
      data-f="F-15-064 F-00-023 F-15-092"
      className={cn(
        'flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm transition-colors',
        tone === 'danger' && 'bg-danger-soft text-danger hover:bg-danger-soft/80',
        tone === 'warning' && 'bg-warning-soft text-warning hover:bg-warning-soft/80',
        tone === 'primary' && 'bg-primary-soft text-primary-text hover:bg-primary-soft/80',
      )}
    >
      {tone === 'primary' ? (
        <Gift aria-hidden className="size-4 shrink-0" />
      ) : (
        <AlertTriangle aria-hidden className="size-4 shrink-0" />
      )}
      <span className="flex-1">
        {sub.status === 'frozen'
          ? t('billing.frozenHint')
          : sub.status === 'endingSoon'
            ? t('billing.endingSoonHint', { days: Math.max(sub.daysLeft, 0) })
            : sub.status === 'trial'
              ? t('billing.trialLeft', { days: Math.max(sub.daysLeft, 0), total: INTRO_TRIAL_DAYS })
              : t('billing.freeMonthLeft', { days: Math.max(sub.daysLeft, 0) })}
      </span>
    </Link>
  );
}
