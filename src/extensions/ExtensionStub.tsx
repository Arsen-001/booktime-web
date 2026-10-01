'use client';

import { Puzzle } from 'lucide-react';
import type { AreaId } from '@/config/areas';
import type { HostId } from '@/extensions/types';
import { useTDynamic } from '@/i18n/useTDynamic';

/**
 * Заглушка вклада: пунктирная рамка «Здесь будет вклад раздела…». Раздел заменяет её своим содержимым.
 * Атрибут data-ext-stub помогает замерам находить невыполненные вклады.
 */
export function ExtensionStub({ host, area }: { host: HostId; area: AreaId }) {
  const t = useTDynamic();
  return (
    <div
      data-ext-stub={`${host}:${area}`}
      className="flex items-start gap-3 rounded-lg border border-dashed border-border-strong bg-surface-2 p-4 text-muted"
    >
      <Puzzle aria-hidden className="mt-0.5 size-5 shrink-0" />
      <div className="min-w-0">
        <p className="font-medium text-fg">{t(`common.ext.${host}.${area}`)}</p>
        <p className="text-sm">{t('common.ext.stub', { area: t(`common.areas.${area}`) })}</p>
      </div>
    </div>
  );
}
