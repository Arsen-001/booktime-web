'use client';

/**
 * Клиент заказа: поиск в базе по номеру или имени (как в окне записи) → карточка выбранного; «Новый клиент» — имя
 * и номер. Ключ клиента — телефон: новый номер заведёт карточку в базе при сохранении заказа.
 */
import { useState } from 'react';
import { UserPlus, UserRoundSearch } from 'lucide-react';
import { searchClientsForBooking } from '@/api/journal';
import { useApiQuery } from '@/api/request';
import { useCan, useCurrent } from '@/demo/hooks';
import type { Id } from '@/domain/core';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Avatar } from '@/ui/Avatar';
import { Button } from '@/ui/Button';
import { Combobox } from '@/ui/Combobox';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { PhoneInput } from '@/ui/PhoneInput';

export interface ClientValue {
  clientId: Id | null;
  clientName: string;
  clientPhone: string;
}

export interface ClientFieldProps {
  value: ClientValue;
  onChange: (value: ClientValue) => void;
  errors: { clientName?: string; clientPhone?: string };
}

export function ClientField({ value, onChange, errors }: ClientFieldProps) {
  const t = useT('orders');
  const fmt = useFormat();
  const canPhones = useCan('clients.phones');
  const { businessId } = useCurrent();
  const hasClient = Boolean(value.clientName || value.clientPhone);
  const [mode, setMode] = useState<'search' | 'new' | 'picked'>(hasClient ? (value.clientId ? 'picked' : 'new') : 'search');
  const [text, setText] = useState('');
  const query = text.trim();
  const found = useApiQuery(['orders', 'clientSearch', businessId ?? '', query], () => searchClientsForBooking(businessId ?? '', query), {
    enabled: Boolean(businessId) && query.length >= 2,
  });
  const clients = found.data ?? [];
  const showPhone = (phone: string) => (canPhones ? fmt.phone(phone) : fmt.maskedPhone(phone));

  if (mode === 'picked') {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-2 px-3 py-2.5">
        <Avatar name={value.clientName} size="sm" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-medium text-fg">{value.clientName}</span>
          <span className="truncate text-sm text-muted">{showPhone(value.clientPhone)}</span>
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onChange({ clientId: null, clientName: '', clientPhone: '' });
            setMode('search');
          }}
        >
          {t('form.changeClient')}
        </Button>
      </div>
    );
  }

  if (mode === 'new') {
    return (
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t('form.clientName')} required error={errors.clientName}>
            <Input
              value={value.clientName}
              onChange={(e) => onChange({ ...value, clientId: null, clientName: e.target.value })}
              autoComplete="off"
              placeholder={t('form.clientNamePlaceholder')}
            />
          </FormField>
          <FormField label={t('form.clientPhone')} required error={errors.clientPhone} hint={t('form.clientPhoneHint')}>
            <PhoneInput value={value.clientPhone} onValueChange={(v) => onChange({ ...value, clientId: null, clientPhone: v })} />
          </FormField>
        </div>
        <Button variant="link" size="sm" className="self-start" leftIcon={<UserRoundSearch aria-hidden />} onClick={() => setMode('search')}>
          {t('form.findClient')}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <FormField label={t('form.client')} required error={errors.clientName ? t('form.errors.client') : undefined} hint={t('form.clientSearchHint')}>
        <Combobox
          options={clients.map((c) => ({ value: c.id, label: c.name, description: showPhone(c.phone) }))}
          value={null}
          onInputChange={setText}
          filter={() => true}
          loading={found.isFetching}
          placeholder={t('form.clientSearch')}
          emptyText={query.length < 2 ? t('form.clientSearchStart') : t('form.clientNotFound')}
          allowCreate
          onCreate={(typed) => {
            const digits = typed.replace(/\D/g, '');
            onChange({ clientId: null, clientName: digits.length >= 6 ? '' : typed.trim(), clientPhone: digits.length >= 6 ? `+374${digits.replace(/^374/, '').slice(-8)}` : '' });
            setMode('new');
          }}
          onValueChange={(id) => {
            const c = clients.find((x) => x.id === id);
            if (!c) return;
            onChange({ clientId: c.id, clientName: c.name, clientPhone: c.phone });
            setMode('picked');
          }}
        />
      </FormField>
      <Button variant="secondary" size="sm" className="self-start" leftIcon={<UserPlus aria-hidden />} onClick={() => setMode('new')}>
        {t('form.newClient')}
      </Button>
    </div>
  );
}
