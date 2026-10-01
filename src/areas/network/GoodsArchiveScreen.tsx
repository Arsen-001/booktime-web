'use client';

/**
 * /biz/network/goods/archive — архив товаров сети (F-11-118): «Восстановить» / «Удалить».
 */
import { Archive, Trash2, Undo2 } from 'lucide-react';
import { deleteNetworkGoodsArchiveEntry, listNetworkGoodsArchive, restoreNetworkGoods } from '@/api/network';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useT } from '@/i18n/useT';
import { useFormat } from '@/i18n/useFormat';
import { Badge } from '@/ui/Badge';
import { LinkButton } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { IconButton } from '@/ui/IconButton';
import { PageHeader } from '@/ui/PageHeader';
import { usePagedList } from '@/ui/Pagination';
import { Skeleton } from '@/ui/Skeleton';
import { Tooltip } from '@/ui/Tooltip';
import { useConfirm, useToast } from '@/ui/Toast';
import { useNetwork } from '@/areas/network/lib/useNetwork';

export function GoodsArchiveScreen() {
  const t = useT('network');
  const toast = useToast();
  const confirm = useConfirm();
  const format = useFormat();
  const { ready, networkId, isError, refetch } = useNetwork();
  const q = useApiQuery(['network', 'goodsArchive', networkId], () => listNetworkGoodsArchive(networkId!), { enabled: ready && Boolean(networkId) });

  const restoreMutation = useApiMutation((name: string) => restoreNetworkGoods(networkId!, name));
  const deleteMutation = useApiMutation((id: string) => deleteNetworkGoodsArchiveEntry(networkId!, id));

  // Постранично, как во всех списках (DESIGN.md → Long lists)
  const { pageItems, pager } = usePagedList(q.data ?? []);

  if (isError || q.isError) return <ErrorState onRetry={() => (isError ? refetch() : q.refetch())} />;

  const restore = async (name: string) => {
    try {
      await restoreMutation.mutate(name);
      toast.success(t('goods.archive.restoreDone'));
      q.refetch();
    } catch {
      toast.error(t('goods.archive.actionFailed'));
    }
  };

  const remove = async (id: string) => {
    const ok = await confirm({ title: t('goods.archive.deleteConfirmTitle'), description: t('goods.archive.deleteConfirmBody'), tone: 'danger' });
    if (!ok) return;
    await deleteMutation.mutate(id);
    toast.success(t('goods.archive.deleteDone'));
    q.refetch();
  };

  return (
    <div data-f="F-11-118 F-08-133" className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
      <PageHeader title={t('goods.archive.title')} description={t('goods.archive.subtitle')} />
      <LinkButton href="/biz/network/goods" variant="ghost" size="sm" className="w-fit">
        ← {t('goods.title')}
      </LinkButton>

      {!ready || q.isLoading ? (
        <Skeleton lines={4} />
      ) : !q.data?.length ? (
        <EmptyState icon={<Archive aria-hidden />} title={t('goods.archive.empty')} />
      ) : (
        <div className="flex flex-col gap-4">
          <ul className="flex flex-col gap-2">
            {pageItems.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-fg">{row.name}</p>
                  <p className="truncate text-xs text-muted">{format.date(row.archivedAt)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {!row.restorable && (
                    <Badge tone="neutral" size="sm">
                      {t('goods.archive.notRestorable')}
                    </Badge>
                  )}
                  {row.restorable && (
                    <Tooltip content={t('goods.archive.restore')}>
                      <IconButton
                        icon={<Undo2 aria-hidden />}
                        variant="ghost"
                        size="sm"
                        label={t('goods.archive.restore')}
                        onClick={() => restore(row.name)}
                      />
                    </Tooltip>
                  )}
                  <IconButton
                    icon={<Trash2 aria-hidden />}
                    variant="ghost"
                    size="sm"
                    label={t('goods.archive.delete')}
                    onClick={() => remove(row.id)}
                  />
                </div>
              </li>
            ))}
          </ul>
          {pager}
        </div>
      )}
    </div>
  );
}
