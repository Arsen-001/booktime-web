'use client';

import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { MessageCircle, MessageSquareText, Send } from 'lucide-react';
import { cn } from '@/lib/cn';

export type PhoneVerifyChannel = 'whatsapp' | 'telegram' | 'sms';

export const CHANNEL_ICON: Record<PhoneVerifyChannel, ReactNode> = {
  whatsapp: <MessageCircle />,
  telegram: <Send />,
  sms: <MessageSquareText />,
};

export interface ChannelPickerProps {
  label: string;
  channels: PhoneVerifyChannel[];
  value: PhoneVerifyChannel;
  onValueChange: (value: PhoneVerifyChannel) => void;
  nameOf: (channel: PhoneVerifyChannel) => string;
}

/**
 * Куда прислать код — плитки «иконка над подписью» во всю ширину. Влезают в 390 px (в отличие от сегментов в строку),
 * выбранная — рамкой, заливкой и галочкой-цветом. Радиогруппа: стрелки ←/→ переключают.
 */
export function ChannelPicker({ label, channels, value, onValueChange, nameOf }: ChannelPickerProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const i = (channels.indexOf(value) + dir + channels.length) % channels.length;
    onValueChange(channels[i]);
    refs.current[i]?.focus();
  };

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-fg">{label}</span>
      <div
        role="radiogroup"
        aria-label={label}
        onKeyDown={onKeyDown}
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${channels.length}, minmax(0, 1fr))` }}
      >
        {channels.map((c, i) => {
          const on = c === value;
          return (
            <button
              key={c}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on ? 0 : -1}
              onClick={() => onValueChange(c)}
              className={cn(
                'flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 rounded-xl border px-1.5 py-2 text-sm font-medium',
                'transition-[border-color,background-color,color,box-shadow,transform] duration-150 ease-out active:scale-[0.98] [&_svg]:size-5',
                on
                  ? 'border-primary bg-primary-soft text-primary-text shadow-xs ring-1 ring-primary'
                  : 'border-border-strong/60 bg-surface text-fg hover:border-border-strong hover:bg-surface-2',
              )}
            >
              {CHANNEL_ICON[c]}
              <span className="max-w-full truncate">{nameOf(c)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
