'use client';

/**
 * «Бизнес уходит» — необратимо: окно перечисляет последствия, даёт выгрузить данные прямо здесь и не пускает дальше,
 * пока не отмечено «данные отданы бизнесу» (раньше данные отмечались выданными молча, даже без выгрузки).
 */
import { useState } from 'react';
import { Check, DoorOpen, Download } from 'lucide-react';
import { markBusinessLeft } from '@/api/platform';
import { useApiMutation } from '@/api/request';
import { useBusinessExport } from '@/areas/platform/businesses/useBusinessExport';
import type { BusinessOverviewRow } from '@/domain/platform';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { Checkbox } from '@/ui/Checkbox';
import { Modal } from '@/ui/Modal';
import { useToast } from '@/ui/Toast';

interface LeaveBusinessDialogProps {
  row: BusinessOverviewRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LeaveBusinessDialog({ row, open, onOpenChange }: LeaveBusinessDialogProps) {
  const t = useT('platform');
  const toast = useToast();
  const exporter = useBusinessExport(row.id);
  const markLeft = useApiMutation((id: string) => markBusinessLeft(id, true));
  const [handed, setHanded] = useState(false);
  const [showError, setShowError] = useState(false);

  const close = (o: boolean) => {
    if (!o) {
      setHanded(false);
      setShowError(false);
    }
    onOpenChange(o);
  };

  const confirm = async () => {
    if (!handed) return setShowError(true);
    try {
      await markLeft.mutate(row.id);
      toast.success(t('businesses.markedLeft', { name: row.name }));
      close(false);
    } catch {
      toast.error(t('businesses.actionFailed'));
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={close}
      title={t('businesses.markLeftConfirm', { name: row.name })}
      description={t('businesses.leaveIrreversible')}
      size="md"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => close(false)}>
            {t('businesses.leaveCancel')}
          </Button>
          <Button variant="danger" leftIcon={<DoorOpen aria-hidden />} onClick={confirm} loading={markLeft.isPending}>
            {t('businesses.markLeftShort')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-base text-fg">
          <li>{t('businesses.leaveEffectCatalog')}</li>
          <li>{t('businesses.leaveEffectBooking')}</li>
          <li>{t('businesses.leaveEffectData')}</li>
        </ul>
        <div className="flex flex-col gap-3 rounded-xl bg-surface-2 p-4">
          <p className="text-sm text-muted">{t('businesses.leaveExportFirst')}</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            {(['clients', 'bookings'] as const).map((what) => (
              <Button
                key={what}
                size="sm"
                variant="outline"
                leftIcon={exporter.done.has(what) ? <Check aria-hidden /> : <Download aria-hidden />}
                onClick={() => void exporter.run(what)}
                loading={exporter.running === what}
                disabled={exporter.running !== null && exporter.running !== what}
              >
                {what === 'clients' ? t('businesses.exportClients') : t('businesses.exportBookings')}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <Checkbox
            checked={handed}
            onCheckedChange={(v) => {
              setHanded(v);
              setShowError(false);
            }}
            label={t('businesses.leaveHandedLabel')}
            aria-invalid={showError || undefined}
          />
          {showError && (
            <p role="alert" className="text-sm text-danger">
              {t('businesses.leaveHandedRequired')}
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
