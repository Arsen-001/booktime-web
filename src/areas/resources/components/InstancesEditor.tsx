'use client';

/**
 * Экземпляры ресурса в форме (F-16-004): сколько одинаковых мест и как их зовут. Правится в черновике вместе с
 * остальной формой и сохраняется той же кнопкой «Сохранить» — раньше каждое добавление/переименование/удаление
 * было отдельным окном с мгновенной записью, а удаление — без вопроса.
 */
import { Plus, X } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { IconButton } from '@/ui/IconButton';
import { Input } from '@/ui/Input';
import { newRowKey, type InstanceRow } from '@/areas/resources/lib/draft';

/** Больше не бывает: 50 одинаковых мест — уже зал, а не кресла */
const MAX_INSTANCES = 50;

export interface InstancesEditorProps {
  rows: InstanceRow[];
  onRowsChange: (rows: InstanceRow[]) => void;
  /** Подпись нового экземпляра по умолчанию: «Кресло» → «Кресло 3» */
  kindLabel: string;
  errors?: Record<string, string>;
  /** Будущие записи по id существующего экземпляра */
  futureByInstance?: Record<string, number>;
  disabled?: boolean;
}

export function InstancesEditor({ rows, onRowsChange, kindLabel, errors, futureByInstance, disabled }: InstancesEditorProps) {
  const t = useT('resources');

  const add = () => {
    const taken = new Set(rows.map((r) => r.name.trim().toLocaleLowerCase()));
    let n = rows.length + 1;
    while (taken.has(`${kindLabel} ${n}`.toLocaleLowerCase())) n += 1;
    onRowsChange([...rows, { key: newRowKey(), name: `${kindLabel} ${n}` }]);
  };

  return (
    <div className="flex flex-col gap-2">
      <ol className="flex flex-col gap-2">
        {rows.map((row, i) => {
          const error = errors?.[row.key];
          const future = row.id ? (futureByInstance?.[row.id] ?? 0) : 0;
          return (
            <li key={row.key} className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="w-9 shrink-0 text-sm tabular-nums text-muted">{t('form.instanceNumber', { n: i + 1 })}</span>
                <Input
                  value={row.name}
                  maxLength={40}
                  invalid={Boolean(error)}
                  disabled={disabled}
                  aria-label={t('detail.instanceName')}
                  placeholder={t('form.instanceNamePlaceholder', { example: `${kindLabel} ${i + 1}` })}
                  onChange={(e) => onRowsChange(rows.map((r) => (r.key === row.key ? { ...r, name: e.target.value } : r)))}
                  className="min-w-0 flex-1"
                />
                {!disabled && (
                  <IconButton
                    icon={<X aria-hidden />}
                    label={t('form.removeInstance')}
                    variant="ghost"
                    disabled={rows.length <= 1}
                    onClick={() => onRowsChange(rows.filter((r) => r.key !== row.key))}
                  />
                )}
              </div>
              {(error || future > 0) && (
                <p className={error ? 'ps-11 text-sm text-danger' : 'ps-11 text-xs text-muted'}>
                  {error ?? t('form.instanceFuture', { count: future })}
                </p>
              )}
            </li>
          );
        })}
      </ol>
      {!disabled && (
        <div className="flex flex-wrap items-center justify-between gap-2 ps-11">
          <Button size="sm" variant="outline" leftIcon={<Plus aria-hidden />} onClick={add} disabled={rows.length >= MAX_INSTANCES}>
            {t('form.addInstance')}
          </Button>
          {rows.length <= 1 && <span className="text-xs text-muted">{t('detail.lastInstance')}</span>}
        </div>
      )}
    </div>
  );
}
