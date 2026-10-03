'use client';

/**
 * Фото на настоящем сервере (booktime-backend, модуль uploads, 04.10.2026): файл уходит multipart-запросом,
 * сервер проверяет и перекодирует его и отвечает адресом. XMLHttpRequest, а не fetch, — ради процента загрузки.
 * Ошибки — как у http(): { code } → HttpApiError (file_too_large, unsupported_image, upload_quota, rate_limited…).
 */
import { API_URL, HttpApiError } from '@/api/http';
import type { UploadedImage, UploadTarget } from '@/api/uploads';

export function uploadPath(target: UploadTarget): string {
  if (target.kind === 'business') return `/v1/biz/${encodeURIComponent(target.businessId)}/uploads`;
  if (target.kind === 'platform') return '/v1/platform/uploads';
  return '/v1/me/uploads';
}

export function uploadImageServer(
  target: UploadTarget,
  file: File,
  opts: { onProgress?: (fraction: number) => void; signal?: AbortSignal } = {},
): Promise<UploadedImage> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', API_URL + uploadPath(target));
    xhr.withCredentials = true;
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.responseType = 'text';
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) opts.onProgress?.(Math.min(1, e.loaded / e.total));
    };
    xhr.onload = () => {
      let data: unknown;
      try {
        data = xhr.responseText ? JSON.parse(xhr.responseText) : undefined;
      } catch {
        data = undefined;
      }
      if (xhr.status >= 200 && xhr.status < 300 && data && typeof (data as UploadedImage).url === 'string') {
        opts.onProgress?.(1);
        resolve(data as UploadedImage);
        return;
      }
      const err = (data ?? {}) as { code?: string; message?: string; retryAfter?: number };
      reject(new HttpApiError(xhr.status, err.code ?? 'internal', err.message, err.retryAfter));
    };
    xhr.onerror = () => reject(new HttpApiError(0, 'network', 'Server is unreachable'));
    xhr.onabort = () => reject(new HttpApiError(0, 'aborted', 'Upload cancelled'));
    opts.signal?.addEventListener('abort', () => xhr.abort(), { once: true });
    const form = new FormData();
    form.append('file', file, file.name || 'photo');
    xhr.send(form);
  });
}
