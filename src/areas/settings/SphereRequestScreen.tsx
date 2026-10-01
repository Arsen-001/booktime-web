'use client';

/**
 * /biz/onboarding/sphere-request — «Моей сферы нет» (F-15-005, F-00-145…147): свободная заявка (название сферы,
 * пояснение), уходит в submitSphereRequest → отвечает поддержка. Список своих заявок ниже, как в HelpScreen.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Send, Sparkles } from 'lucide-react';
import { listSphereRequests, submitSphereRequest } from '@/api/settings';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Badge, type BadgeTone } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';
import { Skeleton, SkeletonText } from '@/ui/Skeleton';
import { useRememberedLayout } from '@/ui/hooks/useSkeletonCount';
import { Textarea } from '@/ui/Textarea';
import { useToast } from '@/ui/Toast';

const STATUS_TONE: Record<string, BadgeTone> = { open: 'warning', answered: 'success', closed: 'neutral' };

export function SphereRequestScreen() {
  const t = useT('settings');
  const format = useFormat();
  const toast = useToast();
  const { businessId, staffId, ready } = useCurrent();
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [touched, setTouched] = useState(false);

  const listQ = useApiQuery(['settings', 'sphereRequests', businessId], () => listSphereRequests(businessId ?? ''), {
    enabled: ready && Boolean(businessId),
  });
  const create = useApiMutation(submitSphereRequest, { invalidates: [['settings', 'sphereRequests', businessId]] });

  // Скелетон списка — те же строки: сколько заявок и у каких есть текст (иначе как в демо — у салона персоны «владелец»
  // заявок нет, до ответа — то же пустое состояние)
  const listLoading = listQ.isLoading || !ready;
  const [rememberedRows, saveRows] = useRememberedLayout<boolean[]>('sphere-requests');
  useEffect(() => {
    if (!listLoading && listQ.data) saveRows(listQ.data.map((r) => Boolean(r.message)));
  });
  const skeletonRows = rememberedRows ?? [];

  const trimmed = name.trim();
  const invalid = touched && trimmed.length < 2;

  const submit = async () => {
    setTouched(true);
    if (trimmed.length < 2 || !businessId || !staffId) return;
    try {
      await create.mutate({ businessId, authorStaffId: staffId, name: trimmed, message: message.trim() || undefined });
      toast.success(t('sphereRequest.sent'));
      setName('');
      setMessage('');
      setTouched(false);
    } catch {
      toast.error(t('sphereRequest.sendFailed'));
    }
  };

  return (
    <div data-f="F-15-005" className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
      <PageHeader
        title={t('sphereRequest.title')}
        description={t('sphereRequest.description')}
        back={{ href: '/biz/onboarding/spheres', label: t('sphereRequest.backToSpheres') }}
      />

      <SectionCard
        title={
          <span className="flex items-center gap-2">
            <Sparkles aria-hidden className="size-4 shrink-0 text-muted" />
            {t('sphereRequest.formTitle')}
          </span>
        }
      >
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <FormField label={t('sphereRequest.nameLabel')} error={invalid ? t('sphereRequest.nameTooShort') : undefined} required>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => setTouched(true)}
              placeholder={t('sphereRequest.namePlaceholder')}
              invalid={invalid}
            />
          </FormField>
          <FormField label={t('sphereRequest.messageLabel')} optional>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder={t('sphereRequest.messagePlaceholder')} rows={4} />
          </FormField>
          <Button type="submit" leftIcon={<Send />} loading={create.isPending} disabled={!ready} className="self-start">
            {t('sphereRequest.send')}
          </Button>
        </form>
      </SectionCard>

      <SectionCard title={t('sphereRequest.historyTitle')} padding="none">
        {listLoading && skeletonRows.length > 0 ? (
          <ul className="divide-y divide-border">
            {skeletonRows.map((withMessage, i) => (
              <SphereRequestRowSkeleton key={i} withMessage={withMessage} />
            ))}
          </ul>
        ) : listLoading ? (
          <EmptyState variant="section" title={<SkeletonText width="20ch" />} description={t('sphereRequest.emptyDescription')} />
        ) : listQ.isError ? (
          <div className="p-4">
            <ErrorState onRetry={() => listQ.refetch()} compact />
          </div>
        ) : (listQ.data ?? []).length === 0 ? (
          <EmptyState variant="section" title={t('sphereRequest.emptyTitle')} description={t('sphereRequest.emptyDescription')} />
        ) : (
          <ul className="divide-y divide-border">
            {(listQ.data ?? []).map((req) => (
              <li key={req.id} className="flex flex-col gap-1 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <Link
                    href={`/biz/onboarding/sphere-request/${req.id}`}
                    className="text-sm font-medium text-fg underline-offset-2 hover:underline"
                    data-f="F-00-152"
                  >
                    {req.name}
                  </Link>
                  <Badge tone={STATUS_TONE[req.status]}>{t(`sphereRequest.status.${req.status}` as never)}</Badge>
                </div>
                {req.message && <p className="text-sm text-muted">{req.message}</p>}
                <span className="text-xs text-muted">{format.dateTime(req.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

/** Строка заявки до данных: название и плашка статуса, текст заявки (если был), дата */
function SphereRequestRowSkeleton({ withMessage }: { withMessage: boolean }) {
  return (
    <li className="flex flex-col gap-1 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-fg">
          <SkeletonText width="14ch" />
        </span>
        <Badge tone="neutral">
          <SkeletonText width="8ch" />
        </Badge>
      </div>
      {withMessage && (
        // Текст заявки: на телефоне обычно в две строки, шире — в одну
        <p className="text-sm text-muted">
          <span className="block sm:hidden">
            <Skeleton lines={2} />
          </span>
          <span className="hidden sm:block">
            <SkeletonText width="60ch" />
          </span>
        </p>
      )}
      <span className="text-xs text-muted">
        <SkeletonText width="16ch" />
      </span>
    </li>
  );
}
