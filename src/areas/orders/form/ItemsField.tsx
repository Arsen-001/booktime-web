'use client';

/** «Что сдали»: строки «вещь · количество · примечание», добавить и убрать строку. */
import { Plus, Trash2 } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { newItem, type ItemDraft } from '@/areas/orders/form/orderForm';
import { Button } from '@/ui/Button';
import { IconButton } from '@/ui/IconButton';
import { Input } from '@/ui/Input';

export interface ItemsFieldProps {
  value: ItemDraft[];
  onChange: (items: ItemDraft[]) => void;
  error?: string;
}

export function ItemsField({ value, onChange, error }: ItemsFieldProps) {
  const t = useT('orders');
  const patch = (key: string, p: Partial<ItemDraft>) => onChange(value.map((i) => (i.key === key ? { ...i, ...p } : i)));

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-3">
        {value.map((item, index) => (
          <li key={item.key} className="flex flex-col gap-2 rounded-xl border border-border p-3">
            <div className="flex items-start gap-2">
              <Input
                aria-label={t('form.itemTitle', { n: index + 1 })}
                value={item.title}
                onChange={(e) => patch(item.key, { title: e.target.value })}
                placeholder={t('form.itemTitlePlaceholder')}
                invalid={Boolean(error) && index === 0 && !item.title.trim()}
                classNames={{ root: 'min-w-0 flex-1' }}
                autoComplete="off"
              />
              <Input
                aria-label={t('form.itemQty')}
                value={item.qty}
                onChange={(e) => patch(item.key, { qty: e.target.value.replace(/\D/g, '').slice(0, 3) })}
                inputMode="numeric"
                classNames={{ root: 'w-16 shrink-0', input: 'text-center' }}
              />
              {value.length > 1 && (
                <IconButton
                  icon={<Trash2 aria-hidden />}
                  label={t('form.itemRemove')}
                  variant="ghost"
                  onClick={() => onChange(value.filter((i) => i.key !== item.key))}
                />
              )}
            </div>
            <Input
              aria-label={t('form.itemNote')}
              value={item.note}
              onChange={(e) => patch(item.key, { note: e.target.value })}
              placeholder={t('form.itemNotePlaceholder')}
              size="sm"
              autoComplete="off"
            />
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <Button variant="secondary" size="sm" className="self-start" leftIcon={<Plus aria-hidden />} onClick={() => onChange([...value, newItem()])}>
        {t('form.itemAdd')}
      </Button>
    </div>
  );
}
