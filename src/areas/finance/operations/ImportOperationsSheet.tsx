'use client';

/**
 * Загрузка операций из Excel (F-07-017). CSV-колонки: «Дата; Статья; Касса; Сумма; Комментарий» (сумма > 0 —
 * доход, < 0 — расход). Строка с незнакомой статьёй/кассой или без даты/суммы отмечена ошибкой и не грузится.
 */
import { useMemo, useRef, useState } from 'react';
import { FileSpreadsheet, Upload } from 'lucide-react';
import { listAccounts, listItems, importOperations } from '@/api/finance';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import type { OperationInput } from '@/domain/finance';
import { useT } from '@/i18n/useT';
import { parseCsv, readTextFile } from '@/lib/csv';
import { combine, today } from '@/lib/date';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { Sheet } from '@/ui/Sheet';
import { useToast } from '@/ui/Toast';

export interface ImportOperationsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ParsedRow {
  input?: OperationInput;
  error?: string;
  label: string;
}

export function ImportOperationsSheet({ open, onOpenChange }: ImportOperationsSheetProps) {
  const t = useT('finance');
  const tc = useT('common');
  const toast = useToast();
  const { businessId, locationIds, activeLocationIds } = useCurrent();
  const inputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState('');

  const itemsQ = useApiQuery(['finance', 'items', businessId], () => listItems(businessId!), { enabled: open && Boolean(businessId) });
  const accountsQ = useApiQuery(['finance', 'accounts', businessId, activeLocationIds], () => listAccounts(businessId!, activeLocationIds), { enabled: open && Boolean(businessId) });
  const mutation = useApiMutation((input: OperationInput[]) => importOperations(businessId!, input));

  const itemByName = useMemo(() => new Map((itemsQ.data ?? []).map((i) => [i.name.trim().toLowerCase(), i])), [itemsQ.data]);
  const accountByName = useMemo(() => new Map((accountsQ.data ?? []).map((a) => [a.name.trim().toLowerCase(), a])), [accountsQ.data]);
  const defaultLocationId = activeLocationIds[0] ?? locationIds[0] ?? '';

  const onFile = async (file: File) => {
    setFileName(file.name);
    const text = await readTextFile(file);
    const table = parseCsv(text);
    const body = table.length && /дата|date/i.test(table[0]?.[0] ?? '') ? table.slice(1) : table;
    setRows(
      body
        .filter((r) => r.some((cell) => cell.trim()))
        .map((r) => {
          const [dateRaw, itemName, accountName, amountRaw, comment] = r;
          const label = `${dateRaw ?? ''} · ${itemName ?? ''} · ${amountRaw ?? ''}`.trim();
          const item = itemByName.get((itemName ?? '').trim().toLowerCase());
          const account = accountByName.get((accountName ?? '').trim().toLowerCase());
          const amountNum = Number((amountRaw ?? '').replace(/[^\d.-]/g, ''));
          const dateVal = /^\d{4}-\d{2}-\d{2}$/.test((dateRaw ?? '').trim()) ? (dateRaw ?? '').trim() : today();
          if (!item) return { label, error: t('importOperations.rowUnknownItem') };
          if (!account) return { label, error: t('importOperations.rowUnknownAccount') };
          if (!amountNum) return { label, error: t('importOperations.rowBadAmount') };
          return {
            label,
            input: {
              locationId: account.locationId || defaultLocationId,
              accountId: account.id,
              itemId: item.id,
              kind: amountNum >= 0 ? 'income' : 'expense',
              amount: Math.abs(amountNum),
              date: combine(dateVal, '12:00'),
              method: 'other',
              partyType: 'none',
              comment: (comment ?? '').trim() || undefined,
            },
          };
        }),
    );
  };

  const validRows = rows.filter((r) => r.input);
  const invalidCount = rows.length - validRows.length;

  const confirmImport = async () => {
    if (validRows.length === 0) return;
    try {
      await mutation.mutate(validRows.map((r) => r.input!));
      toast.success(t('importOperations.done', { count: validRows.length }));
      setRows([]);
      setFileName('');
      onOpenChange(false);
    } catch {
      toast.error(t('importOperations.failed'));
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
      title={t('operations.import')}
      footer={
        rows.length > 0 ? (
          <>
            <Button variant="secondary" onClick={() => setRows([])}>
              {tc('actions.cancel')}
            </Button>
            <Button onClick={confirmImport} loading={mutation.isPending} disabled={validRows.length === 0}>
              {t('importOperations.confirm', { count: validRows.length })}
            </Button>
          </>
        ) : undefined
      }
    >
      <div data-f="F-07-017" className="flex flex-col gap-4">
        {rows.length === 0 ? (
          <>
            <p className="text-sm text-muted">{t('importOperations.hint')}</p>
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
              {t('importOperations.choose')}
            </Button>
            <EmptyState compact icon={<FileSpreadsheet aria-hidden />} title={t('importOperations.emptyTitle')} />
          </>
        ) : (
          <>
            <p className="text-sm text-fg">
              {fileName} · {t('importOperations.summary', { valid: validRows.length, invalid: invalidCount })}
            </p>
            <ul className="flex max-h-96 flex-col gap-1.5 overflow-y-auto">
              {rows.map((r, i) => (
                <li key={i} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm">
                  <span className="min-w-0 truncate">{r.label}</span>
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
