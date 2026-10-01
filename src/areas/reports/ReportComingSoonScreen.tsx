'use client';

/**
 * Отчёты витрины (F-12-002) вне пачки b01: честная «скоро» вместо мёртвой ссылки — F-12-123 (одно название
 * везде) и F-12-003 (шапка со всеми механизмами) всё равно работают на этом экране.
 */
import { notFound } from 'next/navigation';
import { Construction } from 'lucide-react';
import { ReportHeader } from '@/areas/reports/components/ReportHeader';
import { REPORT_CATALOG } from '@/domain/reports';
import { useT } from '@/i18n/useT';
import { EmptyState } from '@/ui/EmptyState';
import { PermissionGate } from '@/ui/PermissionGate';

export function ReportComingSoonScreen({ slug }: { slug: string }) {
  const t = useT('reports');
  const item = REPORT_CATALOG.find((r) => r.slug === slug);
  if (!item) notFound();

  return (
    <PermissionGate permission="reports.view" fallback="message">
      <div data-f="F-12-002" className="flex flex-col gap-6">
        <ReportHeader slug={slug} crumbGroup={item.group} helpBody={t(`catalog.items.${slug}.desc` as never)} />
        <EmptyState
          variant="page"
          icon={<Construction />}
          title={t('all.soonTitle')}
          description={t('all.soonText')}
        />
      </div>
    </PermissionGate>
  );
}
