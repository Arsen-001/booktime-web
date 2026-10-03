'use client';

import { MessageCircle, MessageSquare, Send } from 'lucide-react';
import { getLoginChannels, type LoginChannel } from '@/api/client';
import { useApiQuery } from '@/api/request';
import type { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { FormField } from '@/ui/FormField';
import { SegmentedControl } from '@/ui/SegmentedControl';

type ClientT = ReturnType<typeof useT<'client'>>;

/** Пока список каналов грузится — самый частый случай на сервере, чтобы выбор не прыгал */
const ASSUMED: LoginChannel[] = ['telegram', 'whatsapp', 'sms'];

/**
 * Включённые каналы кода (03.10.2026): Telegram всегда, WhatsApp и SMS — если настроены на сервере; в демо — все.
 * Порядок как на сервере: Telegram → WhatsApp → SMS.
 */
export function useLoginChannels(): LoginChannel[] {
  const q = useApiQuery(['auth', 'code-channels'], getLoginChannels);
  return q.data ?? ASSUMED;
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

/**
 * «Куда прислать код» на первом шаге: только мессенджеры (SMS — запасной, на шаге кода, F-00-032) и только включённые.
 * Включён один — выбирать нечего, поля нет.
 */
export function ChannelPicker({ t, value, onChange, channels }: { t: ClientT; value: LoginChannel; onChange: (c: LoginChannel) => void; channels: LoginChannel[] }) {
  const options: LoginChannel[] = channels.filter((c) => c !== 'sms');
  if (options.length < 2) return null;
  return (
    <FormField label={t('login.channelLabel')}>
      <SegmentedControl
        value={options.includes(value) ? value : options[0]!}
        onValueChange={(v) => onChange(v as LoginChannel)}
        fullWidth
        options={options.map((c) => {
          const Icon = ICONS[c];
          return { value: c, label: channelName(t, c), icon: <Icon aria-hidden /> };
        })}
      />
    </FormField>
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
  const others = channels.filter((c) => c !== current);
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
