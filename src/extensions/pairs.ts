import type { AreaId } from '@/config/areas';
import type { SphereFeature } from '@/config/spheres';
import type { PersonaId } from '@/demo/settings';
import type { HostId } from '@/extensions/types';

/**
 * Пары «хост ← раздел-вкладчик» (данные без компонентов — их читает и сервер: /dev/routes).
 * Файл фундамента. Компоненты подключаются в registry.ts.
 */
export interface ExtensionPair {
  host: HostId;
  area: AreaId;
  order: number;
  /** Скрыть в сферах, где нет этой функции */
  feature?: SphereFeature;
  personas?: PersonaId[];
}

export const EXTENSION_PAIRS: ExtensionPair[] = [
  // Окно записи (хозяин journal)
  { host: 'bookingWindow', area: 'clients', order: 10 },
  { host: 'bookingWindow', area: 'finance', order: 20 },
  { host: 'bookingWindow', area: 'loyalty', order: 30 },
  { host: 'bookingWindow', area: 'stock', order: 40, feature: 'stock' },
  { host: 'bookingWindow', area: 'resources', order: 50, feature: 'resources' },
  { host: 'bookingWindow', area: 'notify', order: 60 },
  { host: 'bookingWindow', area: 'online', order: 70 },
  // Карточка клиента (хозяин clients)
  { host: 'clientCard', area: 'journal', order: 10 },
  { host: 'clientCard', area: 'finance', order: 20 },
  { host: 'clientCard', area: 'loyalty', order: 30 },
  { host: 'clientCard', area: 'notify', order: 40 },
  { host: 'clientCard', area: 'online', order: 50 },
  // k4: разовый пуш клиенту из карточки (client F-14-074)
  { host: 'clientCard', area: 'client', order: 60 },
  // Карточка сотрудника (хозяин staff)
  { host: 'staffCard', area: 'schedule', order: 10 },
  { host: 'staffCard', area: 'services', order: 20 },
  { host: 'staffCard', area: 'online', order: 30 },
  { host: 'staffCard', area: 'payroll', order: 40 },
  { host: 'staffCard', area: 'resources', order: 50, feature: 'resources' },
  // k4: уведомления сотрудника (notify F-05-055/056/057/060/063/113)
  { host: 'staffCard', area: 'notify', order: 60 },
  // Карточка услуги (хозяин services)
  { host: 'serviceCard', area: 'online', order: 10 },
  { host: 'serviceCard', area: 'stock', order: 20, feature: 'stock' },
  { host: 'serviceCard', area: 'payroll', order: 30 },
  { host: 'serviceCard', area: 'resources', order: 40, feature: 'resources' },
  { host: 'serviceCard', area: 'loyalty', order: 50 },
  // Хаб настроек /biz/settings (хозяин settings)
  { host: 'settingsHub', area: 'journal', order: 10 },
  { host: 'settingsHub', area: 'schedule', order: 20 },
  { host: 'settingsHub', area: 'online', order: 30 },
  { host: 'settingsHub', area: 'services', order: 40 },
  { host: 'settingsHub', area: 'staff', order: 50 },
  { host: 'settingsHub', area: 'clients', order: 60 },
  { host: 'settingsHub', area: 'notify', order: 70 },
  { host: 'settingsHub', area: 'loyalty', order: 80 },
  { host: 'settingsHub', area: 'finance', order: 90 },
  { host: 'settingsHub', area: 'payroll', order: 100 },
  { host: 'settingsHub', area: 'stock', order: 110, feature: 'stock' },
  { host: 'settingsHub', area: 'resources', order: 120, feature: 'resources' },
  { host: 'settingsHub', area: 'network', order: 130, personas: ['owner', 'network'] },
  { host: 'settingsHub', area: 'integrations', order: 140 },
  // Профиль клиента в приложении (хозяин client)
  { host: 'clientProfile', area: 'loyalty', order: 10 },
  { host: 'clientProfile', area: 'finance', order: 20 },
  // Панель «Лист ожидания» журнала (хозяин journal) — содержимое рисует хозяин листа resources (один лист, 30.09.2026)
  { host: 'journalWaitlist', area: 'resources', order: 10 },
];
