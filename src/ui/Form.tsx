import type { ComponentPropsWithRef } from 'react';
import { cn } from '@/lib/cn';

export type FormProps = ComponentPropsWithRef<'form'>;

/**
 * Форма без системной проверки браузера: `noValidate` всегда — никаких всплывашек «Заполните это поле»; ошибки
 * показывает FormField под полем (react-hook-form + zod). По умолчанию — столбик полей с шагом 16 px.
 *   <Form onSubmit={form.handleSubmit(save)}>…</Form>
 */
export function Form({ className, ...rest }: FormProps) {
  return <form className={cn('flex flex-col gap-4', className)} {...rest} noValidate />;
}
