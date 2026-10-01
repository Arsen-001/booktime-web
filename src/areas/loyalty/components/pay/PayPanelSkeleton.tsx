import { Search, Wallet } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { SkeletonText } from '@/ui/Skeleton';

/**
 * Л15: скелет блока «Лояльность в оплате» — та же разметка, что содержимое: строки «чем оплатить» (рамка, значок,
 * название и баланс, кнопка того же размера — на узком окне кнопка под текстом, как у строки) и поиск по коду внизу.
 * При появлении данных строки не меняют высоту и не прыгают.
 */
export function PayPanelSkeleton() {
  const t = useT('loyalty');
  return (
    <div className="flex flex-col gap-2" aria-hidden>
      <ul className="flex flex-col gap-1.5">
        {[0, 1].map((i) => (
          <li key={i} className="flex flex-col gap-2 rounded-lg border border-border px-3 py-2 text-sm @md:flex-row @md:items-center">
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <Wallet aria-hidden className="size-4 shrink-0 text-muted" />
              <span className="min-w-0 flex-1 text-fg @md:truncate">
                <SkeletonText width={i ? '22ch' : '18ch'} />
              </span>
            </span>
            <span className="flex flex-wrap items-center gap-2 @md:shrink-0">
              <Button size="sm" variant="outline" disabled tabIndex={-1}>
                {t('bookingWindow.pay.chargeMax')}
              </Button>
            </span>
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-1.5 border-t border-border pt-2.5">
        <p className="text-xs font-medium text-muted">{t('bookingWindow.pay.codeTitle')}</p>
        <div className="flex items-end gap-2">
          <span className="h-11 flex-1 rounded-xl border border-border bg-surface" />
          <Button size="sm" variant="outline" leftIcon={<Search aria-hidden />} disabled tabIndex={-1}>
            {t('bookingWindow.pay.codeSearch')}
          </Button>
        </div>
      </div>
    </div>
  );
}
