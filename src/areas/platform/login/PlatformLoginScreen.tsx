'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { HttpApiError, isApiMode } from '@/api/http';
import { useApiMutation } from '@/api/request';
import { PLATFORM_SESSION_KEY, platformLogin, platformVerify, type SecondFactorChallenge } from '@/api/session';
import { useApplyDemo } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { Logo } from '@/shell/Logo';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { FormField } from '@/ui/FormField';
import { CodeInput } from '@/ui/CodeInput';
import { Input } from '@/ui/Input';

/**
 * Вход команды платформы в /platform (PLAN.md Р11, §8.1): логин + пароль, затем код на телефон — всегда.
 * В демо-сборке (mock) сервера нет: вход сразу открывает панель демо-персоной «Наша панель».
 */
export function PlatformLoginScreen() {
  const t = useT('platform');
  const router = useRouter();
  const apply = useApplyDemo();

  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [challenge, setChallenge] = useState<SecondFactorChallenge | undefined>(undefined);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  const [missing, setMissing] = useState<{ login?: boolean; password?: boolean }>({});

  const submit = useApiMutation(platformLogin);
  const verify = useApiMutation(platformVerify, { invalidates: [PLATFORM_SESSION_KEY] });

  const open = () => {
    apply({ persona: 'platform' });
    router.push('/platform');
  };

  const errorText = (e: unknown, fallback: string) =>
    e instanceof HttpApiError && (e.code === 'wrong_password' || e.code === 'account_blocked' || e.code === 'account_locked')
      ? t('login.wrongCredentials')
      : fallback;

  const handleLogin = async () => {
    setError(undefined);
    // Пустые поля — ошибка под полем, а не молча серая кнопка
    const empty = { login: !login.trim(), password: !password };
    if (empty.login || empty.password) return setMissing(empty);
    if (!isApiMode()) {
      open();
      return;
    }
    try {
      const r = await submit.mutate({ login, password });
      setChallenge(r.secondFactor);
      setCode('');
    } catch (e) {
      setError(errorText(e, t('login.failed')));
    }
  };

  const handleCode = async (value = code) => {
    if (!challenge || verify.isPending) return;
    if (value.length < 4) return setError(t('login.codeShort'));
    setError(undefined);
    try {
      await verify.mutate({ challengeId: challenge.challengeId, code: value });
      open();
    } catch (e) {
      setError(e instanceof HttpApiError && e.code.startsWith('code') ? t('login.codeWrong') : errorText(e, t('login.codeWrong')));
    }
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-5 px-4 py-10">
      <div className="flex flex-col gap-3">
        <Logo />
        <div>
          <h1 className="text-2xl font-semibold text-fg">{t('login.title')}</h1>
          <p className="mt-1 text-sm text-muted">{t('login.subtitle')}</p>
        </div>
      </div>
      <Card padding="lg" className="flex flex-col gap-4">
        {!challenge ? (
          <form
            noValidate
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void handleLogin();
            }}
          >
            <FormField label={t('login.loginLabel')} error={missing.login ? t('login.loginRequired') : undefined}>
              <Input
                value={login}
                onChange={(e) => {
                  setLogin(e.target.value);
                  setMissing((m) => ({ ...m, login: false }));
                }}
                autoComplete="username"
                autoFocus
                invalid={missing.login}
              />
            </FormField>
            <FormField label={t('login.passwordLabel')} error={missing.password ? t('login.passwordRequired') : error}>
              <Input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setMissing((m) => ({ ...m, password: false }));
                }}
                autoComplete="current-password"
                invalid={Boolean(error) || missing.password}
              />
            </FormField>
            <Button type="submit" loading={submit.isPending} fullWidth>
              {t('login.continue')}
            </Button>
          </form>
        ) : (
          <form
            noValidate
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void handleCode();
            }}
          >
            <p className="text-sm text-muted">{t('login.codeSentTo', { phone: challenge.phoneMasked, channel: challenge.channel ?? 'other' })}</p>
            <FormField label={t('login.codeLabel')} error={error}>
              {/* 4 клеточки; все введены — проверяем сразу, без лишнего нажатия */}
              <CodeInput
                value={code}
                onValueChange={(v) => {
                  setCode(v);
                  setError(undefined);
                }}
                onComplete={(v) => void handleCode(v)}
                invalid={Boolean(error)}
                autoFocus
                aria-label={t('login.codeLabel')}
              />
            </FormField>
            <Button type="submit" loading={verify.isPending} fullWidth>
              {t('login.verify')}
            </Button>
            <button type="button" className="min-h-10 self-start text-sm text-primary-text hover:underline" onClick={() => setChallenge(undefined)}>
              {t('login.back')}
            </button>
          </form>
        )}
      </Card>
    </div>
  );
}
