/**
 * Телефоны Армении: хранение '+374XXXXXXXX' (8 цифр), показ '+374 XX XXX XXX'.
 * В демо-данных только выдуманные номера с кодом 00 (такого оператора нет): +374 00 1XX XXX.
 */
export const PHONE_PREFIX = '+374';
export const PHONE_DIGITS = 8;

/** Любой ввод → '+374XXXXXXXX' или undefined, если цифр не 8 */
export function normalizePhone(input: string): string | undefined {
  let digits = input.replace(/\D/g, '');
  if (digits.startsWith('374')) digits = digits.slice(3);
  if (digits.startsWith('0') && digits.length === PHONE_DIGITS + 1) digits = digits.slice(1);
  return digits.length === PHONE_DIGITS ? `${PHONE_PREFIX}${digits}` : undefined;
}

/** 8 местных цифр → 'XX XXX XXX' (частичный ввод тоже; обычные пробелы — для поля ввода) */
export function formatLocalDigits(digits: string): string {
  const d = digits.replace(/\D/g, '').slice(0, PHONE_DIGITS);
  return [d.slice(0, 2), d.slice(2, 5), d.slice(5, 8)].filter(Boolean).join(' ');
}

const NBSP = '\u00A0';

/** '+37400123456' → '+374 00 123 456' (неразрывные пробелы: номер не переносится по строкам) */
export function formatPhone(phone: string): string {
  const normalized = normalizePhone(phone);
  if (!normalized) return phone;
  return `${PHONE_PREFIX} ${formatLocalDigits(normalized.slice(4))}`.replace(/ /g, NBSP);
}

/** Местные 8 цифр из хранимого номера */
export function localDigits(phone: string | undefined): string {
  if (!phone) return '';
  const normalized = normalizePhone(phone);
  return normalized ? normalized.slice(4) : phone.replace(/\D/g, '').slice(-PHONE_DIGITS);
}

/** Маскировка номера (право «видеть телефоны клиентов»): '+374 00 1•• •56' */
export function maskPhone(phone: string): string {
  const d = localDigits(phone);
  if (d.length < PHONE_DIGITS) return phone;
  return `${PHONE_PREFIX} ${d.slice(0, 2)} ${d[2]}•• •${d.slice(6)}`.replace(/ /g, NBSP);
}

/** Ссылки для связи (F-00-104) */
export function waLink(phone: string, text?: string): string {
  const n = (normalizePhone(phone) ?? phone).replace('+', '');
  return `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}
export function telLink(phone: string): string {
  return `tel:${normalizePhone(phone) ?? phone}`;
}
