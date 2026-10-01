/**
 * Копирование в буфer обмена с фолбэком (см. src/areas/online/links/copyText.ts — тот же приём,
 * свой файл, т.к. раздел не делится кодом с online напрямую).
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
