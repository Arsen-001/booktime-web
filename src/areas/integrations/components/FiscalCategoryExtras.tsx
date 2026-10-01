'use client';

/**
 * F-13-203: категория «Фискальные документы» (ՀԴՄ) — пока «Скоро». Ревью 27.09 (И8): вместо повтора
 * описания из шапки — что понадобится для подключения и как чек будет связан с оплатой визита.
 * Кнопка «Сообщить о запуске» — общая карточка «Скоро» ниже (F-13-005).
 */
import { CheckCircle2, Receipt } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { Card } from '@/ui/Card';

export function FiscalCategoryExtras() {
  const t = useT('integrations');
  const needs = t.raw('category.fiscal.needs.items') as string[];
  return (
    <Card data-f="F-13-203" className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-text" aria-hidden>
          <Receipt className="h-5 w-5" />
        </span>
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold text-fg">{t('category.fiscal.howTitle')}</p>
          <p className="text-sm text-muted">{t('category.fiscal.howText')}</p>
        </div>
      </div>
      <div className="flex flex-col gap-2 rounded-lg bg-surface-2 p-3">
        <p className="text-sm font-semibold text-fg">{t('category.fiscal.needs.title')}</p>
        <ul className="flex flex-col gap-1.5 text-sm text-fg">
          {needs.map((item) => (
            <li key={item} className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
