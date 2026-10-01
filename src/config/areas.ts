import areasJson from '@docs/areas.json';

/**
 * 18 разделов (id — из docs/areas.json; менять нельзя).
 * Порядок здесь = порядок в AREAS.md и в отчётах.
 */
export const AREA_IDS = [
  'client',
  'platform',
  'journal',
  'schedule',
  'online',
  'clients',
  'notify',
  'loyalty',
  'finance',
  'stock',
  'payroll',
  'staff',
  'network',
  'reports',
  'integrations',
  'settings',
  'resources',
  'services',
] as const;

export type AreaId = (typeof AREA_IDS)[number];

export interface AreaInfo {
  id: AreaId;
  /** Заголовок по-русски из docs/areas.json (переводы — common.areas.<id>) */
  title: string;
  /** Файлы ТЗ в booking-research/functional-map */
  spec: string[];
  /** Наши решения из 00-our-decisions.md */
  ours: string;
  /** Пути раздела в src/app */
  routes: string[];
  nav: string;
}

export const SPEC_DIR: string = areasJson.specDir;

export const AREAS: Record<AreaId, AreaInfo> = Object.fromEntries(
  areasJson.areas.map((a) => [a.id, a as AreaInfo]),
) as Record<AreaId, AreaInfo>;

export function isAreaId(value: string): value is AreaId {
  return (AREA_IDS as readonly string[]).includes(value);
}
