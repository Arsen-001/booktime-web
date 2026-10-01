'use client';

/** /platform/plan — план запуска: волны (F-00-203…205), окупаемость (F-00-206), до постройки (F-00-207), имя (F-00-208). */
import { useState } from 'react';
import { BrandPanel } from '@/areas/platform/plan/BrandPanel';
import { PaybackPanel } from '@/areas/platform/plan/PaybackPanel';
import { PrelaunchPanel } from '@/areas/platform/plan/PrelaunchPanel';
import { WavesPanel } from '@/areas/platform/plan/WavesPanel';
import { useT } from '@/i18n/useT';
import { PageHeader } from '@/ui/PageHeader';
import { Tabs } from '@/ui/Tabs';

type PlanTab = 'waves' | 'payback' | 'prelaunch' | 'brand';

export function PlanScreen() {
  const t = useT('platform');
  const [tab, setTab] = useState<PlanTab>('waves');
  return (
    <div data-f="F-00-203 F-00-204 F-00-205 F-00-206 F-00-207 F-00-208" className="flex flex-col gap-6">
      <PageHeader title={t('plan.title')} description={t('plan.subtitle')} />
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as PlanTab)}
        items={(['waves', 'payback', 'prelaunch', 'brand'] as const).map((v) => ({ value: v, label: t(`plan.tab.${v}`) }))}
      />
      {tab === 'waves' && <WavesPanel />}
      {tab === 'payback' && <PaybackPanel />}
      {tab === 'prelaunch' && <PrelaunchPanel />}
      {tab === 'brand' && <BrandPanel />}
    </div>
  );
}
