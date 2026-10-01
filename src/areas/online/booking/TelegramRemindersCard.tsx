'use client';

/**
 * ⭐ «Напоминания в Telegram» на странице записи (30.09.2026): бесплатный канал для клиента без нашего приложения —
 * бот пришлёт напоминание за сутки и за 2 часа с кнопками «Приду / Перенести / Отменить». В режиме api ссылку на бота
 * (POST, каждый раз новый код, общий лимит с отменой и «Я оплатил») берём только по нажатию «Подключить», а когда
 * клиент вернулся из Telegram — спрашиваем ещё раз, подключился ли он. В демо настоящего бота нет — подключение только
 * отмечается.
 */
import { BellRing, Check, Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import { connectBookingTelegramDemo, getBookingTelegramLink } from '@/api/online';
import { isApiMode } from '@/api/http';
import { useApiMutation, useApiQuery } from '@/api/request';
import type { TelegramLinkInfo } from '@/domain/client';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { useToast } from '@/ui/Toast';

export function TelegramRemindersCard({ bookingId, hash }: { bookingId: string; hash: string }) {
  const t = useT('online');
  const toast = useToast();
  const api = isApiMode();
  // Демо: состояние «подключено» читаем сразу (лимитов нет). Api: не читаем, пока клиент не нажал «Подключить»
  const q = useApiQuery(['online', 'telegram-link', bookingId], () => getBookingTelegramLink(bookingId, hash), { enabled: !api });
  const demo = useApiMutation(() => connectBookingTelegramDemo(bookingId, hash), { invalidates: [['online', 'telegram-link', bookingId]] });
  const link = useApiMutation(() => getBookingTelegramLink(bookingId, hash));
  const [info, setInfo] = useState<TelegramLinkInfo>();
  const [waitingReturn, setWaitingReturn] = useState(false);

  // Вернулся из Telegram — узнаём, нажал ли он «Старт» (один запрос на возврат, а не на каждое открытие страницы)
  useEffect(() => {
    if (!waitingReturn) return;
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      setWaitingReturn(false);
      link
        .mutate(undefined)
        .then(setInfo)
        .catch(() => undefined);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [waitingReturn, link]);

  const data = info ?? q.data;
  // Демо: нет данных (запрос упал — например, у записи нет телефона) — карточку не показываем
  if (!api && !q.data) return null;
  const linked = Boolean(data?.linked);

  const connect = async () => {
    if (!api) {
      try {
        await demo.mutate(undefined);
        toast.success(t('confirmed.telegram.demoLinked'));
      } catch {
        toast.error(t('confirmed.telegram.failed'));
      }
      return;
    }
    // Окно открываем сразу, по нажатию (иначе браузер заблокирует всплывающее окно после ожидания ответа)
    const win = window.open('about:blank', '_blank');
    try {
      const next = await link.mutate(undefined);
      setInfo(next);
      if (next.linked) {
        win?.close();
        return;
      }
      if (win) {
        win.opener = null;
        win.location.href = next.url;
      } else {
        window.open(next.url, '_blank', 'noopener,noreferrer');
      }
      setWaitingReturn(true);
    } catch {
      win?.close();
      toast.error(t('confirmed.telegram.failed'));
    }
  };

  return (
    <Card padding="md" className="flex flex-col gap-3" data-f="F-00-120">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-soft text-primary-text">
          <BellRing aria-hidden className="size-4" />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="text-sm font-semibold text-fg">{t('confirmed.telegram.title')}</p>
          <p className="text-sm text-muted">{linked ? t('confirmed.telegram.linkedText') : t('confirmed.telegram.text')}</p>
        </div>
      </div>
      {linked ? (
        <p className="inline-flex items-center gap-1.5 text-sm font-medium text-success">
          <Check aria-hidden className="size-4" />
          {t('confirmed.telegram.linked')}
        </p>
      ) : (
        <Button variant="secondary" leftIcon={<Send aria-hidden />} loading={demo.isPending || link.isPending} onClick={() => void connect()}>
          {t('confirmed.telegram.connect')}
        </Button>
      )}
    </Card>
  );
}
