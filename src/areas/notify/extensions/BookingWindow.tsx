'use client';

/**
 * Вклад раздела «notify» в окно записи (хост «bookingWindow»): плитка «Уведомления о визите»
 * (F-05-082) — минимальная версия, которой не хватало F-05-009 «Готово, когда»: для записи,
 * созданной ДО смены настроек типа, время напоминания меняют вручную ЗДЕСЬ, а не на странице типа
 * (там правило действует только на будущие записи). Полный набор F-05-082 (повторная отправка
 * подтверждения, срок повторного визита) — другая пачка; здесь достаточно того, что F-05-009 требует.
 * Файл принадлежит разделу «notify». Посмотреть вклад без хозяина хоста: /dev/ext/bookingWindow/notify
 */
import { sentText } from '@/areas/notify/lib/logText';
import { useMemo, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import { Bell, Copy, MessageCircleMore, MessagesSquare, Paperclip, QrCode, Send } from 'lucide-react';
import { coreGet } from '@/api/core';
import {
  clearChatUnread,
  DEFAULT_BOOKING_NOTIFY_OVERRIDE,
  getAltegioWhatsApp,
  getBookingNotifyOverride,
  getChatPartnerStatus,
  getPaymentLink,
  listChatMessages,
  listLog,
  sendChatMessage,
  sendOneOffMessage,
  sendPaymentLink,
  simulateIncomingChatMessage,
  updateBookingNotifyOverride,
} from '@/api/notify';
import { useApiMutation, useApiQuery } from '@/api/request';
import { channelLabel } from '@/areas/notify/lib/registry';
import { useCan } from '@/demo/hooks';
import type { BookingNotifyOverride, NotifyChannel } from '@/domain/notify';
import type { BookingWindowExtProps } from '@/extensions/types';
import type { Locale } from '@/i18n/config';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { copyText } from '@/lib/clipboard';
import { waLink } from '@/lib/phone';
import { Badge } from '@/ui/Badge';
import { Button, buttonClasses } from '@/ui/Button';
import { Checkbox } from '@/ui/Checkbox';
import { EmptyState } from '@/ui/EmptyState';
import { IconButton } from '@/ui/IconButton';
import { Modal } from '@/ui/Modal';
import { Select } from '@/ui/Select';
import { SectionCard } from '@/ui/SectionCard';
import { Skeleton, SkeletonText } from '@/ui/Skeleton';
import { Textarea } from '@/ui/Textarea';
import { Tooltip } from '@/ui/Tooltip';
import { useToast } from '@/ui/Toast';

/** Демо-QR (F-05-089): решётка из строки ссылки — детерминированная, не сканируется (нет реального платёжного бэка) */
function demoQrCells(seed: string): boolean[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return Array.from({ length: 81 }, (_, i) => {
    h = (h * 1103515245 + 12345) >>> 0;
    return ((h >> (i % 24)) & 1) === 1;
  });
}

// ⭐ F-00-120/F-00-121: клиенту без приложения — «Напомнить» готовым текстом через WhatsApp, не платный SMS-каскад
const MESSAGE_CHANNELS: NotifyChannel[] = ['push', 'sms', 'email'];

const HOUR_OPTIONS = [1, 2, 3, 4, 5, 6, 9, 12, 15, 18, 21, 24];

export default function NotifyBookingWindow({ mode, bookingId, businessId, draft }: BookingWindowExtProps) {
  const t = useT('notify');
  const toast = useToast();
  const locale = useLocale() as Locale;
  const canManage = useCan('notify.manage');
  // F-05-114: без права видеть телефон клиента кнопки мессенджеров и чат из записи недоступны
  const canPhones = useCan('clients.phones');
  const format = useFormat();
  const [draftOverride, setDraftOverride] = useState<BookingNotifyOverride | null>(null);
  const [messageText, setMessageText] = useState('');
  const [messageChannels, setMessageChannels] = useState<NotifyChannel[]>(['push']);

  const clientQ = useApiQuery(['core', 'client', draft.clientId], () => coreGet('clients', draft.clientId!), {
    enabled: canManage && Boolean(draft.clientId),
  });

  const overrideQ = useApiQuery(['notify', 'bookingOverride', bookingId], () => getBookingNotifyOverride(bookingId!), {
    enabled: canManage && mode === 'edit' && Boolean(bookingId),
  });
  const save = useApiMutation(updateBookingNotifyOverride);
  const logQ = useApiQuery(['notify', 'log', businessId], () => listLog(businessId), {
    enabled: canManage && mode === 'edit' && Boolean(draft.clientId),
  });
  const sendMessage = useApiMutation(sendOneOffMessage);
  // F-01-087: «Отправить подтверждение» / «Отправить повторно» — ручная отправка типа 9, не завязана
  // на то, включён ли он в настройках (1551 — отправить можно даже выключенным).
  const sendConfirm = useApiMutation(sendOneOffMessage);
  const [confirmSentOnce, setConfirmSentOnce] = useState(false);
  const handleSendConfirm = async () => {
    if (!draft.clientId) return;
    try {
      await sendConfirm.mutate({
        businessId,
        clientId: draft.clientId,
        text: t('bookingWindow.confirmText', {
          name: clientQ.data?.name ? `, ${clientQ.data.name}` : '',
          date: draft.start ? format.date(draft.start) : '',
          time: draft.start ? format.time(draft.start) : '',
        }),
        channels: ['push'],
        source: 'bookingWindow',
      });
      setConfirmSentOnce(true);
      toast.success(t('bookingWindow.confirmSent'));
    } catch {
      toast.error(t('bookingWindow.confirmSendFailed'));
    }
  };
  const history = useMemo(
    () =>
      (logQ.data ?? [])
        .filter((m) => m.clientId === draft.clientId)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
        .slice(0, 10),
    [logQ.data, draft.clientId],
  );

  // F-05-087: «Чат Beta» — переписка через подключённого партнёра, прямо в окне визита.
  const chatStatusQ = useApiQuery(['notify', 'chatPartner', businessId], () => getChatPartnerStatus(businessId), {
    enabled: canManage && mode === 'edit',
  });
  const chatPhone = clientQ.data?.phone;
  const chatMessagesQ = useApiQuery(['notify', 'chatMessages', businessId, chatPhone], () => listChatMessages(businessId, chatPhone!), {
    enabled: canManage && mode === 'edit' && chatStatusQ.data === true && Boolean(chatPhone),
  });
  const sendChat = useApiMutation(sendChatMessage);
  const simulateIncoming = useApiMutation(simulateIncomingChatMessage);
  const [chatText, setChatText] = useState('');
  const [chatAttachment, setChatAttachment] = useState<string | undefined>();
  const chatFileRef = useRef<HTMLInputElement>(null);

  // F-05-089: «Отправить ссылку на оплату» / «Скопировать» / «Показать QR» — из окна визита
  const paymentLinkQ = useApiQuery(['notify', 'paymentLink', bookingId], () => getPaymentLink(bookingId!), {
    enabled: canManage && mode === 'edit' && Boolean(bookingId),
  });
  const waStatusQ = useApiQuery(['notify', 'altegioWhatsApp', businessId], () => getAltegioWhatsApp(businessId), {
    enabled: canManage && mode === 'edit',
  });
  const waConnected = Boolean(waStatusQ.data && waStatusQ.data.mode !== 'none');
  const sendPayment = useApiMutation(sendPaymentLink);
  const [paymentChannels, setPaymentChannels] = useState<NotifyChannel[]>(['sms', 'email']);
  const [qrOpen, setQrOpen] = useState(false);

  const handleCopyPaymentLink = async () => {
    if (!paymentLinkQ.data) return;
    if (await copyText(paymentLinkQ.data.url)) toast.success(t('bookingWindow.payment.copied'));
    else toast.error(t('bookingWindow.payment.copyFailed'));
  };

  const handleSendPaymentLink = async () => {
    if (!draft.clientId || paymentChannels.length === 0) return;
    try {
      await sendPayment.mutate({ businessId, bookingId: bookingId!, clientId: draft.clientId, channels: paymentChannels });
      toast.success(t('bookingWindow.payment.sent'));
    } catch {
      toast.error(t('bookingWindow.payment.sendFailed'));
    }
  };

  const handleSendChat = async () => {
    if (!chatPhone || (!chatText.trim() && !chatAttachment)) return;
    try {
      await sendChat.mutate({ businessId, phone: chatPhone, clientId: draft.clientId, text: chatText.trim(), attachmentName: chatAttachment });
      setChatText('');
      setChatAttachment(undefined);
      await chatMessagesQ.refetch();
    } catch {
      toast.error(t('bookingWindow.chat.sendFailed'));
    }
  };

  const handleSimulateIncoming = async () => {
    if (!chatPhone) return;
    try {
      await simulateIncoming.mutate({ businessId, phone: chatPhone, clientId: draft.clientId, text: t('bookingWindow.chat.simulatedText') });
      await chatMessagesQ.refetch();
      // F-05-088: всплывающее уведомление о новом сообщении — здесь, у чата, а не «app-wide»: под глобальную
      // всплывашку на любой странице кабинета нет своего хоста (нужен фундамент — см. qa/requests/notify.md).
      toast.info(t('bookingWindow.chat.newMessageToast'));
      await clearChatUnread(businessId);
    } catch {
      toast.error(t('bookingWindow.chat.sendFailed'));
    }
  };

  const handleSendMessage = async () => {
    if (!draft.clientId) return;
    try {
      await sendMessage.mutate({
        businessId,
        clientId: draft.clientId,
        text: messageText.trim(),
        channels: messageChannels,
        source: 'bookingWindow',
      });
      setMessageText('');
      await logQ.refetch();
      toast.success(t('bookingWindow.messageSent'));
    } catch {
      toast.error(t('bookingWindow.messageSendFailed'));
    }
  };

  if (!canManage) return null;

  // F-05-009: до сохранения записи ей ещё нет bookingId — вручную настраивать нечего, только объяснить, где это будет
  if (mode === 'create' || !bookingId) {
    return (
      <div data-f="F-05-009" className="rounded-xl border border-border bg-surface shadow-xs">
        <EmptyState variant="section" icon={<Bell aria-hidden />} title={t('bookingWindow.title')} description={t('bookingWindow.newBookingHint')} />
      </div>
    );
  }

  const value = draftOverride ?? overrideQ.data ?? DEFAULT_BOOKING_NOTIFY_OVERRIDE;
  const dirty = draftOverride !== null;

  const patch = (next: Partial<BookingNotifyOverride>) => setDraftOverride({ ...value, ...next });

  const handleSave = async () => {
    try {
      await save.mutate({ bookingId, override: value });
      setDraftOverride(null);
      await overrideQ.refetch();
      toast.success(t('bookingWindow.saved'));
    } catch {
      toast.error(t('bookingWindow.saveFailed'));
    }
  };

  return (
    <>
      {/* data-f — на div: SectionCardProps не пробрасывает произвольные атрибуты на DOM. */}
      <div data-f="F-05-009 F-01-090 F-01-091">
        <SectionCard title={t('bookingWindow.title')} description={t('bookingWindow.hint')}>
          {/* Загрузка — та же форма со значениями по умолчанию, все поля выключены (fieldset disabled): ничего не сдвигается */}
          <fieldset disabled={overrideQ.isLoading} className="flex min-w-0 flex-col gap-4">
            <Checkbox checked={value.sendOnSave} onCheckedChange={(sendOnSave) => patch({ sendOnSave })} label={t('bookingWindow.sendOnSave')} />

            {draft.clientId && (
              <Button
                data-f="F-01-087"
                variant="outline"
                size="sm"
                className="self-start"
                leftIcon={<Send aria-hidden />}
                loading={sendConfirm.isPending}
                onClick={handleSendConfirm}
              >
                {confirmSentOnce ? t('bookingWindow.confirmResend') : t('bookingWindow.confirmSend')}
              </Button>
            )}

            <div className="flex flex-col gap-2" data-f="F-01-092">
              <p className="text-sm font-medium text-fg">{t('bookingWindow.reminderTitle')}</p>
              <p className="text-xs text-muted">{t('bookingWindow.reminderHint')}</p>

              {/* ⭐ F-00-120: напоминание — только пуш, идёт первым и включён по умолчанию; SMS/Email ниже
              помечены как платные ручные каналы, а не равноценная альтернатива пушу. */}
              <div
                data-f="F-00-120 F-15-137"
                className="flex flex-col gap-2 rounded-lg border border-border bg-primary-soft/40 p-3 sm:flex-row sm:items-center sm:gap-4"
              >
                <Checkbox
                  checked={value.pushEnabled}
                  onCheckedChange={(pushEnabled) => patch({ pushEnabled })}
                  label={t('bookingWindow.channelPush')}
                  classNames={{ root: 'sm:w-40' }}
                />
                <Select
                  className="w-full sm:w-48"
                  aria-label={t('bookingWindow.channelPush')}
                  disabled={!value.pushEnabled}
                  options={HOUR_OPTIONS.map((h) => ({ value: String(h), label: t('bookingWindow.hoursBefore', { h }) }))}
                  value={String(value.pushTimingHours)}
                  onValueChange={(v) => patch({ pushTimingHours: Number(v) })}
                />
              </div>

              {/* ⭐ 30.09: Telegram-бот — бесплатно, клиенту без приложения; время фиксированное (за сутки и за 2 ч),
              поэтому только выключатель — свой, не общий с SMS. 03.10: он же выключает запрос подтверждения (тип 73) */}
              <div className="rounded-lg border border-border p-3">
                <Checkbox
                  checked={value.telegramEnabled !== false}
                  onCheckedChange={(telegramEnabled) => patch({ telegramEnabled })}
                  label={t('bookingWindow.channelTelegram')}
                  description={t('bookingWindow.telegramHint')}
                />
              </div>

              <p className="text-xs text-muted">{t('bookingWindow.paidChannelsHint')}</p>

              <div className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:gap-4">
                <Checkbox
                  checked={value.smsEnabled}
                  onCheckedChange={(smsEnabled) => patch({ smsEnabled })}
                  label={t('bookingWindow.channelSms')}
                  classNames={{ root: 'sm:w-40' }}
                />
                <Select
                  className="w-full sm:w-48"
                  aria-label={t('bookingWindow.channelSms')}
                  disabled={!value.smsEnabled}
                  options={HOUR_OPTIONS.map((h) => ({ value: String(h), label: t('bookingWindow.hoursBefore', { h }) }))}
                  value={String(value.smsTimingHours)}
                  onValueChange={(v) => patch({ smsTimingHours: Number(v) })}
                />
              </div>

              <div className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:gap-4">
                <Checkbox
                  checked={value.emailEnabled}
                  onCheckedChange={(emailEnabled) => patch({ emailEnabled })}
                  label={t('bookingWindow.channelEmail')}
                  classNames={{ root: 'sm:w-40' }}
                />
                <Select
                  className="w-full sm:w-48"
                  aria-label={t('bookingWindow.channelEmail')}
                  disabled={!value.emailEnabled}
                  options={HOUR_OPTIONS.map((h) => ({ value: String(h), label: t('bookingWindow.hoursBefore', { h }) }))}
                  value={String(value.emailTimingHours)}
                  onValueChange={(v) => patch({ emailTimingHours: Number(v) })}
                />
              </div>
            </div>

            {/* ⭐ F-00-121: клиенту без приложения — «Напомнить» готовым текстом через WhatsApp, вместо платного SMS-каскада.
            F-05-114: кнопка мессенджера — только с правом видеть телефон клиента. */}
            {canPhones && draft.clientId && clientQ.data?.phone && (
              <a
                data-f="F-00-121 F-05-008 F-05-114"
                href={waLink(
                  clientQ.data.phone,
                  t('bookingWindow.remindWhatsappText', {
                    name: clientQ.data.name ? `, ${clientQ.data.name}` : '',
                    date: draft.start ? format.date(draft.start) : '',
                    time: draft.start ? format.time(draft.start) : '',
                  }),
                )}
                target="_blank"
                rel="noreferrer"
                className={cn(buttonClasses({ variant: 'outline', size: 'sm' }), 'self-start')}
              >
                <MessageCircleMore aria-hidden className="size-4" />
                {t('bookingWindow.remindViaWhatsapp')}
              </a>
            )}

            {/* F-05-082: «Отправить сообщение» — появляется, когда выбран клиент */}
            {draft.clientId && (
              <div data-f="F-05-082 F-01-093" className="flex flex-col gap-2 border-t border-border pt-4">
                <p className="text-sm font-medium text-fg">{t('bookingWindow.messageTitle')}</p>
                <Textarea
                  rows={2}
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder={t('bookingWindow.messagePlaceholder')}
                />
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-4">
                  {MESSAGE_CHANNELS.map((ch) => (
                    <Checkbox
                      key={ch}
                      checked={messageChannels.includes(ch)}
                      onCheckedChange={(checked) => setMessageChannels((cur) => (checked ? [...cur, ch] : cur.filter((c) => c !== ch)))}
                      label={channelLabel(ch, locale)}
                    />
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="self-start"
                  leftIcon={<Send aria-hidden />}
                  loading={sendMessage.isPending}
                  disabled={!messageText.trim() || messageChannels.length === 0}
                  onClick={handleSendMessage}
                >
                  {t('bookingWindow.messageSend')}
                </Button>

                {/* F-05-109: история сообщений этого клиента прямо в окне записи */}
                {history.length > 0 && (
                  <ul data-f="F-05-109" className="mt-2 flex flex-col gap-1.5 rounded-lg bg-surface-2 p-2.5">
                    {history.map((m) => (
                      <li key={m.id} className="flex flex-wrap items-center gap-2 text-xs text-muted">
                        <span>{m.createdAt.slice(0, 16).replace('T', ' ')}</span>
                        <Badge tone="neutral" size="sm">
                          {channelLabel(m.channel, locale)}
                        </Badge>
                        <span className="truncate text-fg">{sentText(m)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* F-05-089: «Отправить ссылку на оплату визита» — у нас пока ручная предоплата по реквизитам,
            ссылка и QR — демо (1:1 заменится реальной оплатой, когда она появится). */}
            {draft.clientId && bookingId && (
              <div data-f="F-05-089 F-01-144" className="flex flex-col gap-2 border-t border-border pt-4">
                <p className="text-sm font-medium text-fg">{t('bookingWindow.payment.title')}</p>
                <p className="text-xs text-muted">{t('bookingWindow.payment.hint')}</p>

                {/* Ссылка грузится — та же строка с кнопками, адрес — полосой */}
                {(
                  <div className="flex items-center gap-2 rounded-lg bg-surface-2 p-2.5">
                    <code className="flex-1 truncate text-xs text-fg">{paymentLinkQ.isLoading ? <SkeletonText width="32ch" /> : paymentLinkQ.data?.url}</code>
                    <IconButton
                      label={t('bookingWindow.payment.copy')}
                      icon={<Copy aria-hidden />}
                      variant="outline"
                      size="sm"
                      onClick={handleCopyPaymentLink}
                    />
                    <IconButton
                      label={t('bookingWindow.payment.showQr')}
                      icon={<QrCode aria-hidden />}
                      variant="outline"
                      size="sm"
                      onClick={() => setQrOpen(true)}
                    />
                  </div>
                )}

                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-4">
                  <Checkbox
                    checked={paymentChannels.includes('sms')}
                    onCheckedChange={(c) => setPaymentChannels((cur) => (c ? [...cur, 'sms'] : cur.filter((x) => x !== 'sms')))}
                    label={channelLabel('sms', locale)}
                    disabled={!clientQ.data?.phone}
                  />
                  <Checkbox
                    checked={paymentChannels.includes('email')}
                    onCheckedChange={(c) => setPaymentChannels((cur) => (c ? [...cur, 'email'] : cur.filter((x) => x !== 'email')))}
                    label={channelLabel('email', locale)}
                    disabled={!clientQ.data?.email}
                  />
                  {waConnected ? (
                    <Checkbox
                      checked={paymentChannels.includes('whatsapp')}
                      onCheckedChange={(c) => setPaymentChannels((cur) => (c ? [...cur, 'whatsapp'] : cur.filter((x) => x !== 'whatsapp')))}
                      label={channelLabel('whatsapp', locale)}
                      disabled={!clientQ.data?.phone}
                    />
                  ) : (
                    <Tooltip content={t('bookingWindow.payment.whatsappDisabledHint')}>
                      <span>
                        <Checkbox checked={false} disabled label={channelLabel('whatsapp', locale)} onCheckedChange={() => {}} />
                      </span>
                    </Tooltip>
                  )}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="self-start"
                  leftIcon={<Send aria-hidden />}
                  loading={sendPayment.isPending}
                  disabled={!clientQ.data?.phone && !clientQ.data?.email ? true : paymentChannels.length === 0}
                  onClick={handleSendPaymentLink}
                >
                  {t('bookingWindow.payment.send')}
                </Button>
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={handleSave} loading={save.isPending} disabled={!dirty}>
                {t('bookingWindow.save')}
              </Button>
            </div>
          </fieldset>
        </SectionCard>
      </div>

      {draft.clientId && bookingId && (
        <Modal open={qrOpen} onOpenChange={setQrOpen} title={t('bookingWindow.payment.showQr')} size="sm">
          <div className="flex flex-col items-center gap-3 py-2">
            <div className="grid grid-cols-9 gap-0.5 rounded-lg border border-border bg-surface p-3">
              {demoQrCells(paymentLinkQ.data?.url ?? bookingId).map((on, i) => (
                <span key={i} className={cn('block size-3 rounded-[2px]', on ? 'bg-fg' : 'bg-transparent')} />
              ))}
            </div>
            <code className="text-xs text-muted">{paymentLinkQ.data?.url}</code>
            <p className="text-center text-xs text-muted">{t('bookingWindow.payment.qrDemoNote')}</p>
          </div>
        </Modal>
      )}

      {/* F-05-087: «Чат Beta» — переписка с клиентом через подключённого партнёра, прямо в окне визита.
        Без партнёра — промо-карточка (как в «Журнал → Чат», F-01-164), с ним — полноценная переписка:
        история, отправка текста и файла, симуляция входящего для проверки F-05-088.
        F-05-114: без права видеть телефон клиента чат из записи недоступен вовсе. */}
      {draft.clientId && !canPhones && (
        <div data-f="F-05-114" className="mt-4">
          <SectionCard title={t('bookingWindow.chat.title')} description={t('bookingWindow.chat.hint')}>
            <p className="text-sm text-muted">{t('bookingWindow.chat.noPhonesPermission')}</p>
          </SectionCard>
        </div>
      )}
      {draft.clientId && canPhones && (
        <div data-f="F-05-087 F-05-088 F-01-074 F-05-114" className="mt-4">
          <SectionCard
            title={t('bookingWindow.chat.title')}
            description={t('bookingWindow.chat.hint')}
            actions={<MessagesSquare aria-hidden className="size-4 text-muted" />}
          >
            {chatStatusQ.isLoading ? (
              <Skeleton lines={3} />
            ) : !chatStatusQ.data ? (
              <EmptyState
                variant="section"
                icon={<MessagesSquare aria-hidden />}
                title={t('bookingWindow.chat.promoTitle')}
                description={t('bookingWindow.chat.promoText')}
                action={
                  <Link href="/biz/notifications/channels" className={buttonClasses({ variant: 'outline', size: 'sm' })}>
                    {t('bookingWindow.chat.promoConnect')}
                  </Link>
                }
              />
            ) : !chatPhone ? (
              <p className="text-sm text-muted">{t('bookingWindow.chat.noPhone')}</p>
            ) : (
              <div className="flex flex-col gap-3">
                {chatMessagesQ.isLoading ? (
                  <Skeleton lines={3} />
                ) : (chatMessagesQ.data ?? []).length === 0 ? (
                  <EmptyState
                    variant="section"
                    icon={<MessagesSquare aria-hidden />}
                    title={t('bookingWindow.chat.emptyTitle')}
                    description={t('bookingWindow.chat.emptyText')}
                  />
                ) : (
                  <ul className="flex max-h-72 flex-col gap-2 overflow-y-auto main-scrollbar rounded-lg bg-surface-2 p-2.5">
                    {(chatMessagesQ.data ?? []).map((m) => (
                      <li
                        key={m.id}
                        className={cn(
                          'max-w-[85%] rounded-lg px-3 py-2 text-sm',
                          m.direction === 'in' ? 'self-start bg-surface text-fg' : 'self-end bg-primary-soft text-fg',
                        )}
                      >
                        {m.attachmentName && (
                          <span className="mb-1 flex items-center gap-1 text-xs text-muted">
                            <Paperclip aria-hidden className="size-3" />
                            {m.attachmentName}
                          </span>
                        )}
                        <p>{m.text}</p>
                        <span className="mt-1 block text-right text-[11px] text-muted">{format.time(m.createdAt)}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {chatAttachment && (
                  <Badge tone="neutral" size="sm" className="self-start">
                    <Paperclip aria-hidden className="size-3" /> {chatAttachment}
                  </Badge>
                )}

                <div className="flex items-end gap-2">
                  <Textarea
                    rows={1}
                    value={chatText}
                    onChange={(e) => setChatText(e.target.value)}
                    placeholder={t('bookingWindow.chat.placeholder')}
                    className="flex-1"
                  />
                  <input ref={chatFileRef} type="file" className="sr-only" onChange={(e) => setChatAttachment(e.target.files?.[0]?.name)} />
                  <IconButton
                    label={t('bookingWindow.chat.attach')}
                    icon={<Paperclip aria-hidden />}
                    variant="outline"
                    onClick={() => chatFileRef.current?.click()}
                  />
                  <IconButton
                    label={t('bookingWindow.chat.send')}
                    icon={<Send aria-hidden />}
                    variant="primary"
                    disabled={sendChat.isPending || (!chatText.trim() && !chatAttachment)}
                    onClick={handleSendChat}
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-1.5">
                  <Link
                    href={`/biz/clients/${draft.clientId}`}
                    className="inline-flex min-h-10 items-center px-1 text-xs font-medium text-primary-text hover:underline"
                  >
                    {t('bookingWindow.chat.openClient')}
                  </Link>
                  <Button variant="ghost" size="sm" loading={simulateIncoming.isPending} onClick={handleSimulateIncoming}>
                    {t('bookingWindow.chat.simulate')}
                  </Button>
                </div>
              </div>
            )}
          </SectionCard>
        </div>
      )}
    </>
  );
}
