'use client';

/** Спрос без предложения (F-00-180), награда первому в районе/сфере (F-00-181). */
import { isApiMode } from '@/api/http';
import { request } from '@/api/request';
import { mutateArea, readArea, readCore } from '@/api/area';
import type { DistrictId, Id, SphereId } from '@/domain/core';
import type { DemandPeriod, DemandQueryGroup, DemandReport, DemandSphereRow, FirstAward, FirstBadge, FirstCandidate } from '@/domain/platform';
import { addDays, nowDateTime, today } from '@/lib/date';
import { newId } from '@/lib/id';
import { AREA, PANEL } from '@/api/platform/shared';
import * as S from '@/api/platform/demand.server';

function periodRange(period: DemandPeriod): { from: string; to: string } {
  const t = today();
  if (period === 'week') return { from: addDays(t, -6), to: t };
  if (period === 'prevWeek') return { from: addDays(t, -13), to: addDays(t, -7) };
  return { from: addDays(t, -29), to: t };
}

/** Из приложения клиента: пустой поиск «кого ищете» (F-00-112) */
export function reportSearchDemand(entry: { query: string; sphereId?: SphereId; district: DistrictId; appUserId: Id; notify?: boolean }): Promise<void> {
  return request(() => {
    mutateArea(AREA, (s) => {
      s.demandEntries.push({ id: newId('demand'), ...entry, notify: entry.notify ?? false, at: nowDateTime() });
    });
  });
}

/** Где у нас есть предложение: сфера → районы, сфера → бизнесов в городе (считается один раз на отчёт) */
function offerIndex(core: ReturnType<typeof readCore>) {
  const districtsBySphere = new Map<SphereId, Map<DistrictId, number>>();
  const cityBySphere = new Map<SphereId, number>();
  const districtsByBiz = new Map<Id, Set<DistrictId>>();
  core.locations.forEach((l) => {
    const set = districtsByBiz.get(l.businessId) ?? new Set<DistrictId>();
    set.add(l.district);
    districtsByBiz.set(l.businessId, set);
  });
  core.businesses.forEach((b) => {
    b.sphereIds.forEach((sph) => {
      cityBySphere.set(sph, (cityBySphere.get(sph) ?? 0) + 1);
      const byDistrict = districtsBySphere.get(sph) ?? new Map<DistrictId, number>();
      districtsByBiz.get(b.id)?.forEach((d) => byDistrict.set(d, (byDistrict.get(d) ?? 0) + 1));
      districtsBySphere.set(sph, byDistrict);
    });
  });
  return {
    inDistrict: (sph: SphereId | undefined, d: DistrictId) => (sph ? (districtsBySphere.get(sph)?.get(d) ?? 0) : 0),
    inCity: (sph: SphereId | undefined) => (sph ? (cityBySphere.get(sph) ?? 0) : 0),
  };
}

const capitalize = (text: string) => (text ? text[0].toLocaleUpperCase() + text.slice(1) : text);

export function getDemandReport(period: DemandPeriod = 'week'): Promise<DemandReport> {
  if (isApiMode()) return S.getDemandReport(period);
  return request(() => {
    const { from, to } = periodRange(period);
    const offers = offerIndex(readCore());
    const entries = readArea(AREA).demandEntries.filter((e) => e.at.slice(0, 10) >= from && e.at.slice(0, 10) <= to);

    const byQuery = new Map<string, { query: string; sphereId?: SphereId; people: Set<Id>; requests: number; notify: number; districts: Map<DistrictId, Set<Id>> }>();
    entries.forEach((e) => {
      const key = e.query.trim().toLowerCase();
      const row = byQuery.get(key) ?? { query: capitalize(e.query.trim()), sphereId: e.sphereId, people: new Set<Id>(), requests: 0, notify: 0, districts: new Map() };
      row.people.add(e.appUserId);
      row.requests += 1;
      if (e.notify) row.notify += 1;
      const inDistrict = row.districts.get(e.district) ?? new Set<Id>();
      inDistrict.add(e.appUserId);
      row.districts.set(e.district, inDistrict);
      byQuery.set(key, row);
    });

    const groups: DemandQueryGroup[] = Array.from(byQuery.entries()).map(([key, r]) => {
      const districts = Array.from(r.districts.entries())
        .map(([district, people]) => ({ district, people: people.size, offerInDistrict: offers.inDistrict(r.sphereId, district) }))
        .sort((a, b) => a.offerInDistrict - b.offerInDistrict || b.people - a.people);
      return {
        key,
        query: r.query,
        sphereId: r.sphereId,
        people: r.people.size,
        requests: r.requests,
        notify: r.notify,
        offerInCity: offers.inCity(r.sphereId),
        districts,
        districtsWithoutOffer: districts.filter((d) => d.offerInDistrict === 0).length,
      };
    });
    groups.sort((a, b) => Number(b.districtsWithoutOffer > 0) - Number(a.districtsWithoutOffer > 0) || b.people - a.people);

    const noSphere: DemandSphereRow[] = groups
      .filter((g) => g.offerInCity === 0)
      .map((g) => ({ key: g.key, query: g.query, sphereId: g.sphereId, people: g.people, districts: g.districts.map((d) => d.district) }));

    return {
      period,
      from,
      to,
      groups,
      noSphere,
      totalPeople: new Set(entries.map((e) => e.appUserId)).size,
      withoutOffer: groups.filter((g) => g.districtsWithoutOffer > 0).length,
    };
  }, PANEL);
}

const FIRST_AWARD_SPHERES: SphereId[] = ['nails', 'barber', 'hair', 'cosmetology', 'massage', 'dental', 'fitness', 'carwash'];

/** Первый мастер в районе ИЛИ единственный в сфере по городу (F-00-181) */
export function listFirstCandidates(): Promise<FirstCandidate[]> {
  if (isApiMode()) return S.listFirstCandidates();
  return request(() => {
    const core = readCore();
    const awards = readArea(AREA).firstAwards;
    const candidates: FirstCandidate[] = [];
    FIRST_AWARD_SPHERES.forEach((sph) => {
      const inCity = core.businesses.filter((b) => b.sphereIds.includes(sph));
      if (inCity.length === 1) {
        const biz = inCity[0];
        candidates.push({ key: `sphere__${sph}`, businessId: biz.id, businessName: biz.name, scope: 'sphere', sphereId: sph, awarded: awards.find((a) => a.businessId === biz.id && a.scope === 'sphere' && a.sphereId === sph) });
        return;
      }
      const byDistrict = new Map<DistrictId, Id[]>();
      inCity.forEach((b) => {
        const districts = new Set(core.locations.filter((l) => l.businessId === b.id).map((l) => l.district));
        districts.forEach((d) => byDistrict.set(d, [...(byDistrict.get(d) ?? []), b.id]));
      });
      byDistrict.forEach((ids, d) => {
        if (ids.length !== 1) return;
        const biz = inCity.find((b) => b.id === ids[0]);
        if (!biz) return;
        candidates.push({
          key: `district__${sph}__${d}`,
          businessId: biz.id,
          businessName: biz.name,
          scope: 'district',
          sphereId: sph,
          district: d,
          awarded: awards.find((a) => a.businessId === biz.id && a.scope === 'district' && a.sphereId === sph && a.district === d),
        });
      });
    });
    // Ещё не награждённые — выше
    return candidates.sort((a, b) => Number(Boolean(a.awarded)) - Number(Boolean(b.awarded))).slice(0, 40);
  }, PANEL);
}

export function grantFirstAward(businessId: Id, scope: FirstAward['scope'], sphereId: SphereId, district: DistrictId | undefined, freeDays: number, coins: number): Promise<FirstAward> {
  if (isApiMode()) return S.grantFirstAward(businessId, scope, sphereId, district, freeDays, coins);
  return request(() => {
    const award: FirstAward = { id: newId('first'), businessId, scope, sphereId, district, freeDays, coins, at: nowDateTime() };
    mutateArea(AREA, (s) => {
      if (s.firstAwards.some((a) => a.businessId === businessId && a.scope === scope && a.sphereId === sphereId && a.district === district)) return;
      s.firstAwards.push(award);
      const meta = s.bizMeta[businessId] ?? { businessId, source: 'self' as const };
      const base = meta.freeUntil && meta.freeUntil > today() ? meta.freeUntil : today();
      meta.freeUntil = addDays(base, freeDays);
      s.bizMeta[businessId] = meta;
      if (coins > 0) s.coinEntries.push({ id: newId('coin'), businessId, kind: 'gift', amount: coins, reason: 'firstAward', refId: award.id, at: award.at });
    });
    return award;
  }, PANEL);
}

/** Значок на карточке мастера: район важнее сферы (как сервер); дни и монеты награды наружу не отдаём */
export function getFirstBadge(businessId: Id): Promise<FirstBadge | undefined> {
  if (isApiMode()) return S.getFirstBadge(businessId);
  return request(() => {
    const own = readArea(AREA).firstAwards.filter((a) => a.businessId === businessId);
    const a = own.find((x) => x.scope === 'district') ?? own[0];
    return a ? { scope: a.scope, sphereId: a.sphereId, ...(a.district ? { district: a.district } : {}) } : undefined;
  });
}
