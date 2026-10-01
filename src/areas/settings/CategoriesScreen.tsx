'use client';

/**
 * /biz/settings/categories — «Категории» (F-15-121…124): три справочника вкладками. «Записи» — наш (4
 * системных несъёмных + свои); «Клиенты»/«События» ведут в справочники clients/resources (одна страница на
 * оба входа — F-15-121; событий-справочника у resources ещё нет, ссылка на список ресурсов — qa/requests/settings.md).
 */
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Pencil, Plus, Tag, Trash2 } from 'lucide-react';
import type { RecordCategory } from '@/domain/settings';
import {
  deleteRecordCategory,
  saveRecordCategory,
  useRecordCategories,
} from '@/api/settings';
import { useApiMutation } from '@/api/request';
import { useCan, useCurrent } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { Button, LinkButton } from '@/ui/Button';
import { ColorPicker } from '@/ui/ColorPicker';
import { ColorSwatch } from '@/ui/ColorSwatch';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { FormField } from '@/ui/FormField';
import { IconButton } from '@/ui/IconButton';
import { Input } from '@/ui/Input';
import { Modal } from '@/ui/Modal';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';
import { Skeleton, SkeletonText } from '@/ui/Skeleton';
import { useSkeletonCount } from '@/ui/hooks/useSkeletonCount';

/** Несъёмных категорий у каждого бизнеса четыре (F-15-122) */
const SYSTEM_CATEGORIES = 4;
import { Tabs } from '@/ui/Tabs';
import { useConfirm, useToast } from '@/ui/Toast';

type Tab = 'records' | 'events' | 'clients';

export function CategoriesScreen() {
  const t = useT('settings');
  const toast = useToast();
  const confirm = useConfirm();
  const params = useSearchParams();
  const initialTab = (params.get('tab') as Tab | null) ?? 'records';
  const [tab, setTab] = useState<Tab>(
    initialTab === 'events' || initialTab === 'clients'
      ? initialTab
      : 'records',
  );

  const { businessId, staffId, ready } = useCurrent();
  const canManage = useCan('settings.manage');
  const q = useRecordCategories(businessId, {
    enabled: ready && tab === 'records',
  });

  const save = useApiMutation(saveRecordCategory, {
    invalidates: [['settings', 'recordCategories', businessId]],
  });
  const del = useApiMutation((categoryId: string) => deleteRecordCategory(categoryId, staffId), {
    invalidates: [['settings', 'recordCategories', businessId]],
  });

  const loading = !ready || q.isLoading;
  // Своих категорий — столько, сколько было в прошлый раз (в демо — две)
  const customRows = useSkeletonCount('custom-categories', { loading, count: q.data?.filter((c) => !c.system).length, fallback: 2 });

  const [editing, setEditing] = useState<RecordCategory | 'new' | null>(null);
  const [form, setForm] = useState<{ name: string; colorIndex: number }>({
    name: '',
    colorIndex: 1,
  });

  function openNew() {
    setForm({ name: '', colorIndex: 1 });
    setEditing('new');
  }
  function openEdit(c: RecordCategory) {
    setForm({ name: c.name, colorIndex: c.colorIndex });
    setEditing(c);
  }

  async function handleSave() {
    if (!businessId) return;
    try {
      await save.mutate({
        id: editing !== 'new' && editing ? editing.id : undefined,
        businessId,
        staffId,
        name: form.name,
        colorIndex: form.colorIndex,
      });
      toast.success(t('categories.saved'));
      setEditing(null);
    } catch {
      toast.error(t('categories.saveFailed'));
    }
  }

  async function handleDelete(c: RecordCategory) {
    const ok = await confirm({
      title: t('categories.deleteConfirmTitle'),
      description: t('categories.deleteConfirmText', { name: c.name }),
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await del.mutate(c.id);
      toast.success(t('categories.deleted'));
    } catch {
      toast.error(t('categories.deleteFailed'));
    }
  }

  return (
    <div
      data-f="F-15-121 F-15-122 F-15-123 F-15-124 F-15-132"
      className="mx-auto flex w-full max-w-[760px] flex-col gap-6"
    >
      <PageHeader
        title={t('categories.title')}
        description={t('categories.description')}
        back={{ href: '/biz/settings' }}
      />

      <Tabs
        items={[
          { value: 'records', label: t('categories.tabRecords') },
          { value: 'events', label: t('categories.tabEvents') },
          { value: 'clients', label: t('categories.tabClients') },
        ]}
        value={tab}
        onValueChange={(v) => setTab(v as Tab)}
      />

      {tab === 'clients' && (
        <SectionCard
          title={t('categories.clientsRedirectTitle')}
          description={t('categories.clientsRedirectText')}
        >
          <LinkButton href="/biz/clients/categories" variant="secondary">
            {t('categories.clientsRedirectLink')}
          </LinkButton>
        </SectionCard>
      )}

      {tab === 'events' && (
        <SectionCard
          title={t('categories.eventsRedirectTitle')}
          description={t('categories.eventsRedirectText')}
        >
          <LinkButton href="/biz/resources" variant="secondary">
            {t('categories.eventsRedirectLink')}
          </LinkButton>
        </SectionCard>
      )}

      {tab === 'records' &&
        (loading ? (
          // Те же две карточки: четыре несъёмные категории и свои — строки той же высоты, кнопка «Добавить» внизу
          <>
            <SectionCard title={t('categories.systemTitle')} description={t('categories.systemHint')} padding="none">
              <ul aria-busy className="flex flex-col divide-y divide-border">
                {Array.from({ length: SYSTEM_CATEGORIES }, (_, i) => (
                  <li key={i} className="flex items-center gap-3 px-4 py-3">
                    <Skeleton variant="circle" className="size-7 shrink-0" />
                    <span className="flex-1 text-sm text-fg">
                      <SkeletonText width="14ch" />
                    </span>
                    <Badge tone="neutral" size="sm">
                      {t('categories.systemBadge')}
                    </Badge>
                  </li>
                ))}
              </ul>
            </SectionCard>
            <SectionCard title={t('categories.customTitle')} padding="none">
              <ul className="flex flex-col divide-y divide-border">
                {Array.from({ length: customRows }, (_, i) => (
                  <li key={i} className="flex items-center gap-3 px-4 py-3">
                    <Skeleton variant="circle" className="size-7 shrink-0" />
                    <span className="flex-1 text-sm text-fg">
                      <SkeletonText width="18ch" />
                    </span>
                    {canManage && (
                      <div className="flex items-center gap-1">
                        <IconButton label={t('categories.edit')} icon={<Pencil aria-hidden />} variant="ghost" size="sm" disabled />
                        <IconButton label={t('categories.delete')} icon={<Trash2 aria-hidden />} variant="ghost" size="sm" disabled />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              {canManage && customRows > 0 && (
                <div className="p-4">
                  <Button variant="secondary" size="sm" disabled>
                    <Plus aria-hidden className="size-4" />
                    {t('categories.addNew')}
                  </Button>
                </div>
              )}
            </SectionCard>
          </>
        ) : q.isError ? (
          <ErrorState onRetry={() => q.refetch()} />
        ) : (
          <>
            <SectionCard
              title={t('categories.systemTitle')}
              description={t('categories.systemHint')}
              padding="none"
            >
              <ul className="flex flex-col divide-y divide-border">
                {(q.data ?? [])
                  .filter((c) => c.system)
                  .map((c) => (
                    <li
                      key={c.id}
                      className="flex items-center gap-3 px-4 py-3"
                    >
                      <ColorSwatch colorIndex={c.colorIndex} />
                      <span className="flex-1 text-sm text-fg">
                        {t(`categories.${c.name}` as never)}
                      </span>
                      <Badge tone="neutral" size="sm">
                        {t('categories.systemBadge')}
                      </Badge>
                    </li>
                  ))}
              </ul>
            </SectionCard>

            <SectionCard
              title={t('categories.customTitle')}
              padding="none"
            >
              {(q.data ?? []).filter((c) => !c.system).length === 0 ? (
                <div className="p-4">
                  <EmptyState
                    icon={<Tag aria-hidden />}
                    title={t('categories.customEmpty')}
                    action={
                      canManage ? (
                        <Button onClick={openNew}>
                          {t('categories.addNew')}
                        </Button>
                      ) : undefined
                    }
                  />
                </div>
              ) : (
                <ul className="flex flex-col divide-y divide-border">
                  {(q.data ?? [])
                    .filter((c) => !c.system)
                    .map((c) => (
                      <li
                        key={c.id}
                        className="flex items-center gap-3 px-4 py-3"
                      >
                        <ColorSwatch colorIndex={c.colorIndex} />
                        <span className="flex-1 text-sm text-fg">{c.name}</span>
                        {canManage && (
                          <div className="flex items-center gap-1">
                            <IconButton
                              label={t('categories.edit')}
                              icon={<Pencil aria-hidden />}
                              variant="ghost"
                              size="sm"
                              onClick={() => openEdit(c)}
                            />
                            <IconButton
                              label={t('categories.delete')}
                              icon={<Trash2 aria-hidden />}
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(c)}
                            />
                          </div>
                        )}
                      </li>
                    ))}
                </ul>
              )}
              {canManage && (q.data ?? []).some((c) => !c.system) && (
                <div className="p-4">
                  <Button variant="secondary" size="sm" onClick={openNew}>
                    <Plus aria-hidden className="size-4" />
                    {t('categories.addNew')}
                  </Button>
                </div>
              )}
            </SectionCard>
          </>
        ))}

      <Modal
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title={
          editing === 'new'
            ? t('categories.newTitle')
            : t('categories.editTitle')
        }
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditing(null)}>
              {t('categories.cancel')}
            </Button>
            <Button
              onClick={handleSave}
              loading={save.isPending}
              disabled={!form.name.trim()}
            >
              {t('categories.save')}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <FormField label={t('categories.nameLabel')} required>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={t('categories.namePlaceholder')}
              maxLength={40}
            />
          </FormField>
          <FormField label={t('categories.colorLabel')}>
            <ColorPicker
              value={form.colorIndex}
              onValueChange={(colorIndex) => setForm({ ...form, colorIndex })}
            />
          </FormField>
        </div>
      </Modal>
    </div>
  );
}
