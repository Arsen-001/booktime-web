import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { LanguageSwitch } from '@/shell/LanguageSwitch';
import { PublicShell } from '@/shell/public/PublicShell';

// ⭐ Статус заказа по ссылке (03.10.2026) — клиент без входа. Личная ссылка: в поисковики не попадает.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('orders');
  return { title: t('public.metaTitle'), robots: { index: false, follow: false } };
}

export default function OrderStatusLayout({ children }: LayoutProps<'/o/[code]'>) {
  return (
    <PublicShell>
      <div className="-mt-1 mb-3 flex justify-end">
        <LanguageSwitch />
      </div>
      {children}
    </PublicShell>
  );
}
