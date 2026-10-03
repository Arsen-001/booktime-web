'use client';

import { Check, Globe } from 'lucide-react';
import { useApplyDemo, useDemo } from '@/demo/hooks';
import { CLIENT_LOCALES, type Locale } from '@/i18n/config';
import { useT } from '@/i18n/useT';
import { DropdownMenu } from '@/ui/DropdownMenu';

/** Короткое имя в кнопке и полное в списке — каждое на своём языке, чтобы человек узнал свой */
const SHORT: Record<Locale, string> = { hy: 'Հայ', ru: 'Рус', en: 'Eng' };
const FULL: Record<Locale, string> = { hy: 'Հայերեն', ru: 'Русский', en: 'English' };

/** Язык сайта в верхней полосе (владелец 03.10.2026: «добавь все языки») — Հայ / Рус / Eng, запоминается в cookie */
export function LanguageSwitch() {
  const t = useT('common');
  const { lang } = useDemo();
  const apply = useApplyDemo();
  return (
    <DropdownMenu
      align="end"
      label={t('shell.language')}
      items={CLIENT_LOCALES.map((l) => ({
        id: l,
        label: FULL[l],
        icon: l === lang ? <Check aria-hidden /> : <span aria-hidden className="inline-block size-4" />,
        onSelect: () => apply({ lang: l }),
      }))}
      trigger={(props) => (
        <button
          {...props}
          type="button"
          aria-label={`${t('shell.language')}: ${FULL[lang]}`}
          className="inline-flex h-11 items-center gap-1.5 rounded-md px-2.5 text-sm font-semibold text-fg transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-focus md:h-10"
        >
          <Globe aria-hidden className="size-4 text-muted" />
          {/* На телефоне только значок: полоса узкая, а «Մուտք գործել» длинное */}
          <span className="hidden sm:inline">{SHORT[lang]}</span>
        </button>
      )}
    />
  );
}
