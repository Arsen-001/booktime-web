'use client';

import Link from 'next/link';
import { useLayoutEffect, useRef } from 'react';
import { useT } from '@/i18n/useT';
import { useTDynamic } from '@/i18n/useTDynamic';
import { cn } from '@/lib/cn';
import { useInBusinessApp } from '@/lib/native/NativeAppKind';
import { useClientNav } from '@/shell/client/useClientNav';
import { useSoftKeyboardOpen } from '@/ui/hooks/useSoftKeyboard';
import { useNavPending } from '@/ui/navigation/navPending';

/**
 * Нижние вкладки приложения клиента (только телефон). Нет их:
 *  - в приложении «BookTime Business» — там только кабинет (вход, регистрация бизнеса, документы — без клиентских вкладок);
 *  - пока открыта экранная клавиатура — иначе полоса выезжает над ней и закрывает поле (Android WebView сжимает
 *    страницу). Без вкладок и --app-bottom-inset = 0 (polish.css): липкая кнопка экрана встаёт прямо над клавиатурой.
 */
export function ClientTabBar() {
  const businessApp = useInBusinessApp();
  const keyboard = useSoftKeyboardOpen();
  if (businessApp || keyboard) return null;
  return <ClientTabs />;
}

/**
 * Плавающая «стеклянная» полоса (как в iOS и Telegram): содержимое просвечивает сквозь размытие, подсветка одна на
 * всю полосу и переезжает к нажатой вкладке с лёгкой пружиной, иконка новой вкладки чуть подпрыгивает. Место внизу,
 * которое она занимает, — --app-bottom-inset (polish.css).
 */
const LAST_TAB_KEY = 'bt-tabbar-last';

function ClientTabs() {
  const t = useT('common');
  const tDyn = useTDynamic();
  const items = useClientNav();
  const activeIndex = items.findIndex((item) => item.active);
  const thumb = useRef<HTMLLIElement>(null);
  const pending = useNavPending((state) => state.path) !== undefined;
  const mounted = useRef(false);

  // Полоса могла смонтироваться заново (перезагрузка, приложение подняло страницу): подсветка выезжает с прошлой
  // вкладки, а не появляется сразу на новой
  useLayoutEffect(() => {
    const el = thumb.current;
    let last: number | null = null;
    try {
      const raw = sessionStorage.getItem(LAST_TAB_KEY);
      last = raw === null ? null : Number(raw);
      // Запоминаем только открытую вкладку: нажатую, пока страница грузится, — нет (иначе после перезагрузки не с чего ехать)
      if (!pending) sessionStorage.setItem(LAST_TAB_KEY, String(activeIndex));
    } catch {}
    // До оживления страницы подсветки не видно (opacity-0): иначе она мелькает на новой вкладке и прыгает назад
    if (el) el.style.opacity = '1';
    // Внутри одной полосы подсветку везёт сам CSS-переход; с прошлой вкладки — только при новом монтировании
    if (mounted.current) return;
    mounted.current = true;
    if (!el || last === null || last === activeIndex || last < 0 || last >= items.length) return;
    const target = el.style.transform;
    el.style.transition = 'none';
    el.style.transform = `translateX(${last * 100}%)`;
    void el.offsetWidth;
    el.style.transition = '';
    el.style.transform = target;
  }, [activeIndex, items.length, pending]);

  return (
    <nav
      aria-label={t('shell.mainNav')}
      data-client-tabbar=""
      // Свой снимок при смене страницы: стоит на месте и сразу показывает новую вкладку (globals.css → shell-*).
      // Он же делает полосу «корнем фона»: размытие (tabbar-glass) — только на ней самой, у вложенных страница не видна
      style={{ viewTransitionName: 'shell-tabbar' }}
      className="tabbar-glass fixed inset-x-3 bottom-[max(0.625rem,calc(env(safe-area-inset-bottom,0px)-0.375rem))] z-30 mx-auto max-w-md rounded-[1.75rem] lg:hidden"
    >
      <ul
        className="relative grid p-1"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {activeIndex >= 0 && (
          <li
            ref={thumb}
            aria-hidden
            className="tabbar-thumb pointer-events-none absolute inset-y-1 left-1 rounded-[1.5rem] opacity-0 motion-safe:transition-[transform,opacity] motion-safe:duration-500"
            style={{
              width: `calc((100% - 0.5rem) / ${items.length})`,
              transform: `translateX(${activeIndex * 100}%)`,
            }}
          />
        )}
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.id} className="relative">
              <Link
                href={item.href}
                // Страница вкладки загружена заранее — переход сразу, без ожидания сервера
                prefetch
                aria-current={item.active ? 'page' : undefined}
                className={cn(
                  // Подпись — фиксированный компактный размер (не растёт с «крупным шрифтом») и в одну строку: короткие подписи
                  // (navShort, hy «Այցեր») влезают в 1/5 полосы на 360px; две строки — только запас для нового длинного языка
                  'group flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-[1.5rem] px-0.5 text-[11px] leading-[1.15] font-medium text-muted transition-colors duration-200 active:text-text',
                  item.active && 'font-semibold text-primary-text',
                )}
              >
                <span className="grid size-7 place-items-center transition-transform duration-200 ease-out group-active:scale-[0.82]">
                  {/* key: новая вкладка — новый узел, анимация «подпрыгнуть» проигрывается заново */}
                  <Icon
                    key={item.active ? 'on' : 'off'}
                    aria-hidden
                    className={cn('size-[22px]', item.active && 'motion-safe:animate-tab-pop')}
                    strokeWidth={item.active ? 2.4 : 2}
                  />
                </span>
                <span className="line-clamp-2 max-w-full text-center break-words [:lang(hy)_&]:text-[10px] [:lang(hy)_&]:font-medium [:lang(hy)_&]:tracking-tight">
                  {tDyn(item.shortLabelKey ?? item.labelKey)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
