'use client';

import { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { IconButton } from '@/ui/IconButton';
import { Sheet } from '@/ui/Sheet';

/**
 * Значок «?» у заголовка экрана, открывающий справа панель со статьёй справки (F-03-001, «Готово когда»:
 * «у каждого экрана есть подсказка со ссылкой на справку»). У нас справочного портала нет — статья лежит
 * прямо в панели, демо-текстом (см. messages/*\/online.json → help.<screenKey>).
 */
export function HelpHint({ screenKey }: { screenKey: 'links' | 'linkSettings' | 'page' | 'widget' | 'settings' | 'requests' | 'places' }) {
  const t = useT('online');
  const [open, setOpen] = useState(false);
  return (
    <>
      {/* F-03-001: зона нажатия ≥44px (CONVENTIONS §0) — size="sm" даёт ровно 40px, размер "md" даёт 44px */}
      <IconButton
        icon={<HelpCircle aria-hidden />}
        label={t('help.buttonLabel')}
        size="md"
        variant="ghost"
        data-f="F-03-001"
        onClick={() => setOpen(true)}
      />
      <Sheet open={open} onOpenChange={setOpen} title={t('help.buttonLabel')} description={t(`help.${screenKey}.title` as 'help.links.title')} size="sm">
        <div className="flex flex-col gap-3 text-sm leading-relaxed text-fg">
          <p>{t(`help.${screenKey}.body` as 'help.links.body')}</p>
        </div>
      </Sheet>
    </>
  );
}
