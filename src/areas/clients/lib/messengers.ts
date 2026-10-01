/**
 * Ссылки на мессенджеры по номеру (F-04-067): waLink/telLink уже есть в фундаменте (@/lib/phone),
 * Telegram — только здесь, пока не понадобился где-то ещё (иначе — просьба в qa/requests/clients.md).
 */
import { normalizePhone } from '@/lib/phone';

export function tgLink(phone: string): string {
  const n = (normalizePhone(phone) ?? phone).replace('+', '');
  return `https://t.me/+${n}`;
}

/** Viber доступен в Армении (F-04-067): открывает чат с номером в приложении Viber. */
export function viberLink(phone: string): string {
  const n = normalizePhone(phone) ?? phone;
  return `viber://chat?number=${encodeURIComponent(n)}`;
}
