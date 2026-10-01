'use client';

import { AlertCircle, CheckCircle2, Clock, XCircle } from 'lucide-react';
import type { InstallStatus } from '@/domain/integrations';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { Badge, type BadgeSize, type BadgeTone } from '@/ui/Badge';

const TONE: Record<InstallStatus, BadgeTone> = {
  connected: 'success',
  pendingActivation: 'warning',
  error: 'danger',
  disconnected: 'neutral',
  autoDisconnected: 'danger',
};

const ICON: Record<InstallStatus, typeof CheckCircle2> = {
  connected: CheckCircle2,
  pendingActivation: Clock,
  error: AlertCircle,
  disconnected: XCircle,
  autoDisconnected: AlertCircle,
};

export interface InstallStatusBadgeProps {
  status: InstallStatus;
  size?: BadgeSize;
  /**
   * Ревью 27.09 (И16): длинный статус («Ждём активации партнёром») переносится внутри значка, а не вылезает
   * за край узкой колонки карточки.
   */
  wrap?: boolean;
  className?: string;
}

export function InstallStatusBadge({ status, size, wrap = false, className }: InstallStatusBadgeProps) {
  const t = useT('integrations');
  const Icon = ICON[status];
  return (
    <Badge
      tone={TONE[status]}
      size={size}
      icon={<Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />}
      className={cn(wrap && 'h-auto min-h-7 max-w-full whitespace-normal rounded-xl py-1 text-left', className)}
      data-install-status={status}
    >
      {t(`status.${status}` as never)}
    </Badge>
  );
}
