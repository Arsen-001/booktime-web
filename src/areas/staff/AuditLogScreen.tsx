'use client';

/**
 * /biz/staff/log — «Журнал изменений» (F-10-100, F-10-101, F-10-104, F-10-105) и «Операции с данными»
 * (F-10-102, F-10-103) + «Входы» (F-10-106) в одном экране с тремя вкладками. ⭐ F-00-040: у нас полная
 * лента по каждому объекту (не «последнее действие», как у Altegio) — журнал пишут все разделы через
 * logChange()/logExport(). Право — «Журнал безопасности бизнеса» / «Экспорт данных» (settings.manage /
 * clients.export, F-10-104): без него страница не открывается вовсе (гейт в page.tsx).
 */
import { useMemo, useState } from 'react';
import { ShieldCheck, KeyRound, History as HistoryIcon, Download, Monitor, FileSpreadsheet } from 'lucide-react';
import { listDataOps } from '@/api/data-ops';
import { listChanges, listExports, listLogins, listStaffForRightsCopy } from '@/api/staff';
import { useApiQuery } from '@/api/request';
import { NoAccessState } from '@/areas/staff/components/NoAccessState';
import { useCan, useCurrent } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { useFormat } from '@/i18n/useFormat';
import { Badge } from '@/ui/Badge';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { FilterBar } from '@/ui/FilterBar';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';
import { Select } from '@/ui/Select';
import { Table, type TableColumn } from '@/ui/Table';
import { Tabs } from '@/ui/Tabs';
import { useSkeletonCount } from '@/ui/hooks/useSkeletonCount';
import { SkeletonOver } from '@/ui/Skeleton';

type LogTab = 'changes' | 'exports' | 'logins';

const ENTITY_KEYS = ['staff', 'business', 'client', 'booking', 'service', 'stockItem'] as const;
const ACTION_KEYS = ['created', 'updated', 'deleted', 'fired', 'restored'] as const;
const REPORT_KEYS = ['clients', 'bookings', 'loyaltyCards', 'memberships', 'deposits', 'certificates', 'staffReport', 'customReport'] as const;
const OPERATION_KEYS = ['fileUpload', 'excelCopy', 'emailLink', 'browserDownload'] as const;
/** Подписи «что» общего журнала операций: раздел_сущность (неизвестная пара — как есть) */
const DATA_OP_WHAT = ['clients_clients', 'services_services', 'journal_bookings', 'reports_appointments', 'reports_appointmentsImport', 'resources_groupEvents'] as const;

/** Демо пишет только дату ('YYYY-MM-DD'), сервер — местные дату и время ('YYYY-MM-DDTHH:mm') */
const atOf = (at: string) => (at.length === 10 ? `${at}T00:00` : at);

export function AuditLogScreen() {
  const t = useT('staff');
  const fmt = useFormat();
  const { businessId, ready } = useCurrent();
  const canSeeChanges = useCan('settings.manage');
  const canSeeExports = useCan('clients.export');
  const [tab, setTab] = useState<LogTab>(canSeeChanges ? 'changes' : 'exports');
  const [entity, setEntity] = useState<string>('');
  const [action, setAction] = useState<string>('');
  const [actorStaffId, setActorStaffId] = useState<string>('');
  const [reportType, setReportType] = useState<string>('');
  const [operationType, setOperationType] = useState<string>('');

  const staffOptionsQ = useApiQuery(['staff', 'log-actors', businessId], () => listStaffForRightsCopy(businessId!, ''), {
    enabled: ready && Boolean(businessId),
  });

  const changesQ = useApiQuery(
    ['staff', 'changes', businessId, entity, action, actorStaffId],
    () => listChanges({ businessId: businessId!, entity: entity || undefined, action: action || undefined, actorStaffId: actorStaffId || undefined }),
    { enabled: ready && Boolean(businessId) && tab === 'changes' && canSeeChanges },
  );

  // Скелетон «Изменений»: столько строк, сколько было в прошлый раз; в демо их нет — тогда скелетон и есть пустое
  // состояние таблицы (та же рамка и высота, текст под плашкой), а не строки, которые исчезнут
  const changesLoading = !ready || changesQ.isLoading;
  const changesRows = useSkeletonCount('auditChanges', { loading: changesLoading, count: changesQ.data?.length, fallback: 0, max: 20 });
  const changesEmptySkeleton = changesLoading && changesRows === 0;

  const exportsQ = useApiQuery(
    ['staff', 'exports', businessId, reportType, operationType, actorStaffId],
    () =>
      listExports({
        businessId: businessId!,
        reportType: (reportType || undefined) as never,
        operationType: (operationType || undefined) as never,
        actorStaffId: actorStaffId || undefined,
      }),
    { enabled: ready && Boolean(businessId) && tab === 'exports' && canSeeExports },
  );

  // Общий журнал «Операции с данными» разделов (F-02-063, F-14-114): загрузки и выгрузки Excel, массовое удаление
  const dataOpsQ = useApiQuery(['staff', 'data-ops', businessId], () => listDataOps({ businessId: businessId! }), {
    enabled: ready && Boolean(businessId) && tab === 'exports' && canSeeExports,
  });

  const loginsQ = useApiQuery(['staff', 'logins', businessId], () => listLogins(businessId!), {
    enabled: ready && Boolean(businessId) && tab === 'logins' && canSeeChanges,
  });

  const actorOptions = useMemo(
    () => [{ value: '', label: t('log.filterAllActors') }, ...(staffOptionsQ.data ?? []).map((s) => ({ value: s.id, label: s.name }))],
    [staffOptionsQ.data, t],
  );

  const changeColumns: TableColumn<NonNullable<typeof changesQ.data>[number]>[] = [
    { id: 'at', header: t('log.columns.at'), cell: (r) => fmt.dateTime(atOf(r.at)), width: '10rem' },
    { id: 'entity', header: t('log.columns.entity'), cell: (r) => <Badge tone="neutral">{r.entity}</Badge> },
    { id: 'action', header: t('log.columns.action'), cell: (r) => r.action },
    { id: 'actor', header: t('log.columns.actor'), cell: (r) => r.actorLabel, mobile: 'meta' },
  ];

  const exportColumns: TableColumn<NonNullable<typeof exportsQ.data>[number]>[] = [
    { id: 'at', header: t('log.columns.at'), cell: (r) => fmt.dateTime(atOf(r.at)), width: '10rem' },
    {
      id: 'reportType',
      header: t('log.columns.reportType'),
      cell: (r) => (
        <span>
          {t(`log.reportType.${r.reportType}` as never)}
          {r.isImport ? ` (${t('log.import')})` : ''}
        </span>
      ),
    },
    {
      id: 'operationType',
      header: t('log.columns.operationType'),
      cell: (r) => <Badge tone="neutral">{t(`log.operationType.${r.operationType}` as never)}</Badge>,
    },
    { id: 'actor', header: t('log.columns.actor'), cell: (r) => r.actorLabel, mobile: 'meta' },
  ];

  const dataOpColumns: TableColumn<NonNullable<typeof dataOpsQ.data>[number]>[] = [
    { id: 'at', header: t('log.columns.at'), cell: (r) => fmt.dateTime(atOf(r.at)), width: '10rem' },
    {
      id: 'what',
      header: t('log.dataOps.what'),
      cell: (r) => {
        const key = `${r.area}_${r.entity}`;
        return (DATA_OP_WHAT as readonly string[]).includes(key) ? t(`log.dataOps.whatLabel.${key}` as never) : r.entity;
      },
    },
    {
      id: 'kind',
      header: t('log.dataOps.kind'),
      cell: (r) => (
        <Badge tone={r.kind === 'delete' ? 'warning' : 'neutral'}>{t(`log.dataOps.kindLabel.${r.kind}` as never)}</Badge>
      ),
    },
    {
      id: 'count',
      header: t('log.dataOps.count'),
      cell: (r) => (
        <span>
          {t('log.dataOps.rows', { count: r.count })}
          {r.failed ? <span className="text-muted"> · {t('log.dataOps.failed', { count: r.failed })}</span> : null}
        </span>
      ),
      mobile: 'meta',
    },
    {
      id: 'actor',
      header: t('log.columns.actor'),
      cell: (r) => r.byName || (r.by === 'system' ? t('log.dataOps.system') : '—'),
      mobile: 'meta',
    },
  ];

  const loginColumns: TableColumn<NonNullable<typeof loginsQ.data>[number]>[] = [
    { id: 'at', header: t('log.columns.at'), cell: (r) => fmt.dateTime(atOf(r.at)), width: '10rem' },
    { id: 'staffLabel', header: t('log.columns.staff'), cell: (r) => r.staffLabel },
    { id: 'device', header: t('log.columns.device'), cell: (r) => r.device, mobile: 'meta' },
    { id: 'ip', header: t('log.columns.ip'), cell: (r) => r.ip, mobile: 'meta' },
    {
      id: 'newDevice',
      header: '',
      cell: (r) =>
        r.newDevice ? (
          <Badge tone="warning" size="sm">
            {t('log.newDevice')}
          </Badge>
        ) : null,
    },
  ];

  if (!canSeeChanges && !canSeeExports) {
    return <NoAccessState />;
  }

  return (
    <div className="flex flex-col gap-6" data-f="F-10-104">
      <PageHeader
        title={t('log.title')}
        description={t('log.subtitle')}
        meta={
          <p className="flex items-start gap-1.5 text-sm text-muted" data-f="F-10-107">
            <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-primary-text" />
            {t('log.securityTip')}
          </p>
        }
      />

      <Tabs
        data-f="F-10-100 F-10-102 F-10-106 F-08-139 F-08-140"
        items={[
          ...(canSeeChanges ? [{ value: 'changes', label: t('log.tabs.changes'), icon: <HistoryIcon aria-hidden /> }] : []),
          ...(canSeeExports ? [{ value: 'exports', label: t('log.tabs.exports'), icon: <Download aria-hidden /> }] : []),
          ...(canSeeChanges ? [{ value: 'logins', label: t('log.tabs.logins'), icon: <Monitor aria-hidden /> }] : []),
        ]}
        value={tab}
        onValueChange={(v) => setTab(v as LogTab)}
      />

      {tab === 'changes' && canSeeChanges && (
        <div data-f="F-10-100 F-10-101 F-10-105 F-01-097" className="flex flex-col gap-4">
          <FilterBar
            activeCount={[entity, action, actorStaffId].filter(Boolean).length}
            onReset={() => {
              setEntity('');
              setAction('');
              setActorStaffId('');
            }}
            filters={[
              {
                id: 'entity',
                label: t('log.filters.entity'),
                node: (
                  <Select
                    value={entity}
                    onValueChange={setEntity}
                    placeholder={t('log.filterAllEntities')}
                    options={[
                      { value: '', label: t('log.filterAllEntities') },
                      ...ENTITY_KEYS.map((k) => ({ value: k, label: t(`log.entity.${k}` as never) })),
                    ]}
                  />
                ),
              },
              {
                id: 'action',
                label: t('log.filters.action'),
                node: (
                  <Select
                    value={action}
                    onValueChange={setAction}
                    placeholder={t('log.filterAllActions')}
                    options={[
                      { value: '', label: t('log.filterAllActions') },
                      ...ACTION_KEYS.map((k) => ({ value: k, label: t(`log.action.${k}` as never) })),
                    ]}
                  />
                ),
              },
              {
                id: 'actor',
                label: t('log.filters.actor'),
                node: <Select value={actorStaffId} onValueChange={setActorStaffId} options={actorOptions} searchable />,
              },
            ]}
          />
          {changesQ.isError ? (
            <ErrorState onRetry={changesQ.refetch} />
          ) : (
            <SectionCard title={t('log.tabs.changes')} padding="none">
              <Table
                columns={changeColumns}
                rows={changesQ.data ?? []}
                rowKey={(r) => r.id}
                loading={changesLoading && !changesEmptySkeleton}
                loadingRows={changesRows || undefined}
                empty={
                  changesEmptySkeleton ? (
                    <EmptyState variant="section" icon={<HistoryIcon aria-hidden />} title={<SkeletonOver>{t('log.emptyChanges')}</SkeletonOver>} />
                  ) : (
                  <EmptyState
                    variant="section"
                    kind={entity || action || actorStaffId ? 'search' : undefined}
                    icon={<HistoryIcon aria-hidden />}
                    title={t('log.emptyChanges')}
                    onReset={
                      entity || action || actorStaffId
                        ? () => {
                            setEntity('');
                            setAction('');
                            setActorStaffId('');
                          }
                        : undefined
                    }
                  />
                  )
                }
              />
            </SectionCard>
          )}
          <p className="text-xs text-muted">{t('log.changesHint')}</p>
        </div>
      )}

      {tab === 'exports' && canSeeExports && (
        <div data-f="F-10-102 F-10-103 F-10-104" className="flex flex-col gap-4">
          <FilterBar
            activeCount={[reportType, operationType, actorStaffId].filter(Boolean).length}
            onReset={() => {
              setReportType('');
              setOperationType('');
              setActorStaffId('');
            }}
            filters={[
              {
                id: 'reportType',
                label: t('log.filters.reportType'),
                node: (
                  <Select
                    value={reportType}
                    onValueChange={setReportType}
                    placeholder={t('log.filterAllReports')}
                    options={[
                      { value: '', label: t('log.filterAllReports') },
                      ...REPORT_KEYS.map((k) => ({ value: k, label: t(`log.reportType.${k}` as never) })),
                    ]}
                  />
                ),
              },
              {
                id: 'operationType',
                label: t('log.filters.operationType'),
                node: (
                  <Select
                    value={operationType}
                    onValueChange={setOperationType}
                    placeholder={t('log.filterAllOperations')}
                    options={[
                      { value: '', label: t('log.filterAllOperations') },
                      ...OPERATION_KEYS.map((k) => ({ value: k, label: t(`log.operationType.${k}` as never) })),
                    ]}
                  />
                ),
              },
              {
                id: 'actor',
                label: t('log.filters.actor'),
                node: <Select value={actorStaffId} onValueChange={setActorStaffId} options={actorOptions} searchable />,
              },
            ]}
          />
          {exportsQ.isError ? (
            <ErrorState onRetry={exportsQ.refetch} />
          ) : (
            <SectionCard title={t('log.tabs.exports')} padding="none">
              <Table
                columns={exportColumns}
                rows={exportsQ.data ?? []}
                rowKey={(r) => r.id}
                loading={exportsQ.isLoading}
                empty={
                  <EmptyState
                    variant="section"
                    icon={<Download aria-hidden />}
                    title={t('log.emptyExports')}
                    description={t('log.emptyExportsHint')}
                  />
                }
              />
            </SectionCard>
          )}
          {/* Общий журнал разделов: что загружали, выгружали и удаляли массово — с сервера в режиме api */}
          <div data-f="F-02-063 F-14-114">
            {dataOpsQ.isError ? (
              <ErrorState onRetry={dataOpsQ.refetch} />
            ) : (
              <SectionCard title={t('log.dataOps.title')} description={t('log.dataOps.subtitle')} padding="none">
                <Table
                  columns={dataOpColumns}
                  rows={dataOpsQ.data ?? []}
                  rowKey={(r) => r.id}
                  loading={dataOpsQ.isLoading}
                  empty={<EmptyState variant="section" icon={<FileSpreadsheet aria-hidden />} title={t('log.dataOps.empty')} />}
                />
              </SectionCard>
            )}
          </div>
          <p className="text-xs text-muted">{t('log.exportsHint')}</p>
        </div>
      )}

      {tab === 'logins' && canSeeChanges && (
        <div data-f="F-10-106" className="flex flex-col gap-4">
          {loginsQ.isError ? (
            <ErrorState onRetry={loginsQ.refetch} />
          ) : (
            // Скелетон — та же карточка с таблицей (строки таблицы в своей разметке)
            <SectionCard title={t('log.tabs.logins')} padding="none">
              <Table
                columns={loginColumns}
                rows={loginsQ.data ?? []}
                rowKey={(r) => r.id}
                loading={loginsQ.isLoading}
                empty={<EmptyState variant="section" icon={<KeyRound aria-hidden />} title={t('log.emptyLogins')} />}
              />
            </SectionCard>
          )}
          <p className="text-xs text-muted">{t('log.loginsHint')}</p>
        </div>
      )}
    </div>
  );
}
