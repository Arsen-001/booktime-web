'use client';

/**
 * Действия над отмеченными клиентами (F-04-009, F-04-034…042): липкая панель «Выбрано: N» с главными действиями на виду —
 * «Написать» и «В категорию», остальное в «⋯» (ux-r5 №12, ux-r1 №8). Окна рассылки, категории и удаления — здесь же.
 */
import { useState } from 'react';
import { Download, Send, Smartphone, Tag, Trash2 } from 'lucide-react';
import { BulkCategoryModal } from '@/areas/clients/components/BulkCategoryModal';
import { BulkDeleteModal } from '@/areas/clients/components/BulkDeleteModal';
import { BulkMessageModal, type BulkMessageChannel } from '@/areas/clients/components/BulkMessageModal';
import type { Id } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { ExitHold } from '@/ui/ExitHold';
import { BulkActionBar } from '@/ui/BulkActionBar';
import { Button } from '@/ui/Button';
import type { DropdownMenuItem } from '@/ui/DropdownMenu';

export interface ClientsBulkActionsProps {
  businessId: Id;
  selected: Id[];
  onClear: () => void;
  categoryOptions: string[];
  canMail: boolean;
  canEdit: boolean;
  canExport: boolean;
  canDelete: boolean;
  exporting: boolean;
  onExport: (ids: Id[]) => void;
}

export function ClientsBulkActions({
  businessId,
  selected,
  onClear,
  categoryOptions,
  canMail,
  canEdit,
  canExport,
  canDelete,
  exporting,
  onExport,
}: ClientsBulkActionsProps) {
  const t = useT('clients');
  const [message, setMessage] = useState<BulkMessageChannel | null>(null);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const more: DropdownMenuItem[] = [
    ...(canMail ? [{ id: 'push', label: t('bulk.actions.push'), icon: <Smartphone aria-hidden />, onSelect: () => setMessage('push') }] : []),
    ...(canExport
      ? [{ id: 'export', label: t('selection.exportSelected'), icon: <Download aria-hidden />, disabled: exporting, onSelect: () => onExport(selected) }]
      : []),
    ...(canDelete
      ? [
          { id: 'sep', separator: true } as const,
          { id: 'delete', label: t('bulk.actions.delete'), icon: <Trash2 aria-hidden />, danger: true, onSelect: () => setDeleteOpen(true) },
        ]
      : []),
  ];

  return (
    <>
      {/* contents: своей коробки нет — панель липнет внутри контейнера таблицы, а не внутри этой обёртки */}
      <div data-f="F-04-009 F-04-037 F-04-203" className="contents">
        <BulkActionBar
          count={selected.length}
          onClear={onClear}
          actions={
            <>
              {canMail && (
                // На телефоне — только значки: иначе панель шире экрана (подпись остаётся для скринридера)
                <Button size="sm" variant="secondary" leftIcon={<Send aria-hidden />} className="max-sm:gap-0 max-sm:px-3" onClick={() => setMessage('sms')}>
                  <span className="max-sm:sr-only">{t('bulk.actions.smsShort')}</span>
                </Button>
              )}
              {canEdit && (
                <Button
                  size="sm"
                  variant="secondary"
                  leftIcon={<Tag aria-hidden />}
                  className="max-sm:gap-0 max-sm:px-3"
                  onClick={() => setCategoryOpen(true)}
                  data-f="F-04-041"
                >
                  <span className="max-sm:sr-only">{t('bulk.actions.categoryShort')}</span>
                </Button>
              )}
            </>
          }
          moreItems={more.length > 0 ? more : undefined}
        />
      </div>

      {/* ExitHold: окно уходит с анимацией, а не пропадает за кадр вместе с условием */}
      <ExitHold value={message}>
        {(channel) => <BulkMessageModal open onOpenChange={(o) => !o && setMessage(null)} channel={channel} businessId={businessId} clientIds={selected} />}
      </ExitHold>
      <BulkCategoryModal open={categoryOpen} onOpenChange={setCategoryOpen} clientIds={selected} categoryOptions={categoryOptions} onApplied={onClear} />
      <BulkDeleteModal open={deleteOpen} onOpenChange={setDeleteOpen} businessId={businessId} clientIds={selected} onDeleted={onClear} />
    </>
  );
}
