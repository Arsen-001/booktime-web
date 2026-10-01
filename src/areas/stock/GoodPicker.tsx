'use client';

/**
 * Добавление товаров в строки операции/инвентаризации (F-08-055 «три способа»: поиск/скан, «Добавить из
 * списка» по категориям, «Загрузить из Excel»; F-08-090/091 сканер-клавиатура и точный скан = сразу добавить).
 * Принадлежит разделу stock.
 */
import { useUnitShort } from '@/areas/stock/warehouse.utils';
import { useMemo, useRef, useState } from 'react';
import { Camera, Plus, Search, Upload } from 'lucide-react';
import { searchGoods, type GoodRow } from '@/api/stock';
import { useApiQuery } from '@/api/request';
import type { Id } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { parseCsv, readTextFile } from '@/lib/csv';
import { Button } from '@/ui/Button';
import { Checkbox } from '@/ui/Checkbox';
import { EmptyState } from '@/ui/EmptyState';
import { IconButton } from '@/ui/IconButton';
import { Input } from '@/ui/Input';
import { Modal } from '@/ui/Modal';
import { useToast } from '@/ui/Toast';
import { CameraScanner } from '@/areas/stock/CameraScanner';

export interface GoodPickerProps {
  businessId: Id;
  locationId: Id;
  /** Товары, уже добавленные в строки — не предлагаются повторно */
  excludeIds: Id[];
  onAdd: (good: GoodRow) => void;
  /** Excel-строки: [{goodId?, sku?, barcode?, name, qty, price?, discountPct?}] — форма сама решает, что делать */
  onImportRows?: (rows: { good: GoodRow; qty: number; price?: number; discountPct?: number }[]) => void;
  /** Ск12: повторный скан/Enter по уже добавленному товару — +1 к его количеству (без него — «уже добавлен») */
  onRepeat?: (good: GoodRow) => void;
}

/** F-08-055 «+ Добавить товар»: строка поиска со сканером; точное совпадение по штрихкоду + Enter добавляет сразу (F-08-091) */
export function GoodPicker({ businessId, locationId, excludeIds, onAdd, onImportRows, onRepeat }: GoodPickerProps) {
  const t = useT('stock');
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [listOpen, setListOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const q = useApiQuery(['stock', 'searchGoods', businessId, locationId, query], () => searchGoods(businessId, locationId, query, 30), {
    enabled: listOpen && query.trim().length > 0,
  });
  const results = (q.data ?? []).filter((g) => !excludeIds.includes(g.id));

  const addGood = (g: GoodRow) => {
    onAdd(g);
    setQuery('');
    setListOpen(false);
  };

  const handleScan = async (code: string) => {
    setScannerOpen(false);
    const found = await searchGoods(businessId, locationId, code, 5);
    const exact = found.find((g) => g.barcode === code);
    if (exact && !excludeIds.includes(exact.id)) {
      addGood(exact);
      toast.success(t('goodPicker.scanFound', { name: exact.name }));
    } else if (exact && onRepeat) {
      onRepeat(exact);
      toast.success(t('goodPicker.scanPlusOne', { name: exact.name }));
    } else if (exact) {
      toast.info(t('goodPicker.scanAlreadyAdded'));
    } else {
      setQuery(code);
      setListOpen(true);
      toast.info(t('goodPicker.scanNotFound'));
    }
  };

  const onSearchKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || !query.trim()) return;
    e.preventDefault();
    const found = await searchGoods(businessId, locationId, query.trim(), 5);
    // QA 30.09: единственный найденный по названию товар Enter тоже добавляет (раньше — только точный штрихкод/артикул)
    const exact = found.find((g) => g.barcode === query.trim() || g.sku === query.trim()) ?? (found.length === 1 ? found[0] : undefined);
    if (exact && !excludeIds.includes(exact.id)) addGood(exact);
    else if (exact && onRepeat) {
      onRepeat(exact);
      setQuery('');
      setListOpen(false);
    }
  };

  const onImportFile = async (file: File) => {
    const text = await readTextFile(file);
    const rows = parseCsv(text);
    if (rows.length < 2) {
      toast.error(t('goodPicker.importEmpty'));
      return;
    }
    const header = rows[0].map((h) => h.toLowerCase());
    const idx = (names: string[]) => header.findIndex((h) => names.some((n) => h.includes(n)));
    const iName = idx(['назв', 'name']);
    const iSku = idx(['артикул', 'sku']);
    const iBarcode = idx(['штрих', 'barcode']);
    const iQty = idx(['кол', 'qty']);
    const iPrice = idx(['цена', 'price']);
    const iDiscount = idx(['скидк', 'discount']);
    const all = await searchGoods(businessId, locationId, '', 1000);
    const matched: { good: GoodRow; qty: number; price?: number; discountPct?: number }[] = [];
    let unmatched = 0;
    rows.slice(1).forEach((r) => {
      const name = iName >= 0 ? r[iName] : undefined;
      const sku = iSku >= 0 ? r[iSku] : undefined;
      const barcode = iBarcode >= 0 ? r[iBarcode] : undefined;
      const good = all.find((g) => (barcode && g.barcode === barcode) || (sku && g.sku === sku) || (name && g.name.toLowerCase() === name.toLowerCase()));
      if (!good) {
        unmatched += 1;
        return;
      }
      const qty = iQty >= 0 ? Number(r[iQty]) || 1 : 1;
      const price = iPrice >= 0 ? Number(r[iPrice]) || undefined : undefined;
      const discountPct = iDiscount >= 0 ? Number(r[iDiscount]) || undefined : undefined;
      matched.push({ good, qty, price, discountPct });
    });
    if (matched.length) onImportRows?.(matched);
    if (unmatched) toast.info(t('goodPicker.importPartial', { matched: matched.length, unmatched }));
    else toast.success(t('goodPicker.importDone', { count: matched.length }));
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setListOpen(true);
            }}
            onFocus={() => setListOpen(true)}
            onKeyDown={onSearchKeyDown}
            placeholder={t('goodPicker.searchPlaceholder')}
            leftIcon={<Search aria-hidden className="size-4" />}
          />
          {listOpen && query.trim() && (
            <div className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-border bg-surface shadow-lg">
              {results.length === 0 ? (
                <p className="px-3 py-3 text-sm text-muted">{t('goodPicker.noResults')}</p>
              ) : (
                results.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    className="flex w-full min-h-11 items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-surface-2"
                    onClick={() => addGood(g)}
                  >
                    <span className="truncate">{g.name}</span>
                    <span className="shrink-0 text-xs text-muted">{g.sku}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
        <IconButton icon={<Camera aria-hidden />} label={t('goodPicker.scan')} variant="outline" onClick={() => setScannerOpen(true)} />
        {onImportRows && (
          <>
            <IconButton icon={<Upload aria-hidden />} label={t('goodPicker.importExcel')} variant="outline" onClick={() => fileRef.current?.click()} />
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void onImportFile(file);
                e.target.value = '';
              }}
            />
          </>
        )}
      </div>

      <CameraScanner open={scannerOpen} onOpenChange={setScannerOpen} onDetected={handleScan} />
    </div>
  );
}

/** «Добавить из списка»: выбор категории → отметить товары → «Добавить» (F-08-055) */
export function GoodListPickerModal({
  open,
  onOpenChange,
  goods,
  categories,
  excludeIds,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goods: GoodRow[];
  categories: { id: Id; name: string }[];
  excludeIds: Id[];
  onAdd: (goods: GoodRow[]) => void;
}) {
  const unitShort = useUnitShort();
  const t = useT('stock');
  const [categoryId, setCategoryId] = useState('');
  const [checked, setChecked] = useState<Set<Id>>(new Set());

  const available = useMemo(
    () => goods.filter((g) => !excludeIds.includes(g.id) && (!categoryId || g.categoryId === categoryId)),
    [goods, excludeIds, categoryId],
  );

  const toggle = (id: Id) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const confirm = () => {
    onAdd(available.filter((g) => checked.has(g.id)));
    setChecked(new Set());
    onOpenChange(false);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t('goodPicker.fromListTitle')}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t('goodPicker.cancel')}
          </Button>
          <Button onClick={confirm} disabled={checked.size === 0}>
            {t('goodPicker.addSelected', { count: checked.size })}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setCategoryId('')}
            className={`min-h-9 rounded-full border px-3 text-sm ${!categoryId ? 'border-primary bg-primary/10 text-primary-text' : 'border-border text-muted'}`}
          >
            {t('goodPicker.allCategories')}
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategoryId(c.id)}
              className={`min-h-9 rounded-full border px-3 text-sm ${categoryId === c.id ? 'border-primary bg-primary/10 text-primary-text' : 'border-border text-muted'}`}
            >
              {c.name}
            </button>
          ))}
        </div>
        {available.length === 0 ? (
          <EmptyState compact icon={<Plus aria-hidden />} title={t('goodPicker.noGoods')} />
        ) : (
          <ul className="flex max-h-96 flex-col gap-1 overflow-auto">
            {available.map((g) => (
              <li key={g.id}>
                <label className="flex min-h-11 items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface-2">
                  <Checkbox checked={checked.has(g.id)} onCheckedChange={() => toggle(g.id)} />
                  <span className="flex-1 truncate text-sm">{g.name}</span>
                  <span className="text-xs text-muted">{unitShort(g.saleUnit)}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
