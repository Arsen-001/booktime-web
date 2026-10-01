'use client';

/**
 * Вкладка «Материалы» карточки услуги (F-00-089): читает материалы мастеров, назначенных на услугу, и товары
 * склада с «Показывать клиентам» — только показ, редактируется на /biz/services/materials и в складе.
 */
import Link from 'next/link';
import { getServiceMaterials } from '@/api/services';
import { useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { MATERIAL_TAG_IDS } from '@/domain/services';
import { Chip } from '@/ui/Chip';
import { EmptyState } from '@/ui/EmptyState';
import { Skeleton } from '@/ui/Skeleton';

export function ServiceMaterialsTab({ serviceId }: { serviceId: string }) {
  const t = useT('services');
  const { activeLocationIds } = useCurrent();
  const q = useApiQuery(['services', 'serviceMaterials', serviceId, activeLocationIds], () =>
    getServiceMaterials(serviceId, activeLocationIds),
  );

  if (q.isLoading) return <Skeleton lines={3} />;
  const data = q.data;
  const isKnownTag = (id: string) => (MATERIAL_TAG_IDS as readonly string[]).includes(id);
  const chips = [
    ...(data?.staffLabels ?? []).filter(isKnownTag).map((id) => t(`materials.tags.${id}` as never)),
    ...(data?.staffCustom ?? []),
    ...(data?.stockItems ?? []).map((i) => i.name),
  ];

  if (chips.length === 0) {
    return (
      <EmptyState
        compact
        title={t('materialsTab.empty')}
        action={
          <Link href="/biz/services/materials" className="text-sm font-medium text-primary-text hover:underline">
            {t('materialsTab.openLink')}
          </Link>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">{t('materialsTab.hint')}</p>
      <div className="flex flex-wrap gap-2">
        {chips.map((c, i) => (
          <Chip key={`${c}-${i}`}>{c}</Chip>
        ))}
      </div>
      <Link href="/biz/services/materials" className="text-sm font-medium text-primary-text hover:underline">
        {t('materialsTab.openLink')}
      </Link>
    </div>
  );
}
