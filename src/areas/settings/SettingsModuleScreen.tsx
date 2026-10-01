'use client';

/**
 * /biz/settings/modules/<area> — настройки раздела из его вклада в хаб (Н7, настройки-ревью 27.09.2026).
 * Хаб показывает разделы плитками-ссылками; у кого своего экрана настроек нет (клиенты, график, сотрудники,
 * лояльность, сеть), вклад открывается здесь — один, на всю ширину формы. Сам вклад — файл своего раздела.
 */
import { Blocks } from 'lucide-react';
import { useCurrent } from '@/demo/hooks';
import { ExtensionSlot } from '@/extensions/ExtensionSlot';
import { useExtensions } from '@/extensions/useExtensions';
import { useT } from '@/i18n/useT';
import { EmptyState } from '@/ui/EmptyState';
import { PageHeader } from '@/ui/PageHeader';
import { Skeleton } from '@/ui/Skeleton';

export interface SettingsModuleScreenProps {
  area: string;
}

export function SettingsModuleScreen({ area }: SettingsModuleScreenProps) {
  const t = useT('settings');
  const tc = useT('common');
  const { businessId, ready } = useCurrent();
  const entry = useExtensions('settingsHub').find((e) => e.area === area);

  return (
    <div data-f="F-15-120" className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
      <PageHeader
        title={entry ? tc(`ext.settingsHub.${entry.area}` as never) : t('hub.groupModules')}
        description={entry ? t(`hub.modules.${entry.area}.description` as never) : undefined}
        back={{ href: '/biz/settings' }}
      />
      {!ready ? (
        <Skeleton variant="rect" className="h-40" />
      ) : !entry || !businessId ? (
        <EmptyState icon={<Blocks aria-hidden />} title={t('hub.moduleMissing')} />
      ) : (
        <ExtensionSlot entry={entry} props={{ businessId }} />
      )}
    </div>
  );
}
