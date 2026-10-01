'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { User } from 'lucide-react';
import { useT } from '@/i18n/useT';

/** Шапка записи: название бизнеса (→ «О нас») и личный кабинет клиента (F-03-081, F-03-112) */
export function WizardHeader({ slug, businessName }: { slug: string; businessName: ReactNode }) {
  const t = useT('online');
  return (
    <div className="flex items-center justify-between gap-2">
      <Link href={`/b/${slug}/about`} className="flex min-h-10 min-w-0 items-center truncate text-sm font-medium text-fg hover:underline">
        {businessName}
      </Link>
      <Link
        href={`/b/${slug}/me`}
        data-f="F-03-112"
        className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-fg hover:bg-surface-2"
      >
        <User aria-hidden className="size-5" />
        <span className="sr-only">{t('booking.myCabinet')}</span>
      </Link>
    </div>
  );
}
