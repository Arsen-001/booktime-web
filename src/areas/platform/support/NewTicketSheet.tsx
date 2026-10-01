'use client';

/** Новое обращение: позвонили или написали нам напрямую — заводим сами. Тема — чипами. */
import { useGuardedClose } from '@/areas/platform/hooks/useGuardedClose';
import { useState } from 'react';
import { createSupportTicket } from '@/api/platform';
import { useApiMutation } from '@/api/request';
import { useBusinessesLite } from '@/areas/platform/hooks/usePlatformData';
import type { SupportChannel, SupportTicketInput, SupportTopic } from '@/domain/platform';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { Combobox } from '@/ui/Combobox';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { PhoneInput } from '@/ui/PhoneInput';
import { Select } from '@/ui/Select';
import { Sheet } from '@/ui/Sheet';
import { Textarea } from '@/ui/Textarea';
import { useToast } from '@/ui/Toast';

const CHANNELS: SupportChannel[] = ['phone', 'whatsapp', 'telegram', 'email', 'cabinet', 'app'];
const TOPICS: SupportTopic[] = ['help', 'billing', 'bug', 'newSphere', 'banner', 'ads', 'other'];

export function NewTicketSheet({ onClose }: { onClose: () => void }) {
  const t = useT('platform');
  const toast = useToast();
  const bizQ = useBusinessesLite();
  const create = useApiMutation(createSupportTicket);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [channel, setChannel] = useState<SupportChannel>('phone');
  const [topic, setTopic] = useState<SupportTopic>('help');
  const [text, setText] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const onOpenChange = useGuardedClose(Boolean(name.trim() || phone || businessId || text.trim()), onClose);

  const submit = async () => {
    if (!name.trim() || !text.trim()) return setShowErrors(true);
    const input: SupportTicketInput = { from: businessId ? 'business' : 'client', businessId: businessId ?? undefined, name: name.trim(), phone: phone || undefined, channel, topic, text: text.trim() };
    try {
      await create.mutate(input);
      toast.success(t('support.created'));
      onClose();
    } catch {
      toast.error(t('support.createFailed'));
    }
  };

  return (
    <Sheet open onOpenChange={onOpenChange} title={t('support.newTicket')} description={t('support.newTicketHint')} size="md" footer={<Button fullWidth onClick={submit} loading={create.isPending}>{t('support.create')}</Button>}>
      <form noValidate className="flex flex-col gap-5" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t('support.nameLabel')} required error={showErrors && !name.trim() ? t('support.nameRequired') : undefined}>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </FormField>
          <FormField label={t('support.phoneLabel')} optional>
            <PhoneInput value={phone} onValueChange={setPhone} />
          </FormField>
        </div>
        <FormField label={t('support.businessOptional')} optional>
          <Combobox options={(bizQ.data ?? []).map((b) => ({ value: b.id, label: b.name }))} value={businessId} onValueChange={setBusinessId} placeholder={t('support.findBusiness')} emptyText={t('support.noBusinessFound')} />
        </FormField>
        <FormField label={t('support.filterChannel')}>
          <Select value={channel} onValueChange={(v) => setChannel(v as SupportChannel)} options={CHANNELS.map((c) => ({ value: c, label: t(`support.channel.${c}`) }))} />
        </FormField>
        <FormField label={t('support.topicLabel')}>
          <div className="flex flex-wrap gap-2">
            {TOPICS.map((tp) => (
              <Chip key={tp} selected={topic === tp} onClick={() => setTopic(tp)}>
                {t(`support.topic.${tp}`)}
              </Chip>
            ))}
          </div>
        </FormField>
        <FormField label={t('support.textLabel')} required error={showErrors && !text.trim() ? t('support.textRequired') : undefined}>
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} />
        </FormField>
      </form>
    </Sheet>
  );
}
