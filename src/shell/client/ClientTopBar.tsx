'use client';

import { Briefcase, LayoutDashboard } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BIZ_PERSONAS } from '@/demo/settings';
import { useDemo } from '@/demo/hooks';
import { splitLocalePrefix } from '@/i18n/localePath';
import { useLocalizedHref } from '@/i18n/useLocalizedHref';
import { useT } from '@/i18n/useT';
import { useTDynamic } from '@/i18n/useTDynamic';
import { cn } from '@/lib/cn';
import { Logo } from '@/shell/Logo';
import { useClientNav } from '@/shell/client/useClientNav';
import { LanguageSwitch } from '@/shell/LanguageSwitch';
import { ThemeToggle } from '@/shell/ThemeToggle';
import { LinkButton } from '@/ui/Button';

/** Верхняя полоса приложения клиента; на десктопе (от 1024 px) в ней меню — на планшете меню внизу: с языком и темой в полосе армянские пункты не помещались */
export function ClientTopBar() {
  const t = useT('common');
  const tDyn = useTDynamic();
  const { persona } = useDemo();
  const items = useClientNav();
  const localized = useLocalizedHref();
  // Сервер видит путь без языка (/hy → /), браузер — с ним: сравниваем и передаём путь в одном виде
  const pathname = splitLocalePrefix(usePathname()).pathname;
  // Вход уже на экране (/login, шаги записи) — вторая кнопка «Войти» в полосе только спорит с ним
  const loginOnScreen = pathname.startsWith('/login') || pathname.startsWith('/book');

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface pt-[env(safe-area-inset-top,0px)]">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center gap-2 px-4 sm:gap-4 md:px-6">
        {/* Совсем узкий телефон (360 px): только знак, иначе армянское «Մուտք գործել» наезжает на название */}
        <Logo href={localized('/')} className="shrink-0 max-[379px]:[&>span:last-child]:hidden" />
        <nav aria-label={t('shell.mainNav')} className="ml-4 hidden flex-1 items-center gap-1 lg:flex">
          {items.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              aria-current={item.active ? 'page' : undefined}
              className={cn(
                'inline-flex min-h-11 items-center rounded-lg px-2.5 text-[15px] font-medium whitespace-nowrap text-muted xl:px-3 transition-colors hover:bg-surface-2 hover:text-fg',
                item.active && 'bg-primary-soft text-primary-text hover:bg-primary-soft hover:text-primary-text',
              )}
            >
              {tDyn(item.labelKey)}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <LanguageSwitch />
          <ThemeToggle />
          {persona === 'guest' && !loginOnScreen && (
            <LinkButton href={`/login?next=${encodeURIComponent(localized(pathname))}`} size="sm" variant="secondary">
              {t('actions.login')}
            </LinkButton>
          )}
          {BIZ_PERSONAS.includes(persona) && (
            // На телефоне — только значок: с языком и темой армянская подпись не помещалась
            <LinkButton href="/biz" size="sm" variant="secondary" aria-label={t('shell.toBizCabinet')} leftIcon={<Briefcase aria-hidden />}>
              <span className="hidden sm:inline">{t('shell.toBizCabinet')}</span>
            </LinkButton>
          )}
          {persona === 'platform' && (
            <LinkButton href="/platform" size="sm" variant="secondary" aria-label={t('shell.toPlatform')} leftIcon={<LayoutDashboard aria-hidden />}>
              <span className="hidden sm:inline">{t('shell.toPlatform')}</span>
            </LinkButton>
          )}
        </div>
      </div>
    </header>
  );
}
