'use client';

import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { ChoiceCard } from '@/ui/ChoiceCard';
import { useControllableState } from '@/ui/hooks/useControllableState';

export interface ChoiceOption {
  value: string;
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
}

interface ChoiceGroupBase {
  options: ChoiceOption[];
  /** Колонок с sm: 1 или 2 (на телефоне всегда одна) */
  columns?: 1 | 2;
  className?: string;
  id?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
}

interface ChoiceGroupSingle extends ChoiceGroupBase {
  multiple?: false;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
}

interface ChoiceGroupMultiple extends ChoiceGroupBase {
  multiple: true;
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (value: string[]) => void;
}

export type ChoiceGroupProps = ChoiceGroupSingle | ChoiceGroupMultiple;

const COLUMNS: Record<1 | 2, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 sm:grid-cols-2',
};

/**
 * Выбор карточками с иконкой и пояснением: «где принимаю», сфера бизнеса, тип ссылки, «кто видит календарь».
 * Один вариант (как RadioGroup: стрелки двигают выбор) или несколько (`multiple`, как флажки).
 * Больше 6 вариантов или короткие подписи без пояснений — лучше Select / RadioGroup / чипы.
 */
export function ChoiceGroup(props: ChoiceGroupProps) {
  const { options, columns = 2, className, ...aria } = props;
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const [single, setSingle] = useControllableState<string>(
    props.multiple ? undefined : props.value,
    props.multiple ? '' : (props.defaultValue ?? ''),
    props.multiple ? undefined : props.onValueChange,
  );
  const [many, setMany] = useControllableState<string[]>(
    props.multiple ? props.value : undefined,
    props.multiple ? (props.defaultValue ?? []) : [],
    props.multiple ? props.onValueChange : undefined,
  );

  const isOn = (v: string) => (props.multiple ? many.includes(v) : single === v);
  const toggle = (v: string) => {
    if (props.multiple) setMany(many.includes(v) ? many.filter((x) => x !== v) : [...many, v]);
    else setSingle(v);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (props.multiple) return;
    const dir =
      e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const start = Math.max(
      0,
      options.findIndex((o) => o.value === single),
    );
    for (let step = 1; step <= options.length; step++) {
      const i = (start + dir * step + options.length) % options.length;
      if (!options[i].disabled) {
        setSingle(options[i].value);
        refs.current[i]?.focus();
        break;
      }
    }
  };

  const firstEnabled = options.findIndex((o) => !o.disabled);
  const selectedIndex = options.findIndex((o) => o.value === single);

  return (
    <div
      role={props.multiple ? 'group' : 'radiogroup'}
      onKeyDown={onKeyDown}
      className={cn('grid gap-3', COLUMNS[columns], className)}
      id={aria.id}
      aria-label={aria['aria-label']}
      aria-labelledby={aria['aria-labelledby']}
      aria-describedby={aria['aria-describedby']}
    >
      {options.map((o, i) => (
        <ChoiceCard
          key={o.value}
          ref={(el) => {
            refs.current[i] = el;
          }}
          kind={props.multiple ? 'checkbox' : 'radio'}
          title={o.title}
          description={o.description}
          icon={o.icon}
          disabled={o.disabled}
          selected={isOn(o.value)}
          // Радио — одна точка табуляции (выбранная или первая доступная), стрелки двигают выбор
          tabIndex={props.multiple ? undefined : i === (selectedIndex >= 0 ? selectedIndex : firstEnabled) ? 0 : -1}
          onClick={() => toggle(o.value)}
        />
      ))}
    </div>
  );
}
