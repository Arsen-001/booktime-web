'use client';

import { Lock } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Permission } from '@/config/permissions';
import type { PersonaId } from '@/demo/settings';
import { useDemo, usePermissions } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';

export interface PermissionGateProps {
  /** Нужное право (для администратора учитываются галочки владельца, F-00-039) */
  permission?: Permission;
  /** Или/и: каким персонам показывать */
  personas?: PersonaId[];
  /** Что показать без доступа: ничего (по умолчанию), 'message' — плашку «нет прав», или свой узел */
  fallback?: ReactNode | 'message';
  className?: string;
  children: ReactNode;
}

/**
 * Прячет содержимое, если у текущей персоны нет права.
 *   <PermissionGate permission="clients.phones" fallback={maskedPhone}>{phone}</PermissionGate>
 */
export function PermissionGate({ permission, personas, fallback = null, className, children }: PermissionGateProps) {
  const t = useT('ui');
  const { persona } = useDemo();
  const permissions = usePermissions();
  const allowed = (!permission || permissions.has(permission)) && (!personas || personas.includes(persona));
  if (allowed) return <>{children}</>;
  if (fallback !== 'message') return <>{fallback}</>;
  return (
    <div
      role="note"
      className={cn(
        'flex items-start gap-3 rounded-lg border border-border bg-surface-2 p-4 text-sm text-muted',
        className,
      )}
    >
      <Lock aria-hidden className="mt-0.5 size-4 shrink-0" />
      <div>
        <p className="font-medium text-fg">{t('permission.denied')}</p>
        <p>{t('permission.deniedHint')}</p>
      </div>
    </div>
  );
}
