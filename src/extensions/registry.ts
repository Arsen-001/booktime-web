'use client';

/**
 * РЕЕСТР ВКЛАДОВ: пары из pairs.ts + ленивые компоненты. Файл фундамента — разделы его НЕ правят,
 * а заполняют свой src/areas/<area>/extensions/<Host>.tsx. Нужна новая пара — qa/requests/<area>.md.
 */
import { lazy, type ComponentType } from 'react';
import { SPHERES, SPHERE_IDS } from '@/config/spheres';
import { EXTENSION_PAIRS } from '@/extensions/pairs';
import type { ExtensionEntry, HostId } from '@/extensions/types';

// Пропсы у каждого хоста свои — тип сужается в ExtensionEntry<H>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loader = () => Promise<{ default: ComponentType<any> }>;

/** Явные import() — сборщику нужны статические пути */
const LOADERS: Record<string, Loader> = {
  'bookingWindow:clients': () => import('@/areas/clients/extensions/BookingWindow'),
  'bookingWindow:finance': () => import('@/areas/finance/extensions/BookingWindow'),
  'bookingWindow:loyalty': () => import('@/areas/loyalty/extensions/BookingWindow'),
  'bookingWindow:stock': () => import('@/areas/stock/extensions/BookingWindow'),
  'bookingWindow:resources': () => import('@/areas/resources/extensions/BookingWindow'),
  'bookingWindow:notify': () => import('@/areas/notify/extensions/BookingWindow'),
  'bookingWindow:online': () => import('@/areas/online/extensions/BookingWindow'),
  'clientCard:journal': () => import('@/areas/journal/extensions/ClientCard'),
  'clientCard:finance': () => import('@/areas/finance/extensions/ClientCard'),
  'clientCard:loyalty': () => import('@/areas/loyalty/extensions/ClientCard'),
  'clientCard:notify': () => import('@/areas/notify/extensions/ClientCard'),
  'clientCard:online': () => import('@/areas/online/extensions/ClientCard'),
  'clientCard:client': () => import('@/areas/client/extensions/ClientCard'),
  'staffCard:schedule': () => import('@/areas/schedule/extensions/StaffCard'),
  'staffCard:services': () => import('@/areas/services/extensions/StaffCard'),
  'staffCard:online': () => import('@/areas/online/extensions/StaffCard'),
  'staffCard:payroll': () => import('@/areas/payroll/extensions/StaffCard'),
  'staffCard:resources': () => import('@/areas/resources/extensions/StaffCard'),
  'staffCard:notify': () => import('@/areas/notify/extensions/StaffCard'),
  'serviceCard:online': () => import('@/areas/online/extensions/ServiceCard'),
  'serviceCard:stock': () => import('@/areas/stock/extensions/ServiceCard'),
  'serviceCard:payroll': () => import('@/areas/payroll/extensions/ServiceCard'),
  'serviceCard:resources': () => import('@/areas/resources/extensions/ServiceCard'),
  'serviceCard:loyalty': () => import('@/areas/loyalty/extensions/ServiceCard'),
  'settingsHub:journal': () => import('@/areas/journal/extensions/SettingsHub'),
  'settingsHub:schedule': () => import('@/areas/schedule/extensions/SettingsHub'),
  'settingsHub:online': () => import('@/areas/online/extensions/SettingsHub'),
  'settingsHub:services': () => import('@/areas/services/extensions/SettingsHub'),
  'settingsHub:staff': () => import('@/areas/staff/extensions/SettingsHub'),
  'settingsHub:clients': () => import('@/areas/clients/extensions/SettingsHub'),
  'settingsHub:notify': () => import('@/areas/notify/extensions/SettingsHub'),
  'settingsHub:loyalty': () => import('@/areas/loyalty/extensions/SettingsHub'),
  'settingsHub:finance': () => import('@/areas/finance/extensions/SettingsHub'),
  'settingsHub:payroll': () => import('@/areas/payroll/extensions/SettingsHub'),
  'settingsHub:stock': () => import('@/areas/stock/extensions/SettingsHub'),
  'settingsHub:resources': () => import('@/areas/resources/extensions/SettingsHub'),
  'settingsHub:network': () => import('@/areas/network/extensions/SettingsHub'),
  'settingsHub:integrations': () => import('@/areas/integrations/extensions/SettingsHub'),
  'clientProfile:loyalty': () => import('@/areas/loyalty/extensions/ClientProfile'),
  'clientProfile:finance': () => import('@/areas/finance/extensions/ClientProfile'),
  'journalWaitlist:resources': () => import('@/areas/resources/extensions/JournalWaitlist'),
};

export const EXTENSIONS: ExtensionEntry[] = EXTENSION_PAIRS.flatMap((pair) => {
  const loader = LOADERS[`${pair.host}:${pair.area}`];
  if (!loader) {
    console.error(`[extensions] нет загрузчика для ${pair.host}:${pair.area}`);
    return [];
  }
  return [
    {
      host: pair.host,
      area: pair.area,
      order: pair.order,
      labelKey: `common.ext.${pair.host}.${pair.area}`,
      personas: pair.personas,
      hiddenInSpheres: pair.feature ? SPHERE_IDS.filter((s) => !SPHERES[s].features.includes(pair.feature!)) : undefined,
      component: lazy(loader) as ExtensionEntry['component'],
    },
  ];
});

export function extensionsFor(host: HostId): ExtensionEntry[] {
  return EXTENSIONS.filter((e) => e.host === host).sort((a, b) => a.order - b.order);
}

export function findExtension(host: string, area: string): ExtensionEntry | undefined {
  return EXTENSIONS.find((e) => e.host === host && e.area === area);
}
