'use client';

import { Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { NavGroupId, NavItem } from '@/config/nav-types';
import { setSidebarCollapsed, useDemoStore } from '@/demo/store';
import { useT } from '@/i18n/useT';
import { useTDynamic } from '@/i18n/useTDynamic';
import { cn } from '@/lib/cn';
import { AccessDenied } from '@/shell/AccessDenied';
import { Logo } from '@/shell/Logo';
import { NavList } from '@/shell/workspace/NavList';
import { NavPendingFeedback } from '@/shell/workspace/NavPendingFeedback';
import { NotificationsBell } from '@/shell/workspace/NotificationsBell';
import { PageTransition } from '@/shell/workspace/PageTransition';
import { animateSidebarResize } from '@/shell/workspace/sidebarTransition';
import { useActiveNav } from '@/shell/workspace/useActiveNav';
import { UserMenu } from '@/shell/workspace/UserMenu';
import { DENSE_PATHS, HEADERLESS_PATHS, useShellDensityStore } from '@/shell/workspace/useDenseScreen';
import { useSidebarHint } from '@/shell/workspace/SidebarHint';
import { IconButton } from '@/ui/IconButton';
import { Sheet } from '@/ui/Sheet';

export interface WorkspaceShellProps {
  kind: 'biz' | 'platform';
  allowed: boolean;
  items: NavItem[];
  groups?: NavGroupId[];
  /** Подпись под логотипом */
  caption: string;
  logoHref: string;
  /** Слева в верхней полосе (переключатель филиала, поиск) */
  topBarStart?: ReactNode;
  /** Вверху выезжающего меню телефона (переключатель филиала) */
  drawerTop?: ReactNode;
  children: ReactNode;
}

/**
 * Каркас рабочего места (кабинет бизнеса и наша панель).
 * Десктоп: левое меню по группам (сворачивается до иконок) + верхняя полоса.
 * Телефон: верхняя полоса + выезжающее слева меню.
 */
export function WorkspaceShell({
  kind,
  allowed,
  items,
  groups,
  caption,
  logoHref,
  topBarStart,
  drawerTop,
  children,
}: WorkspaceShellProps) {
  const t = useT('common');
  const pathname = usePathname() ?? '';
  // Пока браузер не прочитал сохранённый выбор меню — берём его из cookie (сервер нарисовал так же), иначе меню
  // рисовалось развёрнутым и сворачивалось через кадр
  const hint = useSidebarHint();
  const uiLoaded = useDemoStore((s) => s.uiLoaded);
  const storeCollapsed = useDemoStore((s) => s.sidebarCollapsed);
  const storeManual = useDemoStore((s) => s.sidebarManual);
  const userCollapsed = uiLoaded ? storeCollapsed : hint === 'collapsed';
  const manual = uiLoaded ? storeManual : hint !== undefined;
  // Плотный экран (журнал, useDenseScreen) сворачивает меню, пока человек ни разу не выбрал сам; выбор запоминается.
  // Адрес известен с первого кадра — не ждём эффекта экрана
  const dense = useShellDensityStore((s) => s.dense > 0) || DENSE_PATHS.includes(pathname);
  const collapsed = manual ? userCollapsed : userCollapsed || dense;
  const toggleSidebar = () => {
    setPeek(false);
    animateSidebarResize(() => setSidebarCollapsed(!collapsed));
  };

  // Полоса иконок: навели мышь — поверх страницы выезжает полное меню с подписями (страница не сдвигается).
  // Задержка, чтобы меню не выскакивало, когда мышь просто проходит мимо левого края.
  const [peek, setPeek] = useState(false);
  const peekTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const schedulePeek = (open: boolean) => {
    clearTimeout(peekTimer.current);
    peekTimer.current = setTimeout(() => setPeek(open), open ? 180 : 120);
  };
  useEffect(() => () => clearTimeout(peekTimer.current), []);
  // Журнал A2 (DESIGN.md → Journal 3): сам служит верхней полосой, полоса каркаса над ним не рисуется
  const hideHeader = useShellDensityStore((s) => s.hideHeader > 0) || HEADERLESS_PATHS.includes(pathname);
  const drawerRequest = useShellDensityStore((s) => s.drawerRequest);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Экран без доступа к этому состоянию (журнал на телефоне) просит открыть меню через drawerRequest — подстройка
  // состояния во время рендера (официальный приём React), не эффект: react-hooks/set-state-in-effect не разрешает
  // synchronous setState в теле эффекта, а eslint-disable здесь выключил бы React Compiler для всего каркаса.
  const [seenDrawerRequest, setSeenDrawerRequest] = useState(drawerRequest);
  if (drawerRequest !== seenDrawerRequest) {
    setSeenDrawerRequest(drawerRequest);
    if (drawerRequest > 0) setDrawerOpen(true);
  }
  const tDyn = useTDynamic();
  const active = useActiveNav(items);
  const activeItem = items.find((i) => i.id === active.itemId);
  const activeChild = activeItem?.children?.find((c) => c.id === active.childId);
  const sectionLabel = activeItem ? tDyn((activeChild ?? activeItem).labelKey) : undefined;

  // Телефон: заголовок страницы уехал под полосу — в полосе вместо знака появляется название раздела
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 72);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Экран всех уведомлений — если раздел уведомлений есть в меню этой персоны
  const inboxHref = items.some((i) => i.href.startsWith('/biz/notifications')) ? '/biz/notifications/inbox' : undefined;

  if (!allowed) return <AccessDenied kind={kind} />;

  return (
    <div className="flex min-h-dvh bg-bg">
      <a
        href="#content"
        className="sr-only z-50 rounded-lg bg-surface px-4 py-2 focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        {t('shell.skipToContent')}
      </a>

      {/* Левое меню — десктоп. Свёрнутое — полоса иконок 72 px (DESIGN.md); кнопка свернуть/развернуть — вверху,
          рядом с логотипом, на одном месте в обоих видах */}
      <aside
        style={{ viewTransitionName: 'shell-sidebar' }}
        onMouseEnter={collapsed ? () => schedulePeek(true) : undefined}
        onMouseLeave={collapsed ? () => schedulePeek(false) : undefined}
        className={cn(
          'sticky top-0 z-40 hidden h-dvh shrink-0 flex-col border-r border-border bg-surface lg:flex',
          collapsed ? 'w-[72px]' : 'w-64',
        )}
      >
        <div className={cn('flex h-16 shrink-0 items-center gap-2', collapsed ? 'justify-center' : 'pr-3 pl-4')}>
          {!collapsed && <Logo href={logoHref} caption={caption} className="min-w-0 flex-1" />}
          <IconButton
            variant="ghost"
            size="md"
            label={collapsed ? t('shell.expand') : t('shell.collapse')}
            icon={collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
            onClick={toggleSidebar}
          />
        </div>
        <nav
          aria-label={t('shell.mainNav')}
          className={cn('scrollbar-thin flex-1 overflow-y-auto pt-2 pb-4', collapsed ? 'px-3.5' : 'px-3')}
        >
          <NavList items={items} groups={groups} collapsed={collapsed} />
        </nav>

        {/* Выезжающее меню над полосой иконок: те же пункты с подписями и группами. Только opacity и transform
            (DESIGN.md → Performance); спрятанное — inert, клавиатура и скринридер его не видят */}
        {collapsed && (
          <div
            inert={!peek}
            className={cn(
              'absolute inset-y-0 left-0 flex w-64 flex-col border-r border-border bg-surface shadow-xl transition-[opacity,transform] duration-150 ease-out',
              peek ? 'translate-x-0 opacity-100' : 'pointer-events-none -translate-x-3 opacity-0',
            )}
          >
            <div className="flex h-16 shrink-0 items-center gap-2 pr-3 pl-4">
              <Logo href={logoHref} caption={caption} className="min-w-0 flex-1" />
              <IconButton variant="ghost" size="md" label={t('shell.expand')} icon={<PanelLeftOpen />} onClick={toggleSidebar} />
            </div>
            <nav aria-label={t('shell.mainNav')} className="scrollbar-thin flex-1 overflow-y-auto px-3 pt-2 pb-4">
              <NavList items={items} groups={groups} onNavigate={() => setPeek(false)} />
            </nav>
          </div>
        )}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Верхняя полоса — журнал A2 (DESIGN.md → Journal 3) сам служит верхом страницы и прячет её,
            неся уведомления/меню пользователя/филиал в своём ряду управления и в «⋯ Ещё». */}
        {/* Сплошная белая полоса (без размытия подложки — оно пересчитывается на каждом кадре прокрутки) */}
        {!hideHeader && (
          <header style={{ viewTransitionName: 'shell-topbar' }} className="sticky top-0 z-30 border-b border-border bg-surface">
            <div className="flex h-14 items-center gap-2 px-3 md:h-16 md:px-5 lg:px-7">
              <IconButton
                className="lg:hidden"
                variant="ghost"
                label={t('shell.openMenu')}
                icon={<Menu />}
                onClick={() => setDrawerOpen(true)}
              />
              <Logo href={logoHref} compact className={cn('lg:hidden', scrolled && sectionLabel && 'hidden')} />
              <div className="flex min-w-0 flex-1 items-center gap-3">
                {scrolled && sectionLabel && (
                  <p aria-hidden className="min-w-0 animate-fade-in truncate text-[17px] font-semibold text-fg lg:hidden">
                    {sectionLabel}
                  </p>
                )}
                {topBarStart}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <NotificationsBell href={inboxHref} />
                <UserMenu kind={kind} />
              </div>
            </div>
          </header>
        )}

        {/* Снизу запас 96 px на компьютере: плавающая демо-кнопка (DemoSwitcher, 72 px от низа) не закрывает переключатель
            страниц и последние кнопки, когда долистали до конца */}
        <main id="content" className="relative flex-1 px-4 pt-5 pb-10 md:px-6 md:pb-24 lg:px-8 lg:pt-7">
          <PageTransition>{children}</PageTransition>
          {/* Нажали ссылку — полоска и скелет сразу, не дожидаясь новой страницы */}
          <NavPendingFeedback />
        </main>
      </div>

      {/* Выезжающее меню — телефон и планшет */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen} side="left" size="sm" title={caption}>
        <div className="flex flex-col gap-4">
          {drawerTop}
          <nav aria-label={t('shell.mainNav')}>
            <NavList items={items} groups={groups} onNavigate={() => setDrawerOpen(false)} />
          </nav>
        </div>
      </Sheet>
    </div>
  );
}
