/**
 * СКРЫТО ДО НАСТОЯЩЕГО ПОДКЛЮЧЕНИЯ — один переключатель на всё (владелец 17.11.2026, ответы 7, 15, 20, 21, 22:
 * «да, всё скрыть, но вспоминай, чтобы это потом добавили»; ответ 22 «Вход только с IP салона» вернули с проверкой на
 * сервере 20.11.2026). Части кабинета, которые показывали только вид, без
 * настоящей работы на сервере: ни одной пометки «демо» в живом кабинете. Код не удаляем — прячем здесь.
 *
 * Подключили по-настоящему → поставили `true` и убрали строку из docs/ROADMAP.md, раздел «Скрыто до настоящего
 * подключения — вернуть». Прямая ссылка на спрятанную страницу ведёт на соседнюю живую (src/proxy.ts), пункт меню
 * пропадает сам (src/config/nav.ts), блоки на экранах проверяют `isConnected(...)`.
 */
export const CONNECTED = {
  /** «Другие каналы записи» (Google, Яндекс, 2ГИС, каталоги, боты) и «Свой виджет через API» в «Онлайн-записи → Виджет» */
  bookingChannels: false,
  /** Открытый API: ключи и токены, идентификаторы, MCP, документация, статус API в «Интеграциях» (вебхуки — живые) */
  openApi: false,
  /** Оплата картой онлайн: «Политика оплаты», Adyen — нужен платёжный провайдер */
  cardPayments: false,
  /** «Запись через внешнего агента» в уведомлениях */
  externalAgent: false,
  /** SMS-канал уведомлений — нужен настоящий поставщик SMS (было «для демо подойдёт любой ключ») */
  sms: false,
  /** Телефония: звонки в кабинете, «Телефония» сети, отчёт «Звонки», вкладка «Звонки» клиента, всплывашки звонков */
  telephony: false,
  /** Каталог приложений партнёров (было 108 — копия Altegio), «Установленные», кабинет разработчика, каталог каналов */
  appCatalog: false,
  /** «Внешняя аналитика» в отчётах */
  externalAnalytics: false,
  /** Подтверждение почты письмом в «Личном кабинете» — пока адрес просто сохраняется */
  emailConfirm: false,
  /** «Демо телефонной книги» в импорте клиентов и «Импорт и экспорт телефонной книги» в приложениях */
  phonebook: false,
  /** Своё приложение под брендом салона — решение не принято, экран был демо-заявкой */
  brandedApp: false,
  /** Предложения поставщиков рядом с заканчивающимся товаром — реальных поставщиков пока нет */
  supplierOffers: false,
  /** Письма абонементов «только Бразилия / Казахстан» (автопродление, анкета FastSign) — ответ 16: убрать */
  foreignMembershipLetters: false,
} as const;

export type ConnectedFeature = keyof typeof CONNECTED;

export function isConnected(feature: ConnectedFeature): boolean {
  return CONNECTED[feature];
}

/**
 * Страницы спрятанного: адрес (и всё под ним) → куда вести вместо него. Порядок — от частного к общему.
 * `exact: true` — только сам адрес (под ним живые страницы).
 */
export const HIDDEN_ROUTES: { prefix: string; feature: ConnectedFeature; to: string; exact?: boolean }[] = [
  { prefix: '/biz/finance/policy', feature: 'cardPayments', to: '/biz/finance' },
  { prefix: '/biz/finance/adyen', feature: 'cardPayments', to: '/biz/finance' },
  { prefix: '/biz/notifications/channels/sms', feature: 'sms', to: '/biz/notifications/channels' },
  { prefix: '/biz/notifications/channels/catalog', feature: 'appCatalog', to: '/biz/notifications/channels' },
  { prefix: '/biz/notifications/channels/promotion', feature: 'appCatalog', to: '/biz/notifications/channels' },
  { prefix: '/biz/network/telephony', feature: 'telephony', to: '/biz/network' },
  { prefix: '/biz/reports/r/calls', feature: 'telephony', to: '/biz/reports/all' },
  { prefix: '/biz/reports/r/external', feature: 'externalAnalytics', to: '/biz/reports/all' },
  { prefix: '/biz/integrations/api/status', feature: 'openApi', to: '/biz/integrations/api' },
  { prefix: '/biz/integrations/installed', feature: 'appCatalog', to: '/biz/integrations/api' },
  { prefix: '/biz/integrations/developers', feature: 'appCatalog', to: '/biz/integrations/api' },
  { prefix: '/biz/integrations/category', feature: 'appCatalog', to: '/biz/integrations/api' },
  { prefix: '/biz/integrations/apps', feature: 'appCatalog', to: '/biz/integrations/api' },
  { prefix: '/biz/integrations/e', feature: 'appCatalog', to: '/biz/integrations/api' },
  { prefix: '/biz/integrations', feature: 'appCatalog', to: '/biz/integrations/api', exact: true },
  { prefix: '/biz/apps/branded', feature: 'brandedApp', to: '/biz/apps' },
  // «Интеграции» клиентской базы — чат, CRM, боты, календарь через приложения партнёров и телефония; живое — только вебхук
  { prefix: '/biz/clients/integrations', feature: 'appCatalog', to: '/biz/clients' },
];

/** Куда вести с адреса спрятанной страницы; undefined — страница живая */
export function hiddenRouteTarget(pathname: string): string | undefined {
  const path = pathname.replace(/\/+$/, '') || '/';
  for (const r of HIDDEN_ROUTES) {
    if (isConnected(r.feature)) continue;
    if (r.exact ? path === r.prefix : path === r.prefix || path.startsWith(`${r.prefix}/`)) return r.to;
  }
  return undefined;
}
