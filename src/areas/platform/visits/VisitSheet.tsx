'use client';

/**
 * Карточка визита: сначала главное — статус и «перезвонить» (быстрые даты), потом контакт, история.
 * Внизу: «Подключить сейчас» (если ещё не подключён) и «Сохранить». Смонтирована — значит открыта.
 */
import { useGuardedClose } from '@/areas/platform/hooks/useGuardedClose';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Phone, Store } from 'lucide-react';
import { completeCallback, createVisit, startConnectDraft, updateVisit } from '@/api/platform';
import { useApiMutation } from '@/api/request';
import { useTeam } from '@/areas/platform/hooks/usePlatformData';
import { VisitHistory } from '@/areas/platform/visits/VisitHistory';
import { DISTRICT_IDS } from '@/config/districts';
import { SPHERE_IDS } from '@/config/spheres';
import type { DistrictId, SphereId } from '@/domain/core';
import { callbackPresets, type Visit, type VisitInput, type VisitStatus, type VisitTool } from '@/domain/platform';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { today } from '@/lib/date';
import { telLink } from '@/lib/phone';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { DatePicker } from '@/ui/DatePicker';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { MoneyInput } from '@/ui/MoneyInput';
import { PhoneInput } from '@/ui/PhoneInput';
import { SectionCard } from '@/ui/SectionCard';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { Select } from '@/ui/Select';
import { Sheet } from '@/ui/Sheet';
import { Textarea } from '@/ui/Textarea';
import { useToast } from '@/ui/Toast';

const TOOLS: VisitTool[] = ['dikidi', 'altegio', 'whatsapp', 'notebook', 'other', 'nothing'];

function inputOf(v: Visit | undefined, responsibleId: string): VisitInput {
  return {
    placeName: v?.placeName ?? '',
    contactName: v?.contactName ?? '',
    phone: v?.phone ?? '',
    district: v?.district ?? 'kentron',
    address: v?.address ?? '',
    sphereId: v?.sphereId,
    status: v?.status ?? 'thinking',
    visitedAt: v?.visitedAt ?? today(),
    callbackDate: v?.callbackDate,
    refusalReason: v?.refusalReason ?? '',
    note: v?.note ?? '',
    currentTool: v?.currentTool,
    willingToPay: v?.willingToPay,
    responsibleId: v?.responsibleId ?? responsibleId,
  };
}

export function VisitSheet({ visit, onClose }: { visit?: Visit; onClose: () => void }) {
  const t = useT('platform');
  const tc = useT('common');
  const fmt = useFormat();
  const toast = useToast();
  const router = useRouter();
  const teamQ = useTeam();
  const [initial, setInitial] = useState<VisitInput>(() => inputOf(visit, ''));
  const [form, setForm] = useState<VisitInput>(initial);
  // Закрыть шторку с несохранённым визитом — только после нашего вопроса
  const onOpenChange = useGuardedClose(JSON.stringify(form) !== JSON.stringify(initial), onClose);
  const [error, setError] = useState(false);
  const create = useApiMutation(createVisit);
  const update = useApiMutation((a: { id: string; patch: Partial<VisitInput> }) => updateVisit(a.id, a.patch));
  const callbackDone = useApiMutation(completeCallback);
  const connect = useApiMutation(startConnectDraft);
  const set = (patch: Partial<VisitInput>) => setForm((f) => ({ ...f, ...patch }));
  const responsibleId = form.responsibleId || teamQ.data?.[0]?.id || '';

  const save = async () => {
    if (!form.placeName.trim()) return setError(true);
    try {
      if (visit) await update.mutate({ id: visit.id, patch: { ...form, responsibleId } });
      else await create.mutate({ ...form, responsibleId });
      toast.success(t('visits.saved'));
      onClose();
    } catch {
      toast.error(t('visits.saveFailed'));
    }
  };
  const markCalled = async () => {
    if (!visit) return;
    try {
      await callbackDone.mutate(visit.id);
      set({ callbackDate: undefined });
      setInitial((i) => ({ ...i, callbackDate: undefined }));
      toast.success(t('visits.callbackDoneOk'));
    } catch {
      toast.error(t('visits.saveFailed'));
    }
  };
  const connectNow = async () => {
    if (!visit) return;
    try {
      const draft = await connect.mutate({ visitId: visit.id });
      router.push(`/platform/connect?draft=${draft.id}`);
    } catch {
      toast.error(t('connect.startFailed'));
    }
  };

  return (
    <Sheet
      open
      onOpenChange={onOpenChange}
      title={visit ? visit.placeName : t('visits.add')}
      description={visit ? t('visits.visitedOn', { date: fmt.relativeDay(visit.visitedAt) }) : t('visits.addHint')}
      size="md"
      footer={
        <div className="flex gap-2">
          {visit && visit.status !== 'connected' && (
            <Button variant="outline" className="flex-1" leftIcon={<Store aria-hidden />} onClick={connectNow} loading={connect.isPending}>
              {t('visits.startConnect')}
            </Button>
          )}
          <Button className="flex-1" onClick={save} loading={create.isPending || update.isPending}>
            {t('visits.save')}
          </Button>
        </div>
      }
    >
      <form noValidate className="flex flex-col gap-5" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <FormField label={t('visits.statusLabel')}>
          <SegmentedControl
            fullWidth
            value={form.status}
            onValueChange={(v) => set({ status: v as VisitStatus })}
            options={(['thinking', 'connected', 'refused'] as const).map((s) => ({ value: s, label: t(`visits.status.${s}`) }))}
          />
        </FormField>
        {form.status === 'thinking' && (
          <FormField label={t('visits.callbackDate')} optional>
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-2">
                {callbackPresets(today()).map((p) => (
                  <Chip key={p.id} selected={form.callbackDate === p.date} onClick={() => set({ callbackDate: p.date })}>
                    {t(`visits.preset.${p.id}`)}
                  </Chip>
                ))}
              </div>
              <DatePicker value={form.callbackDate ?? null} onValueChange={(d) => set({ callbackDate: d ?? undefined })} min={today()} clearable />
              {visit?.callbackDate && (
                <Button variant="ghost" size="sm" className="self-start" onClick={markCalled} loading={callbackDone.isPending}>
                  {t('visits.callbackDone')}
                </Button>
              )}
            </div>
          </FormField>
        )}
        {form.status === 'refused' && (
          <FormField label={t('visits.refusalReason')} optional>
            <Input value={form.refusalReason ?? ''} onChange={(e) => set({ refusalReason: e.target.value })} placeholder={t('visits.refusalPlaceholder')} />
          </FormField>
        )}

        <SectionCard title={t('visits.answersTitle')} description={t('visits.answersHint')} padding="md">
          <div className="flex flex-col gap-4">
            <FormField label={t('visits.currentTool')} optional>
              <div className="flex flex-wrap gap-2">
                {TOOLS.map((tool) => (
                  <Chip key={tool} selected={form.currentTool === tool} onClick={() => set({ currentTool: form.currentTool === tool ? undefined : tool })}>
                    {t(`visits.tool.${tool}`)}
                  </Chip>
                ))}
              </div>
            </FormField>
            <FormField label={t('visits.willingToPay')} optional hint={t('visits.willingToPayHint')}>
              <MoneyInput value={form.willingToPay} onValueChange={(v) => set({ willingToPay: v })} />
            </FormField>
          </div>
        </SectionCard>

        <SectionCard title={t('visits.contactTitle')} padding="md">
          <div className="flex flex-col gap-4">
            <FormField label={t('visits.placeName')} required error={error && !form.placeName.trim() ? t('visits.placeNameRequired') : undefined}>
              <Input value={form.placeName} onChange={(e) => set({ placeName: e.target.value })} />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label={t('visits.contactName')} optional>
                <Input value={form.contactName ?? ''} onChange={(e) => set({ contactName: e.target.value })} />
              </FormField>
              <FormField label={t('visits.phone')} optional>
                <PhoneInput value={form.phone ?? ''} onValueChange={(v) => set({ phone: v })} />
              </FormField>
            </div>
            {visit?.phone && (
              <a href={telLink(visit.phone)} className="inline-flex items-center gap-2 self-start text-sm font-medium text-primary-text hover:underline">
                <Phone aria-hidden className="size-4" />
                {t('visits.call', { phone: fmt.phone(visit.phone) })}
              </a>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label={t('visits.district')}>
                <Select value={form.district} onValueChange={(v) => set({ district: v as DistrictId })} options={DISTRICT_IDS.map((d) => ({ value: d, label: tc(`districts.${d}`) }))} />
              </FormField>
              <FormField label={t('visits.sphere')} optional>
                <Select
                  value={form.sphereId ?? ''}
                  onValueChange={(v) => set({ sphereId: (v || undefined) as SphereId | undefined })}
                  options={SPHERE_IDS.map((s) => ({ value: s, label: tc(`spheres.${s}`) }))}
                  placeholder={t('visits.spherePlaceholder')}
                />
              </FormField>
            </div>
            <FormField label={t('visits.address')} optional>
              <Input value={form.address ?? ''} onChange={(e) => set({ address: e.target.value })} />
            </FormField>
            <FormField label={t('visits.responsible')}>
              <Select value={responsibleId} onValueChange={(v) => set({ responsibleId: v })} options={(teamQ.data ?? []).map((m) => ({ value: m.id, label: m.name }))} />
            </FormField>
            <FormField label={t('visits.note')} optional>
              <Textarea value={form.note ?? ''} onChange={(e) => set({ note: e.target.value })} rows={2} placeholder={t('visits.notePlaceholder')} />
            </FormField>
          </div>
        </SectionCard>

        {visit && <VisitHistory visit={visit} />}
      </form>
    </Sheet>
  );
}
