/**
 * МЕНЮ всех частей продукта. Файл фундамента: пункты верхнего уровня задаёт фундамент,
 * подпункты — каждый раздел в своём src/areas/<area>/nav.ts (подключаются здесь автоматически).
 * Нужен новый пункт верхнего уровня — просьба в qa/requests/<area>.md.
 */
import {
  Armchair,
  Bell,
  Building2,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  ChartColumn,
  CircleUser,
  Coins,
  CreditCard,
  Gift,
  Globe,
  Heart,
  Hourglass,
  House,
  LayoutDashboard,
  LayoutGrid,
  LifeBuoy,
  Lightbulb,
  ListChecks,
  MapPin,
  MapPinned,
  Megaphone,
  Network,
  Package,
  PiggyBank,
  Plug,
  Rocket,
  Search,
  Settings,
  Shapes,
  ShieldCheck,
  Store,
  Tag,
  Ticket,
  TrendingUp,
  UserCog,
  Users,
  UsersRound,
  Wallet,
} from 'lucide-react';
import type { NavChild, NavGroupId, NavItem, SubNav } from '@/config/nav-types';
import type { Permission } from '@/config/permissions';
import { SPHERES, SPHERE_IDS, type SphereFeature } from '@/config/spheres';
import type { PersonaId } from '@/demo/settings';
import type { SphereId } from '@/domain/core';
import { subnav as clientSub } from '@/areas/client/nav';
import { subnav as platformSub } from '@/areas/platform/nav';
import { subnav as journalSub } from '@/areas/journal/nav';
import { subnav as scheduleSub } from '@/areas/schedule/nav';
import { subnav as onlineSub } from '@/areas/online/nav';
import { subnav as clientsSub } from '@/areas/clients/nav';
import { subnav as notifySub } from '@/areas/notify/nav';
import { subnav as loyaltySub } from '@/areas/loyalty/nav';
import { subnav as financeSub } from '@/areas/finance/nav';
import { subnav as stockSub } from '@/areas/stock/nav';
import { subnav as payrollSub } from '@/areas/payroll/nav';
import { subnav as staffSub } from '@/areas/staff/nav';
import { subnav as networkSub } from '@/areas/network/nav';
import { subnav as reportsSub } from '@/areas/reports/nav';
import { subnav as integrationsSub } from '@/areas/integrations/nav';
import { subnav as settingsSub } from '@/areas/settings/nav';
import { subnav as resourcesSub } from '@/areas/resources/nav';
import { subnav as servicesSub } from '@/areas/services/nav';

const ALL_SUBNAV: SubNav = Object.assign(
  {},
  clientSub,
  platformSub,
  journalSub,
  scheduleSub,
  onlineSub,
  clientsSub,
  notifySub,
  loyaltySub,
  financeSub,
  stockSub,
  payrollSub,
  staffSub,
  networkSub,
  reportsSub,
  integrationsSub,
  settingsSub,
  resourcesSub,
  servicesSub,
);

/** Сферы, где у сферы НЕТ функции → пункт скрыт */
function withoutFeature(feature: SphereFeature): SphereId[] {
  return SPHERE_IDS.filter((id) => !SPHERES[id].features.includes(feature));
}

const BIZ: PersonaId[] = ['individual', 'owner', 'admin', 'master', 'network'];
const MANAGERS: PersonaId[] = ['individual', 'owner', 'admin', 'network'];
const OWNERS: PersonaId[] = ['individual', 'owner', 'network'];

function item(
  id: string,
  area: NavItem['area'],
  href: string,
  icon: NavItem['icon'],
  group: NavGroupId,
  personas: readonly PersonaId[],
  extra: { hiddenInSpheres?: SphereId[]; permission?: Permission; labelKey?: string } = {},
): NavItem {
  return {
    id,
    area,
    href,
    icon,
    group,
    personas,
    labelKey: extra.labelKey ?? `common.nav.${id}`,
    hiddenInSpheres: extra.hiddenInSpheres,
    permission: extra.permission,
    children: ALL_SUBNAV[id],
  };
}

/** Порядок групп в левом меню кабинета */
export const BIZ_NAV_GROUPS: NavGroupId[] = ['work', 'clients', 'money', 'business', 'account'];

/** Кабинет бизнеса /biz */
export const BIZ_NAV: NavItem[] = [
  // Работа
  // ⭐ Главная владельца (01.10.2026): пять цифр с действиями — у кого есть отчёты; остальные начинают с журнала
  item('home', 'reports', '/biz', House, 'work', MANAGERS, { permission: 'reports.view' }),
  item('journal', 'journal', '/biz/journal', CalendarDays, 'work', BIZ, { permission: 'journal.view' }),
  item('records', 'journal', '/biz/records', ListChecks, 'work', BIZ, { permission: 'journal.view' }),
  item('schedule', 'schedule', '/biz/schedule', CalendarClock, 'work', BIZ),
  item('groups', 'resources', '/biz/groups', UsersRound, 'work', BIZ, { hiddenInSpheres: withoutFeature('groups') }),
  item('waitlist', 'resources', '/biz/waitlist', Hourglass, 'work', MANAGERS),
  // Клиенты
  item('clients', 'clients', '/biz/clients', Users, 'clients', BIZ, { permission: 'clients.view' }),
  item('online', 'online', '/biz/online', Globe, 'clients', BIZ),
  item('notifications', 'notify', '/biz/notifications', Bell, 'clients', MANAGERS),
  item('loyalty', 'loyalty', '/biz/loyalty', Gift, 'clients', MANAGERS),
  // Деньги
  item('finance', 'finance', '/biz/finance', Wallet, 'money', MANAGERS, { permission: 'finance.view' }),
  // Владелец, 01.10.2026: кассовую смену ведёт администратор — пункт для finance.shift без остальных финансов
  item('cashShift', 'finance', '/biz/finance/shift', Wallet, 'money', ['admin'], { permission: 'finance.shift', labelKey: 'finance.nav.shift' }),
  item('payroll', 'payroll', '/biz/payroll', PiggyBank, 'money', ['owner', 'admin', 'master', 'network'], { permission: 'payroll.view' }),
  // Владелец, 01.10.2026: администратор и мастер без payroll.view видят только свою зарплату — пункт «Моя зарплата»
  item('payrollMe', 'payroll', '/biz/payroll/me', PiggyBank, 'money', ['admin', 'master'], { labelKey: 'payroll.nav.me' }),
  item('reports', 'reports', '/biz/reports', ChartColumn, 'money', MANAGERS, { permission: 'reports.view' }),
  // Бизнес
  item('services', 'services', '/biz/services', Tag, 'business', BIZ, { permission: 'services.view' }),
  item('staff', 'staff', '/biz/staff', UserCog, 'business', ['owner', 'admin', 'network'], { permission: 'staff.view' }),
  item('resources', 'resources', '/biz/resources', Armchair, 'business', MANAGERS, {
    hiddenInSpheres: withoutFeature('resources'),
  }),
  item('stock', 'stock', '/biz/stock', Package, 'business', BIZ, {
    hiddenInSpheres: withoutFeature('stock'),
    permission: 'stock.view',
  }),
  // 01.10.2026: admin/master видят пункт, только если их добавили пользователем сети (BizShell, useNetworkAccess)
  item('network', 'network', '/biz/network', Network, 'business', ['owner', 'admin', 'master', 'network'], { permission: 'network.manage' }),
  // Аккаунт и подключения
  item('settings', 'settings', '/biz/settings', Settings, 'account', MANAGERS, { permission: 'settings.manage' }),
  item('onboarding', 'settings', '/biz/onboarding', Rocket, 'account', OWNERS),
  item('billing', 'settings', '/biz/billing', CreditCard, 'account', OWNERS, { permission: 'billing.manage' }),
  item('coins', 'settings', '/biz/coins', Coins, 'account', OWNERS, { permission: 'billing.manage' }),
  item('integrations', 'integrations', '/biz/integrations', Plug, 'account', OWNERS, { permission: 'integrations.manage' }),
  item('apps', 'client', '/biz/apps', LayoutGrid, 'account', OWNERS),
];

/**
 * Подпункт, ведущий туда же, куда другой пункт верхнего уровня, не дублируется: раздел завёл ссылку подпунктом,
 * потом фундамент сделал её пунктом меню (ux-platform U-6: «Бизнесы», «План запуска»).
 */
function withoutDuplicateChildren(items: NavItem[]): NavItem[] {
  const topHrefs = new Set(items.map((i) => i.href));
  return items.map((i) => {
    if (!i.children) return i;
    const children = i.children.filter((c) => c.href === i.href || !topHrefs.has(c.href));
    // Остался один подпункт на тот же адрес («Обзор → Обзор») — подменю не нужно
    return { ...i, children: children.length === 1 && children[0].href === i.href ? undefined : children };
  });
}

/** Наша панель /platform */
export const PLATFORM_NAV: NavItem[] = withoutDuplicateChildren([
  item('platformOverview', 'platform', '/platform', LayoutDashboard, 'platform', ['platform']),
  item('businesses', 'platform', '/platform/businesses', Building2, 'platform', ['platform']),
  item('platformUsers', 'platform', '/platform/users', Users, 'platform', ['platform'], { labelKey: 'platform.nav.users' }),
  item('plan', 'platform', '/platform/plan', Rocket, 'platform', ['platform']),
  item('moderation', 'platform', '/platform/moderation', ShieldCheck, 'platform', ['platform']),
  item('connect', 'platform', '/platform/connect', Store, 'platform', ['platform']),
  item('visits', 'platform', '/platform/visits', MapPin, 'platform', ['platform']),
  item('prospects', 'platform', '/platform/prospects', MapPinned, 'platform', ['platform']),
  item('promocodes', 'platform', '/platform/promocodes', Ticket, 'platform', ['platform']),
  item('ads', 'platform', '/platform/ads', Megaphone, 'platform', ['platform']),
  item('demand', 'platform', '/platform/demand', TrendingUp, 'platform', ['platform']),
  item('sphereRequests', 'platform', '/platform/sphere-requests', Shapes, 'platform', ['platform']),
  item('ideas', 'platform', '/platform/ideas', Lightbulb, 'platform', ['platform']),
  item('support', 'platform', '/platform/support', LifeBuoy, 'platform', ['platform']),
]);

const EVERYONE: PersonaId[] = ['guest', 'client', 'individual', 'owner', 'admin', 'master', 'network', 'platform'];

/** Приложение клиента: нижние вкладки на телефоне, верхнее меню на десктопе */
export const CLIENT_NAV: NavItem[] = [
  item('home', 'client', '/', House, 'clients', EVERYONE),
  item('search', 'client', '/search', Search, 'clients', EVERYONE),
  { ...item('bookings', 'client', '/bookings', CalendarCheck, 'clients', EVERYONE), shortLabelKey: 'common.navShort.bookings' },
  item('favorites', 'client', '/favorites', Heart, 'clients', EVERYONE),
  item('profile', 'client', '/profile', CircleUser, 'clients', EVERYONE),
];

export interface NavVisibilityContext {
  persona: PersonaId;
  sphere: SphereId;
  can: (permission: Permission) => boolean;
  /** Подпункты, закрытые правами раздела (01.10.2026: права пользователя сети, useNetworkAccess) */
  hiddenHrefs?: ReadonlySet<string>;
}

function childVisible(child: NavChild, ctx: NavVisibilityContext): boolean {
  if (ctx.hiddenHrefs?.has(child.href)) return false;
  if (child.personas && !child.personas.includes(ctx.persona)) return false;
  if (child.hiddenInSpheres?.includes(ctx.sphere)) return false;
  if (child.permission && !ctx.can(child.permission)) return false;
  return true;
}

/** Пункты, видимые персоне в сфере с её правами */
export function visibleNav(items: NavItem[], ctx: NavVisibilityContext): NavItem[] {
  return items
    .filter((i) => i.personas.includes(ctx.persona))
    .filter((i) => !i.hiddenInSpheres?.includes(ctx.sphere))
    .filter((i) => !i.permission || ctx.can(i.permission))
    .map((i) => ({ ...i, children: i.children?.filter((c) => childVisible(c, ctx)) }));
}

/** Все адреса меню (включая подпункты), сгруппированные по разделам — для /dev/routes и замеров */
export function routesByArea(): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const i of [...CLIENT_NAV, ...BIZ_NAV, ...PLATFORM_NAV]) {
    const list = (out[i.area] ??= []);
    if (!list.includes(i.href)) list.push(i.href);
    for (const c of i.children ?? []) if (!list.includes(c.href)) list.push(c.href);
  }
  return out;
}

/** Пункт меню, к которому относится адрес (самое длинное совпадение) */
export function findNavItem(items: NavItem[], pathname: string): NavItem | undefined {
  let best: NavItem | undefined;
  for (const i of items) {
    const hrefs = [i.href, ...(i.children ?? []).map((c) => c.href)];
    for (const h of hrefs) {
      const match = h === '/' ? pathname === '/' : pathname === h || pathname.startsWith(`${h}/`);
      if (match && (!best || h.length > best.href.length)) best = { ...i, href: h };
    }
  }
  return best ? items.find((i) => i.id === best!.id) : undefined;
}
