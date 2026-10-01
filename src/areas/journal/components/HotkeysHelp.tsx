'use client';

/**
 * Список горячих клавиш журнала (⭐ рабочий день №8): открывается клавишей «?» и пунктом «⋯ Ещё → Горячие клавиши».
 * Клавиши физические — подписаны так, как нарисованы на английской раскладке, и работают на любой.
 */
import { Keyboard } from 'lucide-react';
import { HOTKEY_LIST } from '@/areas/journal/lib/hotkeys';
import { useT } from '@/i18n/useT';
import { Modal } from '@/ui/Modal';

export function HotkeysHelp({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useT('journal');
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={t('hotkeys.title')} description={t('hotkeys.description')} size="sm">
      <ul className="flex flex-col">
        {HOTKEY_LIST.map(({ action, keys }) => (
          <li key={action} className="flex min-h-11 items-center justify-between gap-4 border-b border-line py-2 last:border-b-0">
            <span className="text-sm text-fg">{t(`hotkeys.actions.${action}`)}</span>
            <span className="flex shrink-0 items-center gap-1">
              {keys.map((k) => (
                <kbd
                  key={k}
                  className="inline-flex h-7 min-w-7 items-center justify-center rounded-md border border-border-strong/40 bg-surface-2 px-2 font-sans text-xs font-semibold text-fg shadow-xs"
                >
                  {k}
                </kbd>
              ))}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-4 flex items-center gap-2 text-xs text-muted">
        <Keyboard aria-hidden className="size-4 shrink-0" />
        {t('hotkeys.layoutNote')}
      </p>
    </Modal>
  );
}
