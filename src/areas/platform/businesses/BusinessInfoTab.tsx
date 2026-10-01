'use client';

/** Сведения о бизнесе: как пришёл, бесплатный период, сфера, район, мастера; согласие на предложения поставщиков. */
import { LifeBuoy } from 'lucide-react';
import { setAdsOptIn } from '@/api/platform';
import { useApiMutation } from '@/api/request';
import { useTeam } from '@/areas/platform/hooks/usePlatformData';
import type { BusinessOverviewRow } from '@/domain/platform';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { today } from '@/lib/date';
import { LinkButton } from '@/ui/Button';
import { KeyValueList } from '@/ui/KeyValueList';
import { Switch } from '@/ui/Switch';
import { useToast } from '@/ui/Toast';
import { useFreeUntilText } from '@/areas/platform/businesses/useFreeUntilText';

export function BusinessInfoTab({ row }: { row: BusinessOverviewRow }) {
  const t = useT('platform');
  const tc = useT('common');
  const fmt = useFormat();
  const toast = useToast();
  const teamQ = useTeam();
  const freeText = useFreeUntilText();
  const optIn = useApiMutation((a: { id: string; on: boolean }) => setAdsOptIn(a.id, a.on));
  const meta = row.meta;
  const responsible = teamQ.data?.find((m) => m.id === meta?.responsibleId)?.name;

  return (
    <div className="flex flex-col gap-5">
      <KeyValueList
        items={[
          { label: t('businesses.sourceLabel'), value: meta ? t(`businesses.source.${meta.source}`) : t('businesses.source.self') },
          { label: t('businesses.freeUntil'), value: meta?.freeUntil ? freeText(meta.freeUntil) : t('businesses.noFree') },
          { label: t('businesses.sphere'), value: row.sphereIds.map((s) => tc(`spheres.${s}`)).join(', ') || '—' },
          { label: t('businesses.district'), value: row.district ? tc(`districts.${row.district}`) : '—' },
          { label: t('businesses.staff'), value: t('businesses.staffCount', { n: row.staffCount }) },
          ...(responsible ? [{ label: t('businesses.responsible'), value: responsible }] : []),
          ...(meta?.leftAt ? [{ label: t('businesses.leftOn'), value: fmt.date(meta.leftAt, 'long') }] : []),
        ]}
      />
      <div className="rounded-xl border border-border p-4">
        <Switch
          checked={meta?.adsOptIn ?? false}
          onCheckedChange={async (on) => {
            try {
              await optIn.mutate({ id: row.id, on });
              toast.success(on ? t('businesses.adsOptInOn') : t('businesses.adsOptInOff'));
            } catch {
              toast.error(t('businesses.actionFailed'));
            }
          }}
          label={t('businesses.adsOptIn')}
          description={t('businesses.adsOptInHint')}
        />
      </div>
      <div className="flex flex-col gap-2 rounded-xl bg-surface-2 p-4">
        <p className="font-medium text-fg">{t('businesses.onlyThroughSupport')}</p>
        <p className="text-sm text-muted">{t('businesses.onlyThroughSupportHint')}</p>
        <LinkButton href="/platform/support" variant="outline" size="sm" leftIcon={<LifeBuoy aria-hidden />} className="self-start">
          {t('businesses.toSupport')}
        </LinkButton>
      </div>
      {meta?.freeUntil && meta.freeUntil < today() && !meta.leftAt && <p className="text-sm text-muted">{t('businesses.freeEndedHint')}</p>}
    </div>
  );
}
