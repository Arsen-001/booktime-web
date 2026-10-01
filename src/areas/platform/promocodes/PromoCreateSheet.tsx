'use client';

/** Новый промокод: вид, код (можно «Придумать»), ступени скидки или дни, кому (личный), срок. */
import { useGuardedClose } from '@/areas/platform/hooks/useGuardedClose';
import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { ApiError, useApiMutation } from '@/api/request';
import { createPromoCode } from '@/api/platform';
import { useBusinessesLite, useVisitBusinesses } from '@/areas/platform/hooks/usePlatformData';
import { PromoTierInputs, TIER_MONTHS } from '@/areas/platform/promocodes/PromoTierInputs';
import { clampTierPercent, suggestPromoCode, type PromoInput, type PromoKind, type PromoMonths } from '@/domain/platform';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { Combobox } from '@/ui/Combobox';
import { DatePicker } from '@/ui/DatePicker';
import { FormField } from '@/ui/FormField';
import { IconButton } from '@/ui/IconButton';
import { Input } from '@/ui/Input';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { Sheet } from '@/ui/Sheet';
import { Switch } from '@/ui/Switch';
import { Textarea } from '@/ui/Textarea';
import { useToast } from '@/ui/Toast';
import { today } from '@/lib/date';

export function PromoCreateSheet({ onClose }: { onClose: () => void }) {
  const t = useT('platform');
  const toast = useToast();
  const allQ = useBusinessesLite();
  const visitQ = useVisitBusinesses();
  const create = useApiMutation(createPromoCode);
  const [kind, setKind] = useState<PromoKind>('discount');
  const [code, setCode] = useState('');
  const [tiers, setTiers] = useState<Record<PromoMonths, number>>({ 1: 0, 3: 10, 6: 15, 12: 25 });
  const [freeDays, setFreeDays] = useState(30);
  const [personal, setPersonal] = useState(false);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [validUntil, setValidUntil] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<'code' | 'duplicate' | 'business' | null>(null);
  const dirty = Boolean(code || note.trim() || businessId || validUntil || personal) || kind !== 'discount' || freeDays !== 30 || JSON.stringify(tiers) !== JSON.stringify({ 1: 0, 3: 10, 6: 15, 12: 25 });
  const onOpenChange = useGuardedClose(dirty, onClose);

  // F-00-019: бесплатный месяц — только лично и только подключённым на визите
  const isFree = kind === 'freeMonth';
  const needsBusiness = personal || isFree;
  const options = (isFree ? visitQ.data : allQ.data)?.map((b) => ({ value: b.id, label: b.name })) ?? [];
  const businessName = options.find((o) => o.value === businessId)?.label;

  const invent = () => {
    setCode(suggestPromoCode(businessName ?? 'SALON', Math.random().toString(36).slice(2, 6)));
    setError(null);
  };

  const submit = async () => {
    if (!/^[A-Z0-9-]{3,24}$/.test(code)) return setError('code');
    if (needsBusiness && !businessId) return setError('business');
    const input: PromoInput = {
      code,
      kind,
      tiers: isFree ? [] : TIER_MONTHS.map((m) => ({ months: m, percent: clampTierPercent(m, tiers[m]) })).filter((x) => x.percent > 0 || x.months === 1),
      freeDays: isFree ? freeDays : undefined,
      personal: needsBusiness,
      validUntil: validUntil ?? undefined,
      issuedTo: businessId ? { name: businessName ?? '', businessId } : undefined,
      note: note.trim() || undefined,
    };
    try {
      await create.mutate(input);
      toast.success(t('promocodes.saved', { code }));
      onClose();
    } catch (e) {
      if (e instanceof ApiError && e.code === 'duplicate') setError('duplicate');
      else toast.error(t('promocodes.saveFailed'));
    }
  };

  return (
    <Sheet
      open
      onOpenChange={onOpenChange}
      title={t('promocodes.add')}
      size="md"
      footer={
        <Button fullWidth onClick={submit} loading={create.isPending}>
          {t('promocodes.create')}
        </Button>
      }
    >
      <form noValidate className="flex flex-col gap-5" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <SegmentedControl
          fullWidth
          value={kind}
          onValueChange={(v) => { setKind(v as PromoKind); setBusinessId(null); }}
          options={[
            { value: 'discount', label: t('promocodes.kindShort.discount') },
            { value: 'freeMonth', label: t('promocodes.kindShort.freeMonth') },
          ]}
        />
        <FormField
          label={t('promocodes.code')}
          required
          hint={t('promocodes.codeHint')}
          error={error === 'code' ? t('promocodes.codeInvalid') : error === 'duplicate' ? t('promocodes.codeTaken') : undefined}
        >
          <Input
            value={code}
            onChange={(e) => { setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '')); setError(null); }}
            className="font-mono"
            autoCapitalize="characters"
            rightSlot={<IconButton icon={<Sparkles />} label={t('promocodes.invent')} size="sm" onClick={invent} />}
          />
        </FormField>
        {isFree ? (
          <FormField label={t('promocodes.freeDays')}>
            <Input inputMode="numeric" value={String(freeDays)} onChange={(e) => setFreeDays(Math.min(365, Number(e.target.value.replace(/\D/g, '') || 0)))} rightSlot={<span className="px-3 text-muted">{t('promocodes.daysUnit')}</span>} />
          </FormField>
        ) : (
          <FormField label={t('promocodes.tiers')} hint={t('promocodes.tiersHint')}>
            <PromoTierInputs value={tiers} onChange={setTiers} />
          </FormField>
        )}
        {isFree ? (
          <p className="rounded-xl bg-surface-2 px-4 py-3 text-sm text-muted">{t('promocodes.grantEligibleOnly')}</p>
        ) : (
          <Switch checked={personal} onCheckedChange={(v) => { setPersonal(v); setBusinessId(null); }} label={t('promocodes.personal')} description={t('promocodes.personalHint')} />
        )}
        {needsBusiness && (
          <FormField label={t('promocodes.issuedToBusiness')} required error={error === 'business' ? t('promocodes.businessRequired') : undefined}>
            <Combobox
              options={options}
              value={businessId}
              onValueChange={(v) => { setBusinessId(v); setError(null); }}
              placeholder={t('promocodes.findBusiness')}
              emptyText={isFree ? t('promocodes.grantNoBusinesses') : t('promocodes.noBusinessFound')}
              loading={isFree ? visitQ.isLoading : allQ.isLoading}
            />
          </FormField>
        )}
        <FormField label={t('promocodes.validUntil')} optional>
          <DatePicker value={validUntil} onValueChange={setValidUntil} min={today()} clearable placeholder={t('promocodes.noLimit')} />
        </FormField>
        <FormField label={t('promocodes.note')} optional>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
        </FormField>
      </form>
    </Sheet>
  );
}
