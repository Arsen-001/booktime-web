'use client';

import type { ShadeOption } from '@/api/client';
import { useT } from '@/i18n/useT';
import { Chip } from '@/ui/Chip';

/**
 * Оттенок или вариант (F-00-094…096) — строкой на экране подтверждения, а не отдельным шагом (speed-k3 №2):
 * «Мастер подберёт» выбран по умолчанию, если выбор необязателен; обязательный — без выбора записаться нельзя.
 */
export function ShadeChoice({
  options,
  required,
  value,
  onChange,
  error,
}: {
  options: ShadeOption[];
  required: boolean;
  value?: string;
  onChange: (option: ShadeOption) => void;
  error?: string;
}) {
  const t = useT('client');
  const label = (o: ShadeOption) => (o.mode === 'master' ? t('book.shadeMaster') : o.mode === 'own' ? t('book.shadeOwn') : o.material ?? '');
  return (
    <section data-f="F-00-094 F-00-095 F-00-096" className="flex flex-col gap-2">
      <div>
        <h2 className="font-semibold text-fg">{t('book.shadeTitle')}</h2>
        <p className="text-sm text-muted">{required ? t('book.shadeRequired') : t('book.shadePreferred')}</p>
      </div>
      <div role="radiogroup" aria-label={t('book.shadeTitle')} className="flex flex-wrap gap-2">
        {options.map((o) => (
          <Chip key={o.value} selected={value === o.value} onClick={() => onChange(o)}>
            <span className="first-letter:uppercase">{label(o)}</span>
          </Chip>
        ))}
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </section>
  );
}
