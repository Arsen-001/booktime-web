'use client';

/**
 * Фото (04.10.2026, «Файлы и фото»): одна функция для всех выборов картинки (ImageUpload, кнопки загрузки,
 * фото сотрудника). Режим `api` — файл уходит на сервер (src/api/uploads.server.ts), в поле кладётся адрес файла
 * (https://api…/v1/files/… или адрес бакета). Режим `mock` — как раньше: картинка уменьшается в браузере до
 * 800 px и хранится data: URL в моковой базе (localStorage). Поля фото принимают оба вида строк.
 */
import { isApiMode } from '@/api/http';
import { uploadImageServer } from '@/api/uploads.server';
import type { Id } from '@/domain/core';

/** Чьё фото: бизнес из кабинета, человек (профиль клиента), наша панель */
export type UploadTarget = { kind: 'business'; businessId: Id } | { kind: 'me' } | { kind: 'platform' };

/** Ответ сервера на загрузку */
export interface UploadedImage {
  id: string;
  url: string;
  thumbUrl: string;
  width: number;
  height: number;
  bytes: number;
}

/** Предел файла на сервере, МБ (больше — 413 file_too_large) */
export const SERVER_UPLOAD_MAX_MB = 10;

/** Картинки, которые принимают и мок (canvas), и сервер (проверка по сигнатуре) */
export const IMAGE_ACCEPT = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const MOCK_MAX_SIDE = 800;
const MOCK_QUALITY = 0.8;

/** Размер исходной картинки — проверка «минимум W×H» идёт по исходнику, а не по ужатой копии */
export async function readImageSize(file: File): Promise<{ width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const size = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return size;
}

/** Мок: файл → уменьшенный JPEG data URL (≈50–150 КБ), чтобы влезать в localStorage моковой базы */
export async function fileToDataUrl(file: File): Promise<{ url: string; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const width = bitmap.width;
  const height = bitmap.height;
  const scale = Math.min(1, MOCK_MAX_SIDE / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return { url: canvas.toDataURL('image/jpeg', MOCK_QUALITY), width, height };
}

/**
 * Файл → строка для поля фото. width/height: мок — исходника, сервер — сохранённого файла (≤ 2048 px; проверку
 * «минимум W×H» делайте по readImageSize до загрузки). Режим api без target (нет бизнеса в контексте) — ошибка.
 */
export async function imageFileToUrl(
  target: UploadTarget | null,
  file: File,
  opts: { onProgress?: (fraction: number) => void; signal?: AbortSignal } = {},
): Promise<{ url: string; width: number; height: number }> {
  if (!isApiMode()) return fileToDataUrl(file);
  if (!target) throw new Error('upload_target');
  const res = await uploadImageServer(target, file, opts);
  return { url: res.url, width: res.width, height: res.height };
}

/** Фото уходят на сервер (режим api) — экран показывает процент и «Повторить» */
export function uploadsUseServer(): boolean {
  return isApiMode();
}
