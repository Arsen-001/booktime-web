'use client';

/**
 * F-13-144 (Flowsell), F-13-145 (Message.Help), F-13-146 (Integrilla), F-13-147 (dconnect),
 * F-13-148 (Fromni. Chatbot), F-13-149 (Fromni. SMS/Fromi), F-13-150 (ChatApp), F-13-151 (Wazapa),
 * F-13-152 (Revvy), F-13-153 (AssistBot) — 10 отдельных карточек ТЗ, у нас — 4 каталожных приложения
 * категории «Уведомления» с notifyAppKind === 'chatbot' (свои названия, см. src/mock/slices/integrations.ts,
 * блок «notifications» и комментарии F-13-144/145/148/150 и т. д. у каждой строки); набор способностей у
 * каждого свой (`CatalogApp.notifyCapabilities`), поэтому блоки ниже показываются только там, где нужны:
 *  - cascade (F-13-146/147/149): порядок каналов + демо-проверка, какой канал «доставил»;
 *  - bookingConfirm (F-13-144/148/150/151/153): демо «клиент ответил да» — подтверждение записи;
 *  - negativeReviewIntercept (F-13-152): низкая оценка уходит владельцу, а не на карты;
 *  - retentionCampaigns/rfm (F-13-147/152): демо-рассылка «уснувшим» клиентам.
 */
import { useState } from 'react';
import { ArrowDown, ArrowUp, MessageSquareWarning, Send } from 'lucide-react';
import {
  demoInterceptNegativeReview,
  demoRunRetentionCampaign,
  demoTestChatbotDelivery,
  setCascadeOrder,
  setNegativeReviewIntercept,
} from '@/api/integrations';
import { useApiMutation } from '@/api/request';
import type {
  AppChannel,
  AppInstall,
  CatalogApp,
  NotifyCapability,
} from '@/domain/integrations';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { SectionCard } from '@/ui/SectionCard';
import { Switch } from '@/ui/Switch';
import { useToast } from '@/ui/Toast';

function hasCap(caps: NotifyCapability[] | undefined, cap: NotifyCapability) {
  return Boolean(caps?.includes(cap));
}

export function NotifyChatbotSettings({
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
  const { relativeDay } = useFormat();
  const channels = app.channels ?? [];
  const caps = app.notifyCapabilities;
  const [order, setOrder] = useState<AppChannel[]>(
    install.cascadeOrder?.length ? install.cascadeOrder : channels,
  );
  const [days, setDays] = useState(30);

  const saveOrder = useApiMutation((next: AppChannel[]) =>
    setCascadeOrder(install.id, next),
  );
  const testDelivery = useApiMutation(() =>
    demoTestChatbotDelivery(
      install.id,
      order.length ? order : channels,
      hasCap(caps, 'bookingConfirm'),
    ),
  );
  const toggleIntercept = useApiMutation((on: boolean) =>
    setNegativeReviewIntercept(install.id, on),
  );
  const interceptDemo = useApiMutation(() =>
    demoInterceptNegativeReview(install.id),
  );
  const retention = useApiMutation(() =>
    demoRunRetentionCampaign(install.id, days),
  );

  const move = async (index: number, dir: -1 | 1) => {
    const next = [...order];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setOrder(next);
    try {
      await saveOrder.mutate(next);
      onChange();
    } catch {
      toast.error(t('errors.actionFailed'));
    }
  };

  const onTest = async () => {
    try {
      await testDelivery.mutate(undefined);
      onChange();
      toast.success(t('app.settings.chatbot.testSentToast'));
    } catch {
      toast.error(t('errors.actionFailed'));
    }
  };

  const onToggleIntercept = async (value: boolean) => {
    try {
      await toggleIntercept.mutate(value);
      onChange();
    } catch {
      toast.error(t('errors.actionFailed'));
    }
  };

  const onInterceptDemo = async () => {
    try {
      await interceptDemo.mutate(undefined);
      onChange();
      toast.success(t('app.settings.chatbot.interceptedToast'));
    } catch {
      toast.error(t('errors.actionFailed'));
    }
  };

  const onRunRetention = async () => {
    try {
      await retention.mutate(undefined);
      onChange();
      toast.success(t('app.settings.chatbot.retentionRanToast'));
    } catch {
      toast.error(t('errors.actionFailed'));
    }
  };

  const showCascade = hasCap(caps, 'cascade') && channels.length > 1;
  const showConfirm = hasCap(caps, 'bookingConfirm');
  const showIntercept = hasCap(caps, 'negativeReviewIntercept');
  const showRetention =
    hasCap(caps, 'retentionCampaigns') || hasCap(caps, 'rfm');

  return (
    <div
      data-f="F-13-144 F-13-145 F-13-146 F-13-147 F-13-148 F-13-149 F-13-150 F-13-151 F-13-152 F-13-153"
      className="flex flex-col gap-4"
    >
      {showCascade && (
        <SectionCard
          title={t('app.settings.chatbot.cascadeTitle')}
          description={t('app.settings.chatbot.cascadeHint')}
        >
          <ol className="flex flex-col gap-2">
            {order.map((c, i) => (
              <li
                key={c}
                className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
              >
                <span className="text-sm text-fg">
                  {i + 1}. {t(`channels.${c}` as never)}
                </span>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={t('app.settings.chatbot.moveUp')}
                    disabled={i === 0}
                    onClick={() => void move(i, -1)}
                  >
                    <ArrowUp className="h-4 w-4" aria-hidden />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={t('app.settings.chatbot.moveDown')}
                    disabled={i === order.length - 1}
                    onClick={() => void move(i, 1)}
                  >
                    <ArrowDown className="h-4 w-4" aria-hidden />
                  </Button>
                </div>
              </li>
            ))}
          </ol>
        </SectionCard>
      )}

      {(showCascade || showConfirm) && (
        <SectionCard title={t('app.settings.chatbot.testTitle')}>
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted">
              {t('app.settings.chatbot.testHint')}
            </p>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Send className="h-4 w-4" aria-hidden />}
              loading={testDelivery.isPending}
              onClick={() => void onTest()}
              className="self-start"
            >
              {t('app.settings.chatbot.testCta')}
            </Button>
            {install.lastChatbotTest && (
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
                <Badge tone="success" variant="soft">
                  {t('app.settings.chatbot.deliveredVia', {
                    channel: t(
                      `channels.${install.lastChatbotTest.deliveredVia}` as never,
                    ),
                  })}
                </Badge>
                {showConfirm && install.lastChatbotTest.confirmed && (
                  <Badge tone="info" variant="soft">
                    {t('app.settings.chatbot.clientConfirmed')}
                  </Badge>
                )}
                <span>{relativeDay(install.lastChatbotTest.at)}</span>
              </div>
            )}
          </div>
        </SectionCard>
      )}

      {showIntercept && (
        <SectionCard
          title={t('app.settings.chatbot.interceptTitle')}
          description={t('app.settings.chatbot.interceptHint')}
        >
          <div className="flex flex-col gap-3">
            <Switch
              checked={install.negativeReviewIntercept ?? true}
              onCheckedChange={onToggleIntercept}
              label={t('app.settings.chatbot.interceptLabel')}
            />
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<MessageSquareWarning className="h-4 w-4" aria-hidden />}
              loading={interceptDemo.isPending}
              onClick={() => void onInterceptDemo()}
              className="self-start"
            >
              {t('app.settings.chatbot.interceptDemoCta')}
            </Button>
            {Boolean(install.interceptedReviewsCount) && (
              <p className="text-sm text-muted">
                {t('app.settings.chatbot.interceptedCount', {
                  count: install.interceptedReviewsCount ?? 0,
                })}
              </p>
            )}
          </div>
        </SectionCard>
      )}

      {showRetention && (
        <SectionCard
          title={t('app.settings.chatbot.retentionTitle')}
          description={t('app.settings.chatbot.retentionHint')}
        >
          <div className="flex flex-wrap items-end gap-3">
            <FormField
              label={t('app.settings.chatbot.retentionDaysLabel')}
              className="w-32"
            >
              <Input
                type="number"
                min={1}
                value={days}
                onChange={(e) => setDays(Number(e.target.value) || 1)}
              />
            </FormField>
            <Button
              size="sm"
              loading={retention.isPending}
              onClick={() => void onRunRetention()}
            >
              {t('app.settings.chatbot.retentionCta')}
            </Button>
          </div>
          {install.lastRetentionRunCount !== undefined && (
            <p className="mt-3 text-sm text-muted">
              {t('app.settings.chatbot.retentionResult', {
                count: install.lastRetentionRunCount,
                days,
              })}
            </p>
          )}
        </SectionCard>
      )}

      {!showCascade && !showConfirm && !showIntercept && !showRetention && (
        <SectionCard title={app.name}>
          <p className="text-sm text-muted">{t('app.settings.moreSoon')}</p>
        </SectionCard>
      )}
    </div>
  );
}
