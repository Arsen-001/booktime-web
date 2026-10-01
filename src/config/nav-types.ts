import type { LucideIcon } from 'lucide-react';
import type { AreaId } from '@/config/areas';
import type { Permission } from '@/config/permissions';
import type { PersonaId } from '@/demo/settings';
import type { SphereId } from '@/domain/core';

export type NavGroupId = 'work' | 'clients' | 'money' | 'business' | 'account' | 'platform';

/** Подпункт меню. Живёт в файле раздела src/areas/<area>/nav.ts — раздел меняет его сам. */
export interface NavChild {
  id: string;
  href: string;
  /** ПОЛНЫЙ ключ перевода, обычно в словаре раздела: 'loyalty.nav.cards' */
  labelKey: string;
  personas?: PersonaId[];
  hiddenInSpheres?: SphereId[];
  permission?: Permission;
  /** Страница ещё не построена (заглушка): каркас показывает рядом маленький Badge «скоро» (ux-clients №1) */
  soon?: boolean;
  /**
   * Счётчик у подписи («Заявки · 3», ux-online R2-2): ХУК раздела, возвращает число или undefined (нет данных).
   * Каркас зовёт его в своём маленьком компоненте на каждый видимый пункт и скрывает Badge при 0/undefined;
   * в свёрнутом меню — точка. Внутри — useApiQuery с ключом раздела, например:
   *   useCount: () => useApiQuery(['online', 'requests', 'count'], countPendingRequests).data
   */
  useCount?: () => number | undefined;
}

/** Подпункты раздела по id пункта верхнего уровня: { loyalty: [...] } */
export type SubNav = Record<string, NavChild[]>;

/** Пункт меню верхнего уровня (src/config/nav.ts — файл фундамента) */
export interface NavItem {
  id: string;
  area: AreaId;
  href: string;
  /** Полный ключ перевода: 'common.nav.journal' */
  labelKey: string;
  /** Короткая подпись для нижних вкладок телефона */
  shortLabelKey?: string;
  icon: LucideIcon;
  group: NavGroupId;
  /** Какие персоны видят пункт */
  personas: readonly PersonaId[];
  /** В каких сферах пункт скрыт (у каждой сферы только свои функции, F-00-145) */
  hiddenInSpheres?: SphereId[];
  /** Право, без которого пункт скрыт (для администратора — галочки владельца) */
  permission?: Permission;
  /** Страница-заглушка — Badge «скоро» (см. NavChild.soon) */
  soon?: boolean;
  children?: NavChild[];
}
