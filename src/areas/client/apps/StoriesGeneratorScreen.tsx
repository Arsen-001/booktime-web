'use client';

/**
 * Сторис вверху главной приложения клиента (F-00-155…163, F-14-033…036, F-14-172): одна кнопка → готовая
 * картинка → «Опубликовать»; своя фотография ждёт ручной проверки platform (F-00-168).
 *
 * Тот же экран — наш эквивалент «Картинки свободных окон» из каталога интеграций (карточка
 * `ia_builtin_openslots`, `builtinHref: '/biz/apps/stories'`): F-13-125 (раскладка по мастерам —
 * выбор мастеров ниже), F-13-126 (фильтр длительности — `shortestService` внутри
 * `generateStoryPreview`, `@/api/client`), F-13-127/F-13-128 (доставка — по нашему решению не
 * Telegram, а «Поделиться» в системное меню, `handleShare`), F-13-129 (лимиты и цена — картинка
 * входит в подписку, `slotsQ`/`STORY_BASE_PRICE`), F-13-130 (окон нет — `noWindowsWarning`,
 * публикация заблокирована).
 */
import { useState } from 'react';
import { Camera, Share2, Sparkles, Trash2, Wand2 } from 'lucide-react';
import {
  deleteStory,
  generateStoryPreview,
  getCoinBalance,
  getPlaceCard,
  getStorySlotsInfo,
  listBusinessStories,
  listStaffBrief,
  purchaseStory,
  STORY_BASE_PRICE,
  STORY_MAX_ACTIVE_SLOTS,
  STORY_QUEUE_PRICE,
  type StorySlotWindowPreview,
} from '@/api/client';
import { ApiError, useApiMutation, useApiQuery } from '@/api/request';
import { useCan, useCurrent } from '@/demo/hooks';
import type { Story, StoryLang } from '@/domain/client';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { FormField } from '@/ui/FormField';
import { IconButton } from '@/ui/IconButton';
import { ImageUpload } from '@/ui/ImageUpload';
import { Input } from '@/ui/Input';
import { PageHeader } from '@/ui/PageHeader';
import { usePagedList } from '@/ui/Pagination';
import { SectionCard } from '@/ui/SectionCard';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { Skeleton, SkeletonText } from '@/ui/Skeleton';
import { useSkeletonCount } from '@/ui/hooks/useSkeletonCount';
import { StatCard } from '@/ui/StatCard';
import { Switch } from '@/ui/Switch';
import { Tabs } from '@/ui/Tabs';
import { useToast } from '@/ui/Toast';

const LANGS: StoryLang[] = ['ru', 'hy', 'en'];
/** Ширины имён мастеров в скелетоне — как типичные «Имя Фамилия» */
const STAFF_CHIP_WIDTHS = ['10.7ch', '15.8ch', '12.7ch', '13.6ch'];

export function StoriesGeneratorScreen() {
  const t = useT('client');
  const { ready, businessId } = useCurrent();
  // С billing.manage — сторис салона: видны и удаляются все; мастер без него публикует и видит свои (владелец, 01.10.2026)
  const canManage = useCan('billing.manage');
  const staffNamesQ = useApiQuery(['staff-brief', businessId], () => listStaffBrief(businessId!), { enabled: ready && Boolean(businessId) && canManage });

  const balanceQ = useApiQuery(['coins', businessId], () => getCoinBalance(businessId!), { enabled: ready && Boolean(businessId) });
  const slotsQ = useApiQuery(['story-slots'], () => getStorySlotsInfo(), { enabled: ready });
  const listQ = useApiQuery(['business-stories', businessId], () => listBusinessStories(businessId!), {
    enabled: ready && Boolean(businessId),
  });
  // Постранично, как во всех списках (DESIGN.md → Long lists)
  const { pageItems, pager } = usePagedList(listQ.data ?? []);
  const storiesSkeletonCount = useSkeletonCount('business-stories', { loading: listQ.isLoading || !ready, count: pageItems.length, fallback: 1, max: 10 });

  return (
    <div
      data-f="F-00-155 F-00-156 F-00-157 F-00-158 F-00-160 F-14-172 F-03-050 F-03-051 F-13-122 F-13-123 F-13-124 F-13-125 F-13-126 F-13-127 F-13-128 F-13-129 F-13-130 F-02-091"
      className="flex flex-col gap-6"
    >
      <PageHeader
        title={t('apps.stories.title')}
        description={t('apps.stories.subtitle')}
        actions={
          canManage ? (
            <Badge tone="accent" variant="soft">
              {balanceQ.isLoading ? <SkeletonText width="10ch" /> : t('apps.stories.balance', { amount: balanceQ.data ?? 0 })}
            </Badge>
          ) : undefined
        }
      />

      {(slotsQ.data || slotsQ.isLoading) && (
        <Card padding="sm" className="flex items-center justify-between gap-3 bg-surface-2 text-sm text-muted">
          <span>{slotsQ.data ? t('apps.stories.slotsInfo', { used: slotsQ.data.used, max: slotsQ.data.max }) : <SkeletonText width="18ch" />}</span>
          {slotsQ.data && slotsQ.data.used >= STORY_MAX_ACTIVE_SLOTS && (
            <Badge tone="warning" variant="soft">
              {t('apps.stories.slotsFull')}
            </Badge>
          )}
        </Card>
      )}

      {/* Форма — с первого кадра (бизнес ещё не известен — без ввода, мастера полосами) */}
      {(businessId || !ready) && <Generator businessId={businessId ?? ''} ownOnly={!canManage} onPublished={() => void listQ.refetch()} />}

      <SectionCard title={t('apps.stories.myStoriesTitle')}>
        {listQ.isLoading || !ready ? (
          <ul className="flex flex-col gap-3" aria-busy="true">
            {Array.from({ length: storiesSkeletonCount }, (_, i) => (
              <StoryRowSkeleton key={i} />
            ))}
          </ul>
        ) : listQ.isError ? (
          <ErrorState compact onRetry={() => void listQ.refetch()} />
        ) : !listQ.data?.length ? (
          <EmptyState
            compact
            icon={<Sparkles aria-hidden className="size-8 text-muted" />}
            title={t('apps.stories.myStoriesEmpty')}
          />
        ) : (
          <>
            <ul className="flex flex-col gap-3">
              {pageItems.map((s) => (
                <StoryRow
                  key={s.id}
                  story={s}
                  authorName={canManage && s.authorStaffId ? staffNamesQ.data?.find((x) => x.id === s.authorStaffId)?.name : undefined}
                />
              ))}
            </ul>
            {pager}
          </>
        )}
      </SectionCard>
    </div>
  );
}

/** Скелетон сторис в «Мои сторис» — та же строка: картинка 9:16, метка статуса */
function StoryRowSkeleton() {
  const t = useT('client');
  return (
    <li aria-hidden className="flex flex-col gap-3 rounded-xl border border-border p-3 sm:flex-row sm:items-center">
      <Skeleton variant="rect" className="h-32 w-16 rounded-lg sm:h-20 sm:w-11" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="neutral" variant="soft">
            <SkeletonText width="8ch" />
          </Badge>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          <StatCard className="gap-1 p-2.5" label={t('apps.stories.stat.views')} value={0} loading />
          <StatCard className="gap-1 p-2.5" label={t('apps.stories.stat.clicks')} value={0} loading />
          <StatCard className="gap-1 p-2.5" label={t('apps.stories.stat.bookings')} value={0} loading />
        </div>
      </div>
    </li>
  );
}

function StoryRow({ story, authorName }: { story: Story; authorName?: string }) {
  const t = useT('client');
  const toast = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const remove = useApiMutation(deleteStory);
  const statusTone = {
    active: 'success',
    pending_review: 'warning',
    queued: 'info',
    expired: 'neutral',
    rejected: 'danger',
  } as const;

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-border p-3 sm:flex-row sm:items-center">
      <img src={story.imageUrl} alt="" className="h-32 w-16 rounded-lg object-cover sm:h-20 sm:w-11" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={statusTone[story.status]} variant="soft">
            {t(`apps.stories.status.${story.status}`)}
          </Badge>
          {story.kind === 'photo' && (
            <Badge tone="neutral" variant="outline">
              {t('apps.stories.kindPhoto')}
            </Badge>
          )}
          {authorName && <span className="text-xs text-muted">{t('apps.stories.byStaff', { name: authorName })}</span>}
        </div>
        {story.status === 'active' && (
          // Три StatCard в 130px-колонке (390px/3) не помещают иконку + «Нажатия»/«Записи» в одну
          // строку без обрезки (F-00-162) — здесь плотный вариант: без иконок, меньше отступов,
          // подпись переносится на вторую строку вместо того чтобы резаться.
          <div data-f="F-00-162" className="mt-2 grid grid-cols-3 gap-1.5">
            <StatCard className="gap-1 p-2.5" label={t('apps.stories.stat.views')} value={story.viewCount} />
            <StatCard className="gap-1 p-2.5" label={t('apps.stories.stat.clicks')} value={story.clickCount} />
            <StatCard className="gap-1 p-2.5" label={t('apps.stories.stat.bookings')} value={story.bookingCount} />
          </div>
        )}
      </div>
      <IconButton
        icon={<Trash2 aria-hidden />}
        label={t('apps.stories.deleteCta')}
        variant="ghost"
        className="self-end sm:self-center"
        onClick={() => setConfirmDelete(true)}
      />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        tone="danger"
        title={t('apps.stories.deleteConfirmTitle')}
        description={t('apps.stories.deleteConfirmHint')}
        confirmLabel={t('apps.stories.deleteCta')}
        onConfirm={async () => {
          try {
            await remove.mutate(story.id);
            toast.success(t('apps.stories.deleted'));
          } catch {
            toast.error(t('apps.stories.deleteFailed'));
          }
        }}
      />
    </li>
  );
}

// Минимальный размер своей фотографии для сторис (F-14-034) — подтверждается текстом-подсказкой
// `apps.stories.photoRequirements`. `ImageUpload` — общий компонент (src/ui), сам размер не проверяет,
// поэтому меряем картинку здесь, после того как файл уже превратился в data URL.
const MIN_STORY_PHOTO_WIDTH = 667;
const MIN_STORY_PHOTO_HEIGHT = 375;

function Generator({ businessId, ownOnly, onPublished }: { businessId: string; ownOnly: boolean; onPublished: () => void }) {
  const t = useT('client');
  const toast = useToast();
  const [tab, setTab] = useState<'generated' | 'photo'>('generated');
  const [period, setPeriod] = useState<'today' | 'tomorrow'>('today');
  const [lang, setLang] = useState<StoryLang[]>(['ru']);
  // По умолчанию: у салона — включено (несколько мастеров), у индивидуала — выключено (F-00-157);
  // undefined = «ещё не тронул сам», тогда берём умолчание по типу бизнеса, как только он загрузится.
  const [showStaffNamesTouched, setShowStaffNamesTouched] = useState<boolean | undefined>();
  const [staffIds, setStaffIds] = useState<string[]>([]);
  const [preview, setPreview] = useState<{ imageUrl: string; windows: StorySlotWindowPreview[] } | undefined>();
  const [photoUrl, setPhotoUrl] = useState<string[]>([]);
  const [caption, setCaption] = useState('');

  const placeQ = useApiQuery(['place-card', businessId], () => getPlaceCard(businessId), { enabled: Boolean(businessId) });
  const showStaffNames = showStaffNamesTouched ?? placeQ.data?.business.kind !== 'individual';
  // Список мастеров нужен только для выбора «Чьи окна показать»; мастер без billing.manage публикует свои — без запроса
  // (у него нет staff.view: был 403 в консоли, final-fix 01.10)
  const staffQ = useApiQuery(['staff-brief', businessId], () => listStaffBrief(businessId), { enabled: Boolean(businessId) && !ownOnly });
  const staffSkeletonCount = useSkeletonCount('stories-staff', { loading: staffQ.isLoading, count: staffQ.data?.length, fallback: 4, max: 12 });
  const slotsQ = useApiQuery(['story-slots'], () => getStorySlotsInfo());
  const price = (slotsQ.data?.used ?? 0) >= STORY_MAX_ACTIVE_SLOTS ? STORY_QUEUE_PRICE : STORY_BASE_PRICE;
  const generate = useApiMutation((_: void) => generateStoryPreview({ businessId, lang, showStaffNames, staffIds, period }));
  const publish = useApiMutation((input: { imageUrl: string; windows: StorySlotWindowPreview[] }) =>
    purchaseStory({ businessId, kind: 'generated', imageUrl: input.imageUrl, lang, showStaffNames, windows: input.windows }),
  );
  const publishPhoto = useApiMutation((input: { imageUrl: string; caption?: string }) =>
    purchaseStory({ businessId, kind: 'photo', imageUrl: input.imageUrl, lang, showStaffNames: false, windows: [], caption: input.caption }),
  );

  // Проверка размера идёт внутри ImageUpload по ИСХОДНОМУ файлу (minWidth/minHeight), не по
  // уже сжатому до 800px превью — иначе портретное 1080×1920 никогда не проходило (после сжатия
  // по высоте ширина превью падала до 450px < 667).
  const handlePhotoChange = (urls: string[]) => {
    setPhotoUrl(urls[0] ? [urls[0]] : []);
  };

  const toggleLang = (l: StoryLang) => {
    setLang((prev) => {
      if (prev.includes(l)) return prev.filter((x) => x !== l);
      if (prev.length >= 2) return [prev[1], l];
      return [...prev, l];
    });
  };

  const handleGenerate = async () => {
    try {
      const result = await generate.mutate();
      setPreview(result);
    } catch {
      toast.error(t('apps.stories.generateFailed'));
    }
  };

  /** «Поделиться» открывает системное меню (Instagram, WhatsApp, Telegram) — F-00-155 */
  const handleShare = async () => {
    if (!preview) return;
    try {
      const res = await fetch(preview.imageUrl);
      const blob = await res.blob();
      const file = new File([blob], 'story.png', { type: blob.type });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: t('apps.stories.shareTitle') });
        return;
      }
      throw new Error('share_unavailable');
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return; // пользователь сам закрыл системное меню
      toast.info(t('apps.stories.shareUnavailable'));
    }
  };

  const handlePublish = async () => {
    if (!preview) return;
    try {
      await publish.mutate({ imageUrl: preview.imageUrl, windows: preview.windows });
      toast.success(t('apps.stories.published'));
      setPreview(undefined);
      onPublished();
    } catch (e) {
      toast.error(e instanceof ApiError && e.code === 'not_enough_coins' ? t('apps.stories.notEnoughCoins') : t('apps.stories.publishFailed'));
    }
  };

  const handlePublishPhoto = async () => {
    if (!photoUrl[0]) return;
    try {
      await publishPhoto.mutate({ imageUrl: photoUrl[0], caption: caption.trim() || undefined });
      toast.success(t('apps.stories.sentForReview'));
      setPhotoUrl([]);
      setCaption('');
      onPublished();
    } catch (e) {
      toast.error(e instanceof ApiError && e.code === 'not_enough_coins' ? t('apps.stories.notEnoughCoins') : t('apps.stories.publishFailed'));
    }
  };

  return (
    <SectionCard title={t('apps.stories.generatorTitle')} description={t('apps.stories.generatorHint')}>
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as 'generated' | 'photo')}
        items={[
          { value: 'generated', label: t('apps.stories.tabGenerated') },
          { value: 'photo', label: t('apps.stories.tabPhoto') },
        ]}
      />

      <p data-f="F-14-172" className="mt-2 text-xs text-muted">
        {t('apps.stories.durationHint')}
      </p>

      {tab === 'generated' ? (
        <div className="mt-4 flex flex-col gap-4">
          <SegmentedControl
            value={period}
            onValueChange={(v) => setPeriod(v as 'today' | 'tomorrow')}
            options={[
              { value: 'today', label: t('apps.stories.periodToday') },
              { value: 'tomorrow', label: t('apps.stories.periodTomorrow') },
            ]}
          />

          <div>
            <p className="mb-2 text-sm font-medium text-fg">{t('apps.stories.langLabel')}</p>
            <div className="flex gap-2">
              {LANGS.map((l) => (
                <Button key={l} size="sm" variant={lang.includes(l) ? 'primary' : 'secondary'} onClick={() => toggleLang(l)}>
                  {l.toUpperCase()}
                </Button>
              ))}
            </div>
          </div>

          <Switch
            checked={showStaffNames}
            onCheckedChange={setShowStaffNamesTouched}
            label={t('apps.stories.showStaffNames')}
            description={t('apps.stories.showStaffNamesHint')}
          />

          {!ownOnly && staffQ.isLoading && (
            <div aria-busy="true">
              <p className="mb-2 text-sm font-medium text-fg">{t('apps.stories.staffLabel')}</p>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: staffSkeletonCount }, (_, i) => (
                  <Button key={i} size="sm" variant="secondary" disabled>
                    <SkeletonText width={STAFF_CHIP_WIDTHS[i % STAFF_CHIP_WIDTHS.length]} />
                  </Button>
                ))}
              </div>
              <p className="mt-1 text-xs text-muted">{t('apps.stories.staffHint')}</p>
            </div>
          )}
          {!ownOnly && staffQ.data && staffQ.data.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium text-fg">{t('apps.stories.staffLabel')}</p>
              <div className="flex flex-wrap gap-2">
                {staffQ.data.map((s) => {
                  const active = staffIds.includes(s.id);
                  return (
                    <Button
                      key={s.id}
                      size="sm"
                      variant={active ? 'primary' : 'secondary'}
                      onClick={() => setStaffIds((prev) => (active ? prev.filter((x) => x !== s.id) : [...prev, s.id]))}
                    >
                      {s.name}
                    </Button>
                  );
                })}
              </div>
              <p className="mt-1 text-xs text-muted">{t('apps.stories.staffHint')}</p>
            </div>
          )}

          {preview ? (
            <div className="flex flex-col items-center gap-3">
              <img src={preview.imageUrl} alt="" className="h-96 w-auto rounded-xl border border-border" />
              {preview.windows.length === 0 && (
                <p className="text-sm text-warning">{t('apps.stories.noWindowsWarning')}</p>
              )}
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="ghost" onClick={() => void handleGenerate()} loading={generate.isPending}>
                  {t('apps.stories.regenerate')}
                </Button>
                <Button variant="secondary" onClick={() => void handleShare()} leftIcon={<Share2 aria-hidden />}>
                  {t('apps.stories.share')}
                </Button>
                <Button
                  onClick={() => void handlePublish()}
                  loading={publish.isPending}
                  disabled={preview.windows.length === 0}
                  leftIcon={<Wand2 aria-hidden />}
                >
                  {t('apps.stories.publishFor', { price })}
                </Button>
              </div>
            </div>
          ) : (
            <Button onClick={() => void handleGenerate()} loading={generate.isPending} leftIcon={<Sparkles aria-hidden />}>
              {t('apps.stories.generateCta')}
            </Button>
          )}
        </div>
      ) : (
        <div data-f="F-14-034 F-14-036" className="mt-4 flex flex-col gap-4">
          <ImageUpload
            value={photoUrl}
            onValueChange={handlePhotoChange}
            max={1}
            aspect="16/9"
            label={t('apps.stories.photoUploadLabel')}
            minWidth={MIN_STORY_PHOTO_WIDTH}
            minHeight={MIN_STORY_PHOTO_HEIGHT}
          />
          <p className="text-xs text-muted">{t('apps.stories.photoRequirements')}</p>
          <FormField label={t('apps.stories.captionLabel')} optional hint={t('apps.stories.captionCount', { count: caption.length })}>
            <Input
              value={caption}
              onChange={(e) => setCaption(e.target.value.slice(0, 70))}
              maxLength={70}
              placeholder={t('apps.stories.captionPlaceholder')}
            />
          </FormField>
          <Button
            onClick={() => void handlePublishPhoto()}
            loading={publishPhoto.isPending}
            disabled={!photoUrl.length}
            leftIcon={<Camera aria-hidden />}
          >
            {t('apps.stories.sendForReviewFor', { price })}
          </Button>
        </div>
      )}
    </SectionCard>
  );
}
