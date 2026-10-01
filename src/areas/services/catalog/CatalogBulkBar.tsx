'use client';

/**
 * Массовые действия над отмеченными услугами (У10): онлайн вкл/выкл, перенести в категорию, удалить с «Отменить».
 */
import { useLocale } from 'next-intl';
import { FolderInput, Globe, GlobeLock, Trash2 } from 'lucide-react';
import type { ServiceRow } from '@/api/services';
import type { ServiceCategory } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { pickText } from '@/lib/text';
import type { CatalogActions } from '@/areas/services/catalog/useCatalogActions';
import { BulkActionBar } from '@/ui/BulkActionBar';
import { Button } from '@/ui/Button';
import type { DropdownMenuItem } from '@/ui/DropdownMenu';

export interface CatalogBulkBarProps {
  selectedRows: ServiceRow[];
  categories: ServiceCategory[];
  onClear: () => void;
  actions: CatalogActions;
}

export function CatalogBulkBar({ selectedRows, categories, onClear, actions }: CatalogBulkBarProps) {
  const t = useT('services');
  const locale = useLocale() as 'ru' | 'en';
  const ids = selectedRows.map((r) => r.service.id);
  const n = ids.length;
  const more: DropdownMenuItem[] = [
    { id: 'move-label', groupLabel: t('bulk.moveTo') },
    ...categories.map((c) => ({
      id: `move-${c.id}`,
      label: pickText(c.name, locale),
      icon: <FolderInput aria-hidden />,
      onSelect: () => {
        void actions.bulkPatch(ids, { categoryId: c.id }, t('bulk.moved', { count: n, name: pickText(c.name, locale) }));
        onClear();
      },
    })),
    { id: 'sep', separator: true },
    {
      id: 'delete',
      label: t('delete.button'),
      icon: <Trash2 aria-hidden />,
      danger: true,
      onSelect: () => void actions.deleteServices(selectedRows).then((ok) => ok && onClear()),
    },
  ];
  return (
    <div data-f="F-00-082">
      <BulkActionBar
        count={n}
        onClear={onClear}
        actions={
          <>
            <Button
              size="sm"
              variant="ghost"
              className="text-bg hover:bg-bg/15"
              leftIcon={<Globe aria-hidden />}
              onClick={() => void actions.bulkPatch(ids, { onlineBookable: true }, t('bulk.onlineOnDone', { count: n }))}
            >
              <span className="max-sm:sr-only">{t('bulk.onlineOn')}</span>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-bg hover:bg-bg/15"
              leftIcon={<GlobeLock aria-hidden />}
              onClick={() => void actions.bulkPatch(ids, { onlineBookable: false }, t('bulk.onlineOffDone', { count: n }))}
            >
              <span className="max-sm:sr-only">{t('bulk.onlineOff')}</span>
            </Button>
          </>
        }
        moreItems={more}
      />
    </div>
  );
}
