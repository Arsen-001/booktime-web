'use client';

import { useEffect, useState } from 'react';
import { CircleCheck } from 'lucide-react';
import type { OnlineCodeChannel, OnlineCodeSent } from '@/api/online';
import { CodeChannelPicker, CodeSentVia } from '@/areas/online/booking/wizard/CodeChannelChoice';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { Button } from '@/ui/Button';
import { CodeInput } from '@/ui/CodeInput';

export type CodeState =
  | { kind: 'idle' }
  | { kind: 'sending' }
  /** via — куда код ушёл на самом деле и какие каналы ещё есть; requested — какой выбрал человек */
  /** resendAt — когда можно прислать код ещё раз (мс); до того кнопка повтора ждёт с обратным отсчётом */
  | { kind: 'sent'; demoCode?: string; via?: OnlineCodeSent; requested?: OnlineCodeChannel; resendAt?: number }
  | { kind: 'wrong'; via?: OnlineCodeSent; requested?: OnlineCodeChannel; resendAt?: number }
  /** tooMany — сервер ответил лимитом запросов кода (не «попробуйте ещё раз»: повтор сразу снова упрётся в лимит) */
  | { kind: 'sendFailed'; tooMany?: boolean };

/**
 * Подтверждение номера при записи (F-03-077, F-03-078). О9: «подтверждён» относится к конкретному номеру — сменили
 * номер, блок снова просит код. О14: код проверяется сам на 4-й цифре, без второй кнопки; поле с one-time-code.
 * О16: всё сообщается прямо здесь, без всплывающих сообщений поверх согласия и «Записаться».
 * Канал кода (03.10.2026): до отправки — выбор Telegram / WhatsApp, после — «Код отправлен в …» и «Прислать в …».
 */
export function PhoneCodeBlock({
  verified,
  remembered,
  state,
  code,
  onCodeChange,
  onSend,
  onVerify,
  onForget,
  error,
}: {
  verified: boolean;
  /** Номер подтверждён раньше в этом браузере (вход в кабинет / прошлая запись) */
  remembered: boolean;
  state: CodeState;
  code: string;
  onCodeChange: (v: string) => void;
  /** Отправить код в канал (Telegram / WhatsApp / SMS) */
  onSend: (channel: OnlineCodeChannel) => void;
  onVerify: (code: string) => void;
  onForget: () => void;
  error?: string;
}) {
  const t = useT('online');
  const [channel, setChannel] = useState<OnlineCodeChannel>('telegram');
  const shownVia = (state.kind === 'sent' || state.kind === 'wrong') && state.via ? { via: state.via, requested: state.requested } : undefined;
  // 16.11.2026: «Отправить код ещё раз» сразу после отправки упиралось в «повтор через 60 с» сервера и показывало
  // «Не удалось отправить код» — теперь кнопка ждёт с обратным отсчётом
  const resendAt = state.kind === 'sent' || state.kind === 'wrong' ? state.resendAt : undefined;
  const [now, setNow] = useState(() => Date.now());
  const left = resendAt ? Math.max(0, Math.ceil((resendAt - now) / 1000)) : 0;
  useEffect(() => {
    if (!resendAt || resendAt <= Date.now()) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [resendAt]);
  if (verified) {
    return (
      <div className="flex min-h-11 flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface-2 px-3 py-2" data-f="F-03-077 F-03-078">
        <p className="inline-flex items-center gap-1.5 text-sm font-medium text-success">
          <CircleCheck aria-hidden className="size-4" />
          {remembered ? t('booking.details.phoneRemembered') : t('booking.details.phoneVerified')}
        </p>
        {remembered && (
          <Button variant="link" size="sm" onClick={onForget}>
            {t('booking.details.notYou')}
          </Button>
        )}
      </div>
    );
  }
  const sent = state.kind === 'sent' || state.kind === 'wrong';
  return (
    <div
      className={cn('flex flex-col gap-3 rounded-xl border p-3', error ? 'border-danger bg-danger-soft' : 'border-border bg-surface-2')}
      data-f="F-03-077 F-03-078"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 flex-1 text-sm text-muted">{sent ? t('booking.details.codeEnterHint') : t('booking.details.verifyPhoneHint')}</p>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => onSend(shownVia?.via.channel ?? channel)}
          loading={state.kind === 'sending'}
          disabled={left > 0}
          type="button"
          className="tabular-nums"
        >
          {!sent
            ? t('booking.details.sendCode')
            : left > 0
              ? t('booking.details.resendIn', { time: `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` })
              : t('booking.details.resendCode')}
        </Button>
      </div>
      {!sent && <CodeChannelPicker value={channel} onChange={setChannel} />}
      {shownVia && <CodeSentVia sent={shownVia.via} requested={shownVia.requested} pending={state.kind === 'sending'} onSendVia={onSend} />}
      {sent && (
        <CodeInput
          length={4}
          value={code}
          onValueChange={onCodeChange}
          onComplete={onVerify}
          invalid={state.kind === 'wrong'}
          autoFocus
          aria-label={t('booking.details.codeLabel')}
        />
      )}
      {state.kind === 'sent' && state.demoCode && <p className="text-sm text-muted">{t('booking.details.codeDemoFilled', { code: state.demoCode })}</p>}
      {state.kind === 'wrong' && <p className="text-sm text-danger">{t('booking.details.codeWrong')}</p>}
      {state.kind === 'sendFailed' && <p className="text-sm text-danger">{t(state.tooMany ? 'booking.details.codeTooMany' : 'booking.details.codeSendFailed')}</p>}
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
