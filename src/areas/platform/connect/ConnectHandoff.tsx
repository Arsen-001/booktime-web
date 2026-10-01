'use client';

/**
 * Экран «передать владельцу» после подключения (F-00-176, F-00-019): салон виден в каталоге, что сказать владельцу,
 * ссылка на его страницу. Переживает перезагрузку (?done=<businessId>).
 */
import { CheckCircle2, Copy, ExternalLink, EyeOff, MapPin, Plus } from 'lucide-react';
import { useConnectResult } from '@/areas/platform/hooks/usePlatformData';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { copyText } from '@/lib/clipboard';
import { Button, LinkButton } from '@/ui/Button';
import { ErrorState } from '@/ui/ErrorState';
import { KeyValueList } from '@/ui/KeyValueList';
import { SectionCard } from '@/ui/SectionCard';
import { Skeleton } from '@/ui/Skeleton';
import { useToast } from '@/ui/Toast';

export function ConnectHandoff({ businessId }: { businessId: string }) {
  const t = useT('platform');
  const fmt = useFormat();
  const toast = useToast();
  const q = useConnectResult(businessId);

  if (q.isError) return <ErrorState onRetry={q.refetch} />;
  if (q.isLoading || !q.data) {
    return (
      <div className="flex flex-col gap-6" aria-busy>
        <Skeleton variant="circle" className="size-16" />
        <Skeleton className="h-9 w-2/3" />
        <Skeleton variant="rect" className="h-64" />
      </div>
    );
  }

  const r = q.data;
  const path = `/b/${r.slug}`;
  const copyLink = async () => {
    const ok = await copyText(`${window.location.origin}${path}`);
    if (ok) toast.success(t('connect.handoff.copied'));
    else toast.error(t('connect.handoff.copyFailed'));
  };

  return (
    <div data-f="F-00-176 F-00-019 F-02-100" className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div className="flex flex-col items-center gap-3 pt-2 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-success-soft text-success">
          <CheckCircle2 aria-hidden className="size-8" />
        </span>
        <h1 className="text-2xl font-semibold text-fg sm:text-3xl">{t('connect.handoff.title', { name: r.name })}</h1>
        <p className="max-w-md text-base text-muted">
          {r.inCatalog
            ? t('connect.handoff.subtitle', { date: r.freeUntil ? fmt.date(r.freeUntil, 'dayMonth') : '—' })
            : t('connect.handoff.subtitleHidden', { date: r.freeUntil ? fmt.date(r.freeUntil, 'dayMonth') : '—' })}
        </p>
      </div>

      {!r.inCatalog && (
        <div role="status" className="flex gap-3 rounded-2xl border border-warning/60 bg-warning-soft p-4">
          <EyeOff aria-hidden className="mt-0.5 size-5 shrink-0 text-warning" />
          <div className="flex flex-col gap-1 text-sm text-fg">
            <p className="font-semibold">{t('connect.handoff.hiddenTitle')}</p>
            <ul className="list-disc pl-4 text-muted">
              {r.catalogReasons
                .filter((x) => x === 'no_photo' || x === 'no_services' || x === 'no_schedule')
                .map((x) => (
                  <li key={x}>{t(`connect.handoff.hiddenReason.${x as 'no_photo' | 'no_services' | 'no_schedule'}`)}</li>
                ))}
            </ul>
          </div>
        </div>
      )}

      <SectionCard title={t('connect.handoff.tellTitle')} description={t('connect.handoff.tellHint')}>
        <ol className="flex flex-col gap-3 text-base text-fg">
          <li className="flex gap-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary-text">
              1
            </span>
            <span>{t('connect.handoff.stepLogin', { phone: fmt.phone(r.ownerPhone) })}</span>
          </li>
          <li className="flex gap-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary-text">
              2
            </span>
            <span className="min-w-0">
              {t('connect.handoff.stepPage')} <span className="font-mono text-sm break-all text-muted">{path}</span>
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary-text">
              3
            </span>
            <span>{t('connect.handoff.stepFree', { date: r.freeUntil ? fmt.date(r.freeUntil, 'dayMonth') : '—' })}</span>
          </li>
          <li className="flex gap-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary-text">
              4
            </span>
            <span>{t('connect.handoff.stepChecklist')}</span>
          </li>
        </ol>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <LinkButton href={path} target="_blank" rel="noopener" leftIcon={<ExternalLink aria-hidden />} className="sm:flex-1">
            {t('connect.handoff.openPage')}
          </LinkButton>
          <Button variant="outline" leftIcon={<Copy aria-hidden />} onClick={copyLink} className="sm:flex-1">
            {t('connect.handoff.copyLink')}
          </Button>
        </div>
      </SectionCard>

      <SectionCard title={t('connect.handoff.createdTitle')}>
        <KeyValueList
          columns={2}
          items={[
            { label: t('connect.summary.services'), value: t('connect.servicesSelected', { n: r.services }) },
            { label: t('connect.summary.staff'), value: t('connect.staffCount', { n: r.staff }) },
            { label: t('connect.summary.photos'), value: t('connect.photosCount', { n: r.photos }) },
            { label: t('connect.promoLabel'), value: r.promoCode ?? t('connect.handoff.noPromo') },
          ]}
        />
      </SectionCard>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
        <LinkButton href="/platform/connect" variant="ghost" leftIcon={<Plus aria-hidden />}>
          {t('connect.handoff.another')}
        </LinkButton>
        <LinkButton href="/platform/visits" variant="ghost" leftIcon={<MapPin aria-hidden />}>
          {t('connect.handoff.toVisits')}
        </LinkButton>
      </div>
    </div>
  );
}
