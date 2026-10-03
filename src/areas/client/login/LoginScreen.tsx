'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { GoogleSignInResult, LoginChannel, PendingGoogle } from '@/api/client';
import { changeAdminPassword, pendingLinkTokens, sendLoginCode, verifyAdminLogin, verifyBusinessPhoneLogin } from '@/api/client';
import type { SecondFactorChallenge } from '@/api/session';
import { SESSION_KEY, verifySecondFactor } from '@/api/session';
import { ClientCodeLogin } from '@/areas/client/login/ClientCodeLogin';
import { ChannelPicker, channelName, codeSentText, OtherChannelButtons, useLoginChannels } from '@/areas/client/login/CodeChannels';
import { GoogleSignIn, PendingGoogleNote, pendingTextKey } from '@/areas/client/login/GoogleSignIn';
import { loginErrorText } from '@/areas/client/login/loginError';
import { useApiMutation } from '@/api/request';
import { useApplyDemo } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { normalizePhone } from '@/lib/phone';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { FormField } from '@/ui/FormField';
import { CodeInput } from '@/ui/CodeInput';
import { Input } from '@/ui/Input';
import { Modal } from '@/ui/Modal';
import { PhoneInput } from '@/ui/PhoneInput';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { useToast } from '@/ui/Toast';

type Step = 'form' | 'code';
/** Роль на входе: клиент или бизнес — мастер/индивидуал/владелец (F-00-033) и администратор (F-00-034) */
type LoginRole = 'client' | 'business';
/** Способ входа бизнеса: по телефону (мастер/владелец) или логином и паролем (администратор) */
type BusinessMode = 'phone' | 'password';

/** Пользовательское соглашение — текст, который клиент читает перед согласием на входе (F-14-008) */
function AgreementModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useT('client');
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={t('login.agreementTitle')} size="md">
      <div className="flex flex-col gap-3 text-sm text-fg">
        <p>{t('login.agreementIntro')}</p>
        <p>{t('login.agreementData')}</p>
        <p>{t('login.agreementAnalytics')}</p>
        <p>{t('login.agreementScope')}</p>
      </div>
    </Modal>
  );
}

/** Вход клиента: имя + телефон → согласие на соглашение и обработку данных → код в WhatsApp/Telegram/SMS (F-00-032, F-14-006…F-14-008) */
export function LoginScreen({ next }: { next: string }) {
  const t = useT('client');
  // Пришли на вход из кабинета (/biz, в т.ч. приложение «BookTime Business») — сразу вкладка бизнеса
  const [role, setRole] = useState<LoginRole>(next.startsWith('/biz') ? 'business' : 'client');

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-5 py-6">
      <div>
        <h1 className="text-2xl font-semibold text-fg">{t('login.title')}</h1>
        <p className="mt-1 text-sm text-muted">{t(role === 'client' ? 'login.subtitle' : 'login.businessSubtitle')}</p>
      </div>

      <SegmentedControl
        value={role}
        onValueChange={(v) => setRole(v as LoginRole)}
        fullWidth
        options={[
          { value: 'client', label: t('login.roleClient') },
          { value: 'business', label: t('login.roleBusiness') },
        ]}
      />

      {role === 'client' ? <ClientLoginForm next={next} /> : <BusinessLogin />}

      {role === 'client' ? <p className="text-center text-xs text-muted">{t('login.guestNotice')}</p> : null}
    </div>
  );
}

/**
 * Клиентский вход: «Войти через Google» одним нажатием (03.10.2026) или имя, телефон и код (F-00-032, F-14-006…F-14-008) —
 * тот же вид, что и вход прямо в записи. Google ещё не привязан — та же форма номера и кода с пометкой «привяжем Google
 * к номеру»: номер подтверждает только код, дальше вход через Google — без кода.
 */
function ClientLoginForm({ next }: { next: string }) {
  const t = useT('client');
  const router = useRouter();
  const toast = useToast();
  const apply = useApplyDemo();
  const [agreementOpen, setAgreementOpen] = useState(false);
  const [pending, setPending] = useState<PendingGoogle | undefined>(undefined);

  const agreementLink = (
    <Button variant="link" size="sm" className="self-start" onClick={() => setAgreementOpen(true)}>
      {t('login.agreementLink')}
    </Button>
  );

  const onGoogle = (r: GoogleSignInResult) => {
    if (r.kind === 'linkRequired') {
      setPending(r.pending);
      return;
    }
    // Демо: user = null — демо-клиент по умолчанию
    apply({ persona: 'client', appUser: r.user?.id ?? '' });
    toast.success(t('login.success'));
    router.push(safeNext(next));
  };

  return (
    <div data-f="F-00-032 F-14-006 F-14-007 F-00-002 F-15-003 F-14-068">
      <Card padding="lg" className="flex flex-col gap-4">
        {pending ? (
          <PendingGoogleNote pending={pending} onCancel={() => setPending(undefined)} />
        ) : (
          <GoogleSignIn
            app="client"
            consent
            onResult={onGoogle}
            footer={<p className="text-center text-sm text-muted">{t('login.google.consentNote')}</p>}
          />
        )}
        <ClientCodeLogin
          key={pending?.token ?? 'phone'}
          google={pending}
          submitLabel={t('login.verify')}
          onVerified={(user) => {
            apply({ persona: 'client', appUser: user.id });
            if (pending && user.googleLinked === false) toast.error(t(pendingTextKey(pending, 'linkFailed')));
            else toast.success(t(pending ? pendingTextKey(pending, 'linked') : 'login.success'));
            router.push(safeNext(next));
          }}
          agreementAction={agreementLink}
        />
      </Card>
      <AgreementModal open={agreementOpen} onOpenChange={setAgreementOpen} />
    </div>
  );
}

/** Куда вернуть после входа — только свой путь приложения (не чужой сайт по ссылке /login?next=https://…) */
function safeNext(next: string): string {
  return next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

/** Вход бизнеса: телефон+код (мастер/индивидуал/владелец, F-00-033) или логин+пароль (администратор, F-00-034) */
function BusinessLogin() {
  const t = useT('client');
  const [mode, setMode] = useState<BusinessMode>('phone');

  return (
    <div data-f="F-00-033 F-00-034 F-15-004 F-15-011" className="flex flex-col gap-4">
      {/*
       * F-15-004 «Аккаунт без подтверждения телефона»: у нас наоборот — аккаунт/сессия появляется
       * только после verify(...) с кодом (BusinessPhoneLoginForm/AdminLoginForm ниже), это наше решение.
       * F-15-011 «Вход в кабинет»: мастер/владелец — телефон+код, администратор — логин+пароль, как здесь.
       */}
      <SegmentedControl
        value={mode}
        onValueChange={(v) => setMode(v as BusinessMode)}
        fullWidth
        options={[
          { value: 'phone', label: t('login.businessModePhone') },
          { value: 'password', label: t('login.businessModePassword') },
        ]}
      />

      {mode === 'phone' ? <BusinessPhoneLoginForm /> : <AdminLoginForm />}

      <p className="text-center text-sm text-muted">
        {t('login.noBusinessYet')}{' '}
        <Link href="/register-business" className="font-medium text-primary-text hover:underline">
          {t('login.registerBusinessLink')}
        </Link>
      </p>
    </div>
  );
}

/** Мастер/индивидуал/владелец входит номером телефона и кодом, как клиент (F-00-033) */
function BusinessPhoneLoginForm() {
  const t = useT('client');
  const router = useRouter();
  const toast = useToast();
  const apply = useApplyDemo();

  const [step, setStep] = useState<Step>('form');
  const [phone, setPhone] = useState('');
  const channels = useLoginChannels();
  const [channel, setChannel] = useState<LoginChannel>('telegram');
  /** Куда код ушёл на самом деле (сервер шлёт в запасной канал, если Telegram не доставил) и куда просили */
  const [sent, setSent] = useState<{ channel: LoginChannel; requested: LoginChannel; channels: LoginChannel[] } | undefined>(undefined);
  const [pendingChannel, setPendingChannel] = useState<LoginChannel | undefined>(undefined);
  const [left, setLeft] = useState(0);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | undefined>(undefined);
  /** «Войти через Google» — аккаунт ещё не привязан: номер и код один раз, потом вход одним нажатием (03.10.2026) */
  const [pending, setPending] = useState<PendingGoogle | undefined>(undefined);

  // Обратный отсчёт до повторной отправки (в тот же или другой канал)
  useEffect(() => {
    if (left <= 0) return;
    const id = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [left]);

  const sendCode = useApiMutation(({ phone: p, channel: c }: { phone: string; channel: LoginChannel }) => sendLoginCode(p, c));
  const verify = useApiMutation(verifyBusinessPhoneLogin, { invalidates: [SESSION_KEY] });

  const phoneValid = Boolean(normalizePhone(phone));

  const handleSend = async (c: LoginChannel = channel) => {
    setPendingChannel(c);
    try {
      const res = await sendCode.mutate({ phone, channel: c });
      setSent({ channel: res.channel, requested: c, channels: res.channels });
      setLeft(res.resendAfter);
      setStep('code');
      setCode('');
      setCodeError(undefined);
    } catch (error) {
      toast.error(loginErrorText(t, error, t('login.codeWrong')));
    } finally {
      setPendingChannel(undefined);
    }
  };

  const handleVerify = async (value = code) => {
    if (verify.isPending) return;
    setCodeError(undefined);
    try {
      const result = await verify.mutate({ phone, code: value, ...pendingLinkTokens(pending) });
      if (pending && result.googleLinked === false) toast.error(t(pendingTextKey(pending, 'linkFailed')));
      else toast.success(t(pending ? pendingTextKey(pending, 'linked') : 'login.success'));
      enter(result.hasBusiness);
    } catch (error) {
      setCodeError(loginErrorText(t, error, t('login.codeWrong')));
    }
  };

  // Номер вошёл, но своего бизнеса ещё нет — регистрация бизнеса (живой сайт, этап 3)
  const enter = (hasBusiness: boolean) => {
    if (!hasBusiness) {
      router.push('/register-business');
      return;
    }
    apply({ persona: 'owner' });
    router.push('/biz');
  };

  const onGoogle = (r: GoogleSignInResult) => {
    if (r.kind === 'linkRequired') {
      setPending(r.pending);
      setStep('form');
      return;
    }
    toast.success(t('login.success'));
    enter(r.hasBusiness);
  };

  return (
    <Card padding="lg" className="flex flex-col gap-4">
      {step === 'form' ? (
        <>
          {pending ? <PendingGoogleNote pending={pending} onCancel={() => setPending(undefined)} /> : <GoogleSignIn app="business" onResult={onGoogle} />}
          <FormField label={t('login.phoneLabel')}>
            <PhoneInput value={phone} onValueChange={setPhone} />
          </FormField>
          <ChannelPicker t={t} value={channel} onChange={setChannel} channels={channels} />
          <Button onClick={() => void handleSend()} loading={sendCode.isPending} disabled={!phoneValid} fullWidth>
            {t('login.continue')}
          </Button>
        </>
      ) : sent ? (
        <>
          <p className="text-sm text-muted">{codeSentText(t, phone, sent.channel)}</p>
          {sent.requested !== sent.channel && (
            <p className="-mt-2 text-sm text-muted">
              {t('login.channelFallback', { requested: channelName(t, sent.requested), channel: channelName(t, sent.channel) })}
            </p>
          )}
          <FormField label={t('login.codeLabel')} hint={t('login.codeHint')} error={codeError}>
            <CodeInput
              value={code}
              onValueChange={(v) => {
                setCode(v);
                if (codeError) setCodeError(undefined);
              }}
              onComplete={(v) => void handleVerify(v)}
              invalid={Boolean(codeError)}
              autoFocus
            />
          </FormField>
          <Button onClick={() => void handleVerify()} loading={verify.isPending} disabled={code.length < 4} fullWidth>
            {t('login.verify')}
          </Button>
          {left > 0 ? (
            <p aria-live="off" className="nums text-sm text-muted">
              {t('login.resendIn', { time: `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` })}
            </p>
          ) : (
            <Button
              variant="ghost"
              className="-ml-2 self-start"
              onClick={() => void handleSend(sent.channel)}
              loading={pendingChannel === sent.channel}
              disabled={pendingChannel !== undefined && pendingChannel !== sent.channel}
            >
              {t('login.resend')}
            </Button>
          )}
          <OtherChannelButtons t={t} current={sent.channel} channels={sent.channels} waiting={left > 0} pending={pendingChannel} onSend={(c) => void handleSend(c)} />
          <button type="button" className="min-h-11 self-start text-sm text-primary-text hover:underline" onClick={() => setStep('form')}>
            {t('login.changePhone')}
          </button>
        </>
      ) : null}
    </Card>
  );
}

/** Администратор входит логином и паролем, которые выдал владелец; при первом входе просит сменить пароль (F-00-034) */
function AdminLoginForm() {
  const t = useT('client');
  const router = useRouter();
  const toast = useToast();
  const apply = useApplyDemo();

  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  const [changeOpen, setChangeOpen] = useState(false);
  // Второй шаг (F-15-159): владелец включил проверку кодом — код приходит на телефон аккаунта
  const [challenge, setChallenge] = useState<SecondFactorChallenge | undefined>(undefined);
  const [code, setCode] = useState('');

  const submit = useApiMutation(verifyAdminLogin, { invalidates: [SESSION_KEY] });
  const confirmCode = useApiMutation(verifySecondFactor, { invalidates: [SESSION_KEY] });

  const finish = () => {
    apply({ persona: 'admin' });
    toast.success(t('login.success'));
    router.push('/biz');
  };

  const handleSubmit = async () => {
    setError(undefined);
    try {
      const result = await submit.mutate({ login, password });
      if (result.secondFactor) {
        setChallenge(result.secondFactor);
        setCode('');
        return;
      }
      if (result.requirePasswordChange) {
        setChangeOpen(true);
        return;
      }
      finish();
    } catch (e) {
      setError(loginErrorText(t, e, t('login.wrongCredentials')));
    }
  };

  const handleCode = async (value = code) => {
    if (!challenge || confirmCode.isPending) return;
    setError(undefined);
    try {
      const session = await confirmCode.mutate({ challengeId: challenge.challengeId, code: value });
      if (session.mustChangePassword) {
        setChangeOpen(true);
        return;
      }
      finish();
    } catch (e) {
      setError(loginErrorText(t, e, t('login.codeWrong')));
    }
  };

  if (challenge) {
    return (
      <Card padding="lg" className="flex flex-col gap-4">
        <p className="text-sm text-muted">{t('login.secondFactorSent', { phone: challenge.phoneMasked })}</p>
        <FormField label={t('login.secondFactorTitle')} error={error}>
          <CodeInput value={code} onValueChange={setCode} onComplete={(v) => void handleCode(v)} invalid={Boolean(error)} autoFocus />
        </FormField>
        <Button onClick={() => void handleCode()} loading={confirmCode.isPending} disabled={code.length < 4} fullWidth>
          {t('login.verify')}
        </Button>
        <button type="button" className="min-h-11 self-start text-sm text-primary-text hover:underline" onClick={() => setChallenge(undefined)}>
          {t('login.changePhone')}
        </button>
      </Card>
    );
  }

  return (
    <Card padding="lg">
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (login.trim() && password.length >= 4) void handleSubmit();
        }}
      >
      <FormField label={t('login.adminLoginLabel')}>
        <Input value={login} onChange={(e) => setLogin(e.target.value)} placeholder={t('login.adminLoginPlaceholder')} autoComplete="username" />
      </FormField>
      <FormField label={t('login.adminPasswordLabel')} error={error}>
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          invalid={Boolean(error)}
        />
      </FormField>
      <Button type="submit" loading={submit.isPending} disabled={!login.trim() || password.length < 4} fullWidth>
        {t('login.verify')}
      </Button>
      </form>

      <Modal open={changeOpen} onOpenChange={setChangeOpen} title={t('login.changePasswordTitle')} size="sm">
        <ChangePasswordForm
          login={login}
          onDone={() => {
            setChangeOpen(false);
            toast.success(t('login.passwordChanged'));
            finish();
          }}
        />
      </Modal>
    </Card>
  );
}

function ChangePasswordForm({ login, onDone }: { login: string; onDone: () => void }) {
  const t = useT('client');
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  const save = useApiMutation((password: string) => changeAdminPassword(login, password), { invalidates: [SESSION_KEY] });

  // Новый пароль сохраняется (сервер: от 6 символов, не равен логину; прежние сеансы этого входа закрываются)
  const handleSave = async () => {
    setError(undefined);
    try {
      await save.mutate(value);
      onDone();
    } catch (e) {
      setError(loginErrorText(t, e, t('login.errors.weakPassword')));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">{t('login.changePasswordHint')}</p>
      <FormField label={t('login.newPasswordLabel')} error={error}>
        <Input type="password" value={value} onChange={(e) => setValue(e.target.value)} autoComplete="new-password" invalid={Boolean(error)} />
      </FormField>
      <Button onClick={() => void handleSave()} loading={save.isPending} disabled={value.length < 6} fullWidth>
        {t('login.verify')}
      </Button>
    </div>
  );
}
