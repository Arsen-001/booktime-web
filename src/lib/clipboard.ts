/**
 * Копирование текста в буфер обмена с фолбэком (arch-a1 №7: одна копия вместо четырёх).
 * Async Clipboard API не всегда доступен — нет разрешения, страница без фокуса, headless-браузер.
 * Фолбэк — скрытый textarea + document.execCommand('copy'): работает синхронно из обработчика клика.
 *
 *   if (await copyText(link)) toast.success(tc('states.copied'));
 *
 * Возвращает true, если хотя бы один способ сработал.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // нет разрешения — пробуем старый способ
  }
  return copyViaExecCommand(text);
}

function copyViaExecCommand(text: string): boolean {
  if (typeof document === 'undefined') return false;
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '-1000px';
  textarea.style.left = '-1000px';
  document.body.appendChild(textarea);
  textarea.select();
  textarea.setSelectionRange(0, text.length);
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  document.body.removeChild(textarea);
  return ok;
}
