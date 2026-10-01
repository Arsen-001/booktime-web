'use client';

/**
 * Вкладка «Настройки» подключённого приложения (F-13-017) — поля конкретного приложения по флагам каталога
 * (b03): SMS-агрегатор (F-13-155), баланс сообщений (F-13-141), номер WhatsApp (F-13-142/143), карта лояльности
 * в Wallet (F-13-174…176/211), промоблоки виджета (F-13-172) и др. Ревью 27.09 (И1): вкладка есть только у
 * приложений со своими настройками (appHasOwnSettings) — без заглушки «появится позже»; дата подключения и
 * доступы — в карточке статуса справа (AppActionCard).
 */
import { FastSignSettings } from '@/areas/integrations/components/settings/FastSignSettings';
import { GaStreamsSettings } from '@/areas/integrations/components/settings/GaStreamsSettings';
import { KommoSettings } from '@/areas/integrations/components/settings/KommoSettings';
import { MessageBalanceSettings } from '@/areas/integrations/components/settings/MessageBalanceSettings';
import { NotifyChatbotSettings } from '@/areas/integrations/components/settings/NotifyChatbotSettings';
import { PromoBlockSettings } from '@/areas/integrations/components/settings/PromoBlockSettings';
import { SmsAggregatorSettings } from '@/areas/integrations/components/settings/SmsAggregatorSettings';
import { ViewerOnlyAnalyticsSettings } from '@/areas/integrations/components/settings/ViewerOnlyAnalyticsSettings';
import { WalletLoyaltySettings } from '@/areas/integrations/components/settings/WalletLoyaltySettings';
import { WhatsappNumberSettings } from '@/areas/integrations/components/settings/WhatsappNumberSettings';
import { WhoToCallSettings } from '@/areas/integrations/components/settings/WhoToCallSettings';
import type { AppInstall, CatalogApp } from '@/domain/integrations';

export function AppSettingsTab({
  app,
  install,
  onInstallChange,
}: {
  app: CatalogApp;
  install: AppInstall;
  onInstallChange: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      {app.promoBlockBuilder ? (
        <PromoBlockSettings />
      ) : (
        <>
          {app.smsAggregatorAuth && (
            <SmsAggregatorSettings
              install={install}
              onChange={onInstallChange}
            />
          )}
          {app.billsPerMessage && (
            <MessageBalanceSettings
              install={install}
              price={app.price}
              onChange={onInstallChange}
            />
          )}
          {app.whatsappNumberChoice && (
            <WhatsappNumberSettings
              install={install}
              onChange={onInstallChange}
            />
          )}
          {app.walletLoyaltyDemo && (
            <WalletLoyaltySettings
              app={app}
              install={install}
              onChange={onInstallChange}
            />
          )}
          {app.gaStreamsApp && (
            <GaStreamsSettings install={install} onChange={onInstallChange} />
          )}
          {app.viewerOnlyAnalytics && <ViewerOnlyAnalyticsSettings />}
          {app.whoToCallDemo && <WhoToCallSettings />}
          {app.kommoSettings && (
            <KommoSettings install={install} onChange={onInstallChange} />
          )}
          {app.fastSignDemo && (
            <FastSignSettings install={install} onChange={onInstallChange} />
          )}
          {app.notifyAppKind === 'chatbot' && (
            <NotifyChatbotSettings
              app={app}
              install={install}
              onChange={onInstallChange}
            />
          )}
        </>
      )}
    </div>
  );
}
