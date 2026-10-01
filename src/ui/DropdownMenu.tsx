'use client';

import Link from 'next/link';
import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Popover, type PopoverTriggerProps } from '@/ui/Popover';
import type { FloatingAlign } from '@/ui/hooks/useFloating';
import { useIsMobile } from '@/ui/hooks/useMediaQuery';
import { useT } from '@/i18n/useT';
import { EmptyState } from '@/ui/EmptyState';

export interface DropdownMenuAction {
  id: string;
  label: ReactNode;
  icon?: ReactNode;
  onSelect?: () => void;
  /** Ссылка вместо действия */
  href?: string;
  danger?: boolean;
  disabled?: boolean;
  /** Подсказка справа (горячая клавиша, счётчик) */
  hint?: ReactNode;
}

export type DropdownMenuItem =
  DropdownMenuAction | { id: string; separator: true } | { id: string; groupLabel: ReactNode };

export interface DropdownMenuProps {
  trigger: (props: PopoverTriggerProps) => ReactNode;
  items: DropdownMenuItem[];
  align?: FloatingAlign;
  label?: string;
  /** Телефон: sheet — нижней шторкой со строками 48 px (по умолчанию), popover — панелью у кнопки */
  mobile?: 'popover' | 'sheet';
  className?: string;
}

function isAction(item: DropdownMenuItem): item is DropdownMenuAction {
  return !('separator' in item) && !('groupLabel' in item);
}

const ITEM =
  'group/mi flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[0.9375rem] outline-none transition-colors md:min-h-10 focus-visible:bg-surface-2 hover:bg-surface-2 active:bg-surface-3 aria-disabled:pointer-events-none aria-disabled:opacity-50';

function MenuList({
  items,
  close,
  label,
  inSheet,
}: {
  items: DropdownMenuItem[];
  close: () => void;
  label?: string;
  inSheet: boolean;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // В шторке на телефоне первый пункт не подсвечиваем: пальцем выбирают сразу, подсветка выглядит как «уже выбрано»
    if (inSheet) return;
    // Кадр спустя: к этому моменту useFloating уже сделал панель видимой (скрытое не фокусируется)
    const frame = requestAnimationFrame(() =>
      listRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])')?.focus(),
    );
    return () => cancelAnimationFrame(frame);
  }, [inSheet]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const nodes = Array.from(
      listRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])') ?? [],
    );
    if (nodes.length === 0) return;
    const index = nodes.indexOf(document.activeElement as HTMLElement);
    let next = -1;
    if (event.key === 'ArrowDown') next = (index + 1) % nodes.length;
    else if (event.key === 'ArrowUp') next = (index - 1 + nodes.length) % nodes.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = nodes.length - 1;
    else if (event.key === 'Tab') close();
    if (next >= 0) {
      event.preventDefault();
      nodes[next].focus();
    }
  };

  return (
    <div ref={listRef} role="menu" aria-label={label} onKeyDown={onKeyDown} className="flex flex-col">
      {!items.some(isAction) && <EmptyState variant="inline" />}
      {items.map((item) => {
        if ('separator' in item)
          return <div key={item.id} role="separator" className="-mx-1.5 my-1.5 h-px bg-border" />;
        if ('groupLabel' in item)
          return (
            <div key={item.id} className="px-3 pt-2 pb-1.5 text-[13px] font-semibold text-muted">
              {item.groupLabel}
            </div>
          );
        if (!isAction(item)) return null;
        const body = (
          <>
            {item.icon && (
              <span
                className={cn(
                  'shrink-0 text-muted transition-colors group-hover/mi:text-fg [&_svg]:size-5',
                  item.danger && 'text-danger group-hover/mi:text-danger',
                )}
              >
                {item.icon}
              </span>
            )}
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            {item.hint && <span className="shrink-0 text-sm text-muted">{item.hint}</span>}
          </>
        );
        const cls = cn(
          ITEM,
          inSheet && 'min-h-12 text-base',
          item.danger ? 'text-danger hover:bg-danger-soft focus-visible:bg-danger-soft' : 'text-fg',
        );
        if (item.href && !item.disabled)
          return (
            <Link
              key={item.id}
              href={item.href}
              role="menuitem"
              tabIndex={-1}
              className={cls}
              onClick={() => {
                item.onSelect?.();
                close();
              }}
            >
              {body}
            </Link>
          );
        return (
          <button
            key={item.id}
            type="button"
            role="menuitem"
            tabIndex={-1}
            aria-disabled={item.disabled || undefined}
            className={cls}
            onClick={() => {
              if (item.disabled) return;
              item.onSelect?.();
              close();
            }}
          >
            {body}
          </button>
        );
      })}
    </div>
  );
}

/** Меню действий у кнопки: стрелки ↑↓, Home/End, Enter, Esc. Пункт — действие или ссылка. */
export function DropdownMenu({ trigger, items, align = 'end', label, mobile = 'sheet', className }: DropdownMenuProps) {
  const t = useT('ui');
  const isMobile = useIsMobile();
  const inSheet = mobile === 'sheet' && isMobile;
  return (
    <Popover
      trigger={trigger}
      align={align}
      role="menu"
      mobile={mobile}
      label={label ?? (inSheet ? t('table.actions') : undefined)}
      className={cn('min-w-[14rem] p-1.5', className)}
    >
      {({ close }) => <MenuList items={items} close={close} label={label} inSheet={inSheet} />}
    </Popover>
  );
}
