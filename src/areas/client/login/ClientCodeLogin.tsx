'use client';

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { MessageCircle, Send } from 'lucide-react';
import { sendLoginCode, verifyLoginCode, type LoginChannel } from '@/api/client';
import { useApiMutation } from '@/api/request';
import { loginErrorText } from '@/areas/client/login/loginError';
import type { AppUser } from '@/domain/core';
import { SESSION_KEY } from '@/api/session';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { normalizePhone } from '@/lib/phone';
import { Button } from '@/ui/Button';
import { Checkbox } from '@/ui/Checkbox';
import { CodeInput } from '@/ui/CodeInput';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { PhoneInput } from '@/ui/PhoneInput';
import { SegmentedControl } from '@/ui/SegmentedControl';

/** Через сколько секунд можно попросить код ещё раз */
const RESEND_AFTER_SEC = 30;

export interface ClientCodeLoginProps {
  /** Код подошёл — вход готов; экран решает, что дальше (перейти, создать запись). Бросило — текст ошибки под кодом */
  onVerified: (user: AppUser) => Promise<void> | void;
  /** Подпись кнопки на шаге кода («Войти», «Записаться») */
  submitLabel: string;
  /** Экран ещё что-то делает после входа (создаёт запись) — кнопка крутится */
  busy?: boolean;
  /** Ссылка «Читать соглашение» под галочкой согласия */
  agreementAction?: ReactNode;
}

/**
 * Вход клиента по номеру и коду — один вид на экране «Вход» и прямо в записи (F-00-032, F-14-006…F-14-008).
 * Шаг 1: имя, номер, куда прислать код (WhatsApp / Telegram; SMS — запасной, на шаге кода, decision-c1 №9), согласие.
 * Кнопка не бледнеет молча: нажали — под полями видно, чего не хватает; Enter отправляет форму.
 * Шаг 2: код клетками — четвёртая цифра сама проверяет код; «Отправить ещё раз» — через 30 с, со счётчиком.
 */
export function ClientCodeLogin({ onVerified, submitLabel, busy = false, agreementAction }: ClientCodeLoginProps) {
  const t = useT('client');
  const fmt = useFormat();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [channel, setChannel] = useState<LoginChannel>('whatsapp');
  const [consent, setConsent] = useState(false);
  const [step, setStep] = useState<'form' | 'code'>('form');
  const [code, setCode] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const [sendError, setSendError] = useState<string | undefined>(undefined);
  const [codeError, setCodeError] = useState<string | undefined>(undefined);
  const [left, setLeft] = useState(0);
  const send = useApiMutation(({ p, c }: { p: string; c: LoginChannel }) => sendLoginCode(p, c));
  const verify = useApiMutation(verifyLoginCode, { invalidates: [SESSION_KEY] });

  // Обратный отсчёт до «Отправить ещё раз»
  useEffect(() => {
    if (left <= 0) return;
    const id = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [left]);

  const normalized = normalizePhone(phone);
  const errors = {
    name: !name.trim() ? t('login.errorName') : undefined,
    phone: !normalized ? t('login.errorPhone') : undefined,
    consent: !consent ? t('login.consentRequired') : undefined,
  };

  const sendCode = async (c: LoginChannel) => {
    setSendError(undefined);
    try {
      await send.mutate({ p: phone, c });
      setChannel(c);
      setCode('');
      setCodeError(undefined);
      setLeft(RESEND_AFTER_SEC);
      setStep('code');
    } catch (e) {
      const text = loginErrorText(t, e, t('login.sendFailed'));
      if (step === 'code') setCodeError(text);
      else setSendError(text);
    }
  };

  const onSubmitForm = (e: FormEvent) => {
    e.preventDefault();
    if (errors.name || errors.phone || errors.consent) {
      setShowErrors(true);
      return;
    }
    void sendCode(channel);
  };

  const check = async (value: string) => {
    if (value.length < 4) {
      setCodeError(t('login.codeShort'));
      return;
    }
    if (verify.isPending || busy) return;
    setCodeError(undefined);
    try {
      const user = await verify.mutate({ name: name.trim(), phone, code: value, consent });
      await onVerified(user);
    } catch (e) {
      setCodeError(loginErrorText(t, e, t('login.codeWrong')));
      setCode('');
    }
  };

  const channelName = channel === 'whatsapp' ? t('login.channelWhatsapp') : channel === 'telegram' ? t('login.channelTelegram') : t('login.channelSms');
  const mmss = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;

  if (step === 'code') {
    return (
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void check(code);
        }}
        className="flex animate-rise flex-col gap-4"
      >
        <div className="flex flex-wrap items-center gap-x-2 text-sm text-muted">
          <span>{t('login.codeSentTo', { phone: normalized ? fmt.phone(normalized) : phone, channel: channelName })}</span>
          <Button variant="link" size="sm" className="-ml-1" onClick={() => setStep('form')}>
            {t('login.changePhone')}
          </Button>
        </div>
        <FormField label={t('login.codeLabel')} hint={codeError ? undefined : t('login.codeHint')} error={codeError}>
          <CodeInput
            value={code}
            onValueChange={(v) => {
              setCode(v);
              if (codeError) setCodeError(undefined);
            }}
            onComplete={(v) => void check(v)}
            invalid={Boolean(codeError)}
            autoFocus
          />
        </FormField>
        <Button type="submit" size="lg" fullWidth loading={verify.isPending || busy}>
          {submitLabel}
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-2">
          {left > 0 ? (
            <p aria-live="off" className="nums flex min-h-11 items-center text-sm text-muted">
              {t('login.resendIn', { time: mmss })}
            </p>
          ) : (
            <Button variant="ghost" className="-ml-2" onClick={() => void sendCode(channel)} loading={send.isPending}>
              {t('login.resend')}
            </Button>
          )}
          {channel !== 'sms' && (
            <Button variant="ghost" className="-mr-2" onClick={() => void sendCode('sms')} disabled={send.isPending}>
              {t('login.viaSms')}
            </Button>
          )}
        </div>
      </form>
    );
  }

  return (
    <form noValidate onSubmit={onSubmitForm} className="flex flex-col gap-4">
      <FormField label={t('login.nameLabel')} error={showErrors ? errors.name : undefined}>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('login.namePlaceholder')} autoComplete="given-name" />
      </FormField>
      <FormField label={t('login.phoneLabel')} error={showErrors ? errors.phone : sendError}>
        <PhoneInput value={phone} onValueChange={setPhone} />
      </FormField>
      <FormField label={t('login.channelLabel')}>
        <SegmentedControl
          value={channel === 'sms' ? 'whatsapp' : channel}
          onValueChange={(v) => setChannel(v as LoginChannel)}
          fullWidth
          options={[
            { value: 'whatsapp', label: t('login.channelWhatsapp'), icon: <MessageCircle aria-hidden /> },
            { value: 'telegram', label: t('login.channelTelegram'), icon: <Send aria-hidden /> },
          ]}
        />
      </FormField>
      <div data-f="F-14-008" className="flex flex-col gap-1">
        <Checkbox checked={consent} onCheckedChange={setConsent} label={t('login.consentText')} />
        {showErrors && errors.consent && <p className="text-sm text-danger">{errors.consent}</p>}
        {agreementAction}
      </div>
      <Button type="submit" size="lg" fullWidth loading={send.isPending}>
        {t('login.continue')}
      </Button>
    </form>
  );
}
