'use client';

/**
 * /biz/settings/add-location — «Добавить локацию» изнутри кабинета (F-15-014): владелец заводит ещё один
 * салон/точку под тем же аккаунтом, не регистрируясь заново. Открывается по «+ Добавить локацию» в переключателе
 * филиала (src/shell/biz/LocationSwitcher.tsx).
 *
 * ⭐ по нашему решению (F-00-049/050): каждый филиал — отдельный набор данных, свой график и своя оплата.
 * Здесь заводится только сама Location и владелец сразу переключается на неё; отдельная оплата за новый филиал
 * НЕ подключена — текущая модель подписки в settings считает по businessId, а не по locationId (архитектурный
 * вопрос на несколько разделов сразу — см. qa/requests/settings.md).
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { coreGet } from '@/api/core';
import { SESSION_KEY } from '@/api/session';
import { addBusinessLocation } from '@/api/settings';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import { setLocationId } from '@/demo/store';
import type { DistrictId } from '@/domain/core';
import { DISTRICT_IDS } from '@/config/districts';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';
import { Select } from '@/ui/Select';
import { StickyActionBar } from '@/ui/StickyActionBar';
import { useToast } from '@/ui/Toast';

export function AddLocationScreen() {
  const t = useT('settings');
  const tc = useT('common');
  const router = useRouter();
  const toast = useToast();
  const { ready, businessId } = useCurrent();

  const businessQ = useApiQuery(
    ['core', 'businesses', businessId],
    () => coreGet('businesses', businessId!),
    { enabled: ready && Boolean(businessId) },
  );

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [district, setDistrict] = useState<DistrictId>(DISTRICT_IDS[0]);
  const [nameError, setNameError] = useState<string | undefined>(undefined);

  // Живой сайт: новое место видно в «кто я» только после перечитывания сессии (филиалы членства)
  const create = useApiMutation(
    async () => {
      if (!businessQ.data || !businessId) throw new Error('not_ready');
      return addBusinessLocation({ businessId, name, address, district });
    },
    { invalidates: [SESSION_KEY] },
  );

  const handleSubmit = async () => {
    if (!name.trim()) {
      setNameError(t('addLocation.errorName'));
      return;
    }
    try {
      const location = await create.mutate(undefined);
      setLocationId(location.id);
      toast.success(t('addLocation.success'));
      router.push('/biz/settings');
    } catch {
      toast.error(t('addLocation.errorGeneric'));
    }
  };

  // Форма не зависит от данных — до ответа та же форма, выключенная (DESIGN.md «The skeleton IS the page»)
  const loading = !ready || businessQ.isLoading;

  return (
    <div data-f="F-15-014" className="mx-auto flex w-full max-w-[760px] flex-col gap-6 px-4 pb-24 pt-4 sm:px-0">
      <PageHeader
        title={t('addLocation.title')}
        description={t('addLocation.subtitle')}
        back={{ href: '/biz/settings' }}
      />
      <fieldset disabled={loading} aria-busy={loading || undefined} className="contents">
      <SectionCard title={t('addLocation.sectionTitle')}>
        <div className="flex flex-col gap-4">
          <FormField label={t('addLocation.nameLabel')} error={nameError} required>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setNameError(undefined);
              }}
              placeholder={t('addLocation.namePlaceholder')}
            />
          </FormField>
          <FormField label={t('addLocation.addressLabel')} hint={t('addLocation.addressHint')}>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder={t('addLocation.addressPlaceholder')} />
          </FormField>
          <FormField label={t('addLocation.districtLabel')}>
            <Select
              value={district}
              onValueChange={(v) => setDistrict(v as DistrictId)}
              options={DISTRICT_IDS.map((id) => ({ value: id, label: tc(`districts.${id}`) }))}
            />
          </FormField>
        </div>
      </SectionCard>
      <StickyActionBar>
        <Button onClick={() => void handleSubmit()} loading={create.isPending} fullWidth>
          {t('addLocation.submit')}
        </Button>
      </StickyActionBar>
      </fieldset>
    </div>
  );
}
