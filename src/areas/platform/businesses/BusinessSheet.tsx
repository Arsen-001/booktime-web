'use client';

/**
 * Карточка бизнеса: сведения и копии. Опасное — в меню «⋯»: «Приостановить» (обратимо, подтверждение с последствиями)
 * и необратимое «Бизнес уходит» (своё окно: выгрузка + отметка «данные отданы»).
 */
import { useState } from 'react';
import { DoorOpen, MoreHorizontal, PauseCircle, PlayCircle } from 'lucide-react';
import { canBlockBusinesses, setBusinessBlocked } from '@/api/platform';
import { patchInList, useApiMutation } from '@/api/request';
import { BusinessBackupsTab } from '@/areas/platform/businesses/BusinessBackupsTab';
import { BusinessInfoTab } from '@/areas/platform/businesses/BusinessInfoTab';
import { LeaveBusinessDialog } from '@/areas/platform/businesses/LeaveBusinessDialog';
import type { BusinessOverviewRow } from '@/domain/platform';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { DropdownMenu, type DropdownMenuItem } from '@/ui/DropdownMenu';
import { IconButton } from '@/ui/IconButton';
import { Sheet } from '@/ui/Sheet';
import { Tabs } from '@/ui/Tabs';
import { useConfirm, useToast } from '@/ui/Toast';

type BlockArgs = { id: string; blocked: boolean };

export function BusinessSheet({ row, onClose }: { row: BusinessOverviewRow; onClose: () => void }) {
  const t = useT('platform');
  const toast = useToast();
  const confirm = useConfirm();
  const [tab, setTab] = useState<'info' | 'backups'>('info');
  const [leaving, setLeaving] = useState(false);
  // Строка в списке меняет статус сразу (оптимистично), список не перечитывается целиком
  const block = useApiMutation((a: BlockArgs) => setBusinessBlocked(a.id, a.blocked), {
    optimistic: patchInList(['platform', 'businesses'], (a: BlockArgs) => ({ id: a.id, patch: { status: a.blocked ? 'frozen' : 'active' } })),
  });

  const toggleBlock = async () => {
    const blocked = row.status !== 'frozen';
    const ok = await confirm(
      blocked
        ? { title: t('businesses.blockConfirm', { name: row.name }), description: t('businesses.blockConfirmText'), confirmLabel: t('businesses.block'), tone: 'danger' }
        : { title: t('businesses.unblockConfirm', { name: row.name }), description: t('businesses.unblockConfirmText'), confirmLabel: t('businesses.unblock'), tone: 'primary' },
    );
    if (!ok) return;
    try {
      await block.mutate({ id: row.id, blocked });
      toast.success(blocked ? t('businesses.blocked', { name: row.name }) : t('businesses.unblocked', { name: row.name }));
    } catch {
      toast.error(t('businesses.actionFailed'));
    }
  };

  const blockItem: DropdownMenuItem =
    row.status === 'frozen'
      ? { id: 'unblock', label: t('businesses.unblock'), icon: <PlayCircle aria-hidden />, onSelect: () => void toggleBlock() }
      : { id: 'block', label: t('businesses.block'), icon: <PauseCircle aria-hidden />, danger: true, onSelect: () => void toggleBlock() };
  const menu: DropdownMenuItem[] =
    row.status === 'left'
      ? []
      : [...(canBlockBusinesses() ? [blockItem] : []), { id: 'left', label: t('businesses.markLeft'), icon: <DoorOpen aria-hidden />, danger: true, onSelect: () => setLeaving(true) }];

  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      title={row.name}
      description={row.status !== 'active' ? undefined : t(`businesses.kind.${row.kind}`)}
      size="md"
      headerActions={
        menu.length ? <DropdownMenu label={t('businesses.more')} trigger={(p) => <IconButton {...p} icon={<MoreHorizontal />} label={t('businesses.more')} size="sm" />} items={menu} /> : undefined
      }
    >
      <div data-f="F-00-183" className="flex flex-col gap-5">
        {row.status !== 'active' && (
          <Badge tone={row.status === 'left' ? 'danger' : 'warning'} className="self-start">
            {t(`businesses.status.${row.status}`)}
          </Badge>
        )}
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as 'info' | 'backups')}
          items={[
            { value: 'info', label: t('businesses.tabInfo') },
            { value: 'backups', label: t('businesses.tabBackups') },
          ]}
        />
        {tab === 'info' ? <BusinessInfoTab row={row} /> : <BusinessBackupsTab businessId={row.id} />}
      </div>
      <LeaveBusinessDialog row={row} open={leaving} onOpenChange={setLeaving} />
    </Sheet>
  );
}
