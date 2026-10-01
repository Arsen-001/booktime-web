'use client';

/** Строка «подпись + значение моноширинным + Копировать» — ключи, ID, адреса (F-13-052, F-13-056, F-13-062). */
import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { copyText } from '@/areas/integrations/copyText';
import { useT } from '@/i18n/useT';
import { IconButton } from '@/ui/IconButton';

export interface CopyRowProps {
  label?: string;
  value: string;
  mono?: boolean;
  /**
   * Ревью 27.09 (И5): у маски секрета (••••1234) копировать нечего — кнопки нет, вместо неё подпись
   * «полный ключ показывается один раз» (hint).
   */
  copyable?: boolean;
  hint?: string;
}

export function CopyRow({ label, value, mono = true, copyable = true, hint }: CopyRowProps) {
  const t = useT('integrations');
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    const ok = await copyText(value);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        {label && <p className="text-xs text-muted">{label}</p>}
        <p className={mono ? 'truncate font-mono text-sm text-fg' : 'truncate text-sm text-fg'}>{value}</p>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
      {copyable && (
        <IconButton
          icon={copied ? <Check className="text-success" aria-hidden /> : <Copy aria-hidden />}
          label={t('api.copy')}
          variant="ghost"
          onClick={onCopy}
        />
      )}
    </div>
  );
}
