'use client';

/**
 * Записи каталога из списка (У5, У9, У10): правка ячейки, мастера, порядок, массовые действия. Правки ячеек —
 * оптимистично (строка меняется сразу, ответ «сервера» не ждём), после — короткое «Сохранено» (У9).
 * Удаление — с «Отменить» 5 с.
 */
import { useEffect, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import {
  bulkDeleteServices,
  bulkPatchServices,
  deleteCategoryWithServices,
  getServiceDeleteImpact,
  patchService,
  renameCategory,
  reorderCategories,
  reorderServices,
  restoreCategory,
  restoreServices,
  setServiceStaffIds,
  type ServicePatch,
  type ServiceRow,
} from '@/api/services';
import { noteDataOpOnServer } from '@/api/data-ops';
import { optimistic, useApiMutation } from '@/api/request';
import type { LocalizedText, ServiceCategory } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { pickText } from '@/lib/text';
import { useConfirm, useToast } from '@/ui/Toast';

const ROWS = ['services', 'rows'] as const;
const CATEGORIES = ['services', 'categories'] as const;

const patchRows = (old: ServiceRow[], ids: string[], patch: ServicePatch) =>
  old.map((r) => (ids.includes(r.service.id) ? { ...r, service: { ...r.service, ...patch } } : r));

export function useCatalogActions(businessId: string) {
  const t = useT('services');
  const toast = useToast();
  const confirm = useConfirm();
  const locale = useLocale() as 'ru' | 'en';

  const patchM = useApiMutation((a: { id: string; patch: ServicePatch }) => patchService(a.id, businessId, a.patch), {
    optimistic: optimistic<ServiceRow[], { id: string; patch: ServicePatch }>(ROWS, (old, a) => patchRows(old, [a.id], a.patch)),
  });
  const bulkM = useApiMutation((a: { ids: string[]; patch: ServicePatch }) => bulkPatchServices(a.ids, businessId, a.patch), {
    optimistic: optimistic<ServiceRow[], { ids: string[]; patch: ServicePatch }>(ROWS, (old, a) => patchRows(old, a.ids, a.patch)),
  });
  const staffM = useApiMutation((a: { id: string; staffIds: string[] }) => setServiceStaffIds(a.id, businessId, a.staffIds), {
    optimistic: optimistic<ServiceRow[], { id: string; staffIds: string[] }>(ROWS, (old, a) =>
      old.map((r) => (r.service.id === a.id ? { ...r, service: { ...r.service, staffIds: a.staffIds } } : r)),
    ),
  });
  const reorderM = useApiMutation((ids: string[]) => reorderServices(ids), {
    optimistic: optimistic<ServiceRow[], string[]>(ROWS, (old, ids) =>
      ids
        .map((id, order) => {
          const r = old.find((x) => x.service.id === id);
          return r ? { ...r, service: { ...r.service, order } } : undefined;
        })
        .filter((r): r is ServiceRow => Boolean(r)),
    ),
  });
  const reorderCatM = useApiMutation((ids: string[]) => reorderCategories(ids), {
    optimistic: optimistic<ServiceCategory[], string[]>(CATEGORIES, (old, ids) =>
      ids
        .map((id, order) => {
          const c = old.find((x) => x.id === id);
          return c ? { ...c, order } : undefined;
        })
        .filter((c): c is ServiceCategory => Boolean(c)),
    ),
  });
  const deleteM = useApiMutation((ids: string[]) => bulkDeleteServices(ids, businessId), {
    optimistic: optimistic<ServiceRow[], string[]>(ROWS, (old, ids) => old.filter((r) => !ids.includes(r.service.id))),
  });
  const restoreM = useApiMutation(restoreServices);
  const renameM = useApiMutation((a: { id: string; name: LocalizedText }) => renameCategory(a.id, businessId, a.name), {
    optimistic: optimistic<ServiceCategory[], { id: string; name: LocalizedText }>(CATEGORIES, (old, a) =>
      old.map((c) => (c.id === a.id ? { ...c, name: a.name } : c)),
    ),
  });
  const deleteCatM = useApiMutation((id: string) => deleteCategoryWithServices(id, businessId));
  const restoreCatM = useApiMutation(restoreCategory);

  const saved = () => toast.success(t('list.saved'), { durationMs: 1500 });
  const failed = () => toast.error(t('form.saveFailed'));

  const run = async (p: Promise<unknown>, quiet = false) => {
    try {
      await p;
      if (!quiet) saved();
      return true;
    } catch {
      failed();
      return false;
    }
  };

  const api = {
    patch: (id: string, patch: ServicePatch) => run(patchM.mutate({ id, patch })),
    setStaff: (id: string, staffIds: string[]) => run(staffM.mutate({ id, staffIds })),
    bulkPatch: async (ids: string[], patch: ServicePatch, message: string) => {
      if (await run(bulkM.mutate({ ids, patch }), true)) toast.success(message);
    },
    reorderServices: (ids: string[]) => run(reorderM.mutate(ids), true),
    reorderCategories: (ids: string[]) => run(reorderCatM.mutate(ids), true),
    renameCategory: (id: string, name: LocalizedText) => run(renameM.mutate({ id, name })),

    /** Удалить одну или несколько услуг: для одной — окно с последствиями (F-16-170), для нескольких — число */
    deleteServices: async (rows: ServiceRow[]): Promise<boolean> => {
      if (!rows.length) return false;
      let description: string;
      if (rows.length === 1) {
        const impact = await getServiceDeleteImpact(rows[0].service.id);
        const parts: string[] = [];
        if (impact.staffCount) parts.push(t('delete.impactStaff', { count: impact.staffCount }));
        if (impact.futureBookings) parts.push(t('delete.impactBookings', { count: impact.futureBookings }));
        if (impact.futureEvents) parts.push(t('delete.impactEvents', { count: impact.futureEvents }));
        if (impact.packagesUsing) parts.push(t('delete.impactPackages', { count: impact.packagesUsing }));
        description = parts.length ? parts.join(' · ') : t('delete.noImpact');
      } else {
        description = t('bulk.deleteText');
      }
      const ok = await confirm({
        title:
          rows.length === 1
            ? t('delete.title', {
                name: pickText(rows[0].service.name, locale),
              })
            : t('bulk.deleteTitle', { count: rows.length }),
        description,
        tone: 'danger',
        confirmLabel: t('delete.confirm'),
      });
      if (!ok) return false;
      try {
        const snapshots = await deleteM.mutate(rows.map((r) => r.service.id));
        // «Операции с данными» (F-02-063): в api — строка на сервер (удаление шло отдельными запросами), в демо её пишет мок
        if (rows.length > 1) void noteDataOpOnServer({ businessId, kind: 'delete', area: 'services', entity: 'services', count: snapshots.length });
        toast.success(
          rows.length === 1
            ? t('delete.done', { name: pickText(rows[0].service.name, locale) })
            : t('bulk.deleted', { count: rows.length }),
          {
            action: {
              label: t('delete.undo'),
              onClick: () => void restoreM.mutate(snapshots),
            },
            durationMs: 5000,
          },
        );
        return true;
      } catch {
        failed();
        return false;
      }
    },

    deleteCategory: async (category: ServiceCategory, count: number) => {
      const ok = await confirm({
        title: t('categoryForm.deleteTitle', {
          name: pickText(category.name, locale),
        }),
        description: count ? t('categoryForm.deleteWithServices', { count }) : t('categoryForm.deleteNoImpact'),
        tone: 'danger',
        confirmLabel: t('delete.confirm'),
      });
      if (!ok) return;
      try {
        const snapshot = await deleteCatM.mutate(category.id);
        toast.success(t('categoryForm.deleted'), {
          action: {
            label: t('delete.undo'),
            onClick: () => void restoreCatM.mutate(snapshot),
          },
          durationMs: 5000,
        });
      } catch {
        toast.error(t('categoryForm.deleteFailed'));
      }
    },
  };

  // Строки получают ОДИН и тот же объект действий на всё время жизни экрана: иначе каждая правка (новое
  // состояние мутации) давала бы новый объект и перерисовывала все строки, а не одну изменённую (DESIGN.md
  // «Nothing blinks»). Методы берут свежие мутации из ref в момент вызова.
  const latest = useRef(api);
  useEffect(() => {
    latest.current = api;
  });
  const [stable] = useState(() => {
    const out = {} as typeof api;
    (Object.keys(api) as (keyof typeof api)[]).forEach((k) => {
      (out as Record<string, unknown>)[k] = (...args: unknown[]) => (latest.current[k] as (...a: unknown[]) => unknown)(...args);
    });
    return out;
  });
  return stable;
}

export type CatalogActions = ReturnType<typeof useCatalogActions>;
