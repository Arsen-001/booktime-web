/**
 * Помощники для асинхронных действий окна записи — вынесены из компонентов намеренно.
 *
 * React Compiler (reactCompiler: true) целиком пропускает компонент, в теле которого есть `try … finally`
 * или `try … catch` с `?.`, `??`, `? :` внутри (ошибки BuildHIR «Handle TryStatement with a finalizer»,
 * «Support value blocks … within a try/catch»). Пропущенный компонент не запоминает ничего: окно записи
 * перерисовывало все три зоны на каждый ответ «сети» (qa/journal-redesign/open-window.mjs). Здесь — вне
 * компонента — такие конструкции компилятору не мешают.
 */

/** Флаг «идёт» на время `run`; ошибка уходит в `onError`, флаг снимается в любом случае. */
export async function runBusy(
  setBusy: (busy: boolean) => void,
  run: () => Promise<unknown>,
  onError: (err: unknown) => void,
): Promise<void> {
  setBusy(true);
  try {
    await run();
  } catch (err) {
    onError(err);
  } finally {
    setBusy(false);
  }
}

/** Выполнить и сказать, получилось ли (без броска наружу). */
export async function succeeded(run: () => Promise<unknown>): Promise<boolean> {
  try {
    await run();
    return true;
  } catch {
    return false;
  }
}
