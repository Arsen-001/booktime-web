'use client';

/**
 * Название на трёх языках (У18, F-03-115, F-15-141): Հայերեն — главное, Русский, English — в одну строку, над
 * ними одна подпись «Название *» (У23). Армянский — наш главный довод, поэтому он первый; хотя бы одно из hy/ru
 * обязательно (ядро хранит ru — пустой ru форма подставит из hy при сохранении, normalizeName).
 * `multiline` — описание: переключатель языка над одним полем, чтобы три поля не растягивали форму.
 */
import { useState } from 'react';
import type { LocalizedText } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { Badge } from '@/ui/Badge';
import { Input } from '@/ui/Input';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { Textarea } from '@/ui/Textarea';

export type TextLocale = 'hy' | 'ru' | 'en';
/** Порядок полей: армянский — главный (У18) */
export const FORM_LOCALES: readonly TextLocale[] = ['hy', 'ru', 'en'];

export interface LocalizedTextFieldProps {
  value: LocalizedText;
  onValueChange: (value: LocalizedText) => void;
  label: string;
  required?: boolean;
  error?: string;
  multiline?: boolean;
  autoTranslated?: { hy?: boolean; en?: boolean };
  onEdited?: (locale: TextLocale) => void;
  disabled?: boolean;
  /** id обёртки — к нему прокручивается форма при ошибке (У19) */
  id?: string;
  className?: string;
}

export function LocalizedTextField({
  value,
  onValueChange,
  label,
  required,
  error,
  multiline,
  autoTranslated,
  onEdited,
  disabled,
  id,
  className,
}: LocalizedTextFieldProps) {
  const t = useT('services');
  const [lang, setLang] = useState<TextLocale>('hy');
  const short: Record<TextLocale, string> = {
    hy: t('languages.short.hy'),
    ru: t('languages.short.ru'),
    en: t('languages.short.en'),
  };
  const full: Record<TextLocale, string> = {
    hy: t('languages.locale.hy'),
    ru: t('languages.locale.ru'),
    en: t('languages.locale.en'),
  };
  const change = (locale: TextLocale, text: string) => {
    onValueChange({ ...value, [locale]: text });
    if (locale !== 'ru') onEdited?.(locale);
  };
  const isAuto = (locale: TextLocale) => locale !== 'ru' && Boolean(autoTranslated?.[locale]);

  return (
    <div id={id} className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <span className="text-sm font-medium text-fg">
        {label}
        {required && <span className="ml-0.5 text-danger">*</span>}
      </span>
      {multiline ? (
        <div className="flex flex-col gap-2">
          <SegmentedControl
            size="sm"
            aria-label={label}
            options={FORM_LOCALES.map((l) => ({
              value: l,
              label: (
                <span className="flex items-center gap-1.5">
                  {full[l]}
                  {value[l]?.trim() ? <span aria-hidden className="size-1.5 rounded-full bg-success" /> : null}
                </span>
              ),
            }))}
            value={lang}
            onValueChange={(v) => setLang(v as TextLocale)}
          />
          <Textarea
            aria-label={`${label} · ${full[lang]}`}
            value={value[lang] ?? ''}
            onChange={(e) => change(lang, e.target.value)}
            rows={3}
            disabled={disabled}
          />
          {isAuto(lang) && (
            <Badge tone="neutral" size="sm" className="w-fit">
              {t('languages.autoTranslated')}
            </Badge>
          )}
        </div>
      ) : (
        <div className="grid min-w-0 grid-cols-1 gap-2">
          {FORM_LOCALES.map((l) => (
            <div key={l} className="flex min-w-0 flex-col gap-1">
              <Input
                aria-label={`${label} · ${full[l]}`}
                value={value[l] ?? ''}
                onChange={(e) => change(l, e.target.value)}
                invalid={Boolean(error) && (l === 'hy' || l === 'ru')}
                disabled={disabled}
                lang={l}
                leftIcon={<span className="text-xs font-semibold text-muted">{short[l]}</span>}
              />
              {isAuto(l) && (
                <Badge tone="neutral" size="sm" className="w-fit">
                  {t('languages.autoTranslated')}
                </Badge>
              )}
            </div>
          ))}
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/** Название заполнено хотя бы на одном из главных языков */
export function hasName(text: LocalizedText): boolean {
  return Boolean(text.hy?.trim() || text.ru.trim());
}

/** Перед сохранением: ядро хранит ru обязательным — пустой ru берёт армянский текст */
export function normalizeName(text: LocalizedText): LocalizedText {
  const out: LocalizedText = { ru: text.ru.trim() || text.hy?.trim() || '' };
  if (text.hy?.trim()) out.hy = text.hy.trim();
  if (text.en?.trim()) out.en = text.en.trim();
  return out;
}
