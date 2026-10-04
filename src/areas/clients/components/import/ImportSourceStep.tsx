'use client';

/**
 * Шаг 1 импорта: файл (выбрать или перетащить) или вставка из таблицы. Разбор — lib/importFile (без библиотек).
 * Ошибка чтения — под полем, на языке интерфейса.
 */
import { useId, useState, type DragEvent } from 'react';
import { ClipboardPaste, FileSpreadsheet, LoaderCircle, ShieldCheck } from 'lucide-react';
import { ApiError } from '@/api/request';
import { IMPORT_FILE_MAX_ROWS } from '@/domain/clients';
import { parsePastedTable, readImportFile, type ImportSheet } from '@/areas/clients/lib/importFile';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { Button, buttonClasses } from '@/ui/Button';
import { Textarea } from '@/ui/Textarea';

export interface ImportSourceStepProps {
  onParsed: (sheet: ImportSheet, method: 'paste' | 'file') => void;
}

export function ImportSourceStep({ onParsed }: ImportSourceStepProps) {
  const t = useT('clients');
  const { number } = useFormat();
  const inputId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [dragOver, setDragOver] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [text, setText] = useState('');

  const message = (e: unknown): string => {
    const code = e instanceof ApiError ? e.code : '';
    if (code === 'too_many_rows')
      return t('importPage.import.errors.tooManyRows', {
        max: number(IMPORT_FILE_MAX_ROWS),
      });
    if (code === 'legacy_xls_unsupported') return t('importPage.import.errors.legacyXls');
    if (code === 'binary_unsupported') return t('importPage.import.errors.binary');
    if (code === 'empty_import') return t('importPage.import.errors.empty');
    return t('importPage.import.errors.parse');
  };

  const readFile = async (file: File | undefined) => {
    if (!file) return;
    setError(undefined);
    setBusy(true);
    try {
      onParsed(await readImportFile(file), 'file');
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };

  const readPaste = () => {
    setError(undefined);
    try {
      onParsed(parsePastedTable(text), 'paste');
    } catch (e) {
      setError(message(e));
    }
  };

  const onDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setDragOver(false);
    void readFile(e.dataTransfer.files?.[0]);
  };

  return (
    <div className="flex flex-col gap-4">
      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={cn(
          'flex min-h-44 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border-strong bg-surface px-4 py-6 text-center transition-colors hover:bg-surface-2',
          dragOver && 'border-primary bg-primary-soft',
          busy && 'cursor-wait',
        )}
      >
        <span className="inline-flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary-text">
          {busy ? <LoaderCircle aria-hidden className="size-6 animate-spin" /> : <FileSpreadsheet aria-hidden className="size-6" />}
        </span>
        <span className="text-base font-medium text-fg">{busy ? t('importPage.import.drop.reading') : t('importPage.import.drop.title')}</span>
        <span className="text-sm text-muted">
          {t('importPage.import.drop.hint', {
            max: number(IMPORT_FILE_MAX_ROWS),
          })}
        </span>
        <span aria-hidden className={cn(buttonClasses({ variant: 'primary', size: 'md' }), 'pointer-events-none mt-1', busy && 'opacity-60')}>
          {t('importPage.import.drop.choose')}
        </span>
        <input
          id={inputId}
          type="file"
          accept=".xlsx,.xls,.csv,.txt,.tsv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="sr-only"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            void readFile(f);
          }}
        />
      </label>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      {pasteOpen ? (
        <div className="flex flex-col gap-3">
          <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={t('importPage.import.pastePlaceholder')} rows={6} autoFocus />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setPasteOpen(false)}>
              {t('importPage.import.pasteCancel')}
            </Button>
            <Button onClick={readPaste} disabled={!text.trim()}>
              {t('importPage.import.pasteContinue')}
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <Button variant="ghost" leftIcon={<ClipboardPaste aria-hidden />} onClick={() => setPasteOpen(true)}>
            {t('importPage.import.pasteToggle')}
          </Button>
        </div>
      )}

      <p className="flex items-start gap-2 text-sm text-muted">
        <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />
        <span>{t('importPage.import.noDuplicatesNote')}</span>
      </p>
    </div>
  );
}
