'use client';

/**
 * ⭐ «Напоминания в Telegram» в профиле клиента (F-00-120, 30.09.2026): бот пришлёт напоминание за сутки и за 2 часа
 * с кнопками «Приду / Перенести / Отменить» — по правилу сервера (telegram-reminders.ts) только когда у человека нет
 * живого пуша приложения (пуш выключен / вход с сайта); с пушем в Telegram ничего не дублируется (01.10.2026). В режиме api кнопка открывает бота с кодом привязки номера; в демо
 * настоящего бота нет — подключение только отмечается (connectMyTelegramDemo).
 */
import { BellRing, Check, Send } from 'lucide-react';
import { connectMyTelegramDemo, getMyTelegramLink } from '@/api/client';
import { isApiMode } from '@/api/http';
import { useApiMutation, useApiQuery } from '@/api/request';
import type { Id } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { useToast } from '@/ui/Toast';

export function TelegramRemindersCard({ appUserId }: { appUserId: Id }) {
  const t = useT('client');
  const toast = useToast();
  const key = ['client', 'telegram-link', appUserId];
  const q = useApiQuery(key, () => getMyTelegramLink(appUserId));
  const demo = useApiMutation(() => connectMyTelegramDemo(appUserId), { invalidates: [key] });
  if (!q.data) return null;

  const connect = async () => {
    if (isApiMode()) {
      window.open(q.data!.url, '_blank', 'noopener,noreferrer');
      return;
    }
    try {
      await demo.mutate(undefined);
      toast.success(t('profile.telegram.demoLinked'));
    } catch {
      toast.error(t('bookingDetail.actionFailed'));
    }
  };

  return (
    <Card padding="md" className="flex flex-col gap-3" data-f="F-00-120">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-soft text-primary-text">
          <BellRing aria-hidden className="size-4" />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="text-sm font-semibold text-fg">{t('profile.telegram.title')}</p>
          <p className="text-sm text-muted">{q.data.linked ? t('profile.telegram.linkedText') : t('profile.telegram.text')}</p>
        </div>
      </div>
      {q.data.linked ? (
        <p className="inline-flex items-center gap-1.5 text-sm font-medium text-success">
          <Check aria-hidden className="size-4" />
          {t('profile.telegram.linked')}
        </p>
      ) : (
        <Button variant="secondary" leftIcon={<Send aria-hidden />} loading={demo.isPending} onClick={() => void connect()}>
          {t('profile.telegram.connect')}
        </Button>
      )}
    </Card>
  );
}
