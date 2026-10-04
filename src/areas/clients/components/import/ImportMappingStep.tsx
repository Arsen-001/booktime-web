'use client';

/**
 * Шаг 2 импорта: какая колонка что значит (подобрано по названиям, можно поменять) и как первые клиенты лягут в
 * базу — карточками, на телефоне тоже. Без колонки телефона дальше нельзя (по номеру узнаём клиента).
 */
import { useMemo } from 'react';
import { CheckCircle2, Info } from 'lucide-react';
import { IMPORT_COLUMN_TARGETS, type ImportClientInput, type ImportColumnTarget, type ImportPreset } from '@/domain/clients';
import type { ImportSheet } from '@/areas/clients/lib/importFile';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Select } from '@/ui/Select';

export interface ImportMappingStepProps {
  sheet: ImportSheet;
  preset: ImportPreset;
  method: 'paste' | 'file';
  mapping: ImportColumnTarget[];
  onMappingChange: (next: ImportColumnTarget[]) => void;
  /** Первые готовые строки (prepareImport) — для «как это будет выглядеть» */
  preview: ImportClientInput[];
  readyCount: number;
}

/** Первые непустые значения колонки — чтобы было видно, что в ней лежит */
function samples(rows: string[][], col: number): string[] {
  const out: string[] = [];
  for (const r of rows) {
    const v = (r[col] ?? '').trim();
    if (v && !out.includes(v)) out.push(v);
    if (out.length >= 2) break;
  }
  return out;
}

export function ImportMappingStep({ sheet, preset, method, mapping, onMappingChange, preview, readyCount }: ImportMappingStepProps) {
  const t = useT('clients');
  const { phone, date, money } = useFormat();
  const k = 'importPage.import';
  const options = useMemo(
    () =>
      IMPORT_COLUMN_TARGETS.map((target) => ({
        value: target,
        label: target === 'phone' ? `${t(`${k}.field.phone`)} · ${t(`${k}.required`)}` : t(`${k}.field.${target}`),
      })),
    [t],
  );
  const columnSamples = useMemo(() => sheet.headers.map((_, i) => samples(sheet.rows.slice(0, 200), i)), [sheet]);
  const hasPhone = mapping.includes('phone');
  const hasName = mapping.includes('name') || mapping.includes('lastName');

  // Одно поле — одной колонке: выбрали уже занятое — прежняя колонка становится «не загружать»
  const pick = (i: number, target: ImportColumnTarget) =>
    onMappingChange(mapping.map((m, idx) => (idx === i ? target : target !== 'ignore' && m === target ? 'ignore' : m)));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        {preset !== 'generic' ? (
          // Не Badge: у него текст в одну строку, а длинная фраза на телефоне должна переноситься
          <p className="flex items-start gap-2 self-start rounded-lg bg-success-soft px-3 py-2 text-sm font-medium text-success">
            <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span className="min-w-0">{t(`${k}.preset.${preset}`)}</span>
          </p>
        ) : (
          <p className="text-sm font-medium text-fg">{t(`${k}.preset.generic`)}</p>
        )}
        <p className="text-sm text-muted">
          {method === 'file' && sheet.fileName
            ? t(`${k}.fileLine`, {
                file: sheet.fileName,
                count: sheet.rows.length,
              })
            : t(`${k}.pastedLine`, { count: sheet.rows.length })}
          {' · '}
          {t(`${k}.columnsHint`)}
        </p>
      </div>

      <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
        {sheet.headers.map((h, i) => (
          <li key={i} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-4 sm:px-4">
            <div className="min-w-0 sm:w-1/2">
              <p className="truncate text-sm font-medium text-fg">{h || t(`${k}.column`, { n: i + 1 })}</p>
              <p className="truncate text-sm text-muted">{columnSamples[i].length ? columnSamples[i].join(' · ') : t(`${k}.sampleEmpty`)}</p>
            </div>
            <Select
              className="sm:w-1/2"
              aria-label={h || t(`${k}.column`, { n: i + 1 })}
              options={options}
              value={mapping[i] ?? 'ignore'}
              onValueChange={(v) => pick(i, v as ImportColumnTarget)}
            />
          </li>
        ))}
      </ul>

      {!hasPhone && (
        <p role="alert" className="text-sm text-danger">
          {t(`${k}.needPhone`)}
        </p>
      )}
      {hasPhone && !hasName && (
        <p className="flex items-start gap-2 text-sm text-muted">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
          {t(`${k}.noNameHint`)}
        </p>
      )}

      {hasPhone && (
        <section className="flex flex-col gap-3" aria-labelledby="import-preview-title">
          <h3 id="import-preview-title" className="text-base font-semibold text-fg">
            {t(`${k}.previewTitle`)}
          </h3>
          {preview.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted">{t(`${k}.previewEmpty`)}</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-3">
              {preview.map((c) => {
                const extras = [
                  c.email,
                  c.birthday
                    ? t(`${k}.previewBirthday`, {
                        date: date(c.birthday, 'long'),
                      })
                    : undefined,
                  c.tags?.join(', '),
                  c.sold ? t(`${k}.previewSold`, { sum: money(c.sold) }) : undefined,
                  c.discountPercent ? t(`${k}.previewDiscount`, { n: c.discountPercent }) : undefined,
                ].filter(Boolean);
                return (
                  <li key={c.rowIndex} className="flex min-w-0 flex-col gap-1 rounded-xl border border-border bg-surface p-3">
                    <p className="truncate text-sm font-semibold text-fg">{[c.name, c.lastName].filter(Boolean).join(' ')}</p>
                    <p className="truncate text-sm text-fg tabular-nums">{phone(c.phone)}</p>
                    {extras.map((x, j) => (
                      <p key={j} className="truncate text-sm text-muted">
                        {x}
                      </p>
                    ))}
                    {c.note && <p className="line-clamp-2 text-sm text-muted">{c.note}</p>}
                  </li>
                );
              })}
            </ul>
          )}
          {readyCount > preview.length && <p className="text-sm text-muted">{t(`${k}.previewMore`, { count: readyCount - preview.length })}</p>}
        </section>
      )}
    </div>
  );
}
