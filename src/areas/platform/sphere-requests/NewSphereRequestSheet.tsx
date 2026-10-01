'use client';

/** Новая заявка на сферу: вид заявки, мастер и телефон (без него не обработать), профессия, что нужно. */
import { useGuardedClose } from '@/areas/platform/hooks/useGuardedClose';
import { useState } from 'react';
import { createSphereRequest } from '@/api/platform';
import { useApiMutation } from '@/api/request';
import type { SphereRequestInput, SphereRequestKind } from '@/domain/platform';
import { useT } from '@/i18n/useT';
import { normalizePhone } from '@/lib/phone';
import { Button } from '@/ui/Button';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { PhoneInput } from '@/ui/PhoneInput';
import { ChoiceGroup } from '@/ui/ChoiceGroup';
import { Sheet } from '@/ui/Sheet';
import { TagInput } from '@/ui/TagInput';
import { Textarea } from '@/ui/Textarea';
import { useToast } from '@/ui/Toast';

export function NewSphereRequestSheet({ kind, onClose }: { kind: SphereRequestKind; onClose: () => void }) {
  const t = useT('platform');
  const toast = useToast();
  const create = useApiMutation(createSphereRequest);
  const [form, setForm] = useState<SphereRequestInput>({ kind, masterName: '', phone: '', sphereName: '', needs: [], note: '' });
  const [showErrors, setShowErrors] = useState(false);
  const set = (patch: Partial<SphereRequestInput>) => setForm((f) => ({ ...f, ...patch }));
  const dirty = Boolean(form.masterName.trim() || form.phone || form.sphereName.trim() || form.needs?.length || form.note?.trim());
  const onOpenChange = useGuardedClose(dirty, onClose);
  const errors = { name: !form.masterName.trim(), phone: !normalizePhone(form.phone), sphere: !form.sphereName.trim() };

  const submit = async () => {
    if (errors.name || errors.phone || errors.sphere) return setShowErrors(true);
    try {
      await create.mutate({ ...form, note: form.note?.trim() || undefined });
      toast.success(t('sphereRequests.created'));
      onClose();
    } catch {
      toast.error(t('sphereRequests.saveFailed'));
    }
  };

  return (
    <Sheet open onOpenChange={onOpenChange} title={t('sphereRequests.add')} size="md" footer={<Button fullWidth onClick={submit} loading={create.isPending}>{t('sphereRequests.create')}</Button>}>
      <form noValidate className="flex flex-col gap-5" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <ChoiceGroup
          columns={2}
          value={form.kind}
          onValueChange={(v) => set({ kind: v as SphereRequestKind })}
          options={(['noSphere', 'newSphere'] as const).map((k) => ({ value: k, title: t(`sphereRequests.kind.${k}`), description: t(`sphereRequests.hint.${k}`) }))}
        />
        <FormField label={t('sphereRequests.masterName')} required error={showErrors && errors.name ? t('sphereRequests.masterNameRequired') : undefined}>
          <Input value={form.masterName} onChange={(e) => set({ masterName: e.target.value })} />
        </FormField>
        <FormField label={t('sphereRequests.phone')} required error={showErrors && errors.phone ? t('sphereRequests.phoneRequired') : undefined}>
          <PhoneInput value={form.phone} onValueChange={(v) => set({ phone: v })} />
        </FormField>
        <FormField label={t('sphereRequests.sphereName')} required error={showErrors && errors.sphere ? t('sphereRequests.sphereNameRequired') : undefined}>
          <Input value={form.sphereName} onChange={(e) => set({ sphereName: e.target.value })} placeholder={t('sphereRequests.sphereNamePlaceholder')} />
        </FormField>
        {form.kind === 'newSphere' && (
          <FormField label={t('sphereRequests.needsLabel')} optional hint={t('sphereRequests.needsHint')}>
            <TagInput value={form.needs ?? []} onValueChange={(v) => set({ needs: v })} placeholder={t('sphereRequests.needsPlaceholder')} />
          </FormField>
        )}
        <FormField label={t('sphereRequests.noteLabel')} optional>
          <Textarea value={form.note ?? ''} onChange={(e) => set({ note: e.target.value })} rows={2} />
        </FormField>
      </form>
    </Sheet>
  );
}
