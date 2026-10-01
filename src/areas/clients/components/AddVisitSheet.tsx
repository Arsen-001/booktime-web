'use client';

/**
 * «Внести прошлый визит» — визит, которого нет в журнале (F-00-129): клиент пришёл без записи, старый визит до перехода к нам.
 * Со страницы клиента clientId задан; со списка — найти клиента или завести нового (он создаётся в том же запросе, что и
 * визит — addPastVisit). На телефоне поля по одному в строке (ux-r5 №7); услуга подставляет свою цену (recheck-c2);
 * время по умолчанию — прошедший получас, будущее не принимается (ux-r5 №8).
 */
import { useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { Plus, Trash2 } from 'lucide-react';
import { DuplicatePhoneError, addPastVisit, listClientRows } from '@/api/clients';
import { useCoreList } from '@/api/core';
import { ApiError, useApiMutation, useApiQuery } from '@/api/request';
import type { ClientVisitService } from '@/domain/clients';
import { newId } from '@/lib/id';
import { nowYerevan, today } from '@/lib/date';
import { pickText } from '@/lib/text';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { Combobox } from '@/ui/Combobox';
import { DatePicker } from '@/ui/DatePicker';
import { FormField } from '@/ui/FormField';
import { IconButton } from '@/ui/IconButton';
import { ImageUpload } from '@/ui/ImageUpload';
import { Input } from '@/ui/Input';
import { MoneyInput } from '@/ui/MoneyInput';
import { PhoneInput } from '@/ui/PhoneInput';
import { Select } from '@/ui/Select';
import { Sheet } from '@/ui/Sheet';
import { Textarea } from '@/ui/Textarea';
import { TimePicker } from '@/ui/TimePicker';
import { useToast } from '@/ui/Toast';
import { useUnsavedGuard } from '@/ui/hooks/useUnsavedGuard';

export interface AddVisitSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId?: string;
  locationId?: string;
  /** Задан — визит для этого клиента (карточка клиента); не задан — сначала выбираем/создаём клиента */
  clientId?: string;
}

interface Line {
  key: string;
  serviceId?: string;
  customName: string;
  price: number | undefined;
}

function emptyLine(): Line {
  return { key: newId('ln'), customName: '', price: undefined };
}

/** Ближайший прошедший получас: в 06:18 — 06:00, в 14:47 — 14:30 */
function lastHalfHour(): string {
  const now = nowYerevan();
  const minutes = now.minute() >= 30 ? 30 : 0;
  return `${String(now.hour()).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function AddVisitSheet({ open, onOpenChange, businessId, locationId, clientId }: AddVisitSheetProps) {
  const t = useT('clients');
  const toast = useToast();
  const locale = useLocale();
  const enabled = open && Boolean(businessId);

  const staffQ = useCoreList('staff', { businessId: businessId ?? '' }, { enabled });
  const servicesQ = useCoreList('services', { businessId: businessId ?? '' }, { enabled });
  const rowsQ = useApiQuery(['clients', 'rows', businessId], () => listClientRows(businessId ?? ''), { enabled: enabled && !clientId });

  const [pickedClientId, setPickedClientId] = useState<string | null>(clientId ?? null);
  const [newClient, setNewClient] = useState<{ name: string; phone: string } | null>(null);
  const [staffId, setStaffId] = useState('');
  const [date, setDate] = useState(today());
  const [time, setTime] = useState(lastHalfHour());
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [paidAmount, setPaidAmount] = useState<number | undefined>(undefined);
  const [note, setNote] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setPickedClientId(clientId ?? null);
      setNewClient(null);
      setStaffId('');
      setDate(today());
      setTime(lastHalfHour());
      setLines([emptyLine()]);
      setPaidAmount(undefined);
      setNote('');
      setPhotos([]);
      setErrors({});
    }
  }

  const addVisitM = useApiMutation(addPastVisit);

  const staffOptions = (staffQ.data ?? []).map((s) => ({ value: s.id, label: s.name }));
  const services = servicesQ.data ?? [];
  const serviceOptions = services.map((s) => ({ value: s.id, label: pickText(s.name, locale as never) }));
  const clientOptions = (rowsQ.data ?? []).map((r) => ({ value: r.id, label: r.name, description: r.phone }));
  const total = lines.reduce((sum, l) => sum + (l.price ?? 0), 0);
  // Введено что-то, кроме подставленных даты и времени, — закрытие шторки и уход по ссылке сначала спрашивают
  const dirty =
    Boolean(staffId) ||
    Boolean(newClient) ||
    pickedClientId !== (clientId ?? null) ||
    lines.some((l) => l.serviceId || l.customName.trim() || l.price !== undefined) ||
    paidAmount !== undefined ||
    Boolean(note.trim()) ||
    photos.length > 0;
  const { confirmLeave } = useUnsavedGuard(open && dirty);
  const requestClose = async () => {
    if (await confirmLeave()) onOpenChange(false);
  };

  const setLine = (key: string, patch: Partial<Line>) => setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!clientId && !pickedClientId && !newClient?.name.trim()) next.client = t('history.addVisitSheet.clientRequired');
    if (!clientId && newClient && newClient.phone.replace(/\D/g, '').length < 6) next.phone = t('addClientForm.form.phoneRequired');
    if (!staffId) next.staff = t('history.addVisitSheet.staffRequired');
    if (date === today() && time > nowYerevan().format('HH:mm')) next.time = t('history.addVisitSheet.futureTime');
    if (!lines.some((l) => l.customName.trim() || l.serviceId)) next.services = t('history.addVisitSheet.serviceRequired');
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  // Два быстрых нажатия «Сохранить визит» не должны создать два визита
  const submittingRef = useRef(false);

  const submit = async () => {
    if (!businessId || submittingRef.current || !validate()) return;
    submittingRef.current = true;
    try {
      const svcLines: ClientVisitService[] = lines
        .filter((l) => l.customName.trim() || l.serviceId)
        .map((l) => ({ serviceId: l.serviceId, customName: l.serviceId ? undefined : l.customName.trim(), price: l.price ?? 0 }));
      await addVisitM.mutate({
        businessId,
        locationId,
        clientId: clientId ?? pickedClientId ?? undefined,
        newClient: !clientId && !pickedClientId && newClient ? newClient : undefined,
        staffId,
        date,
        time,
        services: svcLines,
        paidAmount: paidAmount ?? total,
        note: note.trim() || undefined,
        photos: photos.map((dataUrl, i) => ({ name: `photo-${i + 1}.jpg`, ext: 'jpg', size: dataUrl.length, dataUrl })),
      });
      toast.success(t('history.addVisitSheet.saved'));
      onOpenChange(false);
    } catch (e) {
      if (e instanceof DuplicatePhoneError) setErrors((prev) => ({ ...prev, phone: t('addClientForm.form.duplicatePhone') }));
      else if (e instanceof ApiError && e.code === 'future_visit') setErrors((prev) => ({ ...prev, time: t('history.addVisitSheet.futureTime') }));
      else toast.error(t('history.addVisitSheet.saveFailed'));
    } finally {
      submittingRef.current = false;
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => (o ? onOpenChange(true) : void requestClose())}
      title={t('history.addVisitSheet.title')}
      description={t('history.addVisitSheet.description')}
      size="lg"
      footer={
        <div className="grid w-full grid-cols-[1fr_2fr] gap-2 md:flex md:w-auto md:justify-end">
          <Button variant="outline" onClick={requestClose}>
            {t('addClientForm.cancel')}
          </Button>
          <Button loading={addVisitM.isPending} onClick={submit}>
            {t('history.addVisitSheet.save')}
          </Button>
        </div>
      }
    >
      <div data-f="F-00-129" className="flex flex-col gap-5">
        {!clientId && (
          <FormField label={t('history.addVisitSheet.client')} error={errors.client} required>
            <Combobox
              options={clientOptions}
              value={pickedClientId}
              onValueChange={(v) => {
                setPickedClientId(v);
                if (v) setNewClient(null);
              }}
              allowCreate
              onCreate={(text) => {
                setPickedClientId(null);
                setNewClient({ name: text, phone: '' });
              }}
              placeholder={t('history.addVisitSheet.clientPlaceholder')}
              emptyText={t('history.addVisitSheet.clientEmpty')}
            />
          </FormField>
        )}

        {!clientId && newClient && (
          <div className="grid grid-cols-1 gap-4 rounded-xl bg-surface-2 p-4 @lg:grid-cols-2">
            <FormField label={t('addClientForm.form.name')} required>
              <Input value={newClient.name} onChange={(e) => setNewClient({ ...newClient, name: e.target.value })} />
            </FormField>
            <FormField label={t('addClientForm.form.phone')} error={errors.phone} required>
              <PhoneInput value={newClient.phone} onValueChange={(v) => setNewClient({ ...newClient, phone: v })} />
            </FormField>
          </div>
        )}

        <FormField label={t('history.addVisitSheet.staff')} error={errors.staff} required>
          <Select value={staffId} onValueChange={setStaffId} options={staffOptions} placeholder={t('history.addVisitSheet.staffPlaceholder')} />
        </FormField>
        <div className="grid grid-cols-1 gap-4 @lg:grid-cols-2">
          <FormField label={t('history.addVisitSheet.date')} required>
            <DatePicker value={date as never} onValueChange={(d) => d && setDate(d)} max={today()} />
          </FormField>
          <FormField label={t('history.addVisitSheet.time')} error={errors.time} required>
            <TimePicker value={time as never} onValueChange={(v) => setTime(v)} />
          </FormField>
        </div>

        <FormField label={t('history.addVisitSheet.services')} error={errors.services} required>
          <div className="flex flex-col gap-3">
            {lines.map((line) => (
              <div key={line.key} className="flex flex-col gap-2 rounded-xl border border-border p-3 @lg:flex-row @lg:items-center @lg:border-0 @lg:p-0">
                <div className="min-w-0 flex-1">
                  <Combobox
                    options={serviceOptions}
                    value={line.serviceId ?? null}
                    onValueChange={(v) => {
                      const svc = services.find((s) => s.id === v);
                      setLine(line.key, { serviceId: v ?? undefined, customName: v ? '' : line.customName, price: svc ? svc.priceMin : line.price });
                    }}
                    onInputChange={(txt) => {
                      if (!line.serviceId) setLine(line.key, { customName: txt });
                    }}
                    allowCreate
                    onCreate={(text) => setLine(line.key, { customName: text, serviceId: undefined })}
                    placeholder={t('history.addVisitSheet.serviceName')}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1 @lg:w-36 @lg:flex-none">
                    <MoneyInput
                      value={line.price}
                      onValueChange={(v) => setLine(line.key, { price: v })}
                      placeholder="0"
                      aria-label={t('history.addVisitSheet.price')}
                    />
                  </div>
                  <IconButton
                    icon={<Trash2 aria-hidden />}
                    label={t('history.addVisitSheet.removeLine')}
                    variant="ghost"
                    disabled={lines.length === 1}
                    onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                  />
                </div>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="self-start"
              leftIcon={<Plus aria-hidden />}
              onClick={() => setLines((prev) => [...prev, emptyLine()])}
            >
              {t('history.addVisitSheet.addLine')}
            </Button>
          </div>
        </FormField>

        <FormField label={t('history.addVisitSheet.paid')} hint={t('history.addVisitSheet.paidHint', { total })}>
          <MoneyInput value={paidAmount} onValueChange={setPaidAmount} placeholder={String(total)} />
        </FormField>

        <FormField label={t('history.addVisitSheet.photos')}>
          <ImageUpload value={photos} onValueChange={setPhotos} max={6} aspect="square" maxSizeMb={12} />
        </FormField>

        <FormField label={t('history.addVisitSheet.note')}>
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </FormField>
      </div>
    </Sheet>
  );
}
