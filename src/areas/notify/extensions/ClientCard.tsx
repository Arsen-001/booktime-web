'use client';

/**
 * Вклад раздела «notify» в карточку клиента (хост «clientCard»): вкладка «Отправить сообщение»
 * (F-05-084), вкладка «Уведомления» — рекламные рассылки, доступные каналы, отключаемые типы
 * (F-05-090), согласие на SMS-рассылки (F-05-098), исключение из рассылок ДР / SMS (F-05-091, тут же —
 * мобильное приложение делает то же самое, отдельного экрана для него у нас нет), история сообщений
 * (F-05-109). Файл принадлежит разделу «notify». Посмотреть вклад без хозяина хоста: /dev/ext/clientCard/notify
 */
import { sentText } from '@/areas/notify/lib/logText';
import { useMemo, useState } from 'react';
import { useLocale } from 'next-intl';
import { Cake, MessageCircleMore, ShieldOff } from 'lucide-react';
import { coreGet } from '@/api/core';
import { getClientNotifyPrefs, listLog, sendOneOffMessage, updateClientNotifyPrefs } from '@/api/notify';
import { useApiMutation, useApiQuery } from '@/api/request';
import { CLIENT_DISABLEABLE_TYPES, DEFAULT_CLIENT_NOTIFY_PREFS } from '@/domain/notify';
import type { ClientNotifyPrefs, NotifyChannel } from '@/domain/notify';
import { TYPE_REGISTRY, channelLabel } from '@/areas/notify/lib/registry';
import type { ClientCardExtProps } from '@/extensions/types';
import type { Locale } from '@/i18n/config';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { Checkbox } from '@/ui/Checkbox';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { SectionCard } from '@/ui/SectionCard';
import { Skeleton } from '@/ui/Skeleton';
import { Tabs } from '@/ui/Tabs';
import { Textarea } from '@/ui/Textarea';
import { useToast } from '@/ui/Toast';

const MESSAGE_CHANNELS: NotifyChannel[] = ['sms', 'push', 'email'];

function typeName(code: number, locale: Locale): string {
  const def = TYPE_REGISTRY.find((d) => d.code === code);
  if (!def) return String(code);
  return locale === 'en' ? def.nameEn : locale === 'hy' ? def.nameHy : def.nameRu;
}

export default function NotifyClientCard({ clientId, businessId }: ClientCardExtProps) {
  const t = useT('notify');
  const toast = useToast();
  const locale = useLocale() as Locale;
  const [tab, setTab] = useState<'message' | 'settings' | 'history'>('message');

  const clientQ = useApiQuery(['core', 'client', clientId], () => coreGet('clients', clientId));
  const prefsQ = useApiQuery(['notify', 'clientPrefs', clientId], () => getClientNotifyPrefs(clientId));
  const logQ = useApiQuery(['notify', 'log', businessId], () => listLog(businessId));

  const send = useApiMutation(sendOneOffMessage);
  const savePrefs = useApiMutation(updateClientNotifyPrefs);

  const [text, setText] = useState('');
  // ⭐ F-00-120: клиенту главный бесплатный канал — пуш в наше приложение, не платный SMS
  const [channels, setChannels] = useState<NotifyChannel[]>(['push']);
  const [draftPrefs, setDraftPrefs] = useState<ClientNotifyPrefs | null>(null);

  const history = useMemo(
    () => (logQ.data ?? []).filter((m) => m.clientId === clientId).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [logQ.data, clientId],
  );

  if (clientQ.isError || prefsQ.isError) {
    return (
      <ErrorState
        onRetry={() => {
          clientQ.refetch();
          prefsQ.refetch();
        }}
      />
    );
  }
  // Загрузка — та же вкладка «Сообщение» со значениями по умолчанию (поля выключены): пришли данные — ничего не сдвинулось
  const loading = clientQ.isLoading || prefsQ.isLoading;

  const prefs = draftPrefs ?? prefsQ.data ?? DEFAULT_CLIENT_NOTIFY_PREFS;
  const dirty = draftPrefs !== null;

  const patchPrefs = (next: Partial<ClientNotifyPrefs>) => setDraftPrefs({ ...prefs, ...next });

  const handleSavePrefs = async () => {
    try {
      await savePrefs.mutate({ clientId, prefs });
      setDraftPrefs(null);
      await prefsQ.refetch();
      toast.success(t('clientCard.settings.saved'));
    } catch {
      toast.error(t('clientCard.settings.saveFailed'));
    }
  };

  const handleSend = async () => {
    try {
      await send.mutate({ businessId, clientId, text: text.trim(), channels, source: 'clientCard' });
      setText('');
      await logQ.refetch();
      toast.success(t('clientCard.message.sent'));
    } catch {
      toast.error(t('clientCard.message.sendFailed'));
    }
  };

  const canSendMessage = text.trim().length > 0 && channels.length > 0;

  return (
    <div data-f="F-05-084 F-05-090 F-05-091 F-05-098 F-05-109" className="flex flex-col gap-4">
      <Tabs
        variant="line"
        value={tab}
        onValueChange={(v) => setTab(v as typeof tab)}
        items={[
          { value: 'message', label: t('clientCard.tabs.message') },
          { value: 'settings', label: t('clientCard.tabs.settings') },
          { value: 'history', label: t('clientCard.tabs.history') },
        ]}
      />

      {tab === 'message' && (
        <div data-f="F-05-084" className="flex flex-col gap-3">
          <Textarea rows={3} value={text} disabled={loading} onChange={(e) => setText(e.target.value)} placeholder={t('clientCard.message.placeholder')} />
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-4">
            {MESSAGE_CHANNELS.map((ch) => {
              const allowed = ch === 'sms' ? prefs.channels.sms : ch === 'email' ? prefs.channels.email : prefs.channels.push;
              return (
                <Checkbox
                  key={ch}
                  checked={channels.includes(ch)}
                  disabled={loading || !allowed}
                  onCheckedChange={(checked) => setChannels((cur) => (checked ? [...cur, ch] : cur.filter((c) => c !== ch)))}
                  label={channelLabel(ch, locale)}
                  description={!allowed ? t('clientCard.message.channelBlocked') : undefined}
                />
              );
            })}
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSend} loading={send.isPending} disabled={loading || !canSendMessage}>
              {t('clientCard.message.send')}
            </Button>
          </div>
        </div>
      )}

      {tab === 'settings' && (
        <div data-f="F-05-090 F-05-098 F-14-075" className="flex flex-col gap-5">
          <Checkbox
            checked={prefs.marketingOptOut}
            onCheckedChange={(marketingOptOut) => patchPrefs({ marketingOptOut })}
            label={t('clientCard.settings.marketingOptOut')}
            description={t('clientCard.settings.marketingOptOutHint')}
          />

          <SectionCard title={t('clientCard.settings.channelsTitle')} padding="sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-4">
              <Checkbox
                checked={prefs.channels.push}
                onCheckedChange={(push) => patchPrefs({ channels: { ...prefs.channels, push } })}
                label={channelLabel('push', locale)}
              />
              <Checkbox
                checked={prefs.channels.sms}
                onCheckedChange={(sms) => patchPrefs({ channels: { ...prefs.channels, sms } })}
                label={channelLabel('sms', locale)}
              />
              <Checkbox
                checked={prefs.channels.email}
                onCheckedChange={(email) => patchPrefs({ channels: { ...prefs.channels, email } })}
                label={channelLabel('email', locale)}
              />
            </div>
          </SectionCard>

          <SectionCard title={t('clientCard.settings.typesTitle')} padding="sm">
            <div className="flex flex-col gap-2.5">
              {CLIENT_DISABLEABLE_TYPES.map((code) => {
                const enabled = !prefs.disabledTypeCodes.includes(code);
                return (
                  <Checkbox
                    key={code}
                    checked={enabled}
                    onCheckedChange={(checked) =>
                      patchPrefs({
                        disabledTypeCodes: checked ? prefs.disabledTypeCodes.filter((c) => c !== code) : [...prefs.disabledTypeCodes, code],
                      })
                    }
                    label={typeName(code, locale)}
                  />
                );
              })}
            </div>
          </SectionCard>

          {/* F-05-091: то же, что в мобильном приложении мастера — «в рассылку ДР» / «исключить из SMS» */}
          <div data-f="F-05-091" className="flex flex-col gap-2 rounded-lg border border-border p-3 text-sm text-muted">
            <p className="flex items-center gap-2">
              <Cake aria-hidden className="size-4" />
              {!prefs.disabledTypeCodes.includes(3) ? t('clientCard.settings.birthdayIn') : t('clientCard.settings.birthdayOut')}
            </p>
            <p className="flex items-center gap-2">
              <ShieldOff aria-hidden className="size-4" />
              {prefs.channels.sms ? t('clientCard.settings.smsIn') : t('clientCard.settings.smsOut')}
            </p>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSavePrefs} loading={savePrefs.isPending} disabled={!dirty}>
              {t('clientCard.settings.save')}
            </Button>
          </div>
        </div>
      )}

      {tab === 'history' && (
        <div data-f="F-05-109">
          {logQ.isLoading ? (
            <Skeleton lines={4} />
          ) : logQ.isError ? (
            <ErrorState onRetry={logQ.refetch} />
          ) : history.length === 0 ? (
            <EmptyState
              variant="section"
              icon={<MessageCircleMore aria-hidden />}
              title={t('clientCard.history.emptyTitle')}
              description={t('clientCard.history.emptyText')}
            />
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {history.slice(0, 30).map((m) => (
                <li key={m.id} className="flex flex-col gap-1 py-2.5">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                    <span>{m.createdAt.slice(0, 16).replace('T', ' ')}</span>
                    <Badge tone="neutral" size="sm">
                      {channelLabel(m.channel, locale)}
                    </Badge>
                    <Badge tone="neutral" size="sm">
                      {m.typeLabel[locale as 'en'] ?? m.typeLabel.ru}
                    </Badge>
                  </div>
                  <p className="text-sm text-fg">{sentText(m)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
