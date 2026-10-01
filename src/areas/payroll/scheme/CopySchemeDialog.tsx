'use client';

/**
 * «Скопировать у другого сотрудника» (F-09-012) — окно выбора образца. Принадлежит разделу «payroll».
 * Копия применяется в черновике редактора: чтобы она сохранилась, нужно ещё нажать «Сохранить» (F-09-013).
 */
import { useState } from 'react';
import type { Id } from '@/domain/core';
import { getScheme, type StaffSchemeStatus } from '@/api/payroll';
import { useT } from '@/i18n/useT';
import { useLocale } from 'next-intl';
import { pickText } from '@/lib/text';
import type { LocaleCode } from '@/domain/core';
import { Button } from '@/ui/Button';
import { Combobox, type ComboboxOption } from '@/ui/Combobox';
import { Modal } from '@/ui/Modal';
import type { PayrollScheme } from '@/domain/payroll';

export interface CopySchemeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  excludeStaffId: Id;
  candidates: StaffSchemeStatus[];
  onCopied: (scheme: PayrollScheme) => void;
}

export function CopySchemeDialog({ open, onOpenChange, excludeStaffId, candidates, onCopied }: CopySchemeDialogProps) {
  const t = useT('payroll');
  const locale = useLocale();
  const [sourceId, setSourceId] = useState<Id | null>(null);
  const [pending, setPending] = useState(false);

  const options: ComboboxOption[] = candidates
    .filter((c) => c.staff.id !== excludeStaffId && c.scheme)
    .map((c) => ({ value: c.staff.id, label: c.staff.name, description: c.staff.position ? pickText(c.staff.position, locale as LocaleCode) : undefined }));

  async function apply() {
    if (!sourceId) return;
    setPending(true);
    try {
      const source = await getScheme(sourceId);
      if (source) onCopied({ ...source, staffId: excludeStaffId });
      onOpenChange(false);
      setSourceId(null);
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t('scheme.copy.title')}
      description={t('scheme.copy.description')}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('scheme.copy.cancel')}
          </Button>
          <Button onClick={apply} disabled={!sourceId} loading={pending}>
            {t('scheme.copy.confirm')}
          </Button>
        </>
      }
    >
      <div data-f="F-09-012">
        <Combobox
          options={options}
          value={sourceId}
          onValueChange={(v) => setSourceId(v)}
          placeholder={t('scheme.copy.placeholder')}
          emptyText={t('scheme.copy.empty')}
        />
      </div>
    </Modal>
  );
}
