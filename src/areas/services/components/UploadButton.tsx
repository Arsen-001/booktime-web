'use client';

/**
 * Кнопка «+ Загрузить» без собственного предпросмотра (У26): снимок показывается один раз — в списке экрана со
 * статусом проверки, а не дважды. Мок — картинка уменьшается в браузере (data: URL), режим api — файл уходит на
 * сервер и в список попадает его адрес (src/api/uploads.ts, 04.10.2026).
 */
import { useId, useState } from 'react';
import { Plus } from 'lucide-react';
import { IMAGE_ACCEPT, SERVER_UPLOAD_MAX_MB } from '@/api/uploads';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { uploadErrorKey, useImageUploader } from '@/ui/useImageUploader';

const ACCEPT = IMAGE_ACCEPT;

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
  const upload = useImageUploader();
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
                  url: (await upload(f)).url,
                  name: f.name,
                })),
              ),
            );
          } catch (err) {
            setError(t(uploadErrorKey(err), { mb: SERVER_UPLOAD_MAX_MB }));
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
