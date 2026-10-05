'use client';

/**
 * F-02-063: Excel у каталога услуг — «Выгрузить» / «Загрузить» для колонки
 * технического перерыва. ⭐ Упрощение против Altegio: файл .xlsx не разбираем (нет бэкенда) — CSV с той же
 * шапкой (тот же приём, что у ImportAppointmentsSheet/ImportOperationsSheet), Excel открывает и сохраняет
 * такой файл сам.
 */
import { useRef, useState } from 'react';
import { FileSpreadsheet, Upload } from 'lucide-react';
import { importTechBreaks, parseTechBreakSeconds, type TechBreakExportRow, type TechBreakImportRow } from '@/api/services';
import { logDataOp } from '@/api/data-ops';
import { useApiMutation } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { downloadCsv, parseCsv, readTextFile, toCsv } from '@/lib/csv';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { Sheet } from '@/ui/Sheet';
import { useToast } from '@/ui/Toast';

const HEADER = ['ID', 'Service', 'Tech. break'] as const;

/** Выгрузка колонки перерыва — вызывает меню «Excel ⌄» (CatalogExcelMenu) */
export function useTechBreakExport(exportRows: TechBreakExportRow[]) {
  const t = useT('services');
  const toast = useToast();
  const { businessId } = useCurrent();
  const exportMutation = useApiMutation(async () => {
    const csv = toCsv(
      exportRows.map((r) => [r.id, r.name, r.seconds]),
      HEADER,
    );
    downloadCsv('services-tech-break.csv', csv);
    await logDataOp({
      businessId: businessId ?? '',
      kind: 'export',
      area: 'services',
      entity: 'services',
      count: exportRows.length,
      fileName: 'services-tech-break.csv',
    });
    return exportRows.length;
  });
  return async () => {
    if (!businessId) return;
    try {
      await exportMutation.mutate(undefined);
      toast.success(t('techBreakExcel.exported'));
    } catch {
      toast.error(t('techBreakExcel.exportFailed'));
    }
  };
}

/** «Загрузить из Excel» для колонки перерыва: предпросмотр строк и применение (F-02-063) */
export function TechBreakImportSheet({ open, onOpenChange: setOpen }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useT('services');
  const tc = useT('common');
  const toast = useToast();
  const { businessId } = useCurrent();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<(TechBreakImportRow & { error?: string })[]>([]);
  const importMutation = useApiMutation((body: TechBreakImportRow[]) => importTechBreaks(businessId ?? '', body));

  const onFile = async (file: File) => {
    setFileName(file.name);
    const text = await readTextFile(file);
    const table = parseCsv(text);
    const body = table.length && /^id$/i.test((table[0]?.[0] ?? '').trim()) ? table.slice(1) : table;
    setRows(
      body
        .filter((r) => r.some((cell) => cell.trim()))
        .slice(0, 500)
        .map((r) => {
          const [id, name, raw] = r;
          const parsed = parseTechBreakSeconds((raw ?? '').trim());
          return {
            id: (id ?? '').trim(),
            name: (name ?? '').trim(),
            raw: (raw ?? '').trim(),
            error: parsed ? undefined : t('techBreakExcel.rowInvalid'),
          };
        }),
    );
  };

  const validRows = rows.filter((r) => !r.error);
  const invalidCount = rows.length - validRows.length;

  const confirmImport = async () => {
    if (!validRows.length) return;
    try {
      const result = await importMutation.mutate(validRows);
      toast.success(t('techBreakExcel.imported', { count: result.applied }));
      setRows([]);
      setFileName('');
      setOpen(false);
    } catch {
      toast.error(t('techBreakExcel.importFailed'));
    }
  };

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={(next) => {
          if (!next) {
            setRows([]);
            setFileName('');
          }
          setOpen(next);
        }}
        title={t('techBreakExcel.importAction')}
        footer={
          rows.length > 0 ? (
            <>
              <Button variant="secondary" onClick={() => setRows([])}>
                {tc('actions.cancel')}
              </Button>
              <Button onClick={() => void confirmImport()} loading={importMutation.isPending} disabled={validRows.length === 0}>
                {t('techBreakExcel.confirm', { count: validRows.length })}
              </Button>
            </>
          ) : undefined
        }
      >
        <div className="flex flex-col gap-4">
          {rows.length === 0 ? (
            <>
              <p className="text-sm text-muted">{t('techBreakExcel.importHint')}</p>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
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
                {t('techBreakExcel.summary', {
                  valid: validRows.length,
                  invalid: invalidCount,
                })}
              </p>
              <ul className="flex max-h-96 flex-col gap-1.5 overflow-y-auto">
                {rows.map((r, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                  >
                    <span className="min-w-0 truncate">
                      {r.name || r.id} · {r.raw}
                    </span>
                    {r.error ? (
                      <Badge tone="danger" size="sm">
                        {r.error}
                      </Badge>
                    ) : (
                      <Badge tone="success" size="sm">
                        {t('techBreakExcel.rowOk')}
                      </Badge>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </Sheet>
    </>
  );
}
