/**
 * Короткие тексты SMS по умолчанию (28.09, решение владельца «как по-твоему правильно»): одна SMS-часть = 25 ֏.
 * Кириллица и армянский уходят в UCS-2 — 70 символов в одной SMS (67 в части длинной), поэтому полный текст
 * «вас записали — услуга, дата, мастер, подробности…» (~150 символов) шёл тремя частями, 75 ֏.
 *
 * Правила коротких текстов:
 *  - {companyName} в начале остаётся — SMS приходит с общего имени отправителя, без него непонятно, от кого;
 *  - мастер, адрес и слова-связки убраны; услуга — только в en (латиница = GSM-7, 160 символов);
 *  - ссылки в SMS — короткие `booktime.am/s/<код>` (liveLog → smsVars), дата — «ДД.ММ» без года;
 *  - en — только символы GSM-7 (никаких ’ — “ ” ★): один такой символ переводит всю SMS в UCS-2 (70 символов).
 * Прочие каналы (пуш, Email, WhatsApp) берут полный текст из TYPE_REGISTRY. Тип 7 (код входа, системный) уже
 * укладывается в одну часть полным текстом — своего короткого варианта у него нет.
 * Проверка длины — `node src/areas/notify/lib/run-tests.mjs` (smsDefaults.test.ts; SMS_TABLE=1 — таблица «было → стало»).
 */
import type { LocalizedText } from '@/domain/core';

export const SMS_DEFAULTS: Record<number, Required<LocalizedText>> = {
  2: {
    ru: '{companyName}: вы записаны {date} в {time}. {link}',
    hy: '{companyName}․ գրանցված եք {date} {time}։ {link}',
    en: "{companyName}: you're booked for {service}, {date} at {time}. Details, reschedule or cancel: {link}",
  },
  8: {
    ru: '{companyName}: вы записаны {date} в {time}. {link}',
    hy: '{companyName}․ գրանցված եք {date} {time}։ {link}',
    en: '{companyName}: you have been booked for {service}, {date} at {time}. Details, reschedule or cancel: {link}',
  },
  9: {
    ru: '{companyName}: ждём вас {date} в {time}. {link}',
    hy: '{companyName}․ սպասում ենք ձեզ {date} {time}։ {link}',
    en: '{companyName}: your booking {date} at {time} is confirmed. Details: {link}',
  },
  74: {
    ru: '{companyName}: запись изменена, {date} {time} {link}',
    hy: '{companyName}․ գրանցումը փոխվեց՝ {date} {time}։ {link}',
    en: '{companyName}: your booking has changed. Now: {service}, {date} at {time}. Details: {link}',
  },
  73: {
    ru: '{companyName}: придёте {date} в {time}? {link}',
    hy: '{companyName}․ հաստատեք այցը՝ {date} {time}։ {link}',
    en: '{companyName}: please confirm your visit {date} at {time} ({service}). Confirm or cancel: {link}',
  },
  1: {
    ru: '{companyName}: напоминаем, {date} в {time}. {link}',
    hy: '{companyName}․ հիշեցում՝ {date} {time}։ {link}',
    en: "{companyName}: reminder of your visit {date} at {time}, {service}. Can't make it? {link}",
  },
  4: {
    ru: '{companyName}: запись {date} {time} отменена. {bookingLink}',
    hy: '{companyName}․ {date} {time} այցը չեղարկվեց։ {bookingLink}',
    en: '{companyName}: your booking {date} at {time} was cancelled. Book again: {bookingLink}',
  },
  75: {
    ru: '{companyName}: жаль, что не вышло. Запись: {bookingLink}',
    hy: '{companyName}․ ափսոս, որ չստացվեց։ Գրանցում՝ {bookingLink}',
    en: '{companyName}: you missed your booking {date} at {time}. Book another time: {bookingLink}',
  },
  72: {
    ru: '{companyName}: запишитесь на удобное время: {bookingLink}',
    hy: '{companyName}․ գրանցվեք ձեզ հարմար ժամի՝ {bookingLink}',
    en: '{companyName}: we noticed you could not make it. Book a time that suits you: {bookingLink}',
  },
  6: {
    ru: '{companyName}: спасибо за визит! Оцените ★ {reviewLink}',
    hy: '{companyName}․ շնորհակալ ենք։ Գնահատեք այցը՝ {reviewLink}',
    en: '{companyName}: thanks for visiting! Did you like it? Rate your visit: {reviewLink}',
  },
  20: {
    ru: '{companyName}: спасибо за визит! Оцените ★ {reviewLink}',
    hy: '{companyName}․ շնորհակալ ենք։ Գնահատեք այցը՝ {reviewLink}',
    en: '{companyName}: thanks for visiting! Did you like it? Rate your visit: {reviewLink}',
  },
  3: {
    ru: '{companyName}: {clientName}, с днём рождения! {bookingLink}',
    hy: '{companyName}․ {clientName}, շնորհավոր ծննդյան օրը։ {bookingLink}',
    en: '{companyName}: happy birthday, {clientName}! Wishing you a great day. Come see us: {bookingLink}',
  },
  16: {
    ru: '{companyName}: ваша скидка {discount}%. Записаться: {bookingLink}',
    hy: '{companyName}․ ձեր զեղչը՝ {discount}%։ Գրանցվել՝ {bookingLink}',
    en: '{companyName}: you have been given a {discount}% discount. Book: {bookingLink}',
  },
  17: {
    ru: '{companyName}: скидка {discount}% сгорит через {days} дн. {bookingLink}',
    hy: '{companyName}․ {discount}% զեղչը կավարտվի {days} օրից։ {bookingLink}',
    en: '{companyName}: your {discount}% discount ends in {days} day(s). Book in time: {bookingLink}',
  },
  55: {
    ru: '{companyName}: давно вас не было! Ждём: {bookingLink}',
    hy: '{companyName}․ վաղուց չեք եղել։ Սպասում ենք՝ {bookingLink}',
    en: '{companyName}: it has been a while since your "{service}". Book a convenient time: {bookingLink}',
  },
  85: {
    ru: '{companyName}: оплата визита {date} {time}: {paymentLink}',
    hy: '{companyName}․ այցի վճարում ({date} {time})՝ {paymentLink}',
    en: '{companyName}: pay for your visit {date} at {time} via the link: {paymentLink}',
  },
  65: {
    ru: '{companyName}: оплата {amount} ֏ прошла. Ждём вас {date} в {time}.',
    hy: '{companyName}․ {amount} ֏ վճարված է։ Սպասում ենք {date} {time}։',
    en: '{companyName}: payment of {amount} AMD received. See you {date} at {time}.',
  },
};

/** Короткий SMS-текст по умолчанию для типа (нет — берётся общий текст типа) */
export function smsDefaultOf(code: number): Required<LocalizedText> | undefined {
  return SMS_DEFAULTS[code];
}
