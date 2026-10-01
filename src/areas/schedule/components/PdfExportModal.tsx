'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import type { ISODate } from '@/domain/core';
import type { ScheduleRow } from '@/api/schedule';
import { spanText } from '@/areas/schedule/lib/hours';
import { buildTextPdf, downloadBlob } from '@/areas/schedule/lib/pdf';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { FormField } from '@/ui/FormField';
import { Modal } from '@/ui/Modal';
import { Select } from '@/ui/Select';

export interface PdfExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: ScheduleRow[];
  from: ISODate;
  to: ISODate;
  positions: { value: string; label: string }[];
}

/**
 * «Скачать PDF» (F-02-016, F-02-087): выбор должности — внутри окна, а не в шапке, где он выглядел фильтром таблицы
 * (ux-r5 S-7).
 */
export function PdfExportModal({ open, onOpenChange, rows, from, to, positions }: PdfExportModalProps) {
  const t = useT('schedule');
  const format = useFormat();
  const [position, setPosition] = useState('all');

  const download = () => {
    const list = rows.filter((r) => position === 'all' || r.staff.position?.ru === position);
    const positionLabel =
      position === 'all' ? t('table.exportAllPositions') : (positions.find((p) => p.value === position)?.label ?? position);
    const lines = [
      `${format.date(from, 'long')} – ${format.date(to, 'long')} · ${positionLabel}`,
      '',
      ...list.map((r) => {
        const days = r.cells
          .filter((c) => c.hours.length > 0)
          .map((c) => `${format.date(c.date, 'short')} ${spanText(c.hours)}`)
          .join('; ');
        const totals =
          r.totalDays > 0 ? t('table.totalsValue', { days: r.totalDays, hours: format.duration(r.totalMinutes) }) : t('table.totalsEmpty');
        return `${r.staff.name}: ${totals}${days ? ' — ' + days : ''}`;
      }),
    ];
    downloadBlob(buildTextPdf(t('title'), lines), `schedule-${from}-${to}.pdf`);
    onOpenChange(false);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t('pdf.title')}
      description={t('pdf.description', { from: format.date(from, 'dayMonth'), to: format.date(to, 'dayMonth') })}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('panel.cancel')}
          </Button>
          <Button leftIcon={<Download aria-hidden />} onClick={download} data-f="F-02-016 F-02-087">
            {t('pdf.download')}
          </Button>
        </div>
      }
    >
      <FormField label={t('pdf.position')}>
        <Select
          value={position}
          onValueChange={setPosition}
          options={[{ value: 'all', label: t('table.exportAllPositions') }, ...positions]}
        />
      </FormField>
    </Modal>
  );
}
