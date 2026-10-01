'use client';

import type { ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useT } from '@/i18n/useT';
import { Breadcrumbs, type BreadcrumbItem } from '@/ui/Breadcrumbs';
import { LinkButton } from '@/ui/Button';


/** «Назад» — переход страницы в обратную сторону (PageTransition) */
const NAV_BACK = ['nav-back'];

export interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** Кнопки справа; на телефоне переносятся под заголовок */
  actions?: ReactNode;
  /** Ссылка «Назад» над заголовком */
  back?: { href: string; label?: string };
  breadcrumbs?: BreadcrumbItem[];
  /** Строка под заголовком: метки, счётчики */
  meta?: ReactNode;
  className?: string;
}

/** Шапка страницы: заголовок, описание, действия */
export function PageHeader({ title, description, actions, back, breadcrumbs, meta, className }: PageHeaderProps) {
  const t = useT('ui');
  return (
    <header className={cn('flex flex-col gap-3', className)}>
      {back && (
        <div>
          <LinkButton
            href={back.href}
            transitionTypes={NAV_BACK}
            variant="ghost"
            size="sm"
            leftIcon={<ChevronLeft aria-hidden />}
            className="-ml-2 px-2 text-muted hover:text-fg"
          >
            {back.label ?? t('pageHeader.back')}
          </LinkButton>
        </div>
      )}
      {breadcrumbs && breadcrumbs.length > 0 && <Breadcrumbs items={breadcrumbs} className="-ml-1" />}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <h1 className="text-2xl leading-tight font-bold tracking-tight text-fg sm:text-[1.75rem] sm:leading-tight">
            {title}
          </h1>
          {description && <p className="mt-1.5 max-w-3xl text-base leading-relaxed text-muted">{description}</p>}
          {meta && <div className="mt-2.5 flex flex-wrap items-center gap-2">{meta}</div>}
        </div>
        {actions && (
          // Телефон: кнопки тянутся на всю строку (ровный столбец под большой палец, а не лесенка разной ширины);
          // квадратные кнопки-иконки остаются квадратными. С sm — как было: справа от заголовка.
          <div
            data-page-actions=""
            className={cn(
              'flex shrink-0 flex-wrap items-center gap-2 sm:pt-1',
              // Раздел завернул кнопки в свой <div> — на телефоне обёртка «растворяется», и правила ниже работают так же
              'max-sm:[&>div]:contents',
              'max-sm:[&_a:not([data-icon-button])]:grow max-sm:[&_button:not([data-icon-button])]:grow',
              // Телефон: главное действие — первым (разделы кладут secondary раньше в DOM — для десктопа это «слева»)
              'max-sm:[&_[data-variant=primary]]:order-first',
            )}
          >
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}
