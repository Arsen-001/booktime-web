import type { Locale } from '@/i18n/config';

/**
 * Типы словарей берутся из РУССКИХ файлов: t('ключ') проверяется компилятором.
 * Нет ключа в messages/ru/<ns>.json → ошибка tsc. Добавили раздел-неймспейс — добавьте строку сюда
 * (делает фундамент).
 */
export interface Messages {
  common: typeof import('../../messages/ru/common.json');
  ui: typeof import('../../messages/ru/ui.json');
  client: typeof import('../../messages/ru/client.json');
  platform: typeof import('../../messages/ru/platform.json');
  journal: typeof import('../../messages/ru/journal.json');
  schedule: typeof import('../../messages/ru/schedule.json');
  online: typeof import('../../messages/ru/online.json');
  clients: typeof import('../../messages/ru/clients.json');
  notify: typeof import('../../messages/ru/notify.json');
  loyalty: typeof import('../../messages/ru/loyalty.json');
  finance: typeof import('../../messages/ru/finance.json');
  stock: typeof import('../../messages/ru/stock.json');
  payroll: typeof import('../../messages/ru/payroll.json');
  staff: typeof import('../../messages/ru/staff.json');
  network: typeof import('../../messages/ru/network.json');
  reports: typeof import('../../messages/ru/reports.json');
  integrations: typeof import('../../messages/ru/integrations.json');
  settings: typeof import('../../messages/ru/settings.json');
  resources: typeof import('../../messages/ru/resources.json');
  services: typeof import('../../messages/ru/services.json');
  orders: typeof import('../../messages/ru/orders.json');
}

declare module 'next-intl' {
  interface AppConfig {
    Locale: Locale;
    Messages: Messages;
  }
}
