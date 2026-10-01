'use client';

/**
 * Цифры каталога (У7): на широком экране — три плитки, на телефоне — одна строка мелким текстом, чтобы первая
 * услуга была на первом экране, а не на 680 px.
 */
import { Globe, LayoutGrid, Tag } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { StatCard } from '@/ui/StatCard';

export function CatalogSummary({ total, categories, online }: { total: number; categories: number; online: number }) {
  const t = useT('services');
  return (
    <>
      <p className="text-sm text-muted md:hidden">{t('stats.line', { total, categories, online })}</p>
      <div className="grid grid-cols-3 gap-3 max-md:hidden">
        <StatCard label={t('stats.total')} value={total} icon={<Tag aria-hidden />} />
        <StatCard label={t('stats.categories')} value={categories} icon={<LayoutGrid aria-hidden />} />
        <StatCard label={t('stats.online')} value={online} icon={<Globe aria-hidden />} />
      </div>
    </>
  );
}
