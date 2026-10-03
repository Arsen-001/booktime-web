'use client';

/**
 * Загрузка фото из любого выбора картинки (04.10.2026, «Файлы и фото»). Куда грузить, понятно по разделу:
 * кабинет (/biz…) — фото текущего бизнеса, наша панель (/platform…) — панели, остальное (профиль клиента) — фото
 * человека. Режим mock — data: URL как раньше (src/api/uploads.ts).
 */
import { usePathname } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import { imageFileToUrl, type UploadTarget } from '@/api/uploads';
import { useCurrent } from '@/demo/hooks';

/** Куда грузить фото с текущей страницы; null — бизнес ещё не известен */
export function useUploadTarget(): UploadTarget | null {
  const pathname = usePathname() ?? '';
  const { businessId } = useCurrent();
  return useMemo(() => {
    if (pathname === '/platform' || pathname.startsWith('/platform/')) return { kind: 'platform' };
    if (pathname === '/biz' || pathname.startsWith('/biz/')) return businessId ? { kind: 'business', businessId } : null;
    return { kind: 'me' };
  }, [pathname, businessId]);
}

/** upload(file, onProgress) → { url, width, height }; target — явно, иначе по разделу */
export function useImageUploader(target?: UploadTarget) {
  const auto = useUploadTarget();
  const resolved = target ?? auto;
  return useCallback(
    (file: File, onProgress?: (fraction: number) => void) => imageFileToUrl(resolved, file, { onProgress }),
    [resolved],
  );
}

type UploadErrorKey =
  | 'upload.tooLargeServer'
  | 'upload.wrongType'
  | 'upload.quota'
  | 'upload.tooMany'
  | 'upload.network'
  | 'upload.signedOut'
  | 'upload.failed';

/** Ключ текста ошибки загрузки (пространство ui): код сервера → понятная фраза */
export function uploadErrorKey(error: unknown): UploadErrorKey {
  const code = (error as { code?: string } | null)?.code;
  switch (code) {
    case 'file_too_large':
      return 'upload.tooLargeServer';
    case 'unsupported_image':
      return 'upload.wrongType';
    case 'upload_quota':
      return 'upload.quota';
    case 'rate_limited':
      return 'upload.tooMany';
    case 'network':
      return 'upload.network';
    case 'unauthorized':
      return 'upload.signedOut';
    default:
      return 'upload.failed';
  }
}
