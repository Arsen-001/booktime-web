'use client';

/**
 * /biz/payroll/staff/[staffId] — редактор схемы сотрудника (F-09-010…013). Принадлежит разделу «payroll».
 * Тот же SchemeEditor, что во вкладке карточки сотрудника (extensions/StaffCard.tsx).
 */
import { Users } from 'lucide-react';
import type { Id } from '@/domain/core';
import { useCoreGet } from '@/api/core';
import { useCurrent } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { PageHeader } from '@/ui/PageHeader';
import { Skeleton } from '@/ui/Skeleton';
import { SchemeEditor } from '@/areas/payroll/scheme/SchemeEditor';

export interface StaffSchemeScreenProps {
  staffId: Id;
}

export function StaffSchemeScreen({ staffId }: StaffSchemeScreenProps) {
  const t = useT('payroll');
  const { ready, businessId } = useCurrent();
  const staffQuery = useCoreGet('staff', staffId);

  // М1: шапка страницы на месте сразу, скелет — только у редактора
  if (!ready || staffQuery.isLoading)
    return (
      <div className="mx-auto w-full max-w-[760px] flex flex-col gap-6">
        <PageHeader
          title={<Skeleton className="h-8 w-64" />}
          description={t('scheme.pageDescription')}
          back={{ href: '/biz/payroll' }}
        />
        <div className="flex flex-col gap-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} variant="rect" className="h-28" />
          ))}
        </div>
      </div>
    );
  if (staffQuery.isError) return <ErrorState onRetry={() => void staffQuery.refetch()} />;
  // F-09-058: сотрудник из другого бизнеса — не показываем чужую схему по прямому URL
  if (!staffQuery.data || staffQuery.data.businessId !== businessId) {
    return <EmptyState icon={<Users aria-hidden />} title={t('scheme.notFound')} />;
  }

  return (
    <div className="mx-auto w-full max-w-[760px] flex flex-col gap-6">
      <PageHeader
        title={t('scheme.pageTitle', { name: staffQuery.data.name })}
        description={t('scheme.pageDescription')}
        back={{ href: '/biz/payroll' }}
      />
      <SchemeEditor staffId={staffId} businessId={staffQuery.data.businessId} />
    </div>
  );
}
