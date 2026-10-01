'use client';

import { useState } from 'react';
import { joinOnlineWaitlist } from '@/api/online';
import { useApiMutation } from '@/api/request';
import { useT } from '@/i18n/useT';
import { normalizePhone } from '@/lib/phone';
import { Button } from '@/ui/Button';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { Modal } from '@/ui/Modal';
import { PhoneInput } from '@/ui/PhoneInput';
import { Textarea } from '@/ui/Textarea';
import { useToast } from '@/ui/Toast';

/**
 * «Встать в лист ожидания» на пустой день (F-03-086, ⭐ F-00-101/102) — у Altegio закрыто для клиента,
 * у нас клиент делает это сам. Заявка сохраняется в стор online (переживает перезагрузку) — API и почему
 * временно здесь, а не в resources, см. joinOnlineWaitlist в src/api/online.ts и qa/requests/online.md.
 */
export function WaitlistJoinButton({
  businessId,
  locationId,
  staffId,
  serviceId,
  date,
}: {
  businessId: string;
  locationId?: string;
  staffId: string;
  serviceId: string;
  date: string;
}) {
  const t = useT('online');
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [comment, setComment] = useState('');
  const [nameError, setNameError] = useState<string | undefined>();
  const [phoneError, setPhoneError] = useState<string | undefined>();
  const [joined, setJoined] = useState(false);
  const mutation = useApiMutation(joinOnlineWaitlist);

  const submit = async () => {
    const nameErr = name.trim() ? undefined : t('booking.details.nameRequired');
    const normalized = normalizePhone(phone);
    const phoneErr = normalized ? undefined : t('booking.details.phoneInvalid');
    setNameError(nameErr);
    setPhoneError(phoneErr);
    if (nameErr || phoneErr) return;
    try {
      await mutation.mutate({
        businessId,
        locationId,
        staffId,
        serviceId,
        date,
        clientName: name.trim(),
        clientPhone: normalized!,
        comment: comment.trim() || undefined,
      });
      setJoined(true);
      toast.success(t('booking.waitlist.joined'));
      setOpen(false);
    } catch {
      toast.error(t('booking.waitlist.joinFailed'));
    }
  };

  if (joined) {
    return (
      <p className="text-sm text-success" data-f="F-03-086">
        {t('booking.waitlist.alreadyJoined')}
      </p>
    );
  }

  return (
    <>
      <Button size="sm" variant="ghost" data-f="F-03-086" onClick={() => setOpen(true)}>
        {t('booking.waitlist.cta')}
      </Button>
      <Modal open={open} onOpenChange={setOpen} title={t('booking.waitlist.title')} description={t('booking.waitlist.description')} size="sm">
        <div className="flex flex-col gap-3 text-left">
          <FormField label={t('booking.details.name')} error={nameError}>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </FormField>
          <FormField label={t('booking.details.phone')} error={phoneError}>
            <PhoneInput value={phone} onValueChange={setPhone} />
          </FormField>
          <FormField label={t('booking.waitlist.commentLabel')} optional>
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={150} rows={2} />
          </FormField>
          <Button onClick={submit} loading={mutation.isPending}>
            {t('booking.waitlist.submit')}
          </Button>
        </div>
      </Modal>
    </>
  );
}
