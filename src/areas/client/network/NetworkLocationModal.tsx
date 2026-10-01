'use client';

import { useState } from 'react';
import type { Id } from '@/domain/core';
import type { NetworkLocationsInfo } from '@/domain/client';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { ChoiceCard } from '@/ui/ChoiceCard';
import { Modal } from '@/ui/Modal';

/**
 * Абонемент действует в нескольких филиалах сети — клиент выбирает, в какой записаться (F-14-039).
 * Открывается заново каждый раз (initialBusinessId — только подсказка, не сохраняется как выбор).
 */
export function NetworkLocationModal({
  open,
  onOpenChange,
  network,
  initialBusinessId,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  network: NetworkLocationsInfo;
  initialBusinessId: Id;
  onConfirm: (businessId: Id) => void;
}) {
  const t = useT('client');
  const tc = useT('common');
  const [selected, setSelected] = useState(initialBusinessId);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t('memberships.pickLocationTitle')}
      description={t('memberships.pickLocationHint', { network: network.networkName })}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tc('actions.cancel')}
          </Button>
          <Button onClick={() => onConfirm(selected)}>{t('memberships.pickLocationConfirm')}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        {network.locations.map((loc) => (
          <ChoiceCard key={loc.businessId} title={loc.name} selected={selected === loc.businessId} onClick={() => setSelected(loc.businessId)} />
        ))}
      </div>
    </Modal>
  );
}
