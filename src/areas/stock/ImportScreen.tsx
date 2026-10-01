'use client';

/**
 * /biz/stock/import — «Операции с Excel»: загрузка товаров из CSV (F-08-033), обновление существующих
 * тем же файлом (F-08-034), и подсказка о переносе каталога командой поддержки (F-08-035).
 */
import { useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, FileSpreadsheet, HelpCircle, Upload, XCircle } from 'lucide-react';
import { exportGoodsCsv, importGoodsCsv, listCategoriesFlat, type ImportGoodsRowResult } from '@/api/stock';
import { ApiError, useApiMutation, useApiQuery } from '@/api/request';
import { readTextFile, downloadCsv } from '@/lib/csv';
import { useCurrent } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { FormField } from '@/ui/FormField';
import { PageHeader } from '@/ui/PageHeader';
import { Select } from '@/ui/Select';
import { SectionCard } from '@/ui/SectionCard';
import { Skeleton } from '@/ui/Skeleton';
import { Table, type TableColumn } from '@/ui/Table';
import { useToast } from '@/ui/Toast';

export function ImportScreen() {
  const t = useT('stock');
  const router = useRouter();
  const toast = useToast();
  const searchParams = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { ready, businessId, locationId: rawLocationId, activeLocationIds } = useCurrent();
  const locationId = rawLocationId === 'all' ? activeLocationIds[0] : rawLocationId;
  const enabled = ready && Boolean(businessId) && Boolean(locationId);

  const [categoryId, setCategoryId] = useState(searchParams.get('category') ?? '');
  const [results, setResults] = useState<ImportGoodsRowResult[] | undefined>();
  const [fileName, setFileName] = useState('');

  const categoriesQ = useApiQuery(['stock', 'categoriesFlat', businessId, locationId], () => listCategoriesFlat(businessId!, locationId!), { enabled });
  const importMutation = useApiMutation((csvText: string) => importGoodsCsv(businessId!, locationId!, categoryId, csvText));

  const categoryOptions = (categoriesQ.data ?? []).map((c) => ({ value: c.id, label: c.name }));

  const onFile = async (file: File) => {
    if (!categoryId) {
      toast.error(t('import.categoryRequired'));
      return;
    }
    setFileName(file.name);
    try {
      const text = await readTextFile(file);
      const res = await importMutation.mutate(text);
      setResults(res);
      const created = res.filter((r) => r.status === 'created').length;
      const updated = res.filter((r) => r.status === 'updated').length;
      toast.success(t('import.done', { created, updated }));
    } catch (e) {
      if (e instanceof ApiError && e.code === 'too_many_rows') toast.error(t('import.tooManyRows'));
      else toast.error(t('import.failed'));
    }
  };

  const downloadTemplate = async () => {
    const csv = await exportGoodsCsv(businessId!, locationId!, categoryId || undefined);
    downloadCsv('stock-goods-template.csv', csv || 'Название;Название в чеке;Категория;Артикул;Штрихкод;Единица продажи;Единица списания;Коэффициент;Цена продажи;Себестоимость;Критичный остаток;Желаемый остаток;Бренд;Оттенок;Срок годности;Показывать клиентам');
  };

  const columns: TableColumn<ImportGoodsRowResult>[] = [
    { id: 'row', header: '#', mobile: 'meta', cell: (r) => r.row },
    { id: 'name', header: t('import.columns.name'), mobile: 'title', cell: (r) => r.name || '—' },
    {
      id: 'status',
      header: t('import.columns.status'),
      mobile: 'badge',
      cell: (r) =>
        r.status === 'skipped' ? (
          <Badge tone="danger" size="sm"><XCircle aria-hidden className="mr-1 inline size-3.5" />{r.reason || t('import.statusSkipped')}</Badge>
        ) : (
          <Badge tone="success" size="sm"><CheckCircle2 aria-hidden className="mr-1 inline size-3.5" />{r.status === 'created' ? t('import.statusCreated') : t('import.statusUpdated')}</Badge>
        ),
    },
  ];

  return (
    <div data-f="F-08-033 F-08-034 F-08-035 F-08-145" className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
      <PageHeader title={t('import.title')} description={t('import.subtitle')} actions={<Button variant="secondary" onClick={() => router.push('/biz/stock')}>{t('import.back')}</Button>} />

      {categoriesQ.isLoading ? (
        <Skeleton lines={4} />
      ) : (
        <SectionCard title={t('import.uploadTitle')}>
          <div className="flex flex-col gap-4">
            <FormField label={t('import.category')} required hint={t('import.categoryHint')}>
              <Select value={categoryId} onValueChange={setCategoryId} options={categoryOptions} placeholder={t('import.categoryPlaceholder')} />
            </FormField>
            <div className="flex flex-wrap items-center gap-2">
              <Button leftIcon={<Upload aria-hidden />} onClick={() => fileInputRef.current?.click()} loading={importMutation.isPending}>
                {t('import.chooseFile')}
              </Button>
              <Button variant="secondary" leftIcon={<FileSpreadsheet aria-hidden />} onClick={downloadTemplate} disabled={!categoryId}>
                {t('import.downloadTemplate')}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onFile(file);
                  e.target.value = '';
                }}
              />
            </div>
            {fileName && <p className="text-xs text-muted">{t('import.selectedFile', { name: fileName })}</p>}
            <p className="text-xs text-muted">{t('import.limitHint')}</p>
          </div>
        </SectionCard>
      )}

      {results && (
        results.length === 0 ? (
          <EmptyState compact title={t('import.emptyResultTitle')} />
        ) : (
          <Table columns={columns} rows={results} rowKey={(r) => String(r.row)} label={t('import.resultsTitle')} />
        )
      )}

      <SectionCard title={t('import.supportTitle')}>
        <div className="flex items-start gap-3">
          <HelpCircle aria-hidden className="mt-0.5 size-5 shrink-0 text-muted" />
          <p className="text-sm text-muted">{t('import.supportText')}</p>
        </div>
      </SectionCard>
    </div>
  );
}
