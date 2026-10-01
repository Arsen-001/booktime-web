'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { CircleAlert } from 'lucide-react';
import { cn } from '@/lib/cn';
import { normalizePhone } from '@/lib/phone';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { CodeInput } from '@/ui/CodeInput';
import { FormField } from '@/ui/FormField';
import { PhoneInput } from '@/ui/PhoneInput';
import { CHANNEL_ICON, ChannelPicker, type PhoneVerifyChannel } from '@/ui/parts/ChannelPicker';
import { useControllableState } from '@/ui/hooks/useControllableState';

export type { PhoneVerifyChannel };
export type PhoneVerifyStep = 'phone' | 'code';


export interface PhoneVerifyInput {
  /** '+374XXXXXXXX' */
  phone: string;
  channel: PhoneVerifyChannel;
}

export interface PhoneVerifyProps {
  phone?: string;
  defaultPhone?: string;
  onPhoneChange?: (phone: string) => void;
  /** Куда можно прислать код; один — переключатель не показывается. По умолчанию WhatsApp, Telegram, SMS */
  channels?: PhoneVerifyChannel[];
  channel?: PhoneVerifyChannel;
  defaultChannel?: PhoneVerifyChannel;
  onChannelChange?: (channel: PhoneVerifyChannel) => void;
  /** Отправить код. Бросило ошибку — под номером «Не удалось отправить код» */
  onSendCode: (input: PhoneVerifyInput) => Promise<unknown> | void;
  /** Проверить код. Бросило ошибку — «Код не подошёл», клетки очищаются */
  onVerify: (input: PhoneVerifyInput & { code: string }) => Promise<unknown> | void;
  codeLength?: number;
  /** Через сколько секунд можно запросить новый код */
  resendAfterSec?: number;
  /** Свои поля шага номера (имя, согласие) — между способом и кнопкой */
  children?: ReactNode;
  /** Дополнительное условие отправки кроме полного номера (например, отмечено согласие) */
  canSend?: boolean;
  sendLabel?: ReactNode;
  verifyLabel?: ReactNode;
  /** Подсказка под клетками кода (например, «В демо подойдёт любой код») */
  codeHint?: ReactNode;
  /** Шаг снаружи (например, чтобы менять заголовок экрана) */
  step?: PhoneVerifyStep;
  onStepChange?: (step: PhoneVerifyStep) => void;
  className?: string;
}

/**
 * Подтверждение номера кодом: номер → способ (WhatsApp / Telegram / SMS) → код из сообщения → «ещё раз» через N секунд.
 * Один вид для входа клиента, записи в приложении и виджета (arch-a1 №4в). Сам ничего не отправляет —
 * отправку и проверку делает экран через onSendCode / onVerify (свои api-функции).
 */
export function PhoneVerify({
  phone,
  defaultPhone = '',
  onPhoneChange,
  channels = ['whatsapp', 'telegram', 'sms'],
  channel,
  defaultChannel,
  onChannelChange,
  onSendCode,
  onVerify,
  codeLength = 4,
  resendAfterSec = 30,
  children,
  canSend = true,
  sendLabel,
  verifyLabel,
  codeHint,
  step,
  onStepChange,
  className,
}: PhoneVerifyProps) {
  const t = useT('ui');
  const f = useFormat();
  const [currentPhone, setPhone] = useControllableState(phone, defaultPhone, onPhoneChange);
  const [currentChannel, setChannel] = useControllableState<PhoneVerifyChannel>(
    channel,
    defaultChannel ?? channels[0] ?? 'sms',
    onChannelChange,
  );
  const [currentStep, setStep] = useControllableState<PhoneVerifyStep>(step, 'phone', onStepChange);
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [sendError, setSendError] = useState(false);
  const [codeError, setCodeError] = useState(false);
  const [resent, setResent] = useState(false);
  const [left, setLeft] = useState(0);

  // Обратный отсчёт до «Отправить ещё раз»
  useEffect(() => {
    if (left <= 0) return;
    const id = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [left]);

  const normalized = normalizePhone(currentPhone);
  const channelNames: Record<PhoneVerifyChannel, string> = {
    whatsapp: t('phoneVerify.channel.whatsapp'),
    telegram: t('phoneVerify.channel.telegram'),
    sms: t('phoneVerify.channel.sms'),
  };
  const channelName = (c: PhoneVerifyChannel) => channelNames[c];

  const send = async (again: boolean) => {
    if (!normalized) return;
    setSending(true);
    setSendError(false);
    try {
      await onSendCode({ phone: normalized, channel: currentChannel });
      setCode('');
      setCodeError(false);
      setResent(again);
      setLeft(resendAfterSec);
      setStep('code');
    } catch {
      setSendError(true);
    } finally {
      setSending(false);
    }
  };

  const verify = async (value: string) => {
    if (!normalized || value.length < codeLength || verifying) return;
    setVerifying(true);
    setCodeError(false);
    try {
      await onVerify({ phone: normalized, channel: currentChannel, code: value });
    } catch {
      setCodeError(true);
      setCode('');
    } finally {
      setVerifying(false);
    }
  };

  const mmss = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;

  if (currentStep === 'code') {
    return (
      <div className={cn('flex animate-rise flex-col gap-5', className)}>
        <div className="flex items-center gap-3 rounded-2xl bg-primary-soft/60 p-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-surface text-primary-text shadow-xs [&_svg]:size-5">
            {CHANNEL_ICON[currentChannel]}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm leading-snug text-muted">
              {resent ? t('phoneVerify.resent', { channel: channelName(currentChannel) }) : t('phoneVerify.sentTo', { channel: channelName(currentChannel) })}
            </p>
            {/* Номер и «Изменить» в одну строку; не влезли (узкий экран, крупный шрифт) — «Изменить» переносится вниз */}
            <div className="flex flex-wrap items-center gap-x-3">
              <p className="nums text-base font-semibold whitespace-nowrap text-fg">{f.phone(normalized ?? currentPhone)}</p>
              <Button variant="link" size="sm" className="-my-1.5 -ml-1" onClick={() => setStep('phone')}>
                {t('phoneVerify.change')}
              </Button>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span aria-hidden className="text-sm font-medium text-fg">
            {t('phoneVerify.codeLabel')}
          </span>
          <CodeInput
            key={resent ? 'again' : 'first'}
            length={codeLength}
            value={code}
            onValueChange={(v) => {
              setCode(v);
              if (codeError) setCodeError(false);
            }}
            onComplete={verify}
            invalid={codeError}
            autoFocus
            aria-label={t('phoneVerify.codeLabel')}
          />
          {codeError ? (
            <p aria-live="polite" className="flex items-start gap-1.5 text-sm text-danger">
              <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
              <span>{t('phoneVerify.codeWrong')}</span>
            </p>
          ) : (
            codeHint && <p className="text-sm text-muted">{codeHint}</p>
          )}
        </div>

        <Button fullWidth size="lg" loading={verifying} disabled={code.length < codeLength} onClick={() => verify(code)}>
          {verifyLabel ?? t('phoneVerify.verify')}
        </Button>

        <div className="-mt-2 flex justify-center">
          {left > 0 ? (
            <p aria-live="off" className="nums flex min-h-10 items-center text-sm text-muted">
              {t('phoneVerify.resendIn', { time: mmss })}
            </p>
          ) : (
            <Button variant="ghost" size="sm" loading={sending} onClick={() => send(true)}>
              {t('phoneVerify.resend')}
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <FormField label={t('phoneVerify.phoneLabel')} error={sendError ? t('phoneVerify.sendFailed') : undefined}>
        <PhoneInput value={currentPhone} onValueChange={(v) => setPhone(v)} />
      </FormField>
      {channels.length > 1 && (
        <ChannelPicker
          label={t('phoneVerify.channelLabel')}
          channels={channels}
          value={currentChannel}
          onValueChange={setChannel}
          nameOf={channelName}
        />
      )}
      {children}
      <Button fullWidth size="lg" loading={sending} disabled={!normalized || !canSend} onClick={() => send(false)}>
        {sendLabel ?? t('phoneVerify.send')}
      </Button>
    </div>
  );
}
