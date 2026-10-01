'use client';

/**
 * «+» на телефоне открывает то же, что «Создать ⌄» на компьютере (У2): услугу, категорию, из шаблона.
 */
import { useRouter } from 'next/navigation';
import { LayoutGrid, ListPlus, Sparkles } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { ChoiceCard } from '@/ui/ChoiceCard';
import { Sheet } from '@/ui/Sheet';

export function CreateSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useT('services');
  const router = useRouter();
  const go = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={t('createMenu.title')}>
      <div className="flex flex-col gap-2 pb-2">
        <ChoiceCard
          icon={<ListPlus aria-hidden />}
          title={t('createMenu.service')}
          description={t('createMenu.serviceHint')}
          onClick={() => go('/biz/services/new')}
        />
        <ChoiceCard
          icon={<LayoutGrid aria-hidden />}
          title={t('createMenu.category')}
          description={t('createMenu.categoryHint')}
          onClick={() => go('/biz/services/categories/new')}
        />
        <ChoiceCard
          icon={<Sparkles aria-hidden />}
          title={t('createMenu.templates')}
          description={t('createMenu.templatesHint')}
          onClick={() => go('/biz/services/templates')}
        />
      </div>
    </Sheet>
  );
}
