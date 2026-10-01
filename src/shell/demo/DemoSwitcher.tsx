'use client';

import { FlaskConical } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { DemoPanel } from '@/shell/demo/DemoPanel';
import { Sheet } from '@/ui/Sheet';

/**
 * Демо-переключатель на всех страницах: плавающая кнопка → шторка с персоной, сферой, языком, темой,
 * размером шрифта, режимом ответов API и сбросом демо-данных. [data-demo-fab] — замеры её прячут.
 *
 * Журнал держит на телефоне свой расширенный Fab «+ Запись» в том же правом нижнем углу (qa/journal-redesign,
 * owner 27.09.2026: флаг перекрывал подпись кнопки) — только на этой странице переключатель уходит к левому краю,
 * остальные страницы не трогаем.
 */
export function DemoSwitcher() {
  const t = useT('common');
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const onJournal = pathname?.startsWith('/biz/journal');
  return (
    <>
      <button
        type="button"
        data-demo-fab
        onClick={() => setOpen(true)}
        aria-label={t('demo.open')}
        className={cn(
          'fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-40 grid size-12 place-items-center rounded-full border border-border bg-surface text-primary-text shadow-lg transition-transform hover:scale-105 md:bottom-6 md:right-6',
          onJournal ? 'left-4 md:left-auto md:right-6' : 'right-4',
        )}
      >
        <FlaskConical aria-hidden className="size-5" />
      </button>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title={t('demo.title')}
        description={t('demo.hint')}
        side="auto"
        size="sm"
      >
        <DemoPanel onNavigate={() => setOpen(false)} />
      </Sheet>
    </>
  );
}
