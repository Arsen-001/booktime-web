'use client';

/**
 * /biz/stock/goods/new и /[goodId] — карточка товара. F-08-017…027, F-00-134, F-00-140, F-00-144.
 * Создание, правка, архив, удаление (со словом-подтверждением, F-08-144), сохранённые остатки по
 * складам и журнал изменений (⭐ F-00-040).
 */
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Copy, EllipsisVertical, Package, Printer } from 'lucide-react';
import {
  archiveGood,
  copyGoodToLocationsNetworked,
  createGood,
  deleteGood,
  getGood,
  listCategoriesFlat,
  listGoodHistory,
  listWarehouses,
  restoreGood,
  updateGood,
  type GoodInput,
  type StockLevel,
} from '@/api/stock';
import { ApiError, useApiMutation, useApiQuery } from '@/api/request';
import { coreList } from '@/api/core';
import { useCurrent, useDemo } from '@/demo/hooks';
import type { Id } from '@/domain/core';
import { newGoodDefaults, type Good } from '@/domain/stock';
import { useT } from '@/i18n/useT';
import { pickText } from '@/lib/text';
import { Badge } from '@/ui/Badge';
import { Checkbox } from '@/ui/Checkbox';
import { DropdownMenu } from '@/ui/DropdownMenu';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { IconButton } from '@/ui/IconButton';
import { Modal } from '@/ui/Modal';
import { PageHeader } from '@/ui/PageHeader';
import { Skeleton } from '@/ui/Skeleton';
import { StickyActionBar } from '@/ui/StickyActionBar';
import { Button } from '@/ui/Button';
import { useConfirm, useToast } from '@/ui/Toast';
import { useUnsavedGuard } from '@/ui/hooks/useUnsavedGuard';
import { useStockPermissions } from '@/areas/stock/useStockPermissions';
import { GoodFormFields } from '@/areas/stock/goods/GoodFormFields';
import { GoodSavedPanel } from '@/areas/stock/goods/GoodSavedPanel';
import { DeleteGoodModal } from '@/areas/stock/goods/DeleteGoodModal';

export function GoodFormScreen({ goodId }: { goodId?: Id }) {
  const t = useT('stock');
  const searchParams = useSearchParams();
  const { ready, businessId, locationId: rawLocationId, activeLocationIds, locationIds } = useCurrent();
  const locationId = rawLocationId === 'all' ? activeLocationIds[0] : rawLocationId;
  const isEdit = Boolean(goodId);
  const [deleted, setDeleted] = useState(false);

  const existingQ = useApiQuery(['stock', 'good', businessId, goodId], () => getGood(businessId!, goodId!), {
    enabled: ready && Boolean(businessId) && isEdit && !deleted,
  });
  const categoriesQ = useApiQuery(['stock', 'categoriesFlat', businessId, locationId], () => listCategoriesFlat(businessId!, locationId!), {
    enabled: ready && Boolean(businessId) && Boolean(locationId),
  });

  if (isEdit && existingQ.isError) return <ErrorState onRetry={existingQ.refetch} />;
  if (categoriesQ.isError) return <ErrorState onRetry={categoriesQ.refetch} />;
  if (!ready || (isEdit && existingQ.isLoading) || categoriesQ.isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
        <Skeleton variant="rect" className="h-10" />
        <Skeleton lines={10} />
      </div>
    );
  }
  if (isEdit && !existingQ.data) return <EmptyState icon={<Package aria-hidden />} title={t('goodForm.notFound')} />;

  const categories = categoriesQ.data ?? [];
  if (categories.length === 0) {
    return <EmptyState icon={<Package aria-hidden />} title={t('goodForm.noCategoriesTitle')} description={t('goodForm.noCategoriesText')} />;
  }

  return (
    <GoodFormBody
      key={goodId ?? 'new'}
      goodId={goodId}
      businessId={businessId!}
      locationId={locationId!}
      otherLocationIds={locationIds.filter((id) => id !== locationId)}
      initial={existingQ.data}
      categories={categories}
      defaultCategoryId={searchParams.get('category') ?? categories[0].id}
      onDeleted={() => setDeleted(true)}
    />
  );
}

function GoodFormBody({
  goodId,
  businessId,
  locationId,
  otherLocationIds,
  initial,
  categories,
  defaultCategoryId,
  onDeleted,
}: {
  goodId?: Id;
  businessId: Id;
  locationId: Id;
  otherLocationIds: Id[];
  initial?: Good & { levels: StockLevel[] };
  categories: { id: Id; name: string }[];
  defaultCategoryId: Id;
  onDeleted: () => void;
}) {
  const t = useT('stock');
  const { lang } = useDemo();
  const toast = useToast();
  const confirm = useConfirm();
  const router = useRouter();
  const isEdit = Boolean(goodId);
  // F-08-116/F-08-030: без права «Доступ к управлению товарами» нет ни архивации, ни удаления
  const perm = useStockPermissions();
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [copyTargets, setCopyTargets] = useState<Id[]>([]);
  const locationsQ = useApiQuery(['core', 'locations', businessId], () => coreList('locations', { businessId }), {
    enabled: copyModalOpen && otherLocationIds.length > 0,
  });
  const copyMutation = useApiMutation((targets: Id[]) => copyGoodToLocationsNetworked(businessId, goodId!, targets));
  // F-08-130: у сетевого товара в филиале-получателе меняются только цена/себестоимость/налог/пороги/комментарий
  const networkLocked = Boolean(initial?.networkGroupId && !initial.isNetworkSource);

  const defaults = newGoodDefaults();
  const [form, setForm] = useState<GoodInput>(() => ({
    name: initial?.name ?? '',
    receiptName: initial?.receiptName,
    categoryId: initial?.categoryId ?? defaultCategoryId,
    sku: initial?.sku,
    barcode: initial?.barcode,
    markingCode: initial?.markingCode,
    saleUnit: initial?.saleUnit ?? defaults.saleUnit,
    writeoffUnit: initial?.writeoffUnit ?? defaults.writeoffUnit,
    unitRatio: initial?.unitRatio ?? defaults.unitRatio,
    massNetG: initial?.massNetG,
    massGrossG: initial?.massGrossG,
    salePrice: initial?.salePrice ?? 0,
    costPrice: initial?.costPrice ?? 0,
    taxSystem: initial?.taxSystem ?? defaults.taxSystem,
    taxRate: initial?.taxRate ?? defaults.taxRate,
    criticalStock: initial?.criticalStock ?? defaults.criticalStock,
    desiredStock: initial?.desiredStock ?? defaults.desiredStock,
    brand: initial?.brand,
    shade: initial?.shade,
    shadeColorIndex: initial?.shadeColorIndex,
    expiryDate: initial?.expiryDate,
    purchaseDate: initial?.purchaseDate,
    shelfLifeAfterOpenDays: initial?.shelfLifeAfterOpenDays,
    showToClients: initial?.showToClients ?? defaults.showToClients,
    clientName: initial?.clientName,
    comment: initial?.comment,
  }));
  const [touched, setTouched] = useState(false);
  // Ск18: сравниваем с тем, что сохранено, — ушли с правками, спросим
  const [baseline, setBaseline] = useState(() => JSON.stringify(form));
  const [leaving, setLeaving] = useState(false);
  const dirty = !leaving && JSON.stringify(form) !== baseline;
  const { confirmLeave } = useUnsavedGuard(dirty);

  const createMutation = useApiMutation((input: GoodInput) => createGood(businessId, locationId, input));
  const updateMutation = useApiMutation((input: GoodInput) => updateGood(businessId, goodId!, input));
  const archiveMutation = useApiMutation(() => archiveGood(businessId, goodId!));
  const restoreMutation = useApiMutation(() => restoreGood(businessId, goodId!));
  const saving = createMutation.isPending || updateMutation.isPending;

  const warehousesQ = useApiQuery(['stock', 'warehouses', businessId, locationId], () => listWarehouses(businessId!, locationId!), {
    enabled: isEdit,
  });
  const historyQ = useApiQuery(['stock', 'goodHistory', businessId, goodId], () => listGoodHistory(businessId!, goodId!), { enabled: isEdit });

  const nameError = touched && !form.name.trim() ? t('goodForm.nameRequired') : undefined;

  const save = async () => {
    setTouched(true);
    if (!form.name.trim()) return;
    try {
      if (isEdit) {
        await updateMutation.mutate(form);
        setBaseline(JSON.stringify(form));
        toast.success(t('goodForm.saved'));
      } else {
        const created = await createMutation.mutate(form);
        setLeaving(true);
        toast.success(t('goodForm.created'));
        router.push(`/biz/stock/goods/${created.id}`);
        return;
      }
    } catch (e) {
      if (e instanceof ApiError && e.code === 'barcode_in_use') toast.error(t('goodForm.barcodeInUse'));
      else toast.error(t('goodForm.saveFailed'));
    }
  };

  const toggleArchive = async () => {
    try {
      if (initial?.archived) {
        await restoreMutation.mutate(undefined);
        toast.success(t('goodForm.restored'));
      } else {
        const ok = await confirm({
          title: t('goodForm.archiveConfirmTitle'),
          description: t('goodForm.archiveConfirmText'),
          confirmLabel: t('goodForm.archive'),
        });
        if (!ok) return;
        await archiveMutation.mutate(undefined);
        toast.success(t('goodForm.archived'));
      }
    } catch (e) {
      // F-08-028/F-08-144: понятная причина, если товар в чьей-то техкарте
      if (e instanceof ApiError && e.code === 'good_in_use') toast.error(t('goodForm.archiveFailedInUse'));
      else toast.error(t('goodForm.archiveFailed'));
    }
  };

  const confirmDelete = async () => {
    if (!goodId) return;
    try {
      await deleteGood(businessId, goodId);
      setLeaving(true);
      onDeleted();
      toast.success(t('goodForm.deleted'));
      router.push('/biz/stock');
    } catch (e) {
      // F-08-030/F-08-144: товар в техкарте не удаляется насовсем — только архивируется
      if (e instanceof ApiError && e.code === 'good_in_use') toast.error(t('goodForm.deleteFailedInUse'));
      else toast.error(t('goodForm.deleteFailed'));
    }
  };

  const copyToLocations = async () => {
    if (!copyTargets.length) return;
    try {
      await copyMutation.mutate(copyTargets);
      toast.success(t('goodForm.copied', { count: copyTargets.length }));
      setCopyModalOpen(false);
      setCopyTargets([]);
    } catch {
      toast.error(t('goodForm.copyFailed'));
    }
  };

  return (
    <div
      data-f="F-08-017 F-08-018 F-08-019 F-08-020 F-08-021 F-08-022 F-08-023 F-08-024 F-08-025 F-08-026 F-08-027 F-08-028 F-08-090 F-08-091 F-08-095 F-08-130 F-08-135 F-08-147 F-00-134 F-00-140 F-00-143 F-00-144 F-13-208"
      className="mx-auto flex w-full max-w-[760px] flex-col gap-6 pb-24"
    >
      <PageHeader title={isEdit ? form.name || t('goodForm.editTitle') : t('goodForm.title')} back={{ href: '/biz/stock' }} />

      {networkLocked && (
        <div className="flex items-start gap-2 rounded-xl border border-border bg-surface-2 p-3 text-sm text-muted">
          <Badge tone="accent" size="sm">
            {t('goodForm.networkBadge')}
          </Badge>
          <span>{t('goodForm.networkHint')}</span>
        </div>
      )}

      <GoodFormFields form={form} setForm={setForm} categories={categories} nameError={nameError} />

      {isEdit && (
        <GoodSavedPanel
          levels={initial?.levels ?? []}
          warehouses={warehousesQ.data ?? []}
          history={historyQ.data ?? []}
          goodId={goodId!}
          businessId={businessId}
          locationId={locationId}
          shade={form.shade}
          archived={Boolean(initial?.archived)}
          saleUnit={initial?.saleUnit ?? form.saleUnit}
        />
      )}

      <StickyActionBar>
        {isEdit && (
          <DropdownMenu
            trigger={(props) => <IconButton {...props} icon={<EllipsisVertical aria-hidden />} variant="outline" label={t('goodForm.moreActions')} />}
            items={[
              {
                id: 'priceTag',
                label: t('goodForm.priceTagPdf'),
                icon: <Printer aria-hidden />,
                onSelect: () => router.push(`/biz/stock/goods/${goodId}/price-tag`),
              },
              ...(otherLocationIds.length > 0 && perm.manageGoods
                ? [{ id: 'copy', label: t('goodForm.copyToLocations'), icon: <Copy aria-hidden />, onSelect: () => setCopyModalOpen(true) }]
                : []),
              // F-08-116/F-08-030: архивация и удаление — только с правом «Доступ к управлению товарами»
              ...(perm.manageGoods
                ? ([
                    { id: 'sep', separator: true },
                    { id: 'archive', label: initial?.archived ? t('goodForm.restore') : t('goodForm.archive'), onSelect: toggleArchive },
                    { id: 'sep2', separator: true },
                    { id: 'delete', label: t('goodForm.delete'), danger: true, onSelect: () => setDeleteModalOpen(true) },
                  ] as const)
                : []),
            ]}
          />
        )}
        <Button
          variant="secondary"
          disabled={saving || (isEdit && !dirty)}
          onClick={async () => {
            if (!(await confirmLeave())) return;
            if (isEdit) {
              setForm(JSON.parse(baseline) as GoodInput);
              setTouched(false);
            } else {
              setLeaving(true);
              router.push('/biz/stock');
            }
          }}
        >
          {t('goodForm.cancel')}
        </Button>
        <Button onClick={save} loading={saving} disabled={!perm.manageGoods}>
          {t('goodForm.save')}
        </Button>
      </StickyActionBar>

      <DeleteGoodModal open={deleteModalOpen} onOpenChange={setDeleteModalOpen} goodName={form.name} onConfirm={confirmDelete} />

      <Modal
        open={copyModalOpen}
        onOpenChange={setCopyModalOpen}
        title={t('goodForm.copyToLocations')}
        description={t('goodForm.copyToLocationsHint')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCopyModalOpen(false)}>
              {t('goodForm.cancel')}
            </Button>
            <Button onClick={copyToLocations} loading={copyMutation.isPending} disabled={!copyTargets.length}>
              {t('goodForm.copySubmit')}
            </Button>
          </>
        }
      >
        {locationsQ.isLoading ? null : (locationsQ.data ?? []).length === 0 ? (
          <p className="text-sm text-muted">{t('goodForm.copyNoLocations')}</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {(locationsQ.data ?? [])
              .filter((l) => otherLocationIds.includes(l.id))
              .map((l) => (
                <li key={l.id}>
                  <Checkbox
                    checked={copyTargets.includes(l.id)}
                    onCheckedChange={(on) => setCopyTargets((prev) => (on ? [...prev, l.id] : prev.filter((x) => x !== l.id)))}
                    label={pickText(l.name, lang)}
                    className="w-full rounded-lg px-2 py-2.5 hover:bg-surface-2"
                  />
                </li>
              ))}
          </ul>
        )}
      </Modal>
    </div>
  );
}
