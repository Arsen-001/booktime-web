'use client';

/** «⋯» в карточке места: изменить, удалить (с подтверждением; визиты остаются без связи). */
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { deleteProspect } from '@/api/platform';
import { useApiMutation } from '@/api/request';
import type { ProspectCard } from '@/domain/platform';
import { useT } from '@/i18n/useT';
import { DropdownMenu } from '@/ui/DropdownMenu';
import { IconButton } from '@/ui/IconButton';
import { useConfirm, useToast } from '@/ui/Toast';

export function ProspectMenu({ prospect, onEdit, onDeleted }: { prospect: ProspectCard; onEdit: () => void; onDeleted: () => void }) {
  const t = useT('platform');
  const toast = useToast();
  const confirm = useConfirm();
  const remove = useApiMutation(deleteProspect);
  const doDelete = async () => {
    if (!(await confirm({ title: t('prospects.deleteConfirm', { name: prospect.name }), description: t('prospects.deleteHint'), tone: 'danger', confirmLabel: t('prospects.delete') }))) return;
    try {
      await remove.mutate(prospect.id);
      toast.success(t('prospects.deleted'));
      onDeleted();
    } catch {
      toast.error(t('prospects.saveFailed'));
    }
  };
  return (
    <DropdownMenu
      label={t('prospects.more')}
      trigger={(tp) => <IconButton {...tp} icon={<MoreHorizontal />} label={t('prospects.more')} size="sm" />}
      items={[
        { id: 'edit', label: t('prospects.edit'), icon: <Pencil aria-hidden />, onSelect: onEdit },
        { id: 'delete', label: t('prospects.delete'), icon: <Trash2 aria-hidden />, danger: true, onSelect: () => void doDelete() },
      ]}
    />
  );
}
