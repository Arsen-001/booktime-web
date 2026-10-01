'use client';

/**
 * Вклад раздела «finance» в хаб настроек /biz/settings (хост «settingsHub», F-07-176): плитка «Финансы»
 * со ссылками на кассы, статьи и контрагентов. Посмотреть вклад без хозяина хоста: /dev/ext/settingsHub/finance
 */
import { ChevronRight, Landmark } from 'lucide-react';
import Link from 'next/link';
import type { SettingsHubExtProps } from '@/extensions/types';
import { useT } from '@/i18n/useT';

export default function FinanceSettingsHub(props: SettingsHubExtProps) {
  void props;
  const t = useT('finance');

  const links: { href: '/biz/finance/accounts' | '/biz/finance/items' | '/biz/finance/counterparties'; label: string }[] = [
    { href: '/biz/finance/accounts', label: t('nav.accounts') },
    { href: '/biz/finance/items', label: t('nav.items') },
    { href: '/biz/finance/counterparties', label: t('nav.counterparties') },
  ];

  return (
    <div data-f="F-07-176" className="rounded-xl border border-border bg-surface p-4 shadow-xs">
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-soft text-primary-text">
          <Landmark aria-hidden className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-fg">{t('settingsHub.title')}</p>
          <p className="text-sm text-muted">{t('settingsHub.subtitle')}</p>
        </div>
      </div>
      <ul className="mt-3 flex flex-col gap-1">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="flex min-h-11 items-center justify-between gap-2 rounded-lg px-2 py-2 text-sm text-fg hover:bg-surface-2">
              {l.label}
              <ChevronRight aria-hidden className="size-4 shrink-0 text-muted" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
