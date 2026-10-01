'use client';

/**
 * /biz/loyalty/referral — реферальная программа (F-06-081): скидка приглашённому на первый визит,
 * бонус пригласившему, общий выключатель. Отчёт по начислениям (F-06-085) — ссылка в Транзакции.
 */
import { useEffect, useState } from 'react';
import { getReferralSettings, listPromotions, setReferralSettings } from '@/api/loyalty';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import type { Id } from '@/domain/core';
import type { ReferralSettings } from '@/domain/loyalty';
import { useT } from '@/i18n/useT';
import { Button, LinkButton } from '@/ui/Button';
import { FormField } from '@/ui/FormField';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';
import { Select } from '@/ui/Select';
import { Switch } from '@/ui/Switch';
import { useToast } from '@/ui/Toast';
import { useRememberedLayout } from '@/ui/hooks/useSkeletonCount';

export function ReferralScreen() {
  const t = useT('loyalty');
  const toast = useToast();
  const { ready, businessId } = useCurrent();

  const promosQ = useApiQuery(['loyalty', 'promotions', businessId], () => listPromotions(businessId!), { enabled: ready && Boolean(businessId) });
  const settingsQ = useApiQuery(['loyalty', 'referral', businessId], () => getReferralSettings(businessId!), { enabled: ready && Boolean(businessId) });

  const [draft, setDraft] = useState<ReferralSettings | null>(null);
  const [seededFor, setSeededFor] = useState<Id | undefined>(undefined);
  if (settingsQ.data && seededFor !== businessId) {
    setSeededFor(businessId);
    setDraft(settingsQ.data);
  }

  const save = useApiMutation((next: ReferralSettings) => setReferralSettings(businessId!, next));

  const discountOptions = [{ value: '', label: t('autoApply.notApplied') }, ...(promosQ.data ?? []).filter((p) => p.kind.startsWith('discount')).map((p) => ({ value: p.id, label: p.name }))];
  const cashbackOptions = [{ value: '', label: t('autoApply.notApplied') }, ...(promosQ.data ?? []).filter((p) => p.kind.startsWith('cashback')).map((p) => ({ value: p.id, label: p.name }))];

  // Л11: включённая программа без скидки приглашённому или бонуса пригласившему ничего не даст — не сохраняем
  const [showErrors, setShowErrors] = useState(false);
  const inviteeMissing = Boolean(draft?.active && !draft.inviteePromotionId);
  const referrerMissing = Boolean(draft?.active && !draft.referrerPromotionId);

  const submit = async () => {
    if (!draft) return;
    if (inviteeMissing || referrerMissing) {
      setShowErrors(true);
      toast.error(t('referral.errors.fix'));
      return;
    }
    try {
      await save.mutate(draft);
      toast.success(t('referral.saved'));
    } catch {
      toast.error(t('referral.saveFailed'));
    }
  };

  // Подсказка «нет акций» под полем — есть ли она, известно только после загрузки. Пока грузится — как в прошлый раз
  // (иначе как в демо: скидка есть, кэшбэка нет), чтобы карточка не выросла, когда придут акции
  const [rememberedHints, saveHints] = useRememberedLayout<[boolean, boolean]>('referral-hints');
  const hintsLoaded: [boolean, boolean] = [discountOptions.length <= 1, cashbackOptions.length <= 1];
  useEffect(() => {
    if (!promosQ.isLoading && promosQ.data) saveHints(hintsLoaded);
  });

  // Загрузка — та же страница: карточки и поля на своих местах, поля выключены и пусты, пока не пришли настройки
  const loading = promosQ.isLoading || settingsQ.isLoading || !draft;
  const [showInviteeHint, showReferrerHint] = promosQ.isLoading ? (rememberedHints ?? [false, true]) : hintsLoaded;
  // Пока грузится — программа включена (так у заведённых бизнесов): тумблер не переезжает, когда придут настройки
  const form: ReferralSettings = draft ?? { businessId: businessId ?? '', active: true };
  const update = (next: ReferralSettings) => setDraft(next);

  return (
    <div data-f="F-06-081" className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
      <PageHeader
        title={t('referral.title')}
        description={t('referral.subtitle')}
        actions={
          <LinkButton href="/biz/loyalty/transactions?type=referralAccrual" variant="outline">
            {t('referral.report')}
          </LinkButton>
        }
      />

      <SectionCard title={t('referral.inviteeTitle')} description={t('referral.inviteeText')}>
        <FormField label={t('referral.inviteeTitle')} classNames={{ label: 'sr-only' }} error={showErrors && inviteeMissing ? t('referral.errors.inviteeRequired') : undefined} hint={showInviteeHint ? t('referral.noPromotions') : undefined}>
          <Select options={discountOptions} value={form.inviteePromotionId ?? ''} disabled={loading} onValueChange={(v) => update({ ...form, inviteePromotionId: v || undefined })} />
        </FormField>
      </SectionCard>

      <SectionCard title={t('referral.referrerTitle')} description={t('referral.referrerText')}>
        <FormField label={t('referral.referrerTitle')} classNames={{ label: 'sr-only' }} error={showErrors && referrerMissing ? t('referral.errors.referrerRequired') : undefined} hint={showReferrerHint ? t('referral.noPromotions') : undefined}>
          <Select options={cashbackOptions} value={form.referrerPromotionId ?? ''} disabled={loading} onValueChange={(v) => update({ ...form, referrerPromotionId: v || undefined })} />
        </FormField>
      </SectionCard>

      <SectionCard title={t('referral.activeTitle')}>
        <Switch checked={form.active} disabled={loading} onCheckedChange={(checked) => update({ ...form, active: checked })} label={t('referral.activeLabel')} labelPosition="start" />
      </SectionCard>

      <Button onClick={submit} loading={save.isPending} disabled={loading} className="self-start">
        {t('referral.save')}
      </Button>
    </div>
  );
}
