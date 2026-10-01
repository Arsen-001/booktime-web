'use client';

/** Шаг «Мастера»: имя и телефон — мастер получит приглашение. Можно пропустить: владелец работает сам. */
import { useState } from 'react';
import { Plus, UserRound, X } from 'lucide-react';
import type { ConnectForm } from '@/areas/platform/connect/connectForm';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { newId } from '@/lib/id';
import { normalizePhone } from '@/lib/phone';
import { Avatar } from '@/ui/Avatar';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { FormField } from '@/ui/FormField';
import { IconButton } from '@/ui/IconButton';
import { Input } from '@/ui/Input';
import { PhoneInput } from '@/ui/PhoneInput';

export function StepMasters({ form, onChange }: { form: ConnectForm; onChange: (patch: Partial<ConnectForm>) => void }) {
  const t = useT('platform');
  const fmt = useFormat();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');

  const add = () => {
    const normalized = normalizePhone(phone);
    if (!normalized) return setError(t('connect.issue.ownerPhone'));
    if (form.invites.some((i) => i.phone === normalized)) return setError(t('connect.inviteDuplicate'));
    onChange({ invites: [...form.invites, { id: newId('inv'), name: name.trim(), phone: normalized }] });
    setName('');
    setPhone('');
    setError('');
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <FormField label={t('connect.inviteName')} optional>
          <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
        </FormField>
        <FormField label={t('connect.invitePhone')} error={error || undefined}>
          <PhoneInput value={phone} onValueChange={(v) => { setPhone(v); setError(''); }} />
        </FormField>
        <Button variant="outline" leftIcon={<Plus aria-hidden />} onClick={add} disabled={!phone}>
          {t('connect.addInvite')}
        </Button>
      </div>
      {form.invites.length === 0 ? (
        <EmptyState variant="inline" icon={<UserRound aria-hidden />} title={t('connect.invitesEmpty')} description={t('connect.invitesEmptyHint')} />
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
          {form.invites.map((i) => (
            <li key={i.id} className="flex min-h-14 items-center gap-3 px-3 py-2">
              <Avatar name={i.name || i.phone} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-fg">{i.name || t('connect.inviteNoName')}</p>
                <p className="text-sm text-muted">{fmt.phone(i.phone)}</p>
              </div>
              <IconButton icon={<X />} label={t('connect.removeInvite')} onClick={() => onChange({ invites: form.invites.filter((x) => x.id !== i.id) })} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
