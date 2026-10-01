/**
 * Полный каталог тонких прав (F-10-076…090, F-10-160): 13 групп / ~207 строк + 4 отдельных
 * переключателя (F-10-089) + группа «Медицинские документы» (F-10-160, только сфера dental).
 * Каждая строка сведена к одному из 28 грубых прав фундамента (src/config/permissions.ts) —
 * при «Сохранить» PermissionsEditor собирает грубый набор и зовёт setStaffPermissions() (F-10-072/074).
 * Тексты — сразу на ru/en (это внутренний каталог названий, не messages/*.json: 207 строк одним файлом
 * проще держать в синхронизации созданием пар, чем 3 словаря по 200+ ключей; заголовки групп и текст
 * экрана — через messages/staff.json как обычно).
 */
import type { Permission } from '@/config/permissions';

export type PermGroupId =
  | 'journal'
  | 'booking'
  | 'finance'
  | 'stock'
  | 'staffGroup'
  | 'services'
  | 'notify'
  | 'settingsGroup'
  | 'clients'
  | 'reports'
  | 'loyalty'
  | 'subscription'
  | 'online'
  | 'medical';

export interface FinePermissionItem {
  id: string;
  group: PermGroupId;
  label: { ru: string; en: string };
  /** Грубое право фундамента, к которому сводится эта строка при сохранении */
  perm: Permission;
  /** Родитель — без него строка неактивна (F-10-073) */
  requires?: string;
  /** Скрыта под «Дополнительные», пока группа не раскрыта до конца (F-10-065) */
  advanced?: boolean;
}

export interface FinePermGroup {
  id: PermGroupId;
  titleKey: string;
  /** Только когда у сферы есть эта функция (F-10-160) */
  sphereFeature?: 'medicalRecords';
}

export const PERMISSION_GROUPS: FinePermGroup[] = [
  { id: 'journal', titleKey: 'journal' },
  { id: 'booking', titleKey: 'booking' },
  { id: 'finance', titleKey: 'finance' },
  { id: 'stock', titleKey: 'stock' },
  { id: 'staffGroup', titleKey: 'staffGroup' },
  { id: 'services', titleKey: 'services' },
  { id: 'notify', titleKey: 'notify' },
  { id: 'settingsGroup', titleKey: 'settingsGroup' },
  { id: 'clients', titleKey: 'clients' },
  { id: 'reports', titleKey: 'reports' },
  { id: 'loyalty', titleKey: 'loyalty' },
  { id: 'subscription', titleKey: 'subscription' },
  { id: 'online', titleKey: 'online' },
  { id: 'medical', titleKey: 'medical', sphereFeature: 'medicalRecords' },
];

let n = 0;
function row(
  group: PermGroupId,
  ru: string,
  en: string,
  perm: Permission,
  opts: { requires?: string; advanced?: boolean } = {},
): FinePermissionItem {
  n += 1;
  const id = `${group}.p${n}`;
  return { id, group, label: { ru, en }, perm, ...opts };
}

/** Пара «Просматривать / Изменять» на одно понятие — самый частый случай в реальных каталогах прав */
function pair(
  group: PermGroupId,
  ru: string,
  en: string,
  viewPerm: Permission,
  editPerm: Permission,
): FinePermissionItem[] {
  const view = row(group, `Просматривать ${ru}`, `View ${en}`, viewPerm);
  const edit = row(group, `Изменять ${ru}`, `Edit ${en}`, editPerm, { requires: view.id, advanced: true });
  return [view, edit];
}

// ─────────────────────────── Журнал записей (8) F-10-076 ───────────────────────────
const journal: FinePermissionItem[] = [
  row('journal', 'Открывать журнал записей', 'Open the booking log', 'journal.view'),
  row('journal', 'Видеть записи всех сотрудников', 'See all staff bookings', 'journal.others', { requires: 'journal.p1' }),
  row('journal', 'Создавать запись кликом по ячейке', 'Create booking from a cell', 'journal.create', { requires: 'journal.p1' }),
  row('journal', 'Переносить и растягивать записи', 'Move and resize bookings', 'journal.reschedule', { requires: 'journal.p1' }),
  row('journal', 'Менять статус записи', 'Change booking status', 'journal.edit', { requires: 'journal.p1' }),
  row('journal', 'Видеть сводку дня (выручка, оплаты)', 'See the day summary', 'journal.stats', { requires: 'journal.p1' }),
  row('journal', 'Печатать журнал за день', 'Print the day log', 'journal.view', { requires: 'journal.p1', advanced: true }),
  row('journal', 'Настраивать вид сетки журнала', 'Configure the grid view', 'journal.edit', { requires: 'journal.p1', advanced: true }),
];
journal[0].id = 'journal.p1'; // якорь для requires выше

// ─────────────────────────── Окно записи (31) F-10-077 ───────────────────────────
const bookingWindowConcepts: [string, string, Permission, Permission][] = [
  ['данные клиента в записи', 'client data in the booking', 'journal.view', 'journal.edit'],
  ['карту клиента из записи', "client's card from the booking", 'clients.view', 'clients.edit'],
  ['историю визитов клиента', "client's visit history", 'clients.view', 'clients.view'],
  ['телефон клиента в записи', "client's phone in the booking", 'clients.phones', 'clients.phones'],
  ['услуги в записи', 'services in the booking', 'journal.view', 'journal.edit'],
  ['товары, списанные на запись', 'items used in the booking', 'stock.view', 'stock.edit'],
  ['скидку на запись', 'discount on the booking', 'finance.view', 'finance.edit'],
  ['способ оплаты записи', 'booking payment method', 'finance.view', 'finance.edit'],
  ['предоплату записи', "booking's prepayment", 'finance.view', 'finance.edit'],
  ['комментарий администратора', "admin's note", 'journal.view', 'journal.edit'],
  ['комментарий клиента', "client's note", 'journal.view', 'journal.edit'],
  ['напоминания по записи', 'booking reminders', 'notify.manage', 'notify.manage'],
  ['мастера в записи', 'staff member on the booking', 'journal.view', 'journal.reschedule'],
  ['длительность записи', 'booking duration', 'journal.view', 'journal.edit'],
  ['источник записи', 'booking source', 'journal.view', 'journal.view'],
];
const booking: FinePermissionItem[] = bookingWindowConcepts.flatMap(([ru, en, v, e]) => pair('booking', ru, en, v, e));
booking.push(row('booking', 'Печатать наряд по записи', 'Print the work order', 'journal.view', { advanced: true }));
// F-10-144: без права сотрудник филиала не видит визиты и покупки клиента в других филиалах сети (⭐ F-00-050)
booking.push(row('booking', 'Доступ к данным клиентов по сети', "Client data access across the network's locations", 'clients.view', { advanced: true }));

// ─────────────────────────── Финансы (36) F-10-078 ───────────────────────────
const financeConcepts: [string, string][] = [
  ['кассовую смену', 'cash shift'],
  ['операции по кассе', 'cash register operations'],
  ['возвраты', 'refunds'],
  ['расходы', 'expenses'],
  ['переводы между кассами', 'transfers between registers'],
  ['долги клиентов', "clients' debts"],
  ['скидки на услуги', 'discounts on services'],
  ['способы оплаты', 'payment methods'],
  ['отчёт по выручке', 'revenue report'],
  ['закрытие смены', 'shift closing'],
  ['курсы валют', 'exchange rates'],
  ['чаевые', 'tips'],
  ['предоплаты', 'prepayments'],
  ['сверку кассы', 'cash reconciliation'],
  ['финансовые категории', 'finance categories'],
  ['банковские платежи', 'card payments'],
  ['инкассацию', 'cash collection'],
  ['корректировки баланса', 'balance adjustments'],
];
// Владелец, 01.10.2026: смена и её закрытие — отдельное право finance.shift (админ-кассир без остальных финансов)
const SHIFT_CONCEPTS = new Set(['кассовую смену', 'закрытие смены']);
const finance: FinePermissionItem[] = financeConcepts.flatMap(([ru, en]) =>
  SHIFT_CONCEPTS.has(ru) ? pair('finance', ru, en, 'finance.shift', 'finance.shift') : pair('finance', ru, en, 'finance.view', 'finance.edit'),
);

// ─────────────────────────── Товары (39) F-10-079 ───────────────────────────
const stockConcepts: [string, string][] = [
  ['остатки товаров', 'stock balances'],
  ['приход товара', 'stock receiving'],
  ['списание товара', 'stock write-off'],
  ['инвентаризацию', 'inventory count'],
  ['перемещение между складами', 'transfer between warehouses'],
  ['возврат поставщику', 'return to supplier'],
  ['себестоимость', 'cost price'],
  ['единицы измерения', 'units of measure'],
  ['категории товаров', 'item categories'],
  ['поставщиков', 'suppliers'],
  ['закупочные цены', 'purchase prices'],
  ['розничные цены', 'retail prices'],
  ['минимальные остатки', 'minimum stock levels'],
  ['техкарты расхода', 'consumption recipes'],
  ['складские отчёты', 'stock reports'],
  ['штрихкоды товаров', 'item barcodes'],
  ['серийные номера', 'serial numbers'],
  ['сроки годности', 'expiry dates'],
  ['списание на процедуру', 'write-off per service'],
];
const stock: FinePermissionItem[] = stockConcepts.flatMap(([ru, en]) => pair('stock', ru, en, 'stock.view', 'stock.edit'));
stock.push(row('stock', 'Корректировать остатки вручную', 'Adjust stock manually', 'stock.edit', { advanced: true }));

// ─────────────────────────── Сотрудники (8) F-10-080 ───────────────────────────
const staffGroup: FinePermissionItem[] = [
  row('staffGroup', 'Список сотрудников', 'Staff list', 'staff.view'),
  row('staffGroup', 'Карточки сотрудников', 'Staff cards', 'staff.view'),
  row('staffGroup', 'Телефоны сотрудников', 'Staff phone numbers', 'staff.view', { advanced: true }),
  row('staffGroup', 'Добавлять и увольнять сотрудников', 'Add and dismiss staff', 'staff.manage'),
  row('staffGroup', 'Доступ сотрудников в кабинет', "Staff cabinet access", 'staff.manage'),
  row('staffGroup', 'Роли и права сотрудников', 'Staff roles and permissions', 'staff.manage', { advanced: true }),
  row('staffGroup', 'График работы сотрудников', 'Staff work schedule', 'schedule.edit'),
  row('staffGroup', 'Расчёт зарплаты сотрудников', 'Staff payroll', 'payroll.manage', { advanced: true }),
];

// ─────────────────────────── Услуги (12) F-10-081 ───────────────────────────
const services: FinePermissionItem[] = [
  ...pair('services', 'каталог услуг', 'service catalog', 'services.view', 'services.edit'),
  ...pair('services', 'категории услуг', 'service categories', 'services.view', 'services.edit'),
  ...pair('services', 'цены и длительность услуг', 'prices and duration', 'services.view', 'services.edit'),
  ...pair('services', 'показ услуг в онлайн-записи', 'services shown in online booking', 'services.view', 'online.manage'),
  ...pair('services', 'состав услуги (товары, время мастера)', 'service composition', 'services.view', 'services.edit'),
  ...pair('services', 'фото и описание услуг', 'photos and descriptions', 'services.view', 'services.edit'),
];

// ─────────────────────────── Уведомления (2) F-10-082 ───────────────────────────
const notify: FinePermissionItem[] = [
  row('notify', 'Рассылки клиентам', 'Client mailings', 'notify.mailings'),
  row('notify', 'Журнал отправленных уведомлений', 'Sent notifications log', 'notify.log'),
];

// ─────────────────────────── Настройки (10) F-10-083 ───────────────────────────
const settingsGroup: FinePermissionItem[] = [
  row('settingsGroup', 'Настройки филиала', 'Location settings', 'settings.manage'),
  row('settingsGroup', 'Часовой пояс и рабочие часы', 'Timezone and hours', 'settings.manage'),
  row('settingsGroup', 'Название, логотип и бренд', 'Name, logo and brand', 'settings.manage'),
  row('settingsGroup', 'Способы оплаты по умолчанию', 'Default payment methods', 'settings.manage', { advanced: true }),
  row('settingsGroup', 'Правила отмены и переноса', 'Cancellation rules', 'settings.manage'),
  row('settingsGroup', 'Подписку и тариф', 'Subscription and plan', 'billing.manage'),
  row('settingsGroup', 'Интеграции', 'Integrations', 'integrations.manage', { advanced: true }),
  // F-13-024, F-13-067 (integrations, второй проход 26.09): отдельное право на страницу вебхуков —
  // раньше пряталось за общим 'integrations.manage', ТЗ требует отдельную галочку.
  row('settingsGroup', 'Изменение настроек WebHook', 'Webhook settings', 'integrations.webhooksEdit', { advanced: true }),
  row('settingsGroup', 'Сеть филиалов', 'Location network', 'network.manage', { advanced: true }),
  row('settingsGroup', 'Журнал безопасности бизнеса', 'Business security log', 'settings.manage', { advanced: true }),
  row('settingsGroup', 'Удаление бизнеса', 'Deleting the business', 'settings.manage', { advanced: true }),
];

// ─────────────────────────── Клиентская база (26) F-10-084 ───────────────────────────
const clientsConcepts: [string, string, Permission, Permission][] = [
  ['базу клиентов', 'client base', 'clients.view', 'clients.edit'],
  ['телефоны клиентов', "clients' phone numbers", 'clients.phones', 'clients.phones'],
  ['карточку клиента', "client's card", 'clients.view', 'clients.edit'],
  ['историю визитов клиента', "client's visit history", 'clients.view', 'clients.view'],
  ['заметки о клиенте', 'notes about the client', 'clients.view', 'clients.edit'],
  ['файлы клиента', "client's files", 'clients.view', 'clients.edit'],
  ['сегменты клиентов', 'client segments', 'clients.view', 'clients.edit'],
  ['рассылочные списки', 'mailing lists', 'clients.view', 'notify.mailings'],
  ['дубликаты клиентов', 'duplicate clients', 'clients.view', 'clients.edit'],
  ['согласия клиента', "client's consents", 'clients.view', 'clients.edit'],
  ['чёрный список клиентов', 'client blocklist', 'clients.view', 'clients.edit'],
  ['экспорт базы клиентов', 'client base export', 'clients.export', 'clients.export'],
  ['удаление клиентов', 'deleting clients', 'clients.view', 'clients.delete'],
];
const clients: FinePermissionItem[] = clientsConcepts.flatMap(([ru, en, v, e]) => pair('clients', ru, en, v, e));
// F-10-094: без права фамилия сокращается до буквы, отчество скрыто везде, не только в базе
clients.push(
  row('clients', 'Фамилию и отчество клиента', "Client's last and middle name", 'clients.view'),
);
// F-10-095: ▾ «Всех сотрудников» (по умолчанию) / только клиенты, побывавшие у этого сотрудника (⭐ F-00-065)
clients.push(
  row('clients', 'Клиентов только своих (не всех сотрудников)', 'Only own clients (not every staff member’s)', 'clients.view', {
    advanced: true,
  }),
);

// ─────────────────────────── Отчёты (25) F-10-085 ───────────────────────────
const reportNames: [string, string][] = [
  ['по выручке', 'revenue report'],
  ['по кассе', 'cash register report'],
  ['по услугам', 'services report'],
  ['по товарам', 'stock report'],
  ['по сотрудникам', 'staff report'],
  ['по клиентам', 'clients report'],
  ['по загрузке журнала', 'utilisation report'],
  ['по конверсии записи', 'booking conversion report'],
  ['по отменам записей', 'cancellations report'],
  ['по возвратам', 'refunds report'],
  ['по зарплате', 'payroll report'],
  ['по программе лояльности', 'loyalty report'],
  ['по маркетингу', 'marketing report'],
  ['по абонементам', 'subscriptions report'],
  ['по сертификатам', 'gift cards report'],
  ['по онлайн-записи', 'online booking report'],
  ['по рекламным источникам', 'ad sources report'],
  ['по чаевым', 'tips report'],
  ['по среднему чеку', 'average bill report'],
  ['по повторным визитам', 'repeat visits report'],
  ['по новым клиентам', 'new clients report'],
  ['по оттоку клиентов', 'client churn report'],
  ['по прибыли', 'profit report'],
  ['по расходам', 'expenses report'],
  ['сводный отчёт по бизнесу', 'business summary report'],
];
const reports: FinePermissionItem[] = reportNames.map(([ru, en]) => row('reports', `Отчёт ${ru}`, `Report ${en}`, 'reports.view'));

// ─────────────────────────── Лояльность (8) F-10-086 ───────────────────────────
const loyalty: FinePermissionItem[] = [
  row('loyalty', 'Программы лояльности', 'Loyalty programs', 'loyalty.manage'),
  row('loyalty', 'Бонусные баллы клиентов', "Clients' bonus points", 'loyalty.manage'),
  row('loyalty', 'Скидочные карты', 'Discount cards', 'loyalty.manage'),
  row('loyalty', 'Абонементы', 'Subscriptions (packages)', 'loyalty.manage'),
  row('loyalty', 'Подарочные сертификаты', 'Gift certificates', 'loyalty.manage'),
  row('loyalty', 'Реферальную программу', 'Referral program', 'loyalty.manage', { advanced: true }),
  row('loyalty', 'Акции и промокоды', 'Promotions and promo codes', 'loyalty.manage'),
  row('loyalty', 'Правила начисления бонусов', 'Bonus accrual rules', 'loyalty.rules', { advanced: true }),
];

/**
 * F-06-175 (точечная правка CONVENTIONS §1 третий проход, qa/requests/loyalty.md 2026-09-25): 8 галочек
 * «Лояльность» уровня локации из ТЗ Altegio («Сотрудники → сотрудник → Доступ»), отдельно от настроечных
 * F-10-086 выше (те решают, КАКИЕ программы сотрудник видит/настраивает; эти — что он может делать с уже
 * настроенной лояльностью при обслуживании клиента). Все, кроме «Оплата без кода», сведены к тому же
 * `loyalty.manage` — отдельных коарс-прав фундамента на каждую из семи операций нет (архитектурно они
 * всегда идут вместе с базовым доступом к разделу), «Оплата без кода» — единственная из восьми, у которой
 * есть настоящий отдельный гейт (`loyalty.applyWithoutCode`, реально проверяется в LoyaltyPaymentPanel).
 */
const loyaltyStaffAccess: FinePermissionItem[] = [
  row('loyalty', 'Выдача и удаление карт лояльности клиента', "Issuing and deleting client's loyalty cards", 'loyalty.manage', { advanced: true }),
  row('loyalty', 'Ручное пополнение/списание с карт лояльности', 'Manual top-up/charge-off on loyalty cards', 'loyalty.manage', { advanced: true }),
  row('loyalty', 'Редактирование баланса абонементов', "Editing subscriptions' balance", 'loyalty.manage', { advanced: true }),
  row('loyalty', 'Редактирование срока действия абонементов', "Editing subscriptions' expiry date", 'loyalty.manage', { advanced: true }),
  row('loyalty', 'Просмотр истории абонементов', 'Viewing subscription history', 'loyalty.manage', { advanced: true }),
  row('loyalty', 'Редактирование баланса сертификатов', "Editing certificates' balance", 'loyalty.manage', { advanced: true }),
  row('loyalty', 'Редактирование срока действия сертификатов', "Editing certificates' expiry date", 'loyalty.manage', { advanced: true }),
  row('loyalty', 'Оплата сертификатом и абонементом без кода', 'Paying with a certificate/subscription without a code', 'loyalty.applyWithoutCode', { advanced: true }),
];
loyalty.push(...loyaltyStaffAccess);

// ─────────────────────────── Подписка (1) F-10-087, Онлайн-запись (1) F-10-088 ───────────────────────────
const subscription: FinePermissionItem[] = [row('subscription', 'Подписку салона', "Salon's subscription", 'billing.manage')];
const online: FinePermissionItem[] = [row('online', 'Настройки онлайн-записи', 'Online booking settings', 'online.manage')];

// ─────────────────────────── Медицинские документы (F-10-160, только dental) ───────────────────────────
const medical: FinePermissionItem[] = [
  row('medical', 'Медицинские карты пациентов', "Patients' medical records", 'clients.view'),
  row('medical', 'Историю лечения', 'Treatment history', 'clients.view'),
  row('medical', 'План лечения', 'Treatment plan', 'clients.edit'),
  row('medical', 'Рентген-снимки и изображения', 'X-rays and images', 'clients.view', { advanced: true }),
  row('medical', 'Согласия на лечение', 'Treatment consents', 'clients.edit'),
  row('medical', 'Диагнозы', 'Diagnoses', 'clients.edit', { advanced: true }),
  row('medical', 'Назначения врача', "Doctor's prescriptions", 'clients.edit', { advanced: true }),
  row('medical', 'Аллергии и противопоказания', 'Allergies and contraindications', 'clients.view'),
  row('medical', 'Печать эпикриза', 'Print discharge summary', 'clients.view', { advanced: true }),
];

export const ALL_FINE_PERMISSIONS: FinePermissionItem[] = [
  ...journal,
  ...booking,
  ...finance,
  ...stock,
  ...staffGroup,
  ...services,
  ...notify,
  ...settingsGroup,
  ...clients,
  ...reports,
  ...loyalty,
  ...subscription,
  ...online,
  ...medical,
];

/** 4 отдельных переключателя вне групп (F-10-089) */
export const STANDALONE_PERMISSIONS: FinePermissionItem[] = [
  { id: 'standalone.reportAmounts', group: 'reports', label: { ru: 'Видеть суммы в отчётах', en: 'See amounts in reports' }, perm: 'finance.view' },
  { id: 'standalone.othersDefault', group: 'journal', label: { ru: 'Работать с записями всех по умолчанию', en: "Work with everyone's bookings by default" }, perm: 'journal.others' },
  { id: 'standalone.onlineNotify', group: 'notify', label: { ru: 'Получать уведомления о новой онлайн-записи', en: 'Get notified about new online bookings' }, perm: 'online.own' },
  { id: 'standalone.multiDevice', group: 'settingsGroup', label: { ru: 'Вход с нескольких устройств одновременно', en: 'Sign in from several devices at once' }, perm: 'settings.manage' },
  // F-11-039: отдельный тумблер «Добавление локации в сети», вне групп (у владельца включён по умолчанию)
  { id: 'standalone.networkAddLocation', group: 'settingsGroup', label: { ru: 'Добавление локации в сети', en: 'Adding a location to the network' }, perm: 'network.addLocation' },
];

export function groupItems(groupId: PermGroupId): FinePermissionItem[] {
  return ALL_FINE_PERMISSIONS.filter((p) => p.group === groupId);
}

export function findFinePermission(id: string): FinePermissionItem | undefined {
  return ALL_FINE_PERMISSIONS.find((p) => p.id === id) ?? STANDALONE_PERMISSIONS.find((p) => p.id === id);
}

/** Сводит выбранные тонкие права к грубому набору фундамента (F-10-072) */
export function reduceToCoarse(fineIds: readonly string[]): Permission[] {
  const set = new Set<Permission>();
  for (const id of fineIds) {
    const item = findFinePermission(id);
    if (item) set.add(item.perm);
  }
  return [...set];
}

export const TOTAL_FINE_COUNT = ALL_FINE_PERMISSIONS.length + STANDALONE_PERMISSIONS.length;

/** Тонкие права, чей грубый эквивалент входит в набор (используется «как в шаблоне», F-10-066/067) */
export function fineIdsForCoarse(coarse: readonly Permission[]): string[] {
  const set = new Set(coarse);
  return [...ALL_FINE_PERMISSIONS, ...STANDALONE_PERMISSIONS].filter((p) => set.has(p.perm)).map((p) => p.id);
}
