'use client';

/**
 * Продвижение (b05): скидка на горящее окно (F-00-103) и черновик «выше в поиске» / «место на главной»
 * за монеты (F-00-167 — решения по деталям нет, строим по описанию).
 */
import { useState } from 'react';
import { ArrowUp, Flame, Home } from 'lucide-react';
import { BOOST_DAYS, BOOST_PRICE, getCoinBalance, getPromotionSettings, purchaseBoost, setHotSlotDiscount } from '@/api/client';
import { ApiError, useApiMutation, useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import { useClientFormat } from '@/areas/client/useClientFormat';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';
import { SkeletonText } from '@/ui/Skeleton';
import { Switch } from '@/ui/Switch';
import { useToast } from '@/ui/Toast';

const DISCOUNT_OPTIONS = [10, 15, 20, 25];

export function PromotionScreen() {
  const t = useT('client');
  const fmt = useClientFormat();
  const toast = useToast();
  const { ready, businessId } = useCurrent();

  const settingsQ = useApiQuery(['promotion', businessId], () => getPromotionSettings(businessId!), {
    enabled: ready && Boolean(businessId),
  });
  const balanceQ = useApiQuery(['coins', businessId], () => getCoinBalance(businessId!), { enabled: ready && Boolean(businessId) });
  const setDiscount = useApiMutation((percent: number | undefined) => setHotSlotDiscount(businessId!, percent));
  const boost = useApiMutation((kind: 'search' | 'home') => purchaseBoost(businessId!, kind));
  const [pendingKind, setPendingKind] = useState<'search' | 'home' | undefined>();

  const handleToggleDiscount = async (percent: number | undefined) => {
    try {
      await setDiscount.mutate(percent);
      toast.success(t('apps.promotion.saved'));
      void settingsQ.refetch();
    } catch {
      toast.error(t('apps.promotion.saveFailed'));
    }
  };

  const handleBoost = async (kind: 'search' | 'home') => {
    setPendingKind(kind);
    try {
      await boost.mutate(kind);
      toast.success(t('apps.promotion.boosted'));
      void settingsQ.refetch();
      void balanceQ.refetch();
    } catch (e) {
      toast.error(e instanceof ApiError && e.code === 'not_enough_coins' ? t('apps.promotion.notEnoughCoins') : t('apps.promotion.boostFailed'));
    } finally {
      setPendingKind(undefined);
    }
  };

  // До данных — та же страница: заголовки и подсказки известны, переключатель и кнопки выключены
  const loading = settingsQ.isLoading || !ready;
  const discount = settingsQ.data?.hotSlotDiscountPercent;
  const boostSearch = settingsQ.data?.boostSearch;
  const boostHome = settingsQ.data?.boostHome;
  const now = new Date().toISOString();

  return (
    <div aria-busy={loading || undefined} className="flex flex-col gap-6">
      <PageHeader title={t('apps.promotion.title')} description={t('apps.promotion.subtitle')} />

      <div data-f="F-00-103">
        <SectionCard title={t('apps.promotion.hotSlotTitle')} description={t('apps.promotion.hotSlotHint')}>
          <div className="flex flex-col gap-3">
            <Switch
              checked={discount !== undefined}
              disabled={loading}
              // До данных бегунок скрыт: положение узнаем с данными
              classNames={loading ? { track: 'bg-border [&>span]:hidden' } : undefined}
              onCheckedChange={(checked) => void handleToggleDiscount(checked ? DISCOUNT_OPTIONS[0] : undefined)}
              label={t('apps.promotion.hotSlotSwitch')}
            />
            {/* До данных ряд процентов на месте (выключен): у демо-бизнеса скидка включена */}
            {(discount !== undefined || loading) && (
              <div className="flex flex-wrap gap-2">
                {DISCOUNT_OPTIONS.map((p) => (
                  <Button key={p} size="sm" disabled={loading} variant={discount === p ? 'primary' : 'secondary'} onClick={() => void handleToggleDiscount(p)}>
                    {p}%
                  </Button>
                ))}
              </div>
            )}
          </div>
        </SectionCard>
      </div>

      <div data-f="F-00-167" className="grid gap-4 sm:grid-cols-2">
        <SectionCard
          title={t('apps.promotion.boostSearchTitle')}
          description={t('apps.promotion.boostHint', { days: BOOST_DAYS, price: BOOST_PRICE.search })}
        >
          {boostSearch?.active && boostSearch.expiresAt > now ? (
            <Badge tone="success" variant="soft" icon={<ArrowUp aria-hidden />}>
              {t('apps.promotion.activeUntil', { date: fmt.date(boostSearch.expiresAt) })}
            </Badge>
          ) : (
            <Button size="sm" disabled={loading} onClick={() => void handleBoost('search')} loading={boost.isPending && pendingKind === 'search'}>
              {t('apps.promotion.buy', { price: BOOST_PRICE.search })}
            </Button>
          )}
        </SectionCard>
        <SectionCard
          title={t('apps.promotion.boostHomeTitle')}
          description={t('apps.promotion.boostHint', { days: BOOST_DAYS, price: BOOST_PRICE.home })}
        >
          {boostHome?.active && boostHome.expiresAt > now ? (
            <Badge tone="success" variant="soft" icon={<Home aria-hidden />}>
              {t('apps.promotion.activeUntil', { date: fmt.date(boostHome.expiresAt) })}
            </Badge>
          ) : (
            <Button size="sm" disabled={loading} onClick={() => void handleBoost('home')} loading={boost.isPending && pendingKind === 'home'}>
              {t('apps.promotion.buy', { price: BOOST_PRICE.home })}
            </Button>
          )}
        </SectionCard>
      </div>

      <p className="flex items-center gap-2 text-sm text-muted">
        <Flame aria-hidden className="size-4 text-warning" />
        {balanceQ.data === undefined && balanceQ.isLoading ? (
          <SkeletonText width="24ch" />
        ) : (
          t('apps.promotion.balanceHint', { amount: balanceQ.data ?? 0 })
        )}
      </p>
    </div>
  );
}
