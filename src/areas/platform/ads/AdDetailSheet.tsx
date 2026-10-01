'use client';

/** Объявление: картинка крупно, где/кому/когда/цена, отчёт рекламодателю (только показы и нажатия, F-00-166). */
import Image from 'next/image';
import { Pause, Play } from 'lucide-react';
import { setAdPaused } from '@/api/platform';
import { patchInList, useApiMutation } from '@/api/request';
import { useAdText } from '@/areas/platform/ads/adText';
import { AD_TONE } from '@/areas/platform/lib/tones';
import { clickRate, type AdView } from '@/domain/platform';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { KeyValueList } from '@/ui/KeyValueList';
import { Sheet } from '@/ui/Sheet';
import { StatCard } from '@/ui/StatCard';
import { useToast } from '@/ui/Toast';

export function AdDetailSheet({ ad, onClose }: { ad: AdView; onClose: () => void }) {
  const t = useT('platform');
  const fmt = useFormat();
  const toast = useToast();
  const text = useAdText();
  const pause = useApiMutation((a: { id: string; paused: boolean }) => setAdPaused(a.id, a.paused), {
    optimistic: patchInList(['platform', 'ads'], (a: { id: string; paused: boolean }) => ({ id: a.id, patch: { paused: a.paused, state: a.paused ? 'paused' : 'running' } })),
  });
  const toggle = async () => {
    try {
      await pause.mutate({ id: ad.id, paused: !ad.paused });
      toast.success(ad.paused ? t('ads.resumed') : t('ads.paused'));
    } catch {
      toast.error(t('ads.saveFailed'));
    }
  };
  const canToggle = ad.state !== 'finished';

  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      title={ad.title}
      size="md"
      footer={
        canToggle ? (
          <Button fullWidth variant="outline" leftIcon={ad.paused ? <Play aria-hidden /> : <Pause aria-hidden />} onClick={toggle} loading={pause.isPending}>
            {ad.paused ? t('ads.resume') : t('ads.pause')}
          </Button>
        ) : undefined
      }
    >
      <div data-f="F-00-166" className="flex flex-col gap-5">
        {ad.imageUrl && (
          <div className="relative aspect-[3/1] w-full overflow-hidden rounded-xl bg-surface-2">
            <Image src={ad.imageUrl} alt="" fill sizes="480px" className="object-cover" unoptimized />
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={AD_TONE[ad.state]}>{t(`ads.state.${ad.state}`)}</Badge>
        </div>
        {ad.text && <p className="text-base text-fg">{ad.text}</p>}
        <KeyValueList
          items={[
            { label: t('ads.where'), value: text.where(ad) },
            { label: t('ads.whom'), value: text.audience(ad) },
            { label: t('ads.period'), value: text.period(ad) },
            { label: t('ads.price'), value: fmt.money(ad.price) },
            { label: t('ads.advertiserName'), value: ad.advertiser.contact ? `${ad.advertiser.name} · ${ad.advertiser.contact}` : ad.advertiser.name },
            ...(ad.productKeywords.length ? [{ label: t('ads.productKeywords'), value: ad.productKeywords.join(', ') }] : []),
          ]}
        />
        <section className="flex flex-col gap-3">
          <div>
            <h3 className="text-base font-semibold text-fg">{t('ads.reachTitle')}</h3>
            <p className="text-sm text-muted">{t('ads.reachHint')}</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <StatCard label={t('ads.views')} value={fmt.number(ad.views)} />
            <StatCard label={t('ads.clicks')} value={fmt.number(ad.clicks)} />
            <StatCard label={t('ads.ctr')} value={`${clickRate(ad.views, ad.clicks)}%`} />
          </div>
        </section>
      </div>
    </Sheet>
  );
}
