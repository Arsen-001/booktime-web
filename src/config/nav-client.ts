/**
 * Вкладки приложения клиента (нижние на телефоне, верхнее меню на десктопе). Файл фундамента.
 *
 * Отдельно от src/config/nav.ts ради скорости публичных страниц (05.10.2026): nav.ts подключает меню всех разделов
 * кабинета (src/areas/<area>/nav.ts), а те — свои API со счётчиками; через каркас клиента это тянуло код всего кабинета
 * (около 1 МБ скриптов) на главную, поиск и страницу салона. Подпунктов у вкладок клиента нет.
 */
import { CalendarCheck, CircleUser, Heart, House, Search } from 'lucide-react';
import type { NavGroupId, NavItem } from '@/config/nav-types';
import type { PersonaId } from '@/demo/settings';

const EVERYONE: PersonaId[] = ['guest', 'client', 'individual', 'owner', 'admin', 'master', 'network', 'platform'];

function tab(id: string, href: string, icon: NavItem['icon'], group: NavGroupId = 'clients'): NavItem {
  return { id, area: 'client', href, icon, group, personas: EVERYONE, labelKey: `common.nav.${id}` };
}

/** Приложение клиента: нижние вкладки на телефоне, верхнее меню на десктопе */
export const CLIENT_NAV: NavItem[] = [
  tab('home', '/', House),
  tab('search', '/search', Search),
  { ...tab('bookings', '/bookings', CalendarCheck), shortLabelKey: 'common.navShort.bookings' },
  tab('favorites', '/favorites', Heart),
  tab('profile', '/profile', CircleUser),
];
