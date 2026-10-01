'use client';

/**
 * Тонкие права раздела «resources» (F-16-026, F-16-144, F-16-169) — тоньше грубого `resources.manage`
 * фундамента (src/config/permissions.ts, просьба о ключах — qa/requests/resources.md): владелец видит
 * всё, администратору владелец может сузить каждую тонкую галочку отдельно (см. AssistantsSettingsScreen
 * и SettingsHub «Права на ресурсы»). Override хранится в ResourcesState.staffRights по staffId, как
 * clients/lib/rights.ts делает для «Клиентской базы».
 */
import { defaultResourcesFineRights, getStaffResourcesRights } from '@/api/resources';
import { useApiQuery } from '@/api/request';
import { useCurrent, useDemo } from '@/demo/hooks';
import type { ResourcesFineRights } from '@/domain/resources';

export interface UseResourcesRightsResult extends ResourcesFineRights {
  ready: boolean;
}

/**
 * Умолчание — открыто всем (как у фундамента до появления тонких прав, чтобы не сломать уже построенные
 * b01…b03 экраны): владелец/сеть/индивидуал видят всё всегда; у остальных персон — умолчание true по
 * каждой галочке, которое владелец сужает по конкретному сотруднику (override в ResourcesState.staffRights).
 */
export function useResourcesRights(): UseResourcesRightsResult {
  const { persona } = useDemo();
  const { staffId, ready: currentReady } = useCurrent();
  const owner = persona === 'owner' || persona === 'network' || persona === 'individual';

  const q = useApiQuery(['resources', 'staffRights', staffId], () => getStaffResourcesRights(staffId ?? ''), {
    enabled: currentReady && Boolean(staffId) && !owner,
  });

  if (owner) return { ...defaultResourcesFineRights(), ready: true };
  const merged: ResourcesFineRights = { ...defaultResourcesFineRights(), ...q.data };
  return { ...merged, ready: !staffId || (currentReady && !q.isLoading) };
}
