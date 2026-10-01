/**
 * Мини-движок предпросмотра доставки (F-05-007 сценарии, F-05-008 каскад «пуш не доставлен → резерв»).
 * Чистая функция без обращения к базе — используется в TypeDetailScreen, чтобы показать, что реально уйдёт.
 */
import type { NotificationType, NotifyChannel } from '@/domain/notify';

export interface DeliveryPreview {
  willSend: NotifyChannel[];
  skipped: NotifyChannel[];
}

/** Порядок проверки каналов (F-05-007): Email/приложение администратора первыми, потом пуш, потом резерв SMS */
const CHECK_ORDER: NotifyChannel[] = ['email', 'adminApp', 'push', 'brandedApp', 'telegram', 'sms'];

const APP_CHANNELS = new Set<NotifyChannel>(['push', 'brandedApp']);

/**
 * hasApp — есть ли у клиента наше приложение (или брендированное); для типов администратора/сотрудника
 * не важно (adminApp считается всегда доставленным в демо).
 */
/**
 * hasTelegram — клиент подключил нашего бесплатного Telegram-бота (⭐ напоминания 1, 73, 30.09.2026). Не указано —
 * считаем подключённым (предпросмотр типа: «что уйдёт, если бот есть»). Не подключён — Telegram не доставлен,
 * как пуш без приложения: сообщения в Telegram нет, срабатывает резерв.
 */
export function previewDelivery(type: NotificationType, hasApp: boolean, hasTelegram = true): DeliveryPreview {
  const willSend: NotifyChannel[] = [];
  const skipped: NotifyChannel[] = [];
  if (!type.enabled) return { willSend, skipped: [...type.availableChannels] };

  let deliveryFailed = false;
  for (const channel of CHECK_ORDER) {
    if (!type.availableChannels.includes(channel)) continue;
    const scenario = type.channels.find((c) => c.channel === channel)?.scenario ?? 'off';
    if (scenario === 'off') {
      skipped.push(channel);
      continue;
    }
    if (scenario === 'fallback') {
      if (deliveryFailed) willSend.push(channel);
      else skipped.push(channel);
      continue;
    }
    // 'always'
    // ⭐ Одно правило Telegram-напоминаний (как сервер telegram-reminders.ts, 01.10.2026): клиенту С приложением
    // уходит пуш, в Telegram ничего не дублируется. Код входа (7) — не напоминание, к нему правило не относится.
    if (channel === 'telegram' && hasApp && type.code !== 7) {
      skipped.push(channel);
      continue;
    }
    if ((APP_CHANNELS.has(channel) && !hasApp) || (channel === 'telegram' && !hasTelegram)) {
      deliveryFailed = true;
      skipped.push(channel);
      continue;
    }
    willSend.push(channel);
  }
  return { willSend, skipped };
}
