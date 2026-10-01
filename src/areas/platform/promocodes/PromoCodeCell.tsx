'use client';

/** Код моноширинно и «Копировать» рядом — код диктуют владельцу на визите */
import { Copy } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { copyText } from '@/lib/clipboard';
import { IconButton } from '@/ui/IconButton';
import { useToast } from '@/ui/Toast';

export function PromoCodeCell({ code }: { code: string }) {
  const t = useT('platform');
  const toast = useToast();
  return (
    <span className="inline-flex items-center gap-1">
      <span className="font-mono text-base font-semibold tracking-wide text-fg">{code}</span>
      <IconButton
        icon={<Copy />}
        label={t('promocodes.copy')}
        size="sm"
        onClick={async (e) => {
          e.stopPropagation();
          if (await copyText(code)) toast.success(t('promocodes.copied', { code }));
          else toast.error(t('promocodes.copyFailed'));
        }}
      />
    </span>
  );
}
