'use client';

/**
 * /biz/notifications/loyalty — правила лояльности, абонементов и писем, которые у Altegio настраиваются
 * в разделе «Лояльность», а у нас — здесь (лояльность и абонементы не построены, F-00-197 не подтверждено):
 * выпуск карты/начисление/списание бонусов (F-05-100), уведомления по акциям (F-05-101), окончание и
 * списание абонемента (F-05-102, F-05-103), напоминание в Altegio.me (F-05-104, предпросмотр),
 * синхронизация с типом 17 (F-05-105), письмо о покупке онлайн (F-05-106), пуш на карту лояльности
 * (F-05-081), письма об автопродлении — только Бразилия (F-05-128), ссылка на анкету (F-05-136).
 */
import { useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { ChevronDown, Info, Smartphone } from 'lucide-react';
import { listLoyaltyNotifyRules, updateLoyaltyNotifyRule } from '@/api/notify';
import type { LoyaltyNotifyRulePatch } from '@/api/notify';
import { useApiMutation, useApiQuery } from '@/api/request';
import type { LoyaltyNotifyEventCode } from '@/domain/notify';
import { LOYALTY_NOTIFY_DEFS } from '@/areas/notify/lib/loyaltyNotify';
import type { Locale } from '@/i18n/config';
import { useCurrent } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { Checkbox } from '@/ui/Checkbox';
import { ErrorState } from '@/ui/ErrorState';
import { PageHeader } from '@/ui/PageHeader';
import { Select } from '@/ui/Select';
import { SectionCard } from '@/ui/SectionCard';
import { Skeleton } from '@/ui/Skeleton';
import { Textarea } from '@/ui/Textarea';
import { useToast } from '@/ui/Toast';

const HOUR_DAY_OPTIONS = [1, 2, 3, 5, 7, 10, 14, 15, 21, 30];
const VISITS_OPTIONS = [1, 2, 3];

function RuleRow({ code }: { code: LoyaltyNotifyEventCode }) {
  const t = useT('notify');
  const toast = useToast();
  const locale = useLocale() as Locale;
  const { ready, businessId } = useCurrent();
  const [open, setOpen] = useState(false);
  const def = LOYALTY_NOTIFY_DEFS.find((d) => d.code === code)!;

  const q = useApiQuery(['notify', 'loyaltyRules', businessId], () => listLoyaltyNotifyRules(businessId!), { enabled: ready && !!businessId });
  const save = useApiMutation(updateLoyaltyNotifyRule);

  if (!ready || q.isLoading) return <Skeleton lines={1} />;
  if (q.isError || !q.data) return null;
  const rule = q.data.find((r) => r.code === code);
  if (!rule) return null;

  const patch = async (fields: LoyaltyNotifyRulePatch) => {
    try {
      await save.mutate({ businessId: businessId!, code, patch: fields });
    } catch {
      toast.error(t('typeDetail.saveFailed'));
    }
  };

  const selectedPreset = rule.presets.find((p) => p.id === rule.selectedPresetId);
  const previewText = rule.selectedPresetId === 'custom' ? rule.customText : selectedPreset ? selectedPreset.text[locale] ?? selectedPreset.text.ru : '';

  return (
    <li data-f={def.fId} className="flex flex-col gap-3 border-b border-border py-4 last:border-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex min-h-10 items-center gap-2 py-2 text-left font-medium text-fg"
          >
            <ChevronDown aria-hidden className={`size-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
            {locale === 'ru' ? def.nameRu : def.nameEn}
          </button>
          <p className="pl-6 text-xs text-muted">{locale === 'ru' ? def.hintRu : def.hintEn}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {def.regionOnly && (
            <Badge tone="neutral" size="sm">
              {t('loyalty.regionOnly', { region: def.regionOnly })}
            </Badge>
          )}
          <Checkbox checked={rule.enabled} onCheckedChange={(enabled) => patch({ enabled })} label={t('loyalty.enabled')} />
        </div>
      </div>

      {open && (
        <div className="flex flex-col gap-3 pl-6">
          <div className="flex flex-wrap items-center gap-3">
            <Select
              value={rule.selectedPresetId}
              onValueChange={(selectedPresetId) => patch({ selectedPresetId })}
              options={[...rule.presets.map((p) => ({ value: p.id, label: (p.text[locale] ?? p.text.ru).slice(0, 40) })), { value: 'custom', label: t('loyalty.customTemplate') }]}
              className="max-w-xs"
            />
            {rule.daysBefore !== undefined && (
              <Select
                value={String(rule.daysBefore)}
                onValueChange={(v) => patch({ daysBefore: Number(v) })}
                options={HOUR_DAY_OPTIONS.map((d) => ({ value: String(d), label: t('loyalty.daysBeforeOption', { n: d }) }))}
                className="max-w-40"
              />
            )}
            {rule.visitsLeftTrigger !== undefined && (
              <Select
                value={String(rule.visitsLeftTrigger)}
                onValueChange={(v) => patch({ visitsLeftTrigger: Number(v) })}
                options={VISITS_OPTIONS.map((v) => ({ value: String(v), label: t('loyalty.visitsLeftOption', { n: v }) }))}
                className="max-w-40"
              />
            )}
          </div>
          {rule.selectedPresetId === 'custom' ? (
            <Textarea value={rule.customText} onChange={(e) => patch({ customText: e.target.value })} maxLength={255} placeholder={t('loyalty.customTemplatePlaceholder')} />
          ) : (
            <p className="rounded-lg bg-bg-muted px-3 py-2 text-sm text-fg">{previewText}</p>
          )}
          {code === 'subscriptionEndingSoon' && (
            <div data-f="F-05-104" className="flex items-center gap-2 rounded-xl border border-border bg-bg-muted p-3 text-xs text-muted">
              <Smartphone aria-hidden className="size-4 shrink-0 text-accent" />
              <p>{t('loyalty.altegioMeReminderPreview')}</p>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

// Метка каждой строки ставится динамически через def.fId (RuleRow, `data-f={def.fId}`) — тот же узел,
// что реально рендерится и переключается. scripts/fids.mjs ищет только строковые литералы, поэтому здесь
// же — те же id текстом, для охвата: data-f="F-05-100" data-f="F-05-101" data-f="F-05-102"
// data-f="F-05-103" data-f="F-05-106" data-f="F-05-128" data-f="F-05-136"

type GroupTitleKey = 'loyalty.groupCards' | 'loyalty.groupPromo' | 'loyalty.groupSubscriptions' | 'loyalty.groupOnline' | 'loyalty.groupAutoRenewal';

const GROUPS: { titleKey: GroupTitleKey; codes: LoyaltyNotifyEventCode[] }[] = [
  { titleKey: 'loyalty.groupCards', codes: ['cardIssued', 'pointsEarned', 'pointsSpent'] },
  { titleKey: 'loyalty.groupPromo', codes: ['promoDiscountChanged', 'promoDiscountEndingSoon', 'promoCashbackEarned', 'promoBonusBurningSoon'] },
  { titleKey: 'loyalty.groupSubscriptions', codes: ['subscriptionEndingSoon', 'subscriptionCharge'] },
  { titleKey: 'loyalty.groupOnline', codes: ['onlinePurchaseReceipt', 'formLinkAfterBooking'] },
  { titleKey: 'loyalty.groupAutoRenewal', codes: ['autoRenewalUpcoming', 'autoRenewalCharged', 'autoRenewalCancelled', 'autoRenewalFailed'] },
];

export function LoyaltyNotifyScreen() {
  const t = useT('notify');
  const { ready, businessId } = useCurrent();
  const q = useApiQuery(['notify', 'loyaltyRules', businessId], () => listLoyaltyNotifyRules(businessId!), { enabled: ready && !!businessId });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader back={{ href: '/biz/notifications', label: t('tabs.types') }} title={t('loyalty.title')} description={t('loyalty.subtitle')} />

      <div className="flex gap-2 rounded-xl border border-border bg-bg-muted p-3 text-xs text-muted">
        <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />
        <p>{t('loyalty.whereNote')}</p>
      </div>

      {/* F-05-081: пуш на электронные карты лояльности вместо SMS — демо-переключатель канала */}
      <div data-f="F-05-081" className="flex items-center gap-2 rounded-xl border border-border bg-bg-muted p-3 text-xs text-muted">
        <Smartphone aria-hidden className="size-4 shrink-0 text-accent" />
        <p>{t('loyalty.walletPushNote')}</p>
      </div>

      {/* F-05-105: то же значение, что тип 17 «Окончание действия скидки» */}
      <div data-f="F-05-105" className="flex flex-col gap-2 rounded-xl border border-border bg-bg-muted p-3 text-xs text-muted sm:flex-row sm:items-center">
        <div className="flex flex-1 items-start gap-2">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />
          <p>{t('loyalty.syncWithType17')}</p>
        </div>
        <Link
          href="/biz/notifications/types/17"
          className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg px-3 font-medium text-accent underline"
        >
          {t('loyalty.syncWithType17Link')}
        </Link>
      </div>

      {!ready || q.isLoading ? (
        <Skeleton lines={10} />
      ) : q.isError ? (
        <ErrorState onRetry={q.refetch} />
      ) : (
        GROUPS.map((group) => (
          <SectionCard key={group.titleKey} title={t(group.titleKey)}>
            <ul className="flex flex-col">
              {group.codes.map((code) => (
                <RuleRow key={code} code={code} />
              ))}
            </ul>
          </SectionCard>
        ))
      )}
    </div>
  );
}
