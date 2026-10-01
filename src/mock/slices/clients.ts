import type {
  AppActivity,
  BookingReminder,
  BookingWindowSection,
  BroadcastMessage,
  Certificate,
  ClientCall,
  ClientChangeLogEntry,
  ClientComment,
  ClientFile,
  ClientProfile,
  ClientsFineRights,
  ClientsBizSettings,
  ColumnsPrefs,
  ExportLogEntry,
  ImportanceClass,
  ImportRunSummary,
  LoyaltyProgram,
  ProductPurchase,
  Subscription,
} from '@/domain/clients';
import { DEFAULT_BOOKING_WINDOW_FAVORITES, defaultBizSettings, emptyLoyaltyProgram, IMPORTANCE_CLASSES, visitKey } from '@/domain/clients';
import type { CoreData, Id, ISODate, ISODateTime, Money } from '@/domain/core';
import { EMPTY_BIZ_IDS } from '@/mock/seed/ids';
import { defineSlice } from '@/mock/slice';
import { toISODate, dayjs } from '@/lib/date';

/**
 * Срез моковой базы раздела «clients». Принадлежит разделу.
 *
 * Что тут, а не в ядре: профиль клиента (скидка, класс важности, номер карты, «Оплачено», фамилия/
 * отчество, доп. телефон, фото), настройки колонок таблицы (F-04-004/005), автосохранение лидов из
 * чата (F-04-016/187), комментарии к клиенту (F-04-070), доп. поля клиента (F-04-060), активность
 * в приложении (F-04-072) и черновые сертификаты/абонементы/покупки товаров — пока раздел loyalty
 * не построил настоящие (нужны только чтобы 13 подфильтров «По продажам», F-04-035, реально
 * фильтровали список; см. qa/requests/clients.md).
 */
export interface ClientsState {
  profiles: Record<Id, ClientProfile>;
  /** Колонки таблицы — у каждого сотрудника бизнеса свои; ключ `${businessId}|${staffId}` (arch-a1 №2) */
  columns: Record<string, ColumnsPrefs>;
  /** Настройки базы по businessId (arch-a1 №2): лиды из чата, порог «давно не были», ФИО, доп. поля */
  settings: Record<Id, ClientsBizSettings>;
  /** Даты рассылок (пушей), которые клиент получил (F-04-032) */
  broadcastHistory: Record<Id, ISODate[]>;
  /** Журнал отправленных массовых рассылок — «отправленное видно в отчёте сообщений» (F-04-038) */
  messageLog: BroadcastMessage[];
  certificates: Certificate[];
  subscriptions: Subscription[];
  productPurchases: ProductPurchase[];
  customFieldValues: Record<Id, Record<string, string>>;
  /** F-04-070 */
  comments: Record<Id, ClientComment[]>;
  /** F-04-072: только у клиентов с appUserId */
  appActivity: Record<Id, AppActivity>;
  /** F-04-086 */
  files: Record<Id, ClientFile[]>;
  /** F-00-130: когда мастер позвал старую базу в приложение */
  invitedAt: Record<Id, ISODateTime>;
  /**
   * F-04-076/167/179: сумма и способ оплаты по конкретному визиту (ключ — id записи или visitId группы).
   * Визит «Пришёл» без строки здесь считается оплаченным полностью (правило — `visitPaid` в domain/clients/money) —
   * настоящую разноску платежей по визитам строит раздел finance (см. qa/requests/clients.md).
   */
  manualVisitPayments: Record<Id, { paidAmount: Money; method?: string }>;
  /** F-04-041: цвет категории, созданной прямо из массового действия (полный справочник — b04) */
  categoryColors: Record<Id, Record<string, string>>;
  /** F-04-079: демо-звонки — телефония нигде не подключена */
  calls: Record<Id, ClientCall[]>;
  /** F-04-093: разделы мини-карточки в окне записи, отмеченные звездой (плитки быстрого доступа) */
  bookingWindowFavorites: BookingWindowSection[];
  /** F-04-114…122, 158: «Программа лояльности» локации — по business.id, выключена по умолчанию */
  loyaltyPrograms: Record<Id, LoyaltyProgram>;
  /** F-04-126…129: последние прогоны импорта Excel — «Операции с Excel» / «Операции с данными» */
  importRuns: ImportRunSummary[];
  /** F-04-130: журнал выгрузок в Excel */
  exportLog: ExportLogEntry[];
  /**
   * ⭐ F-00-040 → F-04-137: журнал изменений клиентов бизнеса — правка, удаление, объединение;
   * по businessId, а не clientId, чтобы запись об удалении не пропадала вместе с самим клиентом.
   */
  changeLog: Record<Id, ClientChangeLogEntry[]>;
  /**
   * ⭐ F-04-194…204: 26 тонких прав раздела «Клиентская база» по сотруднику — тоньше, чем есть в
   * фундаментальных clients.view/phones/edit/export/delete (просьба к ядру — qa/requests/clients.md).
   * Отсутствующий ключ у сотрудника = взять по умолчанию для его роли (см. defaultAdminFineRights/
   * defaultMasterFineRights в src/domain/clients.ts) — владелец/сеть/индивидуал всегда все права.
   */
  staffRights: Record<Id, Partial<ClientsFineRights>>;
  /** F-04-100: своё напоминание и свой срок приглашения на повторный визит для ОДНОЙ записи, ключ — bookingId */
  bookingReminders: Record<Id, BookingReminder>;
}

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

const PRODUCT_NAMES = ['Шампунь для роста', 'Крем для рук', 'Воск для укладки', 'Маска для лица', 'Лак для ногтей'];
const CERT_NAMES = ['Подарочный сертификат 15 000 ֏', 'Подарочный сертификат 30 000 ֏', 'Сертификат «День красоты»'];
const SUB_NAMES = ['Абонемент на маникюр × 5', 'Абонемент на стрижку × 8', 'Безлимит на месяц'];
const LAST_NAMES = ['Арутюнян', 'Саргсян', 'Петросян', 'Григорян', 'Аветисян', 'Мартиросян'];
const MIDDLE_NAMES = ['Ашотовна', 'Гагикович', 'Самвеловна', 'Артёмович', 'Вааговна'];
const COMMENT_TEMPLATES = ['Любит крепкий кофе перед процедурой', 'Просила звонить, а не писать', 'Аллергия на лак с ацетоном — уточнять'];

function seed(core: CoreData, now: Date): ClientsState {
  const profiles: Record<Id, ClientProfile> = {};
  const broadcastHistory: Record<Id, ISODate[]> = {};
  const certificates: Certificate[] = [];
  const subscriptions: Subscription[] = [];
  const productPurchases: ProductPurchase[] = [];
  const comments: Record<Id, ClientComment[]> = {};
  const appActivity: Record<Id, AppActivity> = {};
  const calls: Record<Id, ClientCall[]> = {};
  const manualVisitPayments: Record<Id, { paidAmount: Money; method?: string }> = {};
  const today = dayjs(now);

  core.clients.forEach((client, index) => {
    const h = hashId(client.id);
    const arrived = core.bookings
      .filter((b) => b.clientId === client.id && b.status === 'arrived' && !b.deletedAt)
      .sort((a, b) => a.start.localeCompare(b.start));

    const discountOptions = [0, 0, 0, 5, 5, 10, 15];
    const discountPercent = discountOptions[h % discountOptions.length];

    const importanceRoll = h % 5;
    const importanceClass: ImportanceClass | undefined = importanceRoll < IMPORTANCE_CLASSES.length ? IMPORTANCE_CLASSES[importanceRoll] : undefined;

    const cardNumber = h % 3 === 0 ? `CARD-${String(index + 1).padStart(4, '0')}` : undefined;

    // Деньги (demo-q2/q3, ux-r1 №11): у большинства всё оплачено ровно; примерно у каждого восьмого — аванс
    // 2 000–5 000 ֏ на счёте; примерно у каждого двенадцатого — недоплата за последний визит 2 000–9 000 ֏.
    // paidAmount в профиле — только то, что внесено СВЕРХ оплат визитов (правило — domain/clients/money).
    const paidAmount = h % 8 === 3 ? 2000 + (h % 4) * 1000 : 0;
    const last = arrived[arrived.length - 1];
    if (last && h % 12 === 5) {
      const key = visitKey(last);
      const groupTotal = arrived.filter((b) => visitKey(b) === key).reduce((sum, b) => sum + b.total, 0);
      manualVisitPayments[key] = { paidAmount: Math.max(0, groupTotal - (2000 + (h % 8) * 1000)), method: 'cash' };
    }

    const lastName = h % 2 === 0 ? LAST_NAMES[h % LAST_NAMES.length] : undefined;
    const middleName = h % 4 === 0 ? MIDDLE_NAMES[h % MIDDLE_NAMES.length] : undefined;
    const additionalPhone = h % 9 === 0 ? `+37411${String(200000 + (h % 700000)).padStart(6, '0')}` : undefined;
    // F-04-192: демо-заполнение у части клиентов (необязательное поле, интеграция с медсистемой не решена)
    const nationalId =
      h % 11 === 0
        ? String(1000000000 + (h % 899999999))
            .slice(0, 12)
            .padEnd(12, '0')
        : undefined;
    // F-04-153/227: демо-согласие — часть дала согласие через виджет, часть отказалась явно, часть — не спрашивали
    const adConsent =
      h % 3 === 0
        ? { given: true, at: toISODate(today.subtract(10 + (h % 200), 'day')) + 'T10:00', method: 'widget' as const }
        : h % 7 === 0
          ? { given: false, at: toISODate(today.subtract(5 + (h % 60), 'day')) + 'T10:00', method: 'paper' as const, recordedBy: 'Администратор' }
          : undefined;
    // F-04-228: у клиентов из приложения язык берётся из appUser — тут задаём только CRM-клиентам без него
    const locale = !client.appUserId && h % 6 === 0 ? (['ru', 'en', 'hy'] as const)[h % 3] : undefined;
    // F-04-066: заметка «Просит не звонить — только WhatsApp» (core-сид) без структурного поля раньше
    // ничего не меняла — первой кнопкой всё равно оставался звонок. Демо-профиль читает эту же заметку.
    const preferredContact: 'call' | 'wa' | 'tg' | 'viber' = client.note?.includes('только WhatsApp')
      ? 'wa'
      : client.note?.toLowerCase().includes('telegram')
        ? 'tg'
        : 'call';

    profiles[client.id] = {
      discountPercent,
      importanceClass,
      cardNumber,
      paidAmount,
      lastName,
      middleName,
      additionalPhone,
      importedSold: 0,
      nationalId,
      adConsent,
      birthdayGreetingOptOut: h % 13 === 0,
      locale,
      preferredContact,
    };

    if (h % 8 === 0) {
      comments[client.id] = [
        {
          id: `cm_${client.id}_1`,
          clientId: client.id,
          authorId: core.staff[h % Math.max(core.staff.length, 1)]?.id ?? 'st_seed',
          authorName: core.staff[h % Math.max(core.staff.length, 1)]?.name ?? 'Администратор',
          text: COMMENT_TEMPLATES[h % COMMENT_TEMPLATES.length],
          createdAt: today.subtract(5 + (h % 30), 'day').format('YYYY-MM-DDTHH:mm'),
        },
      ];
    }

    if (client.appUserId) {
      appActivity[client.id] = {
        platform: h % 2 === 0 ? 'ios' : 'android',
        lastUsedAt: today.subtract(h % 14, 'day').format('YYYY-MM-DDTHH:mm'),
      };
    }

    if (h % 3 === 0) {
      broadcastHistory[client.id] = [
        toISODate(today.subtract(20 + (h % 40), 'day')),
        ...(h % 6 === 0 ? [toISODate(today.subtract(70 + (h % 30), 'day'))] : []),
      ];
    }

    if (h % 7 === 0) {
      const total = 15000 + (h % 3) * 15000;
      const used = h % 2 === 0;
      certificates.push({
        id: `cert_${client.id}`,
        businessId: client.businessId,
        clientId: client.id,
        name: CERT_NAMES[h % CERT_NAMES.length],
        total,
        balance: used ? 0 : total,
        soldAt: toISODate(today.subtract(10 + (h % 60), 'day')),
        expiresAt: toISODate(today.add(h % 9 === 0 ? 5 : 30 + (h % 90), 'day')),
        code: `CERT-${String(1000 + (h % 9000)).padStart(4, '0')}`,
      });
    }

    if (h % 6 === 0) {
      const totalVisits = 5 + (h % 3) * 3;
      const remaining = h % 8 === 0 ? 0 : h % 5;
      subscriptions.push({
        id: `sub_${client.id}`,
        businessId: client.businessId,
        clientId: client.id,
        name: SUB_NAMES[h % SUB_NAMES.length],
        status: h % 8 === 0 ? 'expired' : 'active',
        frozen: h % 11 === 0,
        soldAt: toISODate(today.subtract(15 + (h % 60), 'day')),
        expiresAt: toISODate(today.add(h % 10 === 0 ? 3 : 20 + (h % 60), 'day')),
        totalVisits,
        remainingVisits: remaining,
        code: `SUB-${String(1000 + (h % 9000)).padStart(4, '0')}`,
      });
    }

    if (h % 4 === 0) {
      const n = 1 + (h % 3);
      calls[client.id] = Array.from({ length: n }, (_, i) => {
        const roll = (h + i) % 5;
        const direction = roll === 0 ? 'missed' : roll % 2 === 0 ? 'incoming' : 'outgoing';
        return {
          id: `call_${client.id}_${i}`,
          clientId: client.id,
          direction,
          at: today.subtract(2 + i * 5 + (h % 10), 'day').format('YYYY-MM-DDTHH:mm'),
          durationSec: direction === 'missed' ? 0 : 30 + ((h + i * 17) % 240),
          hasRecording: direction !== 'missed' && (h + i) % 3 === 0,
        };
      });
    }

    if (h % 5 === 0) {
      productPurchases.push({
        id: `pp_${client.id}`,
        businessId: client.businessId,
        clientId: client.id,
        productName: PRODUCT_NAMES[h % PRODUCT_NAMES.length],
        boughtAt: toISODate(today.subtract(5 + (h % 45), 'day')),
      });
    }
  });

  // Э4 (clients-review 27.09.2026): «Журнал изменений» пустой в демо — несколько правок на бизнес, чтобы
  // экран показывал, как это выглядит (edit/merge/delete, ⭐ F-00-040 → F-04-137). «Объединён» и «Удалён»
  // указывают на id, которого больше нет в базе — так и должно быть, журнал переживает удалённого клиента:
  // ClientCardScreen отдаёт для такого id «карточка удалена», а не падает (rowQ.isError → isDeleted).
  const changeLog: Record<Id, ClientChangeLogEntry[]> = {};
  core.businesses.forEach((b) => {
    const firstClient = core.clients.find((c) => c.businessId === b.id && !c.deletedAt);
    const authorName = core.staff.find((s) => s.businessId === b.id)?.name ?? 'Администратор';
    const entries: ClientChangeLogEntry[] = [];
    if (firstClient) {
      entries.push({
        id: `cchg_${b.id}_1`,
        clientId: firstClient.id,
        clientName: firstClient.name,
        action: 'updated',
        authorId: 'system',
        authorName,
        summary: 'phone,email',
        at: today.subtract(2, 'day').format('YYYY-MM-DDTHH:mm'),
      });
    }
    entries.push({
      id: `cchg_${b.id}_2`,
      clientId: `seed_merged_${b.id}`,
      clientName: 'Диана Оганесян',
      action: 'merged',
      authorId: 'system',
      authorName,
      summary: firstClient?.name ?? 'Диана О.',
      at: today.subtract(6, 'day').format('YYYY-MM-DDTHH:mm'),
    });
    entries.push({
      id: `cchg_${b.id}_3`,
      clientId: `seed_deleted_${b.id}`,
      clientName: 'Тигран Малхасян',
      action: 'deleted',
      authorId: 'system',
      authorName,
      summary: '',
      at: today.subtract(11, 'day').format('YYYY-MM-DDTHH:mm'),
    });
    changeLog[b.id] = entries;
  });

  const loyaltyPrograms: Record<Id, LoyaltyProgram> = {};
  core.businesses.forEach((b) => {
    const program = emptyLoyaltyProgram();
    // Примеры порогов из справки Altegio — заполнены, но правило выключено (enabled: false),
    // поэтому «по умолчанию правила выключены» (F-04-114) остаётся верным.
    program.discountTiers = [
      { id: 'dt_sold_1', basis: 'sold', from: 100000, percent: 5 },
      { id: 'dt_visits_1', basis: 'visits', from: 10, percent: 5 },
    ];
    program.classRules = {
      bronze: { minSold: 20000, minVisits: 10 },
      silver: { minSold: 50000, minVisits: 30 },
      gold: { minSold: 100000, minVisits: 50 },
    };
    loyaltyPrograms[b.id] = program;
  });

  return {
    profiles,
    columns: {},
    settings: Object.fromEntries(core.businesses.map((b) => [b.id, defaultBizSettings()])),
    broadcastHistory,
    messageLog: [],
    certificates,
    subscriptions,
    productPurchases,
    customFieldValues: {},
    comments,
    appActivity,
    files: {},
    invitedAt: {},
    manualVisitPayments,
    // F-04-109: «у новой локации уже есть три категории» (цвет — индекс токена chart-N, как в ColorPicker).
    // Регистр ключа должен совпадать с тегом из сида (TAGS в mock/seed/clients.ts использует строчную
    // «постоянный») — иначе «Постоянный»/«постоянный» показывались бы как два разных дубля в справочнике.
    categoryColors: Object.fromEntries(core.businesses.map((b) => [b.id, { VIP: '1', Лояльный: '2', постоянный: '3' }])),
    calls,
    bookingWindowFavorites: DEFAULT_BOOKING_WINDOW_FAVORITES,
    loyaltyPrograms,
    // F-04-206 (g3-1-fix1): один демо-прогон импорта, чтобы «Операции с данными» и её data-f были видны на
    // холодных данных, а не только после реального импорта в этой сессии (раньше секция была условной на
    // непустой список — критерий «Готово, когда» не подтверждался без ручного действия).
    // По одному прогону на каждый бизнес с данными — запись принадлежит бизнесу (businessId); пустые черновики без истории
    importRuns: core.businesses
      .filter((b) => !EMPTY_BIZ_IDS.includes(b.id))
      .map((b) => ({
        id: `imp_seed_${b.id}`,
        businessId: b.id,
        at: today.subtract(9, 'day').format('YYYY-MM-DDTHH:mm'),
        authorName: core.staff.find((x) => x.id === b.ownerStaffId)?.name ?? core.staff.find((x) => x.businessId === b.id)?.name ?? 'Администратор',
        method: 'file' as const,
        totalRows: 18,
        createdCount: 14,
        updatedCount: 3,
        rejectedCount: 1,
      })),
    exportLog: [],
    changeLog,
    staffRights: {},
    bookingReminders: {},
  };
}

export const clientsSlice = defineSlice<ClientsState>({
  // 9: деньги клиента одним правилом (paidAmount = внесено сверх визитов), настройки базы по businessId
  // 10: демо-прогон импорта в сиде (F-04-206) — «Операции с данными» видны без ручного импорта
  // 11: доп. поля с типом/обязательностью/apiKey (F-04-139…145), напоминание+повтор по записи (F-04-100)
  // 12: несколько демо-правок в журнале изменений — экран не пустой на холодных данных (Э4, clients-review)
  // 13: категории и журнал импорта принадлежат бизнесу (categoryColors по businessId, importRuns[].businessId)
  version: 13,
  seed,
});
