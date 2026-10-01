'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { useT } from '@/i18n/useT';
import { clearNavPending, startNavPending, useNavPending } from '@/ui/navigation/navPending';

/** Страховка: ссылка, которая в итоге никуда не повела, не оставляет полоску навсегда */
const GIVE_UP_AFTER_MS = 10_000;

/**
 * Отклик на нажатие ссылки сразу, а не когда страница догрузится (owner 29.09.2026: «любая страница должна после
 * нажатия сразу открываться и показывать загрузку»). Ловит нажатия на ссылки в фазе захвата — это любые <a>/<Link>
 * на другой адрес этого сайта: меню, карточки, хлебные крошки. Пока новая страница не пришла: полоска вверху
 * (сразу) и подсвеченный новый пункт меню (useActiveNav); старая страница стоит как есть.
 * Общего скелета поверх старой страницы нет (owner 30.09.2026: «после каждого перехода мигает»): он не похож на
 * новую страницу, и было четыре смены картинки подряд — старая → общий скелет → скелет новой → данные. Новая страница
 * сама встаёт сразу своим точным скелетом (DESIGN.md → «The skeleton IS the page»), а ждать её почти не приходится:
 * пункты меню загружены заранее (NavList: prefetch; в разработке страницы собирает ensure-dev.sh).
 * Переходы через router.push этим не ловятся — там перед push зовут startNavPending(href) (так делает таблица записей).
 */
export function NavPendingFeedback() {
  const t = useT('common');
  const pathname = usePathname();
  const pending = useNavPending((s) => s.path);

  // Адрес сменился — переход закончен. Именно эффект, после того как новая страница встала на экран: сброс во время
  // рендера задевал меню (другой компонент) посреди перехода — полоска и подсветка гасли раньше новой страницы
  useEffect(() => {
    clearNavPending();
  }, [pathname]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href]');
      if (!(a instanceof HTMLAnchorElement)) return;
      if ((a.target && a.target !== '_self') || a.hasAttribute('download')) return;
      startNavPending(a.href);
    };
    document.addEventListener('click', onClick, true);
    window.addEventListener('popstate', clearNavPending);
    return () => {
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('popstate', clearNavPending);
    };
  }, []);

  useEffect(() => {
    if (!pending) return;
    const giveUp = setTimeout(clearNavPending, GIVE_UP_AFTER_MS);
    return () => clearTimeout(giveUp);
  }, [pending]);

  if (!pending) return null;
  return (
    <div
      role="progressbar"
      aria-label={t('shell.pageLoading')}
      className="pointer-events-none fixed inset-x-0 top-0 z-[70] h-[3px] origin-left animate-nav-progress bg-primary"
    />
  );
}

