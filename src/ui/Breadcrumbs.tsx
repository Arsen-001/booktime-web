'use client';

import Link from 'next/link';
import { Fragment } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useT } from '@/i18n/useT';


/** Крошки ведут вверх по иерархии — переход страницы «назад» (PageTransition) */
const NAV_BACK = ['nav-back'];

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

/** Хлебные крошки: «Склад › Товары › Гель-лак» */
export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  const t = useT('ui');
  return (
    <nav aria-label={t('breadcrumbs.label')} className={className}>
      <ol className="flex flex-wrap items-center gap-x-1 text-sm">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <Fragment key={`${item.label}-${i}`}>
              <li className="min-w-0">
                {item.href && !last ? (
                  <Link
                    href={item.href}
                    transitionTypes={NAV_BACK}
                    className="inline-flex min-h-10 items-center rounded-md px-1 text-muted underline-offset-4 hover:text-fg hover:underline"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span
                    aria-current={last ? 'page' : undefined}
                    className={cn(
                      'inline-flex min-h-10 items-center px-1',
                      last ? 'font-medium text-fg' : 'text-muted',
                    )}
                  >
                    {item.label}
                  </span>
                )}
              </li>
              {!last && (
                <li aria-hidden className="text-muted">
                  <ChevronRight className="size-4" />
                </li>
              )}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
