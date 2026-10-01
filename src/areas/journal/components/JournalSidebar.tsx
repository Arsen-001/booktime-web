'use client';

/**
 * Левая панель журнала: мини-календарь, «Избранное», быстрые плитки, сворачивание
 * (F-01-002, F-01-003, F-01-004, F-01-005).
 */
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { ChevronDown, HelpCircle, LayoutGrid, LogOut, Menu, Package, Plus, ShoppingBag, Star, Wallet } from 'lucide-react';
import type { Id, ISODate } from '@/domain/core';
import type { FavoriteSection } from '@/domain/journal';
import { coreGet } from '@/api/core';
import { getFavorites, toggleFavorite } from '@/api/journal';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useApplyDemo, useCan, useCurrent, useDemo } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { MiniCalendarPanel } from '@/areas/journal/components/MiniCalendarPanel';
import { NewPaymentModal } from '@/areas/journal/components/NewPaymentModal';
import { ServicesListSheet } from '@/areas/journal/components/ServicesListSheet';
import { Avatar } from '@/ui/Avatar';
import { IconButton } from '@/ui/IconButton';

export interface JournalSidebarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  date: ISODate;
  onDateChange: (date: ISODate) => void;
  staffIds: Id[];
  showWaitlist: boolean;
  /** F-01-156: плитка открывает панель листа ожидания внутри журнала, не отдельную страницу */
  onOpenWaitlist?: () => void;
  /** В Sheet на телефоне (F-01-187) — на всю ширину, без кнопки сворачивания */
  inSheet?: boolean;
  /** F-01-152: «Список услуг» открывается окном поверх журнала — нужен для сети запроса */
  businessId?: Id;
  /** F-01-151: «Новый платеж» пишет в демо-леджер по локации */
  locationId?: Id;
  /** Журнал A2: календарь месяца открывается из заголовка даты — в «⋯ Ещё» второй не нужен */
  hideCalendar?: boolean;
  /** В шторке «⋯ Ещё» — показать и низ панели (кто вошёл, F-01-008; «Администрирование», F-01-001) */
  showFooter?: boolean;
}

export function JournalSidebar({
  collapsed,
  onToggleCollapsed,
  date,
  onDateChange,
  staffIds,
  showWaitlist,
  onOpenWaitlist,
  inSheet,
  businessId,
  locationId,
  hideCalendar,
  showFooter,
}: JournalSidebarProps) {
  const t = useT('journal');
  const { staffId: ownStaffId } = useCurrent();
  const [servicesSheetOpen, setServicesSheetOpen] = useState(false);
  const [newPaymentOpen, setNewPaymentOpen] = useState(false);
  // F-01-154: быстрая кнопка видна только тем, у кого есть права на её раздел
  // «Продать» открывает продажу товара клиенту — это финансовая операция (core-k4-4)
  const canSellGoods = useCan('finance.edit');
  const canPayment = useCan('finance.edit');
  const canServices = useCan('services.view');
  const canGoodsCatalog = useCan('stock.view');

  if (collapsed && !inSheet) {
    return (
      <div data-f="F-01-002" className="flex w-14 shrink-0 flex-col items-center gap-2 border-r border-border bg-surface py-3">
        <IconButton icon={<Menu aria-hidden />} label={t('sidebar.expand')} onClick={onToggleCollapsed} />
      </div>
    );
  }

  return (
    <div
      data-f="F-01-002 F-01-187"
      className={cn('flex flex-col gap-4 overflow-y-auto p-3', inSheet ? 'w-full' : 'w-72 shrink-0 border-r border-border bg-surface')}
    >
      {!inSheet && (
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-muted">{t('sidebar.title')}</p>
          <IconButton icon={<Menu aria-hidden />} label={t('sidebar.collapse')} onClick={onToggleCollapsed} />
        </div>
      )}

      {!hideCalendar && <MiniCalendarPanel value={date} onValueChange={onDateChange} staffIds={staffIds} />}

      <FavoritesSection ownStaffId={ownStaffId} />

      <div data-f="F-01-154" className="flex flex-col gap-1.5">
        {canSellGoods && (
          <QuickTile data-f="F-01-150" href="/biz/stock/operations/new/sale" icon={<ShoppingBag aria-hidden />} label={t('sidebar.sellProduct')} />
        )}
        {canPayment && businessId && locationId && (
          <button
            type="button"
            data-f="F-01-151"
            onClick={() => setNewPaymentOpen(true)}
            className="flex min-h-11 items-center gap-2.5 rounded-lg px-2.5 text-left text-sm text-fg transition-colors hover:bg-surface-2 [&_svg]:size-4 [&_svg]:text-muted"
          >
            <Wallet aria-hidden />
            <span className="truncate">{t('sidebar.newPayment')}</span>
          </button>
        )}
        {canServices &&
          (businessId ? (
            <button
              type="button"
              data-f="F-01-152"
              onClick={() => setServicesSheetOpen(true)}
              className="flex min-h-11 items-center gap-2.5 rounded-lg px-2.5 text-left text-sm text-fg transition-colors hover:bg-surface-2 [&_svg]:size-4 [&_svg]:text-muted"
            >
              <Plus aria-hidden />
              <span className="truncate">{t('sidebar.serviceList')}</span>
            </button>
          ) : (
            <QuickTile href="/biz/services" icon={<Plus aria-hidden />} label={t('sidebar.serviceList')} />
          ))}
        {canGoodsCatalog && (
          <QuickTile data-f="F-01-153 F-08-003" href="/biz/stock" icon={<Package aria-hidden />} label={t('sidebar.productCatalog')} />
        )}
        {showWaitlist &&
          (onOpenWaitlist ? (
            <button
              type="button"
              data-f="F-01-156"
              onClick={onOpenWaitlist}
              className="flex min-h-11 items-center gap-2.5 rounded-lg px-2.5 text-left text-sm text-fg transition-colors hover:bg-surface-2 [&_svg]:size-4 [&_svg]:text-muted"
            >
              <Plus aria-hidden />
              <span className="truncate">{t('sidebar.waitlist')}</span>
            </button>
          ) : (
            <QuickTile href="/biz/waitlist" icon={<Plus aria-hidden />} label={t('sidebar.waitlist')} />
          ))}
      </div>

      {businessId && <ServicesListSheet open={servicesSheetOpen} onOpenChange={setServicesSheetOpen} businessId={businessId} />}

      {businessId && locationId && <NewPaymentModal open={newPaymentOpen} onOpenChange={setNewPaymentOpen} locationId={locationId} />}

      {(!inSheet || showFooter) && (
        <>
          <SidebarUserFooter />
          <AdministrationModeButton />
        </>
      )}
    </div>
  );
}

/**
 * F-01-008: низ левой панели — кто вошёл, выход, ссылка на личный кабинет, помощь. Мобильные
 * магазины (App Store / Google Play / Huawei AppGallery) не ведут никуда — своего приложения у
 * нас нет (только веб, CONVENTIONS §14) — ссылки не строим, чтобы не обещать несуществующее;
 * добавлены в assumed отчёта.
 */
function SidebarUserFooter() {
  const t = useT('journal');
  const tc = useT('common');
  const router = useRouter();
  const apply = useApplyDemo();
  const { persona } = useDemo();
  const { staffId } = useCurrent();
  const staffQuery = useApiQuery(['core', 'staff', staffId], () => coreGet('staff', staffId!), { enabled: Boolean(staffId) });
  const name = staffQuery.data?.name ?? tc(`demo.personas.${persona}`);
  // Staff.email нет в ядре (только служебный login администратора, F-00-034, не для показа
  // пользователю — выглядит как «lilit.nuri», путается с сырым i18n-ключом на глаз и в замере) —
  // ТЗ (01-journal §Прочее) просит email; заведён в qa/requests/journal.md, до тех пор вторая
  // строка не рисуется.

  return (
    <div data-f="F-01-008" className="mt-2 flex flex-col gap-1 border-t border-border pt-3">
      <div className="flex items-center gap-2 px-1">
        <Link
          href={staffId ? `/biz/staff/${staffId}` : '/biz/settings'}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-lg py-1 hover:bg-surface-2"
        >
          <Avatar name={name} size="sm" colorIndex={staffQuery.data?.colorIndex} />
          <span className="min-w-0 truncate text-sm font-medium text-fg">{name}</span>
        </Link>
        <IconButton
          icon={<HelpCircle aria-hidden />}
          label={t('sidebar.footer.help')}
          size="sm"
          variant="ghost"
          onClick={() => router.push('/biz/settings')}
        />
        <IconButton
          icon={<LogOut aria-hidden />}
          label={tc('actions.logout')}
          size="sm"
          variant="ghost"
          onClick={() => {
            apply({ persona: 'guest' });
            router.push('/');
          }}
        />
      </div>
    </div>
  );
}

/**
 * F-01-001: «Цифровой журнал» / «Администрирование» — кнопка внизу левой панели.
 *
 * Полноценный переключатель, который меняет сам каркас кабинета (`BizShell`), — решение продукта
 * ядра: хранитель ядра отказал строить его («единое меню — сознательное упрощение продукта»,
 * qa/requests/ux-core.md §5, r3) и предложил взамен `useDenseScreen()` — журнал его уже зовёт
 * (JournalScreen.tsx), меню сворачивается до рейки под сеткой.
 *
 * В своих путях журнал строит саму кнопку буквально по ТЗ, не трогая BizShell: журнал —
 * единственный экран, который просит «плотный» каркас, поэтому у новой вкладки его не будет —
 * она открывается с полным меню кабинета (все разделы, отчёты, настройки, сотрудники, склад и
 * т. д.), то есть ведёт себя как отдельный режим «управления» рядом с «рабочим местом дня» в этой
 * вкладке — «режим панели хранится во вкладке» выполняется тем, что это буквально другая вкладка.
 * Подпись всегда «Администрирование», потому что кнопка стоит только на экране журнала (обратной
 * подписи «Цифровой журнал» негде появиться — отдельного экрана-режима «администрирование» нет,
 * это следствие решения ядра выше, а не пропуск).
 */
function AdministrationModeButton() {
  const t = useT('journal');
  const canSeeReports = useCan('reports.view');
  const href = canSeeReports ? '/biz/reports' : '/biz/settings';

  return (
    <button
      type="button"
      data-f="F-01-001"
      onClick={() => window.open(href, '_blank', 'noopener')}
      className="mt-auto flex min-h-11 shrink-0 items-center gap-2.5 rounded-lg border border-border px-2.5 text-sm font-medium text-fg transition-colors hover:bg-surface-2 [&_svg]:size-4 [&_svg]:text-muted"
    >
      <LayoutGrid aria-hidden />
      <span className="truncate">{t('sidebar.administration')}</span>
    </button>
  );
}

/**
 * F-01-005: список закреплённых разделов — своя звёздочка живёт только у заголовка журнала
 * (нет другой страницы, которая уже вызывает toggleFavorite, см. комментарий у FavoriteSection в
 * domain/journal.ts), но список готов принять записи любого раздела, как только тот подключит свою
 * звёздочку. Порядок = порядок добавления (getFavorites хранит массив в порядке toggle); открытый
 * сейчас раздел подсвечен; сворачивается стрелкой у заголовка.
 */
function FavoritesSection({ ownStaffId }: { ownStaffId?: Id }) {
  const t = useT('journal');
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(true);
  const favoritesQuery = useApiQuery(['journal', 'favorites', ownStaffId], () => getFavorites(ownStaffId ?? ''), { enabled: Boolean(ownStaffId) });
  const favoriteMutation = useApiMutation((section: FavoriteSection) => toggleFavorite(ownStaffId ?? '', section));

  if (!ownStaffId) return null;
  const favorites = favoritesQuery.data ?? [];

  return (
    <div data-f="F-01-005" className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex min-h-11 items-center justify-between px-2.5 text-sm font-semibold text-muted"
      >
        <span>{t('sidebar.favorites.title')}</span>
        <ChevronDown aria-hidden className={cn('size-4 transition-transform', !expanded && '-rotate-90')} />
      </button>
      {expanded &&
        (favorites.length === 0 ? (
          <p className="px-2.5 pb-1 text-xs text-muted">{t('sidebar.favorites.empty')}</p>
        ) : (
          <div className="flex flex-col gap-0.5">
            {favorites.map((f) => {
              const active = pathname === f.href;
              return (
                <div
                  key={f.id}
                  className={cn(
                    'group flex min-h-10 items-center gap-1.5 rounded-lg pr-1 pl-2.5 text-sm transition-colors',
                    active ? 'bg-primary-soft text-primary-text' : 'text-fg hover:bg-surface-2',
                  )}
                >
                  <Link href={f.href} className="min-h-10 flex-1 truncate py-2 leading-6">
                    {t(f.labelKey as never)}
                  </Link>
                  <IconButton
                    icon={<Star aria-hidden className={cn(active && 'fill-current')} />}
                    label={t('sidebar.favorites.remove')}
                    size="sm"
                    variant="ghost"
                    onClick={() => favoriteMutation.mutate(f)}
                  />
                </div>
              );
            })}
          </div>
        ))}
    </div>
  );
}

function QuickTile({ href, icon, label, ...rest }: { href: string; icon: ReactNode; label: string } & Record<string, unknown>) {
  return (
    <Link
      href={href}
      {...rest}
      className={cn(
        'flex min-h-11 items-center gap-2.5 rounded-lg px-2.5 text-sm text-fg transition-colors hover:bg-surface-2',
        '[&_svg]:size-4 [&_svg]:text-muted',
      )}
    >
      {icon}
      <span className="truncate">{label}</span>
    </Link>
  );
}
