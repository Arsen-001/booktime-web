'use client';

/**
 * «Принадлежность к сети» (F-15-118), карточка в «Настройки → Основные»: у нас сеть = аккаунт владельца с
 * несколькими салонами (F-00-049/050), заводится сама даже у одиночного мастера — здесь только смотрим,
 * в какую сеть входит текущий бизнес и какая локация в ней главная.
 */
import { Network as NetworkIcon } from 'lucide-react';
import type { Id } from '@/domain/core';
import { coreList } from '@/api/core';
import { useApiQuery } from '@/api/request';
import { useT } from '@/i18n/useT';
import { EmptyState } from '@/ui/EmptyState';
import { SectionCard } from '@/ui/SectionCard';
import { SkeletonText } from '@/ui/Skeleton';

export interface NetworkMembershipCardProps {
  businessId: Id | undefined;
  ready: boolean;
}

export function NetworkMembershipCard({
  businessId,
  ready,
}: NetworkMembershipCardProps) {
  const t = useT('settings');
  const q = useApiQuery(
    ['core', 'networks', 'byBusiness', businessId ?? ''],
    () => coreList('networks', (n) => n.businessIds.includes(businessId ?? '')),
    { enabled: ready && Boolean(businessId) },
  );

  const network = (q.data ?? [])[0];
  // Сеть заводится сама у каждого бизнеса — до ответа та же плашка сети с полосами, отметка «главная» на месте
  const loading = !ready || q.isLoading;

  return (
    <div data-f="F-15-118">
    <SectionCard
      title={t('system.networkTitle')}
      description={t('system.networkHint')}
    >
      {loading ? (
        <div aria-busy className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-2/50 px-3 py-2.5">
          <div className="flex flex-col">
            <span className="text-sm font-medium text-fg">
              <SkeletonText width="16ch" />
            </span>
            <span className="text-xs text-fg-muted">
              <SkeletonText width="12ch" />
            </span>
          </div>
          <span className="shrink-0 rounded-full bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent-text">
            {t('system.networkMain')}
          </span>
        </div>
      ) : !network ? (
        <EmptyState
          icon={<NetworkIcon aria-hidden />}
          title={t('system.networkEmpty')}
        />
      ) : (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-2/50 px-3 py-2.5">
          <div className="flex flex-col">
            <span className="text-sm font-medium text-fg">
              {network.name}
            </span>
            <span className="text-xs text-fg-muted">
              {t('system.networkCompaniesCount', {
                n: network.businessIds.length,
              })}
            </span>
          </div>
          {(network.mainBusinessId ?? network.businessIds[0]) ===
            businessId && (
            <span className="shrink-0 rounded-full bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent-text">
              {t('system.networkMain')}
            </span>
          )}
        </div>
      )}
    </SectionCard>
    </div>
  );
}
