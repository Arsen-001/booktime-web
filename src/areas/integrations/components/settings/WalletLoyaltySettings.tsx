'use client';

/**
 * F-13-174 (Boomerang), F-13-175 (BondUs.cz), F-13-176 (LoyalCards), F-13-211 (карта клиента от нас) — карта
 * лояльности в Apple/Google Wallet. Демо-симулятор: «клиент пришёл» ставит штамп / обновляет карту без
 * настоящего похода в Wallet, кнопки выдачи по ссылке — заглушки (F-13-211 «Готово, когда»).
 */
import { Smartphone } from 'lucide-react';
import { simulateLoyaltyVisit } from '@/api/integrations';
import { useApiMutation } from '@/api/request';
import type { AppInstall, CatalogApp } from '@/domain/integrations';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { SectionCard } from '@/ui/SectionCard';
import { useToast } from '@/ui/Toast';

export function WalletLoyaltySettings({
  app,
  install,
  onChange,
}: {
  app: CatalogApp;
  install: AppInstall;
  onChange: () => void;
}) {
  const t = useT('integrations');
  const toast = useToast();
  const simulate = useApiMutation(() => simulateLoyaltyVisit(install.id));
  const isOwnCard = app.developer === 'Наша платформа'; // F-13-211: «Карта клиента — базовая» — своя, не партнёрская

  const onSimulate = async () => {
    try {
      await simulate.mutate(undefined);
      onChange();
      toast.success(t('app.settings.wallet.simulatedToast'));
    } catch {
      toast.error(t('errors.actionFailed'));
    }
  };

  const onIssue = (toastKey: string) => {
    toast.success(t(toastKey as never));
  };

  return (
    <div data-f="F-13-174 F-13-175 F-13-176 F-13-211 F-06-166 F-06-167 F-06-168">
      <SectionCard title={t('app.settings.wallet.title')}>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 rounded-lg bg-surface-2 p-3">
            <Smartphone
              className="h-8 w-8 shrink-0 text-primary-text"
              aria-hidden
            />
            <p className="text-sm text-fg">
              {t('app.settings.wallet.stampsLabel')}:{' '}
              <span className="font-semibold">
                {install.demoLoyaltyStamps ?? 0}
              </span>
            </p>
          </div>

          <Button
            size="sm"
            variant="secondary"
            loading={simulate.isPending}
            onClick={onSimulate}
            className="self-start"
          >
            {t('app.settings.wallet.simulateVisitCta')}
          </Button>

          <div className="flex flex-col gap-2 border-t border-border pt-4">
            <p className="text-sm font-medium text-fg">
              {t('app.settings.wallet.issueTitle')}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => onIssue('app.settings.wallet.issuedToast')}
              >
                {t('app.settings.wallet.issueIos')}
              </Button>
              <Button
                size="sm"
                onClick={() => onIssue('app.settings.wallet.issuedToast')}
              >
                {t('app.settings.wallet.issueAndroid')}
              </Button>
            </div>
          </div>

          {isOwnCard && (
            <p className="text-xs text-muted">
              {t('app.settings.wallet.decideNote')}
            </p>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
