'use client';

/**
 * «Импорт» (файл JSON от сборщиков данных: массив мест в snake_case) и «Скачать CSV» (места с текущими фильтрами).
 * Импорт дополняет базу: известное по «имя|адрес» обновляет, новое добавляет — итог в тосте.
 */
import { useRef } from 'react';
import { Download, FileUp } from 'lucide-react';
import { exportProspects, importProspects } from '@/api/platform';
import { useApiMutation } from '@/api/request';
import type { ProspectFilter, ProspectSort } from '@/domain/platform';
import { useT } from '@/i18n/useT';
import { downloadCsv, readTextFile } from '@/lib/csv';
import { Button } from '@/ui/Button';
import { useToast } from '@/ui/Toast';

/** JSON-массив или { items: [...] } / { prospects: [...] } — что угодно другое не похоже на список мест */
function rowsOf(json: unknown): unknown[] | null {
  if (Array.isArray(json)) return json;
  if (json && typeof json === 'object') {
    const o = json as Record<string, unknown>;
    const list = o.items ?? o.prospects ?? o.places;
    if (Array.isArray(list)) return list;
  }
  return null;
}

export function ProspectsActions({ filter, importOnly = false }: { filter: ProspectFilter & { sort?: ProspectSort }; importOnly?: boolean }) {
  const t = useT('platform');
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const importM = useApiMutation(importProspects);
  const exportM = useApiMutation(exportProspects);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    let rows: unknown[] | null = null;
    try {
      rows = rowsOf(JSON.parse(await readTextFile(file)));
    } catch {
      rows = null;
    }
    if (!rows) return toast.error(t('prospects.importBadFile'));
    try {
      const r = await importM.mutate(rows);
      toast.success(t('prospects.importDone', { added: r.added, updated: r.updated, unchanged: r.unchanged, skipped: r.skipped }));
    } catch {
      toast.error(t('prospects.importFailed'));
    }
  };

  const onExport = async () => {
    try {
      const file = await exportM.mutate(filter);
      downloadCsv(file.fileName, file.csv);
      toast.success(t('prospects.exportDone', { n: file.rows }));
    } catch {
      toast.error(t('prospects.exportFailed'));
    }
  };

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          void onFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <Button variant="outline" leftIcon={<FileUp aria-hidden />} loading={importM.isPending} onClick={() => fileRef.current?.click()}>
        {t('prospects.import')}
      </Button>
      {!importOnly && (
        <Button variant="ghost" leftIcon={<Download aria-hidden />} loading={exportM.isPending} onClick={onExport}>
          {t('prospects.export')}
        </Button>
      )}
    </>
  );
}
