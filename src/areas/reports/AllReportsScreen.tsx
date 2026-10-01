'use client';

/**
 * F-12-002: витрина «Все отчеты» — 24 пункта, 6 групп, с описанием в одну строку у каждого (то, что отчёт
 * реально показывает — не больше, F-12-002 готово-когда «описание не обещает того, чего нет»).
 */
import Link from 'next/link';
import { ChartColumn, LayoutGrid, Mail, ShieldCheck, UserCog, Waypoints } from 'lucide-react';
import { getWeeklyReportSettings, setWeeklyReportEnabled } from '@/api/reports';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import { DASHBOARD_SLUG, nextWeeklyReportAt, REPORT_CATALOG, REPORT_GROUP_IDS, reportHref } from '@/domain/reports';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';
import { Switch } from '@/ui/Switch';
import { useToast } from '@/ui/Toast';

/** F-12-083 «Сообщение "еженедельный отчёт"» (❓ в ТЗ, ⭐ наше решение — см. domain/reports.ts). */
function WeeklyReportCard() {
  const t = useT('reports');
  const f = useFormat();
  const toast = useToast();
  const { businessId, ready } = useCurrent();
  const q = useApiQuery(['reports', 'weeklyReport', businessId], () => getWeeklyReportSettings(businessId!), { enabled: ready && !!businessId, keepPrevious: true });
  const save = useApiMutation((enabled: boolean) => setWeeklyReportEnabled(businessId!, enabled));

  const onToggle = async (enabled: boolean) => {
    try {
      await save.mutate(enabled);
    } catch {
      toast.error(t('weeklyReport.saveFailed'));
    }
  };

  const settings = q.data;
  return (
    <div data-f="F-12-083" className="contents">
      <SectionCard title={t('weeklyReport.title')} description={t('weeklyReport.description')}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-sm text-fg">
            <Mail className="size-4 text-muted" aria-hidden />
            {t('weeklyReport.toggleLabel')}
          </span>
          <Switch checked={settings?.enabled ?? false} onCheckedChange={(v) => void onToggle(v)} disabled={q.isLoading} aria-label={t('weeklyReport.toggleLabel')} />
        </div>
        {settings?.enabled && (
          <p className="mt-2 text-xs text-muted">
            {settings.lastSentAt ? t('weeklyReport.nextSend', { date: f.date(nextWeeklyReportAt(settings, settings.lastSentAt), 'long') }) : t('weeklyReport.neverSent')}
          </p>
        )}
      </SectionCard>
    </div>
  );
}

export function AllReportsScreen() {
  const t = useT('reports');

  return (
    <div data-f="F-12-002" className="flex flex-col gap-6">
      <PageHeader title={t('nav.all')} description={t('all.description')} />

      <Link
        data-f="F-12-001"
        href={reportHref(DASHBOARD_SLUG)}
        className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 shadow-xs transition-[box-shadow,border-color,transform] duration-200 hover:border-border-strong/60 hover:shadow-md motion-safe:hover:-translate-y-0.5"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-text">
          <ChartColumn className="size-5" aria-hidden />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-fg">{t('catalog.dashboard.title')}</span>
          <span className="block truncate text-sm text-muted">{t('catalog.dashboard.desc')}</span>
        </span>
      </Link>

      {REPORT_GROUP_IDS.map((group) => (
        <section key={group} className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-fg">{t(`catalog.groups.${group}`)}</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {REPORT_CATALOG.filter((r) => r.group === group).map((r) => (
              <Link
                key={r.slug}
                href={r.href}
                className="flex flex-col gap-1.5 rounded-xl border border-border bg-surface p-4 shadow-xs transition-[box-shadow,border-color,transform] duration-200 hover:border-border-strong/60 hover:shadow-md motion-safe:hover:-translate-y-0.5"
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-fg">{t(`catalog.items.${r.slug}.title` as never)}</span>
                  {r.state === 'soon' && (
                    <Badge tone="neutral" size="sm">
                      {t('all.soon')}
                    </Badge>
                  )}
                </span>
                <span className="text-sm text-muted">{t(`catalog.items.${r.slug}.desc` as never)}</span>
              </Link>
            ))}
          </div>
          {group === 'security' && (
            <p data-f="F-12-122" className="text-xs text-muted">
              {t('all.securityHint')}
            </p>
          )}
        </section>
      ))}

      <p className="flex items-center gap-2 text-xs text-muted">
        <LayoutGrid className="size-3.5" aria-hidden />
        {t('all.countHint', { n: REPORT_CATALOG.length + 1 })}
      </p>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-fg">{t('all.moreGroup')}</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            href="/biz/reports/r/myAnalytics"
            className="flex flex-col gap-1.5 rounded-xl border border-border bg-surface p-4 shadow-xs transition-[box-shadow,border-color,transform] duration-200 hover:border-border-strong/60 hover:shadow-md motion-safe:hover:-translate-y-0.5"
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-fg">
              <UserCog className="size-4 text-muted" aria-hidden />
              {t('catalog.items.myAnalytics.title')}
            </span>
            <span className="text-sm text-muted">{t('catalog.items.myAnalytics.desc')}</span>
          </Link>
          <Link
            href="/biz/reports/r/external"
            className="flex flex-col gap-1.5 rounded-xl border border-border bg-surface p-4 shadow-xs transition-[box-shadow,border-color,transform] duration-200 hover:border-border-strong/60 hover:shadow-md motion-safe:hover:-translate-y-0.5"
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-fg">
              <Waypoints className="size-4 text-muted" aria-hidden />
              {t('catalog.items.external.title')}
            </span>
            <span className="text-sm text-muted">{t('catalog.items.external.desc')}</span>
          </Link>
          <Link
            href="/biz/reports/r/dataIntegrity"
            className="flex flex-col gap-1.5 rounded-xl border border-border bg-surface p-4 shadow-xs transition-[box-shadow,border-color,transform] duration-200 hover:border-border-strong/60 hover:shadow-md motion-safe:hover:-translate-y-0.5"
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-fg">
              <ShieldCheck className="size-4 text-muted" aria-hidden />
              {t('catalog.items.dataIntegrity.title')}
            </span>
            <span className="text-sm text-muted">{t('catalog.items.dataIntegrity.desc')}</span>
          </Link>
        </div>
      </section>

      <WeeklyReportCard />
    </div>
  );
}
