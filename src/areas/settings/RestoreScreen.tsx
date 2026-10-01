'use client';

/**
 * /biz/onboarding/restore — восстановление пароля администратора (F-15-012, веб; F-15-013, «то же самое» в
 * приложении). ⭐ у мастера/владельца пароля нет — они входят номером и кодом (F-00-033), поэтому здесь только
 * администратор (F-00-034): email или телефон → код (демо: «0000») → новый пароль.
 *
 * ⚠️ Гостю сейчас сюда не попасть: страница лежит под /biz/**, а каркас кабинета (`BizShell`, не наш путь)
 * пускает только персон из BIZ_PERSONAS. Пока «Забыли пароль?» у администратора (client/LoginScreen.tsx) не
 * ведёт сюда и сама ссылка недоступна гостю — см. qa/requests/settings.md, пункт про гостевой доступ.
 */
import { useState } from 'react';
import { CheckCircle2, KeyRound } from 'lucide-react';
import { confirmPasswordReset, requestPasswordReset } from '@/api/settings';
import { useApiMutation } from '@/api/request';
import { useT } from '@/i18n/useT';
import { Button, LinkButton } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { CodeInput } from '@/ui/CodeInput';
import { EmptyState } from '@/ui/EmptyState';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { PageHeader } from '@/ui/PageHeader';

type Step = 'login' | 'code' | 'password' | 'done';

export function RestoreScreen() {
  const t = useT('settings');
  const [step, setStep] = useState<Step>('login');
  const [login, setLogin] = useState('');
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | undefined>(undefined);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | undefined>(undefined);

  const send = useApiMutation(requestPasswordReset);
  const confirm = useApiMutation(confirmPasswordReset);

  const handleSend = async () => {
    try {
      await send.mutate(login);
      setStep('code');
      setCode('');
      setCodeError(undefined);
    } catch {
      setCodeError(undefined);
    }
  };

  const handleSubmitPassword = async () => {
    setPasswordError(undefined);
    try {
      await confirm.mutate({ login, code, newPassword: password });
      setStep('done');
    } catch {
      setPasswordError(t('restore.weakPassword'));
    }
  };

  return (
    <div data-f="F-15-012 F-15-013" className="mx-auto flex max-w-sm flex-col gap-5 py-6">
      <PageHeader title={t('restore.title')} description={t('restore.subtitle')} />

      <Card padding="lg" className="flex flex-col gap-4">
        {step === 'login' ? (
          <>
            <FormField label={t('restore.loginLabel')} hint={t('restore.loginHint')}>
              <Input value={login} onChange={(e) => setLogin(e.target.value)} placeholder={t('restore.loginPlaceholder')} />
            </FormField>
            <Button onClick={() => void handleSend()} loading={send.isPending} disabled={!login.trim()} fullWidth>
              {t('restore.sendCode')}
            </Button>
          </>
        ) : null}

        {step === 'code' ? (
          <>
            <p className="text-sm text-muted">{t('restore.codeSentTo', { login })}</p>
            <FormField label={t('restore.codeLabel')} hint={t('restore.codeHint')} error={codeError}>
              <CodeInput value={code} onValueChange={setCode} invalid={Boolean(codeError)} />
            </FormField>
            <Button
              onClick={() => {
                if (code.length < 4) {
                  setCodeError(t('restore.codeWrong'));
                  return;
                }
                setCodeError(undefined);
                setStep('password');
              }}
              disabled={code.length < 4}
              fullWidth
            >
              {t('restore.continue')}
            </Button>
          </>
        ) : null}

        {step === 'password' ? (
          <>
            <FormField label={t('restore.newPasswordLabel')} error={passwordError}>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                invalid={Boolean(passwordError)}
              />
            </FormField>
            <Button onClick={() => void handleSubmitPassword()} loading={confirm.isPending} disabled={password.length < 4} fullWidth>
              {t('restore.setPassword')}
            </Button>
          </>
        ) : null}

        {step === 'done' ? (
          <EmptyState
            icon={<CheckCircle2 aria-hidden />}
            title={t('restore.doneTitle')}
            description={t('restore.doneDescription')}
            action={<LinkButton href="/login">{t('restore.toLogin')}</LinkButton>}
          />
        ) : null}
      </Card>

      {step !== 'done' ? (
        <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted">
          <KeyRound aria-hidden className="size-3.5" />
          {t('restore.masterHint')}
        </p>
      ) : null}
    </div>
  );
}
