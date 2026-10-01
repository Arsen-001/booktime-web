import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface DropdownChevronProps {
  /** Список открыт — стрелка смотрит вверх */
  open?: boolean;
  className?: string;
}

/**
 * Стрелка «раскроется список» — у КАЖДОГО элемента, который открывает список/меню/выбор (правило владельца 26.09,
 * DESIGN.md → «Выпадающие»). 16 px, приглушённая; при открытии плавно поворачивается на 180° (transform, 150 мс,
 * при reduced-motion — сразу). Исключение — кнопки «⋯» (ещё действия): у них стрелки нет.
 * Button с aria-haspopup ставит её сам; Select, Combobox, DatePicker/TimePicker/DateRangePicker, PeriodNav — тоже.
 */
export function DropdownChevron({ open = false, className }: DropdownChevronProps) {
  return (
    <ChevronDown
      aria-hidden
      data-chevron=""
      className={cn(
        'pointer-events-none size-4 shrink-0 text-muted transition-transform duration-150 ease-out motion-reduce:transition-none',
        open && 'rotate-180',
        className,
      )}
    />
  );
}
