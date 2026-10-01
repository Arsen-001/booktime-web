'use client';

/**
 * «Приложение» → услуги (F-14-114, F-14-115). Демо-симуляция раздела «Services» мобильного приложения
 * для бизнеса: категории (создать/переименовать/удалить), услуги внутри них («от–до» цена, длительность,
 * онлайн-запись, описание), пакеты услуг 4hands+ из 2–10 услуг.
 */
import { useMemo, useState } from 'react';
import { ChevronRight, Package, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react';
import {
  createAppService,
  createAppServiceCategory,
  createAppServicePackage,
  deleteAppService,
  deleteAppServiceCategory,
  listAppServiceCategories,
  listAppServices,
  renameAppServiceCategory,
  updateAppService,
} from '@/api/client';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useCan, useCurrent } from '@/demo/hooks';
import type { Id, Service, ServiceCategory } from '@/domain/core';
import { useClientFormat } from '@/areas/client/useClientFormat';
import { useT } from '@/i18n/useT';
import { pickText } from '@/lib/text';
import { useLocale } from 'next-intl';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { Modal } from '@/ui/Modal';
import { MoneyInput } from '@/ui/MoneyInput';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';
import { Skeleton } from '@/ui/Skeleton';
import { Switch } from '@/ui/Switch';
import { Textarea } from '@/ui/Textarea';
import { useToast } from '@/ui/Toast';
import { ExitHold } from '@/ui/ExitHold';

export function ServicesAppScreen() {
  const t = useT('client');
  const toast = useToast();
  const locale = useLocale() as 'ru' | 'hy' | 'en';
  const { ready, businessId, sphere } = useCurrent();
  // Как «Услуги» в вебе (A8): смотреть — services.view (закрыто на уровне страницы), менять — services.edit
  const canEdit = useCan('services.edit');
  const [addCategoryOpen, setAddCategoryOpen] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [renameCat, setRenameCat] = useState<ServiceCategory | undefined>(undefined);
  const [deleteCat, setDeleteCat] = useState<ServiceCategory | undefined>(undefined);
  const [addServiceCategoryId, setAddServiceCategoryId] = useState<Id | undefined>(undefined);
  const [packageCategoryId, setPackageCategoryId] = useState<Id | undefined>(undefined);
  const [editService, setEditService] = useState<Service | undefined>(undefined);
  const [deleteService, setDeleteService] = useState<Service | undefined>(undefined);

  const cats = useApiQuery(['app-service-categories', businessId], () => listAppServiceCategories(businessId!), {
    enabled: ready && Boolean(businessId),
  });
  const services = useApiQuery(['app-services', businessId], () => listAppServices(businessId!), {
    enabled: ready && Boolean(businessId),
  });

  const createCat = useApiMutation(({ businessId, name }: { businessId: Id; name: string }) => createAppServiceCategory(businessId, name));
  const renameCatMut = useApiMutation(({ id, name }: { id: Id; name: string }) => renameAppServiceCategory(id, name));
  const removeCat = useApiMutation(deleteAppServiceCategory);
  const removeService = useApiMutation(deleteAppService);

  const refetchAll = () => {
    void cats.refetch();
    void services.refetch();
  };

  const byCategory = useMemo(() => {
    const map = new Map<Id, Service[]>();
    for (const s of services.data ?? []) {
      const list = map.get(s.categoryId) ?? [];
      list.push(s);
      map.set(s.categoryId, list);
    }
    return map;
  }, [services.data]);

  const loading = !ready || cats.isLoading || services.isLoading;

  return (
    <div data-f="F-14-114 F-14-115" className="flex flex-col gap-6">
      <PageHeader
        title={t('apps.services.title')}
        description={t('apps.services.subtitle')}
        actions={
          canEdit ? (
            <Button size="sm" leftIcon={<Plus aria-hidden />} onClick={() => setAddCategoryOpen(true)}>
              {t('apps.services.addCategoryCta')}
            </Button>
          ) : undefined
        }
      />

      {loading ? (
        <Skeleton lines={4} />
      ) : cats.isError || services.isError ? (
        <ErrorState onRetry={() => refetchAll()} />
      ) : !cats.data?.length ? (
        <EmptyState
          icon={<Sparkles aria-hidden className="size-8 text-muted" />}
          title={t('apps.services.emptyCategories')}
          action={canEdit ? <Button onClick={() => setAddCategoryOpen(true)}>{t('apps.services.addCategoryCta')}</Button> : undefined}
        />
      ) : (
        <div className="flex flex-col gap-4">
          {cats.data.map((category) => {
            const list = byCategory.get(category.id) ?? [];
            return (
              <SectionCard
                key={category.id}
                title={pickText(category.name, locale)}
                actions={
                  canEdit && (
                  <div className="flex gap-1">
                    <button
                      type="button"
                      aria-label={t('apps.services.renameCategoryCta')}
                      className="flex size-11 items-center justify-center rounded-full text-muted hover:bg-surface-2"
                      onClick={() => setRenameCat(category)}
                    >
                      <Pencil aria-hidden className="size-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={t('apps.services.deleteCategoryCta')}
                      className="flex size-11 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-danger"
                      onClick={() => setDeleteCat(category)}
                    >
                      <Trash2 aria-hidden className="size-4" />
                    </button>
                  </div>
                  )
                }
              >
                <div className="flex flex-col gap-2">
                  {list.length === 0 ? (
                    <p className="text-sm text-muted">{t('apps.services.noServicesInCategory')}</p>
                  ) : (
                    list.map((service) => (
                      <ServiceRow
                        key={service.id}
                        service={service}
                        locale={locale}
                        onClick={canEdit ? () => setEditService(service) : undefined}
                        onDelete={canEdit ? () => setDeleteService(service) : undefined}
                      />
                    ))
                  )}
                  {canEdit && (
                  <div className="mt-1 flex flex-wrap gap-2">
                    <Button variant="secondary" size="sm" leftIcon={<Plus aria-hidden />} onClick={() => setAddServiceCategoryId(category.id)}>
                      {t('apps.services.addServiceCta')}
                    </Button>
                    <Button variant="ghost" size="sm" leftIcon={<Package aria-hidden />} onClick={() => setPackageCategoryId(category.id)}>
                      {t('apps.services.createPackageCta')}
                    </Button>
                  </div>
                  )}
                </div>
              </SectionCard>
            );
          })}
        </div>
      )}

      <Modal open={addCategoryOpen} onOpenChange={setAddCategoryOpen} title={t('apps.services.addCategoryCta')} size="sm">
        <div className="flex flex-col gap-3">
          <FormField label={t('apps.services.categoryNameLabel')}>
            <Input value={categoryName} onChange={(e) => setCategoryName(e.target.value)} />
          </FormField>
          <Button
            loading={createCat.isPending}
            disabled={!categoryName.trim() || !businessId}
            onClick={() =>
              businessId &&
              void createCat
                .mutate({ businessId, name: categoryName })
                .then(() => {
                  toast.success(t('apps.services.categoryCreated'));
                  setCategoryName('');
                  setAddCategoryOpen(false);
                  refetchAll();
                })
                .catch(() => toast.error(t('apps.services.actionFailed')))
            }
          >
            {t('apps.services.createCategoryCta')}
          </Button>
        </div>
      </Modal>

      <ExitHold value={renameCat}>
        {(renameCat) => (
        <Modal open onOpenChange={() => setRenameCat(undefined)} title={t('apps.services.renameCategoryCta')} size="sm">
          <RenameCategoryForm
            category={renameCat}
            locale={locale}
            saving={renameCatMut.isPending}
            onSave={(name) =>
              void renameCatMut
                .mutate({ id: renameCat.id, name })
                .then(() => {
                  toast.success(t('apps.services.categoryCreated'));
                  setRenameCat(undefined);
                  refetchAll();
                })
                .catch(() => toast.error(t('apps.services.actionFailed')))
            }
          />
        </Modal>
        )}
      </ExitHold>

      <ConfirmDialog
        open={Boolean(deleteCat)}
        onOpenChange={(v) => !v && setDeleteCat(undefined)}
        tone="danger"
        title={deleteCat ? t('apps.services.deleteCategoryConfirmTitle', { name: pickText(deleteCat.name, locale) }) : ''}
        description={t('apps.services.deleteCategoryConfirmHint')}
        confirmLabel={t('apps.services.deleteCategoryCta')}
        onConfirm={async () => {
          if (!deleteCat) return;
          await removeCat.mutate(deleteCat.id);
          toast.success(t('apps.services.categoryDeleted'));
          setDeleteCat(undefined);
          refetchAll();
        }}
      />

      {/* Держим то, что открыто (услуга или категория новой), пока окно уходит — заголовок не меняется на уходе */}
      <ExitHold value={businessId ? (editService ?? addServiceCategoryId) : undefined}>
        {(target) => (
          <ServiceFormModal
            businessId={businessId!}
            sphere={sphere}
            categoryId={typeof target === 'string' ? target : target.categoryId}
            service={typeof target === 'string' ? undefined : target}
            onClose={() => {
              setAddServiceCategoryId(undefined);
              setEditService(undefined);
            }}
            onSaved={refetchAll}
          />
        )}
      </ExitHold>

      <ExitHold value={businessId && packageCategoryId}>
        {(packageCategoryId) => (
        <PackageFormModal
          businessId={businessId!}
          sphere={sphere}
          categoryId={packageCategoryId}
          services={services.data ?? []}
          locale={locale}
          onClose={() => setPackageCategoryId(undefined)}
          onSaved={refetchAll}
        />
        )}
      </ExitHold>

      <ConfirmDialog
        open={Boolean(deleteService)}
        onOpenChange={(v) => !v && setDeleteService(undefined)}
        tone="danger"
        title={deleteService ? t('apps.services.deleteServiceConfirmTitle', { name: pickText(deleteService.name, locale) }) : ''}
        description={t('apps.services.deleteServiceConfirmHint')}
        confirmLabel={t('apps.services.deleteServiceCta')}
        onConfirm={async () => {
          if (!deleteService) return;
          await removeService.mutate(deleteService.id);
          toast.success(t('apps.services.serviceDeleted'));
          setDeleteService(undefined);
          refetchAll();
        }}
      />
    </div>
  );
}

function ServiceRow({
  service,
  locale,
  onClick,
  onDelete,
}: {
  service: Service;
  locale: 'ru' | 'hy' | 'en';
  /** Нет права services.edit — строка только для чтения */
  onClick?: () => void;
  onDelete?: () => void;
}) {
  const t = useT('client');
  const fmt = useClientFormat();
  const priceLabel = service.priceMax && service.priceMax !== service.priceMin ? `${fmt.money(service.priceMin)}–${fmt.money(service.priceMax)}` : fmt.money(service.priceMin);
  return (
    <Card interactive={Boolean(onClick)} padding="sm" className="flex items-center gap-3" onClick={onClick}>
      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 items-start gap-1.5 font-medium text-fg">
          <span className="min-w-0 line-clamp-2 break-words">{pickText(service.name, locale)}</span>
          {service.servicePackage && (
            <Badge tone="info" variant="soft" className="mt-0.5 shrink-0">
              {t('apps.services.packageBadge')}
            </Badge>
          )}
        </p>
        <p className="truncate text-sm text-muted">
          {priceLabel} · {t('apps.team.durationMin', { count: service.durationMin })}
        </p>
      </div>
      {!service.active && (
        <Badge tone="neutral" variant="soft">
          {t('apps.services.activeLabel')}: —
        </Badge>
      )}
      {onDelete && (
        <button
          type="button"
          aria-label={t('apps.services.deleteServiceCta')}
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-danger"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 aria-hidden className="size-4" />
        </button>
      )}
      {onClick && <ChevronRight aria-hidden className="size-4 shrink-0 text-muted" />}
    </Card>
  );
}

function RenameCategoryForm({
  category,
  locale,
  saving,
  onSave,
}: {
  category: ServiceCategory;
  locale: 'ru' | 'hy' | 'en';
  saving: boolean;
  onSave: (name: string) => void;
}) {
  const t = useT('client');
  const [name, setName] = useState(pickText(category.name, locale));
  return (
    <div className="flex flex-col gap-3">
      <FormField label={t('apps.services.categoryNameLabel')}>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </FormField>
      <Button loading={saving} disabled={!name.trim()} onClick={() => onSave(name)}>
        {t('apps.services.createCategoryCta')}
      </Button>
    </div>
  );
}

function ServiceFormModal({
  businessId,
  sphere,
  categoryId,
  service,
  onClose,
  onSaved,
}: {
  businessId: Id;
  sphere: string;
  categoryId: Id;
  service?: Service;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT('client');
  const toast = useToast();
  const [name, setName] = useState(service ? pickText(service.name, 'ru') : '');
  const [description, setDescription] = useState(service?.description ? pickText(service.description, 'ru') : '');
  const [priceMin, setPriceMin] = useState(service?.priceMin ?? 0);
  const [priceMax, setPriceMax] = useState(service?.priceMax ?? 0);
  const [durationMin, setDurationMin] = useState(service?.durationMin ?? 60);
  const [onlineBookable, setOnlineBookable] = useState(service?.onlineBookable ?? true);
  const [active, setActive] = useState(service?.active ?? true);

  const create = useApiMutation(createAppService);
  const update = useApiMutation(({ id, patch }: { id: Id; patch: Parameters<typeof updateAppService>[1] }) => updateAppService(id, patch));

  const valid = name.trim().length > 0 && priceMin > 0 && durationMin > 0;

  const submit = async () => {
    if (!valid) {
      toast.error(t('apps.services.validation'));
      return;
    }
    try {
      if (service) {
        await update.mutate({
          id: service.id,
          patch: { name, description, priceMin, priceMax: priceMax || undefined, durationMin, onlineBookable, active },
        });
        toast.success(t('apps.services.serviceUpdated'));
      } else {
        await create.mutate({
          businessId,
          categoryId,
          sphereId: sphere as Parameters<typeof createAppService>[0]['sphereId'],
          name,
          description,
          priceMin,
          priceMax: priceMax || undefined,
          durationMin,
          onlineBookable,
        });
        toast.success(t('apps.services.serviceCreated'));
      }
      onSaved();
      onClose();
    } catch {
      toast.error(t('apps.services.actionFailed'));
    }
  };

  return (
    <Modal open onOpenChange={onClose} title={service ? pickText(service.name, 'ru') : t('apps.services.addServiceCta')} size="md">
      <div className="flex flex-col gap-3">
        <FormField label={t('apps.services.serviceNameLabel')}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('apps.services.serviceNamePlaceholder')} />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label={t('apps.services.priceFromLabel')}>
            <MoneyInput value={priceMin} onValueChange={(v) => setPriceMin(v ?? 0)} />
          </FormField>
          <FormField label={t('apps.services.priceToLabel')} hint={t('apps.services.priceToHint')}>
            <MoneyInput value={priceMax || undefined} onValueChange={(v) => setPriceMax(v ?? 0)} />
          </FormField>
        </div>
        <FormField label={t('apps.services.durationLabel')}>
          <Input type="number" min={5} value={durationMin} onChange={(e) => setDurationMin(Number(e.target.value) || 0)} />
        </FormField>
        <FormField label={t('apps.services.descriptionLabel')}>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </FormField>
        <Switch
          labelPosition="start"
          label={t('apps.services.onlineBookableLabel')}
          description={t('apps.services.onlineBookableHint')}
          checked={onlineBookable}
          onCheckedChange={setOnlineBookable}
        />
        {service && (
          <Switch labelPosition="start" label={t('apps.services.activeLabel')} checked={active} onCheckedChange={setActive} />
        )}
        <Button loading={create.isPending || update.isPending} disabled={!valid} onClick={() => void submit()}>
          {service ? t('apps.services.serviceUpdated') : t('apps.services.createServiceCta')}
        </Button>
      </div>
    </Modal>
  );
}

function PackageFormModal({
  businessId,
  sphere,
  categoryId,
  services,
  locale,
  onClose,
  onSaved,
}: {
  businessId: Id;
  sphere: string;
  categoryId: Id;
  services: Service[];
  locale: 'ru' | 'hy' | 'en';
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT('client');
  const toast = useToast();
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<Id[]>([]);
  const [mode, setMode] = useState<'parallel' | 'sequentialSame' | 'sequentialAny'>('sequentialSame');

  const create = useApiMutation(createAppServicePackage);
  const candidates = services.filter((s) => !s.servicePackage);
  const valid = name.trim().length > 0 && selected.length >= 2 && selected.length <= 10;

  const toggle = (id: Id) => setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <Modal open onOpenChange={onClose} title={t('apps.services.packageTitle')} size="md">
      <div className="flex flex-col gap-3">
        <FormField label={t('apps.services.packageNameLabel')}>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </FormField>
        <FormField label={t('apps.services.packageServicesLabel')} hint={t('apps.services.packageServicesHint')}>
          {candidates.length === 0 ? (
            <p className="text-sm text-muted">{t('apps.services.noServicesInCategory')}</p>
          ) : (
            <div className="flex flex-col gap-1">
              {candidates.map((s) => (
                <label key={s.id} className="flex min-h-9 items-center gap-2 rounded-lg px-2 py-1 hover:bg-surface-2">
                  <input
                    type="checkbox"
                    checked={selected.includes(s.id)}
                    onChange={() => toggle(s.id)}
                    className="size-4 accent-primary"
                  />
                  <span className="text-sm text-fg">{pickText(s.name, locale)}</span>
                </label>
              ))}
            </div>
          )}
        </FormField>
        <FormField label={t('apps.services.packageModeLabel')}>
          <div className="flex flex-col gap-1">
            {(['sequentialSame', 'sequentialAny', 'parallel'] as const).map((m) => (
              <label key={m} className="flex min-h-9 items-center gap-2">
                <input type="radio" name="pkg-mode" checked={mode === m} onChange={() => setMode(m)} className="size-4 accent-primary" />
                <span className="text-sm text-fg">{t(`apps.services.packageMode.${m}`)}</span>
              </label>
            ))}
          </div>
        </FormField>
        <Button
          loading={create.isPending}
          disabled={!valid}
          onClick={() => {
            if (!valid) {
              toast.error(t('apps.services.packageValidation'));
              return;
            }
            void create
              .mutate({ businessId, categoryId, sphereId: sphere as Parameters<typeof createAppServicePackage>[0]['sphereId'], name, itemServiceIds: selected, mode })
              .then(() => {
                toast.success(t('apps.services.packageCreated'));
                onSaved();
                onClose();
              })
              .catch(() => toast.error(t('apps.services.actionFailed')));
          }}
        >
          {t('apps.services.createPackageSubmitCta')}
        </Button>
      </div>
    </Modal>
  );
}
