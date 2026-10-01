'use client';

/** F-13-032: статус приложения разработчика — «Не опубликовано / На модерации / Опубликовано / Отклонено» */
import type { DevAppStatus } from '@/domain/integrations';
import { useT } from '@/i18n/useT';
import { Badge, type BadgeTone } from '@/ui/Badge';

const TONE: Record<DevAppStatus, BadgeTone> = {
  draft: 'neutral',
  review: 'warning',
  published: 'success',
  rejected: 'danger',
};

export function DevAppStatusBadge({ status }: { status: DevAppStatus }) {
  const t = useT('integrations');
  return <Badge tone={TONE[status]}>{t(`developers.status.${status}`)}</Badge>;
}
