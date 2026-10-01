import Link from 'next/link';
import type { ReactNode } from 'react';

/** Заголовок секции с «Все →» — ссылка высотой 44 px (a11y-q1…q3: было 40 px) */
export function SectionHeader({ title, href, linkLabel }: { title: ReactNode; href?: string; linkLabel?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-lg font-semibold text-fg">{title}</h2>
      {href && linkLabel && (
        <Link
          href={href}
          className="-mr-2.5 inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg px-2.5 text-sm font-medium text-primary-text hover:underline focus-visible:outline-2 focus-visible:outline-focus"
        >
          {linkLabel}
        </Link>
      )}
    </div>
  );
}
