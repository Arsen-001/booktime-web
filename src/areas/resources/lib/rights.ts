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
import { useCan, useCurrent, useDemo } from '@/demo/hooks';
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
  // Грубое право — верхняя граница (CONVENTIONS §7, как у «Клиентской базы»): сервер пускает изменения ресурсов,
  // ассистентов и их долей только с resources.manage. Тонкая галочка «можно» без него давала активные кнопки и 403
  // (проход 17.11, «только просмотр»): у мастера и администратора без права — только смотреть.
  const canManage = useCan('resources.manage');

  const q = useApiQuery(['resources', 'staffRights', staffId], () => getStaffResourcesRights(staffId ?? ''), {
    enabled: currentReady && Boolean(staffId) && !owner,
  });

  const merged: ResourcesFineRights = owner ? defaultResourcesFineRights() : { ...defaultResourcesFineRights(), ...q.data };
  return {
    ...merged,
    editServiceResources: merged.editServiceResources && canManage,
    addAssistants: merged.addAssistants && canManage,
    editAssistantShare: merged.editAssistantShare && canManage,
    ready: owner || !staffId || (currentReady && !q.isLoading),
  };
}
