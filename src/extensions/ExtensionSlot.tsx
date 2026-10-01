'use client';

import { Suspense } from 'react';
import { ExtensionBoundary } from '@/extensions/ExtensionBoundary';
import type { ExtensionEntry, HostId, HostProps } from '@/extensions/types';
import { Skeleton } from '@/ui/Skeleton';

export interface ExtensionSlotProps<H extends HostId> {
  entry: ExtensionEntry<H>;
  props: HostProps[H];
}

/** Отрисовать один вклад раздела внутри хоста (с ленивой загрузкой; упавший вклад не роняет хост) */
export function ExtensionSlot<H extends HostId>({ entry, props }: ExtensionSlotProps<H>) {
  const Component = entry.component;
  return (
    <div data-ext={`${entry.host}:${entry.area}`}>
      <ExtensionBoundary key={`${entry.host}:${entry.area}`} name={`${entry.host}:${entry.area}`}>
        <Suspense fallback={<Skeleton variant="rect" className="h-32 w-full" />}>
          <Component {...props} />
        </Suspense>
      </ExtensionBoundary>
    </div>
  );
}
