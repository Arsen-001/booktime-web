/**
 * Копирование текста в буфер обмена с фолбэком (F-03-009). Async Clipboard API не всегда доступен —
 * нет разрешения, страница без фокуса, headless-браузер без grant (именно так тест не мог подтвердить
 * копирование). Фолбэк — скрытый textarea + `document.execCommand('copy')`, старый, но не требует
 * разрешения и работает синхронно из обработчика клика.
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
    // падаем на фолбэк ниже
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
