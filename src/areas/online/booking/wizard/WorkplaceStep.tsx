'use client';

import { MapPin } from 'lucide-react';
import { getStaffRules } from '@/api/online';
import { useApiQuery } from '@/api/request';
import { useSpecialistTerms } from '@/areas/online/booking/wizard/specialistTerms';
import { DISTRICT_IDS } from '@/config/districts';
import type { DistrictId, SphereId, Staff, Workplace } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { Select } from '@/ui/Select';

/** Выбор места оказания услуги, если у мастера их несколько (F-00-073, F-00-078, F-00-080, F-00-081) */
export function WorkplaceStep({
  staff,
  workplace,
  onChange,
  district,
  onDistrictChange,
  address,
  onAddressChange,
  sphereIds,
}: {
  staff: Staff;
  workplace: Workplace;
  onChange: (v: Workplace) => void;
  district: DistrictId | '';
  onDistrictChange: (v: DistrictId | '') => void;
  address: string;
  onAddressChange: (v: string) => void;
  sphereIds?: SphereId[];
}) {
  const t = useT('online');
  const tc = useT('common');
  const terms = useSpecialistTerms(sphereIds);
  const rulesQ = useApiQuery(['online-staff-travel', staff.id], () => getStaffRules(staff.id));

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium text-fg">{t('booking.workplaceStep.title')}</p>
      <SegmentedControl
        value={workplace}
        onValueChange={(v) => onChange(v as Workplace)}
        options={staff.workplaces.map((wp) => ({ value: wp, label: t(`places.workplace.${wp}` as never) }))}
      />
      {workplace === 'visit' && (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface-2 p-3">
          <FormField label={t('booking.workplaceStep.district')}>
            <Select
              value={district}
              onValueChange={(v) => onDistrictChange(v as DistrictId)}
              placeholder={t('places.salon.districtPlaceholder')}
              options={(staff.visitDistricts?.length ? staff.visitDistricts : DISTRICT_IDS).map((id) => ({
                value: id,
                label: tc(`districts.${id}` as never),
              }))}
            />
          </FormField>
          <FormField label={t('booking.workplaceStep.address')}>
            <Input value={address} onChange={(e) => onAddressChange(e.target.value)} placeholder={t('booking.workplaceStep.addressPlaceholder')} />
          </FormField>
          {rulesQ.data && (rulesQ.data.travelFee || rulesQ.data.travelTimeMin) && (
            <p className="text-sm text-muted">
              {[
                rulesQ.data.travelFee ? t('booking.workplaceStep.fee', { fee: rulesQ.data.travelFee }) : undefined,
                rulesQ.data.travelTimeMin ? t('booking.workplaceStep.time', { min: rulesQ.data.travelTimeMin }) : undefined,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
          <Badge tone="warning" variant="soft" className="w-fit">
            <MapPin aria-hidden className="size-3.5" />
            {t('booking.workplaceStep.alwaysManual', terms)}
          </Badge>
        </div>
      )}
      {workplace === 'home' && staff.homeDistrict && (
        <p className="text-sm text-muted">
          {t('booking.workplaceStep.homeDistrictOnly', { ...terms, district: tc(`districts.${staff.homeDistrict}` as never) })}
        </p>
      )}
    </div>
  );
}
