'use client';

import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useIsClient } from '@/ui/hooks/useIsClient';

export interface PortalProps {
  children: ReactNode;
}

/** Рендер в document.body (только в браузере; на сервере — ничего). */
export function Portal({ children }: PortalProps) {
  const isClient = useIsClient();
  if (!isClient) return null;
  return createPortal(children, document.body);
}
