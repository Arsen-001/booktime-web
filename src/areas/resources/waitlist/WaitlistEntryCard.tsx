'use client';

import { BellRing, CalendarClock, Clock, MoreHorizontal, Pencil, Phone, Smartphone, Trash2, User } from 'lucide-react';
import { nextWish, upcomingWish, type WaitlistRow, type WaitlistStatus } from '@/api/resources';
import type { Id, ISODate } from '@/domain/core';
import { maskPhone } from '@/lib/phone';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Badge, type BadgeTone } from '@/ui/Badge';
import { Button, LinkButton } from '@/ui/Button';
import { DropdownMenu } from '@/ui/DropdownMenu';
import { IconButton } from '@/ui/IconButton';
import { WaitlistNotified } from '@/areas/resources/waitlist/WaitlistNotified';
import { wishText } from '@/areas/resources/waitlist/wishText';

const STATUS_TONE: Record<WaitlistStatus, BadgeTone> = { active: 'primary', expired: 'neutral', closed: 'success' };

export interface WaitlistEntryCardProps {
  row: WaitlistRow;
  today: ISODate;
  serviceNameById: Map<Id, string>;
  staffNameById: Map<Id, string>;
  expanded: boolean;
  onToggle: () => void;
  canManage: boolean;
  canSeePhones: boolean;
  recording: boolean;
  notifying: boolean;
  onRecord: () => void;
  onNotify: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

/**
 * Карточка заявки — одна для экрана /biz/waitlist и панели журнала (F-16-149, F-16-159…165, F-01-158…161): свёрнутая —
 * услуги, ближайшее желание · мастер, статус; раскрытая — клиент, все желания, откуда пришла, «Уведомлён», действия.
 */
export function WaitlistEntryCard({
  row,
  today,
  serviceNameById,
  staffNameById,
  expanded,
  onToggle,
  canManage,
  canSeePhones,
  recording,
  notifying,
  onRecord,
  onNotify,
  onEdit,
  onDelete,
}: WaitlistEntryCardProps) {
  const t = useT('resources');
  const format = useFormat();
  const wish = upcomingWish(row, today) ?? nextWish(row);
  const moreWishes = Math.max(0, row.wishes.length - 1);
  const services = row.serviceIds.map((id) => serviceNameById.get(id) ?? id).join(', ');
  const staffLabel = row.staffIds.length ? row.staffIds.map((id) => staffNameById.get(id) ?? id).join(', ') : t('waitlist.form.staffAny');
  // Встал сам (приложение, онлайн-запись) — видно по значку и подписи: такому клиенту «Освободилось время» уходит само
  const selfSource = row.source === 'app' || row.source === 'widget' ? row.source : undefined;
  const selfLabel = selfSource ? t(`waitlist.source.${selfSource}`) : undefined;
  const active = row.status === 'active';

  return (
    <li data-f="F-16-159 F-16-160 F-01-158 F-01-160" className="rounded-xl border border-border bg-surface">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={onToggle}
        className="flex min-h-11 w-full flex-col gap-1.5 rounded-xl px-3.5 py-3 text-left sm:flex-row sm:items-center sm:gap-3"
      >
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-sm font-semibold text-fg">{services}</span>
            {selfLabel && <Smartphone aria-label={selfLabel} className="size-3.5 shrink-0 text-muted" />}
          </span>
          {/* Одна строка (длинное — многоточием): высота заявки не зависит от длины пожелания */}
          <span className="flex min-w-0 items-center gap-x-2 text-xs text-muted">
            <span className="flex shrink-0 items-center gap-1.5">
              <Clock aria-hidden className="size-3.5" />
              {wish ? wishText(wish, format, t) : t('waitlist.anyTime')}
              {moreWishes > 0 && <span className="text-muted">{t('waitlist.moreWishes', { n: moreWishes })}</span>}
            </span>
            <span className="min-w-0 truncate">· {staffLabel}</span>
          </span>
        </span>
        <Badge tone={STATUS_TONE[row.status]} variant="soft" className="self-start sm:self-auto">
          {t(`waitlist.status.${row.status}`)}
        </Badge>
      </button>

      {expanded && (
        <div className="flex flex-col gap-2 border-t border-border px-3.5 py-3 text-sm">
          <p className="flex items-center gap-1.5 font-medium text-fg">
            <User aria-hidden className="size-3.5 text-muted" />
            {row.clientName}
          </p>
          <p className="flex items-center gap-1.5 text-muted">
            <Phone aria-hidden className="size-3.5" />
            {canSeePhones ? format.phone(row.clientPhone) : maskPhone(row.clientPhone)}
          </p>
          {row.wishes.length > 1 && (
            <div className="flex items-start gap-1.5 text-muted">
              <CalendarClock aria-hidden className="mt-0.5 size-3.5 shrink-0" />
              <ul className="flex flex-col gap-0.5" aria-label={t('waitlist.wishesTitle')}>
                {row.wishes.map((w, i) => (
                  <li key={i}>{wishText(w, format, t)}</li>
                ))}
              </ul>
            </div>
          )}
          {row.comment && <p className="text-muted">{row.comment}</p>}
          {selfLabel && <p className="text-xs text-muted">{selfLabel}</p>}
          <p className="text-xs text-muted">
            {t('waitlist.createdAt')}: {format.date(row.createdAt, 'short')} {format.time(row.createdAt)}
          </p>
          {active && <WaitlistNotified entryId={row.id} />}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {active && canManage && (
              <Button data-f="F-16-161 F-16-162 F-01-159" size="sm" loading={recording} onClick={onRecord}>
                {t('waitlist.book')}
              </Button>
            )}
            {active && canManage && (
              <Button data-f="F-16-166 F-16-167 F-16-168" size="sm" variant="outline" leftIcon={<BellRing aria-hidden className="size-4" />} loading={notifying} onClick={onNotify}>
                {t('waitlist.notify')}
              </Button>
            )}
            {row.closedBookingId && (
              <LinkButton href={`/biz/journal?booking=${row.closedBookingId}`} size="sm" variant="secondary">
                {t('waitlist.openBooking')}
              </LinkButton>
            )}
            {/* F-16-164/165, F-01-161: у закрытой заявки — только удаление; у остальных — правка и удаление через «⋯» */}
            {canManage && (
              <span data-f="F-01-161 F-16-164 F-16-165" className="ml-auto">
                <DropdownMenu
                  label={t('waitlist.more')}
                  align="end"
                  trigger={(p) => <IconButton {...p} icon={<MoreHorizontal aria-hidden />} label={t('waitlist.more')} variant="ghost" size="sm" />}
                  items={[
                    ...(row.status !== 'closed' ? [{ id: 'edit', label: t('waitlist.editAction'), icon: <Pencil aria-hidden />, onSelect: onEdit }] : []),
                    { id: 'delete', label: t('waitlist.deleteAction'), icon: <Trash2 aria-hidden />, danger: true, onSelect: onDelete },
                  ]}
                />
              </span>
            )}
          </div>
        </div>
      )}
    </li>
  );
}
