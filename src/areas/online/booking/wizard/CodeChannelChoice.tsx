'use client';

/**
 * Куда прислать код при записи без входа и входе в кабинет на странице салона (03.10.2026): Telegram / WhatsApp —
 * из каналов, включённых на сервере (SMS — только запасной, кнопкой после отправки). Включён один — выбирать нечего.
 * После отправки: «Код отправлен в WhatsApp» по факту (сервер мог переслать в запасной канал) и «Прислать в …».
 */
import { getLoginChannels } from '@/api/client';
import type { OnlineCodeChannel, OnlineCodeSent } from '@/api/online';
import { useApiQuery } from '@/api/request';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { CHANNEL_ICON, ChannelPicker } from '@/ui/parts/ChannelPicker';

/** Пока список грузится — как обычно на сервере, чтобы выбор не прыгал */
const ASSUMED: OnlineCodeChannel[] = ['telegram'];

export function useCodeChannels(): OnlineCodeChannel[] {
  return useApiQuery(['auth', 'code-channels'], getLoginChannels).data ?? ASSUMED;
}

/** Выбор до отправки: только мессенджеры; меньше двух — ничего не рисуем */
export function CodeChannelPicker({ value, onChange }: { value: OnlineCodeChannel; onChange: (c: OnlineCodeChannel) => void }) {
  const t = useT('online');
  const messengers: OnlineCodeChannel[] = useCodeChannels().filter((c) => c !== 'sms');
  if (messengers.length < 2) return null;
  return (
    <ChannelPicker
      label={t('booking.details.channelLabel')}
      channels={messengers}
      value={messengers.includes(value) ? value : messengers[0]!}
      onValueChange={(c) => onChange(c)}
      nameOf={(c) => t(`booking.details.channel.${c}`)}
    />
  );
}

/** После отправки: куда ушёл код и кнопки других включённых каналов */
export function CodeSentVia({ sent, requested, pending, onSendVia }: { sent: OnlineCodeSent; requested?: OnlineCodeChannel; pending: boolean; onSendVia: (c: OnlineCodeChannel) => void }) {
  const t = useT('online');
  const others = sent.channels.filter((c) => c !== sent.channel);
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
