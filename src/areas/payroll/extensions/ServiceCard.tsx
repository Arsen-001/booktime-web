'use client';

/**
 * Вклад раздела «payroll» в карточку услуги (хост «serviceCard»): ставки мастеров за эту услугу,
 * только чтение + ссылка на схему (F-09-016). Принадлежит разделу «payroll».
 * Посмотреть вклад без хозяина хоста: /dev/ext/serviceCard/payroll
 */
import Link from 'next/link';
import { payoutForTarget } from '@/domain/payroll';
import { listStaffSchemeStatus } from '@/api/payroll';
import { useApiQuery } from '@/api/request';
import { useCoreGet } from '@/api/core';
import type { ServiceCardExtProps } from '@/extensions/types';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { EmptyState } from '@/ui/EmptyState';
import { SkeletonText } from '@/ui/Skeleton';

export default function PayrollServiceCard({ mode, serviceId, businessId }: ServiceCardExtProps) {
  const t = useT('payroll');
  const { money } = useFormat();
  const serviceQuery = useCoreGet('services', serviceId, { enabled: mode === 'edit' && Boolean(serviceId) });
  const statusQuery = useApiQuery(['payroll', 'schemesList', businessId], () => listStaffSchemeStatus(businessId), {
    enabled: mode === 'edit' && Boolean(serviceId),
  });

  if (mode !== 'edit' || !serviceId) {
    return (
      <div data-f="F-09-016">
        <EmptyState variant="section" title={t('serviceCard.saveFirst')} />
      </div>
    );
  }
  if (serviceQuery.isLoading || statusQuery.isLoading)
    return (
      // Та же разметка: подсказка и строки «мастер · выплата»
      <div data-f="F-09-016" className="flex flex-col gap-3">
        <p className="text-sm text-muted">{t('serviceCard.hint')}</p>
        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-surface">
          {['14ch', '17ch', '12ch'].map((w) => (
            <li key={w} className="flex items-center justify-between gap-3 px-4">
              <span className="flex min-h-11 flex-1 items-center text-fg">
                <SkeletonText width={w} />
              </span>
              <span className="font-medium text-fg">
                <SkeletonText width="4ch" />
              </span>
            </li>
          ))}
        </ul>
      </div>
    );

  const service = serviceQuery.data;
  const rows = (statusQuery.data ?? [])
    .filter((row) => row.scheme?.personalServices.enabled && row.staff.serviceIds.includes(serviceId))
    .map((row) => ({
      staffId: row.staff.id,
      name: row.staff.name,
      payout: payoutForTarget(row.scheme!.personalServices, serviceId, service?.categoryId),
    }));

  return (
    <div data-f="F-09-016" className="flex flex-col gap-3">
      <p className="text-sm text-muted">{t('serviceCard.hint')}</p>
      {rows.length === 0 ? (
        <EmptyState variant="section" title={t('serviceCard.empty')} />
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-surface">
          {rows.map((r) => (
            <li key={r.staffId} className="flex items-center justify-between gap-3 px-4">
              {/* F-09-016: зона нажатия ссылки была высотой строки текста (~24px) — растягиваем
                  на всю строку до ≥44px, а не только текст имени */}
              <Link href={`/biz/payroll/staff/${r.staffId}`} className="flex min-h-11 flex-1 items-center text-fg hover:underline">
                {r.name}
              </Link>
              <span className="font-medium text-fg">
                {r.payout.unit === 'percent' ? `${r.payout.value}%` : money(r.payout.value)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
