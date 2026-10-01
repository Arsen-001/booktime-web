'use client';

/**
 * Вклад раздела «stock» в карточку услуги (хост «serviceCard»): F-08-039 «техкарта у каждого мастера
 * услуги» — список мастеров этой услуги и их норма расхода, ссылка на полную форму техкарты.
 * Посмотреть вклад без хозяина хоста: /dev/ext/serviceCard/stock
 */
import { ClipboardList } from 'lucide-react';
import { getPackageTechCardLines, listTechCardsForService } from '@/api/stock';
import { useCoreGet } from '@/api/core';
import { useApiQuery } from '@/api/request';
import type { Id } from '@/domain/core';
import type { ServiceCardExtProps } from '@/extensions/types';
import { useT } from '@/i18n/useT';
import { EmptyState } from '@/ui/EmptyState';
import { Badge } from '@/ui/Badge';
import { Button, LinkButton } from '@/ui/Button';
import { SkeletonText } from '@/ui/Skeleton';
import { useStockPermissions } from '@/areas/stock/useStockPermissions';

export default function StockServiceCard({ mode, serviceId, businessId }: ServiceCardExtProps) {
  const t = useT('stock');
  // F-08-118: техкарты у услуги меняет только сотрудник с правом
  const perm = useStockPermissions();
  const serviceDetailQ = useCoreGet('services', serviceId, { enabled: mode === 'edit' && Boolean(serviceId) });
  const cardsQ = useApiQuery(['stock', 'techCardsForService', businessId, serviceId], () => listTechCardsForService(businessId, serviceId!), {
    enabled: mode === 'edit' && Boolean(serviceId),
  });

  if (mode !== 'edit' || !serviceId) {
    return (
      <div data-f="F-08-039">
        <EmptyState variant="section" title={t('serviceCardExt.saveFirst')} />
      </div>
    );
  }
  if (serviceDetailQ.isLoading || cardsQ.isLoading) {
    // Скелетон = тот же блок: подсказка и строки мастеров с кнопкой техкарты (в демо у услуги 4 мастера)
    return (
      <div aria-hidden className="flex flex-col gap-3">
        <p className="text-sm text-muted">{t('serviceCardExt.hint')}</p>
        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-surface">
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-fg">
                  <SkeletonText width={i % 2 ? '14ch' : '12ch'} />
                </p>
                <p className="text-xs text-muted">
                  <SkeletonText width="10ch" />
                </p>
              </div>
              {perm.techCardEdit && (
                <Button variant="secondary" size="sm" disabled>
                  {t('serviceCardExt.edit')}
                </Button>
              )}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const staffIds = serviceDetailQ.data?.staffIds ?? [];
  const cards = cardsQ.data ?? [];
  const cardByStaff = new Map(cards.map((c) => [c.staffId, c]));
  const isPackage = Boolean(serviceDetailQ.data?.servicePackage);

  if (staffIds.length === 0) {
    return (
      <div data-f="F-08-039">
        <EmptyState variant="section" icon={<ClipboardList aria-hidden />} title={t('serviceCardExt.noStaffTitle')} description={t('serviceCardExt.noStaffText')} />
      </div>
    );
  }

  return (
    <div data-f="F-08-039 F-08-118" className="flex flex-col gap-3">
      <p className="text-sm text-muted">{t('serviceCardExt.hint')}</p>
      <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-surface">
        {staffIds.map((staffId) => {
          const card = cardByStaff.get(staffId);
          return (
            <li key={staffId} className="flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-fg">{card?.staffName ?? staffId}</p>
                <p className="text-xs text-muted">{card ? t('techCards.lineCount', { count: card.lineDetails.length }) : t('serviceCardExt.noCard')}</p>
              </div>
              {perm.techCardEdit ? (
                <LinkButton
                  href={card ? `/biz/stock/tech-cards/${card.id}` : `/biz/stock/tech-cards/new?serviceId=${serviceId}&staffId=${staffId}`}
                  variant="secondary"
                  size="sm"
                >
                  {card ? t('serviceCardExt.edit') : t('serviceCardExt.create')}
                </LinkButton>
              ) : (
                card && <Badge tone="neutral" size="sm">{t('techCards.lineCount', { count: card.lineDetails.length })}</Badge>
              )}
            </li>
          );
        })}
      </ul>
      {isPackage && (
        <div data-f="F-08-040" className="flex flex-col gap-2 rounded-xl border border-border bg-surface-2 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">{t('serviceCardExt.packageTitle')}</p>
          {staffIds.map((staffId) => (
            <PackageSummaryRow key={staffId} businessId={businessId} serviceId={serviceId} staffId={staffId} staffName={cardByStaff.get(staffId)?.staffName} />
          ))}
        </div>
      )}
    </div>
  );
}

function PackageSummaryRow({ businessId, serviceId, staffId, staffName }: { businessId: Id; serviceId: Id; staffId: Id; staffName?: string }) {
  const t = useT('stock');
  const q = useApiQuery(['stock', 'packageTechCardLines', businessId, serviceId, staffId], () => getPackageTechCardLines(businessId, serviceId, staffId));
  const lines = q.data ?? [];
  return (
    <div className="text-xs text-muted">
      <span className="font-medium text-fg">{staffName ?? staffId}:</span>{' '}
      {lines.length === 0 ? t('serviceCardExt.packageEmpty') : lines.map((l) => `${l.goodName} × ${l.qtyWriteoff} ${l.unitShort}`).join(', ')}
    </div>
  );
}
