'use client';

import { SearchX } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { LinkButton } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';

export function NotFoundView() {
  const t = useT('common');
  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <EmptyState
        icon={<SearchX className="size-8" />}
        title={t('notFound.title')}
        description={t('notFound.text')}
        action={<LinkButton href="/">{t('notFound.home')}</LinkButton>}
      />
    </div>
  );
}
