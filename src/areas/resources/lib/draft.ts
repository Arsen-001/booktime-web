import type { ResourceSaveInput, ResourceWithMeta } from '@/api/resources';
import type { Id, LocalizedText, ResourceKind } from '@/domain/core';

/** Экземпляр в форме: key — стабильный ключ строки (у нового экземпляра id ещё нет) */
export interface InstanceRow {
  key: string;
  id?: Id;
  name: string;
}

/** Черновик формы ресурса: всё, что сохраняется одной кнопкой «Сохранить» */
export interface ResourceDraft {
  name: LocalizedText;
  description: string;
  kind: ResourceKind;
  locationId: Id;
  serviceIds: Id[];
  instances: InstanceRow[];
}

export interface ResourceDraftErrors {
  name?: string;
  /** По key строки экземпляра */
  instances?: Record<string, string>;
}

let seq = 0;
export function newRowKey(): string {
  seq += 1;
  return `new-${seq}`;
}

export function draftFromResource(r: ResourceWithMeta): ResourceDraft {
  return {
    name: r.name,
    description: r.description,
    kind: r.kind,
    locationId: r.locationId,
    serviceIds: r.serviceIds,
    instances: r.instances.map((i) => ({ key: i.id, id: i.id, name: i.name })),
  };
}

const sameList = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x) => b.includes(x));

export function draftsEqual(a: ResourceDraft, b: ResourceDraft): boolean {
  return (
    (a.name.ru ?? '') === (b.name.ru ?? '') &&
    (a.name.en ?? '') === (b.name.en ?? '') &&
    a.description === b.description &&
    a.kind === b.kind &&
    a.locationId === b.locationId &&
    sameList(a.serviceIds, b.serviceIds) &&
    a.instances.length === b.instances.length &&
    a.instances.every((row, i) => row.id === b.instances[i].id && row.name === b.instances[i].name)
  );
}

/** Проверка перед сохранением: название обязательно, у экземпляров — непустые и разные названия */
export function validateDraft(draft: ResourceDraft, t: { nameRequired: string; instanceRequired: string; instanceDuplicate: string }): ResourceDraftErrors {
  const errors: ResourceDraftErrors = {};
  if (!draft.name.ru?.trim()) errors.name = t.nameRequired;
  const seen = new Map<string, string>();
  const instanceErrors: Record<string, string> = {};
  for (const row of draft.instances) {
    const name = row.name.trim().toLocaleLowerCase();
    if (!name) instanceErrors[row.key] = t.instanceRequired;
    else if (seen.has(name)) instanceErrors[row.key] = t.instanceDuplicate;
    else seen.set(name, row.key);
  }
  if (Object.keys(instanceErrors).length) errors.instances = instanceErrors;
  return errors;
}

export function hasErrors(errors: ResourceDraftErrors): boolean {
  return Boolean(errors.name || (errors.instances && Object.keys(errors.instances).length));
}

export function toSaveInput(draft: ResourceDraft): ResourceSaveInput {
  return {
    name: { ...draft.name, ru: draft.name.ru.trim(), ...(draft.name.en !== undefined ? { en: draft.name.en.trim() } : {}) },
    description: draft.description,
    kind: draft.kind,
    locationId: draft.locationId,
    serviceIds: draft.serviceIds,
    instances: draft.instances.map((row) => ({ id: row.id, name: row.name.trim() })),
  };
}

/** Сменили вид ресурса — имена экземпляров по умолчанию («Кресло 2») следуют за ним, свои имена остаются */
export function renameDefaultInstances(rows: InstanceRow[], fromLabel: string, toLabel: string): InstanceRow[] {
  const re = new RegExp(`^${fromLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} (\\d+)$`);
  return rows.map((r) => {
    const m = re.exec(r.name.trim());
    return m ? { ...r, name: `${toLabel} ${m[1]}` } : r;
  });
}
