'use client';

import { ImagePlus, LoaderCircle, RotateCcw, X } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useId, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { fileToDataUrl, IMAGE_ACCEPT, readImageSize, SERVER_UPLOAD_MAX_MB, uploadsUseServer, type UploadTarget } from '@/api/uploads';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { IconButton } from '@/ui/IconButton';
import { uploadErrorKey, useImageUploader } from '@/ui/useImageUploader';

export type ImageAspect = 'square' | '4/3' | '16/9';

export interface ImageUploadProps {
  /** Адреса картинок: файл на сервере (режим api) или data: URL (мок и старые данные) */
  value?: string[];
  onValueChange: (urls: string[]) => void;
  /** Сколько фото можно (1 по умолчанию; 6 — фото работ мастера, F-00-085) */
  max?: number;
  aspect?: ImageAspect;
  /** Подпись кнопки добавления */
  label?: string;
  /** Предел исходного файла, МБ (на сервере — не больше 10) */
  maxSizeMb?: number;
  /** Минимальные размеры ИСХОДНОГО файла (до сжатия), px */
  minWidth?: number;
  minHeight?: number;
  disabled?: boolean;
  className?: string;
  /**
   * Не показывать подсказку «JPG или PNG, до N МБ» под плиткой — экран пишет её сам рядом (узкая плитка аватара в
   * профиле: в колонке 80px подсказка ломалась в три строки). Ошибки показываются всё равно.
   */
  hideHint?: boolean;
  /** Куда грузить в режиме api; по умолчанию — по разделу (кабинет → бизнес, панель → панель, иначе — профиль) */
  uploadTarget?: UploadTarget;
}

const ASPECT: Record<ImageAspect, string> = {
  square: 'aspect-square',
  '4/3': 'aspect-[4/3]',
  '16/9': 'aspect-video',
};

/** Фото, которое сейчас грузится на сервер или не загрузилось (предпросмотр — локальный blob:) */
interface Pending {
  id: number;
  file: File;
  preview: string;
  progress: number;
  error: string | null;
}

let pendingSeq = 0;

/**
 * Выбор фото: кнопка или перетаскивание, предпросмотр, удаление. Режим mock — картинка уменьшается в браузере и
 * хранится data: URL; режим api — файл уходит на сервер (src/api/uploads.ts) с процентом поверх предпросмотра,
 * при ошибке — «Повторить», в значение попадает адрес файла.
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
  hideHint = false,
  uploadTarget,
}: ImageUploadProps) {
  const t = useT('ui');
  const inputId = useId();
  const upload = useImageUploader(uploadTarget);
  const server = uploadsUseServer();
  const limitMb = server ? Math.min(maxSizeMb, SERVER_UPLOAD_MAX_MB) : maxSizeMb;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [pending, setPending] = useState<Pending[]>([]);
  // Последнее значение: несколько загрузок заканчиваются по очереди, каждая добавляет к уже добавленному
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);
  const previews = useRef(new Set<string>());
  useEffect(() => {
    const urls = previews.current;
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  const single = max === 1;
  const free = Math.max(0, max - value.length - pending.length);
  const uploading = pending.some((p) => !p.error);

  const commit = (url: string) => {
    const next = single ? [url] : [...valueRef.current, url];
    valueRef.current = next;
    onValueChange(next);
  };

  const patchPending = (id: number, patch: Partial<Pending>) => setPending((list) => list.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const dropPending = (id: number) =>
    setPending((list) => {
      const item = list.find((p) => p.id === id);
      if (item) {
        URL.revokeObjectURL(item.preview);
        previews.current.delete(item.preview);
      }
      return list.filter((p) => p.id !== id);
    });

  const runUpload = async (item: Pending) => {
    patchPending(item.id, { progress: 0, error: null });
    try {
      const res = await upload(item.file, (f) => patchPending(item.id, { progress: f }));
      commit(res.url);
      dropPending(item.id);
    } catch (e) {
      patchPending(item.id, { error: t(uploadErrorKey(e), { mb: SERVER_UPLOAD_MAX_MB }) });
    }
  };

  const addFiles = async (files: File[]) => {
    setError(null);
    const list = single ? files.slice(0, 1) : files.slice(0, free);
    if (list.length === 0) return;
    const bad = list.find((f) => !IMAGE_ACCEPT.includes(f.type));
    if (bad) return setError(t('upload.wrongType'));
    const big = list.find((f) => f.size > limitMb * 1024 * 1024);
    if (big) return setError(t('upload.tooLarge', { mb: limitMb }));
    setBusy(true);
    try {
      if (minWidth || minHeight) {
        const sizes = await Promise.all(list.map(readImageSize));
        if (sizes.some((s) => s.width < (minWidth ?? 0) || s.height < (minHeight ?? 0))) {
          setError(t('upload.tooSmall', { w: minWidth ?? 0, h: minHeight ?? 0 }));
          return;
        }
      }
      if (!server) {
        const results = await Promise.all(list.map(fileToDataUrl));
        const urls = results.map((r) => r.url);
        onValueChange(single ? urls : [...value, ...urls]);
        return;
      }
      const items = list.map((file): Pending => {
        const preview = URL.createObjectURL(file);
        previews.current.add(preview);
        return { id: ++pendingSeq, file, preview, progress: 0, error: null };
      });
      setPending((cur) => {
        if (!single) return [...cur, ...items];
        cur.forEach((p) => URL.revokeObjectURL(p.preview));
        return items;
      });
      void Promise.all(items.map(runUpload));
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
  // Одно фото: пока новое грузится, вместо старого показывается оно
  const shown = single && pending.length ? [] : value;
  const failed = pending.find((p) => p.error);

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
        accept={IMAGE_ACCEPT.join(',')}
        multiple={!single}
        disabled={!canAdd || busy || (single && uploading)}
        onChange={onInput}
        className="sr-only"
      />
      <div className={cn('grid gap-3', single ? 'max-w-xs grid-cols-1' : 'grid-cols-3 sm:grid-cols-4 lg:grid-cols-6')}>
        {shown.map((url, i) => (
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
        {pending.map((p) => (
          <div
            key={p.id}
            className={cn(
              'relative overflow-hidden rounded-xl border bg-surface-2',
              p.error ? 'border-danger' : 'border-border',
              ASPECT[aspect],
            )}
          >
            <Image src={p.preview} alt="" fill sizes="(max-width: 768px) 33vw, 200px" className="object-cover opacity-60" unoptimized />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-surface/50 p-2 text-center">
              {p.error ? (
                <IconButton
                  variant="secondary"
                  icon={<RotateCcw aria-hidden />}
                  label={t('upload.retry')}
                  onClick={() => void runUpload(p)}
                  className="rounded-full bg-surface shadow-sm"
                />
              ) : (
                <>
                  <LoaderCircle className="size-6 animate-spin text-primary-text" aria-hidden />
                  <span className="text-xs font-semibold text-fg tabular-nums" aria-live="polite">
                    {t('upload.uploading', { pct: Math.round(p.progress * 100) })}
                  </span>
                </>
              )}
            </div>
            <IconButton
              size="sm"
              variant="secondary"
              icon={<X aria-hidden />}
              label={t('upload.remove')}
              onClick={() => dropPending(p.id)}
              className="absolute top-1.5 right-1.5 rounded-full bg-surface/90 shadow-sm"
            />
          </div>
        ))}
        {canAdd && (single ? value.length === 0 && pending.length === 0 : true) && addTile}
      </div>
      {single && value.length > 0 && pending.length === 0 && canAdd && (
        <label
          htmlFor={inputId}
          className="mt-2 inline-flex min-h-10 cursor-pointer items-center text-sm font-medium text-primary-text hover:underline"
        >
          {t('upload.replace')}
        </label>
      )}
      {failed ? (
        <p className="mt-2 text-sm text-danger" role="alert">
          {failed.error} <span className="text-muted">· {t('upload.retryHint')}</span>
        </p>
      ) : hideHint && !error ? null : (
        <p className={cn('mt-2 text-sm', error ? 'text-danger' : 'text-muted')} role={error ? 'alert' : undefined}>
          {error ?? t('upload.hint', { mb: limitMb })}
        </p>
      )}
    </div>
  );
}
