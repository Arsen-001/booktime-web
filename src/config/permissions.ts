import type { PersonaId } from '@/demo/settings';

/**
 * Права (F-00-039: права администратора галочками; список сверяется 1:1 с Altegio разделом staff).
 * Базовый набор задан фундаментом; права конкретного администратора владелец меняет в разделе staff
 * через api core setStaffPermissions() — PermissionGate учитывает это сам.
 */
export const PERMISSIONS = [
  'journal.view',
  'journal.edit',
  /** Создавать записи кликом по ячейке (F-01-024, F-01-178); проверяйте вместе с journal.edit */
  'journal.create',
  /** Переносить и растягивать записи (F-01-031, F-01-179) */
  'journal.reschedule',
  'journal.others',
  /** «Показывать статистику»: сводка дня в журнале (F-01-011) — выручка и оплаты за день */
  'journal.stats',
  'clients.view',
  'clients.phones',
  'clients.edit',
  'clients.export',
  /** Удалять клиентов (F-04-074, F-04-042) — по умолчанию только у владельца */
  'clients.delete',
  'schedule.edit',
  'services.view',
  'services.edit',
  'staff.view',
  'staff.manage',
  /** Онлайн-запись всего бизнеса: правила, заявки, виджет, ссылки, места */
  'online.manage',
  /**
   * Онлайн-запись «своя» (online.md, F-00-066, F-03-127): свои правила отмены/переноса и свои заявки. Раздел сам сужает
   * до staffId; online.manage — ко всем. Нет online.own и online.manage — раздел скрыт.
   */
  'online.own',
  'notify.manage',
  /** Рассылки клиентам (F-05-111); по умолчанию у владельца, админу — галочкой */
  'notify.mailings',
  /** Журнал отправленных уведомлений (F-05-112) */
  'notify.log',
  'loyalty.manage',
  /** «Настройка программ лояльности» (F-04-114): правила начисления и скидок; по умолчанию только у владельца */
  'loyalty.rules',
  /**
   * F-06-175 (точечная правка CONVENTIONS §1 третий проход, qa/requests/loyalty.md 2026-09-25): «Оплата
   * сертификатом/абонементом без кода» — 8-я галочка «Лояльность» на карточке сотрудника; без неё в оплате
   * нет кнопки применения сертификата/абонемента/карты, привязанных к клиенту (нужен код). По умолчанию —
   * только у владельца, как остальные тонкие права лояльности.
   */
  'loyalty.applyWithoutCode',
  'finance.view',
  'finance.edit',
  /**
   * Кассовая смена (владелец, 01.10.2026): открыть/закрыть смену и Z-отчёт текущей смены — без остальных финансов.
   * По умолчанию у администратора (кассир — он); finance.edit тоже даёт смену.
   */
  'finance.shift',
  'stock.view',
  'stock.edit',
  'payroll.view',
  'payroll.manage',
  'resources.manage',
  'reports.view',
  'network.manage',
  /** Отдельный тумблер «Добавление локации в сети» (F-11-039), вне групп — как IP-адреса и «Ресурсы» у staff */
  'network.addLocation',
  'integrations.manage',
  /** Отдельное право «Изменение настроек WebHook» (F-13-024, F-13-067) — без него страница вебхуков скрыта */
  'integrations.webhooksEdit',
  'settings.manage',
  'billing.manage',
  'platform.access',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ALL_BIZ = PERMISSIONS.filter((p) => p !== 'platform.access');

/** Права персон по умолчанию */
export const PERSONA_PERMISSIONS: Record<PersonaId, readonly Permission[]> = {
  guest: [],
  client: [],
  individual: ALL_BIZ.filter((p) => p !== 'network.manage' && p !== 'staff.manage' && p !== 'journal.others'),
  owner: ALL_BIZ,
  admin: [
    'journal.view',
    'journal.edit',
    'journal.create',
    'journal.reschedule',
    'journal.others',
    'journal.stats',
    'clients.view',
    'clients.phones',
    'clients.edit',
    'schedule.edit',
    'services.view',
    'staff.view',
    'online.manage',
    'online.own',
    'stock.view',
    // Владелец, 01.10.2026: администратор ведёт склад — товары, приход, продажа, списание (настройки склада — settings.manage)
    'stock.edit',
    'resources.manage',
    // Владелец, 01.10.2026: администратор продаёт абонементы и сертификаты на стойке
    'loyalty.manage',
    // Владелец, 01.10.2026: кассовую смену ведёт администратор
    'finance.shift',
  ],
  master: [
    'journal.view',
    'journal.edit',
    'journal.create',
    'journal.reschedule',
    'clients.view',
    'schedule.edit',
    'services.view',
    'stock.view',
    // Владелец, 01.10.2026: мастер по умолчанию видит только свою зарплату («Моя зарплата») — payroll.view нет
    'online.own',
  ],
  network: ALL_BIZ,
  platform: ['platform.access'],
};
