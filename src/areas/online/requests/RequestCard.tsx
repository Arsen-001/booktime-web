'use client';

import { AlertTriangle, Banknote, CalendarClock, Check, Clock3, MapPin, MessageSquare, Phone, X } from 'lucide-react';
import type { OnlineRequestView } from '@/domain/online';
import type { Staff } from '@/domain/core';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { parse } from '@/lib/date';
import { telLink } from '@/lib/phone';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { SkeletonText } from '@/ui/Skeleton';

/** Сколько клиент ждёт решения, в минутах (F-00-067). `now` — снаружи, чтобы не звать Date.now() в рендере */
function waitedMinutes(submittedAt: string, now: number): number {
  return Math.max(0, Math.round((now - parse(submittedAt).valueOf()) / 60_000));
}

export interface RequestCardProps {
  request: OnlineRequestView;
  staff: Staff | undefined;
  /** Сотрудник текущей персоны — точный адрес выезда ему «после подтверждения» (F-00-080) */
  viewerStaffId: string | undefined;
  now: number;
  busy: boolean;
  onConfirm: () => void;
  onDecline: () => void;
  onOtherTime: () => void;
  onMoneyReceived: () => void;
}

/**
 * Карточка заявки (F-00-067, О28): сколько ждёт, кто клиент (новый / был N раз / неявки), комментарий, и три
 * решения — «Подтвердить», «Другое время», «Отклонить». Если клиент сообщил о предоплате (О6), главное
 * действие — «Деньги пришли»: салон сначала сверяет деньги.
 */
export function RequestCard({ request: r, staff, viewerStaffId, now, busy, onConfirm, onDecline, onOtherTime, onMoneyReceived }: RequestCardProps) {
  const t = useT('online');
  const tc = useT('common');
  const format = useFormat();
  const isVisit = r.workplace === 'visit';
  const waited = r.submittedAt ? waitedMinutes(r.submittedAt, now) : undefined;

  return (
    <Card padding="md" className="flex flex-col gap-3" data-f={isVisit ? 'F-00-079' : undefined}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-lg font-semibold text-fg">
            {format.date(r.start, 'weekday')}, {format.time(r.start)}
          </p>
          <p className="text-sm text-muted">
            {staff?.name ?? t('requests.unknownStaff')} · {format.duration(r.durationMin)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {waited !== undefined && (
            <Badge tone="warning" variant="soft" size="sm" icon={<Clock3 aria-hidden />}>
              {waited < 60 ? t('requests.waitingMinutes', { n: waited }) : t('requests.waitingHours', { n: Math.floor(waited / 60) })}
            </Badge>
          )}
          <Badge tone={isVisit ? 'accent' : 'neutral'} variant="soft" size="sm">
            {t(`requests.workplace.${r.workplace}` as never)}
          </Badge>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
        <span className="font-medium text-fg">{r.clientName}</span>
        <Badge tone={r.clientVisits === 0 ? 'info' : 'neutral'} variant="soft" size="sm">
          {r.clientVisits === 0 ? t('requests.client.new') : t('requests.client.visits', { count: r.clientVisits })}
        </Badge>
        {r.clientNoShowCount > 0 && (
          <span className="inline-flex items-center gap-1 text-warning" data-f="F-00-071">
            <AlertTriangle aria-hidden className="size-3.5" />
            {t('requests.noShowCount', { count: r.clientNoShowCount })}
          </span>
        )}
        {r.clientPhone && (
          <a href={telLink(r.clientPhone)} className="inline-flex min-h-11 items-center gap-1 text-primary-text hover:underline">
            <Phone aria-hidden className="size-3.5" />
            {format.phone(r.clientPhone)}
          </a>
        )}
      </div>

      {r.serviceNames.length > 0 && <p className="text-sm text-fg">{r.serviceNames.join(', ')}</p>}

      {r.comment && (
        <p className="flex items-start gap-1.5 rounded-lg bg-surface-2 px-3 py-2 text-sm text-fg">
          <MessageSquare aria-hidden className="mt-0.5 size-3.5 shrink-0 text-muted" />
          {r.comment}
        </p>
      )}

      {isVisit && (
        <p className="flex items-center gap-1.5 text-sm text-muted" data-f="F-00-080">
          <MapPin aria-hidden className="size-3.5 shrink-0" />
          {/* F-00-080: точный адрес клиента видит только мастер этой записи, и только после подтверждения. */}
          {r.district ? tc(`districts.${r.district}` as never) : ''}
          {r.staffId === viewerStaffId && <span className="text-muted/80"> · {t('requests.addressAfterConfirm')}</span>}
        </p>
      )}

      {r.prepaymentNoShows && (
        <p className="flex items-start gap-1.5 rounded-lg bg-warning-soft px-3 py-2 text-sm text-fg" data-f="F-00-071 F-00-097">
          <Banknote aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
          {t('requests.prepaymentNoShows', { count: r.prepaymentNoShows.noShows, months: r.prepaymentNoShows.months })}
        </p>
      )}

      {r.prepaymentReported && (
        <p className="flex items-start gap-1.5 rounded-lg bg-success-soft px-3 py-2 text-sm text-fg">
          <Banknote aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />
          {t('requests.prepaymentReported', { amount: format.money(r.prepaymentReported.amount), when: format.dateTime(r.prepaymentReported.at) })}
        </p>
      )}

      {r.offeredStarts && r.offeredStarts.length > 0 && (
        <p className="flex items-start gap-1.5 text-sm text-muted">
          <CalendarClock aria-hidden className="mt-0.5 size-4 shrink-0" />
          {t('requests.otherTime.offered', { list: r.offeredStarts.map((s) => format.dateTime(s)).join(', ') })}
        </p>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <Button size="sm" variant="ghost" leftIcon={<X aria-hidden />} disabled={busy} onClick={onDecline}>
          {t('requests.decline')}
        </Button>
        {r.prepaymentReported ? (
          <Button size="sm" leftIcon={<Banknote aria-hidden />} disabled={busy} onClick={onMoneyReceived} className="ml-auto">
            {t('requests.moneyReceived')}
          </Button>
        ) : (
          <>
            <Button size="sm" variant="secondary" leftIcon={<CalendarClock aria-hidden />} disabled={busy} onClick={onOtherTime} className="ml-auto">
              {t('requests.otherTime.button')}
            </Button>
            <Button size="sm" leftIcon={<Check aria-hidden />} disabled={busy} onClick={onConfirm}>
              {t('requests.confirm')}
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}

/** Скелетон заявки — та же карточка: когда, мастер и длительность, метки, клиент, услуги, три решения */
export function RequestCardSkeleton() {
  const t = useT('online');
  return (
    <Card padding="md" aria-hidden className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-lg font-semibold text-fg">
            <SkeletonText width="12ch" />
          </p>
          <p className="text-sm text-muted">
            <SkeletonText width="18ch" />
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone="neutral" variant="soft" size="sm">
            <SkeletonText width="7ch" />
          </Badge>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
        <span className="font-medium text-fg">
          <SkeletonText width="12ch" />
        </span>
        <Badge tone="neutral" variant="soft" size="sm">
          <SkeletonText width="8ch" />
        </Badge>
        <span className="inline-flex items-center gap-1 text-warning">
          <SkeletonText width="9ch" />
        </span>
        <span className="inline-flex min-h-11 items-center gap-1 text-primary-text">
          <Phone aria-hidden className="size-3.5" />
          <SkeletonText width="15ch" />
        </span>
      </div>
      <p className="text-sm text-fg">
        <SkeletonText width="20ch" />
      </p>
      <div className="flex flex-wrap gap-2 pt-1">
        <Button size="sm" variant="ghost" leftIcon={<X aria-hidden />} disabled>
          {t('requests.decline')}
        </Button>
        <Button size="sm" variant="secondary" leftIcon={<CalendarClock aria-hidden />} disabled className="ml-auto">
          {t('requests.otherTime.button')}
        </Button>
        <Button size="sm" leftIcon={<Check aria-hidden />} disabled>
          {t('requests.confirm')}
        </Button>
      </div>
    </Card>
  );
}
