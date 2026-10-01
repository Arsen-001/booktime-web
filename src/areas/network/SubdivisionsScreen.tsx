'use client';

/**
 * /biz/network/services/subdivisions — «Подразделения» (F-11-094): группируют категории для аналитики.
 */
import { useState } from 'react';
import { Plus, Shapes } from 'lucide-react';
import { createNetworkSubdivision, listNetworkSubdivisions } from '@/api/network';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { Modal } from '@/ui/Modal';
import { PageHeader } from '@/ui/PageHeader';
import { SkeletonText } from '@/ui/Skeleton';
import { useSkeletonCount } from '@/ui/hooks/useSkeletonCount';
import { useToast } from '@/ui/Toast';
import { NetworkPageActions } from '@/areas/network/NetworkPageHelp';
import { useNetwork } from '@/areas/network/lib/useNetwork';

export function SubdivisionsScreen() {
  const t = useT('network');
  const toast = useToast();
  const { ready, networkId, isError, refetch } = useNetwork();
  const q = useApiQuery(['network', 'subdivisions', networkId], () => listNetworkSubdivisions(networkId!), { enabled: ready && Boolean(networkId) });
  const mutation = useApiMutation((name: string) => createNetworkSubdivision(networkId!, name));
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | undefined>();
  const loading = !ready || q.isLoading;
  // В прошлый раз список был пуст (или памяти нет, а в демо подразделений обычно нет) — при загрузке то же пустое состояние
  const skeletonRows = useSkeletonCount('networkSubdivisions', { loading, count: q.data?.length, fallback: 0, max: 20 });

  if (isError || q.isError) return <ErrorState onRetry={() => (isError ? refetch() : q.refetch())} />;

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t('subdivisions.nameRequired'));
      return;
    }
    try {
      await mutation.mutate(trimmed);
      toast.success(t('subdivisions.created'));
      setOpen(false);
      setName('');
      q.refetch();
    } catch {
      toast.error(t('subdivisions.createFailed'));
    }
  };

  return (
    <div data-f="F-11-094 F-12-101" className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
      <PageHeader
        title={t('subdivisions.title')}
        description={t('subdivisions.subtitle')}
        actions={
          <NetworkPageActions
            titleKey="help.subdivisions.title"
            bodyKey="help.subdivisions.body"
            extra={
              <Button size="sm" leftIcon={<Plus aria-hidden />} onClick={() => setOpen(true)}>
                {t('subdivisions.add')}
              </Button>
            }
          />
        }
      />

      {loading && skeletonRows > 0 ? (
        <ul aria-hidden className="flex flex-col gap-2">
          {Array.from({ length: skeletonRows }, (_, i) => (
            <li key={i} className="rounded-lg border border-border px-3 py-2.5 text-sm font-medium text-fg">
              <SkeletonText width={i % 2 ? '12ch' : '16ch'} />
            </li>
          ))}
        </ul>
      ) : !q.data?.length ? (
        <EmptyState
          icon={<Shapes aria-hidden />}
          title={t('subdivisions.empty')}
          action={
            <Button leftIcon={<Plus aria-hidden />} onClick={() => setOpen(true)}>
              {t('subdivisions.add')}
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {q.data.map((s) => (
            <li key={s.id} className="rounded-lg border border-border px-3 py-2.5 text-sm font-medium text-fg">
              {s.name}
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={open}
        onOpenChange={setOpen}
        title={t('subdivisions.formTitle')}
        size="sm"
        footer={
          <Button loading={mutation.isPending} onClick={save} className="w-full">
            {t('subdivisions.save')}
          </Button>
        }
      >
        <FormField label={t('subdivisions.nameLabel')} required error={error}>
          <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </FormField>
      </Modal>
    </div>
  );
}
