'use client';

/**
 * F-06-147: «Доступно для продажи онлайн» — общий блок для типа сертификата и типа абонемента.
 * Витрина online (наш публичный адрес виджета) строит раздел online — здесь только настройка типа.
 */
import type { OnlineSaleSettings } from '@/domain/loyalty';
import { useDemo } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { FormField } from '@/ui/FormField';
import { ImageUpload } from '@/ui/ImageUpload';
import { Input } from '@/ui/Input';
import { MoneyInput } from '@/ui/MoneyInput';
import { Switch } from '@/ui/Switch';
import { Textarea } from '@/ui/Textarea';

export function OnlineSaleFields({ value, onChange }: { value: OnlineSaleSettings; onChange: (v: OnlineSaleSettings) => void }) {
  const t = useT('loyalty');
  const { lang } = useDemo();
  const locale = lang === 'en' ? 'en' : 'ru';

  return (
    <div className="flex flex-col gap-4">
      <Switch checked={value.enabled} onCheckedChange={(enabled) => onChange({ ...value, enabled })} label={t('onlineSale.enabled')} description={t('onlineSale.hint')} />
      {value.enabled && (
        <div className="flex flex-col gap-4 rounded-xl border border-border-strong bg-surface-2 p-3">
          <FormField label={t('onlineSale.title')}>
            <Input
              value={value.title?.[locale] ?? ''}
              onChange={(e) => onChange({ ...value, title: { ...value.title, ru: value.title?.ru ?? '', [locale]: e.target.value } })}
              placeholder={t('onlineSale.titlePlaceholder')}
            />
          </FormField>
          <FormField label={t('onlineSale.image')} hint={t('onlineSale.imageHint')}>
            <ImageUpload value={value.imageUrl ? [value.imageUrl] : []} onValueChange={(urls) => onChange({ ...value, imageUrl: urls[0] })} max={1} aspect="4/3" minWidth={288} minHeight={184} />
          </FormField>
          <FormField label={t('onlineSale.description')}>
            <Textarea
              value={value.description?.[locale] ?? ''}
              onChange={(e) => onChange({ ...value, description: { ...value.description, ru: value.description?.ru ?? '', [locale]: e.target.value } })}
              autoResize
            />
          </FormField>
          <FormField label={t('onlineSale.price')} hint={t('onlineSale.priceHint')}>
            <MoneyInput value={value.price} onValueChange={(price) => onChange({ ...value, price })} placeholder="0" />
          </FormField>
        </div>
      )}
    </div>
  );
}
