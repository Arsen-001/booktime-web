'use client';

/** Личный кабинет → «Профиль» (F-15-148): фото, имя, телефон/email только показаны (меняются в своих вкладках). */
import { useState } from 'react';
import { X } from 'lucide-react';
import { coreGet } from '@/api/core';
import { useApiMutation, useApiQuery } from '@/api/request';
import { updateProfile } from '@/api/settings';
import type { Id } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { FormField } from '@/ui/FormField';
import { IconButton } from '@/ui/IconButton';
import { ImageUpload } from '@/ui/ImageUpload';
import { Input } from '@/ui/Input';
import { SectionCard } from '@/ui/SectionCard';
import { Skeleton } from '@/ui/Skeleton';
import { useToast } from '@/ui/Toast';
import { useUnsavedGuard } from '@/ui/hooks/useUnsavedGuard';

export function ProfileTab({ staffId }: { staffId: Id }) {
  const t = useT('settings');
  const toast = useToast();
  const staffQ = useApiQuery(['core', 'staff', staffId], () => coreGet('staff', staffId));
  const update = useApiMutation(updateProfile, { invalidates: [['core', 'staff', staffId]] });

  const [name, setName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [touched, setTouched] = useState(false);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ name: string; avatarUrl?: string } | null>(null);

  if (staffQ.data && loadedFor !== staffQ.data.id) {
    setLoadedFor(staffQ.data.id);
    setName(staffQ.data.name);
    setAvatarUrl(staffQ.data.avatarUrl);
    setSaved({ name: staffQ.data.name, avatarUrl: staffQ.data.avatarUrl });
  }

  // Н4/Н9: «Сохранить» — только при настоящей правке; уход со страницы с правкой — вопрос
  const dirty = saved !== null && (name.trim() !== saved.name || (avatarUrl ?? '') !== (saved.avatarUrl ?? ''));
  useUnsavedGuard(dirty);

  if (staffQ.isLoading || !staffQ.data) return <ProfileTabSkeleton />;

  const trimmed = name.trim();
  const invalid = touched && !trimmed;

  const save = async () => {
    setTouched(true);
    if (!trimmed) return;
    try {
      await update.mutate({ staffId, name: trimmed, avatarUrl });
      setSaved({ name: trimmed, avatarUrl });
      toast.success(t('account.profile.saved'));
    } catch {
      toast.error(t('account.profile.saveFailed'));
    }
  };

  return (
    <SectionCard title={t('account.profile.title')} description={t('account.profile.description')}>
      <div data-f="F-15-148" className="flex flex-col gap-5">
        {/* Н9: фото и подсказка «JPG/PNG до 12 МБ» — один раз (их рисует ImageUpload), без второго аватара рядом */}
        <FormField label={t('account.profile.changePhoto')}>
          <ImageUpload
            value={avatarUrl ? [avatarUrl] : []}
            onValueChange={(urls) => setAvatarUrl(urls[0])}
            max={1}
            aspect="square"
            maxSizeMb={12}
            label={t('account.profile.changePhoto')}
            className="max-w-40"
          />
        </FormField>

        <FormField label={t('account.profile.nameLabel')} error={invalid ? t('account.profile.nameRequired') : undefined} required>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => setTouched(true)}
            placeholder={t('account.profile.namePlaceholder')}
            invalid={invalid}
          />
        </FormField>

        <FormField label={t('account.profile.phoneLabel')} hint={t('account.profile.phoneHint')}>
          <Input value={staffQ.data.phone} disabled readOnly />
        </FormField>

        <FormField label={t('account.profile.emailLabel')} hint={t('account.profile.emailHint')}>
          <Input value={staffQ.data.email ?? ''} disabled readOnly placeholder={t('account.email.notSet')} />
        </FormField>

        <Button className="self-start" disabled={!dirty} loading={update.isPending} onClick={() => void save()}>
          {t('account.profile.save')}
        </Button>
      </div>
    </SectionCard>
  );
}

/**
 * «Профиль» до данных — та же карточка: фото (квадрат, «Заменить», подсказка), имя, телефон и почта выключенными
 * полями того же размера, кнопка «Сохранить». Фото у владельца в демо есть — поэтому место под «Заменить».
 */
export function ProfileTabSkeleton() {
  const t = useT('settings');
  const tu = useT('ui');
  return (
    <SectionCard title={t('account.profile.title')} description={t('account.profile.description')}>
      <div aria-busy className="flex flex-col gap-5">
        <FormField label={t('account.profile.changePhoto')}>
          <div className="w-full max-w-40">
            <div className="grid max-w-xs grid-cols-1 gap-3">
              <div className="relative aspect-square overflow-hidden rounded-xl border border-border bg-surface-2">
                <Skeleton variant="rect" className="absolute inset-0 h-full rounded-none" />
                <IconButton size="sm" variant="secondary" icon={<X aria-hidden />} label={tu('upload.remove')} disabled className="absolute top-1.5 right-1.5 rounded-full bg-surface/90 shadow-sm" />
              </div>
            </div>
            <span className="mt-2 inline-flex min-h-10 items-center text-sm font-medium text-primary-text">{tu('upload.replace')}</span>
            <p className="mt-2 text-sm text-muted">{tu('upload.hint', { mb: 12 })}</p>
          </div>
        </FormField>
        <FormField label={t('account.profile.nameLabel')} required>
          <Input value="" disabled readOnly />
        </FormField>
        <FormField label={t('account.profile.phoneLabel')} hint={t('account.profile.phoneHint')}>
          <Input value="" disabled readOnly />
        </FormField>
        <FormField label={t('account.profile.emailLabel')} hint={t('account.profile.emailHint')}>
          <Input value="" disabled readOnly />
        </FormField>
        <Button className="self-start" disabled>
          {t('account.profile.save')}
        </Button>
      </div>
    </SectionCard>
  );
}
