import type { CoreData, Id } from '@/domain/core';
import type {
  HelpRequest,
  Invoice,
  LegalInfo,
  LoginEvent,
  MobileAppOrderRequest,
  ModerationRefKey,
  OnboardingInvite,
  PersonalAccount,
  PriceRuleChange,
  RecordCategory,
  SettingsChangeLogEntry,
  SphereRequest,
  Subscription,
  SubscriptionPayment,
  SystemSettings,
  WebhookSettings,
} from '@/domain/settings';
import { toISODate, toISODateTime } from '@/lib/date';
import { newId } from '@/lib/id';
import { BIZ } from '@/mock/seed/ids';
import { defineSlice } from '@/mock/slice';

/**
 * Срез моковой базы раздела «settings». Принадлежит разделу.
 * Подписки, история оплат, счета и реквизиты компании — по businessId ядра. Движок цены и статуса — src/api/settings.ts.
 * Меняете форму — поднимите version.
 */
export interface SettingsState {
  subscriptions: Record<Id, Subscription>;
  payments: SubscriptionPayment[];
  invoices: Invoice[];
  legalInfo: Record<Id, LegalInfo>;
  /** Обращения в поддержку (F-15-001) — «Помощь и поддержка» доступна из хаба настроек на любом бизнесе */
  helpRequests: HelpRequest[];
  /** Заявки «Моей сферы нет» (F-15-005, b02) */
  sphereRequests: SphereRequest[];
  /** Заявки на консультацию по своему приложению салона (F-03-048, F-14-164, F-14-171, В-29) */
  mobileAppOrderRequests: MobileAppOrderRequest[];
  /** Обучающий тур «Структура платформы» уже показывали (F-15-021) — по businessId, нет ключа = не показывали */
  tourSeen: Record<Id, boolean>;
  /** Приглашения по ссылке (F-15-146) — упрощённый мок, см. domain/settings.ts OnboardingInvite */
  invites: OnboardingInvite[];
  /** Основные (системные) настройки компании (F-15-113…117, F-15-030, F-15-136) — по businessId */
  systemSettings: Record<Id, SystemSettings>;
  /** Справочник категорий записи (F-15-121…124) — 4 системных + свои */
  recordCategories: RecordCategory[];
  /** id последней заявки на проверку по полю бренда/фото (F-00-168) — brandId → refKey → moderationItemId */
  moderationRefs: Record<Id, Record<ModerationRefKey, Id>>;
  /** Языки описания компании, заполненные автопереводом, а не автором (F-00-174) — по businessId */
  descriptionAutoLangs: Record<Id, ('hy' | 'en')[]>;
  /** Личный кабинет пользователя (F-15-147…158, b05) — по staffId */
  personalAccounts: Record<Id, PersonalAccount>;
  /** Журнал изменений настроек компании (F-15-180) — «кто, когда, было → стало» */
  changeLog: SettingsChangeLogEntry[];
  /** История правил оплаты подписки (F-15-048/056/066) — общая для всех бизнесов, объявляется заранее */
  priceRuleChanges: PriceRuleChange[];
  /** «Для разработчиков» — вебхуки (F-15-119); демо-интерфейс, решение о реальном API не принято */
  webhookSettings: Record<Id, WebhookSettings>;
  /** Цели, отмеченные на шаге анкеты «Как планируете пользоваться» (F-15-007) — по businessId, ключи ONBOARDING_GOAL_IDS */
  onboardingGoals: Record<Id, string[]>;
}

/** Ключи и цвета 4 несъёмных категорий записи (F-15-122) — по одному набору на каждый businessId при сидировании */
const SYSTEM_RECORD_CATEGORIES: {
  key: RecordCategory['systemKey'];
  colorIndex: number;
}[] = [
  { key: 'fullPrepay', colorIndex: 3 },
  { key: 'partialPrepay', colorIndex: 5 },
  { key: 'specialistImportant', colorIndex: 1 },
  { key: 'anySpecialist', colorIndex: 7 },
];

/** Бизнесы, у которых для замера удобно видеть особое состояние подписки (⭐ variety, не влияет на остальные) */
const FROZEN_DEMO = BIZ.davit;
const ENDING_SOON_DEMO = BIZ.arman;
const FREE_MONTH_DEMO = BIZ.mariam;
/** Промокод, применённый при регистрации и ещё не потраченный (F-15-062/063, F-00-021) — демо-разнообразие b03 */
const PROMO_DEMO = BIZ.arman;
/** Способ оплаты временно недоступен — предупреждение перед оплатой (F-15-090) */
const UNAVAILABLE_METHOD_DEMO = BIZ.davit;

export const settingsSlice = defineSlice<SettingsState>({
  version: 15,
  seed: (core: CoreData, now: Date) => {
    const subscriptions: Record<Id, Subscription> = {};
    const payments: SubscriptionPayment[] = [];
    const invoices: Invoice[] = [];
    const legalInfo: Record<Id, LegalInfo> = {};
    const helpRequests: HelpRequest[] = [];
    const systemSettings: Record<Id, SystemSettings> = {};
    const recordCategories: RecordCategory[] = [];

    core.businesses.forEach((business, index) => {
      const base = toISODate(now);
      let paidUntil = base;
      let frozen = false;
      let freeMonthUntil: string | undefined;
      let autoRenew = index % 5 !== 3;

      if (business.id === FROZEN_DEMO) {
        frozen = true;
        paidUntil = toISODate(
          new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000),
        );
      } else if (business.id === ENDING_SOON_DEMO) {
        paidUntil = toISODate(
          new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
        );
      } else if (business.id === FREE_MONTH_DEMO) {
        freeMonthUntil = toISODate(
          new Date(now.getTime() + 18 * 24 * 60 * 60 * 1000),
        );
        paidUntil = freeMonthUntil;
        autoRenew = false;
      } else {
        // Разброс 3–27 дней вперёд — на разных бизнесах видно разные сроки «оплачено до»
        const daysAhead = 3 + ((index * 7) % 25);
        paidUntil = toISODate(
          new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000),
        );
      }

      const savedPaymentMethod =
        business.id === UNAVAILABLE_METHOD_DEMO
          ? { method: 'card' as const, label: '•• 4041', unavailable: true }
          : index % 3 !== 2
            ? { method: 'card' as const, label: `•• ${4000 + index * 7}` }
            : undefined;

      // Пустые демо-бизнесы («только что зарегистрировались») — без записи: api даёт пробный период 7 дней (F-00-019)
      if (business.id !== BIZ.empty && business.id !== BIZ.emptySolo) subscriptions[business.id] = {
        businessId: business.id,
        paidUntil,
        autoRenew,
        frozen,
        freeMonthUntil,
        savedPaymentMethod,
        // F-15-093: включено по умолчанию у всех, кроме одного демо-бизнеса — чтобы был виден выключенный тумблер
        paymentDocsEmail: index % 6 !== 4,
        ...(business.id === PROMO_DEMO
          ? {
              promoApplied: 'WELCOME15',
              promoDiscountPercent: 15,
              promoUsed: false,
            }
          : {}),
      };

      // История оплат — 3 месяца назад, для непустых бизнесов (пустые демо — без истории, F-15-072 пусто)
      if (business.id !== BIZ.empty && business.id !== BIZ.emptySolo) {
        for (let i = 3; i >= 1; i--) {
          const date = toISODateTime(
            new Date(now.getTime() - i * 30 * 24 * 60 * 60 * 1000),
          );
          const amount = 4000 * Math.max(2, 1 + (index % 4));
          const invoiceId = newId('inv');
          payments.push({
            id: newId('pay'),
            businessId: business.id,
            date,
            periodMonths: 1,
            amount,
            method:
              i === 3 && business.id === ENDING_SOON_DEMO ? 'promo' : 'card',
            status: 'success',
            invoiceId,
          });
          const periodFrom = toISODate(
            new Date(now.getTime() - i * 30 * 24 * 60 * 60 * 1000),
          );
          const periodTo = toISODate(
            new Date(now.getTime() - (i - 1) * 30 * 24 * 60 * 60 * 1000),
          );
          invoices.push({
            id: invoiceId,
            businessId: business.id,
            number: `${1000 + index * 10 + i}`,
            purpose: 'subscription',
            amount,
            status: 'paid',
            date,
            periodFrom,
            periodTo,
            method:
              i === 3 && business.id === ENDING_SOON_DEMO ? 'promo' : 'card',
            payer:
              index % 3 !== 0
                ? {
                    name: business.name,
                    address: `Ереван, ул. Абовяна, ${10 + index}`,
                    taxId: `0${20000000 + index}`,
                  }
                : undefined,
          });
        }
        // Один неоплаченный счёт за монеты — показать статус «не оплачен» на /biz/billing/invoices
        if (index % 4 === 0) {
          invoices.push({
            id: newId('inv'),
            businessId: business.id,
            number: `${2000 + index}`,
            purpose: 'coins',
            amount: 3000,
            status: index % 8 === 0 ? 'unpaid' : 'paid',
            date: toISODateTime(
              new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
            ),
          });
        }
      }

      legalInfo[business.id] =
        index % 3 === 0
          ? {}
          : {
              entityType:
                business.kind === 'salon' ? 'legalEntity' : 'soleProprietor',
              companyName: business.name,
              taxId: `0${20000000 + index}`,
              legalAddress: undefined,
              billingAddress: `Ереван, ул. Абовяна, ${10 + index}`,
            };

      // F-15-113…117/136: город и формат — по умолчанию армянские; несколько демо-бизнесов с 12-часовым
      // форматом и другим языком сообщений, чтобы было видно разнообразие на замере.
      systemSettings[business.id] = {
        businessId: business.id,
        city: 'Yerevan',
        dateTimeFormat: index % 6 === 1 ? '12' : '24',
        messageLanguage: index % 4 === 2 ? 'hy' : index % 4 === 3 ? 'en' : 'ru',
      };

      // F-15-122: 4 несъёмные категории у каждого бизнеса + 1-2 своих демо-категории (F-15-123)
      SYSTEM_RECORD_CATEGORIES.forEach((c) => {
        recordCategories.push({
          id: newId('rcat'),
          businessId: business.id,
          name: `system.${c.key}`,
          colorIndex: c.colorIndex,
          system: true,
          systemKey: c.key,
        });
      });
      if (business.id !== BIZ.empty && business.id !== BIZ.emptySolo) {
        recordCategories.push({
          id: newId('rcat'),
          businessId: business.id,
          name: 'Первая консультация',
          colorIndex: 2,
          icon: 'Sparkles',
        });
        if (index % 2 === 0) {
          recordCategories.push({
            id: newId('rcat'),
            businessId: business.id,
            name: 'Повторный визит',
            colorIndex: 6,
            icon: 'Repeat',
          });
        }
      }
    });

    // Демо-приглашения по ссылке (F-15-146): один — новому человеку (ещё нет аккаунта), другой — уже
    // знакомому с нашей платформой (открывает форму входа). Токен виден в адресе, id по нему и ищем.
    const invites: OnboardingInvite[] = [
      {
        token: 'inv_demo_master_new',
        businessId: BIZ.nuri,
        businessName:
          core.businesses.find((b) => b.id === BIZ.nuri)?.name ?? 'Nuri',
        role: 'master',
        audience: 'new',
        phone: '+37455000111',
        status: 'pending',
        createdAt: toISODateTime(
          new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
        ),
      },
      {
        token: 'inv_demo_admin_existing',
        businessId: BIZ.arman,
        businessName:
          core.businesses.find((b) => b.id === BIZ.arman)?.name ?? 'Arman',
        role: 'admin',
        audience: 'existing',
        email: 'admin@example.com',
        status: 'pending',
        createdAt: toISODateTime(
          new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
        ),
      },
    ];

    // Личный кабинет (F-15-147…158) — по одной записи на каждого сотрудника; немного разнообразия для замера:
    // почта не у всех подтверждена, у кого-то отключены новости/реклама, у одного уже есть выгрузка данных.
    const personalAccounts: Record<Id, PersonalAccount> = {};
    core.staff.forEach((member, index) => {
      // Журнал входов (F-15-159) — 2–3 записи, самая свежая помечена «текущий сеанс»
      const devices = ['Chrome · Windows', 'Safari · iPhone', 'Chrome · Android'];
      const loginHistory: LoginEvent[] = Array.from(
        { length: 2 + (index % 2) },
        (_, i) => ({
          id: newId('login'),
          at: toISODateTime(
            new Date(now.getTime() - (i * 3 + 1) * 24 * 60 * 60 * 1000),
          ),
          device: devices[(index + i) % devices.length],
          location: index % 3 === 0 ? 'Ереван, Армения' : 'Гюмри, Армения',
          current: i === 0,
        }),
      );

      personalAccounts[member.id] = {
        staffId: member.id,
        twoFactorEnabled: index % 7 === 0,
        loginHistory,
        notificationPrefs: {
          news: index % 5 !== 1,
          marketing: index % 4 !== 0,
          system: true,
        },
        emailVerified: !member.email || index % 6 !== 3,
        dataExportRequests:
          index % 9 === 4
            ? [
                {
                  id: newId('export'),
                  requestedAt: toISODateTime(
                    new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
                  ),
                  ready: true,
                },
              ]
            : [],
        startPage: index % 7 === 2 ? 'clients' : undefined,
      };
    });

    // F-00-152: одна демо-заявка на сферу уже в работе — показывает чек-лист «что нужно» и срок готовности
    // на /biz/onboarding/sphere-request/[requestId]; другая — только отправлена, чек-листа ещё нет.
    const sphereOwnerId =
      core.staff.find((s) => s.businessId === BIZ.arman && s.role === 'owner')?.id ??
      core.staff.find((s) => s.businessId === BIZ.arman)?.id ??
      core.staff[0]?.id ??
      'staff_demo';
    const sphereRequests: SphereRequest[] = [
      {
        id: 'sphreq_demo_inwork',
        businessId: BIZ.arman,
        authorStaffId: sphereOwnerId,
        name: 'Тату-салон',
        message: 'Нужна отдельная сфера: карта тела, эскизы, согласие на процедуру.',
        createdAt: toISODateTime(new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000)),
        status: 'answered',
        checklist: [
          { id: 'catalog', labelKey: 'catalog', done: true },
          { id: 'terms', labelKey: 'terms', done: true },
          { id: 'icons', labelKey: 'icons', done: false },
          { id: 'launch', labelKey: 'launch', done: false },
        ],
        etaDate: toISODate(new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000)),
      },
      {
        id: 'sphreq_demo_new',
        businessId: BIZ.mariam,
        authorStaffId:
          core.staff.find((s) => s.businessId === BIZ.mariam)?.id ?? sphereOwnerId,
        name: 'Хостел (посуточная аренда)',
        createdAt: toISODateTime(new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000)),
        status: 'open',
      },
    ];

    // F-15-048/056/066: правило — новые цены объявляются заранее и действуют только с новой покупки;
    // одно прошлое изменение (для истории) и одно будущее (можно продлить по старой цене до даты вступления).
    const priceRuleChanges: PriceRuleChange[] = [
      {
        id: 'prc_2026_02',
        effectiveFrom: '2026-03-01',
        announcedAt: '2026-02-01',
        descriptionKey: 'masterSeat',
        oldPrice: 3500,
        newPrice: 4000,
      },
      {
        id: 'prc_2026_11',
        effectiveFrom: '2026-11-01',
        announcedAt: toISODate(now),
        descriptionKey: 'adminSeat',
        oldPrice: 2000,
        newPrice: 2500,
        upcoming: true,
      },
    ];

    return {
      subscriptions,
      payments,
      invoices,
      legalInfo,
      helpRequests,
      sphereRequests,
      mobileAppOrderRequests: [],
      tourSeen: {},
      invites,
      systemSettings,
      recordCategories,
      moderationRefs: {},
      descriptionAutoLangs: {},
      personalAccounts,
      changeLog: [],
      priceRuleChanges,
      webhookSettings: {},
      onboardingGoals: {},
    };
  },
});
