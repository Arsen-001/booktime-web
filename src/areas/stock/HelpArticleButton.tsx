'use client';

/**
 * Значок «?» у заголовка страницы раздела «Склад» (F-08-001: «у каждой страницы раздела есть вход
 * в справку по этой странице»). Раньше был только тултип-подсказка — клик никуда не вёл. Теперь клик
 * открывает нашу модалку со статьёй справки по разделу (наше окно, не системный title/alert).
 */
import { useState } from 'react';
import { CircleHelp } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { IconButton } from '@/ui/IconButton';
import { Modal } from '@/ui/Modal';

type StockMessageKey = Parameters<ReturnType<typeof useT<'stock'>>>[0];

export interface HelpArticleButtonProps {
  /** Ключи в messages/<lang>/stock.json: help.<page>.title / help.<page>.body */
  titleKey: StockMessageKey;
  bodyKey: StockMessageKey;
}

export function HelpArticleButton({ titleKey, bodyKey }: HelpArticleButtonProps) {
  const t = useT('stock');
  const [open, setOpen] = useState(false);

  return (
    <>
      <IconButton icon={<CircleHelp aria-hidden />} variant="ghost" label={t('help.buttonLabel')} onClick={() => setOpen(true)} />
      <Modal open={open} onOpenChange={setOpen} title={t(titleKey)} size="sm">
        <p className="text-sm leading-relaxed whitespace-pre-line text-fg">{t(bodyKey)}</p>
      </Modal>
    </>
  );
}
