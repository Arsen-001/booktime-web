'use client';

/** Выгрузка клиентов / записей бизнеса в CSV (F-00-183): для вкладки «Копии и выгрузка» и окна «Бизнес уходит». */
import { useState } from 'react';
import { exportBusinessData } from '@/api/platform';
import { useApiMutation } from '@/api/request';
import type { ExportWhat } from '@/domain/platform';
import { useT } from '@/i18n/useT';
import { downloadCsv } from '@/lib/csv';
import { useToast } from '@/ui/Toast';

const CSV_HEADERS: Record<ExportWhat, readonly string[]> = {
  clients: ['csvClientName', 'csvClientPhone', 'csvClientGender', 'csvClientTags', 'csvClientNoShow'],
  bookings: ['csvBookingDate', 'csvBookingStatus', 'csvBookingTotal', 'csvBookingSource'],
};

export function useBusinessExport(businessId: string) {
  const t = useT('platform');
  const toast = useToast();
  const exportM = useApiMutation((a: { what: ExportWhat; headers: string[] }) => exportBusinessData(businessId, a.what, a.headers));
  // Лоадер — только на нажатой кнопке, а не на обеих
  const [running, setRunning] = useState<ExportWhat | null>(null);
  const [done, setDone] = useState<ReadonlySet<ExportWhat>>(() => new Set());

  const run = async (what: ExportWhat): Promise<boolean> => {
    setRunning(what);
    try {
      const file = await exportM.mutate({ what, headers: CSV_HEADERS[what].map((k) => t(`businesses.${k}` as 'businesses.csvClientName')) });
      downloadCsv(file.fileName, file.csv);
      setDone((prev) => new Set([...prev, what]));
      toast.success(t('businesses.exported', { n: file.rows }));
      return true;
    } catch {
      toast.error(t('businesses.exportFailed'));
      return false;
    } finally {
      setRunning(null);
    }
  };

  return { run, running, done };
}
