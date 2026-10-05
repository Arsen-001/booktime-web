'use client';

/**
 * Сохранить JSON-файл («Скачать мои данные» — кабинет сотрудника и профиль клиента, 05.10.2026 — одно место).
 * В приложении — системное «Поделиться» (там нет загрузок браузера, оттуда «Сохранить в Файлы»), иначе — скачивание.
 */
import { nativeApp } from '@/lib/native/bridge';

export async function saveJsonFile(filename: string, content: string): Promise<void> {
  const blob = new Blob([content], { type: 'application/json' });
  const file = typeof File === 'function' ? new File([blob], filename, { type: 'application/json' }) : null;
  if (nativeApp() && file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return;
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** booktime-my-data-ГГГГ-ММ-ДД.json — как у сервера (GET /v1/me/data-export) */
export function myDataFilename(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `booktime-my-data-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}.json`;
}
