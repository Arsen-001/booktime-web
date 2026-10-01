'use client';

/**
 * Вклад раздела «services» в хаб настроек /biz/settings (хост «settingsHub»): ссылки на каталог,
 * шаблоны, категории. Принадлежит разделу «services». Посмотреть без хозяина хоста: /dev/ext/settingsHub/services
 */
import { ChevronRight, Scissors } from 'lucide-react';
import Link from 'next/link';
import type { SettingsHubExtProps } from '@/extensions/types';
import { useT } from '@/i18n/useT';

export default function ServicesSettingsHub(props: SettingsHubExtProps) {
  void props;
  const t = useT('services');
  const links = [
    { href: '/biz/services', label: t('nav.catalog') },
    { href: '/biz/services/templates', label: t('createMenu.templates') },
    { href: '/biz/services/categories/new', label: t('createMenu.category') },
    { href: '/biz/services/photos', label: t('nav.photos') },
    { href: '/biz/services/documents', label: t('nav.documents') },
    { href: '/biz/services/materials', label: t('nav.materials') },
  ];
  return (
    <div className="rounded-xl border border-border bg-surface shadow-xs">
      <div className="flex items-center gap-3 border-b border-border p-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-soft text-primary-text">
          <Scissors aria-hidden className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-fg">{t('title')}</p>
          <p className="text-sm text-muted">{t('settingsHub.hint')}</p>
        </div>
      </div>
      <ul className="divide-y divide-border">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-surface-2/60">
              <span className="text-fg">{l.label}</span>
              <ChevronRight aria-hidden className="size-4 shrink-0 text-muted" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
