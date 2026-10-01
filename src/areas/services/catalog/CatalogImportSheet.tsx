'use client';

/**
 * Загрузка всего прайса из Excel (У11): колонки «Категория; Название; Цена от; Цена до; Длительность, мин», до 500
 * строк, категории заводятся сами. Сначала предпросмотр — какие строки уйдут, какие с ошибкой и какие уже есть.
 * ⭐ Как и у техперерыва: CSV вместо .xlsx (нет бэкенда) — Excel открывает и сохраняет такой файл сам.
 */
import { useRef, useState } from 'react';
import { FileSpreadsheet, Upload } from 'lucide-react';
import { CATALOG_IMPORT_LIMIT, importCatalog, type ServiceRow } from '@/api/services';
import { useApiMutation } from '@/api/request';
import { useCurrent, useSphere } from '@/demo/hooks';
import { isSameServiceName, type CatalogImportRow } from '@/domain/services';
import { useT } from '@/i18n/useT';
import { formatMoneyRange } from '@/lib/money';
import { parseCsv, readTextFile } from '@/lib/csv';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { Sheet } from '@/ui/Sheet';
import { useToast } from '@/ui/Toast';

export const CATALOG_HEADER = ['Категория', 'Название', 'Цена от', 'Цена до', 'Длительность, мин'] as const;

type Parsed = CatalogImportRow & {
  line: number;
  error?: 'invalid' | 'duplicate';
};

export interface CatalogImportSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existing: ServiceRow[];
}

export function CatalogImportSheet({ open, onOpenChange, existing }: CatalogImportSheetProps) {
  const t = useT('services');
  const toast = useToast();
  const { businessId } = useCurrent();
  const sphere = useSphere();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<Parsed[]>([]);
  const importM = useApiMutation((body: CatalogImportRow[]) => importCatalog(businessId ?? '', sphere.id, body));

  const num = (v: string | undefined) => {
    const d = (v ?? '').replace(/[\s ֏]/g, '');
    return /^\d+$/.test(d) ? Number(d) : undefined;
  };

  const onFile = async (file: File) => {
    setFileName(file.name);
    const table = parseCsv(await readTextFile(file));
    const body = table.length && /категор|category/i.test(table[0]?.[0] ?? '') ? table.slice(1) : table;
    const seen: CatalogImportRow[] = [];
    setRows(
      body
        .filter((r) => r.some((c) => c.trim()))
        .slice(0, CATALOG_IMPORT_LIMIT)
        .map((r, i): Parsed => {
          const [category = '', name = '', from, to, dur] = r.map((c) => c.trim());
          const priceMin = num(from);
          const priceMax = num(to);
          const durationMin = num(dur);
          const row: Parsed = {
            line: i + 1,
            category,
            name,
            priceMin: priceMin ?? 0,
            priceMax,
            durationMin: durationMin ?? 0,
          };
          const valid =
            category &&
            name &&
            priceMin != null &&
            durationMin != null &&
            durationMin > 0 &&
            durationMin % 5 === 0 &&
            (priceMax == null || priceMax > priceMin);
          if (!valid) return { ...row, error: 'invalid' };
          const dup =
            existing.some((e) => isSameServiceName(e.service.name, { ru: name })) ||
            seen.some((x) => isSameServiceName({ ru: x.name }, { ru: name }));
          seen.push(row);
          return dup ? { ...row, error: 'duplicate' } : row;
        }),
    );
  };

  const valid = rows.filter((r) => !r.error);
  const close = (next: boolean) => {
    if (!next) {
      setRows([]);
      setFileName('');
    }
    onOpenChange(next);
  };

  const confirm = async () => {
    try {
      const res = await importM.mutate(
        valid.map(({ category, name, priceMin, priceMax, durationMin }) => ({
          category,
          name,
          priceMin,
          priceMax,
          durationMin,
        })),
      );
      toast.success(
        t('catalogExcel.imported', {
          count: res.created,
          categories: res.categoriesCreated,
        }),
      );
      close(false);
    } catch {
      toast.error(t('catalogExcel.importFailed'));
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={close}
      title={t('catalogExcel.importTitle')}
      size="lg"
      footer={
        rows.length > 0 ? (
          <>
            <Button variant="secondary" onClick={() => setRows([])}>
              {t('form.cancel')}
            </Button>
            <Button onClick={() => void confirm()} loading={importM.isPending} disabled={valid.length === 0}>
              {t('catalogExcel.confirm', { count: valid.length })}
            </Button>
          </>
        ) : undefined
      }
    >
      <div data-f="F-02-063 F-00-082" className="flex flex-col gap-4">
        {rows.length === 0 ? (
          <>
            <p className="text-sm text-muted">{t('catalogExcel.hint', { limit: CATALOG_IMPORT_LIMIT })}</p>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) void onFile(file);
              }}
            />
            <Button variant="secondary" leftIcon={<Upload aria-hidden />} onClick={() => inputRef.current?.click()}>
              {t('techBreakExcel.choose')}
            </Button>
            <EmptyState compact icon={<FileSpreadsheet aria-hidden />} title={t('techBreakExcel.emptyTitle')} />
          </>
        ) : (
          <>
            <p className="text-sm text-fg">
              {fileName} ·{' '}
              {t('catalogExcel.summary', {
                valid: valid.length,
                invalid: rows.length - valid.length,
              })}
            </p>
            <ul className="flex max-h-[28rem] flex-col gap-1.5 overflow-y-auto">
              {rows.map((r) => (
                <li
                  key={r.line}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                >
                  <span className="min-w-0 truncate">
                    <span className="text-muted">{r.category || '—'} · </span>
                    <span className="font-medium text-fg">{r.name || '—'}</span>
                    <span className="text-muted">
                      {' '}
                      · {formatMoneyRange(r.priceMin, r.priceMax)} · {t('durationSingle', { min: r.durationMin })}
                    </span>
                  </span>
                  <Badge tone={r.error === 'invalid' ? 'danger' : r.error === 'duplicate' ? 'warning' : 'success'} size="sm">
                    {r.error === 'invalid'
                      ? t('techBreakExcel.rowInvalid')
                      : r.error === 'duplicate'
                        ? t('templates.exists')
                        : t('techBreakExcel.rowOk')}
                  </Badge>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Sheet>
  );
}
