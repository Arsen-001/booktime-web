'use client';

/**
 * F-16-024 (и F-14-087 «Масштаб журнала»): журнал на телефоне — «приложение для бизнеса» у нас не отдельное
 * (ответ В-31), его функции строит сам журнал на 390px. Сотрудники / Ресурсы, кратность 5/10/15 мин и
 * число колонок на экране (ресурсы — до 3, сотрудники — до 5; остальные — прокруткой вбок). Журнал
 * перестраивается сразу (предпросмотр), остаётся — по «Сохранить»; закрыть без сохранения = вернуть как было.
 * В недельном виде колонок нет — настройка скрыта, значение дня сохраняется до возврата в день (1504).
 */
import type { JournalGroupBy, JournalZoomMin } from '@/domain/journal';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { FormField } from '@/ui/FormField';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { Sheet } from '@/ui/Sheet';

export interface JournalScaleValue {
  groupBy: JournalGroupBy;
  zoomMin: JournalZoomMin;
  columns: number;
}

/** Потолок колонок на экране телефона (1504): ресурсы — 3, сотрудники — 5 */
export function maxMobileColumns(groupBy: JournalGroupBy): number {
  return groupBy === 'resource' ? 3 : 5;
}

export interface JournalScaleSheetProps {
  open: boolean;
  value: JournalScaleValue;
  onChange: (value: JournalScaleValue) => void;
  onSave: () => void;
  onCancel: () => void;
  showColumns: boolean;
  canSwitchMode: boolean;
}

export function JournalScaleSheet({ open, value, onChange, onSave, onCancel, showColumns, canSwitchMode }: JournalScaleSheetProps) {
  const t = useT('journal');
  const maxColumns = maxMobileColumns(value.groupBy);
  const columnOptions = Array.from({ length: maxColumns }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }));

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && onCancel()}
      title={t('scale.title')}
      description={t('scale.description')}
      side="bottom"
      size="sm"
      footer={
        <div className="flex w-full gap-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
            {t('scale.cancel')}
          </Button>
          <Button type="button" className="flex-1" onClick={onSave}>
            {t('scale.save')}
          </Button>
        </div>
      }
    >
      <div data-f="F-16-024 F-14-087" className="flex flex-col gap-4">
        {canSwitchMode && (
          <FormField label={t('scale.mode')}>
            <SegmentedControl
              fullWidth
              value={value.groupBy}
              onValueChange={(v) => {
                const groupBy = v as JournalGroupBy;
                onChange({ ...value, groupBy, columns: Math.min(value.columns, maxMobileColumns(groupBy)) });
              }}
              options={[
                { value: 'staff', label: t('scale.modeStaff') },
                { value: 'resource', label: t('scale.modeResources') },
              ]}
            />
          </FormField>
        )}
        <FormField label={t('scale.multiplicity')} hint={t('scale.multiplicityHint')}>
          <SegmentedControl
            fullWidth
            value={String(value.zoomMin)}
            onValueChange={(v) => onChange({ ...value, zoomMin: Number(v) as JournalZoomMin })}
            options={[5, 10, 15].map((m) => ({ value: String(m), label: t('scale.minutes', { m }) }))}
          />
        </FormField>
        {showColumns && (
          <FormField label={t('scale.columns')} hint={t('scale.columnsHint', { max: maxColumns })}>
            <SegmentedControl
              fullWidth
              value={String(Math.min(value.columns, maxColumns))}
              onValueChange={(v) => onChange({ ...value, columns: Number(v) })}
              options={columnOptions}
            />
          </FormField>
        )}
      </div>
    </Sheet>
  );
}
