/**
 * Определения правил лояльности/абонементов/писем (F-05-081, F-05-100…F-05-106, F-05-127, F-05-128,
 * F-05-136) — экран `/biz/notifications/loyalty`. Живут отдельно от TYPE_REGISTRY (F-05-004: нумерация
 * типов Altegio 1:1) — эти события у Altegio настраиваются в разделе «Лояльность», у нас лояльность и
 * абонементы не построены (F-00-197 не подтверждено), поэтому набор — свой, компактный, с готовыми
 * шаблонами + «свой текст», как в ТЗ.
 */
import type { LoyaltyNotifyEventCode, LoyaltyNotifyTemplateOption } from '@/domain/notify';

export interface LoyaltyNotifyDef {
  code: LoyaltyNotifyEventCode;
  fId: string;
  nameRu: string;
  nameEn: string;
  hintRu: string;
  hintEn: string;
  channel: 'sms' | 'push' | 'email';
  enabledDefault: boolean;
  presets: LoyaltyNotifyTemplateOption[];
  daysBeforeDefault?: number;
  visitsLeftDefault?: number;
  regionOnly?: 'KZ' | 'BR';
}

function preset(id: string, ru: string, en: string): LoyaltyNotifyTemplateOption {
  return { id, text: { ru, en } };
}

export const LOYALTY_NOTIFY_DEFS: LoyaltyNotifyDef[] = [
  {
    code: 'cardIssued',
    fId: 'F-05-100',
    nameRu: 'Выпуск карты лояльности',
    nameEn: 'Loyalty card issued',
    hintRu: 'Клиент получает SMS о новой карте сети.',
    hintEn: 'The client gets an SMS about the new network card.',
    channel: 'sms',
    enabledDefault: true,
    presets: [
      preset('p1', 'Вам выпущена карта {CARD_TITLE} №{CARD_NUMBER} в сети {GROUP_TITLE}.', 'Your card {CARD_TITLE} #{CARD_NUMBER} in {GROUP_TITLE} is ready.'),
      preset('p2', 'Добро пожаловать в программу лояльности {GROUP_TITLE}! Карта: {CARD_TITLE}.', 'Welcome to the {GROUP_TITLE} loyalty programme! Card: {CARD_TITLE}.'),
      preset('p3', 'Карта {CARD_TITLE} готова. Показывайте номер {CARD_NUMBER} при визите.', 'Card {CARD_TITLE} is ready. Show number {CARD_NUMBER} on your visit.'),
    ],
  },
  {
    code: 'pointsEarned',
    fId: 'F-05-100',
    nameRu: 'Начисление бонусов',
    nameEn: 'Points earned',
    hintRu: 'Клиент получает SMS о новых бонусах на карте.',
    hintEn: 'The client gets an SMS about new points on the card.',
    channel: 'sms',
    enabledDefault: true,
    presets: [
      preset('p1', 'Начислено {BONUS} бонусов на карту {CARD_TITLE}. Баланс: {CARD_BALANCE}.', '{BONUS} points added to card {CARD_TITLE}. Balance: {CARD_BALANCE}.'),
      preset('p2', 'Спасибо за визит! +{BONUS} бонусов, баланс {CARD_BALANCE}.', 'Thanks for your visit! +{BONUS} points, balance {CARD_BALANCE}.'),
      preset('p3', 'На карте {CARD_NUMBER} теперь {CARD_BALANCE} бонусов (+{BONUS}).', 'Card {CARD_NUMBER} now has {CARD_BALANCE} points (+{BONUS}).'),
    ],
  },
  {
    code: 'pointsSpent',
    fId: 'F-05-100',
    nameRu: 'Списание бонусов',
    nameEn: 'Points spent',
    hintRu: 'Клиент получает SMS о списании бонусов.',
    hintEn: 'The client gets an SMS about points being spent.',
    channel: 'sms',
    enabledDefault: true,
    presets: [
      preset('p1', 'Списано {BONUS} бонусов с карты {CARD_TITLE}. Остаток: {CARD_BALANCE}.', '{BONUS} points spent from card {CARD_TITLE}. Remaining: {CARD_BALANCE}.'),
      preset('p2', 'Оплата бонусами: -{BONUS}, баланс {CARD_BALANCE}.', 'Paid with points: -{BONUS}, balance {CARD_BALANCE}.'),
      preset('p3', 'Списание {BONUS} бонусов на карте {CARD_NUMBER}. Осталось {CARD_BALANCE}.', '{BONUS} points spent on card {CARD_NUMBER}. {CARD_BALANCE} left.'),
    ],
  },
  {
    code: 'promoDiscountChanged',
    fId: 'F-05-101',
    nameRu: 'Изменение скидки по акции',
    nameEn: 'Promo discount changed',
    hintRu: 'Уходит при изменении размера накопительной скидки.',
    hintEn: 'Sent when the cumulative discount size changes.',
    channel: 'sms',
    enabledDefault: false,
    presets: [
      preset('p1', 'Ваша скидка по {GROUP_TITLE} теперь {DISCOUNT}%.', 'Your discount at {GROUP_TITLE} is now {DISCOUNT}%.'),
      preset('p2', 'Скидка карты {CARD_TITLE} изменена: {DISCOUNT}%.', 'Card {CARD_TITLE} discount changed: {DISCOUNT}%.'),
      preset('p3', 'Новый размер скидки: {DISCOUNT}%. Спасибо, что вы с нами!', 'New discount size: {DISCOUNT}%. Thanks for staying with us!'),
    ],
  },
  {
    code: 'promoDiscountEndingSoon',
    fId: 'F-05-101',
    nameRu: 'Скорое окончание скидки',
    nameEn: 'Discount ending soon',
    hintRu: 'Только у акций со сбросом при долгом отсутствии.',
    hintEn: 'Only for promos that reset after a long absence.',
    channel: 'sms',
    enabledDefault: false,
    daysBeforeDefault: 7,
    presets: [
      preset('p1', 'Скидка {DISCOUNT}% сгорит {BURN_DATE} — успейте записаться.', 'Your {DISCOUNT}% discount expires on {BURN_DATE} — book in time.'),
      preset('p2', 'Через {DAYS} дн. скидка {DISCOUNT}% сбросится. Ждём вас!', 'In {DAYS} days your {DISCOUNT}% discount resets. See you soon!'),
      preset('p3', 'Не теряйте скидку {DISCOUNT}% — она действует до {BURN_DATE}.', "Don't lose your {DISCOUNT}% discount — valid until {BURN_DATE}."),
    ],
  },
  {
    code: 'promoCashbackEarned',
    fId: 'F-05-101',
    nameRu: 'Начисление кэшбэка',
    nameEn: 'Cashback earned',
    hintRu: 'Уходит при начислении бонусной программой.',
    hintEn: 'Sent when the bonus programme credits cashback.',
    channel: 'sms',
    enabledDefault: false,
    presets: [
      preset('p1', 'Начислен кэшбэк {CASHBACK}%. Спасибо за визит!', 'Cashback {CASHBACK}% credited. Thanks for your visit!'),
      preset('p2', 'Вам вернулось {CASHBACK}% бонусами.', "You've got {CASHBACK}% back as points."),
      preset('p3', 'Кэшбэк {CASHBACK}% уже на карте.', 'Your {CASHBACK}% cashback is already on the card.'),
    ],
  },
  {
    code: 'promoBonusBurningSoon',
    fId: 'F-05-101',
    nameRu: 'Скорое сгорание бонусов',
    nameEn: 'Bonuses expiring soon',
    hintRu: 'Только у бонусных акций со сжиганием неиспользованных бонусов.',
    hintEn: 'Only for bonus promos that burn unused points.',
    channel: 'sms',
    enabledDefault: false,
    daysBeforeDefault: 5,
    presets: [
      preset('p1', '{BONUS} бонусов сгорят {BURN_DATE}. Успейте использовать.', '{BONUS} points expire on {BURN_DATE}. Use them in time.'),
      preset('p2', 'Через {DAYS} дн. сгорит {BONUS} бонусов.', '{BONUS} points expire in {DAYS} days.'),
      preset('p3', 'Не забудьте использовать {BONUS} бонусов до {BURN_DATE}.', "Don't forget to use {BONUS} points before {BURN_DATE}."),
    ],
  },
  {
    code: 'subscriptionEndingSoon',
    fId: 'F-05-102',
    nameRu: 'Окончание абонемента',
    nameEn: 'Subscription ending soon',
    hintRu: 'Уходит через 24 часа после срабатывания триггера, 9:00–21:00 по времени локации.',
    hintEn: 'Sent 24 hours after the trigger fires, 9:00–21:00 local time.',
    channel: 'sms',
    enabledDefault: false,
    daysBeforeDefault: 5,
    visitsLeftDefault: 1,
    presets: [
      preset('p1', 'Абонемент {CARD_TITLE} закончится {EXPIRATION_DATE}. Осталось визитов: {VISITS_LEFT}.', 'Subscription {CARD_TITLE} ends on {EXPIRATION_DATE}. Visits left: {VISITS_LEFT}.'),
      preset('p2', 'Остался {VISITS_LEFT} визит по абонементу — успейте продлить.', '{VISITS_LEFT} visit left on your subscription — renew in time.'),
      preset('p3', 'Срок абонемента истекает {EXPIRATION_DATE}.', 'Your subscription expires on {EXPIRATION_DATE}.'),
    ],
  },
  {
    code: 'subscriptionCharge',
    fId: 'F-05-103',
    nameRu: 'Списание с абонемента',
    nameEn: 'Subscription visit charged',
    hintRu: 'Уходит сразу при оплате визита абонементом или автосписании.',
    hintEn: 'Sent immediately when a visit is paid from the subscription or auto-charged.',
    channel: 'sms',
    enabledDefault: true,
    presets: [
      preset('p1', 'Списан 1 визит по абонементу {CARD_TITLE}. Осталось: {VISITS_LEFT}.', '1 visit charged from subscription {CARD_TITLE}. Left: {VISITS_LEFT}.'),
      preset('p2', 'Визит {VISIT_DATE} оплачен абонементом. Остаток визитов: {VISITS_LEFT}.', 'Visit on {VISIT_DATE} paid from the subscription. Visits left: {VISITS_LEFT}.'),
      preset('p3', 'Абонемент {CARD_TITLE}: списано {VISITS}, осталось {VISITS_LEFT}.', 'Subscription {CARD_TITLE}: {VISITS} charged, {VISITS_LEFT} left.'),
    ],
  },
  {
    code: 'onlinePurchaseReceipt',
    fId: 'F-05-106',
    nameRu: 'Покупка абонемента/сертификата онлайн',
    nameEn: 'Online subscription/certificate purchase',
    hintRu: 'Письмо клиенту с покупкой и уведомление бизнесу о новом заказе.',
    hintEn: 'An email to the client with the purchase, and a new-order alert to the business.',
    channel: 'email',
    enabledDefault: true,
    presets: [
      preset('p1', 'Спасибо за покупку! Ваш абонемент/сертификат {CARD_TITLE} готов к использованию.', 'Thanks for your purchase! Your subscription/certificate {CARD_TITLE} is ready to use.'),
      preset('p2', 'Оплата получена. Детали покупки — во вложении.', 'Payment received. Purchase details are attached.'),
      preset('p3', 'Ваш заказ {CARD_TITLE} оформлен и оплачен.', 'Your order {CARD_TITLE} is placed and paid.'),
    ],
  },
  {
    code: 'autoRenewalUpcoming',
    fId: 'F-05-128',
    nameRu: 'Скоро списание за автопродление',
    nameEn: 'Auto-renewal charge coming up',
    hintRu: 'За 3 дня до списания, с кнопкой отмены. ⭐ демо — работает только в Бразилии (AltPay).',
    hintEn: 'Sent 3 days before the charge, with a cancel button. ⭐ demo — Brazil only (AltPay).',
    channel: 'email',
    enabledDefault: false,
    daysBeforeDefault: 3,
    regionOnly: 'BR',
    presets: [
      preset('p1', 'Через 3 дня со счёта спишется оплата за абонемент {CARD_TITLE}. Отменить можно в любой момент.', 'In 3 days your card will be charged for subscription {CARD_TITLE}. You can cancel any time.'),
      preset('p2', 'Скоро автопродление {CARD_TITLE}. Не хотите продлевать — отмените сейчас.', 'Auto-renewal for {CARD_TITLE} is coming up. Cancel now if you don’t want it.'),
    ],
  },
  {
    code: 'autoRenewalCharged',
    fId: 'F-05-128',
    nameRu: 'Чек после автопродления',
    nameEn: 'Auto-renewal receipt',
    hintRu: 'Сразу после покупки — чек и кнопка отмены. ⭐ демо — только Бразилия.',
    hintEn: 'Right after the purchase — a receipt and a cancel button. ⭐ demo — Brazil only.',
    channel: 'email',
    enabledDefault: false,
    regionOnly: 'BR',
    presets: [
      preset('p1', 'Оплата за абонемент {CARD_TITLE} прошла. Чек во вложении.', 'Payment for subscription {CARD_TITLE} went through. Receipt attached.'),
      preset('p2', 'Списание выполнено. Отменить автопродление можно в любой момент.', 'Charge completed. You can cancel auto-renewal any time.'),
    ],
  },
  {
    code: 'autoRenewalCancelled',
    fId: 'F-05-128',
    nameRu: 'Автопродление отменено',
    nameEn: 'Auto-renewal cancelled',
    hintRu: 'После отмены абонемент остаётся активным до конца срока. ⭐ демо — только Бразилия.',
    hintEn: 'After cancellation the subscription stays active until it expires. ⭐ demo — Brazil only.',
    channel: 'email',
    enabledDefault: false,
    regionOnly: 'BR',
    presets: [
      preset('p1', 'Автопродление {CARD_TITLE} отменено. Абонемент действует до конца срока.', 'Auto-renewal for {CARD_TITLE} is cancelled. The subscription stays active until it expires.'),
      preset('p2', 'Готово — больше не будем списывать за {CARD_TITLE}.', "Done — we won't charge you for {CARD_TITLE} anymore."),
    ],
  },
  {
    code: 'autoRenewalFailed',
    fId: 'F-05-128',
    nameRu: 'Неудачное списание автопродления',
    nameEn: 'Auto-renewal payment failed',
    hintRu: 'Абонемент отменяется при неудачном списании. ⭐ демо — только Бразилия.',
    hintEn: 'The subscription is cancelled on a failed charge. ⭐ demo — Brazil only.',
    channel: 'email',
    enabledDefault: false,
    regionOnly: 'BR',
    presets: [
      preset('p1', 'Не удалось списать оплату за {CARD_TITLE} — абонемент отменён.', 'Could not charge for {CARD_TITLE} — the subscription was cancelled.'),
      preset('p2', 'Проверьте карту: списание за {CARD_TITLE} не прошло.', 'Please check your card: the charge for {CARD_TITLE} failed.'),
    ],
  },
  {
    code: 'formLinkAfterBooking',
    fId: 'F-05-136',
    nameRu: 'Ссылка на анкету после записи',
    nameEn: 'Survey link after booking',
    hintRu: 'Клиенту при первом визите; повторным клиентам не приходит. ⭐ демо-механизм (FastSign/QR Forms — 1:1).',
    hintEn: 'To the client on their first visit; repeat clients don’t get it. ⭐ demo mechanism (FastSign/QR Forms — 1:1).',
    channel: 'sms',
    enabledDefault: false,
    presets: [
      preset('p1', 'Заполните короткую анкету перед визитом: {FORM_LINK}', 'Please fill in a short form before your visit: {FORM_LINK}'),
      preset('p2', 'Нужно ваше согласие — заполните форму: {FORM_LINK}', 'We need your consent — fill in the form: {FORM_LINK}'),
    ],
  },
];

export function loyaltyNotifyLabel(code: LoyaltyNotifyEventCode): { nameRu: string; nameEn: string } {
  const def = LOYALTY_NOTIFY_DEFS.find((d) => d.code === code);
  return def ? { nameRu: def.nameRu, nameEn: def.nameEn } : { nameRu: code, nameEn: code };
}
