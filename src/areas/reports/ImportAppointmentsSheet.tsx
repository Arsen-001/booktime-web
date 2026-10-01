'use client';

/**
 * F-12-037: «Записи» → «Операции с Excel» → «Загрузить из Excel» — перенос записей из старой системы.
 * Колонки CSV (шапка по-русски или по-английски, первая строка пропускается): «Сотрудник; Клиент; Телефон;
 * Дата визита; Длительность (мин); Услуги (через ##); Статус; Комментарий». ⭐ Упрощение против Altegio: файл
 * .xlsx не разбираем (нет бэкенда) — принимаем CSV, тот же приём, что у ImportOperationsSheet (finance) и
 * ImportCounterpartiesSheet; предупреждение об этом — в подсказке экрана.
 */
import { useRef, useState } from 'react';
import { FileSpreadsheet, Upload } from 'lucide-react';
import { importAppointments } from '@/api/reports';
import { useApiMutation } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import { IMPORT_ROW_LIMIT } from '@/domain/reports';
import type { BookingStatus } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { parseCsv, readTextFile } from '@/lib/csv';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { Sheet } from '@/ui/Sheet';
import { useToast } from '@/ui/Toast';

export interface ImportAppointmentsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

interface ParsedRow {
  label: string;
  error?: string;
  input?: {
    staffName: string;
    clientName: string;
    clientPhone: string;
    visitStart: string;
    durationMin: number;
    serviceNames: string[];
    status: BookingStatus;
    comment?: string;
  };
}

const STATUS_BY_CODE: Record<string, BookingStatus> = {
  '-1': 'no_show',
  '0': 'scheduled',
  '1': 'arrived',
  '2': 'client_confirmed',
};

export function ImportAppointmentsSheet({ open, onOpenChange, onImported }: ImportAppointmentsSheetProps) {
  const t = useT('reports');
  const tc = useT('common');
  const toast = useToast();
  const { businessId, activeLocationIds } = useCurrent();
  const inputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState('');
  const mutation = useApiMutation((body: ParsedRow['input'][]) => importAppointments(businessId!, activeLocationIds[0] ?? '', body.filter((b): b is NonNullable<typeof b> => Boolean(b))));

  const onFile = async (file: File) => {
    setFileName(file.name);
    const text = await readTextFile(file);
    const table = parseCsv(text).slice(0, IMPORT_ROW_LIMIT + 1);
    const body = table.length && /сотрудник|staff/i.test(table[0]?.[0] ?? '') ? table.slice(1) : table;
    setRows(
      body
        .filter((r) => r.some((cell) => cell.trim()))
        .map((r) => {
          const [staffName, clientName, phone, visitStart, durationRaw, servicesRaw, statusRaw, comment] = r;
          const label = `${staffName ?? ''} · ${clientName ?? ''} · ${visitStart ?? ''}`.trim();
          if (!staffName || !clientName || !phone || !visitStart) return { label, error: t('importAppointments.rowMissing') };
          const status = STATUS_BY_CODE[(statusRaw ?? '').trim()] ?? (statusRaw as BookingStatus) ?? 'arrived';
          return {
            label,
            input: {
              staffName: staffName.trim(),
              clientName: clientName.trim(),
              clientPhone: phone.trim(),
              visitStart: visitStart.trim(),
              durationMin: Number(durationRaw) || 15,
              serviceNames: (servicesRaw ?? '').split('##').map((s) => s.trim()).filter(Boolean),
              status,
              comment: (comment ?? '').trim() || undefined,
            },
          };
        }),
    );
  };

  const validRows = rows.filter((r) => r.input);
  const invalidCount = rows.length - validRows.length;

  const confirmImport = async () => {
    if (validRows.length === 0 || !businessId) return;
    try {
      const result = await mutation.mutate(validRows.map((r) => r.input));
      toast.success(t('importAppointments.done', { count: result.created }));
      setRows([]);
      setFileName('');
      onOpenChange(false);
      onImported();
    } catch {
      toast.error(t('importAppointments.failed'));
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
      title={t('appointments.importExcel')}
      footer={
        rows.length > 0 ? (
          <>
            <Button variant="secondary" onClick={() => setRows([])}>
              {tc('actions.cancel')}
            </Button>
            <Button onClick={() => void confirmImport()} loading={mutation.isPending} disabled={validRows.length === 0}>
              {t('importAppointments.confirm', { count: validRows.length })}
            </Button>
          </>
        ) : undefined
      }
    >
      <div data-f="F-12-037" className="flex flex-col gap-4">
        {rows.length === 0 ? (
          <>
            <p className="text-sm text-muted">{t('importAppointments.hint')}</p>
            <p data-f="F-08-150" className="text-sm text-muted">
              {t('importAppointments.productsHint')}
            </p>
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
              {t('importAppointments.choose')}
            </Button>
            <EmptyState compact icon={<FileSpreadsheet aria-hidden />} title={t('importAppointments.emptyTitle')} />
          </>
        ) : (
          <>
            <p className="text-sm text-fg">
              {fileName} · {t('importAppointments.summary', { valid: validRows.length, invalid: invalidCount })}
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
                      {t('importAppointments.rowOk')}
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
