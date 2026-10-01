'use client';

import { CircleCheck } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { Button } from '@/ui/Button';
import { CodeInput } from '@/ui/CodeInput';

export type CodeState =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'sent'; demoCode?: string }
  | { kind: 'wrong' }
  | { kind: 'sendFailed' };

/**
 * Подтверждение номера при записи (F-03-077, F-03-078). О9: «подтверждён» относится к конкретному номеру — сменили
 * номер, блок снова просит код. О14: код проверяется сам на 4-й цифре, без второй кнопки; поле с one-time-code.
 * О16: всё сообщается прямо здесь, без всплывающих сообщений поверх согласия и «Записаться».
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
  onSend: () => void;
  onVerify: (code: string) => void;
  onForget: () => void;
  error?: string;
}) {
  const t = useT('online');
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
        <Button size="sm" variant="secondary" onClick={onSend} loading={state.kind === 'sending'} type="button">
          {sent ? t('booking.details.resendCode') : t('booking.details.sendCode')}
        </Button>
      </div>
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
      {state.kind === 'sendFailed' && <p className="text-sm text-danger">{t('booking.details.codeSendFailed')}</p>}
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
