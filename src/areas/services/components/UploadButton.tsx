'use client';

/**
 * Кнопка «+ Загрузить» без собственного предпросмотра (У26): снимок показывается один раз — в списке экрана со
 * статусом проверки, а не дважды. Картинка уменьшается в браузере (как в ImageUpload), чтобы влезть в моковую базу.
 */
import { useId, useState } from 'react';
import { Plus } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';

const ACCEPT = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIDE = 800;

async function toDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.8);
}

export interface UploadButtonProps {
  label: string;
  onFiles: (files: { url: string; name: string }[]) => void;
  max?: number;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
}

export function UploadButton({ label, onFiles, max = 10, disabled, variant = 'secondary' }: UploadButtonProps) {
  const t = useT('ui');
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-1.5">
      <input
        id={id}
        type="file"
        accept={ACCEPT.join(',')}
        multiple={max > 1}
        className="sr-only"
        disabled={disabled}
        onChange={async (e) => {
          const files = Array.from(e.target.files ?? []).slice(0, max);
          e.target.value = '';
          setError(null);
          if (!files.length) return;
          if (files.some((f) => !ACCEPT.includes(f.type))) return setError(t('upload.wrongType'));
          setBusy(true);
          try {
            onFiles(
              await Promise.all(
                files.map(async (f) => ({
                  url: await toDataUrl(f),
                  name: f.name,
                })),
              ),
            );
          } catch {
            setError(t('upload.wrongType'));
          } finally {
            setBusy(false);
          }
        }}
      />
      <Button
        variant={variant}
        leftIcon={<Plus aria-hidden />}
        loading={busy}
        disabled={disabled || max <= 0}
        onClick={() => document.getElementById(id)?.click()}
        className="w-fit"
      >
        {label}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
