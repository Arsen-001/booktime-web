'use client';

/**
 * «i» рядом с заголовком страницы (F-15-171): открывает справку по ЭТОЙ странице прямо в кабинете, без
 * перехода на сайт; подсказка при наведении — наша (не «undefined», как у Altegio, VERIFY-F §G3).
 * Пока это своя кнопка внутри страниц раздела settings — фундаментального слота в `PageHeader` ещё нет,
 * см. qa/requests/settings.md («i» в PageHeader на каждой странице кабинета).
 */
import { useState, type ReactNode } from 'react';
import { Info } from 'lucide-react';
import { IconButton } from '@/ui/IconButton';
import { Sheet } from '@/ui/Sheet';

export interface HelpArticleButtonProps {
  /** Подпись кнопки для скринридера/подсказки — своя, не системная (F-15-171: у Altegio там «undefined») */
  label: string;
  title: string;
  children: ReactNode;
}

export function HelpArticleButton({ label, title, children }: HelpArticleButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <IconButton icon={<Info />} label={label} onClick={() => setOpen(true)} />
      <Sheet open={open} onOpenChange={setOpen} title={title} side="right">
        <div className="flex flex-col gap-3 text-sm leading-relaxed text-fg">{children}</div>
      </Sheet>
    </>
  );
}
