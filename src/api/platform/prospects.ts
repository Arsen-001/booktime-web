'use client';

/**
 * «Места» (03.10.2026): база заведений Еревана для отдела продаж — список с фильтрами и счётчиками по системам записи,
 * карточка, правка, удаление, импорт JSON (upsert по «имя|адрес»), выгрузка CSV. Статус места — из визитов.
 */
import { isApiMode } from '@/api/http';
import { ApiError, request } from '@/api/request';
import { mutateArea, readArea } from '@/api/area';
import type { Id } from '@/domain/core';
import {
  countProspectsBySystem,
  matchesProspect,
  matchesProspectExceptSystem,
  parseProspectImportRow,
  prospectCsvRow,
  prospectDedupKey,
  prospectImportPatch,
  prospectStatusFromVisits,
  sortProspects,
  PROSPECT_CSV_HEADERS,
  type ProspectCard,
  type ProspectExport,
  type ProspectFilter,
  type ProspectImportReport,
  type ProspectListQuery,
  type ProspectListResult,
  type ProspectPatch,
  type ProspectRow,
  type StoredProspect,
  type Visit,
} from '@/domain/platform';
import { toCsv } from '@/lib/csv';
import { nowDateTime, today } from '@/lib/date';
import { newId } from '@/lib/id';
import { AREA, PANEL } from '@/api/platform/shared';
import * as S from '@/api/platform/prospects.server';

function withStatus(p: StoredProspect, visits: readonly Visit[]): ProspectRow {
  const { dedupKey: _key, ...rest } = p;
  return { ...rest, ...prospectStatusFromVisits(visits.filter((v) => v.prospectId === p.id)) };
}

function rowsWithStatus(): ProspectRow[] {
  const s = readArea(AREA);
  return s.prospects.map((p) => withStatus(p, s.visits));
}

export function listProspects(query: ProspectListQuery): Promise<ProspectListResult> {
  if (isApiMode()) return S.listProspects(query);
  return request(() => {
    const all = rowsWithStatus();
    const base = all.filter((p) => matchesProspectExceptSystem(p, query));
    const filtered = sortProspects(base.filter((p) => matchesProspect(p, query)), query.sort);
    const pageSize = query.pageSize ?? 20;
    const page = query.page ?? 1;
    return { items: filtered.slice((page - 1) * pageSize, page * pageSize), total: filtered.length, systemCounts: countProspectsBySystem(base), totalAll: all.length };
  }, PANEL);
}

export function getProspect(id: Id): Promise<ProspectCard> {
  if (isApiMode()) return S.getProspect(id);
  return request(() => {
    const s = readArea(AREA);
    const p = s.prospects.find((x) => x.id === id);
    if (!p) throw new ApiError('not_found');
    const visits = s.visits
      .filter((v) => v.prospectId === id)
      .sort((a, b) => b.visitedAt.localeCompare(a.visitedAt) || b.createdAt.localeCompare(a.createdAt))
      .map((v) => ({ id: v.id, visitedAt: v.visitedAt, status: v.status, responsibleId: v.responsibleId, note: v.note, businessId: v.businessId }));
    return { ...withStatus(p, s.visits), visits };
  }, PANEL);
}

export function updateProspect(id: Id, patch: ProspectPatch, version?: number): Promise<ProspectCard> {
  if (isApiMode()) return S.updateProspect(id, patch, version);
  return request(() => {
    mutateArea(AREA, (s) => {
      const p = s.prospects.find((x) => x.id === id);
      if (!p) throw new ApiError('not_found');
      if (version !== undefined && p.version !== version) throw new ApiError('conflict');
      const next = { ...p, ...patch, branches: patch.branches === null ? undefined : (patch.branches ?? p.branches), staffEstimate: patch.staffEstimate === null ? undefined : (patch.staffEstimate ?? p.staffEstimate), reviews: patch.reviews === null ? undefined : (patch.reviews ?? p.reviews) };
      const key = prospectDedupKey(next.name, next.address);
      if (key !== p.dedupKey && s.prospects.some((x) => x.id !== id && x.dedupKey === key)) throw new ApiError('conflict');
      Object.assign(p, next, { dedupKey: key, version: p.version + 1, updatedAt: nowDateTime() });
    });
    const s = readArea(AREA);
    const p = s.prospects.find((x) => x.id === id);
    if (!p) throw new ApiError('not_found');
    return { ...withStatus(p, s.visits), visits: [] };
  }, PANEL);
}

/** Удалить место; визиты остаются, связь с местом снимается */
export function deleteProspect(id: Id): Promise<{ ok: true }> {
  if (isApiMode()) return S.deleteProspect(id);
  return request(() => {
    mutateArea(AREA, (s) => {
      const i = s.prospects.findIndex((x) => x.id === id);
      if (i < 0) throw new ApiError('not_found');
      s.prospects.splice(i, 1);
      for (const v of s.visits) if (v.prospectId === id) v.prospectId = undefined;
    });
    return { ok: true as const };
  }, PANEL);
}

/** Импорт JSON-массива от сборщиков данных (snake_case): новое добавляет, известное по «имя|адрес» — дополняет */
export function importProspects(rows: unknown[]): Promise<ProspectImportReport> {
  if (isApiMode()) return S.importProspects(rows);
  return request(() => {
    const report: ProspectImportReport = { added: 0, updated: 0, unchanged: 0, skipped: 0, errors: [] };
    const now = nowDateTime();
    mutateArea(AREA, (s) => {
      const byKey = new Map(s.prospects.map((p) => [p.dedupKey, p]));
      const touched = new Set<string>();
      const added = new Set<string>();
      rows.forEach((raw, index) => {
        const r = parseProspectImportRow(raw);
        if (!r.ok) {
          report.skipped += 1;
          if (report.errors.length < 100) report.errors.push({ index, reason: r.reason });
          return;
        }
        const key = prospectDedupKey(r.data.name, r.data.address);
        const known = byKey.get(key);
        if (!known) {
          const p: StoredProspect = { ...r.data, id: newId('pros'), dedupKey: key, version: 1, createdAt: now, updatedAt: now };
          s.prospects.push(p);
          byKey.set(key, p);
          added.add(key);
          return;
        }
        const patch = prospectImportPatch(known, r.data);
        if (Object.keys(patch).length) {
          Object.assign(known, patch, { updatedAt: now });
          if (!added.has(key) && !touched.has(key)) known.version += 1;
          touched.add(key);
        } else if (!added.has(key) && !touched.has(key)) {
          report.unchanged += 1;
        }
      });
      report.added = added.size;
      report.updated = [...touched].filter((k) => !added.has(k)).length;
    });
    return report;
  }, PANEL);
}

/** CSV тех же мест, что в списке с этими фильтрами (без страниц) */
export function exportProspects(filter: ProspectFilter & { sort?: ProspectListQuery['sort'] }): Promise<ProspectExport> {
  if (isApiMode()) return S.exportProspects(filter);
  return request(() => {
    const rows = sortProspects(rowsWithStatus().filter((p) => matchesProspect(p, filter)), filter.sort);
    return { fileName: `prospects-${today()}.csv`, csv: toCsv(rows.map(prospectCsvRow), PROSPECT_CSV_HEADERS), rows: rows.length };
  }, PANEL);
}
