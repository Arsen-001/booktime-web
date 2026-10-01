'use client';

import { UserPlus } from 'lucide-react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import type { Staff } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { pickText } from '@/lib/text';
import { Avatar } from '@/ui/Avatar';
import { Badge } from '@/ui/Badge';
import { LinkButton } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { EmptyState } from '@/ui/EmptyState';
import { Skeleton, SkeletonText } from '@/ui/Skeleton';

/**
 * Владелец/администратор без выбранного мастера: карточки мастеров (ux-r5 C-1, onboarding-k3 №1) вместо одного
 * пустого Select на всю страницу. Нет мастеров — пустое состояние с «Пригласить мастера».
 */
export function CalendarStaffPicker({ staff }: { staff: Staff[] }) {
  const t = useT('schedule');
  const locale = useLocale();
  if (staff.length === 0)
    return (
      <EmptyState
        icon={<UserPlus aria-hidden />}
        title={t('calendar.noStaffTitle')}
        description={t('calendar.noStaffText')}
        action={
          <LinkButton href="/biz/staff" size="sm">
            {t('calendar.inviteStaff')}
          </LinkButton>
        }
      />
    );
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {staff.map((s) => (
        <Link
          key={s.id}
          href={`/biz/schedule/calendar?staff=${s.id}`}
          className="rounded-xl focus-visible:outline-2 focus-visible:outline-focus"
        >
          <Card interactive className="flex min-h-20 items-center gap-3 p-4">
            <Avatar name={s.name} src={s.avatarUrl} colorIndex={s.colorIndex} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-fg">{s.name}</p>
              {s.position && <p className="truncate text-sm text-muted">{pickText(s.position, locale)}</p>}
            </div>
            <Badge tone={s.calendarMode === 'busy' ? 'neutral' : 'success'}>
              {s.calendarMode === 'busy' ? t('calendar.modeBusyShort') : t('calendar.modeFreeShort')}
            </Badge>
          </Card>
        </Link>
      ))}
    </div>
  );
}

/** Карточки мастеров при загрузке — та же разметка (DESIGN.md → «The skeleton IS the page»), имя и должность полосами */
export function CalendarStaffPickerSkeleton({ count }: { count: number }) {
  return (
    <div aria-busy className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="rounded-xl">
          <Card className="flex min-h-20 items-center gap-3 p-4">
            <Skeleton variant="circle" className="size-10 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-fg">
                <SkeletonText width={i % 2 ? '15ch' : '12ch'} />
              </p>
              <p className="truncate text-sm text-muted">
                <SkeletonText width="14ch" />
              </p>
            </div>
            <Badge tone="neutral">
              <SkeletonText width="10ch" />
            </Badge>
          </Card>
        </div>
      ))}
    </div>
  );
}
