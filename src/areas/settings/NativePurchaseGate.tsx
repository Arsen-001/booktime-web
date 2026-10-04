'use client';

/**
 * Подписка BookTime, монеты и то, что покупается за монеты (продвижение, сторис), в наших приложениях iOS и Android
 * не продаются: App Store 3.1.1 и Google Play требуют для цифрового свою оплату и запрещают уводить на оплату снаружи.
 * Поэтому в приложении вместо экрана — спокойная строка без ссылки и кнопки; в браузере экран как обычно.
 */
import type { ReactNode } from 'react';
import { Smartphone } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { useHideDigitalPurchases } from '@/lib/native/useNativeApp';
import { EmptyState } from '@/ui/EmptyState';

export function NativePurchaseGate({ children }: { children: ReactNode }) {
  const hide = useHideDigitalPurchases();
  const t = useT('settings');
  if (!hide) return <>{children}</>;
  return (
    <div className="grid min-h-[60dvh] place-items-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <EmptyState icon={<Smartphone aria-hidden className="size-8" />} title={t('nativePurchase.title')} description={t('nativePurchase.text')} />
      </div>
    </div>
  );
}
