'use client';

/**
 * /biz/resources/[resourceId] — карточка ресурса: правка полей, услуг и экземпляров одной кнопкой «Сохранить»
 * (F-16-004, F-16-005, F-16-007), архив и возврат из архива, удаление навсегда (только из архива), занятость по
 * дням (F-16-019). Раздел «resources».
 */
import { useMemo, useState } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Archive, ArchiveRestore, Save, Trash2 } from 'lucide-react';
import { coreList } from '@/api/core';
import {
  countFutureUsageByInstance,
  deleteResource,
  getResource,
  restoreResource,
  saveResourceFull,
  setResourceActive,
  useCountFutureUsage,
  type ResourceWithMeta,
} from '@/api/resources';
import { patchInList, removeFromList, useApiMutation, useApiQuery } from '@/api/request';
import { useCan, useCurrent } from '@/demo/hooks';
import type { Resource } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { pickText } from '@/lib/text';
import { Button } from '@/ui/Button';
import { ErrorState } from '@/ui/ErrorState';
import { PageHeader } from '@/ui/PageHeader';
import { Skeleton } from '@/ui/Skeleton';
import { StickyActionBar } from '@/ui/StickyActionBar';
import { useConfirm, useToast } from '@/ui/Toast';
import { useUnsavedGuard } from '@/ui/hooks/useUnsavedGuard';
import { ResourceDayLoad } from '@/areas/resources/components/ResourceDayLoad';
import { ResourceFields } from '@/areas/resources/components/ResourceFields';
import { ResourceFormSkeleton } from '@/areas/resources/components/ResourceFormSkeleton';
import {
  draftFromResource,
  draftsEqual,
  hasErrors,
  renameDefaultInstances,
  toSaveInput,
  validateDraft,
  type ResourceDraft,
  type ResourceDraftErrors,
} from '@/areas/resources/lib/draft';

export interface ResourceDetailScreenProps {
  resourceId: string;
}

export function ResourceDetailScreen({ resourceId }: ResourceDetailScreenProps) {
  const t = useT('resources');
  const locale = useLocale();
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const { ready, businessId } = useCurrent();
  const canManage = useCan('resources.manage');

  const resourceQ = useApiQuery(['resources', 'detail', resourceId], () => getResource(resourceId), { enabled: ready });
  const servicesQ = useApiQuery(['resources', 'services-for-form', businessId], () => coreList('services', { businessId: businessId ?? '' }), {
    enabled: ready && Boolean(businessId),
  });
  const locationsQ = useApiQuery(['resources', 'locations', businessId], () => coreList('locations', { businessId: businessId ?? '' }), {
    enabled: ready && Boolean(businessId),
  });
  const futureUsageQ = useCountFutureUsage(resourceId, { enabled: ready });
  const futureByInstanceQ = useApiQuery(['resources', 'futureByInstance', resourceId], () => countFutureUsageByInstance(resourceId), { enabled: ready });

  const data = resourceQ.data;
  const base = useMemo(() => (data ? draftFromResource(data) : null), [data]);

  // Черновик заводится из данных один раз на ресурс — правкой состояния во время рендера, без лишнего кадра
  const [draft, setDraft] = useState<ResourceDraft | null>(null);
  const [syncedFor, setSyncedFor] = useState<string | null>(null);
  if (base && syncedFor !== resourceId) {
    setDraft(base);
    setSyncedFor(resourceId);
  }
  // Сохранённое, пока «сервер» не вернул его в запрос: иначе кнопка «Сохранить» на долю секунды снова загоралась
  const [savedSnapshot, setSavedSnapshot] = useState<ResourceDraft | null>(null);
  if (savedSnapshot && base && draftsEqual(base, savedSnapshot)) setSavedSnapshot(null);
  const reference = savedSnapshot ?? base;

  const [errors, setErrors] = useState<ResourceDraftErrors>({});
  const dirty = Boolean(canManage && draft && reference && !draftsEqual(draft, reference));
  const { confirmLeave } = useUnsavedGuard(dirty);

  const listKey = ['resources', 'list', businessId] as const;
  const save = useApiMutation((d: ResourceDraft) => saveResourceFull(resourceId, toSaveInput(d)), {
    optimistic: patchInList(listKey, (d: ResourceDraft) => {
      const input = toSaveInput(d);
      return { id: resourceId, patch: { ...input, instances: d.instances.map((r) => ({ id: r.id ?? r.key, name: r.name.trim() })) } };
    }),
  });
  const setActive = useApiMutation((active: boolean) => setResourceActive(resourceId, active), {
    // Префикс ['resources'] — и список, и сама карточка сразу видят новый статус
    optimistic: patchInList(['resources'], (active: boolean) => ({ id: resourceId, patch: { active } })),
  });
  const remove = useApiMutation((id: string) => deleteResource(id), { optimistic: removeFromList(listKey, (id: string) => id) });
  const restore = useApiMutation((r: { resource: Resource; description: string }) => restoreResource(r.resource, r.description));

  const serviceOptions = useMemo(() => (servicesQ.data ?? []).map((s) => ({ id: s.id, label: pickText(s.name, locale) })), [servicesQ.data, locale]);

  const validationTexts = {
    nameRequired: t('form.nameRequired'),
    instanceRequired: t('form.instanceNameRequired'),
    instanceDuplicate: t('form.instanceNameDuplicate'),
  };

  const patch = (p: Partial<ResourceDraft>) => {
    if (!draft) return;
    let next = { ...draft, ...p };
    if (p.kind && p.kind !== draft.kind) {
      next = { ...next, instances: renameDefaultInstances(next.instances, t(`kind.${draft.kind}` as 'kind.chair'), t(`kind.${p.kind}` as 'kind.chair')) };
    }
    setDraft(next);
    if (hasErrors(errors)) setErrors(validateDraft(next, validationTexts));
  };

  const submit = async () => {
    if (!draft || !reference) return;
    const found = validateDraft(draft, validationTexts);
    setErrors(found);
    if (hasErrors(found)) {
      toast.error(t('form.fixErrors'));
      return;
    }
    // Убираемые экземпляры с будущими записями — спросить (раньше корзина удаляла сразу и молча)
    const kept = new Set(draft.instances.map((r) => r.id).filter(Boolean));
    const removed = reference.instances.filter((r) => r.id && !kept.has(r.id));
    const removedFuture = removed.reduce((n, r) => n + (futureByInstanceQ.data?.[r.id!] ?? 0), 0);
    if (removedFuture > 0) {
      const ok = await confirm({
        title: t('detail.removeInstancesTitle', { count: removed.length }),
        description: t('detail.removeInstancesText', { count: removedFuture }),
        confirmLabel: t('detail.removeInstancesConfirm'),
        cancelLabel: t('form.cancel'),
        tone: 'danger',
      });
      if (!ok) return;
    }
    try {
      const saved = await save.mutate(draft);
      const next = draftFromResource(saved);
      setSavedSnapshot(next);
      setDraft(next);
      toast.success(t('form.updated'));
    } catch {
      toast.error(t('form.saveFailed'));
    }
  };

  const resetDraft = () => {
    if (reference) setDraft(reference);
    setErrors({});
  };

  const nameOf = (r: Pick<ResourceWithMeta, 'name'>) => pickText(r.name, locale);

  const doArchive = async () => {
    if (!data) return;
    const ok = await confirm({
      title: t('detail.archiveConfirmTitle', { name: nameOf(data) }),
      description: t('detail.archiveConfirmText'),
      confirmLabel: t('detail.archiveConfirm'),
      cancelLabel: t('form.cancel'),
    });
    if (!ok || !(await confirmLeave())) return;
    try {
      await setActive.mutate(false);
      router.push('/biz/resources');
      toast.success(t('detail.archivedToast', { name: nameOf(data) }), {
        action: { label: t('detail.undo'), onClick: () => void setResourceActive(resourceId, true).catch(() => toast.error(t('form.saveFailed'))) },
        durationMs: 5000,
      });
    } catch {
      toast.error(t('form.saveFailed'));
    }
  };

  const doRestore = async () => {
    if (!data) return;
    try {
      await setActive.mutate(true);
      toast.success(t('detail.restoredToast', { name: nameOf(data) }));
    } catch {
      toast.error(t('form.saveFailed'));
    }
  };

  const doDelete = async () => {
    if (!data) return;
    const ok = await confirm({
      title: t('detail.deleteConfirmTitle', { name: nameOf(data) }),
      description: t('detail.deleteConfirmText'),
      confirmLabel: t('detail.deleteForever'),
      cancelLabel: t('form.cancel'),
      tone: 'danger',
    });
    if (!ok) return;
    const { description, ...core } = data;
    try {
      router.push('/biz/resources');
      await remove.mutate(data.id);
      toast.success(t('detail.deleted', { name: nameOf(data) }), {
        action: { label: t('detail.undo'), onClick: () => void restore.mutate({ resource: core, description }).catch(() => toast.error(t('form.saveFailed'))) },
        durationMs: 5000,
      });
    } catch {
      toast.error(t('form.saveFailed'));
    }
  };

  if (resourceQ.isError) {
    return (
      <div className="mx-auto w-full max-w-[760px]">
        <PageHeader title={t('detail.loading')} back={{ href: '/biz/resources' }} />
        <ErrorState onRetry={resourceQ.refetch} />
      </div>
    );
  }

  const loading = !data || !draft || servicesQ.isLoading || locationsQ.isLoading;
  const archived = data ? !data.active : false;

  return (
    <div data-f="F-16-004 F-16-005 F-16-007 F-00-149" className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
      <PageHeader
        title={reference ? pickText(reference.name, locale) : <Skeleton className="h-8 w-56" />}
        back={{ href: '/biz/resources' }}
        actions={
          canManage && data ? (
            archived ? (
              <Button variant="ghost" className="text-danger" leftIcon={<Trash2 aria-hidden />} onClick={doDelete} loading={remove.isPending}>
                {t('detail.deleteForever')}
              </Button>
            ) : (
              <Button variant="ghost" leftIcon={<Archive aria-hidden />} onClick={doArchive} loading={setActive.isPending}>
                {t('detail.archive')}
              </Button>
            )
          ) : undefined
        }
      />

      {archived && (
        <div className="flex flex-col gap-3 rounded-lg bg-surface-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-fg">{t('detail.archivedBanner')}</p>
          {canManage && (
            <Button size="sm" variant="outline" leftIcon={<ArchiveRestore aria-hidden />} onClick={doRestore} loading={setActive.isPending} className="shrink-0">
              {t('detail.restore')}
            </Button>
          )}
        </div>
      )}

      {archived && (futureUsageQ.data ?? 0) > 0 && (
        <p className="rounded-lg bg-warning-soft px-3.5 py-2.5 text-sm text-warning">{t('detail.futureUsageWarning', { count: futureUsageQ.data ?? 0 })}</p>
      )}

      {loading ? (
        <ResourceFormSkeleton instances={data?.instances.length ?? 1} />
      ) : (
        <ResourceFields
          draft={draft}
          onDraftChange={patch}
          errors={errors}
          serviceOptions={serviceOptions}
          locations={locationsQ.data ?? []}
          futureByInstance={futureByInstanceQ.data}
          disabled={!canManage}
        />
      )}

      {data && <ResourceDayLoad resourceId={resourceId} instanceCount={data.instances.length} />}

      {canManage && (
        <StickyActionBar desktop="inline">
          <Button variant="ghost" onClick={resetDraft} disabled={!dirty || save.isPending}>
            {t('form.cancel')}
          </Button>
          <Button leftIcon={<Save aria-hidden />} loading={save.isPending} disabled={!dirty} onClick={submit}>
            {t('form.save')}
          </Button>
        </StickyActionBar>
      )}
    </div>
  );
}
