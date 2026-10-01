'use client';

/**
 * F-13-141: приложения, которые считают отправленные сообщения деньгами (Altegio Notification Sender и
 * похожие). Баланс — отдельно на каждый филиал (install уже ключуется по locationId); без баланса демо-отправка
 * даёт статус «Недостаточно средств», а не тихо проглатывает сообщение.
 * F-13-165 «Готово, когда»: «баланс сообщений виден и пополняется картой» — у нас тот же баланс и та же форма
 * пополнения, только внутри настроек приложения, а не в «Биллинге» (Биллинг принадлежит разделу settings, не
 * нашему пути) — просьба дать в settings ссылку сюда записана в qa/requests/integrations.md.
 */
import { useState } from 'react';
import { demoSendTestMessage, topUpMessageBalance } from '@/api/integrations';
import { useApiMutation } from '@/api/request';
import type { AppInstall, AppPrice } from '@/domain/integrations';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { FormField } from '@/ui/FormField';
import { MoneyInput } from '@/ui/MoneyInput';
import { SectionCard } from '@/ui/SectionCard';
import { useToast } from '@/ui/Toast';

export function MessageBalanceSettings({
  install,
  price,
  onChange,
}: {
  install: AppInstall;
  price: AppPrice;
  onChange: () => void;
}) {
  const t = useT('integrations');
  const { money } = useFormat();
  const toast = useToast();
  const [topUp, setTopUp] = useState<number | undefined>(5000);

  const pricePerMessage = price.currency === 'AMD' ? (price.amount ?? 0) : 0;
  const topUpMutation = useApiMutation((amount: number) =>
    topUpMessageBalance(install.id, amount),
  );
  const sendTest = useApiMutation(() =>
    demoSendTestMessage(install.id, pricePerMessage),
  );

  const onTopUp = async () => {
    if (!topUp || topUp <= 0) return;
    try {
      await topUpMutation.mutate(topUp);
      onChange();
      toast.success(t('app.settings.balance.topUpSuccessToast'));
    } catch {
      toast.error(t('errors.actionFailed'));
    }
  };

  const onSendTest = async () => {
    try {
      const result = await sendTest.mutate(undefined);
      onChange();
      if (result.outcome === 'sent')
        toast.success(
          t('app.settings.sms.testSentToast', {
            amount: money(pricePerMessage),
          }),
        );
      else toast.error(t('app.settings.sms.testInsufficientToast'));
    } catch {
      toast.error(t('errors.actionFailed'));
    }
  };

  return (
    <div data-f="F-13-141 F-13-165">
      <SectionCard
        title={t('app.settings.balance.title')}
        description={t('app.settings.balance.perLocationNote')}
      >
        <div className="flex flex-col gap-4">
          <p className="text-2xl font-semibold text-fg">
            {money(install.messageBalanceAmd ?? 0)}
          </p>

          {price.currency === 'AMD' && (
            <p className="text-xs text-muted">
              {t('app.settings.balance.priceNote', {
                price: money(pricePerMessage),
              })}{' '}
              {t('app.settings.balance.priceFootnote')}
            </p>
          )}

          <div className="flex flex-wrap items-end gap-3">
            <FormField
              label={t('app.settings.balance.topUpLabel')}
              className="w-40"
            >
              <MoneyInput value={topUp} onValueChange={setTopUp} />
            </FormField>
            <Button loading={topUpMutation.isPending} onClick={onTopUp}>
              {t('app.settings.balance.topUpCta')}
            </Button>
          </div>

          <div className="flex flex-col gap-2 border-t border-border pt-4">
            <p className="text-sm font-medium text-fg">
              {t('app.settings.sms.testTitle')}
            </p>
            <p className="text-xs text-muted">
              {t('app.settings.sms.testHint')}
            </p>
            <Button
              size="sm"
              variant="secondary"
              loading={sendTest.isPending}
              onClick={onSendTest}
              className="self-start"
            >
              {t('app.settings.sms.testCta')}
            </Button>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
