import Link from 'next/link';
import type { ReactNode } from 'react';

export interface PublicShellProps {
  children: ReactNode;
  /**
   * Подвал страницы (online передаёт «Работает на BookTime» — ссылкой на площадку). По умолчанию — знак «BookTime» ссылкой.
   * Подвал один, прижат к низу экрана; липкая панель действия (StickyActionBar) встаёт поверх, а место под неё
   * она оставляет сама.
   */
  footer?: ReactNode;
}

/**
 * Каркас публичной страницы салона/мастера /b/[slug]. «Ваша ссылка — только ваша» (F-00-006):
 * ни каталога, ни соседей, ни рекламы — только этот бизнес.
 */
export function PublicShell({ children, footer }: PublicShellProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <main id="content" className="mx-auto w-full max-w-2xl flex-1 px-4 pt-4 pb-8 md:pt-8">
        {children}
      </main>
      <footer className="mt-auto px-4 pt-6 pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)] text-center text-xs text-muted">
        {footer ?? (
          <Link
            href="/"
            className="inline-flex min-h-10 items-center rounded-md px-2 font-semibold underline decoration-border-strong/60 underline-offset-4 hover:text-fg hover:decoration-current"
          >
            BookTime
          </Link>
        )}
      </footer>
    </div>
  );
}
