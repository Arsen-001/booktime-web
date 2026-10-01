'use client';

import Link from 'next/link';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { NavGroupId, NavItem } from '@/config/nav-types';
import { useTDynamic } from '@/i18n/useTDynamic';
import { cn } from '@/lib/cn';
import { useActiveNav } from '@/shell/workspace/useActiveNav';
import { DropdownChevron } from '@/ui/DropdownChevron';
import { useIsClient } from '@/ui/hooks/useIsClient';
import { DURATION, EASE } from '@/ui/motion';

export interface NavListProps {
  items: NavItem[];
  /** Порядок групп; без групп — плоский список */
  groups?: NavGroupId[];
  /** Только иконки (свёрнутое меню десктопа) */
  collapsed?: boolean;
  /** Закрыть выезжающее меню после перехода */
  onNavigate?: () => void;
}

/**
 * Меню кабинета/панели. Все группы всегда раскрыты — пункты с иконками видны сразу (owner 29.09.2026: «нижние меню
 * сделай так, как Calendar, Bookings…»; сворачивающиеся группы прятали разделы за лишний клик). Название группы —
 * простая подпись без стрелки. Подпункты видны у текущего раздела и раскрываются шторкой (Fold).
 * В полосе иконок группы разделены чертой; подписи показывает выезжающее меню каркаса (WorkspaceShell).
 */
export function NavList({ items, groups, collapsed = false, onNavigate }: NavListProps) {
  const tDyn = useTDynamic();
  const active = useActiveNav(items);
  const rootRef = useRef<HTMLDivElement>(null);
  // Встроенный скрипт прокрутки — только в HTML с сервера (и в гидрации, чтобы разметка совпала). Отрисованный на
  // клиенте (меню в шторке телефона, повторный рендер) <script> React не выполняет и пишет в консоль
  // «Encountered a script tag while rendering React component» (notify.md, resources.md) — после гидрации его нет.
  const isClient = useIsClient();

  // Активный пункт всегда виден: длинное меню (Бизнес, Аккаунт…) прокручивается к нему само.
  // Двигаем только прокрутку меню, страницу не трогаем. Первый кадр с сервера прокручивает встроенный скрипт ниже
  // (до отрисовки), этот эффект — переходы внутри приложения; он же ничего не двигает, если пункт уже виден.
  useEffect(() => {
    if (rootRef.current) scrollNavToActive(rootRef.current);
  }, [active.itemId, active.childId, collapsed]);

  const sections: { group?: NavGroupId; items: NavItem[] }[] = groups
    ? groups.map((g) => ({ group: g, items: items.filter((i) => i.group === g) })).filter((s) => s.items.length > 0)
    : [{ items }];

  // Группа или подпункты открылись/закрылись — всё, что ниже, подъезжает на новое место одним движением с
  // раскрытием (owner 29.09.2026: «другие летят, а не плавно поднимаются»). Высоту не анимируем (DESIGN.md →
  // Performance) и Motion layout не грузим (motionFeatures.ts): FLIP руками — ResizeObserver срабатывает после
  // раскладки, но до отрисовки, поэтому группа/пункт ставится на старое место transform'ом и Web Animations доводит
  // его до нового. Сдвигаются только контейнеры групп и пункты верхнего уровня.
  const flipRefs = useRef(new Map<string, HTMLElement>());
  const flipRef = (key: string) => (el: HTMLElement | null) => {
    if (el) flipRefs.current.set(key, el);
    else flipRefs.current.delete(key);
  };
  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof ResizeObserver === 'undefined') return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    // offsetTop — место в раскладке без учёта transform: идущая анимация не путает замер. Пункты внутри
    // сворачивающегося блока не меряем — они уходят вместе с ним
    const measure = () =>
      new Map(
        [...flipRefs.current]
          .filter(([, el]) => !el.closest('[data-fold-closing]'))
          .map(([k, el]) => [k, el.offsetTop] as const),
      );
    let tops = measure();
    const observer = new ResizeObserver(() => {
      const next = measure();
      if (!reduce.matches) {
        next.forEach((top, key) => {
          const prev = tops.get(key);
          const el = flipRefs.current.get(key);
          if (prev === undefined || prev === top || !el) return;
          el.getAnimations().forEach((a) => a.cancel());
          el.animate([{ transform: `translateY(${prev - top}px)` }, { transform: 'translateY(0)' }], FOLD_TIMING);
        });
      }
      tops = next;
    });
    observer.observe(root);
    flipRefs.current.forEach((el, key) => key.startsWith('g:') && observer.observe(el));
    return () => observer.disconnect();
    // Свернули/развернули всё меню — места меняются целиком, это не повод для сдвига: замер заново
  }, [collapsed]);

  return (
    <>
      <div ref={rootRef} className={cn('flex flex-col', collapsed ? 'gap-2' : 'gap-1')}>
        {sections.map((section, index) => {
          return (
            <div
              key={section.group ?? 'all'}
              ref={flipRef(`g:${section.group ?? 'all'}`)}
              className="relative flex flex-col gap-1"
            >
              {/* Полоса иконок: группы разделены чертой, а не пустотой — видно, где кончается «Работа» и начинаются «Клиенты» */}
              {collapsed && index > 0 && <div aria-hidden className="mx-auto mb-1 h-px w-6 bg-border" />}
              {/* Свёрнутое меню прячет заголовок группы, а не убирает его: разворот не строит его заново */}
              {section.group && (
                <p
                  hidden={collapsed}
                  className="flex min-h-8 items-center px-3 pt-2 text-[13px] font-semibold text-muted"
                >
                  {tDyn(`common.navGroups.${section.group}`)}
                </p>
              )}
              <ul className={cn('flex flex-col gap-0.5', !collapsed && section.group && 'pb-2')}>
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = item.id === active.itemId;
                  const label = tDyn(item.labelKey);
                  // Открыт подпункт — заливка у подпункта, у раздела только цвет и полоска: не две подсветки подряд
                  const parentOfActive = isActive && !collapsed && !!active.childId && (item.children?.length ?? 0) > 1;
                  const link = (
                    <Link
                      href={item.href}
                      // Вся страница загружена заранее (у нас все адреса динамические — без true Next грузит лишь
                      // каркас): нажатие открывает её сразу, без ожидания сервера и без мигания
                      prefetch
                      onClick={onNavigate}
                      aria-current={isActive && !active.childId ? 'page' : undefined}
                      data-nav-active={isActive || undefined}
                      aria-label={collapsed ? label : undefined}
                      className={cn(
                        'group/n relative flex min-h-11 items-center gap-3 rounded-[12px] px-3 py-2 text-[15px] leading-snug font-medium text-fg transition-colors duration-150 hover:bg-surface-2',
                        // Полоса иконок (макет): квадрат 44×44, активный — на мягкой подложке primary
                        collapsed && 'mx-auto size-11 min-h-0 justify-center px-0',
                        isActive &&
                          !parentOfActive &&
                          'bg-primary-soft font-semibold text-primary-text hover:bg-primary-soft',
                        parentOfActive && 'font-semibold text-primary-text',
                      )}
                    >
                      <Icon
                        aria-hidden
                        className={cn(
                          'size-5 shrink-0 transition-colors',
                          isActive ? 'text-primary-text' : 'text-muted group-hover/n:text-fg',
                        )}
                      />
                      {/* Подпись в полосе иконок прячется классом, а не убирается: разворот не пересоздаёт её.
                          Длинное название переносится на вторую строку, а не обрезается «…» */}
                      <span className={cn('line-clamp-2 min-w-0', collapsed && 'sr-only')}>{label}</span>
                      {/* У раздела с подменю — стрелка (owner 29.09.2026: «рядом с теми, что открывают ещё меню, нужны
                        стрелки»): вниз — подменю закрыто, вверх — открыто (раздел текущий) */}
                      {!collapsed && (item.children?.length ?? 0) > 1 && (
                        <DropdownChevron open={isActive} className="ml-auto shrink-0 text-muted" />
                      )}
                    </Link>
                  );
                  const children = item.children ?? [];
                  return (
                    <li key={item.id} ref={flipRef(`i:${item.id}`)} className="relative">
                      {link}
                      {/* Подпункты активного раздела в полосе иконок скрыты, а не размонтированы (иначе разворот
                          меню пересобирает их) */}
                      <Fold open={isActive && children.length > 1}>
                        <ul
                          hidden={collapsed}
                          className="mb-1 ml-5.5 mt-1 flex flex-col gap-0.5 border-l-2 border-border pl-2.5"
                        >
                          {children.map((child) => {
                            const childActive = child.id === active.childId;
                            return (
                              <li key={child.id}>
                                <Link
                                  href={child.href}
                                  prefetch
                                  onClick={onNavigate}
                                  aria-current={childActive ? 'page' : undefined}
                                  data-nav-child-active={childActive || undefined}
                                  className={cn(
                                    'relative flex min-h-10 items-center rounded-md px-3 py-2 text-sm leading-snug text-muted transition-colors hover:bg-surface-2 hover:text-fg',
                                    childActive &&
                                      'bg-primary-soft font-semibold text-primary-text hover:bg-primary-soft hover:text-primary-text before:absolute before:inset-y-2 before:-left-[12px] before:w-0.5 before:rounded-full before:bg-primary',
                                  )}
                                >
                                  <span className="line-clamp-2">{tDyn(child.labelKey)}</span>
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      </Fold>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
      {/* Прокрутка к активному пункту — ещё при разборе HTML с сервера, до первой отрисовки: иначе меню появлялось с
        начала и через кадр отъезжало к пункту (DESIGN.md → «The skeleton IS the page»). На клиенте React его не
        выполняет — там работает эффект выше */}
      {!isClient && (
        <script
          dangerouslySetInnerHTML={{
            __html: `(${scrollNavToActive.toString()})(document.currentScript.previousElementSibling)`,
          }}
        />
      )}
    </>
  );
}

const FOLD_TIMING: KeyframeAnimationOptions = {
  duration: DURATION.normal * 1000,
  easing: `cubic-bezier(${EASE.out.join(', ')})`,
};

/**
 * Раскрывающийся блок меню. Открытие — шторка сверху вниз (clip-path), закрытие — снизу вверх; всё, что ниже, едет
 * вместе с краем шторки (FLIP в NavList). Закрываясь, блок сразу выходит из потока (absolute на своём месте) — поэтому
 * соседи начинают подниматься в ту же секунду, а не после исчезновения, — и убирается из DOM по окончании анимации.
 * Только clip-path и opacity (DESIGN.md → Performance).
 */
function Fold({ open, children }: { open: boolean; children: ReactNode }) {
  const [mounted, setMounted] = useState(open);
  const [prevOpen, setPrevOpen] = useState(open);
  // Подстройка состояния во время рендера (приём React), не эффект: открытие монтирует сразу
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setMounted(true);
  }
  const ref = useRef<HTMLDivElement>(null);
  const lastOpen = useRef(open);
  // Место блока в потоке, пока он открыт: закрываясь, он становится absolute, а в flex-колонке такой блок без top
  // прыгнул бы к верху группы (на заголовок) — ставим его ровно туда, где он стоял
  const flowTop = useRef(0);
  useLayoutEffect(() => {
    if (open && ref.current) flowTop.current = ref.current.offsetTop;
  });
  useLayoutEffect(() => {
    // Первый показ и повтор эффекта в StrictMode — без анимации: страница не «дёргается» при загрузке
    if (lastOpen.current === open) return;
    lastOpen.current = open;
    const el = ref.current;
    if (!el) return;
    el.getAnimations().forEach((a) => a.cancel());
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timing = {
      ...FOLD_TIMING,
      duration: reduce ? 0 : FOLD_TIMING.duration,
    };
    const shown = { clipPath: 'inset(0 0 0 0)', opacity: 1 };
    const hidden = { clipPath: 'inset(0 0 100% 0)', opacity: 0.3 };
    if (open) {
      el.style.top = '';
      el.animate([hidden, shown], timing);
    } else {
      el.style.top = `${flowTop.current}px`;
      const anim = el.animate([shown, hidden], { ...timing, fill: 'forwards' });
      anim.onfinish = () => setMounted(false);
    }
  }, [open]);

  if (!mounted) return null;
  const closing = !open;
  return (
    <div
      ref={ref}
      data-fold-closing={closing || undefined}
      inert={closing}
      className={cn(closing && 'pointer-events-none absolute inset-x-0')}
    >
      {children}
    </div>
  );
}

/**
 * Прокрутить меню так, чтобы активный пункт был виден. Самодостаточная функция (без замыканий и импортов) — её же
 * текст выполняется встроенным скриптом в HTML с сервера. Открыт подпункт — цель он, а не строка раздела.
 */
function scrollNavToActive(root: HTMLElement | null): void {
  if (!root) return;
  const el =
    root.querySelector<HTMLElement>('[data-nav-child-active]') ?? root.querySelector<HTMLElement>('[data-nav-active]');
  let box = root.parentElement;
  while (box && !(box.scrollHeight > box.clientHeight && /auto|scroll/.test(getComputedStyle(box).overflowY))) {
    box = box.parentElement;
  }
  if (!el || !box || box === document.scrollingElement || box === document.body) return;
  const br = box.getBoundingClientRect();
  const er = el.getBoundingClientRect();
  if (er.top < br.top + 8) box.scrollTop += er.top - br.top - 48;
  else if (er.bottom > br.bottom - 8) box.scrollTop += er.bottom - br.bottom + 96;
}
