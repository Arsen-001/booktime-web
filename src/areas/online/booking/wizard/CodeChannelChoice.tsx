'use client';

/**
 * Куда прислать код при записи без входа и входе в кабинет на странице салона: всегда Telegram и WhatsApp, включённые — из
 * сервера, остальные видны неактивными («скоро»).
 * После отправки: «Код отправлен в WhatsApp» по факту (сервер мог переслать в запасной канал) и «Прислать в …».
 */
import { getLoginChannels } from '@/api/client-auth';
import type { OnlineCodeChannel, OnlineCodeSent } from '@/api/online';
import { useApiQuery } from '@/api/request';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { CHANNEL_ICON, ChannelPicker } from '@/ui/parts/ChannelPicker';

/** Пока список грузится — как обычно на сервере, чтобы выбор не прыгал */
const ASSUMED: OnlineCodeChannel[] = ['telegram'];

export function useCodeChannels(): OnlineCodeChannel[] {
  return (useApiQuery(['auth', 'code-channels'], getLoginChannels).data ?? ASSUMED).filter((c) => ALL.includes(c));
}

/** SMS для кода нет (владелец 04.10.2026: «нужно и Telegram, и WhatsApp») */
const ALL: OnlineCodeChannel[] = ['telegram', 'whatsapp'];

/**
 * Выбор до отправки (владелец 04.10.2026: «откуда понять, куда придёт код?»): всегда Telegram · WhatsApp,
 * не подключённые на сервере — неактивны с «скоро»; под плитками — куда именно придёт код.
 */
export function CodeChannelPicker({ value, onChange }: { value: OnlineCodeChannel; onChange: (c: OnlineCodeChannel) => void }) {
  const t = useT('online');
  const enabled = useCodeChannels();
  const current = enabled.includes(value) ? value : (ALL.find((c) => enabled.includes(c)) ?? 'telegram');
  return (
    <div className="flex flex-col gap-2">
      <ChannelPicker
        label={t('booking.details.channelLabel')}
        channels={ALL}
        value={current}
        onValueChange={(c) => onChange(c)}
        nameOf={(c) => t(`booking.details.channel.${c}`)}
        disabled={ALL.filter((c) => !enabled.includes(c))}
        disabledNote={t('booking.details.channelSoon')}
      />
      <p className="text-sm text-muted">{t(`booking.details.channelWhere.${current}`)}</p>
    </div>
  );
}

/** После отправки: куда ушёл код и кнопки других включённых каналов */
export function CodeSentVia({ sent, requested, pending, onSendVia }: { sent: OnlineCodeSent; requested?: OnlineCodeChannel; pending: boolean; onSendVia: (c: OnlineCodeChannel) => void }) {
  const t = useT('online');
  const others = sent.channels.filter((c) => c !== sent.channel && ALL.includes(c));
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted">
        {t('booking.details.codeSentVia', { channel: sent.channel })}
        {requested && requested !== sent.channel && ` ${t('booking.details.codeFallback', { requested })}`}
      </p>
      {others.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {others.map((c) => (
            <Button key={c} size="sm" variant="outline" type="button" leftIcon={CHANNEL_ICON[c]} disabled={pending} onClick={() => onSendVia(c)}>
              {t(`booking.details.sendVia.${c}`)}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
