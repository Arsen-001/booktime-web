'use client';

/**
 * Н10 (настройки-ревью 27.09.2026): «Удалить бизнес / филиал» — сначала выбрать ЧТО (весь бизнес или один
 * филиал), увидеть последствия и только потом отправить заявку. Удаляет поддержка (F-15-096), мгновенно ничего
 * не пропадает — это сказано прямо в окне.
 */
import { useState } from 'react';
import { AlertTriangle, Building2, MapPin } from 'lucide-react';
import type { Id } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { ChoiceGroup } from '@/ui/ChoiceGroup';
import { Modal } from '@/ui/Modal';

export interface BusinessDeleteTarget {
  kind: 'business' | 'location';
  locationId?: Id;
  label: string;
}

export interface BusinessDeleteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessName: string;
  locations: { id: Id; name: string }[];
  pending: boolean;
  onConfirm: (target: BusinessDeleteTarget) => void;
}

export function BusinessDeleteModal({ open, onOpenChange, businessName, locations, pending, onConfirm }: BusinessDeleteModalProps) {
  const t = useT('settings');
  const [choice, setChoice] = useState<string>('business');

  const location = locations.find((l) => `location:${l.id}` === choice);
  const target: BusinessDeleteTarget = location
    ? { kind: 'location', locationId: location.id, label: location.name }
    : { kind: 'business', label: businessName };

  const options = [
    {
      value: 'business',
      title: t('account.management.deleteWhatBusiness', { name: businessName }),
      description: t('account.management.deleteWhatBusinessHint'),
      icon: <Building2 aria-hidden />,
    },
    ...(locations.length > 1
      ? locations.map((l) => ({
          value: `location:${l.id}`,
          title: t('account.management.deleteWhatLocation', { name: l.name }),
          description: t('account.management.deleteWhatLocationHint'),
          icon: <MapPin aria-hidden />,
        }))
      : []),
  ];

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t('account.management.businessDeleteConfirmTitle')}
      description={t('account.management.deleteWhatLabel')}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('account.management.deleteKeep')}
          </Button>
          <Button variant="danger" loading={pending} onClick={() => onConfirm(target)}>
            {t('account.management.businessDeleteConfirmButton')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <ChoiceGroup aria-label={t('account.management.deleteWhatLabel')} options={options} value={choice} onValueChange={setChoice} columns={1} />
        <div className="flex items-start gap-2.5 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
          <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
          <p>
            {target.kind === 'business'
              ? t('account.management.deleteConsequenceBusiness', { name: target.label })
              : t('account.management.deleteConsequenceLocation', { name: target.label })}
          </p>
        </div>
        <p className="text-sm text-muted">{t('account.management.businessDeleteConfirmText')}</p>
      </div>
    </Modal>
  );
}
