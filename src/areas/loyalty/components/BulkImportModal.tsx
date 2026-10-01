'use client';

/**
 * Общая шторка «Загрузить из Excel/таблицы» для массовых загрузок раздела «loyalty»:
 * F-06-057 (карты и балансы), F-06-130 (абонементы), F-06-191 (сертификаты), F-06-145 (перенос счетов),
 * F-06-180 (перенос лояльности командой Altegio — тот же путь «загрузить таблицу»).
 *
 * Упрощение (❓/assumed, отличается от полного .xlsx-парсера в разделе clients, ImportExportScreen.tsx):
 * здесь только вставка текста, скопированного из Excel/таблицы (TSV — колонки табом, как при Ctrl+C из
 * ячеек) — постоянный поток загрузок карт/абонементов/сертификатов небольшой (десятки строк), а полный
 * бинарный .xlsx-парсер (ZIP+inflate+sharedStrings) — код, специфичный для clients (свой файл, чужой
 * путь), копировать 1:1 в другой раздел не стали. Реальный .xlsx-файл тоже можно открыть в любом
 * редакторе и скопировать ячейки — тот же результат.
 */
import { useState } from 'react';
import { AlertTriangle, Check, Upload } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { Modal } from '@/ui/Modal';
import { Textarea } from '@/ui/Textarea';

export interface BulkImportColumn {
  key: string;
  label: string;
}

export interface BulkImportRowResult {
  row: number;
  ok: boolean;
  message: string;
}

export interface BulkImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  hint: string;
  templateHeader: string;
  columns: BulkImportColumn[];
  onImportRow: (cells: string[]) => Promise<string>;
  /**
   * F-06-130: «одна ошибка отклоняет весь файл, в том числе верные строки». Читает и проверяет строку
   * БЕЗ побочных эффектов (без записи в мок-базу) — должен бросать те же ошибки, что и `onImportRow`.
   * Когда задан, перед любым импортом сначала проходим ВСЕ строки этой функцией; если хоть одна не
   * прошла — ни одна строка не импортируется, и результат показывает ошибки без единой отметки «ок».
   */
  onValidateRow?: (cells: string[]) => Promise<unknown>;
  onDone?: () => void;
}

function parseTable(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(/\t|;/).map((c) => c.trim()));
}

export function BulkImportModal({ open, onOpenChange, title, hint, templateHeader, columns, onImportRow, onValidateRow, onDone }: BulkImportModalProps) {
  const t = useT('loyalty');
  const [text, setText] = useState('');
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<BulkImportRowResult[] | null>(null);

  const reset = () => {
    setText('');
    setResults(null);
  };

  const close = () => {
    onOpenChange(false);
    reset();
  };

  const run = async () => {
    const rows = parseTable(text);
    // Первая строка — заголовки, если совпадает по числу колонок и не похожа на данные (без цифр-телефона)
    const dataRows = rows.length > 0 && rows[0].join('|').toLowerCase() === columns.map((c) => c.label.toLowerCase()).join('|') ? rows.slice(1) : rows;
    if (dataRows.length === 0) return;
    setRunning(true);

    // F-06-130: сначала проверяем ВСЕ строки без побочных эффектов — одна ошибка отклоняет весь файл,
    // включая верные строки (никого не импортируем частично).
    if (onValidateRow) {
      const validation: BulkImportRowResult[] = [];
      let hasError = false;
      for (let i = 0; i < dataRows.length; i++) {
        try {
          await onValidateRow(dataRows[i]);
          validation.push({ row: i + 1, ok: true, message: '' });
        } catch (e) {
          hasError = true;
          validation.push({
            row: i + 1,
            ok: false,
            message: e instanceof Error ? e.message : t('bulkImport.rowFailed'),
          });
        }
      }
      if (hasError) {
        setResults(
          validation.map((r) =>
            r.ok
              ? {
                  ...r,
                  ok: false,
                  message: t('bulkImport.rejectedFileHasErrors'),
                }
              : r,
          ),
        );
        setRunning(false);
        return;
      }
    }

    const out: BulkImportRowResult[] = [];
    for (let i = 0; i < dataRows.length; i++) {
      try {
        const message = await onImportRow(dataRows[i]);
        out.push({ row: i + 1, ok: true, message });
      } catch (e) {
        out.push({
          row: i + 1,
          ok: false,
          message: e instanceof Error ? e.message : t('bulkImport.rowFailed'),
        });
      }
    }
    setResults(out);
    setRunning(false);
    onDone?.();
  };

  const okCount = results?.filter((r) => r.ok).length ?? 0;
  const failCount = results ? results.length - okCount : 0;

  return (
    <Modal
      open={open}
      onOpenChange={(o) => (o ? onOpenChange(true) : close())}
      title={title}
      footer={
        results ? (
          <Button onClick={close}>{t('bulkImport.close')}</Button>
        ) : (
          <>
            <Button variant="outline" onClick={close}>
              {t('bulkImport.cancel')}
            </Button>
            <Button leftIcon={<Upload aria-hidden />} loading={running} disabled={!text.trim()} onClick={run}>
              {t('bulkImport.run')}
            </Button>
          </>
        )
      }
    >
      {results ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-fg">{t('bulkImport.summary', { ok: okCount, fail: failCount })}</p>
          <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
            {results.map((r) => (
              <li key={r.row} className="flex items-start gap-2 text-sm">
                {r.ok ? <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-success" /> : <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-danger" />}
                <span className={r.ok ? 'text-muted' : 'text-danger'}>
                  {t('bulkImport.rowLabel', { row: r.row })}: {r.message}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">{hint}</p>
          <p className="rounded-lg bg-surface-2 px-3 py-2 font-mono text-xs text-muted">{templateHeader}</p>
          <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={t('bulkImport.placeholder')} rows={8} autoResize />
        </div>
      )}
    </Modal>
  );
}
