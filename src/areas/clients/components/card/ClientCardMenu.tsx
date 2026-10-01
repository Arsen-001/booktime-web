'use client';

/**
 * Меню «⋯» карточки клиента: редкое и опасное — не кнопками на виду (ux-r2 №1, ux-r5 №3). «Изменить», «Внести прошлый
 * визит», приглашение в приложение, пересчёт автоправил, объединение дублей, удаление. Без единого доступного пункта
 * меню нет вовсе (мастер раньше видел «⋯» с одним серым пунктом — ux-r2 №7).
 */
import { CalendarPlus, GitMerge, MoreVertical, Pencil, RefreshCw, ShieldAlert, Trash2, UserPlus2 } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { DropdownMenu, type DropdownMenuItem } from '@/ui/DropdownMenu';
import { IconButton } from '@/ui/IconButton';

export interface ClientCardMenuProps {
  canEdit: boolean;
  canAddVisit: boolean;
  canDelete: boolean;
  /** Клиента можно позвать в приложение (у него его ещё нет) */
  canInvite: boolean;
  invitedBefore: boolean;
  onEdit: () => void;
  onAddVisit: () => void;
  onInvite: () => void;
  onRecalc: () => void;
  onMerge: () => void;
  onDelete: () => void;
  onPurge: () => void;
}

export function ClientCardMenu(p: ClientCardMenuProps) {
  const t = useT('clients');
  const items: DropdownMenuItem[] = [
    ...(p.canEdit ? [{ id: 'edit', label: t('card.edit'), icon: <Pencil aria-hidden />, onSelect: p.onEdit }] : []),
    ...(p.canAddVisit ? [{ id: 'visit', label: t('addPastVisit'), icon: <CalendarPlus aria-hidden />, onSelect: p.onAddVisit }] : []),
    ...(p.canInvite
      ? [{ id: 'invite', label: p.invitedBefore ? t('card.invitedAgain') : t('card.invite'), icon: <UserPlus2 aria-hidden />, onSelect: p.onInvite }]
      : []),
    ...(p.canEdit
      ? [
          { id: 'recalc', label: t('card.recalc'), icon: <RefreshCw aria-hidden />, onSelect: p.onRecalc },
          { id: 'merge', label: t('card.merge.open'), icon: <GitMerge aria-hidden />, onSelect: p.onMerge },
        ]
      : []),
    ...(p.canDelete
      ? [
          { id: 'sep', separator: true } as const,
          { id: 'delete', label: t('card.delete'), icon: <Trash2 aria-hidden />, danger: true, onSelect: p.onDelete },
          { id: 'purge', label: t('card.purge'), icon: <ShieldAlert aria-hidden />, danger: true, onSelect: p.onPurge },
        ]
      : []),
  ];
  if (items.length === 0) return null;
  return (
    <span data-f="F-00-130 F-04-062 F-04-073 F-04-074 F-04-135 F-04-136 F-04-137 F-04-211">
      <DropdownMenu
        label={t('card.more')}
        align="end"
        trigger={(tp) => <IconButton {...tp} icon={<MoreVertical aria-hidden />} label={t('card.more')} variant="outline" />}
        items={items}
      />
    </span>
  );
}
