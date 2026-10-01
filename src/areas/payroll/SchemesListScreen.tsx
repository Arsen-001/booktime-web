'use client';

/**
 * /biz/payroll — «Схемы расчёта»: список сотрудников со статусом схемы (F-09-001, F-09-010).
 * Принадлежит разделу «payroll».
 */
import { CircleDashed, Lock, Wallet } from 'lucide-react';
import { listStaffSchemeStatus, type StaffSchemeStatus } from '@/api/payroll';
import { useApiQuery } from '@/api/request';
import { isSchemeBlank } from '@/domain/payroll';
import { useCan, useCurrent } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { useLocale } from 'next-intl';
import { pickText } from '@/lib/text';
import type { LocaleCode } from '@/domain/core';
import { Avatar } from '@/ui/Avatar';
import { Badge } from '@/ui/Badge';
import { Card } from '@/ui/Card';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { PageHeader } from '@/ui/PageHeader';
import { Skeleton, SkeletonText } from '@/ui/Skeleton';

function schemeStatusBadge(row: StaffSchemeStatus, t: ReturnType<typeof useT<'payroll'>>) {
  if (!row.scheme) return <Badge tone="neutral">{t('schemes.status.notConfigured')}</Badge>;
  if (isSchemeBlank(row.scheme)) return <Badge tone="warning">{t('schemes.status.blank')}</Badge>;
  const blocks = [
    row.scheme.personalServices.enabled && t('scheme.blocks.personalServices.short'),
    row.scheme.productSales.enabled && t('scheme.blocks.productSales.short'),
    row.scheme.workday.enabled && t('scheme.blocks.workday.short'),
    row.scheme.records.enabled && t('scheme.blocks.records.short'),
    row.scheme.extraServiceRevenue.enabled && t('scheme.blocks.extraRevenue.services.short'),
    row.scheme.extraProductRevenue.enabled && t('scheme.blocks.extraRevenue.products.short'),
  ].filter(Boolean) as string[];
  return (
    <div className="flex flex-wrap gap-1.5">
      {blocks.map((b) => (
        <Badge key={b} tone="success">
          {b}
        </Badge>
      ))}
    </div>
  );
}

/** Скелетон строки сотрудника — та же карточка: аватар, имя и должность, место плашки схемы */
function SchemeRowSkeleton() {
  return (
    <Card as="li" padding="md" className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
      <div className="flex min-w-0 items-center gap-3 sm:w-72 sm:shrink-0">
        <Skeleton variant="circle" className="size-10 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-fg">
            <SkeletonText width="16ch" />
          </p>
          <p className="truncate text-sm text-muted">
            <SkeletonText width="10ch" />
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 pl-[52px] sm:pl-0">
        <Badge tone="neutral">
          <SkeletonText width="12ch" />
        </Badge>
      </div>
    </Card>
  );
}

export function SchemesListScreen() {
  const t = useT('payroll');
  const locale = useLocale();
  const { ready, businessId } = useCurrent();
  const q = useApiQuery(['payroll', 'schemesList', businessId], () => listStaffSchemeStatus(businessId!), {
    enabled: ready && Boolean(businessId),
  });
  // F-09-089: базовое право раздела — без payroll.view/payroll.manage список схем всех сотрудников недоступен.
  const canView = useCan('payroll.view');
  const canManage = useCan('payroll.manage');
  const canViewPayroll = canView || canManage;

  if (ready && !canViewPayroll) {
    return (
      <div data-f="F-09-001 F-09-089" className="flex flex-col gap-6">
        <PageHeader title={t('nav.schemes')} />
        <EmptyState icon={<Lock aria-hidden className="size-8 text-muted" />} title={t('access.deniedHint')} />
      </div>
    );
  }

  const configuredCount = q.data?.filter((row) => row.scheme && !isSchemeBlank(row.scheme)).length ?? 0;

  return (
    <div data-f="F-09-001" className="flex flex-col gap-6">
      <PageHeader
        title={t('nav.schemes')}
        description={t('schemes.description')}
        meta={
          !ready || q.isLoading ? (
            <Badge tone="neutral">
              <SkeletonText width="14.6ch" />
            </Badge>
          ) : (
            Boolean(q.data?.length) && (
            <Badge tone={configuredCount === q.data!.length ? 'success' : 'neutral'}>
              {t('schemes.configuredSummary', { configured: configuredCount, total: q.data!.length })}
            </Badge>
            )
          )
        }
      />

      {!ready || q.isLoading ? (
        <ul className="flex flex-col gap-2">
          {Array.from({ length: 8 }, (_, i) => (
            <SchemeRowSkeleton key={i} />
          ))}
        </ul>
      ) : q.isError ? (
        <ErrorState onRetry={() => void q.refetch()} />
      ) : !q.data?.length ? (
        <EmptyState icon={<Wallet aria-hidden />} title={t('schemes.emptyTitle')} description={t('schemes.emptyText')} />
      ) : (
        <ul className="flex flex-col gap-2">
          {q.data.map((row) => (
            <Card
              as="li"
              key={row.staff.id}
              href={`/biz/payroll/staff/${row.staff.id}`}
              padding="md"
              // Имя — колонкой постоянной ширины: плашки схем стоят ровно друг под другом и не зависят от длины имени
              className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3"
            >
              <div className="flex min-w-0 items-center gap-3 sm:w-72 sm:shrink-0">
                <Avatar name={row.staff.name} src={row.staff.avatarUrl} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-fg">{row.staff.name}</p>
                  {row.staff.position && <p className="truncate text-sm text-muted">{pickText(row.staff.position, locale as LocaleCode)}</p>}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2 pl-[52px] sm:pl-0">
                {schemeStatusBadge(row, t)}
                {!row.scheme && <CircleDashed aria-hidden className="size-5 shrink-0 text-muted" />}
              </div>
            </Card>
          ))}
        </ul>
      )}
    </div>
  );
}
