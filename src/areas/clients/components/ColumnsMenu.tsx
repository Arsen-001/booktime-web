'use client';

/**
 * Настройка колонок таблицы (F-04-004 показ/скрытие, F-04-005 закрепление до 5): булавка вместо замка,
 * который читается как «заблокировано» (ux-r1 №6, №21). Колонки — свои у сотрудника.
 *
 * С3 (clients-review 27.09.2026): раньше жила за отдельной неподписанной иконкой рядом с поиском — два
 * непонятных значка (фильтры, колонки) в одном ряду. Теперь это шторка, которую открывает пункт «Колонки»
 * в меню «⋯» (ClientsHeaderActions) — своей кнопки в строке больше нет.
 */
import { Pin, PinOff } from 'lucide-react';
import { setVisibleColumns, togglePinnedColumn } from '@/api/clients';
import { useApiMutation } from '@/api/request';
import type { ClientColumnId, ColumnsPrefs } from '@/domain/clients';
import { CLIENT_COLUMN_IDS, MAX_PINNED_COLUMNS } from '@/domain/clients';
import type { Id } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { Checkbox } from '@/ui/Checkbox';
import { IconButton } from '@/ui/IconButton';
import { Sheet } from '@/ui/Sheet';
import { useToast } from '@/ui/Toast';

export interface ColumnsMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId: Id;
  staffId?: Id;
  prefs: ColumnsPrefs;
}

export function ColumnsMenu({ open, onOpenChange, businessId, staffId, prefs }: ColumnsMenuProps) {
  const t = useT('clients');
  const toast = useToast();
  const setVisible = useApiMutation(setVisibleColumns);
  const togglePin = useApiMutation(togglePinnedColumn);

  const toggle = async (id: ClientColumnId, on: boolean) => {
    const visible = on ? [...prefs.visible, id] : prefs.visible.filter((x) => x !== id);
    try {
      await setVisible.mutate({ businessId, staffId, visible });
    } catch {
      toast.error(t('columns.updateFailed'));
    }
  };

  const pin = async (id: ClientColumnId) => {
    try {
      await togglePin.mutate({ businessId, staffId, id });
    } catch {
      toast.error(t('columns.pinLimit', { max: MAX_PINNED_COLUMNS }));
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} side="right" size="sm" title={t('columns.title')} description={t('columns.pinHint')}>
      <div data-f="F-04-004 F-04-005" className="flex flex-col gap-1">
        {CLIENT_COLUMN_IDS.map((id) => {
          const visible = prefs.visible.includes(id);
          const pinned = prefs.pinned.includes(id);
          const isName = id === 'name';
          const column = t(`table.columns.${id}`);
          return (
            <div key={id} className="flex items-center gap-1 rounded-lg px-1 py-0.5 hover:bg-surface-2">
              <Checkbox className="flex-1" checked={visible} disabled={isName} onCheckedChange={(on) => toggle(id, on)} label={column} />
              <IconButton
                icon={pinned ? <PinOff aria-hidden /> : <Pin aria-hidden />}
                label={pinned ? t('columns.unpinColumn', { column }) : t('columns.pinColumn', { column })}
                size="sm"
                variant={pinned ? 'secondary' : 'ghost'}
                disabled={isName || !visible}
                onClick={() => pin(id)}
              />
            </div>
          );
        })}
      </div>
    </Sheet>
  );
}
