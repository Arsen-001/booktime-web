'use client';

import { Check, Copy, Link2, Share2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useT } from '@/i18n/useT';
import { copyText } from '@/lib/clipboard';
import { cn } from '@/lib/cn';
import { Button } from '@/ui/Button';
import { useToast } from '@/ui/Toast';

export interface ShareLinkCardProps {
  /** Полная ссылка: https://booktime.am/b/nuri-nail-studio */
  url: string;
  /** «Ваша ссылка на запись» */
  title: ReactNode;
  /** Обещание одной фразой: «Только ваш салон — без соседей, рекламы и чужих сторис» (F-00-006) */
  description?: ReactNode;
  /** Мелкая пометка справа от заголовка (Badge «Основная») */
  badge?: ReactNode;
  icon?: ReactNode;
  /** После копирования или «Поделиться» (например, отметить шаг чек-листа «Поделитесь ссылкой») */
  onShared?: (how: 'copy' | 'share') => void;
  /** Текст для «Поделиться» в мессенджере: «Записывайтесь онлайн» */
  shareText?: string;
  /** Ещё действия справа от «Поделиться» (Button variant="ghost" «QR-код», «Открыть») */
  extraActions?: ReactNode;
  copyLabel?: ReactNode;
  shareLabel?: ReactNode;
  /** Тост после копирования; по умолчанию «Скопировано» */
  copiedMessage?: ReactNode;
  className?: string;
}

/**
 * «Ваша ссылка — только ваша» (F-00-006): главная вещь первых минут у салона и мастера. Ссылка видна целиком (без
 * протокола), «Скопировать» — главное действие, «Поделиться» открывает системное меню телефона (нет его — копирует).
 * Ставится первой на экране ссылок, на экране передачи салона владельцу и в чек-листе «Первые шаги».
 */
export function ShareLinkCard({
  url,
  title,
  description,
  badge,
  icon,
  onShared,
  shareText,
  extraActions,
  copyLabel,
  shareLabel,
  copiedMessage,
  className,
}: ShareLinkCardProps) {
  const tc = useT('common');
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const shown = url.replace(/^https?:\/\//, '');

  const copy = async () => {
    if (await copyText(url)) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
      toast.success(copiedMessage ?? tc('states.copied'));
      onShared?.('copy');
    }
  };

  const share = async () => {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ url, text: shareText });
        onShared?.('share');
        return;
      } catch (error) {
        // человек закрыл меню — ничего не делаем; другая ошибка — копируем
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }
    await copy();
  };

  return (
    <section
      data-share-link=""
      className={cn(
        'overflow-hidden rounded-2xl border border-primary/20 bg-surface shadow-xs',
        className,
      )}
    >
      <div className="flex items-start gap-3 bg-primary-soft/50 p-4 sm:gap-4 sm:p-5">
        <span
          aria-hidden
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-primary-text shadow-xs [&_svg]:size-5"
        >
          {icon ?? <Link2 />}
        </span>
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base leading-snug font-semibold text-fg sm:text-lg">{title}</h2>
            {badge}
          </div>
          {description && <p className="mt-1 text-sm leading-relaxed text-muted sm:text-base">{description}</p>}
        </div>
      </div>

      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4 sm:p-5">
        <button
          type="button"
          onClick={copy}
          className={cn(
            'group/link flex min-h-12 min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-surface-2 px-4 text-left',
            'transition-colors hover:border-border-strong/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
          )}
          aria-label={`${typeof copyLabel === 'string' ? copyLabel : tc('actions.copy')}: ${shown}`}
        >
          <span className="min-w-0 flex-1 truncate font-mono text-sm text-fg sm:text-base" translate="no">
            {shown}
          </span>
          <span aria-hidden className="shrink-0 text-muted group-hover/link:text-fg [&_svg]:size-4">
            {copied ? <Check className="text-success" /> : <Copy />}
          </span>
        </button>
        <div className="flex flex-wrap gap-2 [&>*]:flex-1 [&>*]:basis-36 sm:flex-nowrap sm:[&>*]:flex-none sm:[&>*]:basis-auto">
          <Button
            onClick={copy}
            leftIcon={copied ? <Check aria-hidden /> : <Copy aria-hidden />}
          >
            {copyLabel ?? tc('actions.copy')}
          </Button>
          <Button variant="outline" onClick={share} leftIcon={<Share2 aria-hidden />}>
            {shareLabel ?? tc('actions.share')}
          </Button>
          {extraActions}
        </div>
      </div>
    </section>
  );
}
