/**
 * Н7 (настройки-ревью 27.09.2026): вклады разделов в хаб настроек показываются ПЛИТКАМИ-ССЫЛКАМИ, а не
 * встроенными формами (хаб был 7 724 px). Раздел, у которого есть свой экран настроек, открывается там;
 * раздел, чьи настройки живут только во вкладе хаба, — на /biz/settings/modules/<area> (вклад целиком, один).
 */
import {
  Banknote,
  Bell,
  Blocks,
  BookOpen,
  CalendarClock,
  CalendarDays,
  Gift,
  Globe2,
  Network,
  Package,
  Scissors,
  Users,
  UserCog,
  Wallet,
  Warehouse,
  type LucideIcon,
} from 'lucide-react';
import type { AreaId } from '@/config/areas';

export interface HubModule {
  /** Свой экран раздела; нет — настройки из вклада открываются на /biz/settings/modules/<area> */
  href?: string;
  icon: LucideIcon;
}

export const HUB_MODULES: Partial<Record<AreaId, HubModule>> = {
  journal: { href: '/biz/journal/settings', icon: CalendarDays },
  online: { href: '/biz/online/settings', icon: Globe2 },
  schedule: { icon: CalendarClock },
  services: { href: '/biz/services', icon: Scissors },
  staff: { icon: UserCog },
  clients: { icon: Users },
  notify: { href: '/biz/notifications', icon: Bell },
  loyalty: { icon: Gift },
  finance: { href: '/biz/finance/settings', icon: Wallet },
  payroll: { href: '/biz/payroll/settings', icon: Banknote },
  stock: { href: '/biz/stock/settings', icon: Warehouse },
  resources: { href: '/biz/resources', icon: Package },
  network: { icon: Network },
  integrations: { href: '/biz/integrations', icon: Blocks },
};

/** Раздел без своего экрана — вклад открывается отдельной страницей хаба */
export function hubModuleHref(area: AreaId): string {
  return HUB_MODULES[area]?.href ?? `/biz/settings/modules/${area}`;
}

export const HUB_FALLBACK_ICON: LucideIcon = BookOpen;
