'use client';

/**
 * Вклад раздела «stock» в хаб настроек /biz/settings (хост «settingsHub»): плитка «Склад» с переходом
 * на /biz/stock/settings (F-08-096). Посмотреть вклад без хозяина хоста: /dev/ext/settingsHub/stock
 */
import { ChevronRight, Package } from 'lucide-react';
import Link from 'next/link';
import type { SettingsHubExtProps } from '@/extensions/types';
import { useT } from '@/i18n/useT';

export default function StockSettingsHub(props: SettingsHubExtProps) {
  void props;
  const t = useT('stock');
  return (
    <div data-f="F-08-096">
      <Link href="/biz/stock/settings" className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 shadow-xs transition-colors hover:bg-surface-2/60">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-soft text-primary-text">
          <Package aria-hidden className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium text-fg">{t('settings.title')}</span>
          <span className="block text-sm text-muted">{t('settings.subtitle')}</span>
        </span>
        <ChevronRight aria-hidden className="size-5 shrink-0 text-muted" />
      </Link>
    </div>
  );
}
