'use client';

/**
 * Вкладка «Каналы отправки» (F-05-065 обзор, F-05-066 Email, F-05-067 приложение администратора,
 * F-05-068 SMS, F-05-077 пуш клиенту, F-05-079 брендированное приложение, F-05-116 цены каналов).
 */
import { useRouter } from 'next/navigation';
import { ArrowUpRight, Bell, Check, Mail, MessageCircle, MessageSquareText, Send, Smartphone, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import { coreList } from '@/api/core';
import { anyStaffNotifyConfigured, getWebPopupSettings, listChannels, listTypes, setChannelConnected, updateWebPopupSettings } from '@/api/notify';
import { useApiMutation, useApiQuery } from '@/api/request';
import { DEFAULT_WEB_POPUP_SETTINGS, NOTIFY_CHANNELS, type NotifyChannel } from '@/domain/notify';
import { useCurrent } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { Checkbox } from '@/ui/Checkbox';
import { ErrorState } from '@/ui/ErrorState';
import { SectionCard } from '@/ui/SectionCard';
import { useToast } from '@/ui/Toast';

/** F-05-059: последовательность, без которой сотрудник ничего не получит */
function TeamSetupChecklist() {
  const t = useT('notify');
  const { ready, businessId } = useCurrent();
  const channelsQ = useApiQuery(['notify', 'channels', businessId], () => listChannels(businessId!), { enabled: ready && !!businessId });
  const typesQ = useApiQuery(['notify', 'types', businessId], () => listTypes(businessId!), { enabled: ready && !!businessId });
  const staffQ = useApiQuery(['notify', 'checklist-staff', businessId], () => coreList('staff', { businessId: businessId! }), {
    enabled: ready && !!businessId,
  });
  const staffIds = (staffQ.data ?? []).filter((s) => s.role !== 'owner' && s.locationIds.length > 0).map((s) => s.id);
  const configuredQ = useApiQuery(
    ['notify', 'checklist-staff-configured', businessId, staffIds.join(',')],
    () => anyStaffNotifyConfigured(staffIds),
    { enabled: ready && !!businessId && staffIds.length > 0 },
  );

  // Загрузка — тот же список шагов (номера вместо галочек): пришли данные — отмеченные шаги просто зачёркиваются
  const loading = !ready || channelsQ.isLoading || typesQ.isLoading || staffQ.isLoading;
  if (channelsQ.isError || typesQ.isError || staffQ.isError) return null;

  const channelsConnected = (channelsQ.data ?? []).some((c) => c.connected && (c.channel === 'adminApp' || c.channel === 'email'));
  const adminStaffTypesOn = (typesQ.data ?? []).some((ty) => (ty.recipient === 'admin' || ty.recipient === 'staff') && ty.enabled);
  const staff = staffQ.data ?? [];
  const staffWithLocation = staff.filter((s) => s.role !== 'owner' && s.locationIds.length > 0);
  // F-05-059: раньше шаг 4 дублировал условие шага 3 (текст обещал «четвёртый шаг», по факту решаемый
  // теми же тремя) — теперь это реальная проверка вкладки «Уведомления» карточки сотрудника (F-05-055/056).
  const steps = [
    { done: !loading && channelsConnected, label: t('channelsTab.checklist.step1') },
    { done: !loading && adminStaffTypesOn, label: t('channelsTab.checklist.step2') },
    { done: !loading && staffWithLocation.length > 0, label: t('channelsTab.checklist.step3') },
    { done: !loading && Boolean(configuredQ.data), label: t('channelsTab.checklist.step4') },
  ];

  return (
    <div data-f="F-05-059">
      <SectionCard title={t('channelsTab.checklist.title')} description={t('channelsTab.checklist.hint')}>
        <ul className="flex flex-col gap-2.5">
          {steps.map((s, i) => (
            <li key={i} className="flex items-center gap-2.5 text-sm">
              <span
                className={
                  s.done
                    ? 'grid size-5 shrink-0 place-items-center rounded-full bg-success text-primary-contrast'
                    : 'grid size-5 shrink-0 place-items-center rounded-full border border-border-strong text-muted'
                }
              >
                {s.done ? <Check aria-hidden className="size-3.5" /> : <span className="text-xs">{i + 1}</span>}
              </span>
              <span className={s.done ? 'text-muted line-through' : 'text-fg'}>{s.label}</span>
            </li>
          ))}
        </ul>
        {staff.some((s) => s.role !== 'owner' && s.locationIds.length === 0) && (
          <p className="mt-3 text-xs text-warning">{t('channelsTab.checklist.noLocationWarning')}</p>
        )}
      </SectionCard>
    </div>
  );
}

/** F-05-058: всплывающие уведомления в веб-кабинете, независимо от каналов */
function WebPopupSettingsCard() {
  const t = useT('notify');
  const toast = useToast();
  const { ready, businessId } = useCurrent();
  const q = useApiQuery(['notify', 'webPopups', businessId], () => getWebPopupSettings(businessId!), { enabled: ready && !!businessId });
  const save = useApiMutation(updateWebPopupSettings);

  // Загрузка — те же галочки со значениями по умолчанию (выключены)
  const loading = !ready || q.isLoading;
  if (q.isError || (!loading && !q.data)) return null;
  const settings = q.data ?? DEFAULT_WEB_POPUP_SETTINGS;

  const patch = async (next: typeof settings) => {
    try {
      await save.mutate({ businessId: businessId!, settings: next });
      await q.refetch();
    } catch {
      toast.error(t('typeDetail.saveFailed'));
    }
  };

  return (
    <div data-f="F-05-058">
      <SectionCard title={t('channelsTab.webPopups.title')} description={t('channelsTab.webPopups.hint')}>
        <div className="flex flex-col gap-3">
          <Checkbox
            checked={settings.bookingOps}
            disabled={loading}
            onCheckedChange={(bookingOps) => patch({ ...settings, bookingOps })}
            label={t('channelsTab.webPopups.bookingOps')}
          />
          <Checkbox
            checked={settings.incomingCalls}
            disabled={loading}
            onCheckedChange={(incomingCalls) => patch({ ...settings, incomingCalls })}
            label={t('channelsTab.webPopups.incomingCalls')}
            description={t('channelsTab.webPopups.incomingCallsHint')}
          />
          {/* ⭐ «Закрыт день» владельцу в колокольчик (01.10.2026) — по умолчанию включено */}
          <Checkbox
            checked={settings.dayClose !== false}
            disabled={loading}
            onCheckedChange={(dayClose) => patch({ ...settings, dayClose })}
            label={t('channelsTab.webPopups.dayClose')}
            description={t('channelsTab.webPopups.dayCloseHint')}
          />
        </div>
      </SectionCard>
    </div>
  );
}

// whatsapp/telegram не показываются в этой вкладке (⭐ F-00-032 — служебный канал кода входа,
// не то, что бизнес «подключает»), но Record должен быть исчерпывающим — иконки на случай будущего использования.
const ICONS: Record<NotifyChannel, ReactNode> = {
  push: <Bell aria-hidden className="size-5" />,
  adminApp: <Smartphone aria-hidden className="size-5" />,
  email: <Mail aria-hidden className="size-5" />,
  sms: <MessageSquareText aria-hidden className="size-5" />,
  brandedApp: <Sparkles aria-hidden className="size-5" />,
  whatsapp: <MessageCircle aria-hidden className="size-5" />,
  telegram: <Send aria-hidden className="size-5" />,
};

/** ⭐ Бесплатные каналы подключены у бизнеса сразу — так же разложен скелетон вкладки */
const FREE_CHANNELS: readonly NotifyChannel[] = ['push', 'adminApp', 'email'];

export function ChannelsTab() {
  const t = useT('notify');
  const toast = useToast();
  const router = useRouter();
  const { ready, businessId } = useCurrent();

  const q = useApiQuery(['notify', 'channels', businessId], () => listChannels(businessId!), { enabled: ready && !!businessId });
  const setConnected = useApiMutation(setChannelConnected);

  if (q.isError) return <ErrorState onRetry={q.refetch} />;

  // Загрузка — та же страница: каналы разложены как у нового бизнеса (бесплатные подключены сразу), кнопки выключены
  const loading = !ready || q.isLoading;
  const rows = q.data ?? NOTIFY_CHANNELS.map((channel) => ({ channel, connected: FREE_CHANNELS.includes(channel) }));
  const connected = rows.filter((r) => r.connected);
  const notConnected = rows.filter((r) => !r.connected);

  const handleBranded = async () => {
    if (!businessId) return;
    try {
      await setConnected.mutate({ businessId, channel: 'brandedApp', connected: true });
      toast.success(t('channelsTab.brandedRequested'));
    } catch {
      toast.error(t('channelsTab.saveFailed'));
    }
  };

  const rowBody = (channel: NotifyChannel) => {
    const isEmail = channel === 'email';
    const isSms = channel === 'sms';
    return (
      <>
        {/* Иконка + текст — своя группа, не расползается при переносе (M4: строка Email на телефоне) */}
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-soft text-primary-text">{ICONS[channel]}</span>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-fg">{t(`channels.${channel}`)}</p>
            <p className="text-sm text-muted">
              {t(`channelsTab.hint.${channel}`)}
              {channel === 'push' && <span data-f="F-05-080" className="sr-only" />}
            </p>
          </div>
        </div>
        {rows.find((r) => r.channel === channel)?.connected ? (
          <div className="flex shrink-0 items-center gap-2 pl-[3.25rem] sm:pl-0">
            <Badge tone="success" size="sm">
              {t('channelsTab.active')}
            </Badge>
            {isEmail && (
              <Button variant="outline" size="sm" disabled={loading} onClick={() => router.push('/biz/notifications/channels/email')}>
                {t('channelsTab.configure')}
              </Button>
            )}
            {isSms && (
              <Button variant="outline" size="sm" disabled={loading} onClick={() => router.push('/biz/notifications/channels/sms')}>
                {t('channelsTab.configure')}
              </Button>
            )}
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            disabled={loading}
            onClick={() => (isSms ? router.push('/biz/notifications/channels/sms') : handleBranded())}
          >
            {t('channelsTab.connect')}
          </Button>
        )}
      </>
    );
  };

  // M4: на телефоне иконка+текст и бейдж/кнопка — на разных строках (flex-col), не расползаются друг под другом.
  const ROW_CLASS = 'flex flex-col flex-wrap gap-3 border-b border-border py-3.5 last:border-0 sm:flex-row sm:items-center';

  /** Одна строка канала — data-f литерал на каждый (для scripts/fids.mjs) */
  const row = (channel: NotifyChannel) => {
    switch (channel) {
      case 'push':
        return (
          <div key={channel} data-f="F-05-077" className={ROW_CLASS}>
            {rowBody(channel)}
          </div>
        );
      case 'adminApp':
        return (
          <div key={channel} data-f="F-05-067" className={ROW_CLASS}>
            {rowBody(channel)}
          </div>
        );
      case 'email':
        return (
          <div key={channel} data-f="F-05-066" className={ROW_CLASS}>
            {rowBody(channel)}
          </div>
        );
      case 'sms':
        return (
          <div key={channel} data-f="F-05-068" className={ROW_CLASS}>
            {rowBody(channel)}
          </div>
        );
      case 'brandedApp':
        return (
          <div key={channel} data-f="F-05-079 F-14-158 F-14-067" className={ROW_CLASS}>
            {rowBody(channel)}
          </div>
        );
    }
  };

  return (
    <div data-f="F-05-065" className="flex flex-col gap-6">
      <SectionCard title={t('channelsTab.connectedTitle')} padding="none">
        <div className="px-4 sm:px-5">{connected.length ? connected.map((r) => row(r.channel)) : row('push')}</div>
      </SectionCard>
      {notConnected.length > 0 && (
        <SectionCard title={t('channelsTab.notConnectedTitle')} padding="none">
          <div className="px-4 sm:px-5">{notConnected.map((r) => row(r.channel))}</div>
        </SectionCard>
      )}
      <div data-f="F-05-116">
        <SectionCard title={t('channelsTab.pricesTitle')} description={t('channelsTab.pricesHint')}>
          <ul className="flex flex-col divide-y divide-border text-sm">
            <li className="flex items-center justify-between py-2">
              <span>{t('channels.push')}</span>
              <Badge tone="success" size="sm">
                {t('channelsTab.free')}
              </Badge>
            </li>
            <li className="flex items-center justify-between py-2">
              <span>{t('channels.adminApp')}</span>
              <Badge tone="success" size="sm">
                {t('channelsTab.free')}
              </Badge>
            </li>
            <li className="flex items-center justify-between py-2">
              <span>{t('channels.email')}</span>
              <Badge tone="success" size="sm">
                {t('channelsTab.free')}
              </Badge>
            </li>
            <li className="flex items-center justify-between py-2">
              <span>{t('channels.sms')}</span>
              <span className="text-muted">{t('channelsTab.smsPrice')}</span>
            </li>
            <li className="flex items-center justify-between py-2">
              <span>{t('channels.brandedApp')}</span>
              <span className="text-muted">{t('channelsTab.brandedPrice')}</span>
            </li>
          </ul>
        </SectionCard>
      </div>
      <SectionCard title={t('channelsTab.more.title')} description={t('channelsTab.more.hint')} padding="none">
        <div className="flex flex-col divide-y divide-border px-4 sm:px-5">
          {(
            [
              { href: '/biz/notifications/channels/catalog', key: 'catalog' },
              { href: '/biz/notifications/channels/whatsapp', key: 'whatsapp' },
              { href: '/biz/notifications/channels/balance', key: 'balance' },
              { href: '/biz/notifications/channels/promotion', key: 'promotion' },
              { href: '/biz/notifications/channels/developer', key: 'developer' },
              { href: '/biz/notifications/loyalty', key: 'loyalty' },
            ] as const
          ).map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => router.push(item.href)}
              className="flex items-center justify-between gap-3 py-3.5 text-left"
            >
              <span className="text-sm font-medium text-fg">{t(`channelsTab.more.${item.key}`)}</span>
              <ArrowUpRight aria-hidden className="size-4 shrink-0 text-muted" />
            </button>
          ))}
        </div>
      </SectionCard>

      <WebPopupSettingsCard />
      <TeamSetupChecklist />
    </div>
  );
}
