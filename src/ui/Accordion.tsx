'use client';

import { useId, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Collapse } from '@/ui/Collapse';

export interface AccordionItem {
  id: string;
  title: ReactNode;
  content: ReactNode;
  defaultOpen?: boolean;
}

export interface AccordionProps {
  items: AccordionItem[];
  /** Можно раскрыть несколько сразу */
  multiple?: boolean;
  /** card — своя рамка и фон (по умолчанию); plain — только разделители, для Accordion внутри SectionCard/Card */
  variant?: 'card' | 'plain';
  className?: string;
}

/** Раскрывающиеся блоки (FAQ, группы настроек) */
export function Accordion({ items, multiple = false, variant = 'card', className }: AccordionProps) {
  const baseId = useId();
  const [open, setOpen] = useState<string[]>(() => {
    const initial = items.filter((i) => i.defaultOpen).map((i) => i.id);
    return multiple ? initial : initial.slice(0, 1);
  });

  const toggle = (id: string) =>
    setOpen((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      return multiple ? [...prev, id] : [id];
    });

  return (
    <div
      className={cn(
        'divide-y divide-border',
        variant === 'card' && 'overflow-hidden rounded-xl border border-border bg-surface',
        className,
      )}
    >
      {items.map((item) => {
        const isOpen = open.includes(item.id);
        const buttonId = `${baseId}-${item.id}-button`;
        const panelId = `${baseId}-${item.id}-panel`;
        return (
          <div key={item.id}>
            <h3>
              <button
                id={buttonId}
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => toggle(item.id)}
                className={cn(
                  'group/acc flex min-h-13 w-full items-center justify-between gap-3 py-3 text-left text-base font-medium text-fg transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus',
                  variant === 'card' ? 'px-4 hover:bg-surface-2 sm:px-5' : 'rounded-lg px-1 hover:text-primary-text',
                )}
              >
                <span className="min-w-0">{item.title}</span>
                <ChevronDown
                  aria-hidden
                  className={cn('size-5 shrink-0 text-muted transition-transform duration-200', isOpen && 'rotate-180')}
                />
              </button>
            </h3>
            <Collapse
              open={isOpen}
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              className={cn('pb-4 text-base leading-relaxed text-muted', variant === 'card' ? 'px-4 sm:px-5' : 'px-1')}
            >
              {item.content}
            </Collapse>
          </div>
        );
      })}
    </div>
  );
}
