'use client';

/**
 * Мультивыбор флажками внутри панели «Фильтры». Пропсы options + value[] + onValueChange — FilterBar узнаёт поле сам
 * (чип «Запись через: Emly, Altegio», «Сбросить»).
 */
import { Checkbox } from '@/ui/Checkbox';

export interface CheckListFilterProps {
  options: { value: string; label: string }[];
  value: string[];
  onValueChange: (value: string[]) => void;
}

export function CheckListFilter({ options, value, onValueChange }: CheckListFilterProps) {
  const toggle = (v: string) => onValueChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  return (
    <div className="flex flex-col">
      {options.map((o) => (
        <Checkbox
          key={o.value}
          label={o.label}
          checked={value.includes(o.value)}
          onCheckedChange={() => toggle(o.value)}
          classNames={{ root: 'rounded-lg px-2 hover:bg-surface-2' }}
        />
      ))}
    </div>
  );
}
