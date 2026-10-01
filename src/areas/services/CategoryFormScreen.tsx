'use client';

/**
 * /biz/services/categories/new и /biz/services/categories/[categoryId] — категория услуг (У27): заголовок — её имя,
 * название на hy/ru/en (У18), своё название для онлайн-записи (F-03-131), услуги внутри списком с «+ Добавить
 * услугу». Сохранение — общая липкая полоса с несохранённым (У3, У17). Удаление — вместе с услугами, «Отменить» 5 с.
 */
import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { ChevronRight, Plus, Trash2 } from 'lucide-react';
import {
  createCategory,
  deleteCategoryWithServices,
  getCategory,
  getCategoryOnlineName,
  listServiceRows,
  restoreCategory,
  updateCategory,
  type CategoryInput,
} from '@/api/services';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useCan, useCurrent } from '@/demo/hooks';
import type { LocalizedText } from '@/domain/core';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { formatMoneyRange } from '@/lib/money';
import { pickText } from '@/lib/text';
import { FormSaveBar } from '@/areas/services/components/FormSaveBar';
import { focusField } from '@/areas/services/components/focusField';
import { hasName, LocalizedTextField, normalizeName } from '@/areas/services/components/LocalizedTextField';
import { Button, LinkButton } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';
import { Skeleton } from '@/ui/Skeleton';
import { Switch } from '@/ui/Switch';
import { useConfirm, useToast } from '@/ui/Toast';
import { useUnsavedGuard } from '@/ui/hooks/useUnsavedGuard';

const EMPTY: LocalizedText = { ru: '' };

interface CategoryDraft {
  name: LocalizedText;
  onlineEnabled: boolean;
  onlineName: LocalizedText;
}

export function CategoryFormScreen() {
  const t = useT('services');
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const format = useFormat();
  const locale = useLocale() as 'ru' | 'en';
  const { ready, businessId } = useCurrent();
  const canEdit = useCan('services.edit');
  const params = useParams<{ categoryId?: string }>();
  const isNew = !params.categoryId || params.categoryId === 'new';
  const categoryId = isNew ? undefined : params.categoryId;
  const enabled = ready && Boolean(businessId);

  const detailQ = useApiQuery(['services', 'category', categoryId], () => getCategory(categoryId ?? ''), {
    enabled: enabled && Boolean(categoryId),
  });
  const onlineNameQ = useApiQuery(['services', 'categoryOnlineName', categoryId], () => getCategoryOnlineName(categoryId ?? ''), {
    enabled: enabled && Boolean(categoryId),
  });
  const rowsQ = useApiQuery(['services', 'rows', businessId], () => listServiceRows(businessId ?? ''), {
    enabled: enabled && Boolean(categoryId),
  });

  const [draft, setDraft] = useState<CategoryDraft>({
    name: EMPTY,
    onlineEnabled: false,
    onlineName: EMPTY,
  });
  const [initial, setInitial] = useState<CategoryDraft | null>(null);
  const [nameError, setNameError] = useState<string | undefined>();
  if (!initial) {
    if (isNew && ready) setInitial(draft);
    else if (detailQ.data && onlineNameQ.data) {
      const d = {
        name: detailQ.data.name,
        onlineEnabled: onlineNameQ.data.onlineNameEnabled,
        onlineName: onlineNameQ.data.onlineName ?? EMPTY,
      };
      setDraft(d);
      setInitial(d);
    }
  }
  const dirty = initial !== null && JSON.stringify(initial) !== JSON.stringify(draft);
  const { confirmLeave } = useUnsavedGuard(dirty);

  const saveM = useApiMutation((input: CategoryInput) =>
    isNew ? createCategory(businessId ?? '', input) : updateCategory(categoryId ?? '', businessId ?? '', input),
  );

  if (detailQ.isError) return <ErrorState onRetry={detailQ.refetch} />;
  const loading = !initial;
  const services = (rowsQ.data ?? []).filter((r) => r.service.categoryId === categoryId);

  const save = async () => {
    if (!hasName(draft.name)) {
      setNameError(t('categoryForm.nameRequired'));
      focusField('cat-f-name');
      return;
    }
    try {
      await saveM.mutate({
        name: normalizeName(draft.name),
        onlineNameEnabled: draft.onlineEnabled,
        onlineName: draft.onlineEnabled && hasName(draft.onlineName) ? normalizeName(draft.onlineName) : undefined,
      });
      setInitial(draft);
      toast.success(isNew ? t('categoryForm.created') : t('categoryForm.saved'));
      router.push('/biz/services');
    } catch {
      toast.error(t('categoryForm.saveFailed'));
    }
  };

  const doDelete = async () => {
    if (!categoryId) return;
    const ok = await confirm({
      title: t('categoryForm.deleteTitle', {
        name: pickText(draft.name, locale),
      }),
      description: services.length ? t('categoryForm.deleteWithServices', { count: services.length }) : t('categoryForm.deleteNoImpact'),
      tone: 'danger',
      confirmLabel: t('delete.confirm'),
    });
    if (!ok) return;
    try {
      const snapshot = await deleteCategoryWithServices(categoryId, businessId ?? '');
      setInitial(draft);
      toast.success(t('categoryForm.deleted'), {
        action: {
          label: t('delete.undo'),
          onClick: () => void restoreCategory(snapshot),
        },
        durationMs: 5000,
      });
      router.push('/biz/services');
    } catch {
      toast.error(t('categoryForm.deleteFailed'));
    }
  };

  const title = isNew ? t('categoryForm.newTitle') : pickText(detailQ.data?.name, locale) || t('categoryForm.editTitle');

  return (
    <div data-f="F-03-131" className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
      <PageHeader
        title={title}
        description={isNew ? undefined : t('categoryForm.servicesCount', { count: services.length })}
        back={{ href: '/biz/services', label: t('title') }}
        actions={
          !isNew && canEdit && !loading ? (
            <Button variant="ghost" leftIcon={<Trash2 aria-hidden />} onClick={() => void doDelete()}>
              {t('categoryForm.delete')}
            </Button>
          ) : undefined
        }
      />
      {loading ? (
        <Skeleton lines={4} />
      ) : (
        <>
          <SectionCard title={t('categoryForm.mainTitle')}>
            <div data-f="F-03-115" className="flex flex-col gap-4">
              <LocalizedTextField
                id="cat-f-name"
                label={t('form.nameLabel')}
                required
                value={draft.name}
                onValueChange={(name) => {
                  setDraft((d) => ({ ...d, name }));
                  setNameError(undefined);
                }}
                error={nameError}
                disabled={!canEdit}
              />
              <Switch
                checked={draft.onlineEnabled}
                onCheckedChange={(onlineEnabled) => setDraft((d) => ({ ...d, onlineEnabled }))}
                label={t('categoryForm.onlineNameToggle')}
                description={t('categoryForm.onlineNameHint')}
                disabled={!canEdit}
              />
              {draft.onlineEnabled && (
                <LocalizedTextField
                  label={t('categoryForm.onlineNameLabel')}
                  value={draft.onlineName}
                  onValueChange={(onlineName) => setDraft((d) => ({ ...d, onlineName }))}
                  disabled={!canEdit}
                />
              )}
            </div>
          </SectionCard>

          {!isNew && (
            <SectionCard
              title={t('categoryForm.servicesTitle')}
              actions={
                canEdit ? (
                  <LinkButton
                    size="sm"
                    variant="secondary"
                    href={`/biz/services/new?categoryId=${categoryId}`}
                    leftIcon={<Plus aria-hidden />}
                  >
                    {t('list.addService')}
                  </LinkButton>
                ) : undefined
              }
            >
              {rowsQ.isLoading ? (
                <Skeleton lines={3} />
              ) : services.length === 0 ? (
                <EmptyState compact variant="section" title={t('empty.categoryEmpty')} />
              ) : (
                <ul className="flex flex-col divide-y divide-border">
                  {services.map(({ service: s }) => (
                    <li key={s.id}>
                      <Link
                        href={`/biz/services/${s.id}`}
                        className="flex min-h-12 items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-surface-2"
                      >
                        <span className="min-w-0 flex-1 truncate font-medium text-fg">{pickText(s.name, locale)}</span>
                        <span className="shrink-0 text-sm text-muted">{format.durationRange(s.durationMin, s.durationMax)}</span>
                        <span className="shrink-0 text-sm font-semibold text-fg tabular-nums">
                          {formatMoneyRange(s.priceMin, s.priceMax)}
                        </span>
                        <ChevronRight aria-hidden className="size-4 shrink-0 text-muted" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          )}

          <FormSaveBar
            dirty={dirty}
            saving={saveM.isPending}
            isNew={isNew}
            canEdit={canEdit}
            onSave={() => void save()}
            onCancel={() => void confirmLeave().then((ok) => ok && router.push('/biz/services'))}
          />
        </>
      )}
    </div>
  );
}
