/**
 * Копирование текста в буфер (F-07-079 — «скопировать ссылку»). Свой минимальный хелпер раздела: у online
 * есть похожий (`src/areas/online/links/copyText.ts`), но компоненты чужих разделов не импортируем.
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
  if (typeof document === 'undefined') return false;
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '-1000px';
  document.body.appendChild(textarea);
  textarea.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  document.body.removeChild(textarea);
  return ok;
}
