'use client';

/**
 * Имя того, кто правит график сейчас — для истории правок (F-02-102): настоящее имя сотрудника (по staffId), а если
 * у персоны нет своей карточки сотрудника — её роль словами. «Вы» экран истории показывает сам (по actorStaffId).
 */
import { useCoreGet } from '@/api/core';
import { useCurrent, useDemo } from '@/demo/hooks';
import type { PersonaId } from '@/demo/settings';
import { useT } from '@/i18n/useT';

const ROLE_OF: Record<PersonaId, 'owner' | 'admin' | 'master'> = {
  guest: 'master',
  client: 'master',
  individual: 'master',
  owner: 'owner',
  admin: 'admin',
  master: 'master',
  network: 'owner',
  platform: 'admin',
};

export function useActorName(): string {
  const { staffId } = useCurrent();
  const { persona } = useDemo();
  const commonT = useT('common');
  const own = useCoreGet('staff', staffId);
  if (own.data) return own.data.name;
  return commonT(`role.${ROLE_OF[persona]}` as never);
}
