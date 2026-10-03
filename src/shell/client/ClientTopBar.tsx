'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BIZ_PERSONAS } from '@/demo/settings';
import { useDemo } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { useTDynamic } from '@/i18n/useTDynamic';
import { cn } from '@/lib/cn';
import { Logo } from '@/shell/Logo';
import { useClientNav } from '@/shell/client/useClientNav';
import { ThemeToggle } from '@/shell/ThemeToggle';
import { LinkButton } from '@/ui/Button';

/** Верхняя полоса приложения клиента; на десктопе в ней меню */
export function ClientTopBar() {
  const t = useT('common');
  const tDyn = useTDynamic();
  const { persona } = useDemo();
  const items = useClientNav();
  const pathname = usePathname();
  // Вход уже на экране (/login, шаги записи) — вторая кнопка «Войти» в полосе только спорит с ним
  const loginOnScreen = pathname.startsWith('/login') || pathname.startsWith('/book');

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface pt-[env(safe-area-inset-top,0px)]">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center gap-4 px-4 md:px-6">
        <Logo href="/" />
        <nav aria-label={t('shell.mainNav')} className="ml-4 hidden flex-1 items-center gap-1 md:flex">
          {items.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              aria-current={item.active ? 'page' : undefined}
              className={cn(
                'inline-flex min-h-11 items-center rounded-lg px-3 text-[15px] font-medium text-muted transition-colors hover:bg-surface-2 hover:text-fg',
                item.active && 'bg-primary-soft text-primary-text hover:bg-primary-soft hover:text-primary-text',
              )}
            >
              {tDyn(item.labelKey)}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          {persona === 'guest' && !loginOnScreen && (
            <LinkButton href={`/login?next=${encodeURIComponent(pathname)}`} size="sm" variant="secondary">
              {t('actions.login')}
            </LinkButton>
          )}
          {BIZ_PERSONAS.includes(persona) && (
            <LinkButton href="/biz" size="sm" variant="secondary">
              {t('shell.toBizCabinet')}
            </LinkButton>
          )}
          {persona === 'platform' && (
            <LinkButton href="/platform" size="sm" variant="secondary">
              {t('shell.toPlatform')}
            </LinkButton>
          )}
        </div>
      </div>
    </header>
  );
}
