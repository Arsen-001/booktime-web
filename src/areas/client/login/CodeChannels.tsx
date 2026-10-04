'use client';

import { MessageCircle, MessageSquare, Send } from 'lucide-react';
import { getLoginChannels, type LoginChannel } from '@/api/client';
import { useApiQuery } from '@/api/request';
import type { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { ChannelPicker as TilePicker } from '@/ui/parts/ChannelPicker';

type ClientT = ReturnType<typeof useT<'client'>>;

/** Пока список каналов грузится — самый частый случай на сервере, чтобы выбор не прыгал */
const ASSUMED: LoginChannel[] = ['telegram', 'whatsapp'];

/**
 * Включённые каналы кода (03.10.2026): Telegram всегда, WhatsApp — если настроен на сервере; в демо — оба.
 * Порядок как на сервере: Telegram → WhatsApp. SMS для кода нет (владелец 04.10.2026).
 */
export function useLoginChannels(): LoginChannel[] {
  const q = useApiQuery(['auth', 'code-channels'], getLoginChannels);
  return (q.data ?? ASSUMED).filter((c) => ALL_CHANNELS.includes(c));
}

export function channelName(t: ClientT, channel: LoginChannel): string {
  if (channel === 'whatsapp') return t('login.channelWhatsapp');
  if (channel === 'telegram') return t('login.channelTelegram');
  return t('login.channelSms');
}

/** «Код отправлен на … в Telegram / WhatsApp / по SMS» — по фактическому каналу из ответа сервера */
export function codeSentText(t: ClientT, phone: string, channel: LoginChannel): string {
  return channel === 'sms' ? t('login.codeSentToSms', { phone }) : t('login.codeSentTo', { phone, channel: channelName(t, channel) });
}

const ICONS: Record<LoginChannel, typeof Send> = { telegram: Send, whatsapp: MessageCircle, sms: MessageSquare };

const ALL_CHANNELS: LoginChannel[] = ['telegram', 'whatsapp'];

/**
 * «Куда прислать код» на первом шаге (владелец 04.10.2026: «откуда понять, куда придёт код?»): всегда две плитки
 * Telegram · WhatsApp (SMS убрали — владелец 04.10.2026), выключенные на сервере — неактивны с подписью «скоро», и под ними одна строка — куда именно
 * придёт код. Выбранный выключенный канал не остаётся: берётся первый включённый.
 */
export function ChannelPicker({ t, value, onChange, channels }: { t: ClientT; value: LoginChannel; onChange: (c: LoginChannel) => void; channels: LoginChannel[] }) {
  const enabled = ALL_CHANNELS.filter((c) => channels.includes(c));
  const current = enabled.includes(value) ? value : (enabled[0] ?? 'telegram');
  return (
    <div data-f="F-00-032" className="flex flex-col gap-2">
      <TilePicker
        label={t('login.channelLabel')}
        channels={ALL_CHANNELS}
        value={current}
        onValueChange={(c) => onChange(c as LoginChannel)}
        nameOf={(c) => channelName(t, c as LoginChannel)}
        disabled={ALL_CHANNELS.filter((c) => !channels.includes(c))}
        disabledNote={t('login.channelSoon')}
      />
      <p className="text-sm text-muted">{t(`login.channelWhere.${current}`)}</p>
    </div>
  );
}

function sendViaLabel(t: ClientT, channel: LoginChannel): string {
  if (channel === 'whatsapp') return t('login.sendViaWhatsapp');
  if (channel === 'telegram') return t('login.sendViaTelegram');
  return t('login.sendViaSms');
}

/**
 * Шаг кода: «Прислать в WhatsApp» / «Прислать в Telegram» / «Прислать SMS» — в каждый другой включённый канал.
 * Сервер считает это повторной отправкой (60 с между кодами, лимиты на номер), поэтому пока идёт отсчёт — кнопки ждут.
 */
export function OtherChannelButtons({
  t,
  current,
  channels,
  waiting,
  pending,
  onSend,
}: {
  t: ClientT;
  current: LoginChannel;
  channels: LoginChannel[];
  /** Идёт отсчёт до повтора */
  waiting: boolean;
  /** Канал, в который сейчас отправляется код */
  pending?: LoginChannel;
  onSend: (c: LoginChannel) => void;
}) {
  const others = channels.filter((c) => c !== current && ALL_CHANNELS.includes(c));
  if (others.length === 0) return null;
  return (
    <div data-f="F-00-032" className="flex flex-wrap items-center gap-2">
      {others.map((c) => {
        const Icon = ICONS[c];
        return (
          <Button
            key={c}
            variant="secondary"
            size="sm"
            leftIcon={<Icon aria-hidden />}
            onClick={() => onSend(c)}
            disabled={waiting || (pending !== undefined && pending !== c)}
            loading={pending === c}
          >
            {sendViaLabel(t, c)}
          </Button>
        );
      })}
    </div>
  );
}
