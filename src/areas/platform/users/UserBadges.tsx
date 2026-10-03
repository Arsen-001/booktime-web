'use client';

/** Плашки «Пользователей»: роли человека и статус аккаунта (активный — без плашки, как у бизнесов). */
import { Ban, Trash2, UserX } from 'lucide-react';
import type { PlatformUserRole, PlatformUserStatus } from '@/domain/platform/types/users';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { Badge, type BadgeTone } from '@/ui/Badge';

const ROLE_TONE: Record<PlatformUserRole, BadgeTone> = { owner: 'primary', admin: 'info', master: 'accent' };

export function UserRoleBadges({ roles, className }: { roles: PlatformUserRole[]; className?: string }) {
  const t = useT('platform');
  if (!roles.length) return <span className={cn('text-sm text-muted', className)}>{t('users.role.client')}</span>;
  return (
    <span className={cn('flex flex-wrap gap-1', className)}>
      {roles.map((r) => (
        <Badge key={r} size="sm" tone={ROLE_TONE[r]}>
          {t(`users.role.${r}`)}
        </Badge>
      ))}
    </span>
  );
}

const STATUS_TONE: Record<Exclude<PlatformUserStatus, 'active'>, BadgeTone> = { blocked: 'danger', delete_requested: 'warning', deleted: 'neutral' };
const STATUS_ICON = { blocked: Ban, delete_requested: Trash2, deleted: UserX } as const;

export function UserStatusBadge({ status, className }: { status: PlatformUserStatus; className?: string }) {
  const t = useT('platform');
  if (status === 'active') return null;
  const Icon = STATUS_ICON[status];
  return (
    <Badge tone={STATUS_TONE[status]} size="sm" className={className} icon={<Icon aria-hidden className="size-3.5" />}>
      {t(`users.status.${status}`)}
    </Badge>
  );
}
