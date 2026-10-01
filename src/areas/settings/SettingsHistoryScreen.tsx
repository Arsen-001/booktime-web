'use client';

/**
 * /biz/settings/history — «Журнал изменений настроек» (F-15-180, ⭐ добавлено проверкой 1): кто и когда менял
 * общие настройки компании (бренд, контакты, реквизиты, системные, категории), было → стало. Фильтр по
 * разделу; сортировка — новые сверху. Пишется каждая правка из BrandScreen/ContactsScreen/SystemScreen/
 * LegalScreen/CategoriesScreen (src/api/settings.ts → logSettingsChange). Передача записи в общий журнал
 * сотрудников (F-00-040, staff) — просьба, qa/requests/settings.md. Право — settings.manage.
 */
import { useState } from 'react';
import { History } from 'lucide-react';
import type { SettingsChangeSection } from '@/domain/settings';
import { getSettingsChangeLog } from '@/api/settings';
import { useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { FilterBar } from '@/ui/FilterBar';
import { PageHeader } from '@/ui/PageHeader';
import { PermissionGate } from '@/ui/PermissionGate';
import { SectionCard } from '@/ui/SectionCard';
import { Select } from '@/ui/Select';
import { SkeletonText } from '@/ui/Skeleton';
import { useSkeletonCount } from '@/ui/hooks/useSkeletonCount';
import { usePagedList } from '@/ui/Pagination';

const SECTIONS: SettingsChangeSection[] = [
  'brand',
  'contacts',
  'gallery',
  'legal',
  'system',
  'categories',
];

export function SettingsHistoryScreen() {
  const t = useT('settings');
  const format = useFormat();
  const { businessId, ready } = useCurrent();
  const [section, setSection] = useState<SettingsChangeSection | ''>('');

  const q = useApiQuery(
    ['settings', 'changeLog', businessId, section],
    () =>
      getSettingsChangeLog(businessId ?? '', section || undefined),
    { enabled: ready && Boolean(businessId) },
  );
  // Постранично, как во всех списках (DESIGN.md → Long lists)
  const { pageItems, pager, pageSize } = usePagedList(q.data ?? [], { resetKey: section, className: 'px-4 pb-4' });
  const loading = q.isLoading || !ready;
  // Строк скелетона — сколько было в прошлый раз (в демо правок нет — то же пустое состояние)
  const skeletonRows = useSkeletonCount('history', { loading, count: q.data ? pageItems.length : undefined, fallback: 0, max: pageSize });

  return (
    <PermissionGate permission="settings.manage" fallback="message">
      <div data-f="F-15-180" className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
        <PageHeader title={t('history.title')} description={t('history.description')} back={{ href: '/biz/settings' }} />

        <FilterBar
          filters={[
            {
              id: 'section',
              label: t('history.sectionLabel'),
              node: (
                <Select
                  value={section}
                  onValueChange={(v) => setSection(v as SettingsChangeSection | '')}
                  placeholder={t('history.sectionAll')}
                  options={[
                    { value: '', label: t('history.sectionAll') },
                    ...SECTIONS.map((s) => ({
                      value: s,
                      label: t(`history.section.${s}` as never),
                    })),
                  ]}
                />
              ),
            },
          ]}
          activeCount={section ? 1 : 0}
          onReset={() => setSection('')}
        />

        <SectionCard title={t('history.listTitle')} padding="none">
          {loading && skeletonRows === 0 ? (
            <EmptyState
              variant="section"
              icon={<History aria-hidden />}
              title={<SkeletonText width="18ch" />}
              description={t('history.emptyDescription')}
            />
          ) : loading ? (
            <ul aria-busy className="flex flex-col divide-y divide-border">
              {Array.from({ length: skeletonRows }, (_, i) => (
                <li key={i} className="flex flex-col gap-1 px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium text-fg">
                      <SkeletonText width="24ch" />
                    </span>
                    <span className="text-xs text-muted">
                      <SkeletonText width="14ch" />
                    </span>
                  </div>
                  <p className="text-sm text-muted">
                    <SkeletonText width="30ch" />
                  </p>
                  <span className="text-xs text-muted">
                    <SkeletonText width="16ch" />
                  </span>
                </li>
              ))}
            </ul>
          ) : q.isError ? (
            <div className="p-4">
              <ErrorState compact onRetry={() => q.refetch()} />
            </div>
          ) : (q.data ?? []).length === 0 ? (
            <EmptyState
              variant="section"
              icon={<History aria-hidden />}
              title={t('history.emptyTitle')}
              description={t('history.emptyDescription')}
            />
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {pageItems.map((entry) => (
                <li key={entry.id} className="flex flex-col gap-1 px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium text-fg">
                      {t(`history.section.${entry.section}` as never)} · {t(`history.field.${entry.fieldKey}` as never)}
                    </span>
                    <span className="text-xs text-muted">{format.dateTime(entry.at)}</span>
                  </div>
                  <p className="text-sm text-muted">
                    <span className="line-through">{entry.before || t('history.empty')}</span>
                    {' → '}
                    <span className="text-fg">{entry.after || t('history.empty')}</span>
                  </p>
                  <span className="text-xs text-muted">{t('history.by', { name: entry.staffName })}</span>
                </li>
              ))}
            </ul>
          )}
          {!q.isError && pager}
        </SectionCard>
      </div>
    </PermissionGate>
  );
}
