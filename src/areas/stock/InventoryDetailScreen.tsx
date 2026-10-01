'use client';

/**
 * /biz/stock/inventory/[inventoryId] — F-08-082…089: таблица расчёт/факт, взвешивание вскрытых упаковок,
 * автосписание/приход по «Провести», цвета строк, поиск + Enter=+1, «Обнулить»/«Рассчитать», сохранение,
 * правка, удаление, выгрузка в Excel.
 */
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Camera, ClipboardX, ListChecks, Search } from 'lucide-react';
import {
  calculateInventoryActual,
  deleteInventory,
  exportInventoryCsv,
  finalizeInventory,
  getInventory,
  incrementInventoryActual,
  resetInventoryActual,
  setInventoryActual,
  type InventoryLineRow,
} from '@/api/stock';
import { useApiQuery } from '@/api/request';
import { IconButton } from '@/ui/IconButton';
import { CameraScanner } from '@/areas/stock/CameraScanner';
import { formatQty, parseQty, useUnitShort } from '@/areas/stock/warehouse.utils';
import { useCurrent } from '@/demo/hooks';
import type { Id } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { useFormat } from '@/i18n/useFormat';
import { downloadCsv } from '@/lib/csv';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { cn } from '@/lib/cn';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { Input } from '@/ui/Input';
import { PageHeader } from '@/ui/PageHeader';
import { usePagedList } from '@/ui/Pagination';
import { Skeleton } from '@/ui/Skeleton';
import { StatCard } from '@/ui/StatCard';
import { StickyActionBar } from '@/ui/StickyActionBar';
import { useToast } from '@/ui/Toast';

export function InventoryDetailScreen({ inventoryId }: { inventoryId: Id }) {
  const t = useT('stock');
  const toast = useToast();
  const router = useRouter();
  const format = useFormat();
  const { ready, businessId } = useCurrent();
  const [deleted, setDeleted] = useState(false);
  const [search, setSearch] = useState('');
  const [editedIds, setEditedIds] = useState<Set<Id>>(new Set());
  const [resetOpen, setResetOpen] = useState(false);
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const [scannerOpen, setScannerOpen] = useState(false);

  const q = useApiQuery(['stock', 'inventory', businessId, inventoryId], () => getInventory(businessId!, inventoryId), { enabled: ready && Boolean(businessId) && !deleted });

  // Постранично, как во всех списках (DESIGN.md → Long lists); факт сохраняется построчно, итоги — по всей ведомости
  const { pageItems: linesPage, pager } = usePagedList(q.data?.lineRows ?? []);

  if (q.isError) return <ErrorState onRetry={q.refetch} />;
  if (!ready || q.isLoading) {
    return (
      <div className="flex w-full flex-col gap-6">
        <Skeleton variant="rect" className="h-10" />
        <Skeleton lines={8} />
      </div>
    );
  }
  const inv = q.data;
  if (!inv) return <EmptyState icon={<ClipboardX aria-hidden />} title={t('inventoryDetail.notFound')} />;
  const editable = inv.status === 'draft';

  // Ск12: ищем и по штрихкоду — сканер «печатает» код в поле и жмёт Enter
  const query = search.trim().toLowerCase();
  const matches = query
    ? inv.lineRows.filter((l) => l.goodName.toLowerCase().includes(query) || l.sku?.toLowerCase().includes(query) || l.barcode === search.trim())
    : [];

  const setActual = async (goodId: Id, qty: number | undefined): Promise<boolean> => {
    setEditedIds((prev) => new Set(prev).add(goodId));
    try {
      await setInventoryActual(businessId!, inventoryId, goodId, qty);
      return true;
    } catch {
      toast.error(t('inventoryDetail.actionFailed'));
      return false;
    }
  };

  const incrementGood = async (goodId: Id) => {
    setEditedIds((prev) => new Set(prev).add(goodId));
    try {
      await incrementInventoryActual(businessId!, inventoryId, goodId);
    } catch {
      toast.error(t('inventoryDetail.actionFailed'));
    }
  };

  const onScan = (code: string) => {
    setScannerOpen(false);
    const line = inv.lineRows.find((l) => l.barcode === code);
    if (!line) {
      toast.info(t('goodPicker.scanNotFound'));
      return;
    }
    void incrementGood(line.goodId);
    toast.success(t('goodPicker.scanPlusOne', { name: line.goodName }));
  };

  const enterAdd = async () => {
    const byBarcode = inv.lineRows.find((l) => l.barcode && l.barcode === search.trim());
    if (!byBarcode && matches.length !== 1) return;
    const goodId = (byBarcode ?? matches[0]).goodId;
    setEditedIds((prev) => new Set(prev).add(goodId));
    try {
      await incrementInventoryActual(businessId!, inventoryId, goodId);
      setSearch('');
    } catch {
      toast.error(t('inventoryDetail.actionFailed'));
    }
  };

  const rowTone = (l: InventoryLineRow): 'white' | 'blue' | 'green' | 'red' => {
    const touched = l.actualQty !== undefined;
    if (touched && l.diff !== 0) return 'red';
    if (editedIds.has(l.goodId)) return 'green';
    if (editedIds.size > 0 && touched) return 'blue';
    return 'white';
  };

  const ROW_CLASS: Record<ReturnType<typeof rowTone>, string> = {
    white: 'bg-surface',
    blue: 'bg-info-soft',
    green: 'bg-success-soft',
    red: 'bg-danger-soft',
  };

  const confirmReset = async () => {
    try {
      await resetInventoryActual(businessId!, inventoryId);
      setEditedIds(new Set(inv.lineRows.map((l) => l.goodId)));
      toast.success(t('inventoryDetail.resetDone'));
    } catch {
      toast.error(t('inventoryDetail.actionFailed'));
    }
  };

  const calculate = async () => {
    try {
      await calculateInventoryActual(businessId!, inventoryId);
      toast.success(t('inventoryDetail.calculateDone'));
    } catch {
      toast.error(t('inventoryDetail.actionFailed'));
    }
  };

  const confirmFinalize = async () => {
    try {
      await finalizeInventory(businessId!, inventoryId);
      toast.success(t('inventoryDetail.finalized'));
    } catch {
      toast.error(t('inventoryDetail.actionFailed'));
    }
  };

  const confirmDelete = async () => {
    try {
      await deleteInventory(businessId!, inventoryId);
      setDeleted(true);
      toast.success(t('inventoryDetail.deleted'));
      router.push('/biz/stock/inventory');
    } catch {
      toast.error(t('inventoryDetail.actionFailed'));
    }
  };

  const exportExcel = async () => {
    const csv = await exportInventoryCsv(businessId!, inventoryId);
    downloadCsv(`inventory-${inv.number}.csv`, csv);
  };

  const totalDiff = inv.lineRows.reduce((s, l) => s + l.diff, 0);

  return (
    <div data-f="F-08-082 F-08-083 F-08-084 F-08-085 F-08-086 F-08-087 F-08-088 F-08-089" className="flex w-full flex-col gap-6 pb-28">
      <PageHeader
        title={t('inventoryDetail.title', { number: inv.number })}
        description={`${inv.warehouseName}${inv.categoryName ? ` · ${inv.categoryName}` : ''}`}
        back={{ href: '/biz/stock/inventory' }}
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={inv.status === 'done' ? 'success' : 'neutral'}>{inv.status === 'done' ? t('inventory.statusDone') : t('inventory.statusDraft')}</Badge>
            <Button variant="secondary" size="sm" onClick={exportExcel}>
              {t('inventoryDetail.exportExcel')}
            </Button>
          </div>
        }
      />

      {/* F-08-084/086: заголовок-число — сколько позиций и сколько уже разошлось с расчётом */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label={t('inventoryDetail.stats.lines')} value={format.number(inv.lineRows.length)} icon={<ListChecks aria-hidden />} />
        <StatCard
          label={t('inventoryDetail.stats.mismatched')}
          value={format.number(inv.lineRows.filter((l) => l.diff !== 0).length)}
          icon={<AlertTriangle aria-hidden />}
        />
      </div>

      {editable && (
        <div className="flex items-start gap-2">
        <div className="relative min-w-0 flex-1">
          <Input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void enterAdd();
            }}
            placeholder={t('inventoryDetail.searchPlaceholder')}
            leftIcon={<Search aria-hidden className="size-4" />}
          />
          {search.trim() && matches.length > 0 && (
            <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-border bg-surface shadow-lg">
              {matches.map((l) => (
                <li key={l.goodId}>
                  <button
                    type="button"
                    className="flex w-full min-h-11 items-center justify-between px-3 py-2 text-left text-sm hover:bg-surface-2"
                    onClick={() => {
                      setSearch(l.goodName);
                      requestAnimationFrame(() => searchRef.current?.focus());
                    }}
                  >
                    <span>{l.goodName}</span>
                    <span className="text-xs text-muted">{t('inventoryDetail.enterToAdd')}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <IconButton icon={<Camera aria-hidden />} label={t('goodPicker.scan')} variant="outline" onClick={() => setScannerOpen(true)} />
        </div>
      )}

      {editable && (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => setResetOpen(true)}>
            {t('inventoryDetail.reset')}
          </Button>
          <Button variant="secondary" size="sm" onClick={calculate}>
            {t('inventoryDetail.calculate')}
          </Button>
        </div>
      )}

      {inv.lineRows.length === 0 ? (
        <EmptyState title={t('inventoryDetail.emptyTitle')} description={t('inventoryDetail.emptyText')} />
      ) : (
        <div className="flex flex-col gap-4">
          <ul className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            {linesPage.map((l) => (
              <InventoryLineCard
                key={l.goodId}
                line={l}
                editable={editable}
                toneClass={ROW_CLASS[rowTone(l)]}
                onOpenGood={() => router.push(`/biz/stock/goods/${l.goodId}`)}
                onCommit={(qty) => setActual(l.goodId, qty)}
              />
            ))}
          </ul>
          {pager}
        </div>
      )}

      {inv.lineRows.length > 0 && (
        <div className="flex items-center justify-between border-t border-border pt-3 text-sm text-muted">
          <span>{t('inventoryDetail.totalDiff')}</span>
          <span className={totalDiff === 0 ? 'text-fg' : totalDiff < 0 ? 'text-danger' : 'text-success'}>{totalDiff > 0 ? `+${formatQty(totalDiff)}` : formatQty(totalDiff)}</span>
        </div>
      )}

      {inv.comment && <p className="text-sm text-muted">{inv.comment}</p>}

      <StickyActionBar>
        {editable ? (
          <>
            <Button variant="secondary" onClick={() => setDeleteOpen(true)}>
              {t('inventoryDetail.delete')}
            </Button>
            <Button onClick={() => setFinalizeOpen(true)} disabled={inv.lineRows.length === 0}>
              {t('inventoryDetail.finalize')}
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={() => setDeleteOpen(true)}>
            {t('inventoryDetail.delete')}
          </Button>
        )}
      </StickyActionBar>

      <CameraScanner open={scannerOpen} onOpenChange={setScannerOpen} onDetected={onScan} />
      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        tone="danger"
        title={t('inventoryDetail.resetConfirmTitle')}
        description={t('inventoryDetail.resetConfirmText')}
        confirmLabel={t('inventoryDetail.reset')}
        onConfirm={confirmReset}
      />
      <ConfirmDialog
        open={finalizeOpen}
        onOpenChange={setFinalizeOpen}
        title={t('inventoryDetail.finalizeConfirmTitle')}
        description={t('inventoryDetail.finalizeConfirmText')}
        confirmLabel={t('inventoryDetail.finalize')}
        onConfirm={confirmFinalize}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        tone="danger"
        title={t('inventoryDetail.deleteConfirmTitle')}
        description={t('inventoryDetail.deleteConfirmText')}
        confirmLabel={t('inventoryDetail.delete')}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

/**
 * Строка ведомости. Ск11: факт — локальный черновик, сохраняется на blur/Enter (раньше — на каждую клавишу:
 * «12» становилось «2», пустое поле — нулём). Пусто = «ещё не считали». Ск12: у вскрытой упаковки факт
 * можно ввести в единицах списания («35 мл» из флакона 100 мл) — пересчитается в единицы продажи.
 * Ск4: «Расчёт» пока ведомость открыта — живой остаток склада (сервер отдаёт текущий).
 */
function InventoryLineCard({
  line,
  editable,
  toneClass,
  onOpenGood,
  onCommit,
}: {
  line: InventoryLineRow;
  editable: boolean;
  toneClass: string;
  onOpenGood: () => void;
  onCommit: (qty: number | undefined) => Promise<boolean>;
}) {
  const unitShort = useUnitShort();
  const t = useT('stock');
  const format = useFormat();
  const saleUnit = unitShort(line.unit);
  const ratio = line.unitRatio && line.unitRatio > 0 ? line.unitRatio : 1;
  const hasWriteoffUnit = Boolean(line.writeoffUnit) && line.writeoffUnit !== line.unit && ratio !== 1;
  const writeoffUnit = hasWriteoffUnit ? unitShort(line.writeoffUnit!) : '';
  const serverText = line.actualQty === undefined ? '' : String(line.actualQty);
  const [draft, setDraft] = useState<string | null>(null);
  // Отправленное значение держим на экране, пока сервер не ответит — поле не мигает старым числом
  const [sent, setSent] = useState<{ text: string; base: string } | null>(null);
  if (sent && serverText !== sent.base) setSent(null);
  const [partDraft, setPartDraft] = useState('');
  const [weightDraft, setWeightDraft] = useState('');
  const text = draft ?? sent?.text ?? serverText;

  const send = async (qty: number | undefined) => {
    setSent({ text: qty === undefined ? '' : String(qty), base: serverText });
    const ok = await onCommit(qty);
    if (!ok) setSent(null);
  };

  const commit = () => {
    if (draft === null) return;
    const trimmed = draft.trim();
    setDraft(null);
    if (!trimmed) {
      if (line.actualQty !== undefined) void send(undefined);
      return;
    }
    const qty = parseQty(trimmed);
    if (!(qty >= 0)) return;
    if (qty !== line.actualQty) void send(qty);
  };

  const commitPart = () => {
    const part = parseQty(partDraft);
    setPartDraft('');
    if (!(part >= 0)) return;
    void send(Math.round((part / ratio) * 1e4) / 1e4);
  };

  const commitWeight = () => {
    const weight = parseQty(weightDraft);
    setWeightDraft('');
    if (!(weight >= 0) || !line.massNetG || !line.massGrossG) return;
    const tare = line.massGrossG - line.massNetG;
    void send(Math.round(Math.max(0, (weight - tare) / line.massNetG) * 100) / 100);
  };

  const onEnter = (fn: () => void) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      fn();
    }
  };

  return (
    <Card as="li" padding="sm" className={cn('flex flex-col gap-2', toneClass)}>
      <div className="flex items-center justify-between gap-2">
        <button type="button" className="min-w-0 flex-1 truncate text-left text-sm font-medium text-fg underline-offset-2 hover:underline" onClick={onOpenGood}>
          {line.goodName}
        </button>
        {line.actualQty === undefined ? (
          <Badge tone="neutral" size="sm">
            {t('inventoryDetail.notCounted')}
          </Badge>
        ) : (
          line.diff !== 0 && (
            <Badge tone={line.diff < 0 ? 'danger' : 'success'} size="sm">
              {line.diff > 0 ? `+${formatQty(line.diff)}` : formatQty(line.diff)} {saleUnit}
            </Badge>
          )
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <div>
          <p className="text-xs text-muted">{t('inventoryDetail.calc')}</p>
          <p className={cn('flex min-h-10 items-center text-sm font-medium tabular-nums', line.calcQty < 0 ? 'text-danger' : 'text-fg')}>
            {formatQty(line.calcQty)} {saleUnit}
          </p>
        </div>
        <div>
          <p className="mb-1 text-xs text-muted">
            {t('inventoryDetail.actual')}, {saleUnit}
          </p>
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={text}
            disabled={!editable}
            placeholder={t('inventoryDetail.notCountedShort')}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={onEnter(commit)}
          />
        </div>
        {editable && hasWriteoffUnit && (
          <div>
            <p className="mb-1 text-xs text-muted">{t('inventoryDetail.actualInWriteoffUnit', { unit: writeoffUnit, ratio: formatQty(ratio), saleUnit })}</p>
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={partDraft}
              placeholder="—"
              onChange={(e) => setPartDraft(e.target.value)}
              onBlur={commitPart}
              onKeyDown={onEnter(commitPart)}
            />
          </div>
        )}
        {editable && line.massNetG && line.massGrossG && (
          <div>
            <p className="mb-1 text-xs text-muted">{t('inventoryDetail.weightG')}</p>
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              value={weightDraft}
              placeholder="—"
              onChange={(e) => setWeightDraft(e.target.value)}
              onBlur={commitWeight}
              onKeyDown={onEnter(commitWeight)}
            />
          </div>
        )}
      </div>
    </Card>
  );
}
