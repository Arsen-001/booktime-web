'use client';

/**
 * Вклад раздела «resources» в хаб настроек /biz/settings (хост «settingsHub»): ссылки на ресурсы,
 * категории событий, пакеты и лист ожидания (план раздела). Посмотреть без хозяина хоста:
 * /dev/ext/settingsHub/resources
 */
import { Boxes, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import type { SettingsHubExtProps } from '@/extensions/types';
import { useT } from '@/i18n/useT';
import { useResourcesRights } from '@/areas/resources/lib/rights';

export default function ResourcesSettingsHub(props: SettingsHubExtProps) {
  void props;
  const t = useT('resources');
  const rights = useResourcesRights();
  if (!rights.viewResources) return null;

  const links = [
    { href: '/biz/resources', label: t('nav.resources') },
    { href: '/biz/groups', label: t('groups.title') },
    { href: '/biz/resources/packages', label: t('nav.packages') },
    { href: '/biz/resources/assistants', label: t('nav.assistants') },
    ...(rights.viewWaitlist ? [{ href: '/biz/waitlist', label: t('waitlist.title') }] : []),
  ];

  return (
    <div data-f="F-16-171" className="rounded-xl border border-border bg-surface shadow-xs">
      <div className="flex items-center gap-3 border-b border-border p-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-soft text-primary-text">
          <Boxes aria-hidden className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-fg">{t('nav.resources')}</p>
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
