'use client';

/**
 * Вклад раздела «integrations» в хаб настроек /biz/settings (хост «settingsHub», F-13-001):
 * короткие ссылки на каталог, «Установлено» (со счётчиком) и API/вебхуки.
 */
import { Blocks, Code2, Puzzle } from 'lucide-react';
import { countInstalledForBusiness } from '@/api/integrations';
import { useApiQuery } from '@/api/request';
import type { SettingsHubExtProps } from '@/extensions/types';
import { useT } from '@/i18n/useT';
import { LinkButton } from '@/ui/Button';
import { SectionCard } from '@/ui/SectionCard';
import { SkeletonText } from '@/ui/Skeleton';

export default function IntegrationsSettingsHub(props: SettingsHubExtProps) {
  const t = useT('integrations');
  const q = useApiQuery(['integrations', 'countInstalled', props.businessId], () => countInstalledForBusiness(props.businessId));

  return (
    <div data-f="F-13-001" className="flex flex-col gap-3">
      <SectionCard title={t('hub.title')} description={t('hub.subtitle')}>
        <div className="flex flex-col gap-2 sm:flex-row">
          <LinkButton href="/biz/integrations" variant="secondary" leftIcon={<Blocks aria-hidden />} fullWidth>
            {t('nav.catalog')}
          </LinkButton>
          <LinkButton href="/biz/integrations/installed" variant="secondary" leftIcon={<Puzzle aria-hidden />} fullWidth>
            {/* Пока число грузится — его место уже занято полосой: подпись кнопки не дописывается после загрузки */}
            {t('nav.installed')} {q.isLoading ? <SkeletonText width="3ch" /> : typeof q.data === 'number' && q.data > 0 ? `(${q.data})` : ''}
          </LinkButton>
          <LinkButton href="/biz/integrations/api" variant="secondary" leftIcon={<Code2 aria-hidden />} fullWidth>
            {t('nav.api')}
          </LinkButton>
        </div>
      </SectionCard>
    </div>
  );
}
