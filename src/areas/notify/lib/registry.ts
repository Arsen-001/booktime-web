/**
 * Реестр типов уведомлений (F-05-004): 29 настраиваемых типов + 2 служебных (15, 22), сплошной набор кодов
 * взят 1:1 из Altegio (нумерация не сплошная — так у них, F-05-004 «❓ неясно, почему пропуски»).
 * Отсюда строится сид среза (свежий бизнес) и подписи в реестре/журнале (F-05-130).
 */
import type { Id, LocalizedText } from '@/domain/core';
import type {
  NotificationType,
  NotifyChannel,
  NotifyClientGroup,
  NotifyDateFormat,
  NotifyLanguage,
  NotifyRecipient,
  NotifyScenario,
  TypeConditions,
} from '@/domain/notify';
import type { Locale } from '@/i18n/config';
import { smsDefaultOf } from '@/areas/notify/lib/smsDefaults';

export interface TypeDef {
  code: number;
  recipient: NotifyRecipient;
  group?: NotifyClientGroup;
  nameRu: string;
  nameEn: string;
  nameHy: string;
  descriptionRu: string;
  descriptionEn: string;
  descriptionHy: string;
  /** Выключен по умолчанию (F-05-003): 72, 16, 17, 65; ⭐ 73 у нас включён (30.09.2026) */
  enabledDefault: boolean;
  availableChannels: NotifyChannel[];
  /** Сценарий по умолчанию для каждого доступного канала (не указан — 'off') */
  defaultScenario: Partial<Record<NotifyChannel, NotifyScenario>>;
  /** Тумблер нельзя выключить (тип 7 — код входа всегда работает) */
  alwaysOn?: boolean;
  /** Шаблон и каналы задаёт система, править нельзя (типы 7, 19, 43 — F-05-020) */
  systemLocked?: boolean;
  templateRu: string;
  templateEn?: string;
  /** Армянский текст (Ув2): без него клиент, выбравший «Հայերեն», получал русский */
  templateHy?: string;
  /** Значения условий этого типа по умолчанию (F-05-024…F-05-040); поля — см. TypeConditions */
  conditionsDefault?: TypeConditions;
}

// ⭐ 73 «Просим подтвердить визит» включён по умолчанию (30.09.2026): подтверждение — главный способ снизить неявки
const OFF_BY_DEFAULT = new Set([72, 16, 17, 65]);

// ⭐ F-00-120: клиенту главный канал — бесплатный пуш в наше приложение, не Email
const CLIENT_DEFAULT: Partial<Record<NotifyChannel, NotifyScenario>> = { push: 'always' };
// ⭐ Напоминание (1): клиенту без приложения — бесплатный Telegram-бот, если он его подключил, за 24 ч и за 2 ч
// (одно правило с сервером telegram-reminders.ts, 01.10.2026); с приложением — только пуш
const CLIENT_REMINDER_DEFAULT: Partial<Record<NotifyChannel, NotifyScenario>> = { push: 'always', telegram: 'always' };
const ADMIN_DEFAULT: Partial<Record<NotifyChannel, NotifyScenario>> = { adminApp: 'always', email: 'always' };

/**
 * Тексты шаблонов (Ув1, Ув5, Ув7, 27.09): без падежей на переменных — имя мастера/клиента стоит после двоеточия
 * («Мастер: {staff}»), а не «к {staff}» (выходило «к Анна»); {date} сам даёт «сегодня/завтра/ДД.ММ.ГГГГ», поэтому
 * слова «завтра» в тексте нет (выходило «завтра сегодня»). Клиент может подтвердить/перенести/отменить по {link},
 * записаться снова — по {bookingLink}, оценить визит — по {reviewLink}. В начале — {companyName}: SMS приходит
 * с общего имени отправителя, без него непонятно, от кого сообщение.
 */
export const TYPE_REGISTRY: TypeDef[] = [
  {
    code: 2,
    recipient: 'client',
    group: 'attendance',
    nameRu: 'Клиент записался онлайн',
    nameEn: 'Client booked online',
    nameHy: 'Հաճախորդը գրանցվել է առցանց',
    descriptionRu: 'Клиент сам записался онлайн — подтверждаем детали визита.',
    descriptionEn: 'Client booked online themselves — we confirm the visit details.',
    descriptionHy: 'Հաճախորդն ինքն է գրանցվել առցանց․ հաստատում ենք այցի մանրամասները։',
    enabledDefault: true,
    availableChannels: ['push', 'email', 'sms', 'brandedApp'],
    defaultScenario: CLIENT_DEFAULT,
    templateRu: '{companyName}: вы записаны — {service}, {date} в {time}. Мастер: {staff}. Адрес: {address}. Перенести или отменить: {link}',
    templateEn: '{companyName}: you are booked — {service}, {date} at {time}. Specialist: {staff}. Address: {address}. Reschedule or cancel: {link}',
    templateHy: '{companyName}․ դուք գրանցված եք՝ {service}, {date}, ժամը {time}։ Վարպետ՝ {staff}։ Հասցե՝ {address}։ Տեղափոխել կամ չեղարկել՝ {link}',
  },
  {
    code: 8,
    recipient: 'client',
    group: 'attendance',
    nameRu: 'Администратор записал клиента',
    nameEn: 'Admin booked the client',
    nameHy: 'Ադմինիստրատորը գրանցել է հաճախորդին',
    descriptionRu: 'Администратор записал клиента в журнале — клиент получает подтверждение.',
    descriptionEn: 'An admin created the booking in the journal — the client gets a confirmation.',
    descriptionHy: 'Ադմինիստրատորը գրանցումն արել է մատյանում․ հաճախորդը ստանում է հաստատում։',
    enabledDefault: true,
    availableChannels: ['push', 'email', 'sms', 'brandedApp'],
    defaultScenario: CLIENT_DEFAULT,
    templateRu: '{companyName}: вас записали — {service}, {date} в {time}. Мастер: {staff}. Подробности, перенос и отмена: {link}',
    templateEn: '{companyName}: you have been booked — {service}, {date} at {time}. Specialist: {staff}. Details, reschedule or cancel: {link}',
    templateHy: '{companyName}․ ձեզ գրանցել են՝ {service}, {date}, ժամը {time}։ Վարպետ՝ {staff}։ Մանրամասներ, տեղափոխում և չեղարկում՝ {link}',
  },
  {
    code: 9,
    recipient: 'client',
    group: 'attendance',
    nameRu: 'Запись подтверждена',
    nameEn: 'Booking confirmed',
    nameHy: 'Գրանցումը հաստատված է',
    descriptionRu: 'Администратор подтвердил запись — сообщаем клиенту.',
    descriptionEn: 'An admin confirmed the booking — we let the client know.',
    descriptionHy: 'Ադմինիստրատորը հաստատել է գրանցումը․ տեղեկացնում ենք հաճախորդին։',
    enabledDefault: true,
    availableChannels: ['push', 'email', 'sms', 'brandedApp'],
    defaultScenario: CLIENT_DEFAULT,
    templateRu: '{companyName}: ваша запись на {date} в {time} подтверждена. Подробности: {link}',
    templateEn: '{companyName}: your booking {date} at {time} is confirmed. Details: {link}',
    templateHy: '{companyName}․ ձեր գրանցումը՝ {date}, ժամը {time}, հաստատված է։ Մանրամասներ՝ {link}',
  },
  {
    code: 74,
    recipient: 'client',
    group: 'attendance',
    nameRu: 'Изменение записи',
    nameEn: 'Booking changed',
    nameHy: 'Գրանցման փոփոխություն',
    descriptionRu: 'Время, мастер или услуга записи изменились.',
    descriptionEn: 'The booking time, staff or service has changed.',
    descriptionHy: 'Փոխվել է գրանցման ժամը, վարպետը կամ ծառայությունը։',
    enabledDefault: true,
    availableChannels: ['push', 'email', 'sms', 'brandedApp'],
    defaultScenario: CLIENT_DEFAULT,
    templateRu: '{companyName}: запись изменена. Теперь: {service}, {date} в {time}, мастер: {staff}. Подробности: {link}',
    templateEn: '{companyName}: your booking has changed. Now: {service}, {date} at {time}, specialist: {staff}. Details: {link}',
    templateHy: '{companyName}․ ձեր գրանցումը փոխվել է։ Այժմ՝ {service}, {date}, ժամը {time}, վարպետ՝ {staff}։ Մանրամասներ՝ {link}',
    conditionsDefault: { rescheduleThresholdMinutes: 5, rescheduleSource: 'all' },
  },
  {
    code: 73,
    recipient: 'client',
    group: 'attendance',
    nameRu: 'Просим подтвердить визит',
    nameEn: 'Ask to confirm the visit',
    nameHy: 'Խնդրում ենք հաստատել այցը',
    descriptionRu: 'Просим клиента подтвердить, что придёт на визит.',
    descriptionEn: 'We ask the client to confirm they will come.',
    descriptionHy: 'Խնդրում ենք հաճախորդին հաստատել, որ կգա այցի։',
    // 01.10.2026: по умолчанию выключен, как на сервере — сервер этот тип пока не отправляет (подтвердить визит можно
    // кнопкой в напоминании и в приложении), включённый по умолчанию показывал бы в журнале отправки, которых не будет
    enabledDefault: false,
    // 01.10.2026: без Telegram, как на сервере — у Telegram-напоминания за сутки уже есть кнопка «Приду» (подтверждение),
    // отдельный запрос в Telegram был бы третьим сообщением, которого сервер не шлёт.
    availableChannels: ['push', 'email', 'sms', 'brandedApp'],
    defaultScenario: CLIENT_DEFAULT,
    templateRu: '{companyName}: подтвердите визит {date} в {time} ({service}, мастер: {staff}). Подтвердить или отменить: {link}',
    templateEn: '{companyName}: please confirm your visit {date} at {time} ({service}, specialist: {staff}). Confirm or cancel: {link}',
    templateHy: '{companyName}․ խնդրում ենք հաստատել այցը՝ {date}, ժամը {time} ({service}, վարպետ՝ {staff})։ Հաստատել կամ չեղարկել՝ {link}',
    conditionsDefault: { timingHours: 24, useSpecificTime: false, specificTime: '14:00' },
  },
  {
    code: 1,
    recipient: 'client',
    group: 'attendance',
    nameRu: 'Напоминание о визите',
    nameEn: 'Visit reminder',
    nameHy: 'Այցի հիշեցում',
    descriptionRu: 'Напоминаем о записи заранее, чтобы клиент не забыл.',
    descriptionEn: 'A heads-up before the visit so the client does not forget.',
    descriptionHy: 'Նախապես հիշեցնում ենք գրանցման մասին, որ հաճախորդը չմոռանա։',
    enabledDefault: true,
    availableChannels: ['push', 'telegram', 'email', 'sms', 'brandedApp'],
    defaultScenario: CLIENT_REMINDER_DEFAULT,
    templateRu: '{companyName}: напоминаем о визите {date} в {time} — {service}, мастер: {staff}. Адрес: {address}. Если не получается прийти: {link}',
    templateEn: '{companyName}: a reminder of your visit {date} at {time} — {service}, specialist: {staff}. Address: {address}. If you can’t make it: {link}',
    templateHy: '{companyName}․ հիշեցնում ենք այցի մասին՝ {date}, ժամը {time}՝ {service}, վարպետ՝ {staff}։ Հասցե՝ {address}։ Եթե չեք կարող գալ՝ {link}',
    conditionsDefault: { timingHours: 1, emailTimingHours: 12 },
  },
  {
    code: 4,
    recipient: 'client',
    group: 'attendance',
    nameRu: 'Отмена записи',
    nameEn: 'Booking cancelled',
    nameHy: 'Գրանցման չեղարկում',
    descriptionRu: 'Запись отменена — сообщаем клиенту.',
    descriptionEn: 'The booking was cancelled — we let the client know.',
    descriptionHy: 'Գրանցումը չեղարկվել է․ տեղեկացնում ենք հաճախորդին։',
    enabledDefault: true,
    availableChannels: ['push', 'email', 'sms', 'brandedApp'],
    defaultScenario: CLIENT_DEFAULT,
    templateRu: '{companyName}: ваша запись на {date} в {time} отменена. Записаться снова: {bookingLink}',
    templateEn: '{companyName}: your booking {date} at {time} was cancelled. Book again: {bookingLink}',
    templateHy: '{companyName}․ ձեր գրանցումը՝ {date}, ժամը {time}, չեղարկվել է։ Կրկին գրանցվել՝ {bookingLink}',
  },
  {
    code: 75,
    recipient: 'client',
    group: 'attendance',
    nameRu: 'Клиент не пришёл',
    nameEn: 'Client did not show up',
    nameHy: 'Հաճախորդը չի եկել',
    descriptionRu: 'Клиент не пришёл — запись закрыта статусом «не пришёл».',
    descriptionEn: 'The client did not show up — the booking was closed as a no-show.',
    descriptionHy: 'Հաճախորդը չի եկել․ գրանցումը փակվել է «չի եկել» կարգավիճակով։',
    enabledDefault: true,
    availableChannels: ['push', 'email', 'sms', 'brandedApp'],
    defaultScenario: CLIENT_DEFAULT,
    templateRu: '{companyName}: вы не пришли на запись {date} в {time}. Будем рады видеть в другой раз: {bookingLink}',
    templateEn: '{companyName}: you missed your booking {date} at {time}. We would love to see you another time: {bookingLink}',
    templateHy: '{companyName}․ դուք չեկաք գրանցմանը՝ {date}, ժամը {time}։ Սիրով կսպասենք ձեզ մեկ այլ անգամ՝ {bookingLink}',
  },
  {
    code: 72,
    recipient: 'client',
    group: 'attendance',
    nameRu: 'Зовём вернуться того, кто не дошёл',
    nameEn: 'Invite a no-show back',
    nameHy: 'Կրկին հրավիրում ենք չեկածներին',
    descriptionRu: 'Приглашаем записаться снова тех, кто не дошёл в прошлый раз.',
    descriptionEn: 'We invite clients who no-showed to book again.',
    descriptionHy: 'Կրկին գրանցվելու ենք հրավիրում նրանց, ովքեր նախորդ անգամ չեն եկել։',
    enabledDefault: false,
    availableChannels: ['push', 'email', 'sms', 'brandedApp'],
    defaultScenario: CLIENT_DEFAULT,
    templateRu: '{companyName}: заметили, что вы не смогли прийти. Запишитесь на удобное время: {bookingLink}',
    templateEn: '{companyName}: we noticed you could not make it. Book a time that suits you: {bookingLink}',
    templateHy: '{companyName}․ նկատեցինք, որ չկարողացաք գալ։ Գրանցվեք ձեզ հարմար ժամի՝ {bookingLink}',
    conditionsDefault: { inviteAfterHours: 0, inviteStatusFilter: 'all' },
  },
  {
    code: 6,
    recipient: 'client',
    group: 'quality',
    nameRu: 'Спрашиваем впечатление (запись онлайн)',
    nameEn: 'Ask how it went (booked online)',
    nameHy: 'Հարցնում ենք տպավորությունը (առցանց գրանցում)',
    descriptionRu: 'Спрашиваем, понравился ли визит, простым «★», как только клиент отмечен пришедшим.',
    descriptionEn: 'A simple “liked it? ★” question once the visit is marked as attended.',
    descriptionHy: 'Պարզ «★» հարցով հարցնում ենք՝ դուր եկա՞վ այցը, հենց որ հաճախորդը նշվում է որպես եկած։',
    enabledDefault: true,
    availableChannels: ['push', 'email', 'sms', 'brandedApp'],
    defaultScenario: CLIENT_DEFAULT,
    templateRu: '{companyName}: спасибо за визит! Понравилось? Оцените ★: {reviewLink}',
    templateEn: '{companyName}: thanks for visiting! Did you like it? Rate it ★: {reviewLink}',
    templateHy: '{companyName}․ շնորհակալություն այցի համար։ Դուր եկա՞վ։ Գնահատեք ★՝ {reviewLink}',
    conditionsDefault: {
      reviewDelayMinutes: 5,
      reviewExcludeServiceIds: [],
      reviewExcludeIfReviewed: { location: true, staff: false, service: false },
    },
  },
  {
    code: 20,
    recipient: 'client',
    group: 'quality',
    nameRu: 'Спрашиваем впечатление (запись из журнала)',
    nameEn: 'Ask how it went (booked in journal)',
    nameHy: 'Հարցնում ենք տպավորությունը (գրանցում մատյանից)',
    descriptionRu: 'То же самое, но для визита, который в журнал внёс администратор.',
    descriptionEn: 'The same, for a visit an admin logged in the journal.',
    descriptionHy: 'Նույնը, բայց այն այցի համար, որը մատյանում գրանցել է ադմինիստրատորը։',
    enabledDefault: true,
    availableChannels: ['push', 'email', 'sms', 'brandedApp'],
    defaultScenario: CLIENT_DEFAULT,
    templateRu: '{companyName}: спасибо за визит! Понравилось? Оцените ★: {reviewLink}',
    templateEn: '{companyName}: thanks for visiting! Did you like it? Rate it ★: {reviewLink}',
    templateHy: '{companyName}․ շնորհակալություն այցի համար։ Դուր եկա՞վ։ Գնահատեք ★՝ {reviewLink}',
    conditionsDefault: { reviewDelayMinutes: 5, reviewExcludeServiceIds: [], reviewExcludeIfReviewed: { location: true, staff: false, service: false } },
  },
  {
    code: 3,
    recipient: 'client',
    group: 'retention',
    nameRu: 'Поздравление с днём рождения',
    nameEn: 'Birthday greeting',
    nameHy: 'Ծննդյան օրվա շնորհավորանք',
    descriptionRu: 'Автоматическое поздравление в день рождения клиента.',
    descriptionEn: 'An automatic greeting on the client’s birthday.',
    descriptionHy: 'Ավտոմատ շնորհավորանք հաճախորդի ծննդյան օրը։',
    enabledDefault: true,
    availableChannels: ['push', 'email', 'sms', 'brandedApp'],
    defaultScenario: CLIENT_DEFAULT,
    templateRu: 'С днём рождения, {clientName}! Желаем хорошего настроения и ждём в гости: {bookingLink}. {companyName}',
    templateEn: 'Happy birthday, {clientName}! Wishing you a great day — come see us: {bookingLink}. {companyName}',
    templateHy: '{clientName}, շնորհավորում ենք ձեր ծննդյան օրվա առթիվ։ Սպասում ենք ձեզ՝ {bookingLink}։ {companyName}',
    conditionsDefault: { birthdayMode: 'onDay', birthdayDaysBefore: 3, birthdayTimeOfDay: '10:00' },
  },
  {
    code: 16,
    recipient: 'client',
    group: 'retention',
    nameRu: 'Новая скидка',
    nameEn: 'New discount',
    nameHy: 'Նոր զեղչ',
    descriptionRu: 'Клиенту назначили новую скидку.',
    descriptionEn: 'The client got a new discount.',
    descriptionHy: 'Հաճախորդին նոր զեղչ է տրամադրվել։',
    enabledDefault: false,
    availableChannels: ['push', 'email', 'sms', 'brandedApp'],
    defaultScenario: CLIENT_DEFAULT,
    templateRu: '{companyName}: вам назначена скидка {discount}%. Записаться: {bookingLink}',
    templateEn: '{companyName}: you have been given a {discount}% discount. Book: {bookingLink}',
    templateHy: '{companyName}․ ձեզ տրամադրվել է {discount}% զեղչ։ Գրանցվել՝ {bookingLink}',
  },
  {
    code: 17,
    recipient: 'client',
    group: 'retention',
    nameRu: 'Окончание действия скидки',
    nameEn: 'Discount ending',
    nameHy: 'Զեղչի ավարտ',
    descriptionRu: 'Скидка клиента скоро перестанет действовать.',
    descriptionEn: 'The client’s discount is about to expire.',
    descriptionHy: 'Հաճախորդի զեղչը շուտով կդադարի գործել։',
    enabledDefault: false,
    availableChannels: ['push', 'email', 'sms', 'brandedApp'],
    defaultScenario: CLIENT_DEFAULT,
    templateRu: '{companyName}: ваша скидка {discount}% закончится через {days} дн. Успейте записаться: {bookingLink}',
    templateEn: '{companyName}: your {discount}% discount ends in {days} day(s). Book in time: {bookingLink}',
    templateHy: '{companyName}․ ձեր {discount}% զեղչը կավարտվի {days} օրից։ Հասցրեք գրանցվել՝ {bookingLink}',
    conditionsDefault: { discountExpiryDaysBefore: 3 },
  },
  {
    code: 55,
    recipient: 'client',
    group: 'retention',
    nameRu: 'Приглашение на повторный визит',
    nameEn: 'Invitation to come back',
    nameHy: 'Հրավեր կրկնակի այցի',
    descriptionRu: 'Клиент давно не был — приглашаем записаться снова.',
    descriptionEn: 'The client has not visited in a while — we invite them back.',
    descriptionHy: 'Հաճախորդը վաղուց չի եղել․ հրավիրում ենք կրկին գրանցվել։',
    enabledDefault: true,
    availableChannels: ['push', 'email', 'sms', 'brandedApp'],
    defaultScenario: CLIENT_DEFAULT,
    templateRu: '{companyName}: давно вас не было — пора снова на «{service}». Запишитесь на удобное время: {bookingLink}',
    templateEn: '{companyName}: it has been a while since your “{service}”. Book a convenient time: {bookingLink}',
    templateHy: '{companyName}․ վաղուց չեք եղել՝ «{service}»։ Գրանցվեք ձեզ հարմար ժամի՝ {bookingLink}',
    conditionsDefault: { winbackAfterDays: 14 },
  },
  {
    code: 85,
    recipient: 'client',
    group: 'other',
    nameRu: 'Ссылка на оплату визита',
    nameEn: 'Payment link for the client',
    nameHy: 'Այցի վճարման հղում',
    descriptionRu: 'Ссылка на онлайн-оплату визита (заработает, когда в платформе появится оплата).',
    descriptionEn: 'A link to pay for the visit online (starts working once online payments ship).',
    descriptionHy: 'Այցի առցանց վճարման հղում (կաշխատի, երբ հարթակում հայտնվի վճարումը)։',
    enabledDefault: true,
    availableChannels: ['push', 'email', 'sms', 'brandedApp'],
    defaultScenario: CLIENT_DEFAULT,
    templateRu: '{companyName}: оплатите визит {date} в {time} по ссылке: {paymentLink}',
    templateEn: '{companyName}: pay for your visit {date} at {time} via the link: {paymentLink}',
    templateHy: '{companyName}․ վճարեք այցի համար ({date}, ժամը {time}) հղումով՝ {paymentLink}',
  },
  {
    code: 7,
    recipient: 'client',
    group: 'other',
    nameRu: 'Код входа клиента',
    nameEn: 'Client login code',
    nameHy: 'Հաճախորդի մուտքի կոդ',
    // ⭐ F-00-032: код входа — в WhatsApp или Telegram, SMS только запасной канал (не самостоятельный).
    descriptionRu: 'Одноразовый код, которым клиент подтверждает номер при входе: WhatsApp или Telegram, SMS — запасной канал.',
    descriptionEn: 'A one-time code the client uses to confirm their phone: WhatsApp or Telegram, SMS as a fallback.',
    descriptionHy: 'Միանվագ կոդ, որով հաճախորդը մուտք գործելիս հաստատում է համարը՝ WhatsApp կամ Telegram, SMS՝ պահեստային ալիք։',
    enabledDefault: true,
    availableChannels: ['whatsapp', 'telegram', 'sms'],
    defaultScenario: { whatsapp: 'always', telegram: 'always', sms: 'fallback' },
    alwaysOn: true,
    templateRu: 'Код подтверждения: {code}',
    templateEn: 'Confirmation code: {code}',
    templateHy: 'Հաստատման կոդ՝ {code}',
    systemLocked: true,
  },
  {
    code: 65,
    recipient: 'client',
    group: 'other',
    nameRu: 'Оплата прошла',
    nameEn: 'Payment received',
    nameHy: 'Վճարումը կատարված է',
    descriptionRu: 'Оплата визита онлайн прошла успешно (заработает, когда появится оплата).',
    descriptionEn: 'The online payment for the visit went through (starts working once payments ship).',
    descriptionHy: 'Այցի առցանց վճարումը հաջողվել է (կաշխատի, երբ հայտնվի վճարումը)։',
    enabledDefault: false,
    availableChannels: ['push', 'sms', 'brandedApp'],
    defaultScenario: CLIENT_DEFAULT,
    templateRu: '{companyName}: оплата {amount} ֏ прошла. Ждём вас {date} в {time}.',
    templateEn: '{companyName}: payment of {amount} AMD received. See you {date} at {time}.',
    templateHy: '{companyName}․ {amount} ֏ վճարումը ստացված է։ Սպասում ենք ձեզ {date}, ժամը {time}։',
  },
  {
    code: 10,
    recipient: 'admin',
    nameRu: 'Клиент записался онлайн',
    nameEn: 'Client booked online',
    nameHy: 'Հաճախորդը գրանցվել է առցանց',
    descriptionRu: 'Клиент записался онлайн — сообщаем администратору.',
    descriptionEn: 'A client booked online — the admin is notified.',
    descriptionHy: 'Հաճախորդը գրանցվել է առցանց․ տեղեկացնում ենք ադմինիստրատորին։',
    enabledDefault: true,
    availableChannels: ['adminApp', 'email', 'sms'],
    defaultScenario: ADMIN_DEFAULT,
    templateRu: 'Новая онлайн-запись: {clientName}, {service}, {date} {time}, мастер: {staff}.',
    templateEn: 'New online booking: {clientName}, {service}, {date} {time}, specialist: {staff}.',
    templateHy: 'Նոր առցանց գրանցում՝ {clientName}, {service}, {date} {time}, վարպետ՝ {staff}։',
  },
  {
    code: 56,
    recipient: 'admin',
    nameRu: 'Коллега создал запись',
    nameEn: 'Colleague created a booking',
    nameHy: 'Գործընկերը ստեղծել է գրանցում',
    descriptionRu: 'Другой администратор создал запись — уведомляем.',
    descriptionEn: 'Another admin created a booking — notified.',
    descriptionHy: 'Այլ ադմինիստրատոր ստեղծել է գրանցում․ ծանուցում ենք։',
    enabledDefault: true,
    availableChannels: ['adminApp', 'email', 'sms'],
    defaultScenario: ADMIN_DEFAULT,
    templateRu: 'Создана запись: {clientName}, {service}, {date} {time}, мастер: {staff}.',
    templateEn: 'Booking created: {clientName}, {service}, {date} {time}, specialist: {staff}.',
    templateHy: 'Ստեղծվել է գրանցում՝ {clientName}, {service}, {date} {time}, վարպետ՝ {staff}։',
  },
  {
    code: 41,
    recipient: 'admin',
    nameRu: 'Онлайн-запись перенесена',
    nameEn: 'Online booking rescheduled',
    nameHy: 'Առցանց գրանցումը տեղափոխվել է',
    descriptionRu: 'Онлайн-запись перенесена клиентом или системой.',
    descriptionEn: 'An online booking was rescheduled.',
    descriptionHy: 'Առցանց գրանցումը տեղափոխել է հաճախորդը կամ համակարգը։',
    enabledDefault: true,
    availableChannels: ['adminApp', 'email', 'sms'],
    defaultScenario: ADMIN_DEFAULT,
    templateRu: 'Онлайн-запись перенесена. Клиент: {clientName}. Новое время: {date} {time}.',
    templateEn: 'Online booking rescheduled. Client: {clientName}. New time: {date} {time}.',
    templateHy: 'Առցանց գրանցումը տեղափոխվել է։ Հաճախորդ՝ {clientName}։ Նոր ժամ՝ {date} {time}։',
  },
  {
    code: 12,
    recipient: 'admin',
    nameRu: 'Клиент отменил онлайн-запись',
    nameEn: 'Client cancelled online',
    nameHy: 'Հաճախորդը չեղարկել է առցանց գրանցումը',
    descriptionRu: 'Клиент отменил онлайн-запись сам.',
    descriptionEn: 'A client cancelled their online booking.',
    descriptionHy: 'Հաճախորդն ինքն է չեղարկել առցանց գրանցումը։',
    enabledDefault: true,
    availableChannels: ['adminApp', 'email', 'sms'],
    defaultScenario: ADMIN_DEFAULT,
    templateRu: 'Онлайн-запись отменена клиентом. Клиент: {clientName}. Время: {date} {time}.',
    templateEn: 'Online booking cancelled by the client. Client: {clientName}. Time: {date} {time}.',
    templateHy: 'Հաճախորդը չեղարկել է առցանց գրանցումը։ Հաճախորդ՝ {clientName}։ Ժամ՝ {date} {time}։',
  },
  {
    code: 19,
    recipient: 'admin',
    nameRu: 'У сотрудника заканчивается график',
    nameEn: 'Staff schedule running out',
    nameHy: 'Աշխատակցի գրաֆիկը մոտենում է ավարտին',
    descriptionRu: 'У сотрудника скоро заканчивается открытое расписание — пора открыть окна дальше.',
    descriptionEn: 'A staff member’s open schedule is about to run out — time to open more slots.',
    descriptionHy: 'Աշխատակցի բաց գրաֆիկը շուտով կավարտվի․ ժամանակն է բացել հաջորդ ժամերը։',
    enabledDefault: true,
    availableChannels: ['sms'],
    defaultScenario: { sms: 'always' },
    templateRu: 'Сотрудник: {staff}. Расписание открыто ещё на {days} дн. Откройте окна на следующую неделю.',
    templateEn: 'Staff: {staff}. The schedule is open for {days} more day(s). Open slots for next week.',
    templateHy: 'Աշխատակից՝ {staff}։ Գրաֆիկը բաց է ևս {days} օր։ Բացեք հաջորդ շաբաթվա ժամերը։',
    systemLocked: true,
  },
  {
    code: 11,
    recipient: 'staff',
    nameRu: 'Клиент записался к вам',
    nameEn: 'Client booked with you',
    nameHy: 'Հաճախորդը գրանցվել է ձեզ մոտ',
    descriptionRu: 'Клиент записался онлайн к сотруднику.',
    descriptionEn: 'A client booked online with the staff member.',
    descriptionHy: 'Հաճախորդը առցանց գրանցվել է աշխատակցի մոտ։',
    enabledDefault: true,
    availableChannels: ['adminApp', 'email', 'sms'],
    defaultScenario: ADMIN_DEFAULT,
    templateRu: 'К вам записались: {clientName}, {service}, {date} {time}.',
    templateEn: 'You have a new client: {clientName}, {service}, {date} {time}.',
    templateHy: 'Ձեզ մոտ գրանցվել են՝ {clientName}, {service}, {date} {time}։',
  },
  {
    code: 57,
    recipient: 'staff',
    nameRu: 'Вам назначили клиента',
    nameEn: 'You were assigned a client',
    nameHy: 'Ձեզ նշանակել են հաճախորդ',
    descriptionRu: 'Администратор записал клиента к сотруднику.',
    descriptionEn: 'An admin booked a client with the staff member.',
    descriptionHy: 'Ադմինիստրատորը հաճախորդին գրանցել է աշխատակցի մոտ։',
    enabledDefault: true,
    availableChannels: ['adminApp', 'email', 'sms'],
    defaultScenario: ADMIN_DEFAULT,
    templateRu: 'Вам назначена запись: {clientName}, {service}, {date} {time}.',
    templateEn: 'You have been assigned a booking: {clientName}, {service}, {date} {time}.',
    templateHy: 'Ձեզ նշանակվել է գրանցում՝ {clientName}, {service}, {date} {time}։',
  },
  {
    code: 42,
    recipient: 'staff',
    nameRu: 'Вашу запись перенесли',
    nameEn: 'Your booking was rescheduled',
    nameHy: 'Ձեր գրանցումը տեղափոխվել է',
    descriptionRu: 'Запись к сотруднику перенесена.',
    descriptionEn: 'A booking with the staff member was rescheduled.',
    descriptionHy: 'Աշխատակցի մոտ գրանցումը տեղափոխվել է։',
    enabledDefault: true,
    availableChannels: ['adminApp', 'email', 'sms'],
    defaultScenario: ADMIN_DEFAULT,
    templateRu: 'Ваша запись перенесена. Клиент: {clientName}. Новое время: {date} {time}.',
    templateEn: 'Your booking was rescheduled. Client: {clientName}. New time: {date} {time}.',
    templateHy: 'Ձեր գրանցումը տեղափոխվել է։ Հաճախորդ՝ {clientName}։ Նոր ժամ՝ {date} {time}։',
  },
  {
    code: 13,
    recipient: 'staff',
    nameRu: 'Вашу запись отменили',
    nameEn: 'Your booking was cancelled',
    nameHy: 'Ձեր գրանցումը չեղարկվել է',
    descriptionRu: 'Запись к сотруднику отменена.',
    descriptionEn: 'A booking with the staff member was cancelled.',
    descriptionHy: 'Աշխատակցի մոտ գրանցումը չեղարկվել է։',
    enabledDefault: true,
    availableChannels: ['adminApp', 'email', 'sms'],
    defaultScenario: ADMIN_DEFAULT,
    templateRu: 'Ваша запись отменена. Клиент: {clientName}. Время: {date} {time}.',
    templateEn: 'Your booking was cancelled. Client: {clientName}. Time: {date} {time}.',
    templateHy: 'Ձեր գրանցումը չեղարկվել է։ Հաճախորդ՝ {clientName}։ Ժամ՝ {date} {time}։',
  },
  {
    code: 76,
    recipient: 'staff',
    nameRu: 'Ваш клиент не пришёл',
    nameEn: 'Your client did not show up',
    nameHy: 'Ձեր հաճախորդը չի եկել',
    descriptionRu: 'Клиент не пришёл на запись к сотруднику.',
    descriptionEn: 'The client did not show up for a booking with the staff member.',
    descriptionHy: 'Հաճախորդը չի եկել աշխատակցի մոտ գրանցմանը։',
    enabledDefault: true,
    availableChannels: ['adminApp', 'email', 'sms'],
    defaultScenario: ADMIN_DEFAULT,
    templateRu: 'Клиент не пришёл: {clientName}, {date} {time}. Время свободно.',
    templateEn: 'Client no-show: {clientName}, {date} {time}. The slot is free.',
    templateHy: 'Հաճախորդը չի եկել՝ {clientName}, {date} {time}։ Ժամն ազատ է։',
  },
  {
    code: 43,
    recipient: 'adminStaff',
    nameRu: 'Подписка скоро закончится',
    nameEn: 'Subscription expiring soon',
    nameHy: 'Բաժանորդագրությունը շուտով կավարտվի',
    descriptionRu: 'Подписка на платформу скоро закончится.',
    descriptionEn: 'The platform subscription is about to expire.',
    descriptionHy: 'Հարթակի բաժանորդագրությունը շուտով կավարտվի։',
    enabledDefault: true,
    availableChannels: ['adminApp', 'email', 'sms'],
    defaultScenario: ADMIN_DEFAULT,
    templateRu: 'Подписка заканчивается {date}. Продлите, чтобы не потерять доступ.',
    templateEn: 'Subscription ends {date}. Renew to keep access.',
    templateHy: 'Բաժանորդագրությունն ավարտվում է {date}։ Երկարացրեք, որպեսզի չկորցնեք մուտքը։',
    systemLocked: true,
  },
];

/** Служебные типы без страницы настройки (F-05-004: 15, 22) */
export const SERVICE_TYPES = [
  { code: 15, nameRu: 'Сообщение из карточки клиента', nameEn: 'Message from client card', nameHy: 'Հաղորդագրություն հաճախորդի քարտից' },
  { code: 22, nameRu: 'Сетевая рассылка', nameEn: 'Network mailing', nameHy: 'Ցանցային առաքում' },
] as const;

export function isOffByDefault(code: number): boolean {
  return OFF_BY_DEFAULT.has(code);
}

export const CHANNEL_LABEL_RU: Record<NotifyChannel, string> = {
  push: 'Пуш в приложение',
  adminApp: 'Приложение администратора',
  email: 'Email',
  sms: 'SMS',
  brandedApp: 'Брендированное приложение',
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
};

export const CHANNEL_LABEL_EN: Record<NotifyChannel, string> = {
  push: 'App push',
  adminApp: 'Admin app',
  email: 'Email',
  sms: 'SMS',
  brandedApp: 'Branded app',
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
};

export const CHANNEL_LABEL_HY: Record<NotifyChannel, string> = {
  push: 'Փուշ հավելվածում',
  adminApp: 'Ադմինիստրատորի հավելված',
  email: 'Email',
  sms: 'SMS',
  brandedApp: 'Բրենդային հավելված',
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
};

export const RECIPIENT_LABEL_RU: Record<NotifyRecipient, string> = {
  client: 'Клиенту',
  admin: 'Администратору',
  staff: 'Сотруднику',
  adminStaff: 'Администратору и сотруднику',
};

export const RECIPIENT_LABEL_EN: Record<NotifyRecipient, string> = {
  client: 'Client',
  admin: 'Admin',
  staff: 'Staff',
  adminStaff: 'Admin and staff',
};

export const RECIPIENT_LABEL_HY: Record<NotifyRecipient, string> = {
  client: 'Հաճախորդին',
  admin: 'Ադմինիստրատորին',
  staff: 'Աշխատակցին',
  adminStaff: 'Ադմինիստրատորին և աշխատակցին',
};

export const GROUP_LABEL_RU: Record<NotifyClientGroup, string> = {
  attendance: 'Увеличение посещаемости',
  quality: 'Контроль качества',
  retention: 'Работа с возвращаемостью',
  other: 'Другое',
};

export const GROUP_LABEL_EN: Record<NotifyClientGroup, string> = {
  attendance: 'Attendance',
  quality: 'Quality control',
  retention: 'Retention',
  other: 'Other',
};

export const GROUP_LABEL_HY: Record<NotifyClientGroup, string> = {
  attendance: 'Այցելությունների աճ',
  quality: 'Որակի վերահսկում',
  retention: 'Վերադարձի խթանում',
  other: 'Այլ',
};

/**
 * Подписи каналов/получателей/групп по текущему языку (F-05-002, F-05-005, F-05-107): ru, en и hy (Ув2) —
 * используйте эти функции вместо прямого обращения к *_LABEL_RU.
 */
export function channelLabel(channel: NotifyChannel, locale: Locale): string {
  return locale === 'en' ? CHANNEL_LABEL_EN[channel] : locale === 'hy' ? CHANNEL_LABEL_HY[channel] : CHANNEL_LABEL_RU[channel];
}

export function recipientLabel(recipient: NotifyRecipient, locale: Locale): string {
  return locale === 'en' ? RECIPIENT_LABEL_EN[recipient] : locale === 'hy' ? RECIPIENT_LABEL_HY[recipient] : RECIPIENT_LABEL_RU[recipient];
}

export function groupLabel(group: NotifyClientGroup, locale: Locale): string {
  return locale === 'en' ? GROUP_LABEL_EN[group] : locale === 'hy' ? GROUP_LABEL_HY[group] : GROUP_LABEL_RU[group];
}

/** Текст LocalizedText на нужном языке: нет перевода — ru (для hy и en), никогда не пусто */
export function pickLocalized(text: LocalizedText | undefined, lang: Locale | NotifyLanguage): string {
  if (!text) return '';
  return text[lang] || text.ru || text.en || '';
}

// ─────────────────────────── Переменные (F-05-022) ───────────────────────────

export interface VariableDef {
  /** Токен в тексте — «{key}» */
  key: string;
  labelRu: string;
  labelEn: string;
  labelHy: string;
  /** Значение для предпросмотра, когда у салона нет своих данных (F-05-021) — по языку */
  testValue: LocalizedText;
}

/** Каталог переменных «+ Добавить переменную» (F-05-022, data-f="F-03-045" — ссылки на запись/детали в шаблонах, data-f="F-04-223" — clientName/clientLastName/clientPhone/discount/days подставляют данные карточки клиента и записи, фамилия — отдельным полем, без переменной отчества) — таблица из ТЗ, без служебных 43/19 */
export const VARIABLES: VariableDef[] = [
  { key: 'companyName', labelRu: 'Название компании', labelEn: 'Company name', labelHy: 'Ընկերության անվանում', testValue: { ru: 'Салон «Мимоза»', en: 'Mimoza salon', hy: '«Միմոզա» սրահ' } },
  { key: 'bookingLink', labelRu: 'Ссылка на онлайн-запись', labelEn: 'Online booking link', labelHy: 'Առցանց գրանցման հղում', testValue: { ru: 'booktime.am/b/mimoza/book', en: 'booktime.am/b/mimoza/book', hy: 'booktime.am/b/mimoza/book' } },
  { key: 'address', labelRu: 'Адрес компании', labelEn: 'Company address', labelHy: 'Ընկերության հասցե', testValue: { ru: 'ул. Абовяна, 12', en: '12 Abovyan St', hy: 'Աբովյան փ․ 12' } },
  { key: 'companyPhone', labelRu: 'Номер телефона компании', labelEn: 'Company phone', labelHy: 'Ընկերության հեռախոսահամար', testValue: { ru: '+374 10 123 456', en: '+374 10 123 456', hy: '+374 10 123 456' } },
  { key: 'website', labelRu: 'Сайт компании', labelEn: 'Company website', labelHy: 'Ընկերության կայք', testValue: { ru: 'mimoza.am', en: 'mimoza.am', hy: 'mimoza.am' } },
  { key: 'mapsLink', labelRu: 'Ссылка на карты', labelEn: 'Maps link', labelHy: 'Քարտեզի հղում', testValue: { ru: 'yandex.com/maps/-/mimoza', en: 'yandex.com/maps/-/mimoza', hy: 'yandex.com/maps/-/mimoza' } },
  { key: 'discount', labelRu: 'Скидка клиента', labelEn: 'Client discount', labelHy: 'Հաճախորդի զեղչ', testValue: { ru: '10', en: '10', hy: '10' } },
  { key: 'days', labelRu: 'Количество дней до сгорания скидки', labelEn: 'Days until discount expires', labelHy: 'Օրեր մինչև զեղչի ավարտը', testValue: { ru: '5', en: '5', hy: '5' } },
  { key: 'staff', labelRu: 'Имя сотрудника', labelEn: 'Staff name', labelHy: 'Աշխատակցի անուն', testValue: { ru: 'Анна', en: 'Anna', hy: 'Աննա' } },
  { key: 'date', labelRu: 'Дата записи', labelEn: 'Booking date', labelHy: 'Գրանցման ամսաթիվ', testValue: { ru: 'завтра', en: 'tomorrow', hy: 'վաղը' } },
  { key: 'dateTime', labelRu: 'Дата и время записи', labelEn: 'Booking date and time', labelHy: 'Գրանցման ամսաթիվ և ժամ', testValue: { ru: 'завтра, 14:00', en: 'tomorrow, 14:00', hy: 'վաղը, 14:00' } },
  { key: 'time', labelRu: 'Время записи', labelEn: 'Booking time', labelHy: 'Գրանցման ժամ', testValue: { ru: '14:00', en: '14:00', hy: '14:00' } },
  { key: 'timeLeft', labelRu: 'Время до записи', labelEn: 'Time until the visit', labelHy: 'Ժամանակ մինչև այցը', testValue: { ru: '1 ч', en: '1 h', hy: '1 ժ' } },
  { key: 'link', labelRu: 'Ссылка на детали записи', labelEn: 'Booking details link', labelHy: 'Գրանցման մանրամասների հղում', testValue: { ru: 'booktime.am/b/mimoza/booking/9f3a', en: 'booktime.am/b/mimoza/booking/9f3a', hy: 'booktime.am/b/mimoza/booking/9f3a' } },
  { key: 'reviewLink', labelRu: 'Ссылка на форму отзыва', labelEn: 'Feedback form link', labelHy: 'Կարծիքի ձևի հղում', testValue: { ru: 'booktime.am/b/mimoza/booking/9f3a?review=1', en: 'booktime.am/b/mimoza/booking/9f3a?review=1', hy: 'booktime.am/b/mimoza/booking/9f3a?review=1' } },
  { key: 'visitServices', labelRu: 'Услуги в визите', labelEn: 'Services in the visit', labelHy: 'Այցի ծառայություններ', testValue: { ru: 'Стрижка, укладка', en: 'Haircut, styling', hy: 'Սանրվածք, հարդարում' } },
  { key: 'service', labelRu: 'Услуги в отдельной записи', labelEn: 'Services in this booking', labelHy: 'Այս գրանցման ծառայություններ', testValue: { ru: 'Стрижка', en: 'Haircut', hy: 'Սանրվածք' } },
  { key: 'clientName', labelRu: 'Имя клиента', labelEn: 'Client name', labelHy: 'Հաճախորդի անուն', testValue: { ru: 'Мариам', en: 'Mariam', hy: 'Մարիամ' } },
  { key: 'clientLastName', labelRu: 'Фамилия клиента', labelEn: 'Client last name', labelHy: 'Հաճախորդի ազգանուն', testValue: { ru: 'Петросян', en: 'Petrosyan', hy: 'Պետրոսյան' } },
  { key: 'clientPhone', labelRu: 'Телефон клиента', labelEn: 'Client phone', labelHy: 'Հաճախորդի հեռախոս', testValue: { ru: '+374 55 123 456', en: '+374 55 123 456', hy: '+374 55 123 456' } },
  { key: 'paymentLink', labelRu: 'Ссылка на оплату', labelEn: 'Payment link', labelHy: 'Վճարման հղում', testValue: { ru: 'booktime.am/pay/9f3a', en: 'booktime.am/pay/9f3a', hy: 'booktime.am/pay/9f3a' } },
  { key: 'code', labelRu: 'Код подтверждения', labelEn: 'Confirmation code', labelHy: 'Հաստատման կոդ', testValue: { ru: '482911', en: '482911', hy: '482911' } },
  { key: 'amount', labelRu: 'Сумма оплаты', labelEn: 'Payment amount', labelHy: 'Վճարման գումար', testValue: { ru: '5 000', en: '5,000', hy: '5 000' } },
];

export function variableLabel(v: { labelRu: string; labelEn: string; labelHy?: string }, locale: Locale | NotifyLanguage): string {
  return locale === 'en' ? v.labelEn : locale === 'hy' ? (v.labelHy ?? v.labelRu) : v.labelRu;
}

/** Тестовые значения для предпросмотра (F-05-021) — ключ → значение на ru; всегда 24-часовые (умолчание) */
export const TEST_DATA: Record<string, string> = Object.fromEntries(VARIABLES.map((v) => [v.key, v.testValue.ru]));

/** Тестовая дата/время предпросмотра (F-05-021): завтра, 14:00 */
const PREVIEW_HOUR = 14;
const PREVIEW_MINUTE = 0;

/** «14:00» → «2:00 PM» по формату из «Настроек» (F-05-011) — тот же вид, что уходит в настоящих сообщениях (liveLog) */
export function formatNotifyClock(hh: number, mm: number, dateFormat: NotifyDateFormat): string {
  if (dateFormat !== '12h') return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  const period = hh < 12 ? 'AM' : 'PM';
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${h12}:${String(mm).padStart(2, '0')} ${period}`;
}

/** Данные салона для предпросмотра (Ув7): название, адрес, услуга, мастер — вместо выдуманной «Мимозы» */
export interface PreviewSalonData {
  companyName?: string;
  address?: LocalizedText;
  companyPhone?: string;
  website?: string;
  slug?: string;
  service?: LocalizedText;
  staff?: string;
}

/**
 * Значения переменных предпросмотра на языке сообщения (Ув7) и в формате времени из «Настроек» (F-05-011):
 * реальные данные салона, где они есть, иначе тестовые на том же языке.
 */
export function previewData(lang: NotifyLanguage, dateFormat: NotifyDateFormat, salon: PreviewSalonData = {}): Record<string, string> {
  const base: Record<string, string> = Object.fromEntries(VARIABLES.map((v) => [v.key, v.testValue[lang] || v.testValue.ru]));
  const time = formatNotifyClock(PREVIEW_HOUR, PREVIEW_MINUTE, dateFormat);
  const tomorrow = base.date;
  const slug = salon.slug;
  const links: Record<string, string> = slug
    ? {
        bookingLink: `booktime.am/b/${slug}/book`,
        link: `booktime.am/b/${slug}/booking/9f3a`,
        reviewLink: `booktime.am/b/${slug}/booking/9f3a?review=1`,
      }
    : {};
  const service = salon.service ? pickLocalized(salon.service, lang) : '';
  return {
    ...base,
    ...links,
    time,
    dateTime: `${tomorrow}, ${time}`,
    ...(salon.companyName ? { companyName: salon.companyName } : {}),
    ...(salon.address && pickLocalized(salon.address, lang) ? { address: pickLocalized(salon.address, lang) } : {}),
    ...(salon.companyPhone ? { companyPhone: salon.companyPhone } : {}),
    ...(salon.website ? { website: salon.website.replace(/^https?:\/\//, '') } : {}),
    ...(service ? { service, visitServices: service } : {}),
    ...(salon.staff ? { staff: salon.staff } : {}),
  };
}

/** Пример короткой ссылки в предпросмотре SMS (28.09): в SMS уходит booktime.am/s/<6 знаков>, не полный адрес */
export const SMS_PREVIEW_SHORT_LINK = 'booktime.am/s/x7Kp2A';

/** Значения предпросмотра для канала SMS: ссылки — короткие, как их реально получит клиент (liveLog → forChannel) */
export function smsPreviewData(data: Record<string, string>): Record<string, string> {
  const out = { ...data };
  for (const key of ['link', 'reviewLink', 'bookingLink', 'paymentLink']) if (out[key]) out[key] = SMS_PREVIEW_SHORT_LINK;
  return out;
}

/**
 * TEST_DATA с {date}/{time}/{dateTime}, пересчитанными по формату из «Настроек» (F-05-011) — русские тестовые данные.
 */
export function testDataForFormat(dateFormat: NotifyDateFormat): Record<string, string> {
  return previewData('ru', dateFormat);
}

/**
 * Старые переменные `%…%` (F-05-023) — читаются в шаблонах лояльности, абонементов, рассылок и кода
 * подтверждения (другие разделы и наши рассылки); справочно, отдельно не редактируются здесь.
 */
export const LEGACY_VARIABLES: { code: string; labelRu: string; labelEn: string; labelHy: string }[] = [
  { code: '%CLIENT_NAME%', labelRu: 'Имя клиента (только имя)', labelEn: 'Client first name only' , labelHy: 'Հաճախորդի անուն (միայն անունը)' },
  { code: '%MASTER_NAME%', labelRu: 'Имя мастера', labelEn: 'Staff name' , labelHy: 'Վարպետի անուն' },
  { code: '%DATE%', labelRu: 'Дата', labelEn: 'Date' , labelHy: 'Ամսաթիվ' },
  { code: '%HOURMINUTES%', labelRu: 'Время', labelEn: 'Time' , labelHy: 'Ժամ' },
  { code: '%DATETIME%', labelRu: 'Дата и время', labelEn: 'Date and time' , labelHy: 'Ամսաթիվ և ժամ' },
  { code: '%SERVICE_TITLE%', labelRu: 'Название услуги', labelEn: 'Service name' , labelHy: 'Ծառայության անվանում' },
  { code: '%CONTACT_PHONE%', labelRu: 'Телефон компании', labelEn: 'Company phone' , labelHy: 'Ընկերության հեռախոս' },
  { code: '%TITLE%', labelRu: 'Название филиала', labelEn: 'Branch name' , labelHy: 'Մասնաճյուղի անվանում' },
  { code: '%LINK%', labelRu: 'Ссылка на детали записи', labelEn: 'Booking details link' , labelHy: 'Գրանցման մանրամասների հղում' },
  { code: '%DISCOUNT%', labelRu: 'Скидка', labelEn: 'Discount' , labelHy: 'Զեղչ' },
  { code: '%DAYS%', labelRu: 'Дней', labelEn: 'Days' , labelHy: 'Օրեր' },
  { code: '%CODE%', labelRu: 'Код подтверждения', labelEn: 'Confirmation code' , labelHy: 'Հաստատման կոդ' },
  { code: '%CARD_TITLE%', labelRu: 'Название карты лояльности', labelEn: 'Loyalty card name' , labelHy: 'Հավատարմության քարտի անվանում' },
  { code: '%CARD_NUMBER%', labelRu: 'Номер карты', labelEn: 'Card number' , labelHy: 'Քարտի համար' },
  { code: '%GROUP_TITLE%', labelRu: 'Название сети', labelEn: 'Network name' , labelHy: 'Ցանցի անվանում' },
  { code: '%BONUS%', labelRu: 'Бонусы', labelEn: 'Bonus points' , labelHy: 'Բոնուսներ' },
  { code: '%CARD_BALANCE%', labelRu: 'Баланс карты', labelEn: 'Card balance' , labelHy: 'Քարտի մնացորդ' },
  { code: '%CASHBACK%', labelRu: 'Кэшбэк', labelEn: 'Cashback' , labelHy: 'Քեշբեք' },
  { code: '%BURN_DATE%', labelRu: 'Дата сгорания', labelEn: 'Expiry date' , labelHy: 'Այրման ամսաթիվ' },
  { code: '%VISITS_LEFT%', labelRu: 'Осталось визитов', labelEn: 'Visits left' , labelHy: 'Մնացած այցեր' },
  { code: '%EXPIRATION_DATE%', labelRu: 'Дата окончания абонемента', labelEn: 'Subscription expiry date' , labelHy: 'Աբոնեմենտի ավարտի ամսաթիվ' },
];

/** Заменяет «{key}» на тестовые/реальные значения (F-05-021); незнакомый токен остаётся как есть */
export function renderTemplate(text: string, values: Record<string, string> = TEST_DATA): string {
  return text.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? values[key] : match));
}

/**
 * 2–3 готовых варианта текста короче исходного (F-05-017, F-05-024…040) — полный (как задан в реестре),
 * средний (без мастера и адреса) и короткий (название, дата/время и ссылка на детали, если она есть в тексте).
 */
export function smsVariants(template: string): string[] {
  const full = template.trim();
  const medium = full
    // Целое предложение «Мастер: {staff}.» / «Specialist: {staff}.» / «Վարպետ՝ {staff}։» и такое же про адрес
    .replace(/\s*(?:Мастер|Specialist|Վարպետ)\s*[:՝]\s*\{staff\}[.։]/g, '')
    .replace(/\s*(?:Адрес|Address|Հասցե)\s*[:՝]\s*\{address\}[.։]/g, '')
    // Вставка «, мастер: {staff}» внутри предложения
    .replace(/,\s*(?:мастер|specialist|վարպետ)\s*[:՝]\s*\{staff\}/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  const hasDate = full.includes('{date}');
  const hasLink = full.includes('{link}');
  const hasCompany = full.includes('{companyName}');
  const short = hasDate ? `${hasCompany ? '{companyName}: ' : ''}{date} {time}${hasLink ? ' {link}' : ''}`.trim() : null;
  const variants = [full, medium !== full ? medium : null, short].filter(
    (v, i, arr): v is string => !!v && arr.indexOf(v) === i,
  );
  return variants.length > 0 ? variants : [full];
}

/** Функция ТЗ конкретного клиентского типа (F-05-024…F-05-040) — на каждый code ровно одна */
export const CLIENT_TYPE_FID: Record<number, string> = {
  2: 'F-05-024',
  8: 'F-05-025',
  9: 'F-05-026',
  74: 'F-05-027',
  73: 'F-05-028',
  1: 'F-05-029',
  4: 'F-05-030',
  75: 'F-05-031',
  72: 'F-05-032',
  6: 'F-05-033',
  20: 'F-05-033',
  3: 'F-05-034',
  16: 'F-05-035',
  17: 'F-05-036',
  55: 'F-05-037',
  85: 'F-05-038',
  7: 'F-05-039',
  65: 'F-05-040',
};

/** Тип 7 — системный шаблон, свой текст нельзя, только выбор одного из двух (F-05-020, F-05-039) */
export const SYSTEM_TYPE7_TEMPLATES: { ru: string; en: string; hy: string }[] = [
  { ru: 'Код подтверждения: {code}', en: 'Confirmation code: {code}', hy: 'Հաստատման կոդ՝ {code}' },
  { ru: '{companyName}: код подтверждения {code}', en: '{companyName}: confirmation code {code}', hy: '{companyName}․ հաստատման կոդ՝ {code}' },
];

/**
 * Строит полный набор типов уведомлений нового бизнеса из реестра (F-05-004) — вызывается сидом
 * среза (src/mock/slices/notify.ts) и тестами движка (F-05-043, src/areas/notify/lib/liveLog.test.ts),
 * чтобы обе стороны строили ОДНИ И ТЕ ЖЕ типы и не расходились.
 */
export function buildTypes(businessId: Id): NotificationType[] {
  return TYPE_REGISTRY.map((def) => {
    const template: LocalizedText = { ru: def.templateRu, en: def.templateEn, hy: def.templateHy };
    const templates: Partial<Record<NotifyChannel, LocalizedText>> = {};
    const smsShort = smsDefaultOf(def.code);
    def.availableChannels.forEach((channel) => {
      // 28.09: SMS — свой короткий текст (одна часть = 25 ֏), остальные каналы — полный
      templates[channel] = channel === 'sms' && smsShort ? { ...smsShort } : { ...template };
    });
    return {
      id: `nt_${businessId}_${def.code}`,
      code: def.code,
      recipient: def.recipient,
      group: def.group,
      name: { ru: def.nameRu, en: def.nameEn, hy: def.nameHy },
      description: { ru: def.descriptionRu, en: def.descriptionEn, hy: def.descriptionHy },
      enabled: def.enabledDefault,
      availableChannels: def.availableChannels,
      channels: def.availableChannels.map((channel) => ({
        channel,
        scenario: def.defaultScenario[channel] ?? 'off',
      })),
      templates,
      emailExtra: def.availableChannels.includes('email') ? { enabled: false, indent: false, text: '' } : undefined,
      conditions: def.conditionsDefault ? { ...def.conditionsDefault } : undefined,
      alwaysOn: def.alwaysOn,
      systemLocked: def.systemLocked,
    };
  });
}

/**
 * 28.09 — короткие SMS по умолчанию без подъёма версии среза (подъём пересеял бы срез и стёр правки салонов):
 * у сохранённых типов SMS-текст, который совпадает с прежним полным текстом по умолчанию (или пуст), заменяется
 * коротким; текст, который салон уже правил, не трогаем — сравнение по каждому языку отдельно.
 */
export function upgradeSmsDefaults(types: NotificationType[]): NotificationType[] {
  let changed = false;
  const next = types.map((type) => {
    const short = smsDefaultOf(type.code);
    const def = TYPE_REGISTRY.find((d) => d.code === type.code);
    if (!short || !def || !type.availableChannels.includes('sms')) return type;
    const current = type.templates.sms;
    const oldFull: LocalizedText = { ru: def.templateRu, en: def.templateEn, hy: def.templateHy };
    const pick = (lang: NotifyLanguage): string => {
      const value = current?.[lang];
      return !value || value === oldFull[lang] ? short[lang] : value;
    };
    const sms: LocalizedText = { ru: pick('ru'), en: pick('en'), hy: pick('hy') };
    if (current && sms.ru === current.ru && sms.en === current.en && sms.hy === current.hy) return type;
    changed = true;
    return { ...type, templates: { ...type.templates, sms } };
  });
  return changed ? next : types;
}
