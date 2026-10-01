'use client';

import { listInstallStatuses } from '@/api/integrations';
import { useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import type { Id } from '@/domain/core';
import type { InstallStatus } from '@/domain/integrations';

/**
 * Ревью 27.09 (И6): статус подключения приложений в выбранных филиалах — для значка на плитках каталога.
 * Ключ начинается с ['integrations', 'installed', …] — после подключения/отключения перечитывается вместе
 * со списком «Установлено», и на плитке меняется только значок.
 */
export function useInstallStatuses(): Record<Id, InstallStatus> | undefined {
  const { ready, activeLocationIds } = useCurrent();
  const q = useApiQuery(['integrations', 'installed', 'statuses', activeLocationIds.join(',')], () => listInstallStatuses(activeLocationIds), {
    enabled: ready && activeLocationIds.length > 0,
    keepPrevious: true,
  });
  return q.data;
}
