'use client';

/**
 * /biz/coins — «Монеты» (F-00-026/027, F-15-094): баланс, покупка пакета (Sheet, мок-оплата), на что тратятся,
 * история движений. Баланс и журнал считает ЯДРО (getCoinBalance/listCoinMoves, '@/api/core') — не наш срез.
 * SMS/WhatsApp баланса нет (⭐ Снято 11) — этот экран его полностью заменяет.
 * Сервер без платёжного провайдера (06.10.2026) — в окне покупки вместо «Оплатить» плашка «Оплата картой скоро —
 * напишите нам» (PaymentsSoonNotice), пакеты видны для справки.
 */
import { useState } from 'react';
import { Camera, Coins, Sparkles } from 'lucide-react';
import { getCoinBalance, listCoinMoves } from '@/api/core';
import { cardPaymentsAvailable, getSubscription, isPaymentsUnavailable, listCoinPackages, purchaseCoinPackage } from '@/api/settings';
import { PaymentsSoonNotice } from '@/areas/settings/PaymentsSoonNotice';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { ChoiceCard } from '@/ui/ChoiceCard';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';
import { Sheet } from '@/ui/Sheet';
import { SkeletonText } from '@/ui/Skeleton';
import { useSkeletonCount } from '@/ui/hooks/useSkeletonCount';
import { usePagedList } from '@/ui/Pagination';
import { StatCard } from '@/ui/StatCard';
import { useToast } from '@/ui/Toast';

/** Сколько движений монет обычно в демо — столько строк у скелетона истории */
const TYPICAL_MOVES = 0;

const SPEND_REASON_ICON = { storyPlace: Sparkles, newsExtra: Camera } as const;

export function CoinsScreen() {
  const t = useT('settings');
  const format = useFormat();
  const toast = useToast();
  const { businessId, ready } = useCurrent();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);

  const balanceQ = useApiQuery(['coins', 'balance', businessId], () => getCoinBalance(businessId ?? ''), { enabled: ready && Boolean(businessId) });
  const movesQ = useApiQuery(['coins', 'moves', businessId], () => listCoinMoves({ businessId: businessId ?? '' }), { enabled: ready && Boolean(businessId) });
  const packagesQ = useApiQuery(['settings', 'coinPackages'], () => listCoinPackages());
  // Принимает ли сервер оплату картой — поле подписки (демо: всегда да)
  const subQ = useApiQuery(['settings', 'subscription', businessId], () => getSubscription(businessId ?? ''), { enabled: ready && Boolean(businessId) });
  const canPay = cardPaymentsAvailable(subQ.data);
  // Постранично, как во всех списках (DESIGN.md → Long lists)
  const { pageItems: movesPage, pager: movesPager, pageSize: movesPageSize } = usePagedList(movesQ.data ?? []);
  const movesLoading = movesQ.isLoading || !ready;
  // Скелетон истории — столько же строк, сколько было в прошлый раз (иначе как в демо), не больше страницы
  const skeletonMoves = useSkeletonCount('coin-moves', { loading: movesLoading, count: movesQ.data ? movesPage.length : undefined, fallback: TYPICAL_MOVES, max: movesPageSize });

  const purchase = useApiMutation(purchaseCoinPackage, { invalidates: [['coins', 'balance', businessId], ['coins', 'moves', businessId]] });

  const buy = async () => {
    if (!businessId || !picked) return;
    try {
      await purchase.mutate({ businessId, packageId: picked });
      toast.success(t('coins.purchaseSuccess'));
      setOpen(false);
      setPicked(null);
    } catch (e) {
      if (isPaymentsUnavailable(e)) {
        toast.error(t('paymentsSoon.unavailableError'));
        void subQ.refetch();
      } else toast.error(t('coins.purchaseFailed'));
    }
  };

  return (
    <div data-f="F-00-026 F-00-027 F-15-094" className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
      <PageHeader title={t('coins.title')} description={t('coins.description')} back={{ href: '/biz/settings' }} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard
          label={t('coins.balance')}
          // Без loading у плитки: иначе вместо кнопки «Купить» — полоса; число — полосой в том же месте
          value={balanceQ.isLoading || !ready ? <SkeletonText width="8ch" /> : `${format.number(balanceQ.data ?? 0)} ${t('coins.unit')}`}
          icon={<Coins aria-hidden />}
          hint={
            <Button size="sm" onClick={() => setOpen(true)} disabled={balanceQ.isLoading || !ready}>
              {t('coins.buy')}
            </Button>
          }
        />
        <SectionCard title={t('coins.spentOnTitle')} padding="sm">
          <ul data-f="F-00-027" className="flex flex-col gap-2">
            {(['storyPlace', 'newsExtra'] as const).map((key) => {
              const Icon = SPEND_REASON_ICON[key];
              return (
                <li key={key} className="flex items-start gap-2 text-sm text-fg">
                  <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
                  {t(`coins.spentOn.${key}`)}
                </li>
              );
            })}
          </ul>
        </SectionCard>
      </div>

      <SectionCard title={t('coins.historyTitle')}>
        {movesLoading && skeletonMoves === 0 ? (
          // В прошлый раз (и в демо) движений не было — то же пустое состояние, слова полосами
          <EmptyState compact icon={<Coins aria-hidden />} title={<SkeletonText width="10ch" />} description={<SkeletonText width="17ch" />} />
        ) : movesLoading ? (
          // Те же строки, что у истории: вид движения, дата, сумма
          <ul aria-busy className="flex flex-col divide-y divide-border">
            {Array.from({ length: skeletonMoves }, (_, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block text-fg">
                    <SkeletonText width="18ch" />
                  </span>
                  <span className="block text-xs text-muted">
                    <SkeletonText width="14ch" />
                  </span>
                </span>
                <span className="nums font-medium text-fg">
                  <SkeletonText width="5ch" />
                </span>
              </li>
            ))}
          </ul>
        ) : movesQ.isError ? (
          <ErrorState compact onRetry={() => movesQ.refetch()} />
        ) : !movesQ.data?.length ? (
          <EmptyState compact icon={<Coins aria-hidden />} description={t('coins.historyEmpty')} />
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {movesPage.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block text-fg">{t(`coins.moveKind.${m.kind}`)}</span>
                  <span className="block text-xs text-muted">{format.date(m.at, 'long')}</span>
                </span>
                <span className={m.amount > 0 ? 'nums font-medium text-success' : 'nums font-medium text-fg'}>
                  {m.amount > 0 ? '+' : ''}
                  {format.number(m.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
        {!movesQ.isError && movesPager}
      </SectionCard>

      <Sheet open={open} onOpenChange={setOpen} title={t('coins.buyTitle')} description={t('coins.buyDescription')} footer={
        canPay ? (
          <Button fullWidth onClick={buy} loading={purchase.isPending} disabled={!picked}>
            {t('coins.confirmPurchase')}
          </Button>
        ) : undefined
      }>
        <div className="flex flex-col gap-3">
          {!canPay && <PaymentsSoonNotice what="coins" />}
          {packagesQ.data?.map((pkg) => (
            <ChoiceCard
              key={pkg.id}
              kind="radio"
              disabled={!canPay}
              selected={picked === pkg.id}
              onClick={() => setPicked(pkg.id)}
              icon={<Coins aria-hidden className="size-5" />}
              title={`${format.number(pkg.coins)} ${t('coins.unit')}${pkg.bonusPercent ? ` +${pkg.bonusPercent}%` : ''}`}
              description={format.money(pkg.price)}
            />
          ))}
          <p className="text-xs text-muted">{t('coins.pricesNotFinal')}</p>
        </div>
      </Sheet>
    </div>
  );
}
