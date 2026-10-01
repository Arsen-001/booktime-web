import { isValidElement, type ChangeEvent, type ReactElement, type ReactNode } from 'react';
import type { DateRange } from '@/ui/Calendar';

/** Что FilterBar знает о фильтре: включён ли он, что написать на чипе и как его убрать */
export interface FilterState {
  active: boolean;
  /** Значение словами — для чипа «Касса: Основная» */
  value: ReactNode;
  clear: () => void;
}

interface Option {
  value: string;
  label: string;
}

type AnyProps = Record<string, unknown>;

const isFn = (v: unknown): v is (...args: never[]) => unknown => typeof v === 'function';

/** Поле с собственным значением — дальше вглубь не идём */
function isControl(props: AnyProps): boolean {
  return 'value' in props && (isFn(props.onValueChange) || isFn(props.onChange));
}

/**
 * Состояние фильтра по его полю — чтобы каждый экран не описывал чипы руками. Узнаём по пропсам (утиная типизация):
 *  - список (Select, MultiSelectFilter): options + value + onValueChange; «по умолчанию» — вариант '' («Все …»),
 *    при подсказке placeholder — пусто, иначе первый вариант (напр. «Без отменённых»);
 *  - период (DateRangePicker): value {from, to} + onValueChange;
 *  - текст (Input, SearchInput): строковый value + onChange/onValueChange.
 * Поле в обёртке (<div data-f><Input/></div>) находим, спускаясь по единственному ребёнку.
 * Не узнали — undefined: экран передаёт active/chip/onClear сам (группа чипов и т. п.).
 */
export function deriveFilterState(node: ReactNode, formatRange: (range: DateRange | undefined) => string | null): FilterState | undefined {
  let el: ReactElement<AnyProps> | undefined = isValidElement<AnyProps>(node) ? node : undefined;
  for (let depth = 0; el && !isControl(el.props) && depth < 3; depth++) {
    const child = el.props.children;
    el = isValidElement<AnyProps>(child) ? child : undefined;
  }
  if (!el || !isControl(el.props)) return undefined;
  const { value, options, onValueChange, onChange, placeholder } = el.props;

  if (Array.isArray(options) && isFn(onValueChange)) {
    const opts = options as Option[];
    const set = onValueChange as (v: unknown) => void;
    if (Array.isArray(value)) {
      const picked = value as string[];
      return {
        active: picked.length > 0,
        value: opts.filter((o) => picked.includes(o.value)).map((o) => o.label).join(', ') || picked.join(', '),
        clear: () => set([]),
      };
    }
    if (value !== undefined && typeof value !== 'string') return undefined;
    const fallback = opts.some((o) => o.value === '') || placeholder ? '' : (opts[0]?.value ?? '');
    return {
      active: Boolean(value) && value !== fallback,
      value: opts.find((o) => o.value === value)?.label ?? value,
      clear: () => set(fallback),
    };
  }

  if (value && typeof value === 'object' && ('from' in value || 'to' in value) && isFn(onValueChange)) {
    const range = value as DateRange;
    return {
      active: Boolean(range.from || range.to),
      value: formatRange(range),
      clear: () => (onValueChange as (r: DateRange) => void)({}),
    };
  }
  // Период без выбранного значения (value={undefined}) узнаём по отсутствию options у поля с onValueChange и value
  if (value === undefined && isFn(onValueChange)) {
    return { active: false, value: null, clear: () => (onValueChange as (r: DateRange) => void)({}) };
  }

  if (typeof value === 'string') {
    return {
      active: value.trim() !== '',
      value,
      clear: () => {
        if (isFn(onValueChange)) (onValueChange as (v: string) => void)('');
        // Обычный <input>: onChange ждёт событие — отдаём минимальное, с пустым target.value
        else (onChange as (e: ChangeEvent<HTMLInputElement>) => void)({ target: { value: '' }, currentTarget: { value: '' } } as ChangeEvent<HTMLInputElement>);
      },
    };
  }
  return undefined;
}
