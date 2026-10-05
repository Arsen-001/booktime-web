'use client';

/**
 * «Предложить окно» прямо из «Найти окно» (⭐ 29.09.2026): второй шаг той же панели — кому уйдёт предложение и сколько
 * их, одной кнопкой «Отправить N людям». Каналы — лист ожидания журнала, «просили сообщить об окне» (приложение и
 * виджет), горящее окно подписчикам (только на сегодня, со скидкой из «Продвижения», если она задана). Люди без
 * повторов; сообщения ложатся в журнал уведомлений (api/journal-offers). У Altegio свободное окно предлагают вручную:
 * открыть лист ожидания, найти подходящих и написать каждому.
 */
import { ChevronLeft, Send } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Id, ISODate, Staff } from '@/domain/core';
import type { SlotOfferChannel } from '@/domain/journal';
import { offerSlots, previewSlotOffer, type SlotOfferTarget } from '@/api/journal-offers';
import { isApiMode } from '@/api/http';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { fromMinutes } from '@/lib/date';
import type { SlotSuggestion } from '@/areas/journal/lib/findSlots';
import { Button } from '@/ui/Button';
import { Checkbox } from '@/ui/Checkbox';
import { EmptyState } from '@/ui/EmptyState';
import { IconButton } from '@/ui/IconButton';
import { Skeleton } from '@/ui/Skeleton';
import { useToast } from '@/ui/Toast';

// Один лист ожидания (30.09.2026): «Сообщить об окне» из приложения и виджета — тоже в нём, отдельного канала нет
const CHANNELS: SlotOfferChannel[] = ['waitlist', 'hot'];

export interface SlotOfferConfirmProps {
  businessId: Id;
  date: ISODate;
  serviceId: Id;
  serviceName: string;
  slots: SlotSuggestion[];
  staffById: Map<Id, Staff>;
  onBack: () => void;
  onSent: () => void;
  /**
   * ⭐ Готовые окна вместо slots × serviceId — «Свободно сегодня» (FreeTodaySheet): у каждого окна своя услуга. Заголовок
   * и строка под ним — тоже снаружи.
   */
  targets?: SlotOfferTarget[];
  title?: string;
  subtitle?: string;
  /** Без стрелки «назад» — когда подтверждение стоит внизу своей шторки */
  hideBack?: boolean;
}

export function SlotOfferConfirm({ businessId, date, serviceId, serviceName, slots, staffById, onBack, onSent, targets: givenTargets, title, subtitle, hideBack }: SlotOfferConfirmProps) {
  const t = useT('journal');
  const tc = useT('common');
  const format = useFormat();
  const toast = useToast();
  const router = useRouter();
  const targets: SlotOfferTarget[] = givenTargets ?? slots.map((s) => ({ businessId, staffId: s.staffId, serviceId, date, time: fromMinutes(s.start) }));
  const targetsKey = targets.map((x) => `${x.staffId}@${x.time}@${x.serviceId}`).join(',');
  const previewQ = useApiQuery(['journal', 'slot-offer-preview', businessId, date, serviceId, targetsKey], () => previewSlotOffer(targets), {
    enabled: Boolean(businessId) && targets.length > 0,
  });
  const preview = previewQ.data;
  // Выключенные вручную каналы; остальное — всё, где есть кому отправить
  const [off, setOff] = useState<SlotOfferChannel[]>([]);
  // Режим api: отметки «уже предлагали» и превью перечитываем с сервера (в моке их будит запись в базу)
  const send = useApiMutation((channels: SlotOfferChannel[]) => offerSlots(targets, channels), {
    invalidates: [
      ['journal', 'slot-offers'],
      ['journal', 'slot-offer-preview'],
    ],
  });

  const countOf = (ch: SlotOfferChannel) => (ch === 'hot' && !preview?.hotAvailable ? 0 : (preview?.counts[ch] ?? 0));
  const chosen = CHANNELS.filter((ch) => countOf(ch) > 0 && !off.includes(ch));
  const total = chosen.reduce((sum, ch) => sum + countOf(ch), 0);
  const nobody = preview !== undefined && CHANNELS.every((ch) => countOf(ch) === 0);
  const single = slots.length === 1 ? slots[0] : undefined;
  const singleTime = single ? fromMinutes(single.start) : '';

  const describe = (ch: SlotOfferChannel) => {
    const n = countOf(ch);
    if (ch === 'hot') {
      if (!preview?.hotAvailable) return t('board.findSlot.offer.hotTodayOnly');
      const who = t('board.findSlot.offer.subscribers', { n });
      return n > 0 && preview.hotDiscountPercent ? `${who} · ${t('board.findSlot.offer.discount', { percent: preview.hotDiscountPercent })}` : who;
    }
    const people = t('board.findSlot.offer.people', { n });
    // Сервер шлёт пуш или через Telegram-бот (SMS провайдера бизнеса пока нет, В-08); демо — SMS
    return n > 0 ? `${people} · ${t(isApiMode() ? 'board.findSlot.offer.viaAppOrTelegram' : 'board.findSlot.offer.viaSmsOrApp')}` : people;
  };

  const onSend = async () => {
    try {
      const res = await send.mutate(chosen);
      toast.success(t('board.findSlot.offer.sent', { n: res.sent }), {
        description: t('board.findSlot.offer.sentWhere'),
        action: { label: t('board.findSlot.offer.openLog'), onClick: () => router.push('/biz/notifications/log') },
      });
      onSent();
    } catch {
      toast.error(tc('states.actionFailed'));
    }
  };

  return (
    <div className="flex flex-col gap-3" data-f="F-01-156 F-00-103">
      <div className="flex items-start gap-1">
        {!hideBack && <IconButton variant="ghost" size="sm" icon={<ChevronLeft aria-hidden />} label={t('board.findSlot.offer.back')} onClick={onBack} />}
        <div className="min-w-0 pt-1.5">
          <p className="text-sm font-semibold text-fg">
            {title ?? (single ? t('board.findSlot.offer.titleOne') : t('board.findSlot.offer.titleAll', { n: slots.length }))}
          </p>
          <p className="truncate text-xs text-muted">
            {subtitle !== undefined
              ? subtitle
              : single
              ? `${format.time(`${date}T${singleTime}`)} · ${staffById.get(single.staffId)?.name ?? ''} · ${serviceName}`
              : `${serviceName} · ${slots
                  .slice(0, 4)
                  .map((s) => format.time(`${date}T${fromMinutes(s.start)}`))
                  .join(', ')}${slots.length > 4 ? '…' : ''}`}
          </p>
        </div>
      </div>

      {previewQ.isLoading || !preview ? (
        <div aria-hidden className="flex flex-col gap-3 px-1">
          {CHANNELS.map((ch) => (
            <div key={ch} className="flex items-start gap-3">
              <Skeleton variant="rect" className="size-5 shrink-0 rounded-md" />
              <span className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-3.5 w-2/5" />
                <Skeleton className="h-3 w-3/5" />
              </span>
            </div>
          ))}
        </div>
      ) : nobody ? (
        <EmptyState compact icon={<Send />} title={t('board.findSlot.offer.nobody')} description={t('board.findSlot.offer.nobodyHint')} />
      ) : (
        <>
          <p className="px-1 text-xs font-semibold tracking-wide text-muted uppercase">{t('board.findSlot.offer.who')}</p>
          <div className="flex flex-col gap-3 px-1">
            {CHANNELS.map((ch) => (
              <Checkbox
                key={ch}
                checked={chosen.includes(ch)}
                disabled={countOf(ch) === 0 || send.isPending}
                onCheckedChange={(v) => setOff((prev) => (v ? prev.filter((x) => x !== ch) : [...prev, ch]))}
                label={t(`board.findSlot.offer.${ch}`)}
                description={describe(ch)}
              />
            ))}
          </div>
        </>
      )}

      {preview?.offeredAt && (
        <p className="px-1 text-xs text-warning">{t('board.findSlot.offer.already', { time: format.time(preview.offeredAt) })}</p>
      )}

      {nobody ? (
        !hideBack && (
          <Button variant="secondary" fullWidth onClick={onBack}>
            {t('board.findSlot.offer.back')}
          </Button>
        )
      ) : (
        <Button data-slot-offer-send fullWidth leftIcon={<Send aria-hidden />} disabled={total === 0} loading={send.isPending} onClick={onSend}>
          {t('board.findSlot.offer.send', { n: total })}
        </Button>
      )}
    </div>
  );
}
