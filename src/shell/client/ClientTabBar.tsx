'use client';

import Link from 'next/link';
import { useT } from '@/i18n/useT';
import { useTDynamic } from '@/i18n/useTDynamic';
import { cn } from '@/lib/cn';
import { useInBusinessApp } from '@/lib/native/NativeAppKind';
import { useClientNav } from '@/shell/client/useClientNav';
import { useSoftKeyboardOpen } from '@/ui/hooks/useSoftKeyboard';

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

function ClientTabs() {
  const t = useT('common');
  const tDyn = useTDynamic();
  const items = useClientNav();

  return (
    <nav
      aria-label={t('shell.mainNav')}
      data-client-tabbar=""
      // Свой снимок при смене страницы: стоит на месте и сразу показывает новую вкладку (globals.css → shell-*)
      style={{ viewTransitionName: 'shell-tabbar' }}
      className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface shadow-[0_-4px_16px_-8px_var(--overlay)] lg:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.id}>
              <Link
                href={item.href}
                // Страница вкладки загружена заранее — переход сразу, без ожидания сервера
                prefetch
                aria-current={item.active ? 'page' : undefined}
                className={cn(
                  // Подпись — фиксированный компактный размер (не растёт с «крупным шрифтом»), длинная (hy) — в две строки
                  'group flex min-h-16 flex-col items-center justify-center gap-1 px-0.5 text-[11px] leading-[1.15] font-medium text-muted transition-colors',
                  item.active && 'font-semibold text-primary-text',
                )}
              >
                <span
                  className={cn(
                    'grid h-8 w-14 place-items-center rounded-full transition-[background-color,transform] duration-200 ease-out group-active:scale-90',
                    item.active ? 'bg-primary-soft' : 'group-hover:bg-surface-2',
                  )}
                >
                  <Icon aria-hidden className="size-[22px]" strokeWidth={item.active ? 2.4 : 2} />
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
