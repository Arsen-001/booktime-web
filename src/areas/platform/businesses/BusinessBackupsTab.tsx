'use client';

/** Копии данных и выгрузка (F-00-183): свежая копия сверху с меткой, выгрузка клиентов и записей в CSV для Excel. */
import { Archive, Check, Download, FilePlus2 } from 'lucide-react';
import { makeBackupCopy } from '@/api/platform';
import { useApiMutation } from '@/api/request';
import { useBusinessExport } from '@/areas/platform/businesses/useBusinessExport';
import { useBackups } from '@/areas/platform/hooks/usePlatformData';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { usePagedList } from '@/ui/Pagination';
import { SkeletonList } from '@/ui/Skeleton';
import { useToast } from '@/ui/Toast';

export function BusinessBackupsTab({ businessId }: { businessId: string }) {
  const t = useT('platform');
  const fmt = useFormat();
  const toast = useToast();
  const q = useBackups(businessId);
  const backup = useApiMutation(makeBackupCopy);
  const exporter = useBusinessExport(businessId);
  // Постранично, как во всех списках (DESIGN.md → Long lists)
  const { pageItems, pager, page } = usePagedList(q.data ?? []);

  const doBackup = async () => {
    try {
      await backup.mutate(businessId);
      toast.success(t('businesses.backupMade'));
    } catch {
      toast.error(t('businesses.actionFailed'));
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-fg">{t('businesses.backupsTitle')}</h3>
          <Button size="sm" variant="outline" leftIcon={<FilePlus2 aria-hidden />} onClick={doBackup} loading={backup.isPending}>
            {t('businesses.makeBackup')}
          </Button>
        </div>
        {q.isError ? (
          <ErrorState compact onRetry={q.refetch} />
        ) : q.isLoading ? (
          <SkeletonList rows={3} avatar={false} />
        ) : !q.data?.length ? (
          <EmptyState variant="section" icon={<Archive aria-hidden />} title={t('businesses.backupsEmpty')} description={t('businesses.backupsEmptyHint')} />
        ) : (
          <>
            <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
              {pageItems.map((b, i) => (
                <li key={b.id} className="flex flex-col gap-0.5 px-4 py-3">
                  <p className="flex flex-wrap items-center gap-2 font-medium text-fg">
                    {fmt.dateTime(b.at)}
                    <span className="text-sm font-normal text-muted">· {t(`businesses.backupKind.${b.kind}`)}</span>
                    {page === 1 && i === 0 && <Badge size="sm" tone="success">{t('businesses.latest')}</Badge>}
                  </p>
                  <p className="text-sm text-muted">{t('businesses.backupCounts', { clients: b.counts.clients, bookings: b.counts.bookings })}</p>
                </li>
              ))}
            </ul>
            {pager}
          </>
        )}
      </section>
      <section className="flex flex-col gap-3">
        <h3 className="text-base font-semibold text-fg">{t('businesses.exportTitle')}</h3>
        <p className="text-sm text-muted">{t('businesses.exportHint')}</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          {(['clients', 'bookings'] as const).map((what) => (
            <Button
              key={what}
              variant="outline"
              leftIcon={exporter.done.has(what) ? <Check aria-hidden /> : <Download aria-hidden />}
              onClick={() => void exporter.run(what)}
              loading={exporter.running === what}
              disabled={exporter.running !== null && exporter.running !== what}
            >
              {what === 'clients' ? t('businesses.exportClients') : t('businesses.exportBookings')}
            </Button>
          ))}
        </div>
      </section>
    </div>
  );
}
