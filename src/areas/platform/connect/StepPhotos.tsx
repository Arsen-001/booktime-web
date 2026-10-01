'use client';

/** Шаг «Фото»: до 6 фото, снятых на визите, — клиенты видят их сразу, без проверки (F-00-171). */
import type { ConnectForm } from '@/areas/platform/connect/connectForm';
import { useT } from '@/i18n/useT';
import { ImageUpload } from '@/ui/ImageUpload';

export function StepPhotos({ form, onChange }: { form: ConnectForm; onChange: (patch: Partial<ConnectForm>) => void }) {
  const t = useT('platform');
  return (
    <div data-f="F-00-171">
      <ImageUpload value={form.photos} onValueChange={(urls) => onChange({ photos: urls })} max={6} aspect="4/3" label={t('connect.addPhoto')} />
    </div>
  );
}
