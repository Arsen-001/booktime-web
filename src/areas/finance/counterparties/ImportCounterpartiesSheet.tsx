'use client';

/**
 * Контрагенты: загрузка из Excel (F-07-022). CSV (Excel сохраняет таблицу как CSV, см. @/lib/csv) —
 * колонки «Название; Телефон; ИНН»; строки без названия отмечены ошибкой и не загружаются.
 */
import { useRef, useState } from 'react';
import { FileSpreadsheet, Upload } from 'lucide-react';
import { importCounterparties } from '@/api/finance';
import { useApiMutation } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import type { CounterpartyInput } from '@/domain/finance';
import { useT } from '@/i18n/useT';
import { parseCsv, readTextFile } from '@/lib/csv';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { Sheet } from '@/ui/Sheet';
import { useToast } from '@/ui/Toast';

export interface ImportCounterpartiesSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ParsedRow {
  input?: CounterpartyInput;
  error?: string;
  raw: string[];
}

export function ImportCounterpartiesSheet({ open, onOpenChange }: ImportCounterpartiesSheetProps) {
  const t = useT('finance');
  const tc = useT('common');
  const toast = useToast();
  const { businessId } = useCurrent();
  const inputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState('');

  const mutation = useApiMutation((input: CounterpartyInput[]) => importCounterparties(businessId!, input));

  const onFile = async (file: File) => {
    setFileName(file.name);
    const text = await readTextFile(file);
    const table = parseCsv(text);
    const body = table.length && /название|name/i.test(table[0]?.[0] ?? '') ? table.slice(1) : table;
    setRows(
      body
        .filter((r) => r.some((cell) => cell.trim()))
        .map((r) => {
          const name = (r[0] ?? '').trim();
          if (!name) return { raw: r, error: t('importCounterparties.rowMissingName') };
          return { raw: r, input: { type: 'other', name, phone: (r[1] ?? '').trim() || undefined, inn: (r[2] ?? '').trim() || undefined } };
        }),
    );
  };

  const validRows = rows.filter((r) => r.input);
  const invalidCount = rows.length - validRows.length;

  const confirmImport = async () => {
    if (validRows.length === 0) return;
    try {
      await mutation.mutate(validRows.map((r) => r.input!));
      toast.success(t('importCounterparties.done', { count: validRows.length }));
      setRows([]);
      setFileName('');
      onOpenChange(false);
    } catch {
      toast.error(t('importCounterparties.failed'));
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setRows([]);
          setFileName('');
        }
        onOpenChange(next);
      }}
      title={t('counterparties.import')}
      footer={
        rows.length > 0 ? (
          <>
            <Button variant="secondary" onClick={() => setRows([])}>
              {tc('actions.cancel')}
            </Button>
            <Button onClick={confirmImport} loading={mutation.isPending} disabled={validRows.length === 0}>
              {t('importCounterparties.confirm', { count: validRows.length })}
            </Button>
          </>
        ) : undefined
      }
    >
      <div data-f="F-07-022 F-08-120 F-08-148" className="flex flex-col gap-4">
        {rows.length === 0 ? (
          <>
            <p className="text-sm text-muted">{t('importCounterparties.hint')}</p>
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
              {t('importCounterparties.choose')}
            </Button>
            <EmptyState compact icon={<FileSpreadsheet aria-hidden />} title={t('importCounterparties.emptyTitle')} />
          </>
        ) : (
          <>
            <p className="text-sm text-fg">
              {fileName} · {t('importCounterparties.summary', { valid: validRows.length, invalid: invalidCount })}
            </p>
            <ul className="flex max-h-96 flex-col gap-1.5 overflow-y-auto">
              {rows.map((r, i) => (
                <li key={i} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm">
                  <span className="min-w-0 truncate">{r.raw[0] || t('importCounterparties.rowEmpty')}</span>
                  {r.error ? (
                    <Badge tone="danger" size="sm">
                      {r.error}
                    </Badge>
                  ) : (
                    <Badge tone="success" size="sm">
                      {t('importCounterparties.rowOk')}
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Sheet>
  );
}
