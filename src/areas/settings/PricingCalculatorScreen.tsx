'use client';

/**
 * /biz/onboarding/pricing — калькулятор цены до регистрации (F-15-178, добавлено проверкой 1). Тип бизнеса,
 * мастера, администраторы, срок → цена в драмах, «Начать» ведёт в регистрацию. Переключателя «с промокодом
 * для всех» нет (Снято 16) — калькулятор всегда без скидки.
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Minus, Plus } from 'lucide-react';
import { calculatePriceForPlan } from '@/api/settings';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import type { BusinessKind } from '@/domain/core';
import { Button } from '@/ui/Button';
import { ChoiceGroup } from '@/ui/ChoiceGroup';
import { IconButton } from '@/ui/IconButton';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';

const MONTH_OPTIONS = [1, 3, 6, 12];

function Stepper({ value, min, max, label, onChange }: { value: number; min: number; max: number; label: string; onChange: (v: number) => void }) {
  const set = (v: number) => onChange(Math.min(max, Math.max(min, v)));
  return (
    <div className="flex items-center gap-3">
      <IconButton icon={<Minus aria-hidden />} label={`− ${label}`} variant="outline" size="sm" disabled={value <= min} onClick={() => set(value - 1)} />
      <span className="nums w-8 text-center text-base font-semibold text-fg">{value}</span>
      <IconButton icon={<Plus aria-hidden />} label={`+ ${label}`} variant="outline" size="sm" disabled={value >= max} onClick={() => set(value + 1)} />
    </div>
  );
}

export function PricingCalculatorScreen() {
  const t = useT('settings');
  const format = useFormat();
  const router = useRouter();
  const [kind, setKind] = useState<BusinessKind>('salon');
  const [masters, setMasters] = useState(2);
  const [admins, setAdmins] = useState(1);
  const [months, setMonths] = useState(1);

  const quote = calculatePriceForPlan({ kind, masters, admins, months });

  return (
    <div data-f="F-15-178" className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
      <PageHeader title={t('pricing.title')} description={t('pricing.description')} />

      <SectionCard title={t('pricing.kindTitle')}>
        <ChoiceGroup
          aria-label={t('pricing.kindTitle')}
          options={[
            { value: 'individual', title: t('billing.planKind.individual') },
            { value: 'salon', title: t('billing.planKind.salon') },
          ]}
          value={kind}
          onValueChange={(v) => setKind(v as BusinessKind)}
          columns={2}
        />
      </SectionCard>

      {kind === 'salon' && (
        <SectionCard title={t('pricing.staffTitle')}>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-fg">{t('pricing.masters')}</span>
              <Stepper value={masters} min={0} max={30} label={t('pricing.masters')} onChange={setMasters} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-fg">{t('pricing.admins')}</span>
              <Stepper value={admins} min={0} max={10} label={t('pricing.admins')} onChange={setAdmins} />
            </div>
          </div>
        </SectionCard>
      )}

      <SectionCard title={t('pricing.periodTitle')}>
        <ChoiceGroup
          aria-label={t('pricing.periodTitle')}
          options={MONTH_OPTIONS.map((m) => ({ value: String(m), title: t('manage.months', { count: m }) }))}
          value={String(months)}
          onValueChange={(v) => setMonths(Number(v))}
          columns={2}
        />
      </SectionCard>

      <SectionCard title={t('pricing.resultTitle')}>
        <div className="flex flex-col gap-3">
          <ul className="flex flex-col gap-1.5">
            {quote.breakdown.map((line, i) => (
              <li key={i} className="flex items-center justify-between text-sm">
                <span className="text-muted">{t(line.labelKey, { count: line.count })}</span>
                <span className="nums text-fg">{format.money(line.amount)}</span>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between border-t border-border pt-3">
            <span className="text-base font-semibold text-fg">{t('pricing.total', { count: months })}</span>
            <span className="nums text-lg font-semibold text-fg">{format.money(quote.total)}</span>
          </div>
        </div>
      </SectionCard>

      <Button variant="primary" size="lg" onClick={() => router.push('/register-business')}>
        {t('pricing.start')}
      </Button>
    </div>
  );
}
