'use client';

/**
 * /biz/resources/new — создание ресурса (F-16-003): название на активных языках, описание, вид, филиал (если их
 * несколько), привязанные услуги и сразу нужное число экземпляров (F-16-004) — всё одной кнопкой «Сохранить».
 * После сохранения — в список ресурсов (наше решение: не повторять баг Altegio «вернул на прошлую страницу»).
 */
import { useMemo, useState } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Save } from 'lucide-react';
import { coreList } from '@/api/core';
import { createResourceFull, type ResourceWithMeta } from '@/api/resources';
import { optimistic, useApiMutation, useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { pickText } from '@/lib/text';
import { Button } from '@/ui/Button';
import { PageHeader } from '@/ui/PageHeader';
import { StickyActionBar } from '@/ui/StickyActionBar';
import { useToast } from '@/ui/Toast';
import { useUnsavedGuard } from '@/ui/hooks/useUnsavedGuard';
import { ResourceFields } from '@/areas/resources/components/ResourceFields';
import { ResourceFormSkeleton } from '@/areas/resources/components/ResourceFormSkeleton';
import { hasErrors, newRowKey, renameDefaultInstances, toSaveInput, validateDraft, type ResourceDraft, type ResourceDraftErrors } from '@/areas/resources/lib/draft';

export function ResourceCreateScreen() {
  const t = useT('resources');
  const locale = useLocale();
  const router = useRouter();
  const toast = useToast();
  const { ready, businessId, locationId } = useCurrent();

  const servicesQ = useApiQuery(['resources', 'services-for-form', businessId], () => coreList('services', { businessId: businessId ?? '' }), {
    enabled: ready && Boolean(businessId),
  });
  const locationsQ = useApiQuery(['resources', 'locations', businessId], () => coreList('locations', { businessId: businessId ?? '' }), {
    enabled: ready && Boolean(businessId),
  });
  const locations = locationsQ.data ?? [];
  // Раньше при «Все филиалы» ресурс получал locationId = id бизнеса и потом не занимался ни одной записью
  const defaultLocationId = locations.some((l) => l.id === locationId) ? (locationId as string) : (locations[0]?.id ?? '');

  const [draftState, setDraft] = useState<ResourceDraft | null>(null);
  const draft: ResourceDraft = draftState ?? {
    name: { ru: '' },
    description: '',
    kind: 'chair',
    locationId: defaultLocationId,
    serviceIds: [],
    instances: [{ key: 'first', name: `${t('kind.chair')} 1` }],
  };
  const [errors, setErrors] = useState<ResourceDraftErrors>({});
  const [saved, setSaved] = useState(false);

  const dirty = !saved && draftState !== null;
  const { confirmLeave } = useUnsavedGuard(dirty);

  const serviceOptions = useMemo(
    () => (servicesQ.data ?? []).map((s) => ({ id: s.id, label: pickText(s.name, locale) })),
    [servicesQ.data, locale],
  );

  const validationTexts = {
    nameRequired: t('form.nameRequired'),
    instanceRequired: t('form.instanceNameRequired'),
    instanceDuplicate: t('form.instanceNameDuplicate'),
  };

  const create = useApiMutation((d: ResourceDraft) => createResourceFull(businessId ?? '', toSaveInput(d)), {
    // Новый ресурс сразу появляется в списке — без перезагрузки всего списка
    optimistic: optimistic<ResourceWithMeta[], ResourceDraft>(['resources', 'list', businessId], (list, d) => [
      ...list,
      {
        ...toSaveInput(d),
        id: `pending-${newRowKey()}`,
        businessId: businessId ?? '',
        instances: d.instances.map((r) => ({ id: r.key, name: r.name.trim() })),
        active: true,
      },
    ]),
  });

  const patch = (p: Partial<ResourceDraft>) => {
    let next = { ...draft, ...p };
    // Сменили вид — имена экземпляров по умолчанию («Кресло 2») идут следом, свои имена не трогаем
    if (p.kind && p.kind !== draft.kind) {
      next = { ...next, instances: renameDefaultInstances(next.instances, t(`kind.${draft.kind}` as 'kind.chair'), t(`kind.${p.kind}` as 'kind.chair')) };
    }
    setDraft(next);
    if (hasErrors(errors)) setErrors(validateDraft(next, validationTexts));
  };

  const submit = async () => {
    const found = validateDraft(draft, validationTexts);
    setErrors(found);
    if (hasErrors(found)) {
      toast.error(t('form.fixErrors'));
      return;
    }
    try {
      const created = await create.mutate(draft);
      setSaved(true);
      toast.success(t('form.created', { name: pickText(created.name, locale) }));
      router.push('/biz/resources');
    } catch {
      toast.error(t('form.saveFailed'));
    }
  };

  const cancel = async () => {
    if (await confirmLeave()) router.push('/biz/resources');
  };

  const loading = !ready || servicesQ.isLoading || locationsQ.isLoading;

  return (
    <div data-f="F-16-003" className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
      <PageHeader title={t('form.createTitle')} back={{ href: '/biz/resources' }} />

      {loading ? (
        <ResourceFormSkeleton />
      ) : (
        <ResourceFields draft={draft} onDraftChange={patch} errors={errors} serviceOptions={serviceOptions} locations={locations} />
      )}

      <StickyActionBar desktop="inline">
        <Button variant="ghost" onClick={cancel}>
          {t('form.cancel')}
        </Button>
        <Button leftIcon={<Save aria-hidden />} loading={create.isPending} disabled={loading} onClick={submit}>
          {t('form.save')}
        </Button>
      </StickyActionBar>
    </div>
  );
}
