'use client';

/**
 * Шаг 3 импорта: сверка с базой (пробный прогон на сервере, без записи) — сколько новых, сколько уже в базе,
 * что делать с ними («дополнить пустые поля» / «пропустить»), что загрузим с оговоркой и что не загрузится
 * (с файлом этих строк).
 */
import { AlertTriangle, Download, UserCheck, UserPlus, XCircle } from 'lucide-react';
import type { ImportBatchRowResult, ImportOnExisting, ImportRowWarning, ImportWarningCode, PreparedImport } from '@/domain/clients';
import { countByCode, type RejectedLine } from '@/areas/clients/lib/importReport';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { ChoiceGroup } from '@/ui/ChoiceGroup';
import { ErrorState } from '@/ui/ErrorState';
import { StatCard } from '@/ui/StatCard';

export interface ImportCheckStepProps {
  prepared: PreparedImport;
  /** Ответ пробного прогона (режим «дополнить»): created / updated / skipped(nothingToFill) / error */
  dry: ImportBatchRowResult[] | null;
  progress: { done: number; total: number } | null;
  failed: boolean;
  onRetry: () => void;
  onExisting: ImportOnExisting;
  onExistingChange: (v: ImportOnExisting) => void;
  rejected: RejectedLine[];
  onDownloadRejected: () => void;
}

function ProgressBar({ done, total, label }: { done: number; total: number; label: string }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-fg">{label}</span>
        <span className="text-muted tabular-nums">{pct}%</span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-label={label}
        className="h-2 overflow-hidden rounded-full bg-surface-3"
      >
        <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export { ProgressBar as ImportProgressBar };

export function ImportCheckStep({
  prepared,
  dry,
  progress,
  failed,
  onRetry,
  onExisting,
  onExistingChange,
  rejected,
  onDownloadRejected,
}: ImportCheckStepProps) {
  const t = useT('clients');
  const { number } = useFormat();
  const k = 'importPage.import';

  if (failed) return <ErrorState title={t(`${k}.checkFailed`)} onRetry={onRetry} />;
  if (!dry) {
    return (
      <div className="flex flex-col gap-6 py-2">
        <ProgressBar done={progress?.done ?? 0} total={progress?.total ?? prepared.ready.length} label={t(`${k}.checking`)} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard label={t(`${k}.summary.new`)} value="" loading />
          <StatCard label={t(`${k}.summary.existing`)} value="" loading />
          <StatCard label={t(`${k}.summary.rejected`)} value="" loading className="max-sm:col-span-2" />
        </div>
      </div>
    );
  }

  const created = dry.filter((r) => r.status === 'created').length;
  const fillable = dry.filter((r) => r.status === 'updated').length;
  const existing = fillable + dry.filter((r) => r.status === 'skipped' && r.code === 'nothingToFill').length;
  const notLoaded = rejected.length;

  const warningCounts = new Map<ImportWarningCode, number>();
  prepared.warnings.forEach((w: ImportRowWarning) => warningCounts.set(w.code, (warningCounts.get(w.code) ?? 0) + 1));

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label={t(`${k}.summary.new`)} value={number(created)} icon={<UserPlus aria-hidden />} />
        <StatCard label={t(`${k}.summary.existing`)} value={number(existing)} icon={<UserCheck aria-hidden />} />
        <StatCard label={t(`${k}.summary.rejected`)} value={number(notLoaded)} icon={<XCircle aria-hidden />} className="max-sm:col-span-2" />
      </div>

      {existing > 0 && (
        <section className="flex flex-col gap-3" aria-labelledby="import-existing-title">
          <h3 id="import-existing-title" className="text-base font-semibold text-fg">
            {t(`${k}.existingTitle`, { count: existing })}
          </h3>
          <ChoiceGroup
            aria-labelledby="import-existing-title"
            columns={2}
            value={onExisting}
            onValueChange={(v) => onExistingChange(v as ImportOnExisting)}
            options={[
              {
                value: 'fillEmpty',
                title: t(`${k}.existing.fillEmpty`),
                description: fillable > 0 ? t(`${k}.existing.fillEmptyHint`, { count: fillable }) : t(`${k}.existing.fillEmptyNothing`),
              },
              {
                value: 'skip',
                title: t(`${k}.existing.skip`),
                description: t(`${k}.existing.skipHint`),
              },
            ]}
          />
        </section>
      )}

      {warningCounts.size > 0 && (
        <section className="flex flex-col gap-2 rounded-xl border border-warning/40 bg-warning-soft p-4" aria-labelledby="import-warn-title">
          <h3 id="import-warn-title" className="flex items-center gap-2 text-sm font-semibold text-fg">
            <AlertTriangle aria-hidden className="size-4 text-warning" />
            {t(`${k}.warningsTitle`)}
          </h3>
          <ul className="flex flex-col gap-1 pl-6 text-sm text-fg">
            {[...warningCounts.entries()].map(([code, count]) => (
              <li key={code}>{t(`${k}.warning.${code}`, { count })}</li>
            ))}
          </ul>
        </section>
      )}

      {notLoaded > 0 && (
        <section className="flex flex-col gap-3" aria-labelledby="import-rejected-title">
          <h3 id="import-rejected-title" className="text-base font-semibold text-fg">
            {t(`${k}.rejectedTitle`)}
          </h3>
          <ul className="flex flex-col gap-1 text-sm text-fg">
            {countByCode(rejected).map(([code, count]) => (
              <li key={code}>
                {t(`${k}.reasonCount`, {
                  reason: t(`${k}.reason.${code}`),
                  count,
                })}
              </li>
            ))}
          </ul>
          <div>
            <Button variant="outline" size="sm" leftIcon={<Download aria-hidden />} onClick={onDownloadRejected}>
              {t(`${k}.downloadRejected`)}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
