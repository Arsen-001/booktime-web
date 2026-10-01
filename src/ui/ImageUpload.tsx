'use client';

import { ImagePlus, LoaderCircle, X } from 'lucide-react';
import Image from 'next/image';
import { useId, useState, type ChangeEvent, type DragEvent } from 'react';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { IconButton } from '@/ui/IconButton';

export type ImageAspect = 'square' | '4/3' | '16/9';

export interface ImageUploadProps {
  /** data: URL картинок */
  value?: string[];
  onValueChange: (urls: string[]) => void;
  /** Сколько фото можно (1 по умолчанию; 6 — фото работ мастера, F-00-085) */
  max?: number;
  aspect?: ImageAspect;
  /** Подпись кнопки добавления */
  label?: string;
  /** Предел исходного файла, МБ */
  maxSizeMb?: number;
  /** Минимальные размеры ИСХОДНОГО файла (до сжатия), px */
  minWidth?: number;
  minHeight?: number;
  disabled?: boolean;
  className?: string;
}

const ASPECT: Record<ImageAspect, string> = {
  square: 'aspect-square',
  '4/3': 'aspect-[4/3]',
  '16/9': 'aspect-video',
};

const ACCEPT = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIDE = 800;
const QUALITY = 0.8;

/**
 * Файл → уменьшенный JPEG data URL (≈50–150 КБ), чтобы влезать в localStorage моковой базы.
 * Возвращает и РАЗМЕР ИСХОДНОГО файла — проверка минимальных размеров (например «нужно
 * минимум 2208×1024 для обложки приложения») должна идти по нему, а не по уже сжатой
 * картинке: она всегда ужата до MAX_SIDE=800 и такую проверку не пройдёт никогда.
 */
async function toDataUrl(file: File): Promise<{ url: string; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const width = bitmap.width;
  const height = bitmap.height;
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return { url: canvas.toDataURL('image/jpeg', QUALITY), width, height };
}

/**
 * Загрузка фото без сервера: выбор или перетаскивание, уменьшение в браузере, предпросмотр,
 * удаление. Значение — массив data URL.
 */
export function ImageUpload({
  value = [],
  onValueChange,
  max = 1,
  aspect = 'square',
  label,
  maxSizeMb = 10,
  minWidth,
  minHeight,
  disabled = false,
  className,
}: ImageUploadProps) {
  const t = useT('ui');
  const inputId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const free = Math.max(0, max - value.length);
  const single = max === 1;

  const addFiles = async (files: File[]) => {
    setError(null);
    const list = single ? files.slice(0, 1) : files.slice(0, free);
    if (list.length === 0) return;
    const bad = list.find((f) => !ACCEPT.includes(f.type));
    if (bad) return setError(t('upload.wrongType'));
    const big = list.find((f) => f.size > maxSizeMb * 1024 * 1024);
    if (big) return setError(t('upload.tooLarge', { mb: maxSizeMb }));
    setBusy(true);
    try {
      const results = await Promise.all(list.map(toDataUrl));
      if (minWidth || minHeight) {
        const tooSmall = results.find((r) => r.width < (minWidth ?? 0) || r.height < (minHeight ?? 0));
        if (tooSmall) {
          setError(t('upload.tooSmall', { w: minWidth ?? 0, h: minHeight ?? 0 }));
          return;
        }
      }
      const urls = results.map((r) => r.url);
      onValueChange(single ? urls : [...value, ...urls]);
    } catch {
      setError(t('upload.wrongType'));
    } finally {
      setBusy(false);
    }
  };

  const onInput = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    void addFiles(files);
  };

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragOver(false);
    if (disabled) return;
    void addFiles(Array.from(event.dataTransfer.files));
  };

  const removeAt = (index: number) => onValueChange(value.filter((_, i) => i !== index));
  const canAdd = !disabled && (single || free > 0);

  const addTile = (
    <label
      htmlFor={inputId}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-border-strong bg-surface p-3 text-center transition-colors hover:bg-surface-2',
        ASPECT[aspect],
        dragOver && 'border-primary bg-primary-soft',
        disabled && 'cursor-not-allowed opacity-60',
      )}
    >
      {busy ? (
        <LoaderCircle className="size-6 animate-spin text-muted" aria-hidden />
      ) : (
        <ImagePlus className="size-6 text-primary-text" aria-hidden />
      )}
      <span className="text-sm font-medium text-fg">
        {single && value.length ? t('upload.replace') : (label ?? t('upload.choose'))}
      </span>
      <span className="hidden text-xs text-muted sm:block">{t('upload.drop')}</span>
    </label>
  );

  return (
    <div className={cn('w-full', className)}>
      <input
        id={inputId}
        type="file"
        accept={ACCEPT.join(',')}
        multiple={!single}
        disabled={!canAdd || busy}
        onChange={onInput}
        className="sr-only"
      />
      <div className={cn('grid gap-3', single ? 'max-w-xs grid-cols-1' : 'grid-cols-3 sm:grid-cols-4 lg:grid-cols-6')}>
        {value.map((url, i) => (
          <div
            key={`${i}-${url.slice(-16)}`}
            className={cn('relative overflow-hidden rounded-xl border border-border bg-surface-2', ASPECT[aspect])}
          >
            <Image src={url} alt="" fill sizes="(max-width: 768px) 33vw, 200px" className="object-cover" unoptimized />
            {!disabled && (
              <IconButton
                size="sm"
                variant="secondary"
                icon={<X aria-hidden />}
                label={t('upload.remove')}
                onClick={() => removeAt(i)}
                className="absolute top-1.5 right-1.5 rounded-full bg-surface/90 shadow-sm"
              />
            )}
          </div>
        ))}
        {canAdd && (single ? value.length === 0 : true) && addTile}
      </div>
      {single && value.length > 0 && canAdd && (
        <label
          htmlFor={inputId}
          className="mt-2 inline-flex min-h-10 cursor-pointer items-center text-sm font-medium text-primary-text hover:underline"
        >
          {t('upload.replace')}
        </label>
      )}
      <p className={cn('mt-2 text-sm', error ? 'text-danger' : 'text-muted')} role={error ? 'alert' : undefined}>
        {error ?? t('upload.hint', { mb: maxSizeMb })}
      </p>
    </div>
  );
}
