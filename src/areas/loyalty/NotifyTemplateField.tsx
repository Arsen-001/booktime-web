'use client';

/**
 * Общее поле «уведомление клиенту»: включить/выключить + выбрать один из 3 готовых текстов или написать
 * свой (F-06-029, F-06-049, F-06-118…120). По решению F-00-120 канал — пуш в приложении, не SMS; своего
 * шаблона — сразу на ru и en (F-00-172, §0.4 — hy не пишем).
 */
import type { ReactNode } from 'react';
import type { NotifyMessageSetting, NotifyTemplateKind } from '@/domain/loyalty';
import { useDemo } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { RadioGroup } from '@/ui/Radio';
import { Switch } from '@/ui/Switch';
import { Textarea } from '@/ui/Textarea';

export interface NotifyTemplateFieldProps {
  value: NotifyMessageSetting;
  onChange: (value: NotifyMessageSetting) => void;
  label: string;
  description?: string;
  /** 3 готовых текста-примера (с переменными вроде %BONUS%) — показываются в подписи к варианту */
  templates: [string, string, string];
  /** Доп. поля (например «за сколько дней») — рисуются, только пока enabled */
  extra?: ReactNode;
  /** Настройки ещё грузятся — поле на своём месте, но выключено */
  disabled?: boolean;
  className?: string;
}

export function NotifyTemplateField({ value, onChange, label, description, templates, extra, disabled, className }: NotifyTemplateFieldProps) {
  const t = useT('loyalty');
  const { lang } = useDemo();
  const customLocale = lang === 'en' ? 'en' : 'ru';

  return (
    // F-06-169 «Пуш на цифровую карту вместо SMS»: по решению F-00-120 канал у ВСЕХ уведомлений
    // лояльности (карта, скидка, абонемент, сертификат, реферал) — только пуш в приложении; отдельного
    // переключателя «SMS vs push» нет и не нужен — SMS-канала для этих уведомлений не существует.
    <div data-f="F-06-169" className={className}>
      <Switch checked={value.enabled} disabled={disabled} onCheckedChange={(enabled) => onChange({ ...value, enabled })} label={label} description={description} />
      {value.enabled && (
        <div className="mt-3 flex flex-col gap-3 rounded-xl border border-border-strong bg-surface-2 p-3">
          <RadioGroup
            value={value.templateKind}
            onValueChange={(v) => onChange({ ...value, templateKind: v as NotifyTemplateKind })}
            options={[
              { value: 'template1', label: templates[0] },
              { value: 'template2', label: templates[1] },
              { value: 'template3', label: templates[2] },
              { value: 'custom', label: t('notify.custom') },
            ]}
          />
          {value.templateKind === 'custom' && (
            <Textarea
              value={value.customText?.[customLocale] ?? ''}
              onChange={(e) => onChange({ ...value, customText: { ...value.customText, ru: value.customText?.ru ?? '', [customLocale]: e.target.value } })}
              placeholder={t('notify.customPlaceholder')}
              maxLength={255}
              autoResize
            />
          )}
          {extra}
        </div>
      )}
    </div>
  );
}
