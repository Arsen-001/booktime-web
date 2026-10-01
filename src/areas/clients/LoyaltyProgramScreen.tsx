'use client';

/**
 * /biz/clients/loyalty — «Программа лояльности» локации (F-04-114…122, 158): автоматическая скидка,
 * класс важности и категории по тратам/визитам/статусам записи. Старый, ограниченный движок локации —
 * не путать с сетевой лояльностью (раздел loyalty, другая область владения).
 */
import { useEffect, useRef, useState } from 'react';
import { Award, Gift, Plus, Shield, Sliders, Tags, Trash2 } from 'lucide-react';
import { getLoyaltyProgram, saveLoyaltyProgram } from '@/api/clients';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useCan, useCurrent } from '@/demo/hooks';
import {
  CATEGORY_TRIGGERS_WITH_THRESHOLD,
  LOYALTY_BASES,
  type CategoryAutoRule,
  type CategoryTriggerKind,
  type ClassRules,
  type DiscountTier,
  type ImportanceClass,
  type LoyaltyBasis,
  type LoyaltyProgram,
  type LoyaltySettings,
} from '@/domain/clients';
import type { Id } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { Combobox } from '@/ui/Combobox';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { IconButton } from '@/ui/IconButton';
import { Input } from '@/ui/Input';
import { MoneyInput } from '@/ui/MoneyInput';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';
import { Select } from '@/ui/Select';
import { Skeleton, SkeletonText } from '@/ui/Skeleton';
import { Switch } from '@/ui/Switch';
import { Tabs, type TabItem } from '@/ui/Tabs';
import { useToast } from '@/ui/Toast';
import { useUnsavedGuard } from '@/ui/hooks/useUnsavedGuard';

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export function LoyaltyProgramScreen() {
  const t = useT('clients');
  const toast = useToast();
  const { ready, businessId } = useCurrent();
  // F-06-019 «Настройка программ лояльности» (локация): право `loyalty.rules` — по умолчанию только
  // у владельца, администратору выдаётся галочкой (Сотрудники → Доступ → Клиентская база → «Правила
  // начисления бонусов», src/areas/staff/permissions/catalog.ts). Раньше здесь стоял `settings.manage`
  // (заглушка на время, пока права не было в фундаменте) — право уже заведено, переключаем.
  const canManage = useCan('loyalty.rules');

  const query = useApiQuery(['clients', 'loyalty', businessId], () => getLoyaltyProgram(businessId ?? ''), { enabled: ready && Boolean(businessId) });

  const [draft, setDraft] = useState<LoyaltyProgram | null>(null);
  // Заводим черновик из загруженной программы один раз на бизнес. Раньше это был условный setState
  // прямо в рендере — при query.data, уже готовом к первому клиентскому рендеру, это давало
  // «Hydration failed…» / «state update on a component that hasn't mounted yet» (recheck-c3 minor;
  // тот же приём, что и в loyalty/AutoApplyScreen.tsx b01-fix2). useEffect с ref, а не вторым
  // useState, откладывает запись состояния до коммита без второго setState в эффекте.
  const seededFor = useRef<Id | undefined>(undefined);
  // Э3 (clients-review 27.09.2026): «Сохранить» было включено, даже когда ничего не менялось — сверяем
  // черновик с последним загруженным/сохранённым состоянием. useState, а не ref: ref нельзя читать
  // в теле рендера (react-hooks/refs) — значение нужно именно для рендера кнопки, не только в эффекте.
  const [original, setOriginal] = useState<LoyaltyProgram | null>(null);
  useEffect(() => {
    if (query.data && seededFor.current !== businessId) {
      seededFor.current = businessId;
      setDraft(query.data);
      setOriginal(query.data);
    }
  }, [query.data, businessId]);

  const save = useApiMutation((program: LoyaltyProgram) => saveLoyaltyProgram(businessId ?? '', program));
  const dirty = draft !== null && JSON.stringify(draft) !== JSON.stringify(original);
  // Несохранённые правила — уход со страницы по ссылке (меню, «Назад») и закрытие вкладки сначала спрашивают
  useUnsavedGuard(dirty);

  const [tab, setTab] = useState('discounts');

  if (query.isError) return <ErrorState onRetry={query.refetch} />;

  const tabs: TabItem[] = [
    { value: 'discounts', label: t('loyaltyPage.tabs.discounts'), icon: <Sliders aria-hidden className="size-4" /> },
    { value: 'classes', label: t('loyaltyPage.tabs.classes'), icon: <Award aria-hidden className="size-4" /> },
    { value: 'categories', label: t('loyaltyPage.tabs.categories'), icon: <Tags aria-hidden className="size-4" /> },
    { value: 'settings', label: t('loyaltyPage.tabs.settings'), icon: <Shield aria-hidden className="size-4" /> },
  ];


  const onSave = async () => {
    if (!draft) return;
    try {
      const result = await save.mutate(draft);
      setOriginal(draft);
      toast.success(t('loyaltyPage.saved', { count: result.recalculated }));
      query.refetch();
    } catch {
      toast.error(t('loyaltyPage.saveFailed'));
    }
  };

  return (
    <div data-f="F-04-114 F-04-121 F-06-013 F-06-014 F-06-019" className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
      <PageHeader
        title={t('loyaltyPage.title')}
        description={t('loyaltyPage.subtitle')}
        actions={
          canManage ? (
            <Button loading={save.isPending} onClick={onSave} disabled={!draft || !dirty}>
              {t('loyaltyPage.save')}
            </Button>
          ) : undefined
        }
      />

      {!canManage ? (
        <EmptyState icon={<Shield aria-hidden />} title={t('loyaltyPage.noAccessTitle')} description={t('loyaltyPage.noAccessText')} />
      ) : query.isLoading || !draft ? (
        // Скелетон = та же страница: карточка «Включить», вкладки и пороги скидок (в демо — два), поля неактивны
        <>
          <SectionCard title={t('loyaltyPage.enableTitle')} description={t('loyaltyPage.enableText')} padding="sm">
            <div className="flex min-h-11 items-center justify-between gap-3">
              <span className="text-sm text-fg">
                <SkeletonText width="18ch" />
              </span>
              <Switch checked={false} disabled aria-hidden tabIndex={-1} />
            </div>
          </SectionCard>
          <Tabs items={tabs} value={tab} onValueChange={setTab} classNames={{ list: 'px-9' }} />
          {tab === 'discounts' ? (
            <DiscountTiersTab tiers={SKELETON_TIERS} onChange={() => {}} t={t} loading />
          ) : (
            <Skeleton variant="rect" className="h-64 rounded-lg" />
          )}
        </>
      ) : (
        <>
          <SectionCard title={t('loyaltyPage.enableTitle')} description={t('loyaltyPage.enableText')} padding="sm">
            <label className="flex min-h-11 items-center justify-between gap-3">
              <span className="text-sm text-fg">{draft.enabled ? t('loyaltyPage.enabledOn') : t('loyaltyPage.enabledOff')}</span>
              <Switch checked={draft.enabled} onCheckedChange={(enabled) => setDraft({ ...draft, enabled })} />
            </label>
          </SectionCard>

          {/* F-04-114: как и в карточке клиента — боковой отступ полосы держит подпись вкладки видимой
              под круглой стрелкой прокрутки (иначе на телефоне активная вкладка справа/слева обрезается). */}
          <Tabs items={tabs} value={tab} onValueChange={setTab} classNames={{ list: 'px-9' }} />

          {tab === 'discounts' && (
            <div data-f="F-04-115 F-04-116 F-06-008">
              <DiscountTiersTab tiers={draft.discountTiers} onChange={(discountTiers) => setDraft({ ...draft, discountTiers })} t={t} />
            </div>
          )}
          {tab === 'classes' && (
            <div data-f="F-04-117 F-06-009">
              <ClassRulesTab rules={draft.classRules} onChange={(classRules) => setDraft({ ...draft, classRules })} t={t} />
            </div>
          )}
          {tab === 'categories' && (
            <div data-f="F-04-118 F-04-119 F-04-158 F-06-010 F-06-011 F-15-129">
              <CategoryRulesTab
                addRules={draft.addRules}
                removeRules={draft.removeRules}
                onChangeAdd={(addRules) => setDraft({ ...draft, addRules })}
                onChangeRemove={(removeRules) => setDraft({ ...draft, removeRules })}
                t={t}
              />
            </div>
          )}
          {tab === 'settings' && (
            <div data-f="F-04-120 F-06-012">
              <SettingsTab settings={draft.settings} onChange={(settings) => setDraft({ ...draft, settings })} t={t} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Пороги-заглушки на время загрузки: как в демо — «продано» и «визиты» (значения не показываются) */
const SKELETON_TIERS: DiscountTier[] = [
  { id: 'sk_1', basis: 'sold', from: 0, percent: 0 },
  { id: 'sk_2', basis: 'visits', from: 0, percent: 0 },
];

function DiscountTiersTab({
  tiers,
  onChange,
  t,
  loading = false,
}: {
  tiers: DiscountTier[];
  onChange: (tiers: DiscountTier[]) => void;
  t: ReturnType<typeof useT<'clients'>>;
  /** Скелетон: та же разметка строк, поля неактивны и пусты */
  loading?: boolean;
}) {
  const add = () => onChange([...tiers, { id: newId('dt'), basis: 'sold', from: 0, percent: 0 }]);
  const update = (id: string, patch: Partial<DiscountTier>) => onChange(tiers.map((tr) => (tr.id === id ? { ...tr, ...patch } : tr)));
  const remove = (id: string) => onChange(tiers.filter((tr) => tr.id !== id));

  return (
    <SectionCard
      title={t('loyaltyPage.discounts.title')}
      description={t('loyaltyPage.discounts.description')}
      actions={
        <Button size="sm" variant="outline" leftIcon={<Plus aria-hidden className="size-4" />} onClick={add} disabled={loading}>
          {t('loyaltyPage.discounts.add')}
        </Button>
      }
    >
      {tiers.length === 0 ? (
        <EmptyState icon={<Sliders aria-hidden />} title={t('loyaltyPage.discounts.emptyTitle')} description={t('loyaltyPage.discounts.emptyText')} />
      ) : (
        // Э3 (clients-review 27.09.2026): «Продано от · от 100 000 ֏ · % 5» читалось с трудом (два «от», % отдельно
        // от числа) — теперь строка читается предложением: «Если продано от [100 000 ֏] → скидка [5] %».
        <ul className="flex flex-col gap-3">
          {tiers.map((tier) => (
            <li key={tier.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3">
              <span className="text-sm whitespace-nowrap text-muted">{t('loyaltyPage.discounts.if')}</span>
              <Select
                className="w-auto min-w-40"
                options={LOYALTY_BASES.map((b) => ({ value: b, label: t(`loyaltyPage.basis.${b}`) }))}
                value={tier.basis}
                onValueChange={(v) => update(tier.id, { basis: v as LoyaltyBasis })}
                disabled={loading}
              />
              {tier.basis === 'visits' ? (
                <Input
                  className="w-24"
                  type="text"
                  inputMode="numeric"
                  value={loading ? '' : String(tier.from)}
                  disabled={loading}
                  onChange={(e) => update(tier.id, { from: Number(e.target.value.replace(/\D/g, '')) || 0 })}
                  aria-label={t(`loyaltyPage.basis.${tier.basis}`)}
                />
              ) : (
                <MoneyInput
                  className="w-36"
                  value={loading ? undefined : tier.from}
                  disabled={loading}
                  onValueChange={(v) => update(tier.id, { from: v ?? 0 })}
                  aria-label={t(`loyaltyPage.basis.${tier.basis}`)}
                />
              )}
              <span className="text-sm whitespace-nowrap text-muted">→ {t('loyaltyPage.discounts.thenDiscount')}</span>
              <Input
                className="w-16"
                type="text"
                inputMode="numeric"
                value={loading ? '' : String(tier.percent)}
                disabled={loading}
                onChange={(e) => update(tier.id, { percent: Number(e.target.value.replace(/\D/g, '')) || 0 })}
                aria-label={t('loyaltyPage.discounts.percent')}
              />
              <span className="text-sm text-muted">{t('loyaltyPage.discounts.percent')}</span>
              <div className="flex-1" />
              <IconButton icon={<Trash2 aria-hidden />} label={t('loyaltyPage.remove')} variant="ghost" onClick={() => remove(tier.id)} disabled={loading} />
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

const CLASS_ORDER: ImportanceClass[] = ['gold', 'silver', 'bronze'];

function ClassRulesTab({ rules, onChange, t }: { rules: ClassRules; onChange: (r: ClassRules) => void; t: ReturnType<typeof useT<'clients'>> }) {
  const update = (cls: ImportanceClass, patch: Partial<ClassRules[ImportanceClass]>) => onChange({ ...rules, [cls]: { ...rules[cls], ...patch } });
  return (
    <SectionCard title={t('loyaltyPage.classes.title')} description={t('loyaltyPage.classes.description')}>
      <ul className="flex flex-col gap-4">
        {CLASS_ORDER.map((cls) => {
          const r = rules[cls];
          return (
            <li key={cls} className="rounded-lg border border-border p-3">
              <div className="mb-3 flex items-center gap-2">
                <Award aria-hidden className="size-4 text-muted" />
                <span className="text-sm font-semibold text-fg">{t(`importance.${cls}`)}</span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="flex flex-col gap-1 text-xs text-muted">
                  {t('loyaltyPage.classes.minSold')}
                  <MoneyInput value={r.minSold} onValueChange={(v) => update(cls, { minSold: v })} placeholder="—" />
                </label>
                <label className="flex flex-col gap-1 text-xs text-muted">
                  {t('loyaltyPage.classes.minPaid')}
                  <MoneyInput value={r.minPaid} onValueChange={(v) => update(cls, { minPaid: v })} placeholder="—" />
                </label>
                <label className="flex flex-col gap-1 text-xs text-muted">
                  {t('loyaltyPage.classes.minVisits')}
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={r.minVisits !== undefined ? String(r.minVisits) : ''}
                    onChange={(e) => update(cls, { minVisits: e.target.value === '' ? undefined : Number(e.target.value.replace(/\D/g, '')) })}
                    placeholder="—"
                  />
                </label>
              </div>
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}

function RuleList({
  rules,
  onChange,
  categoryOptions,
  t,
  addLabel,
  emptyTitle,
  emptyText,
}: {
  rules: CategoryAutoRule[];
  onChange: (rules: CategoryAutoRule[]) => void;
  categoryOptions: string[];
  t: ReturnType<typeof useT<'clients'>>;
  addLabel: string;
  emptyTitle: string;
  emptyText: string;
}) {
  const add = () => onChange([...rules, { id: newId('cr'), trigger: 'visits', threshold: 0, category: '' }]);
  const update = (id: string, patch: Partial<CategoryAutoRule>) => onChange(rules.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const remove = (id: string) => onChange(rules.filter((r) => r.id !== id));

  return (
    <div className="flex flex-col gap-3">
      {rules.length === 0 ? (
        <EmptyState icon={<Tags aria-hidden />} title={emptyTitle} description={emptyText} />
      ) : (
        <ul className="flex flex-col gap-3">
          {rules.map((rule) => (
            <li key={rule.id} className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center">
              <Select
                className="sm:w-48"
                options={CATEGORY_TRIGGERS_WITH_THRESHOLD.concat(['statusArrived', 'statusNoShow']).map((k) => ({
                  value: k,
                  label: t(`loyaltyPage.trigger.${k}`),
                }))}
                value={rule.trigger}
                onValueChange={(v) => update(rule.id, { trigger: v as CategoryTriggerKind })}
              />
              {(CATEGORY_TRIGGERS_WITH_THRESHOLD as string[]).includes(rule.trigger) && (
                <Input
                  className="sm:w-28"
                  type="text"
                  inputMode="numeric"
                  value={rule.threshold !== undefined ? String(rule.threshold) : ''}
                  onChange={(e) => update(rule.id, { threshold: e.target.value === '' ? undefined : Number(e.target.value.replace(/\D/g, '')) })}
                  placeholder={t('loyaltyPage.categories.threshold')}
                  aria-label={t('loyaltyPage.categories.threshold')}
                />
              )}
              <Combobox
                className="sm:w-48"
                options={categoryOptions.map((c) => ({ value: c, label: c }))}
                value={rule.category || null}
                onValueChange={(v) => update(rule.id, { category: v ?? '' })}
                allowCreate
                onCreate={(text) => update(rule.id, { category: text })}
                placeholder={t('loyaltyPage.categories.category')}
              />
              <div className="flex-1" />
              <IconButton icon={<Trash2 aria-hidden />} label={t('loyaltyPage.remove')} variant="ghost" onClick={() => remove(rule.id)} />
            </li>
          ))}
        </ul>
      )}
      <Button size="sm" variant="outline" leftIcon={<Plus aria-hidden className="size-4" />} onClick={add} className="self-start">
        {addLabel}
      </Button>
    </div>
  );
}

function CategoryRulesTab({
  addRules,
  removeRules,
  onChangeAdd,
  onChangeRemove,
  t,
}: {
  addRules: CategoryAutoRule[];
  removeRules: CategoryAutoRule[];
  onChangeAdd: (r: CategoryAutoRule[]) => void;
  onChangeRemove: (r: CategoryAutoRule[]) => void;
  t: ReturnType<typeof useT<'clients'>>;
}) {
  const categoryOptions = Array.from(new Set([...addRules, ...removeRules].map((r) => r.category).filter(Boolean)));
  return (
    <div className="flex flex-col gap-6">
      <SectionCard title={t('loyaltyPage.categories.addTitle')} description={t('loyaltyPage.categories.addDescription')}>
        <RuleList
          rules={addRules}
          onChange={onChangeAdd}
          categoryOptions={categoryOptions}
          t={t}
          addLabel={t('loyaltyPage.categories.addRule')}
          emptyTitle={t('loyaltyPage.categories.addEmptyTitle')}
          emptyText={t('loyaltyPage.categories.addEmptyText')}
        />
      </SectionCard>
      <SectionCard title={t('loyaltyPage.categories.removeTitle')} description={t('loyaltyPage.categories.removeDescription')}>
        <RuleList
          rules={removeRules}
          onChange={onChangeRemove}
          categoryOptions={categoryOptions}
          t={t}
          addLabel={t('loyaltyPage.categories.addRule')}
          emptyTitle={t('loyaltyPage.categories.removeEmptyTitle')}
          emptyText={t('loyaltyPage.categories.removeEmptyText')}
        />
      </SectionCard>
    </div>
  );
}

const WARN_OPTIONS = [0, 1, 2, 3, 5, 7, 10, 15];

function SettingsTab({
  settings,
  onChange,
  t,
}: {
  settings: LoyaltySettings;
  onChange: (s: LoyaltySettings) => void;
  t: ReturnType<typeof useT<'clients'>>;
}) {
  return (
    <SectionCard title={t('loyaltyPage.settings.title')} description={t('loyaltyPage.settings.description')}>
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-xs text-muted">
          {t('loyaltyPage.settings.cancelDiscountAfterDays')}
          <Input
            type="text"
            inputMode="numeric"
            className="sm:w-40"
            value={String(settings.cancelDiscountAfterDays)}
            onChange={(e) => onChange({ ...settings, cancelDiscountAfterDays: Number(e.target.value.replace(/\D/g, '')) || 0 })}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          {t('loyaltyPage.settings.cancelClassAfterDays')}
          <Input
            type="text"
            inputMode="numeric"
            className="sm:w-40"
            value={String(settings.cancelClassAfterDays)}
            onChange={(e) => onChange({ ...settings, cancelClassAfterDays: Number(e.target.value.replace(/\D/g, '')) || 0 })}
          />
        </label>
        <div className="flex flex-col gap-1 text-xs text-muted">
          <span className="flex items-center gap-1">
            <Gift aria-hidden className="size-3.5" />
            {t('loyaltyPage.settings.discountEndWarnDays')}
          </span>
          <Select
            className="sm:w-48"
            options={WARN_OPTIONS.map((d) => ({
              value: String(d),
              label: d === 0 ? t('loyaltyPage.settings.never') : t('loyaltyPage.settings.daysBefore', { count: d }),
            }))}
            value={String(settings.discountEndWarnDays ?? 0)}
            onValueChange={(v) => onChange({ ...settings, discountEndWarnDays: Number(v) === 0 ? null : Number(v) })}
          />
          <span>{t('loyaltyPage.settings.pushHint')}</span>
        </div>
      </div>
    </SectionCard>
  );
}
