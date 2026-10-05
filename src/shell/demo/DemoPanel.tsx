'use client';

import { Briefcase, RotateCcw, ShieldCheck, Smartphone } from 'lucide-react';
import { useLocale } from 'next-intl';
import { SPHERE_IDS } from '@/config/spheres';
import { EMPTY_PERSONAS, PERSONA_IDS, type ApiMode, type FontScale, type PersonaId, type Theme } from '@/demo/settings';
import { useApplyDemo, useDemo } from '@/demo/hooks';
import type { LocaleCode, SphereId } from '@/domain/core';
import { LOCALES, type Locale } from '@/i18n/config';
import { useFormat } from '@/i18n/useFormat';
import { toISODateTime } from '@/lib/date';
import { useT } from '@/i18n/useT';
import { resetDemoData, useDb } from '@/mock/db';
import { LinkButton, Button } from '@/ui/Button';
import { FormField } from '@/ui/FormField';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { Select } from '@/ui/Select';
import { useConfirm, useToast } from '@/ui/Toast';

const LANG_LABEL: Record<Locale, string> = { ru: 'Русский', hy: 'Հայերեն', en: 'English' };

/** Значение пункта «пустой бизнес» в списке персон: 'owner:empty', 'individual:empty' */
const EMPTY_SUFFIX = ':empty';
const EMPTY_LABEL_KEY = {
  owner: 'demo.personas.ownerEmpty',
  individual: 'demo.personas.individualEmpty',
} as const;

/** Содержимое демо-шторки */
export function DemoPanel({ onNavigate }: { onNavigate: () => void }) {
  const t = useT('common');
  const fmt = useFormat();
  const settings = useDemo();
  const locale = useLocale() as LocaleCode;
  const apply = useApplyDemo();
  const toast = useToast();
  const confirm = useConfirm();
  const seededAt = useDb((s) => s.meta.seededAt);
  const isEmpty = settings.empty === '1' && EMPTY_PERSONAS.includes(settings.persona);

  // После «Владельца салона» и «Мастера-индивидуала» — их пустые варианты для проверки пустых состояний
  const personaOptions = PERSONA_IDS.flatMap((p) => {
    const option = { value: p as string, label: t(`demo.personas.${p}`) };
    const emptyKey = p === 'owner' || p === 'individual' ? EMPTY_LABEL_KEY[p] : undefined;
    return emptyKey ? [option, { value: `${p}${EMPTY_SUFFIX}`, label: t(emptyKey) }] : [option];
  });

  const onPersona = (value: string) => {
    const empty = value.endsWith(EMPTY_SUFFIX);
    apply({ persona: value.replace(EMPTY_SUFFIX, '') as PersonaId, empty: empty ? '1' : '0', appUser: '' });
  };

  const onReset = async () => {
    const ok = await confirm({
      title: t('demo.resetConfirmTitle'),
      description: t('demo.resetConfirmText'),
      confirmLabel: t('demo.reset'),
      tone: 'danger',
    });
    if (!ok) return;
    resetDemoData(locale);
    toast.success(t('demo.resetDone'));
  };

  return (
    <div className="flex flex-col gap-5">
      <FormField label={t('demo.persona')} hint={isEmpty ? t('demo.emptyHint') : undefined}>
        <Select
          value={isEmpty ? `${settings.persona}${EMPTY_SUFFIX}` : settings.persona}
          onValueChange={onPersona}
          options={personaOptions}
        />
      </FormField>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-fg">{t('demo.where')}</span>
        <div className="grid grid-cols-3 gap-2">
          <LinkButton href="/" size="sm" variant="secondary" onClick={onNavigate} leftIcon={<Smartphone aria-hidden />}>
            {t('demo.goClient')}
          </LinkButton>
          <LinkButton
            href="/biz"
            size="sm"
            variant="secondary"
            onClick={onNavigate}
            leftIcon={<Briefcase aria-hidden />}
          >
            {t('demo.goBiz')}
          </LinkButton>
          <LinkButton
            href="/platform"
            size="sm"
            variant="secondary"
            onClick={onNavigate}
            leftIcon={<ShieldCheck aria-hidden />}
          >
            {t('demo.goPlatform')}
          </LinkButton>
        </div>
      </div>

      <FormField label={t('demo.sphere')}>
        <Select
          value={settings.sphere}
          onValueChange={(v) => apply({ sphere: v as SphereId })}
          options={SPHERE_IDS.map((s) => ({ value: s, label: t(`spheres.${s}`) }))}
        />
      </FormField>

      <FormField label={t('demo.language')}>
        <SegmentedControl
          fullWidth
          value={settings.lang}
          onValueChange={(v) => apply({ lang: v as Locale })}
          options={LOCALES.map((l) => ({ value: l, label: LANG_LABEL[l] }))}
        />
      </FormField>

      <FormField label={t('demo.theme')}>
        <SegmentedControl
          fullWidth
          value={settings.theme}
          onValueChange={(v) => apply({ theme: v as Theme })}
          options={[
            { value: 'light', label: t('demo.light') },
            { value: 'dark', label: t('demo.dark') },
          ]}
        />
      </FormField>

      <FormField label={t('demo.font')}>
        <SegmentedControl
          fullWidth
          value={settings.font}
          onValueChange={(v) => apply({ font: v as FontScale })}
          options={[
            { value: 'normal', label: t('demo.fontNormal') },
            { value: 'large', label: t('demo.fontLarge') },
          ]}
        />
      </FormField>

      <FormField label={t('demo.api')}>
        <SegmentedControl
          fullWidth
          value={settings.api}
          onValueChange={(v) => apply({ api: v as ApiMode })}
          options={[
            { value: 'normal', label: t('demo.apiNormal') },
            { value: 'slow', label: t('demo.apiSlow') },
            { value: 'error', label: t('demo.apiError') },
          ]}
        />
      </FormField>

      <div className="flex flex-col gap-2 border-t border-border pt-4">
        <Button variant="outline" leftIcon={<RotateCcw aria-hidden />} onClick={onReset}>
          {t('demo.reset')}
        </Button>
        {seededAt && (
          <p className="text-center text-xs text-muted">
            {t('demo.seededAt', { date: fmt.dateTime(toISODateTime(new Date(seededAt))) })}
          </p>
        )}
      </div>
    </div>
  );
}
