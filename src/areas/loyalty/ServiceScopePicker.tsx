'use client';

/**
 * F-06-005: выбор услуг/категорий для акции, сертификата или абонемента. По решению F-00-049 миграции
 * услуг в сеть нет — здесь читается общий каталог владельца (listServiceScopeOptions), без «Миграции
 * услуг»/«Миграции в сеть» из Altegio.
 *   - «Все услуги» — программа без ограничения (serviceScope: { categoryIds: [], serviceIds: [] }).
 *   - Категория целиком — её id уходит в categoryIds: программа подхватывает и услуги, добавленные в
 *     категорию позже, потому что при применении список разворачивается заново, а не фиксируется на
 *     момент сохранения.
 *   - Отдельные услуги вне выбранных категорий — их id в serviceIds.
 */
import { useMemo, useState } from 'react';
import { listServiceScopeOptions, type ServiceScopeOptions } from '@/api/loyalty';
import { useApiQuery } from '@/api/request';
import { useCurrent, useDemo } from '@/demo/hooks';
import type { Id } from '@/domain/core';
import type { ServiceScope } from '@/domain/loyalty';
import { useT } from '@/i18n/useT';
import { Checkbox } from '@/ui/Checkbox';
import { EmptyState } from '@/ui/EmptyState';
import { Skeleton } from '@/ui/Skeleton';
import { Switch } from '@/ui/Switch';

export interface ServiceScopePickerProps {
  value: ServiceScope;
  onChange: (value: ServiceScope) => void;
}

export function ServiceScopePicker({ value, onChange }: ServiceScopePickerProps) {
  const t = useT('loyalty');
  const { ready, businessId } = useCurrent();
  const { lang } = useDemo();
  const q = useApiQuery(['loyalty', 'serviceScope', businessId, lang], () => listServiceScopeOptions(businessId!, lang), {
    enabled: ready && Boolean(businessId),
  });

  // Пустой value значит «все услуги», но и «ограничил, ещё ничего не выбрал» — отличить эти два состояния
  // по одному value нельзя, поэтому переключатель ведёт свой локальный флаг: выключил «Все услуги» без
  // единого выбора — список категорий остаётся открытым, а не сразу отскакивает назад на «Все услуги».
  const [restricted, setRestricted] = useState(value.categoryIds.length > 0 || value.serviceIds.length > 0);
  const allServices = !restricted;

  const byCategory = useMemo(() => {
    const options = q.data ?? ({ categories: [], services: [] } satisfies ServiceScopeOptions);
    const map = new Map<Id, typeof options.services>();
    for (const s of options.services) map.set(s.categoryId, [...(map.get(s.categoryId) ?? []), s]);
    return { categories: options.categories, servicesByCategory: map };
  }, [q.data]);

  const toggleAll = (on: boolean) => {
    setRestricted(!on);
    if (on) onChange({ categoryIds: [], serviceIds: [] });
  };

  const toggleCategory = (categoryId: Id, serviceIds: Id[], checked: boolean) => {
    if (checked) {
      onChange({
        categoryIds: [...value.categoryIds, categoryId],
        serviceIds: value.serviceIds.filter((id) => !serviceIds.includes(id)),
      });
    } else {
      onChange({ categoryIds: value.categoryIds.filter((id) => id !== categoryId), serviceIds: value.serviceIds });
    }
  };

  const toggleService = (categoryId: Id, serviceId: Id, checked: boolean) => {
    if (value.categoryIds.includes(categoryId)) return; // услуги категории уже включены целиком
    onChange({
      categoryIds: value.categoryIds,
      serviceIds: checked ? [...value.serviceIds, serviceId] : value.serviceIds.filter((id) => id !== serviceId),
    });
  };

  return (
    <div data-f="F-06-005" className="flex flex-col gap-3">
      <Switch checked={allServices} onCheckedChange={toggleAll} label={t('serviceScope.allServices')} description={t('serviceScope.allServicesHint')} />

      {!allServices &&
        (q.isLoading ? (
          <Skeleton lines={4} />
        ) : !byCategory.categories.length ? (
          <EmptyState compact title={t('serviceScope.emptyTitle')} description={t('serviceScope.emptyText')} />
        ) : (
          <div className="flex max-h-72 flex-col gap-3 overflow-y-auto rounded-xl border border-border bg-surface-2 p-3">
            {byCategory.categories.map((cat) => {
              const services = byCategory.servicesByCategory.get(cat.id) ?? [];
              const categoryChecked = value.categoryIds.includes(cat.id);
              const someSelected = !categoryChecked && services.some((s) => value.serviceIds.includes(s.id));
              return (
                <div key={cat.id} className="flex flex-col gap-1">
                  <Checkbox
                    checked={categoryChecked}
                    indeterminate={someSelected}
                    onCheckedChange={(checked) => toggleCategory(cat.id, services.map((s) => s.id), checked)}
                    label={cat.name}
                  />
                  <div className="ml-6 flex flex-col gap-1">
                    {services.map((s) => (
                      <Checkbox
                        key={s.id}
                        checked={categoryChecked || value.serviceIds.includes(s.id)}
                        disabled={categoryChecked}
                        onCheckedChange={(checked) => toggleService(cat.id, s.id, checked)}
                        label={s.name}
                        className="text-sm"
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
    </div>
  );
}
