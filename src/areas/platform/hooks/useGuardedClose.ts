'use client';

/**
 * Шторка с формой: закрыть (✕, фон, Esc, свайп) при несохранённом — сначала наш вопрос «Уйти без сохранения?»,
 * а не молча потерянный ввод. Переходы по ссылкам и перезагрузку ловит useUnsavedGuard.
 *
 *   const onOpenChange = useGuardedClose(dirty, onClose);
 *   <Sheet open onOpenChange={onOpenChange} … />
 */
import { useUnsavedGuard } from '@/ui/hooks/useUnsavedGuard';

export function useGuardedClose(dirty: boolean, onClose: () => void) {
  const { confirmLeave } = useUnsavedGuard(dirty);
  return async (open: boolean) => {
    if (open) return;
    if (await confirmLeave()) onClose();
  };
}
