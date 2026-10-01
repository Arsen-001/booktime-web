'use client';

/**
 * /biz/stock/settings/access — F-08-109: владелец назначает мелкие права на склад (F-08-109…118) каждому
 * сотруднику. По ТЗ галочки рисует staff («F-10-079»), но пара расширения staffCard/stock ещё не заведена
 * в фундаменте (src/extensions/pairs.ts) — просьба уже в qa/requests/stock.md; пока экран живёт в своих
 * путях (Товары → Настройки → «Права сотрудников»), чтобы владелец мог реально назначить права уже сейчас.
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { History, ShieldCheck, Users } from 'lucide-react';
import { listStaffRows } from '@/api/staff';
import {
  applyStockRoleTemplate,
  copyStockPermissions,
  getStockPermissions,
  listPermissionHistory,
  listWarehouses,
  setStockPermissions,
  type StockRoleTemplateId,
} from '@/api/stock';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import { emptyStaffFilters } from '@/domain/staff';
import type { Id } from '@/domain/core';
import { defaultStockPermissions, STOCK_ROLE_TEMPLATE_IDS, type MovementHistoryDepth, type StockStaffPermissions } from '@/domain/stock';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { Checkbox } from '@/ui/Checkbox';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { FilterBar } from '@/ui/FilterBar';
import { FormField } from '@/ui/FormField';
import { Modal } from '@/ui/Modal';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';
import { Select } from '@/ui/Select';
import { Skeleton } from '@/ui/Skeleton';
import { Switch } from '@/ui/Switch';
import { Table, type TableColumn } from '@/ui/Table';
import { useToast } from '@/ui/Toast';
import { ExitHold } from '@/ui/ExitHold';

export function StockStaffPermissionsScreen() {
  const t = useT('stock');
  const router = useRouter();
  const { ready, businessId } = useCurrent();
  const enabled = ready && Boolean(businessId);
  const [search, setSearch] = useState('');
  const [editingStaffId, setEditingStaffId] = useState<Id | undefined>();

  const staffQ = useApiQuery(
    ['staff', 'rows', businessId, 'stockAccess'],
    () => listStaffRows({ businessId: businessId!, filters: { ...emptyStaffFilters(), status: 'all' } }),
    { enabled },
  );

  if (staffQ.isError) return <ErrorState onRetry={staffQ.refetch} />;

  const rows = staffQ.data ?? [];
  const filtered = search.trim() ? rows.filter((r) => r.staff.name.toLowerCase().includes(search.trim().toLowerCase())) : rows;

  const columns: TableColumn<(typeof rows)[number]>[] = [
    { id: 'name', header: t('staffAccess.columns.name'), mobile: 'title', cell: (r) => r.staff.name },
    { id: 'role', header: t('staffAccess.columns.role'), mobile: 'subtitle', cell: (r) => t(`staffAccess.role.${r.staff.role}`) },
    {
      id: 'action',
      header: '',
      mobile: 'aside',
      align: 'right',
      cell: (r) => (
        <Button variant="secondary" size="sm" onClick={(e) => { e.stopPropagation(); setEditingStaffId(r.staff.id); }}>
          {t('staffAccess.configure')}
        </Button>
      ),
    },
  ];

  return (
    <div data-f="F-08-109 F-08-110 F-08-111 F-08-112 F-08-113 F-08-114" className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
      <PageHeader
        title={t('staffAccess.title')}
        description={t('staffAccess.subtitle')}
        actions={<Button variant="secondary" onClick={() => router.push('/biz/stock/settings')}>{t('staffAccess.back')}</Button>}
      />

      {staffQ.isLoading ? (
        <Skeleton lines={5} />
      ) : rows.length === 0 ? (
        <EmptyState icon={<Users aria-hidden />} title={t('staffAccess.emptyTitle')} description={t('staffAccess.emptyText')} />
      ) : (
        <div className="flex flex-col gap-4">
          <FilterBar search={{ value: search, onValueChange: setSearch, placeholder: t('staffAccess.searchPlaceholder') }} />
          {/* Без onRowClick: у строки уже есть своя кнопка «Настроить» — Table на телефоне рисует
              кликабельную строку как <button>, а кнопка внутри неё была бы вложенным <button> (HTML
              этого не допускает, до починки консоль ловила именно эту ошибку на каждом заходе). */}
          <Table
            columns={columns}
            rows={filtered}
            rowKey={(r) => r.staff.id}
            label={t('staffAccess.title')}
            empty={<EmptyState kind="search" icon={<ShieldCheck aria-hidden />} title={t('staffAccess.notFoundTitle')} description={t('staffAccess.notFoundText')} />}
          />
        </div>
      )}

      <ExitHold value={businessId && editingStaffId}>
        {(editingStaffId) => (
        <StaffPermissionsModal
          businessId={businessId!}
          staffId={editingStaffId}
          staffName={rows.find((r) => r.staff.id === editingStaffId)?.staff.name ?? ''}
          colleagues={rows.filter((r) => r.staff.id !== editingStaffId).map((r) => ({ id: r.staff.id, name: r.staff.name }))}
          open={Boolean(editingStaffId)}
          onOpenChange={(o) => { if (!o) setEditingStaffId(undefined); }}
        />
        )}
      </ExitHold>
    </div>
  );
}

function StaffPermissionsModal({
  businessId,
  staffId,
  staffName,
  colleagues,
  open,
  onOpenChange,
}: {
  businessId: Id;
  staffId: Id;
  staffName: string;
  colleagues: { id: Id; name: string }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT('stock');
  const toast = useToast();
  const { locationId: rawLocationId, activeLocationIds } = useCurrent();
  const locationId = rawLocationId === 'all' ? activeLocationIds[0] : rawLocationId;

  const permQ = useApiQuery(['stock', 'permissions', businessId, staffId, 'edit'], () => getStockPermissions(businessId, staffId), { enabled: open });
  const warehousesQ = useApiQuery(['stock', 'warehouses', businessId, locationId, 'edit'], () => listWarehouses(businessId, locationId!), { enabled: open && Boolean(locationId) });
  const historyQ = useApiQuery(['stock', 'permissions', 'history', businessId, staffId], () => listPermissionHistory(businessId, staffId), { enabled: open });
  const saveMutation = useApiMutation((patch: StockStaffPermissions) => setStockPermissions(businessId, staffId, patch));
  const templateMutation = useApiMutation((templateId: StockRoleTemplateId) =>
    applyStockRoleTemplate(businessId, staffId, templateId, t(`staffAccess.form.roleTemplate.${templateId}`)),
  );
  const copyMutation = useApiMutation((fromStaffId: Id) => copyStockPermissions(businessId, fromStaffId, staffId));

  const [draft, setDraft] = useState<StockStaffPermissions | undefined>();
  const [copyFromId, setCopyFromId] = useState<Id | undefined>();
  const [historyOpen, setHistoryOpen] = useState(false);
  const perm = draft ?? permQ.data ?? defaultStockPermissions({ edit: false, view: true });
  const warehouses = warehousesQ.data ?? [];

  const patch = (p: Partial<StockStaffPermissions>) => setDraft({ ...perm, ...p });

  const save = async () => {
    try {
      await saveMutation.mutate(perm);
      toast.success(t('staffAccess.form.saved'));
      onOpenChange(false);
      setDraft(undefined);
    } catch {
      toast.error(t('staffAccess.form.saveFailed'));
    }
  };

  const applyTemplate = async (templateId: string) => {
    try {
      const next = await templateMutation.mutate(templateId as StockRoleTemplateId);
      setDraft(next);
      toast.success(t('staffAccess.form.roleTemplateApplied'));
    } catch {
      toast.error(t('staffAccess.form.saveFailed'));
    }
  };

  const applyCopy = async () => {
    if (!copyFromId) return;
    try {
      const next = await copyMutation.mutate(copyFromId);
      setDraft(next);
      toast.success(t('staffAccess.form.copiedApplied'));
    } catch {
      toast.error(t('staffAccess.form.saveFailed'));
    }
  };

  const historyOptions: { value: string; label: string }[] = [
    { value: '7', label: t('staffAccess.form.history7') },
    { value: '30', label: t('staffAccess.form.history30') },
    { value: '90', label: t('staffAccess.form.history90') },
    { value: '180', label: t('staffAccess.form.history180') },
    { value: 'all', label: t('staffAccess.form.historyAll') },
    { value: 'none', label: t('staffAccess.form.historyNone') },
  ];

  const warehouseAccessAll = perm.warehouseAccess === 'all';
  const selectedWarehouseIds = warehouseAccessAll ? [] : perm.warehouseAccess;

  return (
    <Modal
      open={open}
      onOpenChange={(o) => { onOpenChange(o); if (!o) setDraft(undefined); }}
      title={t('staffAccess.form.title', { name: staffName })}
      footer={
        <>
          <Button variant="secondary" onClick={() => setHistoryOpen(true)} leftIcon={<History aria-hidden />}>
            {t('staffAccess.form.historyButton')}
          </Button>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>{t('staffAccess.form.cancel')}</Button>
          <Button onClick={save} loading={saveMutation.isPending}>{t('staffAccess.form.save')}</Button>
        </>
      }
    >
      {permQ.isLoading ? (
        <Skeleton lines={8} />
      ) : (
        <div data-f="F-08-149" className="flex flex-col gap-5">
          <SectionCard title={t('staffAccess.form.roleTemplate.title')} description={t('staffAccess.form.roleTemplate.hint')}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <FormField label={t('staffAccess.form.roleTemplate.label')} className="flex-available">
                <Select
                  placeholder={t('staffAccess.form.roleTemplate.placeholder')}
                  onValueChange={applyTemplate}
                  options={STOCK_ROLE_TEMPLATE_IDS.map((id) => ({ value: id, label: t(`staffAccess.form.roleTemplate.${id}`) }))}
                />
              </FormField>
              {templateMutation.isPending && <span className="text-sm text-muted">{t('staffAccess.form.roleTemplate.applying')}</span>}
            </div>
            {colleagues.length > 0 && (
              <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-end">
                <FormField label={t('staffAccess.form.copyFrom.label')} className="flex-available">
                  <Select
                    value={copyFromId}
                    placeholder={t('staffAccess.form.copyFrom.placeholder')}
                    onValueChange={(v) => setCopyFromId(v as Id)}
                    options={colleagues.map((c) => ({ value: c.id, label: c.name }))}
                  />
                </FormField>
                <Button variant="secondary" disabled={!copyFromId} loading={copyMutation.isPending} onClick={applyCopy}>
                  {t('staffAccess.form.copyFrom.apply')}
                </Button>
              </div>
            )}
          </SectionCard>

          <SectionCard title={t('staffAccess.form.warehouseAccessTitle')}>
            <Switch
              checked={warehouseAccessAll}
              onCheckedChange={(checked) => patch({ warehouseAccess: checked ? 'all' : warehouses.map((w) => w.id) })}
              label={warehouseAccessAll ? t('staffAccess.form.warehouseAccessAll') : t('staffAccess.form.warehouseAccessSelected')}
              labelPosition="start"
            />
            {!warehouseAccessAll && (
              warehouses.length === 0 ? (
                <p className="mt-2 text-sm text-muted">{t('staffAccess.form.noWarehouses')}</p>
              ) : (
                <div className="mt-3 flex flex-col gap-2">
                  {warehouses.map((w) => (
                    <Checkbox
                      key={w.id}
                      checked={selectedWarehouseIds.includes(w.id)}
                      onCheckedChange={(checked) => {
                        const set = new Set(selectedWarehouseIds);
                        if (checked) set.add(w.id);
                        else set.delete(w.id);
                        patch({ warehouseAccess: Array.from(set) });
                      }}
                      label={w.name}
                    />
                  ))}
                </div>
              )
            )}
          </SectionCard>

          <SectionCard title={t('staffAccess.form.movementHistoryTitle')} description={t('staffAccess.form.movementHistoryHint')}>
            <FormField label={t('staffAccess.form.movementHistoryDays')}>
              <Select
                value={String(perm.movementHistoryDays)}
                onValueChange={(v) => patch({ movementHistoryDays: (v === 'all' || v === 'none' ? v : Number(v)) as MovementHistoryDepth })}
                options={historyOptions}
              />
            </FormField>
            <Checkbox checked={perm.viewCost} onCheckedChange={(checked) => patch({ viewCost: checked })} label={t('staffAccess.form.viewCost')} className="mt-3" />
          </SectionCard>

          <SectionCard title={t('staffAccess.form.opsTitle')}>
            <div className="flex flex-col gap-2">
              <Checkbox checked={perm.canCreateOps} onCheckedChange={(checked) => patch({ canCreateOps: checked })} label={t('staffAccess.form.canCreateOps')} />
              <Checkbox checked={perm.canEditOps} onCheckedChange={(checked) => patch({ canEditOps: checked })} label={t('staffAccess.form.canEditOps')} />
              <Checkbox checked={perm.canDeleteOps} onCheckedChange={(checked) => patch({ canDeleteOps: checked })} label={t('staffAccess.form.canDeleteOps')} />
              <Checkbox checked={perm.canMoveOps} onCheckedChange={(checked) => patch({ canMoveOps: checked })} label={t('staffAccess.form.canMoveOps')} />
              <Checkbox checked={perm.excelExport} onCheckedChange={(checked) => patch({ excelExport: checked })} label={t('staffAccess.form.excelExport')} />
            </div>
          </SectionCard>

          <SectionCard title={t('staffAccess.form.inventoryTitle')}>
            <div className="flex flex-col gap-2">
              <Checkbox checked={perm.inventoryView} onCheckedChange={(checked) => patch({ inventoryView: checked })} label={t('staffAccess.form.inventoryView')} />
              <Checkbox checked={perm.inventoryCreate} onCheckedChange={(checked) => patch({ inventoryCreate: checked })} label={t('staffAccess.form.inventoryCreate')} />
              <Checkbox checked={perm.inventoryEdit} onCheckedChange={(checked) => patch({ inventoryEdit: checked })} label={t('staffAccess.form.inventoryEdit')} />
              <Checkbox checked={perm.inventoryDelete} onCheckedChange={(checked) => patch({ inventoryDelete: checked })} label={t('staffAccess.form.inventoryDelete')} />
            </div>
          </SectionCard>

          <SectionCard title={t('staffAccess.form.goodsTitle')}>
            <Checkbox checked={perm.manageGoods} onCheckedChange={(checked) => patch({ manageGoods: checked })} label={t('staffAccess.form.manageGoods')} />
          </SectionCard>

          <SectionCard title={t('staffAccess.form.otherTitle')}>
            <div className="flex flex-col gap-2">
              <Checkbox checked={perm.bookingWindowEdit} onCheckedChange={(checked) => patch({ bookingWindowEdit: checked })} label={t('staffAccess.form.bookingWindowEdit')} />
              <Checkbox checked={perm.techCardEdit} onCheckedChange={(checked) => patch({ techCardEdit: checked })} label={t('staffAccess.form.techCardEdit')} />
            </div>
          </SectionCard>
        </div>
      )}

      <Modal open={historyOpen} onOpenChange={setHistoryOpen} title={t('staffAccess.form.historyTitle', { name: staffName })}>
        {historyQ.isLoading ? (
          <Skeleton lines={4} />
        ) : !historyQ.data?.length ? (
          <EmptyState icon={<History aria-hidden />} title={t('staffAccess.form.historyEmptyTitle')} description={t('staffAccess.form.historyEmptyText')} />
        ) : (
          <ul className="flex flex-col gap-3">
            {historyQ.data.map((h) => (
              <li key={h.id} className="border-b border-border pb-3 last:border-none last:pb-0">
                <p className="text-sm text-fg">{h.summary}</p>
                <p className="mt-1 text-xs text-muted">{h.staffName} · {h.at.slice(0, 16).replace('T', ' ')}</p>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </Modal>
  );
}
