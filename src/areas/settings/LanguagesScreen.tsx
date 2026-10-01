'use client';

/**
 * /biz/settings/languages — «Языки» (F-15-133, F-15-144): карта, где какой язык задаётся, и что переводится
 * автоматически. Справочный экран со ссылками — каждая настройка живёт отдельно и не тянет за собой другие.
 */
import {
  ChevronRight,
  Languages as LanguagesIcon,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { useT } from '@/i18n/useT';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';

interface MapRow {
  id: string;
  href: string;
}

const MAP_ROWS: MapRow[] = [
  { id: 'account', href: '/biz/settings/account' },
  { id: 'messages', href: '/biz/settings/system' },
  { id: 'services', href: '/biz/services' },
  { id: 'booking', href: '/biz/settings/brand' },
];

export function LanguagesScreen() {
  const t = useT('settings');

  return (
    <div data-f="F-15-133 F-15-144" className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
      <PageHeader
        title={t('languages.title')}
        description={t('languages.description')}
        back={{ href: '/biz/settings' }}
      />

      <SectionCard
        title={t('languages.mapTitle')}
        description={t('languages.mapHint')}
        padding="none"
      >
        <ul className="flex flex-col divide-y divide-border">
          {MAP_ROWS.map((row) => (
            <li key={row.id}>
              <Link
                href={row.href}
                className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-surface-2 sm:px-5"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-text">
                  <LanguagesIcon aria-hidden className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-fg">
                    {t(`languages.row.${row.id}.title` as never)}
                  </span>
                  <span className="block truncate text-sm text-muted">
                    {t(`languages.row.${row.id}.description` as never)}
                  </span>
                </span>
                <ChevronRight
                  aria-hidden
                  className="size-5 shrink-0 text-muted"
                />
              </Link>
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard
        title={t('languages.autoTitle')}
        description={t('languages.autoHint')}
      >
        {/* Длинная фраза — строкой, не пилюлей: пилюля не переносится и на телефоне вылезала за экран (743 px при 390) */}
        <p className="flex items-start gap-2 rounded-lg bg-info-soft px-3 py-2.5 text-sm text-info">
          <Sparkles aria-hidden className="mt-0.5 size-4 shrink-0" />
          {t('languages.autoDescription')}
        </p>
        <p className="mt-3 text-sm text-muted">{t('languages.noAutoHint')}</p>
      </SectionCard>

      <SectionCard
        title={t('languages.availableTitle')}
        description={t('languages.availableHint')}
      />
    </div>
  );
}
