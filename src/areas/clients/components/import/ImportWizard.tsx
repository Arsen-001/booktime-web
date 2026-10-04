'use client';

/**
 * Импорт клиентской базы за минуту (F-04-126…129, F-00-190; ⭐ 04.10.2026): файл → колонки → проверка → загрузка.
 *   1. Файл .xlsx/.csv или вставка; узнаём выгрузку Altegio / DIKIDI по колонкам.
 *   2. Колонки подобраны сами, рядом — как первые клиенты лягут в базу.
 *   3. Пробный прогон на сервере (без записи): новые, уже в базе («дополнить пустые поля» / «пропустить»), отказы.
 *   4. Загрузка пачками с прогрессом (обрыв связи — «Продолжить», повтор не создаёт дублей), итог и файл отказов.
 */
import { useMemo, useRef, useState } from 'react';
import { CheckCircle2, Download, PauseCircle, RotateCcw, Users } from 'lucide-react';
import { importClientsBatch } from '@/api/clients';
import { HttpApiError } from '@/api/http';
import { ApiError } from '@/api/request';
import {
  chunkImport,
  detectImportPreset,
  importBatchSize,
  prepareImport,
  suggestImportMapping,
  type ImportBatchRowResult,
  type ImportColumnTarget,
  type ImportOnExisting,
  type ImportPreset,
  type ImportVisitStats,
} from '@/domain/clients';
import type { Id } from '@/domain/core';
import { ImportCheckStep, ImportProgressBar } from '@/areas/clients/components/import/ImportCheckStep';
import { ImportHelp } from '@/areas/clients/components/import/ImportHelp';
import { ImportMappingStep } from '@/areas/clients/components/import/ImportMappingStep';
import { ImportSourceStep } from '@/areas/clients/components/import/ImportSourceStep';
import type { ImportSheet } from '@/areas/clients/lib/importFile';
import { rejectedCsv, rejectedLines, totalsOf, type RejectedLine } from '@/areas/clients/lib/importReport';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { downloadCsv } from '@/lib/csv';
import { today } from '@/lib/date';
import { Button, LinkButton } from '@/ui/Button';
import { StatCard } from '@/ui/StatCard';
import { Stepper } from '@/ui/Stepper';
import { StickyActionBar } from '@/ui/StickyActionBar';
import { useToast } from '@/ui/Toast';
import { useUnsavedGuard } from '@/ui/hooks/useUnsavedGuard';

type Phase = 'source' | 'mapping' | 'check' | 'running' | 'result';

export interface ImportWizardProps {
  businessId: Id;
  authorName: string;
  /** Шаг сменился: экран прячет второстепенные блоки, пока идёт импорт */
  onPhaseChange?: (busy: boolean) => void;
  /** Загрузка закончилась — перечитать журнал загрузок */
  onFinished?: () => void;
}

const PREVIEW_ROWS = 3;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function ImportWizard({ businessId, authorName, onPhaseChange, onFinished }: ImportWizardProps) {
  const t = useT('clients');
  const toast = useToast();
  const { date, number } = useFormat();
  const k = 'importPage.import';

  const [phase, setPhaseState] = useState<Phase>('source');
  const [sheet, setSheet] = useState<ImportSheet | null>(null);
  const [method, setMethod] = useState<'paste' | 'file'>('file');
  const [preset, setPreset] = useState<ImportPreset>('generic');
  const [mapping, setMapping] = useState<ImportColumnTarget[]>([]);
  const [onExisting, setOnExisting] = useState<ImportOnExisting>('fillEmpty');

  const [dry, setDry] = useState<ImportBatchRowResult[] | null>(null);
  const [checkProgress, setCheckProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [checkFailed, setCheckFailed] = useState(false);
  const checkToken = useRef(0);

  const [runResults, setRunResults] = useState<ImportBatchRowResult[]>([]);
  const [runProgress, setRunProgress] = useState({ done: 0, total: 0 });
  const [paused, setPaused] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [stopped, setStopped] = useState(false);
  const stopRef = useRef(false);
  const runIdRef = useRef<string | undefined>(undefined);
  const nextBatchRef = useRef(0);

  const setPhase = (p: Phase) => {
    setPhaseState(p);
    onPhaseChange?.(p !== 'source');
  };

  useUnsavedGuard(phase === 'mapping' || phase === 'check' || phase === 'running');

  // Визиты из прошлой системы своего поля в карточке не имеют — ложатся строкой в комментарий на языке интерфейса
  const statsNote = (s: ImportVisitStats) => {
    const parts = [
      s.visits ? t(`${k}.stats.visits`, { count: s.visits }) : '',
      s.firstVisit ? t(`${k}.stats.first`, { date: date(s.firstVisit, 'long') }) : '',
      s.lastVisit ? t(`${k}.stats.last`, { date: date(s.lastVisit, 'long') }) : '',
    ].filter(Boolean);
    return t(`${k}.stats.line`, { details: parts.join(', ') });
  };

  const prepared = useMemo(
    () => (sheet && mapping.includes('phone') ? prepareImport(sheet.rows, mapping, { statsNote }) : { ready: [], rejected: [], warnings: [] }),
    // statsNote зависит только от языка (t/date) — пересчёт по таблице и сопоставлению
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sheet, mapping, t],
  );
  const batches = useMemo(() => chunkImport(prepared.ready, importBatchSize(prepared.ready.length)), [prepared]);

  // ── шаг 1 → 2 ──
  const onParsed = (s: ImportSheet, m: 'paste' | 'file') => {
    setSheet(s);
    setMethod(m);
    setPreset(detectImportPreset(s.headers));
    setMapping(suggestImportMapping(s.headers));
    setPhase('mapping');
  };

  // ── шаг 3: пробный прогон ──
  const runCheck = async () => {
    const token = ++checkToken.current;
    setDry(null);
    setCheckFailed(false);
    setCheckProgress({ done: 0, total: prepared.ready.length });
    const out: ImportBatchRowResult[] = [];
    try {
      for (const batch of batches) {
        const res = await importClientsBatch(businessId, {
          rows: batch,
          onExisting: 'fillEmpty',
          dryRun: true,
          authorName,
          method,
        });
        if (token !== checkToken.current) return;
        out.push(...res.results);
        setCheckProgress({ done: out.length, total: prepared.ready.length });
      }
      setDry(out);
    } catch {
      if (token === checkToken.current) setCheckFailed(true);
    }
  };

  const goCheck = () => {
    setPhase('check');
    void runCheck();
  };

  const back = () => {
    checkToken.current++;
    if (phase === 'check') setPhase('mapping');
    else reset();
  };

  // ── шаг 4: загрузка пачками ──
  const runFrom = async (start: number) => {
    setPaused(false);
    for (let b = start; b < batches.length; b++) {
      if (stopRef.current) {
        finish(true);
        return;
      }
      for (let attempt = 1; ; attempt++) {
        try {
          const res = await importClientsBatch(businessId, {
            rows: batches[b],
            onExisting,
            runId: runIdRef.current,
            authorName,
            method,
            rejectedBeforeSend: runIdRef.current ? undefined : prepared.rejected.length,
            final: b === batches.length - 1,
          });
          runIdRef.current = res.runId ?? runIdRef.current;
          nextBatchRef.current = b + 1;
          setRunResults((prev) => [...prev, ...res.results]);
          setRunProgress((p) => ({
            ...p,
            done: Math.min(p.total, p.done + batches[b].length),
          }));
          break;
        } catch (e) {
          // Нет права или сервер не принял данные — повтор не поможет; связь и «слишком часто» — до трёх попыток
          // (с паузой, которую просит сервер), дальше «Продолжить» — повтор пачки не создаёт дублей
          const status = e instanceof HttpApiError ? e.status : 0;
          const fatal = (status >= 400 && status < 500 && status !== 408 && status !== 429) || (e instanceof ApiError && e.code === 'forbidden');
          if (fatal || attempt >= 3) {
            setPaused(true);
            if (fatal) toast.error(t(`${k}.failed`));
            return;
          }
          const retryAfter = e instanceof HttpApiError && e.retryAfter ? Math.min(e.retryAfter, 30) * 1000 : 0;
          await sleep(Math.max(retryAfter, 700 * attempt));
        }
      }
    }
    finish(false);
  };

  const startImport = () => {
    stopRef.current = false;
    runIdRef.current = undefined;
    nextBatchRef.current = 0;
    setStopping(false);
    setStopped(false);
    setRunResults([]);
    setRunProgress({ done: 0, total: prepared.ready.length });
    setPhase('running');
    void runFrom(0);
  };

  const finish = (wasStopped: boolean) => {
    setStopped(wasStopped);
    setStopping(false);
    setPhase('result');
    onFinished?.();
  };

  const reset = () => {
    checkToken.current++;
    setSheet(null);
    setMapping([]);
    setDry(null);
    setRunResults([]);
    setPaused(false);
    setPhase('source');
  };

  // ── отказы и файл с ними ──
  const reasonText = (l: RejectedLine) =>
    l.code === 'duplicateInFile' && l.duplicateOf !== undefined ? t(`${k}.duplicateOf`, { n: l.duplicateOf + 2 }) : t(`${k}.reason.${l.code}`);
  const checkRejected = useMemo(
    () =>
      rejectedLines(
        prepared.rejected,
        (dry ?? []).filter((r) => r.status === 'error'),
        false,
      ),
    [prepared.rejected, dry],
  );
  const resultRejected = useMemo(() => rejectedLines(prepared.rejected, runResults, false), [prepared.rejected, runResults]);
  const downloadRejected = (lines: RejectedLine[]) => {
    if (!sheet) return;
    downloadCsv(
      `booktime-import-errors-${today()}.csv`,
      rejectedCsv({
        headers: sheet.headers,
        rows: sheet.rows,
        lines,
        lineLabel: t(`${k}.lineColumn`),
        reasonLabel: t(`${k}.reasonColumn`),
        reasonText,
      }),
    );
  };

  const willCreate = (dry ?? []).filter((r) => r.status === 'created').length;
  const willFill = onExisting === 'fillEmpty' ? (dry ?? []).filter((r) => r.status === 'updated').length : 0;
  const toLoad = willCreate + willFill;
  const totals = totalsOf(runResults, prepared.rejected.length);

  const stepIndex = phase === 'source' ? 0 : phase === 'mapping' ? 1 : 2;
  const steps = [
    { id: 'file', label: t(`${k}.steps.file`) },
    { id: 'columns', label: t(`${k}.steps.columns`) },
    { id: 'check', label: t(`${k}.steps.check`) },
  ];

  return (
    <div className="flex flex-col gap-6">
      {(phase === 'source' || phase === 'mapping' || phase === 'check') && <Stepper steps={steps} current={stepIndex} />}

      {phase === 'source' && (
        <>
          <ImportSourceStep onParsed={onParsed} />
          <ImportHelp />
        </>
      )}

      {phase === 'mapping' && sheet && (
        <>
          <ImportMappingStep
            sheet={sheet}
            preset={preset}
            method={method}
            mapping={mapping}
            onMappingChange={setMapping}
            preview={prepared.ready.slice(0, PREVIEW_ROWS)}
            readyCount={prepared.ready.length}
          />
          <StickyActionBar>
            <Button variant="outline" onClick={back}>
              {t(`${k}.back`)}
            </Button>
            <Button onClick={goCheck} disabled={!mapping.includes('phone') || prepared.ready.length === 0}>
              {t(`${k}.toCheck`, { count: prepared.ready.length })}
            </Button>
          </StickyActionBar>
        </>
      )}

      {phase === 'check' && (
        <>
          <ImportCheckStep
            prepared={prepared}
            dry={dry}
            progress={checkProgress}
            failed={checkFailed}
            onRetry={() => void runCheck()}
            onExisting={onExisting}
            onExistingChange={setOnExisting}
            rejected={checkRejected}
            onDownloadRejected={() => downloadRejected(checkRejected)}
          />
          {dry && toLoad === 0 && <p className="text-sm text-muted">{t(`${k}.nothingToImport`)}</p>}
          <StickyActionBar>
            <Button variant="outline" onClick={back}>
              {t(`${k}.back`)}
            </Button>
            <Button onClick={startImport} disabled={!dry || toLoad === 0}>
              {dry ? t(`${k}.start`, { count: toLoad }) : t(`${k}.startPending`)}
            </Button>
          </StickyActionBar>
        </>
      )}

      {phase === 'running' && (
        <div className="flex flex-col gap-5 py-2" aria-live="polite">
          <h3 className="text-lg font-semibold text-fg">{t(`${k}.running.title`)}</h3>
          <ImportProgressBar
            done={runProgress.done}
            total={runProgress.total}
            label={t(`${k}.running.progress`, {
              done: number(runProgress.done),
              total: number(runProgress.total),
            })}
          />
          {paused ? (
            <div className="flex flex-col gap-3 rounded-xl border border-warning/40 bg-warning-soft p-4">
              <p className="flex items-start gap-2 text-sm text-fg">
                <PauseCircle aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
                {t(`${k}.running.paused`, {
                  done: number(runProgress.done),
                  total: number(runProgress.total),
                })}
              </p>
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <Button variant="ghost" onClick={() => finish(true)}>
                  {t(`${k}.running.stop`)}
                </Button>
                <Button leftIcon={<RotateCcw aria-hidden />} onClick={() => void runFrom(nextBatchRef.current)}>
                  {t(`${k}.running.resume`)}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted">{stopping ? t(`${k}.running.stopping`) : t(`${k}.running.keepOpen`)}</p>
              <Button
                variant="ghost"
                disabled={stopping}
                onClick={() => {
                  stopRef.current = true;
                  setStopping(true);
                }}
              >
                {t(`${k}.running.stop`)}
              </Button>
            </div>
          )}
        </div>
      )}

      {phase === 'result' && (
        <div className="flex flex-col gap-6" aria-live="polite">
          <div className="flex items-start gap-3">
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
              <CheckCircle2 aria-hidden className="size-5" />
            </span>
            <div className="flex flex-col gap-1">
              <h3 className="text-lg font-semibold text-fg">{stopped ? t(`${k}.result.stoppedTitle`) : t(`${k}.result.title`)}</h3>
              <p className="text-sm text-muted">
                {t(`${k}.result.subtitle`, {
                  count: totals.created + totals.updated,
                })}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label={t(`${k}.result.created`)} value={number(totals.created)} />
            <StatCard label={t(`${k}.result.updated`)} value={number(totals.updated)} />
            <StatCard label={t(`${k}.result.skipped`)} value={number(totals.skipped)} />
            <StatCard label={t(`${k}.result.errors`)} value={number(totals.errors)} />
          </div>
          {resultRejected.length > 0 && (
            <div>
              <Button variant="outline" leftIcon={<Download aria-hidden />} onClick={() => downloadRejected(resultRejected)}>
                {t(`${k}.downloadRejected`)}
              </Button>
            </div>
          )}
          <StickyActionBar>
            <Button variant="outline" onClick={reset}>
              {t(`${k}.result.again`)}
            </Button>
            <LinkButton href="/biz/clients" leftIcon={<Users aria-hidden />}>
              {t(`${k}.result.openBase`)}
            </LinkButton>
          </StickyActionBar>
        </div>
      )}
    </div>
  );
}
