'use client';

/**
 * F-13-034: «О приложении» — галерея (счётчик до 5), видео, описание/возможности/FAQ отдельно на каждом из
 * трёх языков интерфейса (⭐ по нашему решению — F-00-172). Картинки настоящие не грузим (правило раздела:
 * только интерфейс, без запросов наружу) — считаем плашки-заглушки.
 */
import { useState } from 'react';
import { Image as ImageIcon, Plus, Trash2 } from 'lucide-react';
import { updateDevAppAbout } from '@/api/integrations';
import { useApiMutation } from '@/api/request';
import {
  DEV_APP_DESCRIPTION_MAX,
  DEV_APP_FAQ_ANSWER_MAX,
  DEV_APP_FAQ_QUESTION_MAX,
  DEV_APP_GALLERY_MAX,
  DEV_APP_LOCALES,
  type DevApp,
  type DevAppAboutText,
  type DevAppLocale,
} from '@/domain/integrations';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { IconButton } from '@/ui/IconButton';
import { Input } from '@/ui/Input';
import { SectionCard } from '@/ui/SectionCard';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { TagInput } from '@/ui/TagInput';
import { Textarea } from '@/ui/Textarea';
import { useToast } from '@/ui/Toast';

const EMPTY_TEXT: DevAppAboutText = { description: '', features: [], faq: [] };

export function AboutTab({ app, onChanged }: { app: DevApp; onChanged: () => void }) {
  const t = useT('integrations');
  const toast = useToast();
  const [locale, setLocale] = useState<DevAppLocale>('ru');
  const [gallery, setGallery] = useState(app.about.galleryCount);
  const [videoUrl, setVideoUrl] = useState(app.about.videoUrl ?? '');
  const [texts, setTexts] = useState<Partial<Record<DevAppLocale, DevAppAboutText>>>(app.about.byLocale);
  const mutation = useApiMutation((input: { locale: DevAppLocale; text: DevAppAboutText; galleryCount: number; videoUrl: string }) =>
    updateDevAppAbout(app.id, input),
  );

  const current = texts[locale] ?? EMPTY_TEXT;
  const setCurrent = (patch: Partial<DevAppAboutText>) => setTexts((prev) => ({ ...prev, [locale]: { ...(prev[locale] ?? EMPTY_TEXT), ...patch } }));

  const addFaq = () => setCurrent({ faq: [...current.faq, { q: '', a: '' }] });
  const removeFaq = (i: number) => setCurrent({ faq: current.faq.filter((_, idx) => idx !== i) });
  const patchFaq = (i: number, patch: Partial<{ q: string; a: string }>) =>
    setCurrent({ faq: current.faq.map((f, idx) => (idx === i ? { ...f, ...patch } : f)) });

  const save = async () => {
    try {
      await mutation.mutate({ locale, text: current, galleryCount: gallery, videoUrl });
      toast.success(t('developers.about.saved'));
      onChanged();
    } catch {
      toast.error(t('errors.actionFailed'));
    }
  };

  return (
    <div data-f="F-13-034" className="flex flex-col gap-4">
      <SectionCard title={t('developers.about.galleryTitle')} description={t('developers.about.galleryHint')}>
        <div className="flex flex-wrap items-center gap-2">
          {Array.from({ length: DEV_APP_GALLERY_MAX }).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setGallery(i < gallery ? i : i + 1)}
              className={`flex h-16 w-16 items-center justify-center rounded-lg border-2 border-dashed text-muted transition ${
                i < gallery ? 'border-primary bg-primary-soft text-primary-text' : 'border-border hover:border-border-strong'
              }`}
              aria-pressed={i < gallery}
              aria-label={t('developers.about.gallerySlot', { n: i + 1 })}
            >
              <ImageIcon className="h-5 w-5" aria-hidden />
            </button>
          ))}
          <span className="text-sm text-muted">{t('developers.about.galleryCount', { n: gallery, max: DEV_APP_GALLERY_MAX })}</span>
        </div>
        <div className="mt-4">
          <Input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder={t('developers.about.videoPlaceholder')} />
        </div>
      </SectionCard>

      <SectionCard
        title={t('developers.about.textsTitle')}
        description={t('developers.about.textsHint')}
        actions={<SegmentedControl options={DEV_APP_LOCALES.map((l) => ({ value: l, label: l.toUpperCase() }))} value={locale} onValueChange={(v) => setLocale(v as DevAppLocale)} />}
      >
        <div className="flex flex-col gap-4">
          <div>
            <Textarea
              value={current.description}
              onChange={(e) => setCurrent({ description: e.target.value.slice(0, DEV_APP_DESCRIPTION_MAX) })}
              rows={6}
              placeholder={t('developers.about.descriptionPlaceholder')}
            />
            <p className="mt-1 text-right text-xs text-muted">{current.description.length}/{DEV_APP_DESCRIPTION_MAX}</p>
          </div>

          <div>
            <p className="mb-1.5 text-sm font-medium text-fg">{t('developers.about.featuresLabel')}</p>
            <TagInput value={current.features} onValueChange={(features) => setCurrent({ features })} placeholder={t('developers.about.featuresPlaceholder')} />
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-fg">{t('developers.about.faqLabel')}</p>
              <Button variant="ghost" size="sm" leftIcon={<Plus aria-hidden />} onClick={addFaq}>
                {t('developers.about.faqAdd')}
              </Button>
            </div>
            {current.faq.length === 0 && <p className="text-sm text-muted">{t('developers.about.faqEmpty')}</p>}
            {current.faq.map((f, i) => (
              <div key={i} className="rounded-lg border border-border p-3">
                <div className="flex items-start gap-2">
                  <div className="flex-1">
                    <Input
                      value={f.q}
                      onChange={(e) => patchFaq(i, { q: e.target.value.slice(0, DEV_APP_FAQ_QUESTION_MAX) })}
                      placeholder={t('developers.about.faqQuestion')}
                    />
                    <Textarea
                      value={f.a}
                      onChange={(e) => patchFaq(i, { a: e.target.value.slice(0, DEV_APP_FAQ_ANSWER_MAX) })}
                      rows={2}
                      className="mt-2"
                      placeholder={t('developers.about.faqAnswer')}
                    />
                  </div>
                  <IconButton icon={<Trash2 aria-hidden />} label={t('developers.about.faqRemove')} variant="ghost" onClick={() => removeFaq(i)} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </SectionCard>

      <Button loading={mutation.isPending} onClick={save} className="self-start">
        {t('developers.about.save')}
      </Button>
    </div>
  );
}
