'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Portal } from '@/ui/Portal';

export interface FabProps {
  /** Иконка lucide (обычно Plus) */
  icon: ReactNode;
  /** Обязательная подпись: aria-label и подсказка; при `extended` — видимый текст рядом с иконкой */
  label: string;
  onClick?: () => void;
  /** Ссылка вместо действия */
  href?: string;
  /** Показать подпись рядом с иконкой (пилюля вместо круга) */
  extended?: boolean;
  /** Показывать и на десктопе (по умолчанию — только телефон: на десктопе главное действие в шапке страницы) */
  showOnDesktop?: boolean;
  className?: string;
}

const BASE =
  'fixed right-4 z-30 inline-flex h-14 animate-slide-up-soft items-center justify-center gap-2 rounded-full bg-primary text-primary-contrast shadow-lg ' +
  'transition-[background-color,box-shadow,transform] duration-150 ease-out hover:bg-primary-hover hover:shadow-xl active:scale-95 ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus [&_svg]:size-6 ' +
  // Над нижними вкладками, липкой панелью и «чёлкой»
  'bottom-[calc(env(safe-area-inset-bottom,0px)+var(--app-bottom-inset)+var(--sticky-bar-h)+1rem)] md:right-6 md:bottom-6';

/**
 * Плавающая круглая кнопка главного действия (56 px) у большого пальца: «Новая запись» над сеткой журнала,
 * где полоса на всю ширину отняла бы высоту. Одна на экран.
 */
export function Fab({ icon, label, onClick, href, extended = false, showOnDesktop = false, className }: FabProps) {
  const cls = cn(BASE, extended ? 'px-5 text-base font-semibold' : 'w-14', !showOnDesktop && 'md:hidden', className);
  const body = (
    <>
      {icon}
      {extended && <span>{label}</span>}
    </>
  );
  return (
    <Portal>
      {href ? (
        <Link href={href} aria-label={extended ? undefined : label} data-fab="" className={cls}>
          {body}
        </Link>
      ) : (
        <button
          type="button"
          onClick={onClick}
          aria-label={extended ? undefined : label}
          data-fab=""
          className={cls}
        >
          {body}
        </button>
      )}
    </Portal>
  );
}
