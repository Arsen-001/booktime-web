'use client';

/**
 * Тонкие права «Клиентская база» (F-04-194…204, F-04-201, F-04-202, F-04-204) — 26 прав из ТЗ, тоньше
 * грубых clients.view/phones/edit/export/delete (src/config/permissions.ts, фундамент — просьба к нему
 * записана в qa/requests/clients.md). Владелец/сеть/индивидуал всегда видят всё; у администратора и
 * мастера — умолчание по роли, которое владелец может переопределить (см. extensions/SettingsHub.tsx,
 * setStaffFineRights), override хранится в ClientsState.staffRights по staffId.
 */
import { getStaffFineRights } from '@/api/clients';
import { useApiQuery } from '@/api/request';
import { useCan, useCurrent, useDemo } from '@/demo/hooks';
import type { ClientsFineRights, FineRight } from '@/domain/clients';
import { allFineRights, defaultAdminFineRights, defaultMasterFineRights } from '@/domain/clients';

function defaultsForPersona(persona: string): ClientsFineRights {
  if (persona === 'admin') return defaultAdminFineRights();
  if (persona === 'master') return defaultMasterFineRights();
  return allFineRights(true);
}

export interface UseClientsRightsResult extends ClientsFineRights {
  /** Override уже загружен (пока false — используем умолчание по роли, чтобы экран не мигал) */
  ready: boolean;
}

export function useClientsRights(): UseClientsRightsResult {
  const { persona } = useDemo();
  const { staffId, ready: currentReady } = useCurrent();
  const canViewPhonesCoarse = useCan('clients.phones');
  const canEditCoarse = useCan('clients.edit');
  const canDeleteCoarse = useCan('clients.delete');
  const canExportCoarse = useCan('clients.export');

  const q = useApiQuery(['clients', 'staffRights', staffId], () => getStaffFineRights(staffId ?? ''), {
    enabled: currentReady && Boolean(staffId) && persona === 'admin',
  });

  const base = defaultsForPersona(persona);
  const owner = persona === 'owner' || persona === 'network' || persona === 'individual';
  const override = persona === 'admin' ? q.data : undefined;
  const merged: ClientsFineRights = owner ? allFineRights(true) : { ...base, ...override };

  // Грубые права фундамента побеждают, когда они СТРОЖЕ (владелец снял «Показывать телефоны» — тонкие
  // права клиентской базы не должны его обходить); саму фундаментальную настройку тонкие права ослабить
  // не могут, только сузить дальше.
  if (!canViewPhonesCoarse) {
    merged.contactsInList = false;
    merged.contactsInCard = false;
  }
  if (!canEditCoarse) {
    merged.editClient = false;
    merged.editNote = false;
    merged.editFullName = false;
    merged.editCustomFields = false;
  }
  if (!canDeleteCoarse) merged.deleteClients = false;
  if (!canExportCoarse) merged.exportList = false;

  return { ...merged, ready: persona !== 'admin' || (currentReady && !q.isLoading) };
}

/**
 * F-04-106: без права «viewFullName» — имя + первая буква фамилии («Carol J.»), без отчества.
 *
 * F-04-046 (исправлено): `name` из ядра у части клиентов уже «Имя Фамилия» (сид приложения), а свой
 * профиль раздела при этом хранит собственную `lastName` (для клиентов, заведённых прямо в CRM, где
 * `name` — только имя). Складывать оба поля вслепую задваивало фамилию («Нелли Симонян Аветисян»).
 * Пока в ядре нет отдельного поля «имя»/«фамилия» (см. qa/requests/clients.md) — не дописываем
 * `lastName`, если последнее слово `name` уже совпадает с ней.
 */
function effectiveLastName(name: string, lastName: string | undefined): string | undefined {
  if (!lastName) return undefined;
  const lastWord = name.trim().split(/\s+/).pop();
  if (lastWord && lastWord.toLowerCase() === lastName.trim().toLowerCase()) return undefined;
  return lastName;
}

/**
 * С2 (clients-review 27.09.2026): длинное ФИО с отчеством ломало строки списка и обрезалось на телефоне —
 * список показывает только имя и фамилию (`includeMiddleName=false`), отчество остаётся особенностью карточки.
 */
export function formatDisplayName(
  name: string,
  lastName: string | undefined,
  middleName: string | undefined,
  canViewFullName: boolean,
  includeMiddleName: boolean = true,
): string {
  const effLastName = effectiveLastName(name, lastName);
  if (canViewFullName) {
    const full = [name, effLastName].filter(Boolean).join(' ');
    return includeMiddleName && middleName ? `${full} ${middleName}` : full;
  }
  if (!effLastName) return name;
  return `${name} ${effLastName.charAt(0)}.`;
}

export type { FineRight };
