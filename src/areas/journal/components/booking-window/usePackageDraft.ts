'use client';

/**
 * F-16-125, F-16-129, F-16-130: черновик пакетов, добавленных в открытое окно записи (UI-состояние, не база).
 * Пакет из списка услуг делится правилом splitPackageForBooking: услуги мастера окна становятся строками
 * этой записи (их возвращает addPackage), услуги других мастеров — связанными записями, которые окно
 * создаёт при сохранении (attachLinkedBookings). Цена услуг — по способу цены пакета (packagePrice).
 */
import { useState } from 'react';
import type { Id, LocaleCode, Service, Staff } from '@/domain/core';
import { listPackages, packagePrice, toPackageServiceLite } from '@/api/resources';
import { useApiQuery } from '@/api/request';
import { pickText } from '@/lib/text';
import {
  splitPackageForBooking,
  type LinkedBookingDraft,
  type PackageDraftLine,
  type PackageItemRef,
} from '@/domain/journalPackages';

export interface AddedPackage {
  packageId: Id;
  name: string;
  mode: NonNullable<Service['servicePackage']>['mode'];
}

/** Куда добавить следующую обычную услугу: в эту запись или в связанную запись другого мастера (F-16-129) */
export type ServiceTarget = 'main' | string;

export function usePackageDraft({ businessId, allServices, locale }: { businessId: Id | undefined; allServices: Service[]; locale: LocaleCode }) {
  const packagesQuery = useApiQuery(['resources', 'packages', businessId], () => listPackages(businessId ?? ''), { enabled: Boolean(businessId) });
  // Данные, а не весь объект запроса (он новый на каждый рендер) — иначе addPackage и весь черновик менялись бы каждый рендер
  const packages = packagesQuery.data;
  const [added, setAdded] = useState<AddedPackage[]>([]);
  const [linked, setLinked] = useState<LinkedBookingDraft[]>([]);
  const [target, setTarget] = useState<ServiceTarget>('main');

  const byId = new Map(allServices.map((s) => [s.id, s]));

  /** Добавляет пакет; возвращает строки для ЭТОЙ записи (их кладёт в состав окно) */
  const addPackage = (pkg: Service, currentStaffId: Id): PackageDraftLine[] => {
    const composition = pkg.servicePackage;
    if (!composition) return [];
    const extra = packages?.find((p) => p.id === pkg.id)?.extra;
    const orderedItems = [...composition.items].sort((a, b) => a.order - b.order);
    const price = packagePrice(
      orderedItems.map((i) => ({ serviceId: i.serviceId, qty: 1 })),
      toPackageServiceLite(allServices),
      extra?.pricingMethod ?? 'sumServices',
      extra?.manualPrice,
      extra?.discountPercent,
    );
    const items: PackageItemRef[] = orderedItems.flatMap((i) => {
      const svc = byId.get(i.serviceId);
      if (!svc) return [];
      return [
        {
          serviceId: svc.id,
          name: pickText(svc.name, locale),
          durationMin: svc.durationMin,
          price: price.perService[svc.id]?.min ?? svc.priceMin,
          staffIds: svc.staffIds,
        },
      ];
    });
    const { own, linked: newLinked } = splitPackageForBooking({
      packageId: pkg.id,
      mode: composition.mode,
      items,
      currentStaffId,
      keyPrefix: `${pkg.id}:${added.length}`,
    });
    setAdded((prev) => [...prev, { packageId: pkg.id, name: pickText(pkg.name, locale), mode: composition.mode }]);
    setLinked((prev) => [...prev, ...newLinked]);
    return own;
  };

  const removePackage = (packageId: Id) => {
    setAdded((prev) => prev.filter((p) => p.packageId !== packageId));
    setLinked((prev) => prev.filter((l) => l.packageId !== packageId));
    setTarget('main');
  };

  /** F-16-129: обычная услуга к связанной записи выбранного мастера */
  const addServiceToLinked = (key: string, service: Service) => {
    setLinked((prev) =>
      prev.map((l) =>
        l.key === key
          ? { ...l, lines: [...l.lines, { serviceId: service.id, name: pickText(service.name, locale), durationMin: service.durationMin, price: service.priceMin }] }
          : l,
      ),
    );
  };

  /** Корзина у отдельно добавленной обычной услуги (119203) */
  const removeLinkedLine = (key: string, index: number) => {
    setLinked((prev) => prev.map((l) => (l.key === key ? { ...l, lines: l.lines.filter((_, i) => i !== index) } : l)));
  };

  const setLinkedStaff = (key: string, staffId: Id) => {
    setLinked((prev) => prev.map((l) => (l.key === key ? { ...l, staffId } : l)));
  };

  /** Мастера, которые могут взять связанную запись: оказывают все её услуги из пакета */
  const staffOptionsFor = (draft: LinkedBookingDraft, staffList: Staff[]): Staff[] => {
    const needed = draft.lines.filter((l) => l.packageId).map((l) => l.serviceId);
    return staffList.filter((s) => needed.every((id) => byId.get(id)?.staffIds.includes(s.id)));
  };

  /** Обычные услуги, доступные мастеру связанной записи (для выбора «куда добавить») */
  const targetStaffId = target === 'main' ? undefined : linked.find((l) => l.key === target)?.staffId;

  const reset = () => {
    setAdded([]);
    setLinked([]);
    setTarget('main');
  };

  return {
    added,
    linked,
    target: linked.some((l) => l.key === target) ? target : 'main',
    targetStaffId,
    setTarget,
    addPackage,
    removePackage,
    addServiceToLinked,
    removeLinkedLine,
    setLinkedStaff,
    staffOptionsFor,
    reset,
  };
}

export type PackageDraft = ReturnType<typeof usePackageDraft>;
