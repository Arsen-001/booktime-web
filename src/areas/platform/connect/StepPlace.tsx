'use client';

/** Шаг «Где»: точка кнопкой «Я сейчас на месте работы» (без карт), район и адрес. */
import { useState } from 'react';
import { CheckCircle2, MapPin } from 'lucide-react';
import type { ConnectForm } from '@/areas/platform/connect/connectForm';
import { DISTRICT_IDS } from '@/config/districts';
import type { DistrictId } from '@/domain/core';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { nowDateTime } from '@/lib/date';
import { Button } from '@/ui/Button';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { Select } from '@/ui/Select';

interface StepPlaceProps {
  form: ConnectForm;
  onChange: (patch: Partial<ConnectForm>) => void;
}

export function StepPlace({ form, onChange }: StepPlaceProps) {
  const t = useT('platform');
  const tc = useT('common');
  const fmt = useFormat();
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState('');

  const locate = () => {
    setGeoError('');
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoError(t('connect.hereGeoUnsupported'));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        onChange({ coords: { lat: pos.coords.latitude, lng: pos.coords.longitude }, coordsAt: nowDateTime() });
      },
      () => {
        setLocating(false);
        setGeoError(t('connect.hereGeoDenied'));
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 rounded-xl bg-surface-2 p-4">
        {form.coordsAt ? (
          <p className="flex items-center gap-2 text-base font-medium text-fg">
            <CheckCircle2 aria-hidden className="size-5 text-success" />
            {t('connect.hereDone', { time: fmt.time(form.coordsAt) })}
          </p>
        ) : (
          <p className="text-sm text-muted">{t('connect.hereHint')}</p>
        )}
        <Button variant={form.coordsAt ? 'outline' : 'secondary'} leftIcon={<MapPin aria-hidden />} onClick={locate} loading={locating} className="self-start">
          {form.coordsAt ? t('connect.hereAgain') : t('connect.hereButton')}
        </Button>
        {geoError && <p className="text-sm text-danger">{geoError}</p>}
      </div>
      <FormField label={t('connect.district')}>
        <Select
          value={form.district ?? ''}
          onValueChange={(v) => onChange({ district: v as DistrictId })}
          options={DISTRICT_IDS.map((d) => ({ value: d, label: tc(`districts.${d}`) }))}
          placeholder={t('connect.districtPlaceholder')}
        />
      </FormField>
      <FormField label={t('connect.address')} optional>
        <Input value={form.address} onChange={(e) => onChange({ address: e.target.value })} placeholder={t('connect.addressPlaceholder')} autoComplete="street-address" />
      </FormField>
      <FormField label={t('connect.yandexMapsUrl')} optional hint={t('connect.yandexHint')}>
        <Input value={form.yandexMapsUrl} onChange={(e) => onChange({ yandexMapsUrl: e.target.value })} inputMode="url" />
      </FormField>
    </div>
  );
}
