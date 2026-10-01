/**
 * Правила витрины «Интеграции» (не бизнес-правила ядра — раскладка каталога): иконки категорий,
 * правило отбора блоков «Обзора» (F-13-003), подписи каналов/разрешений для UI раздела.
 */
import { BarChart3, Bell, Blocks, Bot, Calculator, CalendarSync, FileInput, Landmark, MapPinned, Megaphone, MoreHorizontal, Phone, Receipt, Share2, MessageCircle, HandCoins, Users2, UserCog } from 'lucide-react';
import type { CategoryCount } from '@/api/integrations';
import type { AppChannel, CatalogApp, IntegrationCategoryId, RequestedScope } from '@/domain/integrations';

export const CATEGORY_ICON: Record<IntegrationCategoryId, typeof Bell> = {
  notifications: Bell,
  telephony: Phone,
  marketing: Megaphone,
  social: Share2,
  widgets: Blocks,
  analytics: BarChart3,
  accounting: Calculator,
  maps: MapPinned,
  payments: Landmark,
  fiscal: Receipt,
  other: MoreHorizontal,
  chatbots: MessageCircle,
  tips: HandCoins,
  aiAssistants: Bot,
  crm: Users2,
  personnel: UserCog,
};

/**
 * Значок приложения: иконка категории, кроме карточек, у которых «Прочее» ничего не говорит
 * (ревью 27.09, И10: Google Календарь и перенос из другой программы).
 */
export type AppIconKey = IntegrationCategoryId | 'calendar' | 'import';

export const APP_ICON: Record<AppIconKey, typeof Bell> = { ...CATEGORY_ICON, calendar: CalendarSync, import: FileInput };

export function appIconKey(app: Pick<CatalogApp, 'categoryId' | 'name' | 'builtinHref'>): AppIconKey {
  if (app.name === 'Google Календарь') return 'calendar';
  if (app.builtinHref === '/biz/clients/import') return 'import';
  return app.categoryId;
}

/** F-13-003: блоки «Обзора» — непустые видимые категории, в фиксированном порядке важности */
export function selectOverviewCategories(counts: CategoryCount[], max = 6): CategoryCount[] {
  return counts.filter((c) => c.count > 0).slice(0, max);
}

/**
 * F-13-006: цвет значка плитки приложения — витрина показывает партнёров своей иконкой (без чужих
 * логотипов, решение зафиксировано в AppTile), но одна категория даёт 4+ одинаковых по цвету значка
 * подряд и выглядит как один переклеенный шаблон, а не витрина партнёров. Берём палитру мастеров/графиков
 * (--chart-1…8, src/styles/tokens.css, уже тёмная тема) и раскладываем приложения по ней детерминированно
 * по id — тон одинаков на обзоре/категории/поиске/карточке для одного и того же приложения.
 */
const TILE_CHART_VARS = ['--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5', '--chart-6', '--chart-7', '--chart-8'] as const;

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export interface AppTileTone {
  /** Заливка значка — мягкий тон (14% цвета на поверхности карточки) */
  fill: string;
  /** Цвет иконки — сам цвет серии */
  ink: string;
}

export function appTileTone(id: string): AppTileTone {
  const v = `var(${TILE_CHART_VARS[hashId(id) % TILE_CHART_VARS.length]})`;
  return { fill: `color-mix(in srgb, ${v} 14%, var(--surface))`, ink: v };
}

export const CHANNEL_ICON_LABEL: AppChannel[] = ['sms', 'whatsapp', 'waba', 'telegram', 'viber', 'email', 'voice', 'other'];

export const SCOPE_ORDER: RequestedScope[] = ['schedule', 'bookings', 'clients', 'services', 'catalog', 'staff', 'money', 'reports'];

/** F-13-026: входы `?from=<area>` из других разделов — куда вернуться и как подписать источник */
export const FROM_AREA_HREF: Partial<Record<string, string>> = {
  online: '/biz/online',
  notify: '/biz/notify',
  journal: '/biz/journal',
  network: '/biz/network',
};

/**
 * F-13-167/168: приложения каталога, умеющие встраивать чат с клиентом в журнал и окно визита
 * (по имени, а не по отдельному полю каталога — так же, как F-13-165 находит приложение с балансом
 * сообщений по `billsPerMessage`, чтобы не переписывать структуру всех 213 строк каталога).
 */
const CHAT_CAPABLE_APP_NAMES = new Set(['ЧатПлюс — онлайн-чат']);

export function appHasChatCapability(appName: string): boolean {
  return CHAT_CAPABLE_APP_NAMES.has(appName);
}
