'use client';

/**
 * Личный кабинет → «Язык» (F-15-134): язык интерфейса — личная настройка, у других пользователей не меняется
 * (⭐ у нас ru/hy/en, без «беты» — F-00-172). Переключение — тот же механизм, что у демо-переключателя
 * (`useApplyDemo`, cookie `lang`), пока у пользователей нет отдельного бэкенд-аккаунта.
 */
import { useState } from 'react';
import { useApplyDemo, useDemo } from '@/demo/hooks';
import { LOCALES, type Locale } from '@/i18n/config';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { FormField } from '@/ui/FormField';
import { SectionCard } from '@/ui/SectionCard';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { useToast } from '@/ui/Toast';

const LANG_LABEL: Record<Locale, string> = { ru: 'Русский', hy: 'Հայերեն', en: 'English' };

export function LanguageTab() {
  const t = useT('settings');
  const toast = useToast();
  const { lang } = useDemo();
  const apply = useApplyDemo();
  const [value, setValue] = useState<Locale>(lang);

  const save = () => {
    apply({ lang: value });
    toast.success(t('account.language.saved'));
  };

  return (
    <SectionCard title={t('account.language.title')} description={t('account.language.description')}>
      <div data-f="F-15-134 F-14-179 F-10-130" className="flex flex-col gap-4">
        <FormField label={t('account.language.label')} hint={t('account.language.hint')}>
          <SegmentedControl
            fullWidth
            value={value}
            onValueChange={(v) => setValue(v as Locale)}
            options={LOCALES.map((l) => ({ value: l, label: LANG_LABEL[l] }))}
          />
        </FormField>
        <Badge tone="info" className="self-start">
          {t('account.language.note')}
        </Badge>
        <Button className="self-start" disabled={value === lang} onClick={save}>
          {t('account.language.save')}
        </Button>
      </div>
    </SectionCard>
  );
}
