'use client';

import type { FieldsetHTMLAttributes, ReactElement } from 'react';
import { Eye } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { Tooltip } from '@/ui/Tooltip';

/**
 * «Только просмотр» по праву (проход 17.11.2026): раздел открыт правом на просмотр (зарплата — «смотреть», онлайн-запись
 * — «своя», ресурсы, услуги, график без права менять), а кнопки изменений были активны и сервер отвечал 403. Теперь
 * экран показывает эту строку сверху, а поля и кнопки изменений — неактивны (ViewOnlyFieldset / ViewOnlyTip), как
 * в замороженном кабинете. На телефоне подсказка по наведению не видна — поэтому строка сверху обязательна.
 */
export function ViewOnlyNote({ className }: { className?: string }) {
  const t = useT('ui');
  return (
    <div role="note" className={cn('flex items-start gap-3 rounded-xl bg-surface-2 px-4 py-3 text-sm text-muted', className)}>
      <Eye aria-hidden className="mt-0.5 size-4 shrink-0" />
      <p>
        <span className="font-medium text-fg">{t('permission.viewOnly')}</span> · {t('permission.viewOnlyHint')}
      </p>
    </div>
  );
}

/**
 * Поля и кнопки формы неактивны без права: `<fieldset disabled>` гасит все кнопки, поля, переключатели и списки
 * внутри (и наши из src/ui — они на нативных button/input). Навигацию (вкладки, даты, «Копировать») держите снаружи.
 */
export function ViewOnlyFieldset({ disabled, children, className, ...rest }: { disabled: boolean } & Omit<FieldsetHTMLAttributes<HTMLFieldSetElement>, 'disabled'>) {
  return (
    <fieldset {...rest} disabled={disabled} className={cn('m-0 min-w-0 border-0 p-0', className)}>
      {children}
    </fieldset>
  );
}

/** Одна кнопка изменения без права — неактивна, по наведению «Только просмотр — нет права менять» */
export function ViewOnlyTip({ disabled, children }: { disabled: boolean; children: ReactElement<{ 'aria-describedby'?: string }> }) {
  const t = useT('ui');
  return (
    <Tooltip content={t('permission.viewOnlyTip')} disabled={!disabled}>
      {children}
    </Tooltip>
  );
}
