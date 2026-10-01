'use client';

/**
 * Экран «Приложения» для бизнеса открывается только с тем же правом, что и его раздел в веб-кабинете
 * (A8: права, а не `persona ===`). Прямая ссылка без права — плашка «Нет доступа», а не данные салона.
 * Api этих экранов проверяет то же самое (assertCan в src/api/client.ts).
 */
import type { ReactNode } from 'react';
import type { Permission } from '@/config/permissions';
import { PermissionGate } from '@/ui/PermissionGate';

export function AppGate({ permission, children }: { permission: Permission; children: ReactNode }) {
  return (
    <PermissionGate permission={permission} fallback="message">
      {children}
    </PermissionGate>
  );
}
