'use client';

/**
 * Вклад «loyalty» в карточку услуги (хост «serviceCard»): F-06-127 «Автоматическое списание с
 * абонементов» — расширенная настройка услуги. Пока хозяин (services) не построил сам хост, вклад
 * смотрим на /dev/ext/serviceCard/loyalty; своя настройка живёт в срезе раздела по serviceId (F-06-127
 * прямо говорит, что такого поля у АБОНЕМЕНТА нет — оно именно в услуге).
 */
import { useState } from 'react';
import { getOnlineRequireMembership, getServiceAutoCharge, setOnlineRequireMembership, setServiceAutoCharge } from '@/api/loyalty';
import { useApiMutation, useApiQuery } from '@/api/request';
import type { Id } from '@/domain/core';
import type { ServiceCardExtProps } from '@/extensions/types';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { Switch } from '@/ui/Switch';
import { useToast } from '@/ui/Toast';

export default function LoyaltyServiceCard({ businessId, serviceId }: ServiceCardExtProps) {
  const t = useT('loyalty');
  const q = useApiQuery(['loyalty', 'serviceAutoCharge', businessId, serviceId], () => getServiceAutoCharge(businessId, serviceId ?? ''), { enabled: Boolean(serviceId) });
  const requireQ = useApiQuery(['loyalty', 'onlineRequireMembership', businessId, serviceId], () => getOnlineRequireMembership(businessId, serviceId ?? ''), {
    enabled: Boolean(serviceId),
  });

  if (!serviceId) return <EmptyState compact title={t('autoCharge.needsSavedService')} />;
  if (q.isError || requireQ.isError) return <EmptyState compact title={t('autoCharge.saveFailed')} />;
  if (q.isLoading || !q.data || requireQ.isLoading || requireQ.data === undefined) {
    // Загрузка — те же два тумблера с подписями (выключены), между ними линия: пришли настройки — ничего не сдвинулось
    return (
      <div className="flex flex-col gap-4" aria-busy>
        <Switch checked={false} disabled label={t('autoCharge.title')} description={t('autoCharge.description')} />
        <hr className="border-border" />
        <Switch checked={false} disabled label={t('onlineRequireMembership.title')} description={t('onlineRequireMembership.description')} />
      </div>
    );
  }

  return <LoyaltyServiceCardBody businessId={businessId} serviceId={serviceId} initial={q.data} initialRequireMembership={requireQ.data} />;
}

/** F-06-128: «Онлайн-запись только по абонементу» — тумблер вкладки «Онлайн-запись» услуги */
function OnlineRequireMembershipToggle({ businessId, serviceId, initial }: { businessId: Id; serviceId: Id; initial: boolean }) {
  const t = useT('loyalty');
  const toast = useToast();
  const [value, setValue] = useState(initial);
  const mutation = useApiMutation((v: boolean) => setOnlineRequireMembership(businessId, serviceId, v));

  return (
    <Switch
      data-f="F-06-128"
      checked={value}
      onCheckedChange={async (v) => {
        setValue(v);
        try {
          await mutation.mutate(v);
          toast.success(t('onlineRequireMembership.saved'));
        } catch {
          setValue(!v);
          toast.error(t('autoCharge.saveFailed'));
        }
      }}
      label={t('onlineRequireMembership.title')}
      description={t('onlineRequireMembership.description')}
    />
  );
}

function LoyaltyServiceCardBody({
  businessId,
  serviceId,
  initial,
  initialRequireMembership,
}: {
  businessId: Id;
  serviceId: Id;
  initial: { enabled: boolean; freeCancelHours: number };
  initialRequireMembership: boolean;
}) {
  const t = useT('loyalty');
  const tc = useT('common');
  const toast = useToast();
  const mutation = useApiMutation((value: { enabled: boolean; freeCancelHours: number }) => setServiceAutoCharge(businessId, serviceId, value));

  const [enabled, setEnabled] = useState(initial.enabled);
  const [freeCancelHours, setFreeCancelHours] = useState(initial.freeCancelHours);

  const save = async (next: { enabled: boolean; freeCancelHours: number }) => {
    setEnabled(next.enabled);
    setFreeCancelHours(next.freeCancelHours);
    try {
      await mutation.mutate(next);
      toast.success(t('autoCharge.saved'));
    } catch {
      toast.error(t('autoCharge.saveFailed'));
    }
  };

  return (
    <div data-f="F-06-127 F-04-164" className="flex flex-col gap-4">
      <Switch checked={enabled} onCheckedChange={(v) => save({ enabled: v, freeCancelHours })} label={t('autoCharge.title')} description={t('autoCharge.description')} />
      {enabled && (
        <FormField label={t('autoCharge.freeCancelHours')} hint={t('autoCharge.freeCancelHoursHint')}>
          <div className="flex items-center gap-3">
            <Input
              type="number"
              min={0}
              max={48}
              className="w-24"
              value={freeCancelHours}
              onChange={(e) => setFreeCancelHours(Math.min(48, Math.max(0, Number(e.target.value) || 0)))}
            />
            <Button size="sm" variant="secondary" onClick={() => save({ enabled, freeCancelHours })} loading={mutation.isPending}>
              {tc('actions.save')}
            </Button>
          </div>
        </FormField>
      )}
      <hr className="border-border" />
      <OnlineRequireMembershipToggle businessId={businessId} serviceId={serviceId} initial={initialRequireMembership} />
    </div>
  );
}
