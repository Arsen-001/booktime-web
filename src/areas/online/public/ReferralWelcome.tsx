'use client';

/**
 * ⭐ «Пригласи подругу»: подруга открыла личную ссылку `/b/<slug>?ref=<код>` — браузер запоминает код (lib/referralCapture),
 * а над страницей салона — кто пригласил и что ей положено. Запись (виджет или приложение) отдаёт код серверу,
 * привязку решает он. Код неизвестен или программа выключена — ничего не показываем.
 */
import { Gift } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useEffect, useSyncExternalStore } from 'react';
import { resolveReferralCode } from '@/api/referral';
import { useApiQuery } from '@/api/request';
import { normalizeReferralCode, REFERRAL_QUERY_PARAM } from '@/domain/rules/referral';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { readReferral, rememberReferral, subscribeReferral } from '@/lib/referralCapture';
import { Card } from '@/ui/Card';
import { Skeleton, SkeletonText } from '@/ui/Skeleton';

export function ReferralWelcome({ slug }: { slug: string }) {
  const t = useT('online');
  const fmt = useFormat();
  const params = useSearchParams();
  const fromUrl = normalizeReferralCode(params.get(REFERRAL_QUERY_PARAM));
  const stored = useSyncExternalStore(
    subscribeReferral,
    () => readReferral(slug),
    () => undefined,
  );
  useEffect(() => {
    if (fromUrl) rememberReferral(slug, fromUrl);
  }, [slug, fromUrl]);
  const code = fromUrl ?? stored;
  const q = useApiQuery(['loyalty', 'referral-landing', slug, code ?? ''], () => resolveReferralCode(slug, code ?? ''), { enabled: Boolean(code) });
  if (!code) return null;
  if (q.isLoading) {
    return (
      <Card padding="md" className="mb-4 flex items-start gap-3" aria-busy>
        <Skeleton variant="circle" className="shrink-0" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="font-semibold">
            <SkeletonText width="22ch" />
          </p>
          <p className="text-sm">
            <SkeletonText width="80%" />
          </p>
        </div>
      </Card>
    );
  }
  const data = q.data;
  if (!data) return null;
  const reward = data.inviteeReward
    ? data.inviteeReward.valueType === 'percent'
      ? t('public.referral.percent', { value: data.inviteeReward.value })
      : t('public.referral.fixed', { amount: fmt.money(data.inviteeReward.value) })
    : undefined;
  return (
    <Card padding="md" className="mb-4 flex items-start gap-3 border-primary/30 bg-primary-soft" data-f="F-06-081" data-testid="referral-welcome">
      <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-surface text-primary-text [&_svg]:size-5">
        <Gift />
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="font-semibold text-fg">{t('public.referral.title', { name: data.referrerName, business: data.businessName })}</p>
        <p className="text-sm text-fg">{reward ? t('public.referral.text', { reward }) : t('public.referral.textNoReward')}</p>
      </div>
    </Card>
  );
}
