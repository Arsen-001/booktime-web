'use client';

/**
 * Вклад раздела «services» в карточку сотрудника (хост «staffCard», F-10-027): услуги мастера по
 * категориям, своя цена и длительность, назначить/снять, «Взять из шаблона» (ведёт в общий каталог).
 * Принадлежит разделу «services». Посмотреть без хозяина хоста: /dev/ext/staffCard/services
 */
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  assignStaffToService,
  getSterilization,
  hasVerifiedDocuments,
  listAssignableServices,
  listStaffServices,
  removeStaffFromService,
  setStaffServiceTerm,
} from '@/api/services';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useCan } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { useLocale } from 'next-intl';
import { pickText } from '@/lib/text';
import type { StaffCardExtProps } from '@/extensions/types';
import { CommitInput } from '@/areas/services/components/CommitInput';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { Combobox } from '@/ui/Combobox';
import { EmptyState } from '@/ui/EmptyState';
import { IconButton } from '@/ui/IconButton';
import { SectionCard } from '@/ui/SectionCard';
import { SkeletonText } from '@/ui/Skeleton';
import { BadgeCheck, X } from 'lucide-react';
import { useState } from 'react';

export default function ServicesStaffCard({ staffId, businessId }: StaffCardExtProps) {
  const t = useT('services');
  const router = useRouter();
  const locale = useLocale() as 'ru' | 'en';
  const canEdit = useCan('services.edit');
  const [pick, setPick] = useState<string | null>(null);

  const groupsQ = useApiQuery(['services', 'staffServices', staffId], () => listStaffServices(staffId, businessId));
  const assignableQ = useApiQuery(['services', 'assignableForStaff', staffId], () => listAssignableServices(staffId, businessId));
  const verifiedQ = useApiQuery(['services', 'documentsVerified', staffId], () => hasVerifiedDocuments(staffId));
  const sterilizationQ = useApiQuery(['services', 'sterilization', staffId], () => getSterilization(staffId));

  const assignM = useApiMutation((serviceId: string) => assignStaffToService(serviceId, staffId, businessId));
  const removeM = useApiMutation((serviceId: string) => removeStaffFromService(serviceId, staffId, businessId));
  const termM = useApiMutation((args: { serviceId: string; price?: number; durationMin?: number }) =>
    setStaffServiceTerm(args.serviceId, staffId, args.price, args.durationMin),
  );

  const refetchAll = () => {
    groupsQ.refetch();
    assignableQ.refetch();
  };

  if (groupsQ.isLoading || assignableQ.isLoading) {
    // Та же разметка: категория с услугами (цена и длительность — неактивные поля), выбор услуги и ссылки внизу
    return (
      <div className="flex flex-col gap-4" aria-busy>
        <div className="flex flex-col gap-4">
          <SectionCard title={<SkeletonText width="12ch" />}>
            <ul className="flex flex-col gap-2">
              {[0, 1, 2].map((i) => (
                <li key={i} className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="truncate font-medium text-fg">
                    <SkeletonText width={i % 2 ? '14ch' : '20ch'} />
                  </span>
                  <span className="flex flex-wrap items-center gap-2">
                    <CommitInput kind="money" size="sm" value={undefined} onCommit={() => {}} disabled className="w-28" />
                    <CommitInput kind="minutes" size="sm" value={undefined} onCommit={() => {}} disabled className="w-20" />
                    {canEdit && <span aria-hidden className="size-11 shrink-0 md:size-10" />}
                  </span>
                </li>
              ))}
            </ul>
          </SectionCard>
          {canEdit && (
            <div className="flex items-center gap-2">
              <Combobox options={[]} value={null} onValueChange={() => {}} placeholder={t('staffCardExt.assignPlaceholder')} disabled />
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <span className="font-medium text-primary-text">{t('nav.photos')}</span>
          <span className="font-medium text-primary-text">{t('nav.documents')}</span>
          <span className="font-medium text-primary-text">{t('nav.materials')}</span>
        </div>
      </div>
    );
  }

  const groups = groupsQ.data ?? [];

  return (
    <div className="flex flex-col gap-4">
      {(verifiedQ.data || sterilizationQ.data) && (
        <div className="flex flex-col gap-2">
          {verifiedQ.data && (
            <div
              data-f="F-00-088"
              className="flex items-center gap-2 rounded-lg border border-success/30 bg-success-soft px-3 py-2 text-sm font-medium text-success"
            >
              <BadgeCheck aria-hidden className="size-4 shrink-0" />
              {t('documents.verifiedBanner')}
            </div>
          )}
          {sterilizationQ.data && (
            <div data-f="F-00-090" className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3 text-sm text-fg">
              <span className="font-medium">{t('materials.sterilizationTitle')}:</span>
              {sterilizationQ.data.methods.map((m) => (
                <Badge key={m} tone="neutral" size="sm">
                  {t(`materials.method.${m}` as never)}
                </Badge>
              ))}
              {sterilizationQ.data.note && <span className="text-muted">{sterilizationQ.data.note}</span>}
            </div>
          )}
        </div>
      )}
      <div data-f="F-10-027" className="flex flex-col gap-4">
        {groups.length === 0 ? (
          <EmptyState
            compact
            title={t('staffCardExt.emptyTitle')}
            action={
              canEdit ? (
                <Button size="sm" onClick={() => router.push('/biz/services/templates')}>
                  {t('staffCardExt.fromTemplate')}
                </Button>
              ) : undefined
            }
          />
        ) : (
          groups.map(({ category, services }) => (
            <SectionCard key={category.id} title={pickText(category.name, locale)}>
              <ul className="flex flex-col gap-2">
                {services.map(({ service, term }) => (
                  <li
                    key={service.id}
                    className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="truncate font-medium text-fg">{pickText(service.name, locale)}</span>
                    <span className="flex flex-wrap items-center gap-2">
                      {/* У13: черновик в поле, запись — при уходе из поля или по Enter, не на каждую клавишу */}
                      <CommitInput
                        kind="money"
                        size="sm"
                        value={term?.price}
                        onCommit={(v) => void termM.mutate({ serviceId: service.id, price: v, durationMin: term?.durationMin })}
                        disabled={!canEdit}
                        placeholder={String(service.priceMin)}
                        className="w-28"
                      />
                      <CommitInput
                        kind="minutes"
                        size="sm"
                        value={term?.durationMin}
                        onCommit={(v) => void termM.mutate({ serviceId: service.id, price: term?.price, durationMin: v })}
                        disabled={!canEdit}
                        placeholder={String(service.durationMin)}
                        className="w-20"
                      />
                      {canEdit && (
                        <IconButton
                          icon={<X aria-hidden />}
                          label={t('staffTab.remove')}
                          variant="ghost"
                          onClick={() => void removeM.mutate(service.id).then(refetchAll)}
                        />
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </SectionCard>
          ))
        )}
        {canEdit && (
          <div className="flex items-center gap-2">
            <Combobox
              options={(assignableQ.data ?? []).map((s) => ({
                value: s.id,
                label: pickText(s.name, locale),
              }))}
              value={pick}
              onValueChange={(v) => {
                if (!v) return;
                setPick(null);
                void assignM.mutate(v).then(refetchAll);
              }}
              placeholder={t('staffCardExt.assignPlaceholder')}
              emptyText={t('staffTab.noneAvailable')}
            />
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <Link href={`/biz/services/photos?staffId=${staffId}`} className="font-medium text-primary-text hover:underline">
          {t('nav.photos')}
        </Link>
        <Link href={`/biz/services/documents?staffId=${staffId}`} className="font-medium text-primary-text hover:underline">
          {t('nav.documents')}
        </Link>
        <Link href={`/biz/services/materials?staffId=${staffId}`} className="font-medium text-primary-text hover:underline">
          {t('nav.materials')}
        </Link>
      </div>
    </div>
  );
}
