'use client';

/**
 * /biz/onboarding/invite/[token] — приглашение по ссылке открывает нужный салон (F-15-146): у кого аккаунта
 * нет — заводит его прямо здесь и принимает условия; у кого есть — обычный вход тем же телефоном/почтой,
 * которым он и раньше входил (см. `/login`, ветка «Бизнес»). Отказ от рассылок доступен уже на этом шаге.
 * Тот же путь «принял приглашение → стал сотрудником другого бизнеса» закрывает F-00-043/F-00-015:
 * индивидуал (персона `individual`, уже в кабинете — не гость) может принять приглашение в салон другого
 * индивидуала веткой «audience: existing» и стать там мастером, не теряя свой аккаунт.
 *
 * ⚠️ Упрощённый мок: приглашение хранится в своём срезе settings (`getInviteByToken`/`acceptInvite*`), а не в
 * настоящих приглашениях сотрудников (`StaffInvite`, src/api/staff.ts) — связь не сделана, см.
 * qa/requests/settings.md. ⚠️ Гостю (кто без аккаунта) сейчас сюда не попасть — тот же гостевой блокер, что у
 * восстановления пароля (страница под /biz/**, каркас кабинета не пускает персону guest).
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, ShieldCheck } from 'lucide-react';
import { acceptInviteAsExisting, acceptInviteAsNew, getInviteByToken } from '@/api/settings';
import { useApiMutation, useApiQuery } from '@/api/request';
import { SESSION_KEY } from '@/api/session';
import { useApplyDemo } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { normalizePhone } from '@/lib/phone';
import { Button, LinkButton } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Checkbox } from '@/ui/Checkbox';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { PageHeader } from '@/ui/PageHeader';
import { PhoneInput } from '@/ui/PhoneInput';
import { SkeletonText } from '@/ui/Skeleton';
import { useToast } from '@/ui/Toast';

/** Метка места названия салона в строке заголовка — пока грузится, на её месте полоса */
const TITLE_SLOT = '\u0000';

/** Заголовок «Приглашение в «…»» до данных: слова вокруг названия — как есть, само название — полосой */
function LoadingTitle({ text }: { text: string }) {
  const [before, after = ''] = text.split(TITLE_SLOT);
  return (
    <>
      {before}
      {/* Ширина — как у названия салона в демо («Nuri Nail Studio»): заголовок так же переносится во вторую строку */}
      <SkeletonText width="16ch" />
      {after}
    </>
  );
}

export function InviteAcceptScreen({ token }: { token: string }) {
  const t = useT('settings');
  const router = useRouter();
  const toast = useToast();
  const apply = useApplyDemo();

  const inviteQ = useApiQuery(['settings', 'invite', token], () => getInviteByToken(token));

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(true);
  const [touched, setTouched] = useState(false);

  // Живой сайт: после принятия у человека новое членство — сессия перечитывается
  const acceptNew = useApiMutation(acceptInviteAsNew, { invalidates: [SESSION_KEY] });
  const acceptExisting = useApiMutation(acceptInviteAsExisting, { invalidates: [SESSION_KEY] });

  const finish = (businessId: string, businessName: string, role: 'admin' | 'master') => {
    apply({ persona: role === 'admin' ? 'admin' : 'master' });
    toast.success(t('invite.accepted', { business: businessName }));
    router.push('/biz');
  };

  // До ответа — та же страница: заголовок с полосой вместо названия салона и форма нового сотрудника (так чаще всего
  // приходят по ссылке); поля можно заполнять уже сейчас, «Присоединиться» ждёт данных
  const loading = inviteQ.isLoading;

  if (inviteQ.isError) {
    return (
      <div className="mx-auto flex max-w-sm flex-col gap-5 py-6">
        <ErrorState onRetry={() => inviteQ.refetch()} />
      </div>
    );
  }

  const invite = inviteQ.data;

  if (!loading && (!invite || invite.status !== 'pending')) {
    return (
      <div className="mx-auto flex max-w-sm flex-col gap-5 py-6">
        <EmptyState
          icon={<ShieldCheck aria-hidden />}
          title={t('invite.notFoundTitle')}
          description={t('invite.notFoundDescription')}
          action={<LinkButton href="/login">{t('invite.toLogin')}</LinkButton>}
        />
      </div>
    );
  }

  const phoneValid = Boolean(normalizePhone(phone));
  const invalidName = touched && name.trim().length < 2;

  const handleAcceptNew = async () => {
    setTouched(true);
    if (!invite) return;
    if (name.trim().length < 2 || !phoneValid || !consent) return;
    try {
      const result = await acceptNew.mutate({ token, name: name.trim(), phone, consent, marketingOptIn });
      finish(result.businessId, result.businessName, result.role);
    } catch {
      toast.error(t('invite.acceptFailed'));
    }
  };

  const handleAcceptExisting = async () => {
    if (!invite) return;
    try {
      const result = await acceptExisting.mutate(token);
      finish(result.businessId, result.businessName, result.role);
    } catch {
      toast.error(t('invite.acceptFailed'));
    }
  };

  return (
    <div
      data-f="F-15-146 F-00-043 F-00-015 F-10-021 F-15-016"
      className="mx-auto flex max-w-sm flex-col gap-5 py-6"
    >
      {/* F-15-016: сотрудник принимает приглашение по ссылке/телефону — своей компании не регистрирует;
          у нас без пароля (мастер — по коду на номер, F-00-042); снятие доступа (revokeAccess в api/staff)
          не трогает личный аккаунт, только доступ к этой локации. */}
      <PageHeader
        title={invite ? t('invite.title', { business: invite.businessName }) : <LoadingTitle text={t('invite.title', { business: TITLE_SLOT })} />}
        description={invite ? t(invite.role === 'admin' ? 'invite.subtitleAdmin' : 'invite.subtitleMaster') : <SkeletonText width="24ch" />}
      />

      {invite?.audience === 'existing' ? (
        <Card padding="lg" className="flex flex-col gap-4" data-f="F-15-015">
          <p className="text-sm text-muted">{t('invite.existingHint')}</p>
          <Button onClick={() => void handleAcceptExisting()} loading={acceptExisting.isPending} fullWidth>
            {t('invite.continueToLogin')}
          </Button>
          <LinkButton href="/login" variant="ghost" fullWidth>
            {t('invite.signInInstead')}
          </LinkButton>
          <p className="text-center text-xs text-muted">{t('invite.wrongBusinessHint')}</p>
        </Card>
      ) : (
        <Card padding="lg" className="flex flex-col gap-4">
          <FormField label={t('invite.nameLabel')} error={invalidName ? t('invite.nameTooShort') : undefined} required>
            <Input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => setTouched(true)} invalid={invalidName} />
          </FormField>
          <FormField label={t('invite.phoneLabel')} required>
            <PhoneInput value={phone} onValueChange={setPhone} />
          </FormField>
          <div className="flex flex-col gap-2">
            <Checkbox checked={consent} onCheckedChange={setConsent} label={t('invite.consentLabel')} />
            <Checkbox checked={marketingOptIn} onCheckedChange={setMarketingOptIn} label={t('invite.marketingLabel')} />
          </div>
          <Button onClick={() => void handleAcceptNew()} loading={acceptNew.isPending} disabled={loading || !name.trim() || !phoneValid || !consent} fullWidth>
            {t('invite.join')}
          </Button>
          <p className="text-center text-sm text-muted">
            {t('invite.alreadyHaveAccount')}{' '}
            <LinkButton href="/login" variant="link" size="sm">
              {t('invite.signInInstead')}
            </LinkButton>
          </p>
        </Card>
      )}

      <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted">
        <CheckCircle2 aria-hidden className="size-3.5" />
        {t('invite.trapHint')}
      </p>
    </div>
  );
}
