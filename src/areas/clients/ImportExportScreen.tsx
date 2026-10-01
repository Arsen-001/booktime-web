'use client';

/**
 * /biz/clients/import — «Операции с Excel»: импорт (F-04-126…129), выгрузка (F-04-130), перенос базы
 * командой (F-04-132, 🔒 вне кабинета — только описание и шаблон) и импорт/экспорт через телефонную
 * книгу мобильного приложения (F-04-133, F-04-107 — 🔒 демо, веб-кабинета там нет).
 */
import { useMemo, useState } from 'react';
import { AlertTriangle, BookUser, Check, Download, FileSpreadsheet, ShieldAlert, Upload, Users, X } from 'lucide-react';
import { exportClients, IMPORT_MAX_ROWS, listClientRows, listExportLog, listImportRuns, parseImportText, runImport } from '@/api/clients';
import { useCoreGet } from '@/api/core';
import { ApiError, useApiMutation, useApiQuery } from '@/api/request';
import { PhoneBookImportModal } from '@/areas/clients/components/PhoneBookImportModal';
import { clientsCsv } from '@/areas/clients/lib/export';
import { downloadCsv } from '@/lib/csv';
import { today } from '@/lib/date';
import { looksLikeLegacyBiff, looksLikeZip, parseXlsxBytes } from '@/areas/clients/lib/xlsx';
import { useCurrent } from '@/demo/hooks';
import { useClientsRights } from '@/areas/clients/lib/rights';
import { IMPORT_COLUMN_TARGETS, type ImportColumnTarget, type ImportRowResult } from '@/domain/clients';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';
import { Select } from '@/ui/Select';
import { SkeletonText } from '@/ui/Skeleton';
import { Textarea } from '@/ui/Textarea';
import { useToast } from '@/ui/Toast';
import { useUnsavedGuard } from '@/ui/hooks/useUnsavedGuard';
import { useFormat } from '@/i18n/useFormat';

// F-04-177: своей формы «загрузить остатки счетов» у Altegio нет (только через менеджера) — наше решение
// «сделать через импорт клиентов» (⭐, обсудить) реализовано колонкой «Balance» в этом же импорте: она
// прибавляется и к «Продано», и к «Оплачено», так что баланс счёта клиента после импорта совпадает с суммой.
const TEMPLATE_HEADER = 'Name;Phone;Additional phone;Email;Comment;Date of birth;Gender;Total spent;Total paid;Balance;Discount;Card';

type Step = 'input' | 'mapping' | 'result';

/** true, если среди байтов есть управляющие символы (кроме tab/CR/LF) — значит, это не текстовая таблица */
function hasBinaryJunk(bytes: Uint8Array): boolean {
  for (const b of bytes) {
    if (b === 0x09 || b === 0x0a || b === 0x0d) continue;
    if (b < 0x20) return true;
  }
  return false;
}

function guessTarget(header: string): ImportColumnTarget {
  const h = header.trim().toLowerCase();
  if (/^name$|имя/.test(h)) return 'name';
  if (/last ?name|фамил/.test(h)) return 'lastName';
  if (/^phone$|телефон/.test(h) && !/addit|доп/.test(h)) return 'phone';
  if (/addit|доп.*телефон/.test(h)) return 'additionalPhone';
  if (/mail/.test(h)) return 'email';
  if (/comment|коммент|примеч/.test(h)) return 'comment';
  if (/birth|рожд/.test(h)) return 'birthday';
  if (/gender|пол/.test(h)) return 'gender';
  if (/total spent|продан/.test(h)) return 'sold';
  if (/total paid|оплач/.test(h)) return 'paid';
  if (/balance|баланс|счёт|счет/.test(h)) return 'balance';
  if (/discount|скидк/.test(h)) return 'discount';
  if (/card|карт/.test(h)) return 'card';
  return 'ignore';
}

export function ImportExportScreen() {
  const t = useT('clients');
  const toast = useToast();
  const { ready, businessId, staffId } = useCurrent();
  // В журнал загрузок/выгрузок — имя сотрудника, а не id демо-персоны («owner»)
  const meQ = useCoreGet('staff', staffId ?? undefined, { enabled: ready });
  const authorName = meQ.data?.name ?? t('card.you');
  const { dateTime } = useFormat();
  // F-04-196: страница «Операции с Excel» смотрела на грубое clients.export — теперь на тонкое право
  // rights.exportList (уже включает грубое как потолок, см. lib/rights.ts); своего тонкого права
  // «импортировать» в фундаменте 26 прав нет — просьба заведена в qa/requests/clients.md.
  const rights = useClientsRights();
  const canExport = rights.exportList;

  const rowsQ = useApiQuery(['clients', 'rows-for-export', businessId], () => listClientRows(businessId ?? ''), {
    enabled: ready && Boolean(businessId),
  });
  const runsQ = useApiQuery(['clients', 'import-runs'], () => listImportRuns(), { enabled: ready });
  const exportLogQ = useApiQuery(['clients', 'export-log'], () => listExportLog(), { enabled: ready });

  // ── Импорт ──
  const [step, setStep] = useState<Step>('input');
  const [text, setText] = useState('');
  const [fileError, setFileError] = useState<string | undefined>(undefined);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<ImportColumnTarget[]>([]);
  const [results, setResults] = useState<ImportRowResult[] | null>(null);
  const [phoneBookOpen, setPhoneBookOpen] = useState(false);
  // F-04-206: способ загрузки — вставка текста или файл — идёт в журнал рядом с автором
  const [importMethod, setImportMethod] = useState<'paste' | 'file'>('paste');

  const exportM = useApiMutation(exportClients);
  const importM = useApiMutation((args: { mapping: ImportColumnTarget[]; rows: string[][]; method: 'paste' | 'file' }) =>
    runImport(businessId ?? '', authorName, args.mapping, args.rows, args.method),
  );

  const parseAndGoToMapping = (raw: string, method: 'paste' | 'file' = 'paste') => {
    setFileError(undefined);
    try {
      const sheet = parseImportText(raw);
      setHeaders(sheet.headers);
      setRows(sheet.rows);
      setMapping(sheet.headers.map(guessTarget));
      setImportMethod(method);
      setStep('mapping');
    } catch (e) {
      setFileError(xlsxErrorMessage(e));
    }
  };

  const applyParsedSheet = (sheet: { headers: string[]; rows: string[][] }) => {
    setFileError(undefined);
    setHeaders(sheet.headers);
    setRows(sheet.rows);
    setMapping(sheet.headers.map(guessTarget));
    setImportMethod('file');
    setStep('mapping');
  };

  // Текст ошибки — всегда на языке интерфейса: сообщения api («Нет данных для загрузки», «За раз можно…») написаны
  // по-русски и раньше показывались как есть на любом языке
  const xlsxErrorMessage = (e: unknown): string => {
    if (e instanceof ApiError) {
      if (e.code === 'too_many_rows') return t('importPage.import.tooManyRows', { max: IMPORT_MAX_ROWS });
      if (e.code === 'legacy_xls_unsupported') return t('importPage.import.legacyXlsUnsupported');
      if (e.code === 'empty_import') return t('importPage.import.empty');
    }
    return t('importPage.import.parseError');
  };

  const onFile = (file: File) => {
    setFileError(undefined);
    const isCsvLike = /\.(csv|txt)$/i.test(file.name);
    const isXlsxLike = /\.xlsx$/i.test(file.name);
    const isXlsLike = /\.xls$/i.test(file.name);

    if (isCsvLike) {
      const reader = new FileReader();
      reader.onload = () => parseAndGoToMapping(String(reader.result ?? ''), 'file');
      reader.onerror = () => setFileError(t('importPage.import.parseError'));
      reader.readAsText(file);
      return;
    }

    if (!isXlsxLike && !isXlsLike) {
      setFileError(t('importPage.import.binaryUnsupported'));
      return;
    }

    // .xlsx — настоящий разбор Open XML (ZIP + XML), без внешних библиотек: DecompressionStream браузера
    // распаковывает архив, DOMParser читает лист и sharedStrings.xml (F-04-126).
    // .xls — тот же разбор, если файл на самом деле сохранён как Open XML под старым расширением; иначе —
    // проверяем, не текстовая ли это таблица под чужим расширением; настоящий бинарный BIFF (Excel 97-2003)
    // без библиотеки не разобрать — честно говорим об этом, а не притворяемся.
    file
      .arrayBuffer()
      .then(async (buf) => {
        const bytes = new Uint8Array(buf);
        try {
          if (isXlsxLike || looksLikeZip(bytes)) {
            applyParsedSheet(await parseXlsxBytes(bytes));
            return;
          }
          if (looksLikeLegacyBiff(bytes)) {
            setFileError(t('importPage.import.legacyXlsUnsupported'));
            return;
          }
          const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
          // проверяем, что это не бинарный мусор под .xls: настоящий текст не содержит control-байтов
          if (hasBinaryJunk(bytes.subarray(0, 2000))) {
            setFileError(t('importPage.import.legacyXlsUnsupported'));
            return;
          }
          parseAndGoToMapping(text, 'file');
        } catch (e) {
          setFileError(xlsxErrorMessage(e));
        }
      })
      .catch(() => setFileError(t('importPage.import.parseError')));
  };

  const canSubmitMapping = mapping.includes('name') && mapping.includes('phone');
  // Таблица разобрана, но ещё не загружена (шаг сопоставления) или вставлен текст — уход по ссылке сначала спрашивает
  useUnsavedGuard(step === 'mapping' || (step === 'input' && Boolean(text.trim())));
  const [runError, setRunError] = useState<string | undefined>(undefined);

  const submitImport = async () => {
    setRunError(undefined);
    try {
      const { results: r } = await importM.mutate({ mapping, rows, method: importMethod });
      setResults(r);
      setStep('result');
      runsQ.refetch();
      rowsQ.refetch();
    } catch (e) {
      // Причина — под кнопкой, если она известна; иначе хватит тоста (тот же текст дважды не нужен)
      setRunError(e instanceof ApiError && e.code === 'too_many_rows' ? t('importPage.import.tooManyRows', { max: IMPORT_MAX_ROWS }) : undefined);
      toast.error(t('importPage.import.failed'));
    }
  };

  const reset = () => {
    setStep('input');
    setText('');
    setHeaders([]);
    setRows([]);
    setMapping([]);
    setResults(null);
    setFileError(undefined);
    setImportMethod('paste');
  };

  // ── Выгрузка ──
  const exportAll = async () => {
    if (!businessId || !rowsQ.data || rowsQ.data.length === 0) return;
    const fileName = `clients-${today()}.csv`;
    try {
      const rowsOut = await exportM.mutate({ businessId, ids: rowsQ.data.map((r) => r.id), authorName, fileName });
      downloadCsv(fileName, clientsCsv(rowsOut, t));
      toast.success(t('excel.exported', { count: rowsOut.length, file: fileName }));
    } catch {
      toast.error(t('excel.exportFailed'));
    }
  };

  const downloadTemplate = () => downloadCsv('clients-template.csv', `${TEMPLATE_HEADER}\r\n`);

  const summary = useMemo(
    () => (results ? { ok: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length } : null),
    [results],
  );

  if (rowsQ.isError) return <ErrorState onRetry={rowsQ.refetch} />;

  // F-04-196: без права раньше кнопки просто гасли (disabled) без объяснения — теперь явное «нет доступа»
  if (rights.ready && !canExport) {
    return (
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
        <PageHeader title={t('importPage.title')} />
        <div data-f="F-04-196 F-00-190">
          <EmptyState icon={<ShieldAlert aria-hidden />} title={t('importPage.noAccessTitle')} description={t('importPage.noAccessText')} />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
      <PageHeader title={t('importPage.title')} description={t('importPage.subtitle')} />

      {/* F-04-126, 127, 128, 129 */}
      <div data-f="F-04-126 F-04-127 F-04-128 F-04-129 F-04-177 F-04-085 F-07-056">
        <SectionCard title={t('importPage.import.title')} description={t('importPage.import.description')}>
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning-soft p-3 text-xs text-fg">
              <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
              <span>{t('importPage.import.doubleWarning')}</span>
            </div>

            {step === 'input' && (
              <>
                <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={t('importPage.import.pastePlaceholder')} rows={6} />
                {fileError && <p className="text-xs text-danger">{fileError}</p>}
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button leftIcon={<Upload aria-hidden />} onClick={() => text.trim() && parseAndGoToMapping(text)} disabled={!text.trim()}>
                    {t('importPage.import.loadPasted')}
                  </Button>
                  <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-border px-4 text-sm font-medium text-fg hover:bg-surface-2">
                    <FileSpreadsheet aria-hidden className="size-4" />
                    {t('importPage.import.chooseFile')}
                    <input
                      type="file"
                      accept=".csv,.xls,.xlsx,.txt"
                      className="sr-only"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) onFile(f);
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>
              </>
            )}

            {step === 'mapping' && (
              <>
                <p className="text-sm text-muted">{t('importPage.import.mapHint', { count: rows.length })}</p>
                <div className="flex flex-col gap-2 overflow-x-auto">
                  {headers.map((h, i) => (
                    <div key={i} className="flex items-center gap-3 rounded-lg border border-border p-2">
                      <span className="w-32 shrink-0 truncate text-sm font-medium text-fg" title={h}>
                        {h || t('importPage.import.column', { n: i + 1 })}
                      </span>
                      <Select
                        className="flex-1"
                        options={IMPORT_COLUMN_TARGETS.map((k) => ({ value: k, label: t(`importPage.import.field.${k}`) }))}
                        value={mapping[i]}
                        onValueChange={(v) => setMapping((m) => m.map((x, idx) => (idx === i ? (v as ImportColumnTarget) : x)))}
                      />
                    </div>
                  ))}
                </div>
                {!canSubmitMapping && <p className="text-xs text-danger">{t('importPage.import.needNamePhone')}</p>}
                {runError && <p className="text-xs text-danger">{runError}</p>}
                <div className="flex gap-2">
                  <Button variant="outline" onClick={reset}>
                    {t('importPage.import.back')}
                  </Button>
                  <Button onClick={submitImport} disabled={!canSubmitMapping} loading={importM.isPending}>
                    {t('importPage.import.loadButton')}
                  </Button>
                </div>
              </>
            )}

            {step === 'result' && results && summary && (
              <>
                <div className="flex flex-wrap gap-3">
                  <Badge tone="success" icon={<Check aria-hidden className="size-3.5" />}>
                    {t('importPage.import.okCount', { count: summary.ok })}
                  </Badge>
                  {summary.failed > 0 && (
                    <Badge tone="danger" icon={<X aria-hidden className="size-3.5" />}>
                      {t('importPage.import.failedCount', { count: summary.failed })}
                    </Badge>
                  )}
                </div>
                {summary.failed > 0 && (
                  <ul className="flex flex-col gap-1 rounded-lg border border-border p-2 text-xs text-muted">
                    {results
                      .filter((r) => !r.ok)
                      .slice(0, 20)
                      .map((r) => (
                        <li key={r.rowIndex}>
                          {t('importPage.import.rowLabel', { n: r.rowIndex + 1 })}:{' '}
                          {r.errorCode ? t(`importPage.import.rowError.${r.errorCode}`) : r.error}
                        </li>
                      ))}
                  </ul>
                )}
                <Button variant="outline" onClick={reset}>
                  {t('importPage.import.newImport')}
                </Button>
              </>
            )}
          </div>
        </SectionCard>
      </div>

      {/* F-04-130: без права «Выгружать список клиентов» пункта нет вовсе — не просто задизейблен */}
      {canExport && (
        <div data-f="F-04-130">
          <SectionCard title={t('importPage.export.title')} description={t('importPage.export.description')}>
            {rowsQ.isLoading ? (
              // Та же кнопка (неактивная), число клиентов в подписи — полосой
              <div className="flex flex-col gap-3">
                <Button leftIcon={<Download aria-hidden />} variant="outline" disabled>
                  <SkeletonText width="20ch" />
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <Button
                  leftIcon={<Download aria-hidden />}
                  variant="outline"
                  onClick={exportAll}
                  loading={exportM.isPending}
                  disabled={(rowsQ.data ?? []).length === 0}
                >
                  {t('importPage.export.button', { count: (rowsQ.data ?? []).length })}
                </Button>
                {(exportLogQ.data ?? []).length > 0 && (
                  <ul data-f="F-04-208" className="flex flex-col gap-1 text-xs text-muted">
                    {(exportLogQ.data ?? []).slice(0, 5).map((e) => (
                      <li key={e.id}>
                        {t('importPage.export.logLineByAuthor', { at: dateTime(e.at), count: e.count, author: e.authorName, method: e.method })}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {/* F-04-126 журнал операций своего раздела; F-04-206 — те же операции идут и в общий журнал
          «Операции с данными» через coreTx.logDataOperation() (core-k3 №2, g2-2) */}
      {(runsQ.isLoading || (runsQ.data ?? []).length > 0) && (
        <div data-f="F-04-206">
          <SectionCard title={t('importPage.log.title')}>
            <ul className="flex flex-col gap-1 text-xs text-muted">
              {/* Пока журнал читается — та же карточка со строкой-полосой: карточка не появляется из пустоты */}
              {runsQ.isLoading && (
                <li>
                  <SkeletonText width="48ch" />
                </li>
              )}
              {(runsQ.data ?? []).slice(0, 5).map((r) => (
                <li key={r.id}>
                  {t('importPage.log.line', {
                    at: dateTime(r.at),
                    author: r.authorName,
                    method: r.method,
                    created: r.createdCount,
                    updated: r.updatedCount,
                    rejected: r.rejectedCount,
                  })}
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>
      )}

      {/* F-04-132 — 🔒 за пределами кабинета: только описание и шаблон */}
      <div data-f="F-04-132">
        <SectionCard title={t('importPage.migration.title')} description={t('importPage.migration.description')}>
          <Button variant="ghost" leftIcon={<FileSpreadsheet aria-hidden />} onClick={downloadTemplate}>
            {t('importPage.migration.downloadTemplate')}
          </Button>
        </SectionCard>
      </div>

      {/* F-04-133, F-04-107 — 🔒 демо мобильного приложения */}
      <div data-f="F-04-133 F-04-107 F-14-105">
        <SectionCard title={t('importPage.phoneBook.sectionTitle')} description={t('importPage.phoneBook.sectionDescription')}>
          <Button variant="outline" leftIcon={<BookUser aria-hidden />} onClick={() => setPhoneBookOpen(true)}>
            {t('importPage.phoneBook.open')}
          </Button>
        </SectionCard>
      </div>

      {(rowsQ.data ?? []).length === 0 && !rowsQ.isLoading && (
        <EmptyState icon={<Users aria-hidden />} title={t('importPage.emptyBaseTitle')} description={t('importPage.emptyBaseText')} />
      )}

      {businessId && (
        <PhoneBookImportModal
          open={phoneBookOpen}
          onOpenChange={setPhoneBookOpen}
          businessId={businessId}
          existingPhones={(rowsQ.data ?? []).map((r) => r.phone)}
          onImported={() => rowsQ.refetch()}
        />
      )}
    </div>
  );
}
