'use client';

/**
 * Шапка базы: одна primary «Добавить клиента» (на телефоне её место — плавающая кнопка у пальца) и меню «⋯» с редким:
 * загрузка из Excel, выгрузка найденных, прошлый визит (ux-r1 №1, ux-r5 улучшение 1, onboarding-k3 №1).
 * С3 (clients-review 27.09.2026): «Колонки» тоже сюда — раньше стояла отдельной неподписанной иконкой рядом с поиском.
 */
import { CalendarPlus, Columns3, Download, MoreHorizontal, Upload, UserPlus } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { DropdownMenu, type DropdownMenuItem } from '@/ui/DropdownMenu';
import { IconButton } from '@/ui/IconButton';

export interface ClientsHeaderActionsProps {
  canEdit: boolean;
  canExport: boolean;
  /** Сколько уйдёт в выгрузку — все найденные (ux-r1 №23: «Выгрузить 25 клиентов») */
  exportCount: number;
  exporting: boolean;
  /** База недоступна (ошибка) или ещё не готова — действия с ней выключены (ux-r1 №25) */
  disabled: boolean;
  onAdd: () => void;
  onAddVisit: () => void;
  onExport: () => void;
  onOpenColumns: () => void;
}

export function ClientsHeaderActions({
  canEdit,
  canExport,
  exportCount,
  exporting,
  disabled,
  onAdd,
  onAddVisit,
  onExport,
  onOpenColumns,
}: ClientsHeaderActionsProps) {
  const t = useT('clients');
  const items: DropdownMenuItem[] = [
    { id: 'columns', label: t('columns.title'), icon: <Columns3 aria-hidden />, onSelect: onOpenColumns },
    ...(canEdit ? [{ id: 'import', label: t('excel.import'), icon: <Upload aria-hidden />, href: '/biz/clients/import' }] : []),
    // F-04-130: без права выгрузки пункта нет совсем
    ...(canExport
      ? [
          {
            id: 'export',
            label: t('excel.exportCount', { count: exportCount }),
            icon: <Download aria-hidden />,
            disabled: disabled || exporting || exportCount === 0,
            onSelect: onExport,
          },
        ]
      : []),
    ...(canEdit
      ? [{ id: 'sep', separator: true } as const, { id: 'visit', label: t('addPastVisit'), icon: <CalendarPlus aria-hidden />, disabled, onSelect: onAddVisit }]
      : []),
  ];

  return (
    <>
      <span data-f="F-04-126 F-04-130 F-00-129 F-04-004 F-04-005">
        <DropdownMenu
          label={t('card.more')}
          align="end"
          trigger={(p) => <IconButton {...p} icon={<MoreHorizontal aria-hidden />} label={t('card.more')} variant="outline" />}
          items={items}
        />
      </span>
      {canEdit && (
        <Button leftIcon={<UserPlus aria-hidden />} disabled={disabled} onClick={onAdd} className="max-md:hidden">
          {t('addClient')}
        </Button>
      )}
    </>
  );
}
