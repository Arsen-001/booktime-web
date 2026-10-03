'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import {
  Bell,
  CalendarCheck,
  CalendarClock,
  Cake,
  Check,
  CreditCard,
  type LucideIcon,
  Megaphone,
  MessageCircle,
  Receipt,
  RotateCcw,
  Settings2,
  Sparkles,
  Tag,
  TimerOff,
  XCircle,
} from 'lucide-react';
import { confirmBookingByClient, listNotifications, markAllNotificationsRead } from '@/api/client';
import type { NotificationEntry } from '@/api/client';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import type { Id } from '@/domain/core';
import type { NotificationKind } from '@/domain/client';
import { useClientFormat } from '@/areas/client/useClientFormat';
import { useDisplayName } from '@/areas/client/useDisplayName';
import { useT } from '@/i18n/useT';
import { pickText } from '@/lib/text';
import { Button, LinkButton } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { PageHeader } from '@/ui/PageHeader';
import { usePagedList } from '@/ui/Pagination';
import { Skeleton } from '@/ui/Skeleton';
import { useToast } from '@/ui/Toast';

const KIND_ICON: Record<NotificationKind, LucideIcon> = {
  booking_created: CalendarCheck,
  confirm_request: CalendarClock,
  client_confirmed_echo: Check,
  booking_reminder: Bell,
  repeat_invite: RotateCcw,
  cancelled_by_master: XCircle,
  waitlist_slot: Sparkles,
  come_again: RotateCcw,
  broadcast: Megaphone,
  direct: MessageCircle,
  birthday_greeting: Cake,
  discount_new: Tag,
  discount_ending: TimerOff,
  receipt: Receipt,
  salon_confirmed: CalendarCheck,
  salon_moved: CalendarClock,
  salon_deleted: XCircle,
  master_delayed: TimerOff,
  prepayment_expired: CreditCard,
  confirmation_expired: CalendarClock,
};

/** Лента уведомлений клиента (F-14-055…070) */
export function NotificationsScreen() {
  const t = useT('client');
  const { ready, appUserId } = useCurrent();

  if (!ready) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        <Skeleton variant="rect" className="h-10 w-40" />
        <Skeleton variant="rect" className="h-20 rounded-2xl" />
        <Skeleton variant="rect" className="h-20 rounded-2xl" />
      </div>
    );
  }

  if (!appUserId) {
    return (
      <EmptyState
        icon={<Bell aria-hidden className="size-8 text-muted" />}
        title={t('notifications.needLoginTitle')}
        description={t('notifications.needLoginHint')}
        action={
          <LinkButton href="/login?next=/notifications">{t('notifications.goLogin')}</LinkButton>
        }
      />
    );
  }

  return <NotificationsBody appUserId={appUserId} />;
}

function NotificationsBody({ appUserId }: { appUserId: Id }) {
  const t = useT('client');
  const q = useApiQuery(['notifications', appUserId], () => listNotifications(appUserId));
  const markAll = useApiMutation(markAllNotificationsRead);

  // Открыли ленту — считаем показанное прочитанным (счётчик непрочитанных живёт до открытия, F-14-055)
  useEffect(() => {
    if (!q.data?.some((n) => !n.readAt)) return;
    let cancelled = false;
    void (async () => {
      try {
        await markAll.mutate(appUserId);
        if (!cancelled) void q.refetch();
      } catch {
        /* тихо — счётчик просто останется непрочитанным до следующей попытки */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data]);
  // Постранично, как во всех списках (DESIGN.md → Long lists)
  const { pageItems, pager } = usePagedList(q.data ?? []);

  return (
    <div data-f="F-14-055 F-14-063 F-05-078" className="flex flex-col gap-5">
      <PageHeader
        title={t('notifications.title')}
        actions={
          <LinkButton href="/profile/notifications" variant="outline" data-icon-button="" aria-label={t('notifications.settingsCta')} className="size-11 px-0">
            <Settings2 aria-hidden />
          </LinkButton>
        }
      />

      {q.isError ? (
        <ErrorState onRetry={q.refetch} />
      ) : q.isLoading ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          <Skeleton variant="rect" className="h-20 rounded-xl" />
          <Skeleton variant="rect" className="h-20 rounded-xl" />
          <Skeleton variant="rect" className="h-20 rounded-xl" />
        </div>
      ) : !q.data?.length ? (
        <EmptyState
          icon={<Bell aria-hidden className="size-8 text-muted" />}
          title={t('notifications.emptyTitle')}
          description={t('notifications.emptyHint')}
        />
      ) : (
        <>
          <div className="flex flex-col gap-2">
            {pageItems.map((n) => (
              <NotificationRow key={n.id} entry={n} appUserId={appUserId} onChanged={() => void q.refetch()} />
            ))}
          </div>
          {pager}
        </>
      )}
    </div>
  );
}

function NotificationRow({ entry, appUserId, onChanged }: { entry: NotificationEntry; appUserId: Id; onChanged: () => void }) {
  const t = useT('client');
  const nameOf = useDisplayName();
  const fmt = useClientFormat();
  const locale = useLocale();
  const router = useRouter();
  const toast = useToast();
  const Icon = KIND_ICON[entry.kind];
  const confirm = useApiMutation((id: Id) => confirmBookingByClient(id, appUserId));

  // «Освободилось время» (предложение окна из журнала): время окна и услуга — в params, записи ещё нет
  const offerStart =
    entry.kind === 'waitlist_slot' && entry.params?.date && entry.params?.time ? `${String(entry.params.date)}T${String(entry.params.time)}` : undefined;
  const offerServiceId = entry.params?.serviceId ? String(entry.params.serviceId) : undefined;
  const whenAt = entry.booking?.start ?? offerStart;
  const when = whenAt ? `${fmt.relativeDay(whenAt)}, ${fmt.time(whenAt)}` : undefined;
  const serviceName = entry.service ? pickText(entry.service.name, locale) : undefined;
  // Отправитель пуша — имя мастера/название бизнеса (F-14-065); без имени — наш продукт
  const sender = nameOf(entry.staff?.name ?? entry.business.name) || t('notifications.senderFallback');
  // Не `entry.staff!.id`: React Compiler по «!» считает entry.staff не-null и выносит чтение поля в рендер.
  const staffId = entry.staff?.id;
  const text =
    entry.kind === 'broadcast' || entry.kind === 'direct'
      ? String(entry.params?.text ?? '')
      : offerStart
        ? t('notifications.kind.waitlist_slot_at', { when: when ?? '' })
        : t(`notifications.kind.${entry.kind}`, {
          service: serviceName ?? '',
          when: when ?? '',
          discountPercent: Number(entry.params?.discountPercent ?? 0),
          days: Number(entry.params?.days ?? 0),
          amount: fmt.money(Number(entry.params?.amount ?? 0)),
        });

  const handleConfirm = async () => {
    if (!entry.bookingId) return;
    try {
      await confirm.mutate(entry.bookingId);
      toast.success(t('bookingDetail.confirmed'));
      onChanged();
    } catch {
      toast.error(t('bookingDetail.actionFailed'));
    }
  };

  const body = (
    <div className="flex items-start gap-3">
      <span
        aria-hidden
        className={`flex size-10 shrink-0 items-center justify-center rounded-full ${entry.readAt ? 'bg-surface-2 text-muted' : 'bg-primary-soft text-primary-text'}`}
      >
        <Icon aria-hidden className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p data-f="F-14-065" className="truncate text-sm font-medium text-fg">
            {sender}
          </p>
          {!entry.readAt && <span aria-hidden className="size-2 shrink-0 rounded-full bg-primary" />}
        </div>
        {entry.kind === 'booking_reminder' ? (
          <p data-f="F-00-120 F-15-137" className="text-sm text-fg">
            {text}
          </p>
        ) : (
          <p className="text-sm text-fg">{text}</p>
        )}
        <p className="mt-0.5 text-xs text-muted">
          {fmt.relativeDay(entry.createdAt)}, {fmt.time(entry.createdAt)}
        </p>
      </div>
    </div>
  );

  if (entry.kind === 'broadcast') {
    return (
      <Card href={`/places/${entry.business.id}`} padding="sm" data-f="F-14-070">
        {body}
      </Card>
    );
  }

  return (
    <Card padding="sm" className="flex flex-col gap-3">
      {body}
      <div data-f="F-14-056" className="flex flex-wrap gap-2 pl-13">
        {entry.bookingId && (
          <LinkButton href={`/bookings/${entry.bookingId}`} size="sm" variant="outline">
            {t('notifications.actionDetails')}
          </LinkButton>
        )}
        {/* «Подтвердить» — пока запись «Записан»: подтвердил, отменил или перенёс — кнопки нет (сервер иначе ответит отказом) */}
        {entry.kind === 'confirm_request' && entry.booking?.status === 'scheduled' && (
          <Button size="sm" onClick={() => void handleConfirm()} loading={confirm.isPending}>
            {t('notifications.actionConfirm')}
          </Button>
        )}
        {(entry.kind === 'repeat_invite' || entry.kind === 'come_again') && entry.staff && (
          <Button
            data-f="F-00-119"
            size="sm"
            onClick={() => router.push(`/book?staff=${staffId}${entry.service ? `&service=${entry.service.id}` : ''}`)}
          >
            {t('notifications.actionBook')}
          </Button>
        )}
        {entry.kind === 'waitlist_slot' && entry.staff && (
          <Button
            data-f="F-00-101"
            size="sm"
            onClick={() =>
              router.push(
                `/book?staff=${staffId}${offerStart ? `&slot=${encodeURIComponent(offerStart)}` : ''}${offerServiceId ? `&service=${offerServiceId}` : ''}`,
              )
            }
          >
            {t('notifications.actionBook')}
          </Button>
        )}
        {(entry.kind === 'cancelled_by_master' || entry.kind === 'confirmation_expired') && entry.staff && (
          <Button
            data-f="F-00-119"
            size="sm"
            onClick={() => router.push(`/book?staff=${staffId}${entry.service ? `&service=${entry.service.id}` : ''}`)}
          >
            {t('notifications.actionChooseAnotherTime')}
          </Button>
        )}
      </div>
    </Card>
  );
}
