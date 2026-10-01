'use client';

/**
 * Вклад «resources» в карточку услуги — вкладка «Ресурсы». Два независимых блока (план раздела так развёл
 * их по вкладкам вклада, не по отдельным экранам «Услуг»):
 *  - F-16-028: «Тип» (запись / групповое событие) и «Макс. мест» — пишет Service.kind/capacity ядра;
 *  - F-16-006: какие ресурсы привязаны к этой услуге.
 * У новой (ещё не сохранённой) услуги вкладка не работает — сначала сохраните услугу (ТЗ 02 §Форма услуги).
 * 28.09: в карточке услуги (хозяин передал registerAfterSave) привязки ресурсов копятся черновиком и пишутся
 * вместе с услугой одной кнопкой «Сохранить»; «Тип» и «Макс. мест» там уже есть в форме — здесь не дублируем.
 * Без хозяина (/dev/ext) — как раньше, каждое изменение сразу.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import { Armchair } from 'lucide-react';
import { coreGet, coreList, coreUpdate } from '@/api/core';
import { countFutureGroupEventsForService, getGroupServicePayment, listResources, setGroupServicePayment, setResourceServices } from '@/api/resources';
import { optimistic, useApiMutation, useApiQuery } from '@/api/request';
import { useCan } from '@/demo/hooks';
import type { Resource, ServiceKind } from '@/domain/core';
import { useServiceAfterSaveStep } from '@/extensions/saveHooks';
import type { ServiceCardExtProps } from '@/extensions/types';
import { pickText } from '@/lib/text';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { FormField } from '@/ui/FormField';
import { Select } from '@/ui/Select';
import { Switch } from '@/ui/Switch';
import { useToast } from '@/ui/Toast';
import { EntityMultiPicker } from '@/areas/resources/components/EntityMultiPicker';
import { useResourcesRights } from '@/areas/resources/lib/rights';

export default function ResourcesServiceCard({ mode, serviceId, businessId, registerAfterSave, onDirtyChange }: ServiceCardExtProps) {
  const hosted = Boolean(registerAfterSave);
  const t = useT('resources');
  const locale = useLocale();
  const toast = useToast();
  // F-16-035: тип (индивидуальная/групповая) и вместимость меняет «Редактирование услуг», не грубое resources.manage
  const canEditKind = useCan('services.edit');
  // F-16-026: вкладка «Ресурсы» услуги — своя тонкая галочка «Ресурсы услуги»
  const canManage = useResourcesRights().editServiceResources;

  const serviceQ = useApiQuery(['resources', 'service-type', serviceId], () => coreGet('services', serviceId!), { enabled: mode === 'edit' && Boolean(serviceId) });
  const futureEventsQ = useApiQuery(['resources', 'future-group-events', serviceId], () => countFutureGroupEventsForService(serviceId!), {
    enabled: mode === 'edit' && Boolean(serviceId) && serviceQ.data?.kind === 'group',
  });
  const resourcesQ = useApiQuery(['resources', 'list', businessId], () => listResources(businessId), { enabled: mode === 'edit' && Boolean(serviceId) });
  // F-16-124: услугу, входящую в пакеты, предупреждаем ДО смены на групповую — тип пакетов ломается (F-16-124)
  const packagesQ = useApiQuery(['resources', 'services-for-form', businessId], () => coreList('services', { businessId }), { enabled: mode === 'edit' && Boolean(serviceId) });
  const packagesUsingThis = useMemo(
    () => (packagesQ.data ?? []).filter((s) => s.servicePackage?.items.some((it) => it.serviceId === serviceId)),
    [packagesQ.data, serviceId],
  );
  const options = useMemo(() => (resourcesQ.data ?? []).filter((r) => r.active || (serviceId ? r.serviceIds.includes(serviceId) : false)).map((r) => ({ id: r.id, label: pickText(r.name, locale), description: r.description || undefined })), [resourcesQ.data, locale]);
  const linkedIds = useMemo(() => (resourcesQ.data ?? []).filter((r) => serviceId && r.serviceIds.includes(serviceId)).map((r) => r.id), [resourcesQ.data, serviceId]);

  // F-16-031: предоплата и абонемент у групповой услуги — можно включить оба сразу
  const groupPaymentQ = useApiQuery(['resources', 'group-payment', serviceId], () => getGroupServicePayment(serviceId!), {
    enabled: mode === 'edit' && Boolean(serviceId) && serviceQ.data?.kind === 'group',
  });
  const saveGroupPayment = useApiMutation((patch: { onlinePrepaymentEnabled?: boolean; membershipBookingEnabled?: boolean }) => setGroupServicePayment(serviceId!, patch));

  // Кэш списка правим сразу (patch, без перечитывания и мигания), база сверит сама
  const toggle = useApiMutation((args: { resourceId: string; serviceIds: string[] }) => setResourceServices(args.resourceId, args.serviceIds), {
    optimistic: optimistic<Resource[], { resourceId: string; serviceIds: string[] }>(['resources', 'list', businessId], (old, args) =>
      old.map((r) => (r.id === args.resourceId ? { ...r, serviceIds: args.serviceIds } : r)),
    ),
  });
  const saveType = useApiMutation((patch: { kind: ServiceKind; capacity?: number }) => coreUpdate('services', serviceId!, patch));

  const [capacityDraft, setCapacityDraft] = useState<number | null>(null);
  // Черновик привязок в карточке услуги (hosted): null — нет несохранённого
  const [pendingIds, setPendingIds] = useState<string[] | null>(null);
  const pendingDirty = pendingIds !== null && (pendingIds.length !== linkedIds.length || pendingIds.some((id) => !linkedIds.includes(id)));

  const applyLinks = async (sid: string, nextIds: string[]) => {
    const added = nextIds.filter((id) => !linkedIds.includes(id));
    const removed = linkedIds.filter((id) => !nextIds.includes(id));
    for (const resourceId of added) {
      const r = (resourcesQ.data ?? []).find((x) => x.id === resourceId);
      if (r) await toggle.mutate({ resourceId, serviceIds: Array.from(new Set([...r.serviceIds, sid])) });
    }
    for (const resourceId of removed) {
      const r = (resourcesQ.data ?? []).find((x) => x.id === resourceId);
      if (r) await toggle.mutate({ resourceId, serviceIds: r.serviceIds.filter((id) => id !== sid) });
    }
  };

  // Шаг «после сохранения услуги»: пишем привязки одним заходом; ошибка — хозяин покажет тост, черновик остаётся
  useServiceAfterSaveStep(registerAfterSave, async (sid) => {
    if (!pendingDirty || !pendingIds) return;
    await applyLinks(sid, pendingIds);
    setPendingIds(null);
  });

  const dirtyRef = useRef(onDirtyChange);
  useEffect(() => {
    dirtyRef.current = onDirtyChange;
  });
  useEffect(() => {
    dirtyRef.current?.(pendingDirty);
  }, [pendingDirty]);

  if (mode === 'create' || !serviceId) {
    return <EmptyState compact title={t('serviceCard.saveFirst')} />;
  }

  const onChange = async (nextIds: string[]) => {
    if (hosted) {
      setPendingIds(nextIds);
      return;
    }
    try {
      await applyLinks(serviceId, nextIds);
    } catch {
      toast.error(t('form.saveFailed'));
    }
  };

  const service = serviceQ.data;
  const capacity = capacityDraft ?? service?.capacity ?? 1;

  const saveKind = async (kind: ServiceKind) => {
    try {
      await saveType.mutate({ kind, capacity: kind === 'group' ? capacity : undefined });
      setCapacityDraft(null);
      serviceQ.refetch();
      toast.success(t('form.updated'));
    } catch {
      toast.error(t('form.saveFailed'));
    }
  };
  const saveCapacity = async (next: number) => {
    setCapacityDraft(next);
    try {
      await saveType.mutate({ kind: 'group', capacity: next });
    } catch {
      toast.error(t('form.saveFailed'));
    }
  };

  const onGroupPaymentChange = async (patch: { onlinePrepaymentEnabled?: boolean; membershipBookingEnabled?: boolean }) => {
    try {
      await saveGroupPayment.mutate(patch);
      groupPaymentQ.refetch();
    } catch {
      toast.error(t('form.saveFailed'));
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {service && (
        <div data-f="F-16-028 F-16-035" className="flex flex-col gap-3">
          {packagesUsingThis.length > 0 && service.kind !== 'group' && (
            <p data-f="F-16-124" className="rounded-lg bg-warning-soft px-3.5 py-2.5 text-sm text-warning">
              {t('serviceCard.inPackagesWarning', { count: packagesUsingThis.length })}
            </p>
          )}
          {!hosted && (
            <FormField label={t('serviceCard.type')} hint={!canEditKind ? t('serviceCard.needEditRight') : undefined}>
            <Select
              disabled={!canEditKind}
              value={service.kind}
              onValueChange={(v) => saveKind(v as ServiceKind)}
              options={[
                { value: 'individual', label: t('serviceCard.typeIndividual') },
                { value: 'group', label: t('serviceCard.typeGroup') },
              ]}
            />
            </FormField>
          )}
          {service.kind === 'group' && Boolean(futureEventsQ.data) && (
            <p data-f="F-16-170" className="text-sm text-muted">
              {t('serviceCard.futureEventsWarning', { count: futureEventsQ.data! })}
            </p>
          )}
          {service.kind === 'group' && packagesUsingThis.length > 0 && (
            <p data-f="F-16-124" className="rounded-lg bg-danger-soft px-3.5 py-2.5 text-sm text-danger">
              {t('serviceCard.packageBrokenWarning', { count: packagesUsingThis.length })}
            </p>
          )}
          {service.kind === 'group' && !hosted && (
            <FormField label={t('serviceCard.capacity')}>
              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" disabled={!canEditKind} onClick={() => saveCapacity(Math.max(1, capacity - 1))} aria-label={t('event.form.capacityMinus')}>
                  −
                </Button>
                <span className="w-8 text-center text-base font-semibold tabular-nums text-fg">{capacity}</span>
                <Button variant="outline" size="sm" disabled={!canEditKind} onClick={() => saveCapacity(capacity + 1)} aria-label={t('event.form.capacityPlus')}>
                  +
                </Button>
              </div>
            </FormField>
          )}
          {service.kind === 'group' && (
            <div data-f="F-16-031" className="flex flex-col gap-3 rounded-lg border border-border p-3.5">
              <p className="text-sm font-medium text-fg">{t('serviceCard.groupPayment.title')}</p>
              <p className="text-sm text-muted">{t('serviceCard.groupPayment.hint')}</p>
              <Switch
                checked={groupPaymentQ.data?.onlinePrepaymentEnabled ?? false}
                onCheckedChange={(v) => onGroupPaymentChange({ onlinePrepaymentEnabled: v })}
                disabled={!canEditKind || groupPaymentQ.isLoading}
                label={t('serviceCard.groupPayment.prepayment')}
                description={t('serviceCard.groupPayment.prepaymentHint')}
              />
              <Switch
                checked={groupPaymentQ.data?.membershipBookingEnabled ?? false}
                onCheckedChange={(v) => onGroupPaymentChange({ membershipBookingEnabled: v })}
                disabled={!canEditKind || groupPaymentQ.isLoading}
                label={t('serviceCard.groupPayment.membership')}
                description={t('serviceCard.groupPayment.membershipHint')}
              />
            </div>
          )}
        </div>
      )}

      {resourcesQ.isError ? (
        <ErrorState compact onRetry={resourcesQ.refetch} />
      ) : resourcesQ.isLoading ? (
        // Та же подсказка и тот же выбор ресурсов (неактивный), пока список читается
        <div className="flex flex-col gap-3" aria-busy>
          <p className="text-sm text-muted">{t('serviceCard.hint')}</p>
          <EntityMultiPicker
            options={[]}
            value={[]}
            onValueChange={() => {}}
            title={t('serviceCard.title')}
            placeholder={t('serviceCard.placeholder')}
            searchPlaceholder={t('form.servicesSearch')}
            emptyText={t('form.servicesEmpty')}
            disabled
          />
        </div>
      ) : (resourcesQ.data ?? []).length === 0 ? (
        <EmptyState
          compact
          icon={<Armchair aria-hidden />}
          title={t('serviceCard.emptyTitle')}
          description={t('serviceCard.emptyText')}
          action={
            <Link href="/biz/resources/new" className="text-sm font-medium text-primary-text hover:underline">
              {t('serviceCard.create')}
            </Link>
          }
        />
      ) : (
        <div data-f="F-16-006" className="flex flex-col gap-3">
          <p className="text-sm text-muted">{t('serviceCard.hint')}</p>
          <EntityMultiPicker
            options={options}
            value={pendingIds ?? linkedIds}
            onValueChange={onChange}
            title={t('serviceCard.title')}
            placeholder={t('serviceCard.placeholder')}
            searchPlaceholder={t('form.servicesSearch')}
            emptyText={t('form.servicesEmpty')}
            disabled={!canManage}
          />
        </div>
      )}
    </div>
  );
}
