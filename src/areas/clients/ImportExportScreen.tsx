'use client';

/**
 * /biz/clients/import — «Импорт и выгрузка»: перенос базы из Altegio / DIKIDI / Excel за минуту (F-04-126…129,
 * F-00-190, ⭐ 04.10.2026 — мастер импорта в components/import), выгрузка (F-04-130), журнал загрузок (F-04-206),
 * контакты телефона (F-04-133, F-04-107 — 🔒 демо мобильного приложения). Пока идёт импорт — на экране только он.
 */
import { useState } from 'react';
import { BookUser, Download, ShieldAlert } from 'lucide-react';
import { exportClients, listClientRows, listExportLog, listImportRuns } from '@/api/clients';
import { useCoreGet } from '@/api/core';
import { useApiMutation, useApiQuery } from '@/api/request';
import { ImportWizard } from '@/areas/clients/components/import/ImportWizard';
import { PhoneBookImportModal } from '@/areas/clients/components/PhoneBookImportModal';
import { clientsCsv } from '@/areas/clients/lib/export';
import { downloadCsv } from '@/lib/csv';
import { today } from '@/lib/date';
import { useCurrent } from '@/demo/hooks';
import { useClientsRights } from '@/areas/clients/lib/rights';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';
import { SkeletonText } from '@/ui/Skeleton';
import { useToast } from '@/ui/Toast';
import { useFormat } from '@/i18n/useFormat';

export function ImportExportScreen() {
  const t = useT('clients');
  const toast = useToast();
  const { ready, businessId, staffId } = useCurrent();
  // В журнал загрузок/выгрузок — имя сотрудника, а не id демо-персоны («owner»)
  const meQ = useCoreGet('staff', staffId ?? undefined, { enabled: ready });
  const authorName = meQ.data?.name ?? t('card.you');
  const { dateTime } = useFormat();
  // F-04-196: выгрузка — тонкое право rights.exportList (грубое clients.export — потолок, см. lib/rights.ts).
  // Импорт раньше тоже прятался за правом выгрузки — администратор с правом редактировать клиентов не мог загрузить
  // базу; теперь импорт — rights.editClient (сервер: clients.edit), выгрузка — exportList.
  const rights = useClientsRights();
  const canExport = rights.exportList;

  const rowsQ = useApiQuery(['clients', 'rows-for-export', businessId], () => listClientRows(businessId ?? ''), {
    enabled: ready && Boolean(businessId),
  });
  const runsQ = useApiQuery(['clients', 'import-runs'], () => listImportRuns(), { enabled: ready });
  const exportLogQ = useApiQuery(['clients', 'export-log'], () => listExportLog(), { enabled: ready });

  // Импорт — право «редактировать клиентов» (clients.edit), выгрузка — тонкое право «выгружать список»
  const canImport = rights.editClient;
  const [importBusy, setImportBusy] = useState(false);
  const [phoneBookOpen, setPhoneBookOpen] = useState(false);
  const exportM = useApiMutation(exportClients);

  // ── Выгрузка ──
  const exportAll = async () => {
    if (!businessId || !rowsQ.data || rowsQ.data.length === 0) return;
    const fileName = `clients-${today()}.csv`;
    try {
      const rowsOut = await exportM.mutate({
        businessId,
        ids: rowsQ.data.map((r) => r.id),
        authorName,
        fileName,
      });
      downloadCsv(fileName, clientsCsv(rowsOut, t));
      toast.success(t('excel.exported', { count: rowsOut.length, file: fileName }));
    } catch {
      toast.error(t('excel.exportFailed'));
    }
  };

  // Список клиентов нужен только выгрузке — его ошибка не прячет импорт
  // F-04-196: нет ни права загрузить, ни права выгрузить — явное «нет доступа», а не погасшие кнопки
  if (rights.ready && !canExport && !canImport) {
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

      {canImport && businessId && (
        <div data-f="F-04-126 F-04-127 F-04-128 F-04-129 F-04-177 F-04-085 F-07-056 F-00-190">
          <SectionCard title={t('importPage.import.title')} description={t('importPage.import.description')}>
            <ImportWizard businessId={businessId} authorName={authorName} onPhaseChange={setImportBusy} onFinished={() => runsQ.refetch()} />
          </SectionCard>
        </div>
      )}

      {/* F-04-130: без права «Выгружать список клиентов» пункта нет вовсе — не просто задизейблен */}
      {canExport && !importBusy && (
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
                  {t('importPage.export.button', {
                    count: (rowsQ.data ?? []).length,
                  })}
                </Button>
                {rowsQ.isError && <ErrorState compact onRetry={rowsQ.refetch} />}
                {(exportLogQ.data ?? []).length > 0 && (
                  <ul data-f="F-04-208" className="flex flex-col gap-1 text-xs text-muted">
                    {(exportLogQ.data ?? []).slice(0, 5).map((e) => (
                      <li key={e.id}>
                        {t('importPage.export.logLineByAuthor', {
                          at: dateTime(e.at),
                          count: e.count,
                          author: e.authorName,
                          method: e.method,
                        })}
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
      {!importBusy && (runsQ.isLoading || (runsQ.data ?? []).length > 0) && (
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
                    skipped: r.skippedCount ?? Math.max(0, r.totalRows - r.createdCount - r.updatedCount - r.rejectedCount),
                    rejected: r.rejectedCount,
                  })}
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>
      )}

      {/* F-04-133, F-04-107 — 🔒 демо мобильного приложения */}
      {canImport && !importBusy && (
        <div data-f="F-04-133 F-04-107 F-14-105">
          <SectionCard title={t('importPage.phoneBook.sectionTitle')} description={t('importPage.phoneBook.sectionDescription')}>
            <Button variant="outline" leftIcon={<BookUser aria-hidden />} onClick={() => setPhoneBookOpen(true)}>
              {t('importPage.phoneBook.open')}
            </Button>
          </SectionCard>
        </div>
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
