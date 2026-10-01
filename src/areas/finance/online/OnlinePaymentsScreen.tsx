'use client';

/**
 * /biz/finance/online — «Онлайн-платежи» (F-07-076): три способа принять деньги онлайн — «Оплата по ссылке»,
 * «Предоплата в виджете», «Онлайн-продажа абонементов и сертификатов» (ведёт в loyalty), плюс образцы
 * платёжных систем (F-07-077, 087, 134, 138, 140). ⭐ F-00-028: приём денег онлайн ещё не подключён —
 * работает только ручная предоплата по реквизитам (F-00-097), баннер об этом виден всегда и не прячется.
 */
import { useState } from 'react';
import Link from 'next/link';
import { CreditCard, ExternalLink, Gift, HelpCircle, Link2, QrCode, Ticket } from 'lucide-react';
import { getOnlinePaymentSettings, setOnlinePaymentProvider } from '@/api/finance';
import type { OnlinePaymentWay, OnlineProviderKey } from '@/domain/finance';
import { ONLINE_PROVIDERS } from '@/domain/finance';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useCan, useCurrent } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { ErrorState } from '@/ui/ErrorState';
import { Modal } from '@/ui/Modal';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';
import { Select } from '@/ui/Select';
import { useToast } from '@/ui/Toast';

const WAY_ICON: Record<OnlinePaymentWay, typeof Link2> = { link: Link2, widgetPrepayment: QrCode, onlineSales: Ticket };

export function OnlinePaymentsScreen() {
  const t = useT('finance');
  const toast = useToast();
  const { ready, businessId } = useCurrent();
  const canEdit = useCan('finance.edit');
  // F-07-076 — «Как это работает?»: всплывающее окно с описанием и примерами у каждой из трёх карточек
  const [howWay, setHowWay] = useState<OnlinePaymentWay | null>(null);

  const settingsQ = useApiQuery(['finance', 'onlinePaymentSettings', businessId], () => getOnlinePaymentSettings(businessId!), {
    enabled: ready && Boolean(businessId),
  });
  const setProviderM = useApiMutation((args: { way: OnlinePaymentWay; provider: OnlineProviderKey | null }) =>
    setOnlinePaymentProvider(businessId!, args.way, args.provider),
  );

  const handleProvider = async (way: OnlinePaymentWay, provider: string) => {
    try {
      await setProviderM.mutate({ way, provider: (provider || null) as OnlineProviderKey | null });
      settingsQ.refetch();
      toast.success(t('online.providerSaved'));
    } catch {
      toast.error(t('online.saveFailed'));
    }
  };

  if (settingsQ.isError) {
    return (
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
        <PageHeader title={t('nav.online')} />
        <ErrorState onRetry={() => settingsQ.refetch()} />
      </div>
    );
  }

  // Загрузка — та же страница: от настроек зависит только выбранная система в трёх списках (они пока выключены)
  const loading = settingsQ.isLoading || !settingsQ.data;

  const providerOptions = [
    { value: '', label: t('online.providerNone') },
    ...ONLINE_PROVIDERS.map((p) => ({ value: p.key, label: t(`online.provider.${p.key}`) })),
  ];

  const ways = [
    {
      way: 'link' as const,
      title: t('online.way.link.title'),
      description: t('online.way.link.description'),
      href: '/biz/finance/online/link',
      external: false,
    },
    {
      way: 'widgetPrepayment' as const,
      title: t('online.way.prepayment.title'),
      description: t('online.way.prepayment.description'),
      href: '/biz/finance/online/prepayment',
      external: false,
    },
    {
      way: 'onlineSales' as const,
      title: t('online.way.sales.title'),
      description: t('online.way.sales.description'),
      href: '/biz/loyalty/online-sales',
      external: true,
    },
  ];

  return (
    <div data-f="F-07-076 F-13-187" aria-busy={loading || undefined} className="mx-auto flex w-full max-w-[760px] flex-col gap-6 pb-24">
      <PageHeader title={t('nav.online')} description={t('online.subtitle')} />

      <div className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning-soft px-4 py-3.5 text-sm text-warning-text">
        <CreditCard aria-hidden className="mt-0.5 size-5 shrink-0" />
        <div className="flex flex-col gap-1">
          <p className="font-medium">{t('online.notConnectedTitle')}</p>
          <p className="text-warning-text/90">{t('online.notConnectedHint')}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {ways.map(({ way, title, description, href, external }) => {
          const Icon = WAY_ICON[way];
          const provider = settingsQ.data?.providerByWay[way];
          return (
            <Card key={way} data-f="F-07-077" className="flex flex-col gap-3">
              <div className="flex items-center gap-2.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-text">
                  <Icon aria-hidden className="size-4.5" />
                </span>
                <p className="font-semibold text-fg">{title}</p>
              </div>
              <p className="text-sm text-muted">{description}</p>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted">{t('online.providerLabel')}</span>
                <Select options={providerOptions} value={provider ?? ''} onValueChange={(v) => handleProvider(way, v)} disabled={!canEdit || loading} />
              </label>
              <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1.5">
                {href && (
                  <Link
                    href={href}
                    target={external ? '_blank' : undefined}
                    className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary-text underline decoration-border-strong underline-offset-2"
                  >
                    {t('online.openSettings')}
                    {external ? <ExternalLink aria-hidden className="size-3.5" /> : null}
                  </Link>
                )}
                <Button variant="link" className="inline-flex min-h-11 items-center gap-1 text-muted" onClick={() => setHowWay(way)}>
                  <HelpCircle aria-hidden className="size-3.5" />
                  {t('online.howItWorks.trigger')}
                </Button>
                {way === 'onlineSales' && (
                  <Link
                    data-f="F-07-131 F-07-132"
                    href="/biz/finance/online/orders"
                    className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary-text underline decoration-border-strong underline-offset-2"
                  >
                    {t('online.way.sales.manualOrders')}
                  </Link>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* F-07-087 — оплата переводом по реквизитам (у Altegio — PIX): в Армении — карта/Idram/Telcell мастера (F-00-097) */}
      <div data-f="F-07-087">
        <SectionCard title={t('online.pix.title')} description={t('online.pix.description')}>
          <div className="flex items-center gap-3">
            <Gift aria-hidden className="size-5 text-muted" />
            <p className="text-sm text-muted">{t('online.pix.hint')}</p>
          </div>
        </SectionCard>
      </div>

      {/* F-07-134/138/140/133/139/141…146/155 — платёжные системы. fin-review Ф4: армянские ArCa, Idram, Telcell и
          терминал банка вместо образцов чужих стран; интеграции — в планах.
          data-f — литералом на каждом div (не через PROVIDER_FID[key] в атрибуте): scripts/fids.mjs ищет
          data-f статической регуляркой по исходнику и не видит значение, вычисленное из объекта в рантайме. */}
      <SectionCard title={t('online.providers.title')} description={t('online.providers.description')}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div data-f="F-07-134 F-13-188 F-07-133" className="flex flex-col gap-2 rounded-xl border border-dashed border-border p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-fg">{t('online.provider.arca')}</span>
              <Badge tone="info">{t('online.plannedBadge')}</Badge>
            </div>
            <p className="text-xs text-muted">{t('online.providerHint.arca')}</p>
          </div>
          <div data-f="F-07-138 F-13-190 F-07-139 F-07-141" className="flex flex-col gap-2 rounded-xl border border-dashed border-border p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-fg">{t('online.provider.idram')}</span>
              <Badge tone="info">{t('online.plannedBadge')}</Badge>
            </div>
            <p className="text-xs text-muted">{t('online.providerHint.idram')}</p>
          </div>
          <div data-f="F-07-140 F-13-193 F-07-142 F-07-143" className="flex flex-col gap-2 rounded-xl border border-dashed border-border p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-fg">{t('online.provider.telcell')}</span>
              <Badge tone="info">{t('online.plannedBadge')}</Badge>
            </div>
            <p className="text-xs text-muted">{t('online.providerHint.telcell')}</p>
          </div>
          <div data-f="F-07-144 F-07-145 F-07-146 F-07-155" className="flex flex-col gap-2 rounded-xl border border-dashed border-border p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-fg">{t('online.provider.bankTerminal')}</span>
              <Badge tone="info">{t('online.plannedBadge')}</Badge>
            </div>
            <p className="text-xs text-muted">{t('online.providerHint.bankTerminal')}</p>
          </div>
        </div>
      </SectionCard>

      {/* F-07-098 — системные категории записи «Полная/Частичная онлайн-оплата» (значки читает journal, F-01-028) */}
      <div data-f="F-07-098">
        <SectionCard title={t('online.categories.title')} description={t('online.categories.description')}>
          <div className="flex flex-wrap gap-2">
            <Badge tone="success">{t('online.categories.full')}</Badge>
            <Badge tone="warning">{t('online.categories.partial')}</Badge>
          </div>
        </SectionCard>
      </div>

      <Modal
        open={howWay !== null}
        onOpenChange={(open) => !open && setHowWay(null)}
        title={howWay ? t(`online.howItWorks.${howWay}.title`) : ''}
        size="sm"
      >
        {howWay && (
          <div className="flex flex-col gap-3 text-sm text-fg">
            <p>{t(`online.howItWorks.${howWay}.description`)}</p>
            <div className="flex items-start gap-2.5 rounded-xl bg-surface-2 px-3.5 py-3 text-muted">
              <HelpCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
              <p>{t(`online.howItWorks.${howWay}.example`)}</p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
