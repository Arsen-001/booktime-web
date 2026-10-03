'use client';

import type { ReactNode } from 'react';
import { useT } from '@/i18n/useT';
import { ClientTabBar } from '@/shell/client/ClientTabBar';
import { ClientTopBar } from '@/shell/client/ClientTopBar';
import { NavPendingFeedback } from '@/shell/workspace/NavPendingFeedback';
import { PageTransition } from '@/shell/workspace/PageTransition';

/**
 * Каркас приложения клиента: mobile-first. Телефон — нижние вкладки, десктоп — верхнее меню.
 * Содержимое — центрированная колонка (max-w-5xl), по одной линии с верхней полосой.
 */
export function ClientShell({ children }: { children: ReactNode }) {
  const t = useT('common');
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <a
        href="#content"
        className="sr-only z-50 rounded-lg bg-surface px-4 py-2 focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        {t('shell.skipToContent')}
      </a>
      <ClientTopBar />
      {/* Телефон: любая кнопка и кнопка-ссылка приложения клиента — не ниже 44 px под палец (§0), даже «маленькая» */}
      <main
        id="content"
        className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-4 max-md:[&_[data-icon-button]]:min-h-11 max-md:[&_[data-icon-button]]:min-w-11 max-md:[&_[data-variant]]:min-h-11 md:px-6 md:pt-8 lg:pb-16"
      >
        {/* Смена страниц — как в кабинете: без мигания, старая держится, пока новая не получит данные */}
        <PageTransition>{children}</PageTransition>
        <NavPendingFeedback />
      </main>
      <ClientTabBar />
    </div>
  );
}
