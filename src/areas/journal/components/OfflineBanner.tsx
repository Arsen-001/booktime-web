'use client';

/**
 * F-00-201 «Работа без интернета»: полоса над журналом, пока браузер офлайн — данные читаются
 * и правятся из локального хранилища как обычно (список записей на неделю не пропадает),
 * полоса только объясняет мастеру, почему нет свежих чужих правок.
 */
import { WifiOff } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { useOnlineStatus } from '@/areas/journal/lib/useOnlineStatus';

export function OfflineBanner() {
  const t = useT('journal');
  const online = useOnlineStatus();
  if (online) return null;

  return (
    <div
      data-f="F-00-201"
      role="status"
      className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning-soft px-3 py-2 text-sm text-fg"
    >
      <WifiOff aria-hidden className="size-4 shrink-0 text-warning" />
      <span>{t('offline.banner')}</span>
    </div>
  );
}
