'use client';

import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { Checkbox } from '@/ui/Checkbox';
import { Popover } from '@/ui/Popover';

export interface MultiSelectOption {
  value: string;
  label: string;
}

export interface MultiSelectFilterProps {
  label: string;
  options: MultiSelectOption[];
  value: string[];
  onValueChange: (value: string[]) => void;
}

/** Фильтр с множественным выбором (чекбоксы во всплывающей панели) — F-02-003 «Должности», «Специализации» */
export function MultiSelectFilter({ label, options, value, onValueChange }: MultiSelectFilterProps) {
  const toggle = (v: string) => {
    onValueChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  };

  return (
    <Popover
      label={label}
      trigger={(p) => (
        <Button {...p} variant="outline" size="sm">
          {label}
          {value.length > 0 && (
            <Badge tone="primary" className="ml-1">
              {value.length}
            </Badge>
          )}
        </Button>
      )}
    >
      <div className="flex max-h-72 w-64 flex-col gap-1 overflow-y-auto p-2">
        {options.length === 0 ? (
          <p className="px-2 py-1.5 text-sm text-muted">—</p>
        ) : (
          options.map((o) => (
            <Checkbox
              key={o.value}
              label={o.label}
              checked={value.includes(o.value)}
              onCheckedChange={() => toggle(o.value)}
              classNames={{ root: 'rounded-lg px-2 py-1.5 hover:bg-surface-2' }}
            />
          ))
        )}
      </div>
    </Popover>
  );
}
