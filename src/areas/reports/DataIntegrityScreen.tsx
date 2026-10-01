'use client';

/**
 * Три «проверкой добавленных» функции про целостность отчётов — держим их рядом на одном экране,
 * доступном из «Все отчеты», а не заставляем владельца искать по разделам:
 *  - F-12-124: карта всех кнопок выгрузки/загрузки кабинета вне витрины отчётов — у какой кнопки какое
 *    право, где искать; ссылки ведут на настоящий экран (Excel там — уже CSV, F-12-037, как везде в разделе).
 *  - F-12-125: контрольный пример прогона — одни и те же деньги дают разные цифры в разных отчётах,
 *    и почему; готовый тест для сборки, полезен и владельцу, чтобы не считать расхождение багом.
 *  - F-12-126: что происходит с прошлыми цифрами, когда справочник (товар, услугу, тип абонемента,
 *    сотрудника, клиента) архивируют, объединяют или удаляют.
 */
import { AlertTriangle, ArrowUpRight, Database, GitMerge, ListChecks } from 'lucide-react';
import Link from 'next/link';
import { EXPORT_MAP_ENTRIES } from '@/domain/reports';
import { ReportHeader } from '@/areas/reports/components/ReportHeader';
import { useT } from '@/i18n/useT';
import { PermissionGate } from '@/ui/PermissionGate';

const RECONCILIATION_ROWS = [
  { reportKey: 'mainTotalShort', period: '26.08–24.09', amount: '4 130 ֏' },
  { reportKey: 'mainTotalLong', period: '01.09–31.10', amount: '4 340 ֏' },
  { reportKey: 'financeReport', period: '17–24.09', amount: '4 234 ֏' },
  { reportKey: 'pnl', period: 'Сен’26', amount: '4 234 ֏' },
  { reportKey: 'byStaff', period: '24.08–24.09', amount: '4 134 ֏' },
  { reportKey: 'byClients', period: '24.08–24.09', amount: '4 134 ֏' },
  { reportKey: 'byServices', period: '01.09–31.10', amount: '944.6 ֏' },
  { reportKey: 'cashDay', period: '24.09', amount: '1 134 ֏' },
  { reportKey: 'stockSalesAnalysis', period: '24.08–24.09', amount: '3 400 ֏' },
] as const;

const ARCHIVE_ROWS = ['product', 'membershipType', 'mergeServices', 'deleteService', 'deleteProduct', 'deleteCardType', 'staffFired'] as const;

export function DataIntegrityScreen() {
  const t = useT('reports');

  return (
    <PermissionGate permission="reports.view" fallback="message">
      <div className="flex flex-col gap-8">
        <ReportHeader slug="dataIntegrity" helpBody={t('dataIntegrity.help')} />

        <section data-f="F-12-124" className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 text-base font-semibold text-fg">
            <ListChecks className="size-4.5 text-muted" aria-hidden />
            {t('dataIntegrity.exportsMap.title')}
          </h2>
          <p className="text-sm text-muted">{t('dataIntegrity.exportsMap.desc')}</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {EXPORT_MAP_ENTRIES.map((e) => (
              <Link
                key={e.key}
                href={e.href ?? '#'}
                className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface p-3 text-sm shadow-xs transition-colors hover:border-border-strong/60"
              >
                <span className="min-w-0">
                  <span className="block font-medium text-fg">{t(`dataIntegrity.exportsMap.items.${e.key}.label` as never)}</span>
                  <span className="block truncate text-xs text-muted">{t(`dataIntegrity.exportsMap.items.${e.key}.where` as never)}</span>
                </span>
                <ArrowUpRight className="size-4 shrink-0 text-muted" aria-hidden />
              </Link>
            ))}
          </div>
        </section>

        <section data-f="F-12-125" className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 text-base font-semibold text-fg">
            <Database className="size-4.5 text-muted" aria-hidden />
            {t('dataIntegrity.reconciliation.title')}
          </h2>
          <p className="text-sm text-muted">{t('dataIntegrity.reconciliation.desc')}</p>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="bg-surface-2 text-left text-xs text-muted uppercase">
                <tr>
                  <th className="px-3 py-2 font-medium">{t('dataIntegrity.reconciliation.columns.report')}</th>
                  <th className="px-3 py-2 font-medium">{t('dataIntegrity.reconciliation.columns.period')}</th>
                  <th className="px-3 py-2 text-right font-medium">{t('dataIntegrity.reconciliation.columns.amount')}</th>
                </tr>
              </thead>
              <tbody>
                {RECONCILIATION_ROWS.map((r) => (
                  <tr key={`${r.reportKey}-${r.period}`} className="border-t border-border">
                    <td className="px-3 py-2 text-fg">{t(`dataIntegrity.reconciliation.items.${r.reportKey}` as never)}</td>
                    <td className="px-3 py-2 text-muted">{r.period}</td>
                    <td className="px-3 py-2 text-right font-medium text-fg">{r.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="flex items-start gap-2 text-xs text-muted">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {t('dataIntegrity.reconciliation.hint')}
          </p>
        </section>

        <section data-f="F-12-126" className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 text-base font-semibold text-fg">
            <GitMerge className="size-4.5 text-muted" aria-hidden />
            {t('dataIntegrity.archive.title')}
          </h2>
          <ul className="flex flex-col gap-2">
            {ARCHIVE_ROWS.map((k) => (
              <li key={k} className="rounded-lg border border-border bg-surface p-3 text-sm text-fg">
                <span className="font-medium">{t(`dataIntegrity.archive.items.${k}.what` as never)}</span>
                <span className="block text-muted">{t(`dataIntegrity.archive.items.${k}.effect` as never)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </PermissionGate>
  );
}
