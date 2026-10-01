'use client';

import type { ReactNode } from 'react';
import { Trash2 } from 'lucide-react';
import { useFormat } from '@/i18n/useFormat';
import { IconButton } from '@/ui/IconButton';

export interface PayLineRowProps {
  icon: ReactNode;
  label: string;
  amount: number;
  /** Подпись под строкой: «проведено», «подставлено автоматически» */
  note?: string;
  removeLabel: string;
  busy?: boolean;
  onRemove?: () => void;
}

/** Строка оплаты лояльностью: проведённая (в платежах визита) или только выбранная — одна и та же форма */
export function PayLineRow({ icon, label, amount, note, removeLabel, busy, onRemove }: PayLineRowProps) {
  const format = useFormat();
  return (
    <li className="flex flex-col gap-0.5 rounded-md bg-background-subtle px-2.5 py-1.5 text-sm">
      <div className="flex min-h-8 items-center gap-2">
        <span className="flex size-4 shrink-0 items-center justify-center text-primary-text [&>svg]:size-4">{icon}</span>
        <span className="min-w-0 flex-1 truncate text-fg">{label}</span>
        <span className="shrink-0 font-medium text-fg">−{format.money(amount)}</span>
        {onRemove && <IconButton icon={<Trash2 aria-hidden />} label={removeLabel} size="sm" variant="ghost" disabled={busy} onClick={onRemove} />}
      </div>
      {note && <p className="pl-6 text-xs text-muted">{note}</p>}
    </li>
  );
}
