'use client';

/**
 * F-12-078/079/080: кнопка «Выгрузить в Excel» у табличных отчётов. Отдаёт файл сразу (мок «Скачивание
 * в браузере» — F-12-079 ⚠️ какие выгрузки идут письмом не записано, у нас все отчётные — сразу) и пишет
 * след в журнал «Операции с данными» (F-12-074). F-12-080: предел 5000 строк — выше предела предупреждаем,
 * но всё равно отдаём файл целиком (мок; в проде — почтой/частями).
 */
import { Download } from 'lucide-react';
import { useState } from 'react';
import { useCoreList } from '@/api/core';
import { logDataExport } from '@/api/reports';
import { useApiMutation } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import type { CsvValue } from '@/lib/csv';
import { downloadCsv, toCsv } from '@/lib/csv';
import type { DataExportType } from '@/domain/reports';
import { EXPORT_ROW_LIMIT } from '@/domain/reports';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { useToast } from '@/ui/Toast';

export interface ExportExcelButtonProps {
  fileName: string;
  type: DataExportType;
  rows: readonly (readonly CsvValue[])[];
  headers: readonly string[];
  disabled?: boolean;
}

export function ExportExcelButton({ fileName, type, rows, headers, disabled }: ExportExcelButtonProps) {
  const t = useT('reports');
  const toast = useToast();
  const { businessId, staffId } = useCurrent();
  const staffQ = useCoreList('staff', { businessId: businessId ?? '' }, { enabled: Boolean(businessId) });
  const staffName = staffQ.data?.find((s) => s.id === staffId)?.name;
  const [pending, setPending] = useState(false);
  const mutation = useApiMutation(logDataExport);

  const onClick = async () => {
    if (!businessId || !staffId) return;
    setPending(true);
    try {
      const csv = toCsv(rows, headers);
      downloadCsv(fileName, csv);
      await mutation.mutate({
        businessId,
        staffId,
        staffName: staffName ?? '—',
        type,
        operation: 'browserDownload',
        fileName,
        rowCount: rows.length,
      });
      toast.success(rows.length > EXPORT_ROW_LIMIT ? t('export.exportedPartial', { limit: EXPORT_ROW_LIMIT }) : t('export.exported'));
    } finally {
      setPending(false);
    }
  };

  return (
    <Button variant="secondary" leftIcon={<Download className="size-4" aria-hidden />} onClick={onClick} loading={pending} disabled={disabled}>
      {t('export.button')}
    </Button>
  );
}
