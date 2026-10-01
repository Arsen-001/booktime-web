'use client';

/**
 * Вклад раздела «payroll» в хаб настроек /biz/settings (хост «settingsHub»): ссылки на «Основные
 * настройки», «Схемы расчёта» и «Премии и штрафы» (F-09-001). Принадлежит разделу «payroll».
 * Посмотреть вклад без хозяина хоста: /dev/ext/settingsHub/payroll
 */
import { ChevronRight, Wallet } from 'lucide-react';
import Link from 'next/link';
import type { SettingsHubExtProps } from '@/extensions/types';
import { useT } from '@/i18n/useT';

export default function PayrollSettingsHub(props: SettingsHubExtProps) {
  void props;
  const t = useT('payroll');
  const links = [
    { href: '/biz/payroll/settings', label: t('nav.settings') },
    { href: '/biz/payroll', label: t('nav.schemes') },
    { href: '/biz/payroll/bonuses', label: t('nav.bonuses') },
  ];
  return (
    <div data-f="F-09-001" className="rounded-xl border border-border bg-surface shadow-xs">
      <div className="flex items-center gap-3 border-b border-border p-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-soft text-primary-text">
          <Wallet aria-hidden className="size-5" />
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
