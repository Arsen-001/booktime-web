'use client';

/**
 * Вклад раздела «notify» в хаб настроек /biz/settings (хост «settingsHub»): плитка «Уведомления» с
 * переходом в раздел (F-05-001). Посмотреть вклад без хозяина хоста: /dev/ext/settingsHub/notify
 */
import { BellRing, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import type { SettingsHubExtProps } from '@/extensions/types';
import { useT } from '@/i18n/useT';

export default function NotifySettingsHub(props: SettingsHubExtProps) {
  void props;
  const t = useT('notify');
  return (
    <div data-f="F-05-001">
      <Link
        href="/biz/notifications"
        className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 shadow-xs transition-colors hover:bg-surface-2/60"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-soft text-primary-text">
          <BellRing aria-hidden className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium text-fg">{t('title')}</span>
          <span className="block text-sm text-muted">{t('settingsHub.hint')}</span>
        </span>
        <ChevronRight aria-hidden className="size-5 shrink-0 text-muted" />
      </Link>
    </div>
  );
}
