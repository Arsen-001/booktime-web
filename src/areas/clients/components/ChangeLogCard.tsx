'use client';

/**
 * «Журнал изменений» клиента — наше ⭐-решение поверх F-04-137: каждая правка карточки, удаление
 * и объединение дублей видны с автором и временем (F-00-040, предл.). Раздел «clients».
 */
import { History } from 'lucide-react';
import type { ClientChangeLogEntry } from '@/domain/clients';
import { describeClientChange } from '@/areas/clients/lib/changeLog';
import { useT } from '@/i18n/useT';
import { useFormat } from '@/i18n/useFormat';
import { Card } from '@/ui/Card';
import { EmptyState } from '@/ui/EmptyState';
import { SkeletonText } from '@/ui/Skeleton';
import { usePagedList } from '@/ui/Pagination';

export function ChangeLogCard({ entries, loading }: { entries: ClientChangeLogEntry[] | undefined; loading: boolean }) {
  const t = useT('clients');
  const fmt = useFormat();
  const describe = (e: ClientChangeLogEntry) => describeClientChange(t, e);
  // Постранично, как во всех списках (DESIGN.md → Long lists)
  const { pageItems, pager } = usePagedList(entries ?? []);

  return (
    <Card data-f="F-04-137" padding="md" className="flex flex-col gap-3">
      <p className="text-sm font-semibold text-fg">{t('changeLog.title')}</p>
      {loading ? (
        // Те же плашки записей, что со списком: автор и время, что изменилось
        <ul className="flex flex-col gap-2.5" aria-busy>
          {Array.from({ length: 2 }, (_, i) => (
            <li key={i} className="rounded-lg bg-surface-2 p-3 text-sm">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="font-medium text-fg">
                  <SkeletonText width="14ch" />
                </span>
                <span className="text-xs text-muted">
                  <SkeletonText width="16ch" />
                </span>
              </div>
              <p className="text-fg">
                <SkeletonText width={i ? '22ch' : '30ch'} />
              </p>
            </li>
          ))}
        </ul>
      ) : !entries || entries.length === 0 ? (
        <EmptyState icon={<History aria-hidden />} title={t('changeLog.emptyTitle')} description={t('changeLog.emptyText')} compact />
      ) : (
        <ul className="flex flex-col gap-2.5">
          {pageItems.map((e) => (
            <li key={e.id} className="rounded-lg bg-surface-2 p-3 text-sm">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="font-medium text-fg">{e.authorName}</span>
                <span className="text-xs text-muted">{fmt.dateTime(e.at)}</span>
              </div>
              <p className="text-fg">{describe(e)}</p>
            </li>
          ))}
        </ul>
      )}
      {!loading && pager}
    </Card>
  );
}
