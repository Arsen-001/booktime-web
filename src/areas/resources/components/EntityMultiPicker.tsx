'use client';

/**
 * Выбор нескольких сущностей по id с поиском (F-16-003 «Услуги» ресурса, F-16-006 «Ресурсы» услуги):
 * поле показывает выбранное чипами, клик открывает шторку со списком и галочками.
 */
import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { normalizeSearch } from '@/lib/text';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { DropdownChevron } from '@/ui/DropdownChevron';
import { Checkbox } from '@/ui/Checkbox';
import { Chip } from '@/ui/Chip';
import { EmptyState } from '@/ui/EmptyState';
import { Input } from '@/ui/Input';
import { Sheet } from '@/ui/Sheet';

export interface EntityOption {
  id: string;
  label: string;
  description?: string;
}

export interface EntityMultiPickerProps {
  options: EntityOption[];
  value: string[];
  onValueChange: (ids: string[]) => void;
  title: string;
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
  disabled?: boolean;
  /** Проставляет FormField (подпись и подсказка связываются с кнопкой) */
  id?: string;
  invalid?: boolean;
  'aria-describedby'?: string;
}

export function EntityMultiPicker({
  options,
  value,
  onValueChange,
  title,
  placeholder,
  searchPlaceholder,
  emptyText,
  disabled,
  id,
  invalid,
  'aria-describedby': ariaDescribedBy,
}: EntityMultiPickerProps) {
  const t = useT('resources');
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const byId = useMemo(() => new Map(options.map((o) => [o.id, o])), [options]);
  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const needle = normalizeSearch(query);
    return options.filter((o) => normalizeSearch(o.label).includes(needle));
  }, [options, query]);

  const toggle = (id: string) => onValueChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-invalid={invalid || undefined}
        aria-describedby={ariaDescribedBy}
        onClick={() => setOpen(true)}
        className="flex min-h-11 w-full items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-left text-sm transition-colors duration-150 hover:border-border-strong disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          {value.length === 0 ? (
            <span className="text-muted">{placeholder}</span>
          ) : (
            value.map((vid) => (
              <span key={vid} className="max-w-full truncate rounded-full bg-surface-3 px-2.5 py-1 text-xs font-medium text-fg">
                {byId.get(vid)?.label ?? vid}
              </span>
            ))
          )}
        </span>
        {/* Поле открывает список — стрелка, как у каждого выпадающего (DESIGN.md → «Dropdowns») */}
        <DropdownChevron open={open} />
      </button>

      <Sheet open={open} onOpenChange={setOpen} title={title} side="right" size="sm">
        <div className="flex flex-col gap-4">
          <Input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} leftIcon={<Search aria-hidden />} placeholder={searchPlaceholder} />
          {filtered.length === 0 ? (
            <EmptyState compact kind="search" onReset={query ? () => setQuery('') : undefined} description={emptyText} />
          ) : (
            <ul className="flex flex-col gap-1">
              {filtered.map((o) => (
                <li key={o.id} className="rounded-lg px-2 py-1 hover:bg-surface-2">
                  <Checkbox
                    checked={value.includes(o.id)}
                    onCheckedChange={() => toggle(o.id)}
                    label={o.label}
                    description={o.description}
                    classNames={{ root: 'min-h-11 py-1' }}
                  />
                </li>
              ))}
            </ul>
          )}
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            {value.length > 0 && (
              <Chip onClick={() => onValueChange([])}>{t('multiPicker.clear')}</Chip>
            )}
            <Button onClick={() => setOpen(false)}>{t('multiPicker.done')}</Button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}
