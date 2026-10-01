'use client';

/**
 * Форма ресурса — одна на создание и на карточку (F-16-003, F-16-004, F-16-005, F-16-007): основное, услуги и
 * экземпляры правятся в черновике и сохраняются одной кнопкой. Филиал спрашивается, только если их больше одного.
 */
import { useLocale } from 'next-intl';
import type { Id, Location, ResourceKind } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { pickText } from '@/lib/text';
import { FormField } from '@/ui/FormField';
import { SectionCard } from '@/ui/SectionCard';
import { Select } from '@/ui/Select';
import { Textarea } from '@/ui/Textarea';
import { EntityMultiPicker, type EntityOption } from '@/areas/resources/components/EntityMultiPicker';
import { InstancesEditor } from '@/areas/resources/components/InstancesEditor';
import { LocalizedNameField } from '@/areas/resources/components/LocalizedNameField';
import { RESOURCE_KINDS } from '@/areas/resources/lib/kinds';
import type { ResourceDraft, ResourceDraftErrors } from '@/areas/resources/lib/draft';

export interface ResourceFieldsProps {
  draft: ResourceDraft;
  onDraftChange: (patch: Partial<ResourceDraft>) => void;
  errors: ResourceDraftErrors;
  serviceOptions: EntityOption[];
  locations: Location[];
  futureByInstance?: Record<Id, number>;
  disabled?: boolean;
}

export function ResourceFields({ draft, onDraftChange, errors, serviceOptions, locations, futureByInstance, disabled }: ResourceFieldsProps) {
  const t = useT('resources');
  const locale = useLocale();
  const kindOptions = RESOURCE_KINDS.map((k) => ({ value: k, label: t(`kind.${k}` as 'kind.chair') }));
  const locationOptions = locations.map((l) => ({ value: l.id, label: pickText(l.name, locale) }));

  return (
    <>
      <SectionCard title={t('form.sectionTitle')} classNames={{ body: 'flex flex-col gap-5' }}>
        <LocalizedNameField
          value={draft.name}
          onValueChange={(name) => onDraftChange({ name })}
          labels={{ ru: t('form.nameRu'), en: t('form.nameEn') }}
          placeholder={t('form.namePlaceholder')}
          error={errors.name}
          disabled={disabled}
        />
        <FormField label={t('form.description')} optional>
          <Textarea
            value={draft.description}
            onChange={(e) => onDraftChange({ description: e.target.value })}
            rows={2}
            maxLength={300}
            disabled={disabled}
          />
        </FormField>
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label={t('form.kind')}>
            <Select options={kindOptions} value={draft.kind} onValueChange={(v) => onDraftChange({ kind: v as ResourceKind })} disabled={disabled} />
          </FormField>
          {locations.length > 1 && (
            <FormField label={t('form.location')}>
              <Select options={locationOptions} value={draft.locationId} onValueChange={(locationId) => onDraftChange({ locationId })} disabled={disabled} />
            </FormField>
          )}
        </div>
      </SectionCard>

      <SectionCard title={t('form.services')} description={t('form.servicesHint')}>
        <FormField label={t('form.services')} classNames={{ label: 'sr-only' }}>
          <EntityMultiPicker
            options={serviceOptions}
            value={draft.serviceIds}
            onValueChange={(serviceIds) => onDraftChange({ serviceIds })}
            title={t('form.services')}
            placeholder={t('form.servicesPlaceholder')}
            searchPlaceholder={t('form.servicesSearch')}
            emptyText={t('form.servicesEmpty')}
            disabled={disabled}
          />
        </FormField>
        {draft.serviceIds.length === 0 && (
          <p className="mt-3 rounded-lg bg-warning-soft px-3.5 py-2.5 text-sm text-warning">{t('list.notLinkedHint')}</p>
        )}
      </SectionCard>

      <SectionCard title={t('form.instancesTitle')} description={t('form.instancesHint')}>
        <InstancesEditor
          rows={draft.instances}
          onRowsChange={(instances) => onDraftChange({ instances })}
          kindLabel={t(`kind.${draft.kind}` as 'kind.chair')}
          errors={errors.instances}
          futureByInstance={futureByInstance}
          disabled={disabled}
        />
      </SectionCard>
    </>
  );
}
