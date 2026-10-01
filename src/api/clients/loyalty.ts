'use client';

/** Программа лояльности локации и пересчёт автоправил клиента. */
import type { ClientRow, ImportanceClass, LoyaltyProgram, LoyaltyRecalcChange, LoyaltyRecalcTrigger } from '@/domain/clients';
import { emptyLoyaltyProgram, emptyProfile } from '@/domain/clients';
import type { Id, ISODate } from '@/domain/core';
import { readArea, readCore, mutateArea } from '@/api/area';
import { coreTx } from '@/api/core';
import { isApiMode } from '@/api/http';
import { request } from '@/api/request';
import { parse, today } from '@/lib/date';
import { toRow } from '@/api/clients/shared';
import * as L from '@/api/clients/loyalty.server';

// ─────────────────────────── «Программа лояльности» локации (F-04-073, 114…122, 158) ───────────────────────────

function rowForClient(businessId: Id, clientId: Id): ClientRow | null {
  const core = readCore();
  const client = core.clients.find((c) => c.id === clientId && c.businessId === businessId);
  if (!client) return null;
  const state = readArea('clients');
  return toRow(client, state.profiles[client.id], state.broadcastHistory[client.id] ?? []);
}

function daysSinceLastVisit(lastVisit?: ISODate): number {
  if (!lastVisit) return Number.POSITIVE_INFINITY;
  return parse(today()).diff(parse(lastVisit), 'day');
}

function evalCategoryTrigger(rule: { trigger: string; threshold?: number }, row: ClientRow, trigger: LoyaltyRecalcTrigger, inactiveDays: number): boolean {
  switch (rule.trigger) {
    case 'sold':
      return row.sold >= (rule.threshold ?? 0);
    case 'paid':
      return row.paid >= (rule.threshold ?? 0);
    case 'visits':
      return row.visits >= (rule.threshold ?? 0);
    case 'inactiveDays':
      return inactiveDays >= (rule.threshold ?? 0);
    case 'statusArrived':
      return trigger === 'statusArrived';
    case 'statusNoShow':
      return trigger === 'statusNoShow';
    default:
      return false;
  }
}

export function getLoyaltyProgram(businessId: Id): Promise<LoyaltyProgram> {
  if (isApiMode()) return L.getLoyaltyProgram(businessId);
  return request(() => readArea('clients').loyaltyPrograms[businessId] ?? emptyLoyaltyProgram());
}

/**
 * F-04-121 «сохранение программы пересчитывает всех клиентов»: сохраняет правила и сразу пересчитывает
 * скидку/класс/категории каждого клиента локации. На сервере пересчёт всех клиентов идёт той же командой
 * (`LoyaltyProgramService.save`) — не отдельным вызовом, как в моке.
 */
export function saveLoyaltyProgram(businessId: Id, program: LoyaltyProgram): Promise<{ program: LoyaltyProgram; recalculated: number }> {
  if (isApiMode()) return L.saveLoyaltyProgram(businessId, program);
  return request(async () => {
    mutateArea('clients', (s) => {
      s.loyaltyPrograms[businessId] = program;
    });
    const recalculated = await recalcAllClientsLoyalty(businessId, 'programSaved');
    return { program, recalculated };
  });
}

/**
 * Пересчёт правил одного клиента (F-04-073 «ручной пересчёт» и три автоматических момента, F-04-121).
 * Возвращает null, если правила выключены, клиента нет или ничего не изменилось.
 */
export function recalcClientLoyalty(businessId: Id, clientId: Id, trigger: LoyaltyRecalcTrigger): Promise<LoyaltyRecalcChange | null> {
  if (isApiMode()) return L.recalcClientLoyalty(businessId, clientId, trigger);
  return request(() => recalcClientLoyaltyImpl(businessId, clientId, trigger));
}

/** Тело F-04-073/121 — вынесено из recalcClientLoyalty() так, чтобы чтение и запись базы шли внутри
 * одного request() (иначе mutateArea/readArea вне request() пишут в консоль предупреждение `[mock-db]`). */
export async function recalcClientLoyaltyImpl(businessId: Id, clientId: Id, trigger: LoyaltyRecalcTrigger): Promise<LoyaltyRecalcChange | null> {
  const program = readArea('clients').loyaltyPrograms[businessId];
  if (!program?.enabled) return null;
  const row = rowForClient(businessId, clientId);
  if (!row) return null;
  const inactiveDays = daysSinceLastVisit(row.lastVisit);

  // Скидка (F-04-115): несколько ступеней подходят → берётся большая (F-04-121)
  let discountAfter = 0;
  for (const tier of program.discountTiers) {
    const value = tier.basis === 'sold' ? row.sold : tier.basis === 'paid' ? row.paid : row.visits;
    if (value >= tier.from && tier.percent > discountAfter) discountAfter = tier.percent;
  }
  // Отмена скидки (F-04-116)
  if (inactiveDays >= program.settings.cancelDiscountAfterDays) discountAfter = 0;

  // Класс важности (F-04-117): несколько подходят → старший, Золото > Серебро > Бронза (F-04-121)
  let classAfter: ImportanceClass | undefined;
  for (const cls of ['gold', 'silver', 'bronze'] as ImportanceClass[]) {
    const t = program.classRules[cls];
    const meets =
      (t.minSold !== undefined && row.sold >= t.minSold) ||
      (t.minPaid !== undefined && row.paid >= t.minPaid) ||
      (t.minVisits !== undefined && row.visits >= t.minVisits);
    if (meets) {
      classAfter = cls;
      break;
    }
  }
  if (inactiveDays >= program.settings.cancelClassAfterDays) classAfter = undefined;

  // Категории (F-04-118/119/158): «подходят несколько категорий → присваиваются все» (F-04-121)
  const tags = new Set(row.tags);
  const categoriesAdded: string[] = [];
  const categoriesRemoved: string[] = [];
  for (const rule of program.addRules) {
    if (!rule.category || tags.has(rule.category)) continue;
    if (evalCategoryTrigger(rule, row, trigger, inactiveDays)) {
      tags.add(rule.category);
      categoriesAdded.push(rule.category);
    }
  }
  for (const rule of program.removeRules) {
    if (!rule.category || !tags.has(rule.category)) continue;
    if (evalCategoryTrigger(rule, row, trigger, inactiveDays)) {
      tags.delete(rule.category);
      categoriesRemoved.push(rule.category);
    }
  }

  const discountBefore = row.discount;
  const classBefore = row.importanceClass;
  if (discountBefore === discountAfter && classBefore === classAfter && categoriesAdded.length === 0 && categoriesRemoved.length === 0) {
    return null;
  }

  mutateArea('clients', (s) => {
    const prev = s.profiles[clientId] ?? emptyProfile();
    s.profiles[clientId] = {
      ...prev,
      discountPercent: discountAfter,
      importanceClass: classAfter,
    };
  });
  if (categoriesAdded.length || categoriesRemoved.length) {
    coreTx.update('clients', clientId, { tags: Array.from(tags) });
  }

  return {
    clientId,
    discountBefore,
    discountAfter,
    classBefore,
    classAfter,
    categoriesAdded,
    categoriesRemoved,
  };
}

/**
 * «Сохранение программы пересчитывает всех клиентов» (F-04-121) — возвращает число реально изменившихся.
 * Всегда вызывается уже ИЗНУТРИ чужого request() (сейчас — только saveLoyaltyProgram), поэтому зовёт
 * recalcClientLoyaltyImpl напрямую, а не публичный recalcClientLoyalty: иначе на бизнесе с сотней
 * клиентов у каждого появилась бы своя задержка «сети» (150–400 мс), и сохранение программы лояльности
 * растянулось бы на десятки секунд вместо одной операции.
 */
export async function recalcAllClientsLoyalty(businessId: Id, trigger: LoyaltyRecalcTrigger): Promise<number> {
  const ids = readCore()
    .clients.filter((c) => c.businessId === businessId)
    .map((c) => c.id);
  let changed = 0;
  for (const id of ids) {
    const result = await recalcClientLoyaltyImpl(businessId, id, trigger);
    if (result) changed++;
  }
  return changed;
}
