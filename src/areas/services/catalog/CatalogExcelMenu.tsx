'use client';

/**
 * «Excel ⌄» у каталога (У11): кнопка с подписью и шевроном; прайс целиком — выгрузить и загрузить, техперерыв —
 * как раньше (F-02-063). На телефоне не показывается (У2).
 */
import { useState } from 'react';
import { FileDown, FileSpreadsheet, FileUp, Timer } from 'lucide-react';
import { useLocale } from 'next-intl';
import type { ServiceRow } from '@/api/services';
import type { ServiceCategory } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { downloadCsv, toCsv } from '@/lib/csv';
import { pickText } from '@/lib/text';
import { CATALOG_HEADER, CatalogImportSheet } from '@/areas/services/catalog/CatalogImportSheet';
import { TechBreakImportSheet, useTechBreakExport } from '@/areas/services/components/TechBreakExcel';
import { Button } from '@/ui/Button';
import { DropdownMenu } from '@/ui/DropdownMenu';
import { useToast } from '@/ui/Toast';

export function CatalogExcelMenu({ rows, categories }: { rows: ServiceRow[]; categories: ServiceCategory[] }) {
  const t = useT('services');
  const toast = useToast();
  const locale = useLocale() as 'ru' | 'en';
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [breakOpen, setBreakOpen] = useState(false);
  const exportBreaks = useTechBreakExport(
    rows.map((r) => ({
      id: r.service.id,
      name: r.service.name.ru ?? '',
      seconds: r.service.bufferAfterMin == null ? ('Default' as const) : r.service.bufferAfterMin * 60,
    })),
  );

  const exportCatalog = () => {
    const csv = toCsv(
      rows.map(({ service: s }) => [
        pickText(categories.find((c) => c.id === s.categoryId)?.name, locale),
        pickText(s.name, locale),
        s.priceMin,
        s.priceMax ?? '',
        s.durationMin,
      ]),
      CATALOG_HEADER,
    );
    downloadCsv('services-price-list.csv', csv);
    toast.success(t('catalogExcel.exported'));
  };

  return (
    <div data-f="F-02-063" className="contents">
      <DropdownMenu
        label={t('catalogExcel.button')}
        trigger={(p) => (
          <Button {...p} variant="secondary" leftIcon={<FileSpreadsheet aria-hidden />}>
            {t('catalogExcel.button')}
          </Button>
        )}
        items={[
          { id: 'g-price', groupLabel: t('catalogExcel.priceGroup') },
          {
            id: 'export',
            label: t('catalogExcel.exportAction'),
            icon: <FileDown aria-hidden />,
            onSelect: exportCatalog,
          },
          {
            id: 'import',
            label: t('catalogExcel.importAction'),
            icon: <FileUp aria-hidden />,
            onSelect: () => setCatalogOpen(true),
          },
          { id: 'g-break', groupLabel: t('techBreak.label') },
          {
            id: 'tb-export',
            label: t('techBreakExcel.exportAction'),
            icon: <Timer aria-hidden />,
            onSelect: () => void exportBreaks(),
          },
          {
            id: 'tb-import',
            label: t('techBreakExcel.importAction'),
            icon: <FileUp aria-hidden />,
            onSelect: () => setBreakOpen(true),
          },
        ]}
      />
      <CatalogImportSheet open={catalogOpen} onOpenChange={setCatalogOpen} existing={rows} />
      <TechBreakImportSheet open={breakOpen} onOpenChange={setBreakOpen} />
    </div>
  );
}
