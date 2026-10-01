'use client';

/**
 * /biz/resources/packages/new — создание пакета (F-16-108): минимум для старта — название и категория
 * (по умолчанию первая), дальше редактирование в полной форме с четырьмя вкладками (F-16-109). Три готовых
 * рецепта (F-16-134) подсказывают порядок и способ цены — сразу применяются к новому пакету.
 */
import { useMemo, useState } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { coreList } from '@/api/core';
import { createPackage, PACKAGE_TEMPLATES, savePackage, type PackagePricingMethod } from '@/api/resources';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useCurrent, useSphere } from '@/demo/hooks';
import type { LocalizedText, ServicePackage } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { pickText } from '@/lib/text';
import { Button } from '@/ui/Button';
import { ChoiceGroup } from '@/ui/ChoiceGroup';
import { FormField } from '@/ui/FormField';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';
import { Select } from '@/ui/Select';
import { Skeleton } from '@/ui/Skeleton';
import { StickyActionBar } from '@/ui/StickyActionBar';
import { useToast } from '@/ui/Toast';
import { useUnsavedGuard } from '@/ui/hooks/useUnsavedGuard';
import { LocalizedNameField } from '@/areas/resources/components/LocalizedNameField';

const EMPTY_NAME: LocalizedText = { ru: '' };

export function PackageCreateScreen() {
  const t = useT('resources');
  const locale = useLocale();
  const router = useRouter();
  const toast = useToast();
  const { ready, businessId } = useCurrent();
  const sphere = useSphere();

  const [name, setName] = useState<LocalizedText>(EMPTY_NAME);
  const [categoryId, setCategoryId] = useState('');
  const [template, setTemplate] = useState<(typeof PACKAGE_TEMPLATES)[number]['id'] | ''>('');
  const [nameError, setNameError] = useState<string | undefined>(undefined);

  const categoriesQ = useApiQuery(['resources', 'service-categories', businessId], () => coreList('serviceCategories', { businessId: businessId ?? '' }), {
    enabled: ready && Boolean(businessId),
  });
  const activeCategoryId = categoryId || categoriesQ.data?.[0]?.id || '';

  const create = useApiMutation(() => createPackage({ businessId: businessId ?? '', categoryId: activeCategoryId, sphereId: sphere.id, name }));

  // Начатое создание — тот же вопрос «Уйти без сохранения?», что у формы правки (ссылки меню, «Назад», «Отмена»)
  const dirty = Boolean(name.ru.trim() || name.en?.trim() || categoryId || template);
  const { confirmLeave } = useUnsavedGuard(dirty && !create.isPending);

  const templateHint = useMemo(() => PACKAGE_TEMPLATES.find((tpl) => tpl.id === template), [template]);

  const submit = async () => {
    if (!name.ru.trim()) {
      setNameError(t('form.nameRequired'));
      return;
    }
    try {
      const created = await create.mutate(undefined);
      if (templateHint) {
        const mode: ServicePackage['mode'] = templateHint.mode;
        const pricingMethod: PackagePricingMethod = templateHint.pricingMethod;
        await savePackage(created.id, { mode, extra: { pricingMethod, discountPercent: 10 } });
      }
      toast.success(t('form.created', { name: pickText(created.name, locale) }));
      router.push(`/biz/resources/packages/${created.id}`);
    } catch {
      toast.error(t('form.saveFailed'));
    }
  };

  return (
    <div data-f="F-16-108 F-16-134" className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
      <PageHeader title={t('packages.createTitle')} back={{ href: '/biz/resources/packages' }} />

      {!ready ? (
        <Skeleton lines={6} />
      ) : (
        <>
          <SectionCard title={t('form.sectionTitle')} classNames={{ body: 'flex flex-col gap-5' }}>
            <LocalizedNameField
              value={name}
              onValueChange={(v) => {
                setName(v);
                if (v.ru.trim()) setNameError(undefined);
              }}
              labels={{ ru: t('form.nameRu'), en: t('form.nameEn') }}
              placeholder={t('packages.namePlaceholder')}
              error={nameError}
            />
            <FormField label={t('packages.category')}>
              <Select
                value={activeCategoryId}
                onValueChange={setCategoryId}
                options={(categoriesQ.data ?? []).map((c) => ({ value: c.id, label: pickText(c.name, locale) }))}
                placeholder={t('packages.categoryPlaceholder')}
              />
            </FormField>
          </SectionCard>

          <SectionCard title={t('packages.templatesTitle')} description={t('packages.templatesHint')}>
            <ChoiceGroup
              columns={1}
              value={template}
              onValueChange={(v) => setTemplate(v as typeof template)}
              options={PACKAGE_TEMPLATES.map((tpl) => ({ value: tpl.id, title: t(`packages.template.${tpl.id}.title` as 'packages.template.fourHandsManicurePedicure.title'), description: t(`packages.template.${tpl.id}.hint` as 'packages.template.fourHandsManicurePedicure.hint') }))}
            />
          </SectionCard>
        </>
      )}

      <StickyActionBar desktop="inline">
        <Button variant="ghost" onClick={() => void confirmLeave().then((ok) => ok && router.push('/biz/resources/packages'))}>
          {t('form.cancel')}
        </Button>
        <Button loading={create.isPending} onClick={submit}>
          {t('packages.createTitle')}
        </Button>
      </StickyActionBar>
    </div>
  );
}
