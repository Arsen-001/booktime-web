'use client';

import { BarChart3 } from 'lucide-react';
import Link from 'next/link';
import { useLocalizedHref } from '@/i18n/useLocalizedHref';
import { useT } from '@/i18n/useT';
import type { SalonConsent } from '@/lib/salonCounters';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Portal } from '@/ui/Portal';

/** Окно согласия на счётчики салона (F-03-118/119): «Разрешить» / «Не надо», ссылка на политику — в новой вкладке */
export function SalonConsentBanner({ businessName, onDecide }: { businessName: string; onDecide: (v: SalonConsent) => void }) {
  const t = useT('online');
  const localize = useLocalizedHref();
  return (
    <Portal>
      {/* Над липкой «Записаться» и нижними вкладками; на компьютере — карточка справа внизу */}
      <div
        role="region"
        aria-label={t('salonCounters.title')}
        data-f="F-03-118 F-03-119"
        className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom,0px)+var(--app-bottom-inset)+var(--sticky-bar-h)+0.75rem)] z-40 md:left-auto md:right-6 md:max-w-sm"
      >
        <Card padding="md" className="flex flex-col gap-3 shadow-lg">
          <div className="flex items-start gap-3">
            <BarChart3 aria-hidden className="mt-0.5 size-5 shrink-0 text-muted" />
            <div className="flex min-w-0 flex-col gap-1">
              <p className="text-sm font-semibold text-fg">{t('salonCounters.title')}</p>
              <p className="text-sm text-muted">{t.rich('salonCounters.text', {
                  name: businessName,
                  privacy: (chunks) => (
                    <Link
                      href={localize('/privacy')}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-accent underline underline-offset-2 hover:no-underline"
                    >
                      {chunks}
                    </Link>
                  ),
                })}</p>
            </div>
          </div>
          <div className="flex gap-2 [&>*]:flex-1">
            <Button variant="outline" onClick={() => onDecide('denied')}>
              {t('salonCounters.deny')}
            </Button>
            <Button onClick={() => onDecide('granted')}>{t('salonCounters.allow')}</Button>
          </div>
        </Card>
      </div>
    </Portal>
  );
}
