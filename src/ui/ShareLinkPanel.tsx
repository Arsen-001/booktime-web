'use client';

import { Check, Copy, Send } from 'lucide-react';
import { useState } from 'react';
import { useT } from '@/i18n/useT';
import { copyText } from '@/lib/clipboard';
import { cn } from '@/lib/cn';
import { telegramShareUrl, whatsAppShareUrl } from '@/lib/share';
import { Button, buttonClasses } from '@/ui/Button';
import { useToast } from '@/ui/Toast';

/** Значок WhatsApp — у lucide его нет; простой контур трубки в пузыре, цвет — текущий */
function WhatsAppIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 20.5l1.3-4.1A8.5 8.5 0 1 1 8 19.6z" />
      <path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-1 .8a4 4 0 0 1-1.8-1.8l.8-1-1-2z" />
    </svg>
  );
}

export interface ShareLinkPanelProps {
  /** Полный адрес, который уходит другу */
  url: string;
  /** Готовый текст сообщения со ссылкой внутри (WhatsApp) */
  message: string;
  /** Текст без ссылки (Telegram кладёт ссылку отдельно) */
  telegramText: string;
  /** Короткий код — показывается рядом со ссылкой, чтобы продиктовать */
  code?: string;
  className?: string;
}

/**
 * Поделиться ссылкой: адрес с кодом, «Скопировать ссылку» и готовые сообщения в WhatsApp и Telegram
 * (обычные ссылки wa.me / t.me/share — без ботов и платных сообщений).
 */
export function ShareLinkPanel({ url, message, telegramText, code, className }: ShareLinkPanelProps) {
  const t = useT('ui');
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (await copyText(url)) {
      setCopied(true);
      toast.success(t('share.copied'));
    } else toast.error(t('share.copyFailed'));
  };

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex min-h-11 items-center gap-2 rounded-md border border-border bg-surface-2 px-3 py-2">
        <span className="min-w-0 flex-1 truncate text-sm text-fg" data-testid="share-url">
          {url}
        </span>
        {code && (
          <span className="shrink-0 rounded-sm bg-surface px-2 py-0.5 font-mono text-sm font-semibold tracking-wider text-fg">
            <span className="sr-only">{t('share.code')} </span>
            {code}
          </span>
        )}
      </div>
      {/* По ширине самой панели, а не экрана: в узкой колонке (iPad) три кнопки в ряд вылезали за карточку */}
      <div className="@container">
        <div className="grid grid-cols-2 gap-2 @md:grid-cols-[1fr_auto_auto]">
          <Button className="col-span-2 @md:col-span-1" leftIcon={copied ? <Check /> : <Copy />} onClick={copy}>
            {copied ? t('share.copiedShort') : t('share.copy')}
          </Button>
          <a
            href={whatsAppShareUrl(message)}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClasses({ variant: 'secondary' })}
          >
            <WhatsAppIcon />
            WhatsApp
          </a>
          <a
            href={telegramShareUrl(url, telegramText)}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClasses({ variant: 'secondary' })}
          >
            <Send aria-hidden />
            Telegram
          </a>
        </div>
      </div>
    </div>
  );
}
