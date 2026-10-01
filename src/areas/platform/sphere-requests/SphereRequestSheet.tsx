'use client';

/**
 * Заявка на сферу: статус сверху, контакт, «что нужно», день готовности и сразу под ним — до какого числа подписка
 * (год считается с дня готовности, F-00-152). «Сохранить» — только если что-то поменяли.
 */
import { useGuardedClose } from '@/areas/platform/hooks/useGuardedClose';
import { useState } from 'react';
import { Phone } from 'lucide-react';
import { saveSphereRequest, type SphereRequestPatch } from '@/api/platform';
import { useApiMutation } from '@/api/request';
import { sphereSubscriptionUntil, type SphereRequestStatus, type SphereRequestView } from '@/domain/platform';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { telLink } from '@/lib/phone';
import { Button } from '@/ui/Button';
import { DatePicker } from '@/ui/DatePicker';
import { FormField } from '@/ui/FormField';
import { KeyValueList } from '@/ui/KeyValueList';
import { Select } from '@/ui/Select';
import { Sheet } from '@/ui/Sheet';
import { TagInput } from '@/ui/TagInput';
import { Textarea } from '@/ui/Textarea';
import { useToast } from '@/ui/Toast';

const STATUSES: SphereRequestStatus[] = ['open', 'agreed', 'inProgress', 'done'];

export function SphereRequestSheet({ request, onClose }: { request: SphereRequestView; onClose: () => void }) {
  const t = useT('platform');
  const fmt = useFormat();
  const toast = useToast();
  const save = useApiMutation((a: { id: string; patch: SphereRequestPatch }) => saveSphereRequest(a.id, a.patch));
  const [status, setStatus] = useState(request.status);
  const [needs, setNeeds] = useState(request.needs);
  const [readyAt, setReadyAt] = useState<string | null>(request.readyAt ?? null);
  const [note, setNote] = useState(request.note ?? '');
  const dirty = status !== request.status || needs.join('|') !== request.needs.join('|') || readyAt !== (request.readyAt ?? null) || note !== (request.note ?? '');
  const isNew = request.kind === 'newSphere';
  const onOpenChange = useGuardedClose(dirty, onClose);

  const submit = async () => {
    try {
      await save.mutate({ id: request.id, patch: { status: status !== request.status ? status : undefined, needs, readyAt: readyAt ?? undefined, note } });
      toast.success(t('sphereRequests.saved'));
      onClose();
    } catch {
      toast.error(t('sphereRequests.saveFailed'));
    }
  };

  return (
    <Sheet
      open
      onOpenChange={onOpenChange}
      title={request.masterName}
      description={request.sphereName}
      size="md"
      footer={dirty ? <Button fullWidth onClick={submit} loading={save.isPending}>{t('sphereRequests.save')}</Button> : undefined}
    >
      <div data-f={isNew ? 'F-00-152' : 'F-00-151'} className="flex flex-col gap-5">
        <FormField label={t('sphereRequests.statusLabel')}>
          <Select value={status} onValueChange={(v) => setStatus(v as SphereRequestStatus)} options={STATUSES.map((s) => ({ value: s, label: t(`sphereRequests.status.${s}`) }))} />
        </FormField>
        <KeyValueList
          items={[
            {
              label: t('sphereRequests.phone'),
              value: request.phone ? (
                <a href={telLink(request.phone)} className="inline-flex items-center gap-1.5 text-primary-text hover:underline">
                  <Phone aria-hidden className="size-4" />
                  {fmt.phone(request.phone)}
                </a>
              ) : (
                '—'
              ),
            },
            ...(request.businessName ? [{ label: t('sphereRequests.businessLabel'), value: request.businessName }] : []),
            { label: t('sphereRequests.createdLabel'), value: fmt.date(request.createdAt, 'long') },
            { label: t('sphereRequests.kindLabel'), value: t(`sphereRequests.kind.${request.kind}`) },
          ]}
        />
        {isNew && (
          <>
            <FormField label={t('sphereRequests.needsLabel')} optional hint={t('sphereRequests.needsHint')}>
              <TagInput value={needs} onValueChange={setNeeds} placeholder={t('sphereRequests.needsPlaceholder')} />
            </FormField>
            <FormField label={t('sphereRequests.readyAtLabel')} optional hint={t('sphereRequests.readyAtHint')}>
              <DatePicker value={readyAt} onValueChange={setReadyAt} clearable />
            </FormField>
            <p className="rounded-xl bg-surface-2 px-4 py-3 text-sm text-fg">
              {readyAt ? t('sphereRequests.subscriptionUntil', { date: fmt.date(sphereSubscriptionUntil(readyAt), 'long') }) : t('sphereRequests.subscriptionPending')}
            </p>
          </>
        )}
        <FormField label={t('sphereRequests.noteLabel')} optional>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
        </FormField>
      </div>
    </Sheet>
  );
}
