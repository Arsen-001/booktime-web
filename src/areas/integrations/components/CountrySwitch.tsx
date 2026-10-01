'use client';

/** Ревью 27.09 (И19): один контрол страны на обзоре и в категориях — сегменты, общий выбор (useCatalogCountry) */
import { setCatalogCountry, useCatalogCountry, type CatalogCountry } from '@/areas/integrations/hooks/useCatalogCountry';
import { useT } from '@/i18n/useT';
import { SegmentedControl } from '@/ui/SegmentedControl';

export function CountrySwitch({ className }: { className?: string }) {
  const t = useT('integrations');
  const country = useCatalogCountry();
  return (
    <SegmentedControl
      aria-label={t('country.label')}
      value={country}
      onValueChange={(v) => setCatalogCountry(v as CatalogCountry)}
      className={className}
      options={[
        { value: 'AM', label: t('country.am') },
        { value: 'all', label: t('country.all') },
      ]}
    />
  );
}
