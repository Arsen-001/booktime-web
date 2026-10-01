import type { ComponentPropsWithRef } from 'react';
import { cn } from '@/lib/cn';
import { FIELD_BASE, FIELD_BORDER } from '@/ui/Input';

export interface TextareaProps extends ComponentPropsWithRef<'textarea'> {
  invalid?: boolean;
  /** Высота растёт по содержимому (до ~20 строк) */
  autoResize?: boolean;
}

export function Textarea({ invalid = false, autoResize = false, rows = 3, className, ...rest }: TextareaProps) {
  return (
    <textarea
      rows={rows}
      aria-invalid={invalid || undefined}
      className={cn(
        FIELD_BASE,
        FIELD_BORDER[invalid ? 'invalid' : 'normal'],
        'min-h-24 px-3.5 py-2.5 leading-relaxed',
        autoResize ? 'field-sizing-content max-h-[32rem] resize-none' : 'resize-y',
        className,
      )}
      {...rest}
    />
  );
}
