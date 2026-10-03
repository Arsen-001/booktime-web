'use client';

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { pendingLinkTokens, sendLoginCode, verifyLoginCode, type LoginChannel, type PendingGoogle, type VerifiedAppUser } from '@/api/client';
import { useApiMutation } from '@/api/request';
import { ChannelPicker, channelName, codeSentText, OtherChannelButtons, useLoginChannels } from '@/areas/client/login/CodeChannels';
import { loginErrorText } from '@/areas/client/login/loginError';
import { SESSION_KEY } from '@/api/session';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { track } from '@/lib/analytics';
import { normalizePhone } from '@/lib/phone';
import { Button } from '@/ui/Button';
import { Checkbox } from '@/ui/Checkbox';
import { CodeInput } from '@/ui/CodeInput';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { PhoneInput } from '@/ui/PhoneInput';

export interface ClientCodeLoginProps {
  /** Код подошёл — вход готов; экран решает, что дальше (перейти, создать запись). Бросило — текст ошибки под кодом */
  onVerified: (user: VerifiedAppUser) => Promise<void> | void;
  /** Подпись кнопки на шаге кода («Войти», «Записаться») */
  submitLabel: string;
  /** Экран ещё что-то делает после входа (создаёт запись) — кнопка крутится */
  busy?: boolean;
  /** Ссылка «Читать соглашение» под галочкой согласия */
  agreementAction?: ReactNode;
  /**
   * «Войти через Google» с непривязанным аккаунтом (03.10.2026): имя — из Google, согласие уже дано под кнопкой Google,
   * верный код привяжет Google к номеру. Экран монтирует форму заново (key) при новом ожидании.
   */
  google?: PendingGoogle;
}

/**
 * Вход клиента по номеру и коду — один вид на экране «Вход» и прямо в записи (F-00-032, F-14-006…F-14-008).
 * Шаг 1: имя, номер, куда прислать код (Telegram / WhatsApp — из включённых на сервере; SMS — запасной, на шаге кода,
 * decision-c1 №9), согласие. Кнопка не бледнеет молча: нажали — под полями видно, чего не хватает; Enter отправляет форму.
 * Шаг 2: код клетками — четвёртая цифра сама проверяет код. «Код отправлен в …» — по каналу, куда код ушёл на самом
 * деле (сервер сам шлёт в запасной, если Telegram не доставил); «Отправить ещё раз» и «Прислать в WhatsApp / SMS» —
 * после отсчёта, который задаёт сервер (03.10.2026).
 */
export function ClientCodeLogin({ onVerified, submitLabel, busy = false, agreementAction, google }: ClientCodeLoginProps) {
  const t = useT('client');
  const fmt = useFormat();
  const [name, setName] = useState(google?.name ?? '');
  const [phone, setPhone] = useState('');
  const channels = useLoginChannels();
  /** Выбор на первом шаге — куда просить код */
  const [channel, setChannel] = useState<LoginChannel>('telegram');
  /** Куда код ушёл на самом деле и куда просили (разные — сервер отправил в запасной канал) */
  const [sent, setSent] = useState<{ channel: LoginChannel; requested: LoginChannel; channels: LoginChannel[] } | undefined>(undefined);
  const [pendingChannel, setPendingChannel] = useState<LoginChannel | undefined>(undefined);
  const [consent, setConsent] = useState(Boolean(google));
  const [step, setStep] = useState<'form' | 'code'>('form');
  const [code, setCode] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const [sendError, setSendError] = useState<string | undefined>(undefined);
  const [codeError, setCodeError] = useState<string | undefined>(undefined);
  const [left, setLeft] = useState(0);
  const send = useApiMutation(({ p, c }: { p: string; c: LoginChannel }) => sendLoginCode(p, c));
  const verify = useApiMutation(verifyLoginCode, { invalidates: [SESSION_KEY] });

  // Аналитика воронки: форма входа показана — в записи или на экране «Вход»
  useEffect(() => {
    track('login_shown', { context: window.location.pathname.startsWith('/login') ? 'login' : 'booking' });
  }, []);

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
    setPendingChannel(c);
    try {
      const res = await send.mutate({ p: phone, c });
      setSent({ channel: res.channel, requested: c, channels: res.channels });
      setCode('');
      setCodeError(undefined);
      setLeft(res.resendAfter);
      setStep('code');
    } catch (e) {
      const text = loginErrorText(t, e, t('login.sendFailed'));
      if (step === 'code') setCodeError(text);
      else setSendError(text);
    } finally {
      setPendingChannel(undefined);
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
      const user = await verify.mutate({ name: name.trim(), phone, code: value, consent, ...pendingLinkTokens(google) });
      track('login_completed', { method: google && google.provider !== 'apple' ? 'google' : 'code' });
      await onVerified(user);
    } catch (e) {
      setCodeError(loginErrorText(t, e, t('login.codeWrong')));
      setCode('');
    }
  };

  const mmss = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;

  if (step === 'code' && sent) {
    const shownPhone = normalized ? fmt.phone(normalized) : phone;
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
          <span>{codeSentText(t, shownPhone, sent.channel)}</span>
          <Button variant="link" size="sm" className="-ml-1" onClick={() => setStep('form')}>
            {t('login.changePhone')}
          </Button>
        </div>
        {sent.requested !== sent.channel && (
          <p className="-mt-2 text-sm text-muted">
            {t('login.channelFallback', { requested: channelName(t, sent.requested), channel: channelName(t, sent.channel) })}
          </p>
        )}
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
        <div className="flex flex-col gap-2">
          {left > 0 ? (
            <p aria-live="off" className="nums flex min-h-11 items-center text-sm text-muted">
              {t('login.resendIn', { time: mmss })}
            </p>
          ) : (
            <Button
              variant="ghost"
              className="-ml-2 self-start"
              onClick={() => void sendCode(sent.channel)}
              loading={pendingChannel === sent.channel}
              disabled={pendingChannel !== undefined && pendingChannel !== sent.channel}
            >
              {t('login.resend')}
            </Button>
          )}
          <OtherChannelButtons t={t} current={sent.channel} channels={sent.channels} waiting={left > 0} pending={pendingChannel} onSend={(c) => void sendCode(c)} />
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
      <ChannelPicker t={t} value={channel} onChange={setChannel} channels={channels} />
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
