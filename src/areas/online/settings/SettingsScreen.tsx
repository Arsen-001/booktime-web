'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { coreList, coreUpdate } from '@/api/core';
import {
  addCustomClientField,
  getBusinessRules,
  getClientFieldsConfig,
  getStaffHiddenReasons,
  getStaffRules,
  listStaffRules,
  moveCustomClientField,
  removeCustomClientField,
  saveStaffPrepayment,
  updateBusinessRules,
  updateClientFieldsConfig,
  updateStaffRules,
  type StaffHiddenReason,
} from '@/api/online';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useSystemSettings } from '@/api/settings';
import { useCurrent } from '@/demo/hooks';
import type { AcceptsWhom, ConfirmMode, Id, LocaleCode, Staff } from '@/domain/core';
import { MARKET_TIMEZONE_LABEL, reviewModeOf, type ClientFieldType, type ClientFieldTarget, type ReviewMode } from '@/domain/online';
import { today } from '@/lib/date';
import { useT } from '@/i18n/useT';
import { useOnlineAccess } from '@/areas/online/access';
import { HelpHint } from '@/areas/online/HelpHint';
import { useScrollToHash } from '@/areas/online/lib/useScrollToHash';
import { StaffChoiceCard } from '@/areas/online/settings/StaffChoiceCard';
import { WhenCanBookCard } from '@/areas/online/settings/WhenCanBookCard';
import { hasPrepayment } from '@/domain/rules';
import { useFormat } from '@/i18n/useFormat';
import { PrepaymentFields, prepaymentDraftEqual, prepaymentDraftOf, prepaymentRuleOf } from '@/areas/online/settings/PrepaymentFields';
import { Accordion } from '@/ui/Accordion';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { Checkbox } from '@/ui/Checkbox';
import { Chip } from '@/ui/Chip';
import { DatePicker } from '@/ui/DatePicker';
import { ErrorState } from '@/ui/ErrorState';
import { FormField } from '@/ui/FormField';
import { IconButton } from '@/ui/IconButton';
import { Input } from '@/ui/Input';
import { PageHeader } from '@/ui/PageHeader';
import { PermissionGate } from '@/ui/PermissionGate';
import { SectionCard } from '@/ui/SectionCard';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { Select } from '@/ui/Select';
import { Skeleton } from '@/ui/Skeleton';
import { Switch } from '@/ui/Switch';
import { Tabs } from '@/ui/Tabs';
import { Textarea } from '@/ui/Textarea';
import { useToast } from '@/ui/Toast';
import { Tooltip } from '@/ui/Tooltip';
import { useUnsavedGuard } from '@/ui/hooks/useUnsavedGuard';
import { ArrowDown, ArrowUp, EyeOff, Lock, Plus, Trash2 } from 'lucide-react';

const OWNER_LIKE = new Set(['owner', 'admin', 'network']);
const LOCALES: LocaleCode[] = ['ru', 'en', 'hy'];

/** /biz/online/settings — наши правила мастера, подтверждение, перенос/отмена, пауза (F-00-066/067/069, F-03-066/067/079/142) */
export function SettingsScreen() {
  const t = useT('online');
  const format = useFormat();
  const { businessId, staffId, persona, ready, activeLocationIds, locationIds } = useCurrent();
  const ownStaffOnly = !OWNER_LIKE.has(persona);
  const locationId = activeLocationIds?.[0] ?? locationIds?.[0];
  const { full: hasFullAccess, own: hasAccess } = useOnlineAccess();

  const staffQ = useApiQuery(
    ['online-settings-staff', businessId, ownStaffOnly ? staffId : undefined],
    () => coreList('staff', (s) => s.businessId === businessId && s.status === 'active' && (!ownStaffOnly || s.id === staffId)),
    { enabled: ready && Boolean(businessId) },
  );
  // Почему мастера не видно клиентам (нет графика / онлайн-услуг / онлайн выключен) — метка в списке и подсказка в правилах
  const hiddenQ = useApiQuery(['online-settings-hidden', businessId], () => getStaffHiddenReasons(businessId!), { enabled: ready && Boolean(businessId) });
  // Сц. 7: приглашённые, но ещё не принявшие приглашение — в онлайн-записи их нет; говорим об этом здесь же
  const invitedQ = useApiQuery(
    ['online-settings-invited', businessId],
    () => coreList('staff', (s) => s.businessId === businessId && s.status === 'invited'),
    { enabled: ready && Boolean(businessId) && !ownStaffOnly },
  );
  const rulesQ = useApiQuery(
    ['online-settings-rules', businessId, staffQ.data?.map((s) => s.id).join(',')],
    () => listStaffRules((staffQ.data ?? []).map((s) => s.id)),
    { enabled: ready && Boolean(staffQ.data) },
  );
  const businessRulesQ = useApiQuery(['online-business-rules', businessId], () => getBusinessRules(businessId!), {
    enabled: ready && Boolean(businessId),
  });
  const clientFieldsQ = useApiQuery(['online-client-fields', businessId], () => getClientFieldsConfig(businessId!), {
    enabled: ready && Boolean(businessId),
  });

  const loaded = ready && !staffQ.isLoading && !rulesQ.isLoading && !businessRulesQ.isLoading && !clientFieldsQ.isLoading;
  useScrollToHash(loaded && Boolean(businessRulesQ.data));

  if (!loaded) {
    // До данных — та же страница: шапка и первые карточки («Когда можно записаться», «Выбор специалиста») на месте,
    // без ввода, со значениями по умолчанию; с данными карточки заводятся заново по своим значениям
    const emptyRules = { businessId: businessId ?? '', consentText: { ru: '' } } as NonNullable<typeof businessRulesQ.data>;
    return (
      <PermissionGate permission={hasAccess ? undefined : 'online.manage'} fallback="message" className="mx-auto w-full max-w-[760px]">
        <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6" aria-busy="true">
          <PageHeader title={t('nav.settings')} description={t('settings.subtitle')} meta={<HelpHint screenKey="settings" />} />
          {hasFullAccess && <WhenCanBookCard businessId={businessId ?? ''} locationId={locationId} rules={emptyRules} loading />}
          {hasFullAccess && (
            <div inert>
              <StaffChoiceCard businessId={businessId ?? ''} rules={emptyRules} staff={[]} />
            </div>
          )}
          {hasFullAccess && (
            <div data-f="F-03-142" inert>
              <PauseBanner businessId={businessId ?? ''} rules={emptyRules} onSaved={() => undefined} />
            </div>
          )}
        </div>
      </PermissionGate>
    );
  }
  if (staffQ.isError || rulesQ.isError || businessRulesQ.isError || clientFieldsQ.isError || !businessRulesQ.data || !clientFieldsQ.data) {
    return (
      <ErrorState
        onRetry={() => {
          staffQ.refetch();
          rulesQ.refetch();
          businessRulesQ.refetch();
          clientFieldsQ.refetch();
        }}
      />
    );
  }

  const staffList = staffQ.data ?? [];
  const rules = rulesQ.data ?? {};
  const refetchAll = () => {
    staffQ.refetch();
    rulesQ.refetch();
  };

  return (
    <PermissionGate permission={hasAccess ? undefined : 'online.manage'} fallback="message" className="mx-auto w-full max-w-[760px]">
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
        <PageHeader title={t('nav.settings')} description={t('settings.subtitle')} meta={<HelpHint screenKey="settings" />} />

        {/* О1: «Когда можно записаться» и «Выбор специалиста» — первыми: их ищут плитки хаба и справка */}
        {hasFullAccess && <WhenCanBookCard businessId={businessId!} locationId={locationId} rules={businessRulesQ.data} />}
        {hasFullAccess && <StaffChoiceCard businessId={businessId!} rules={businessRulesQ.data} staff={staffList} />}

        {/* Пауза наверху — переключатель мгновенный, ничего сохранять не нужно (F-03-142). Это дело всего
            салона (владелец/сеть/администратор), не одного мастера — у master его нет, только свои правила ниже. */}
        {hasFullAccess && (
          <div data-f="F-03-142">
            <PauseBanner businessId={businessId!} rules={businessRulesQ.data} onSaved={businessRulesQ.refetch} />
          </div>
        )}

        {/* Отзывы: только звёздочка (по умолчанию) или оценка 1–5 + текст 1:1 с Altegio (В-24) */}
        {hasFullAccess && (
          <div data-f="F-03-105">
            <ReviewModeCard businessId={businessId!} rules={businessRulesQ.data} onSaved={businessRulesQ.refetch} />
          </div>
        )}

        {/* «Правила мастеров» — за ними приходят чаще всего, поэтому сразу после паузы, а не в самом низу */}
        <SectionCard title={t('settings.staffTitle')} description={t('settings.staffHint')} padding="none">
          {staffList.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted sm:px-5">{t('settings.noStaff')}</p>
          ) : (
            <Accordion
              variant="plain"
              multiple
              items={staffList.map((s) => ({
                id: s.id,
                defaultOpen: staffList.length === 1,
                title: (
                  <span className="flex items-center gap-2">
                    {s.name}
                    <Badge tone={s.confirmMode === 'manual' ? 'warning' : 'success'} size="sm" variant="soft">
                      {s.confirmMode === 'manual' ? t('settings.confirmMode.manualShort') : t('settings.confirmMode.instantShort')}
                    </Badge>
                    {(hiddenQ.data?.[s.id] ?? []).length > 0 && (
                      <Badge tone="warning" size="sm" variant="soft" icon={<EyeOff aria-hidden />}>
                        {t('settings.hidden.badge')}
                      </Badge>
                    )}
                    {s.prepayment && hasPrepayment(s.prepayment) && (
                      <Badge tone="neutral" size="sm" variant="soft" data-f="F-00-097">
                        {t(s.prepayment.onlyAfterNoShows ? 'settings.prepay.badgeNoShows' : 'settings.prepay.badge', {
                          value: s.prepayment.percent ? `${s.prepayment.percent}%` : format.money(s.prepayment.amount),
                        })}
                      </Badge>
                    )}
                  </span>
                ),
                content: (
                  <>
                    <HiddenReasons staffId={s.id} reasons={hiddenQ.data?.[s.id] ?? []} />
                    <StaffRulesForm
                      key={s.id}
                      staff={s}
                      rules={rules[s.id] ?? { staffId: s.id, cancelWindowHours: 3, rescheduleWindowHours: 3 }}
                      onSaved={refetchAll}
                      isOwnStaff={s.id === staffId}
                    />
                  </>
                ),
              }))}
            />
          )}
          {(invitedQ.data ?? []).length > 0 && (
            <p className="border-t border-border px-4 py-3 text-sm text-muted sm:px-5">
              {t('settings.invitedHint', { count: invitedQ.data!.length, names: invitedQ.data!.map((s) => s.name).join(', ') })}
            </p>
          )}
        </SectionCard>

        {/* Поля клиента и тексты — тоже общесалонное, не «своё правило мастера» (F-00-066) */}
        {hasFullAccess && (
          <>
            <ClientFieldsCard businessId={businessId!} config={clientFieldsQ.data} onSaved={clientFieldsQ.refetch} />

            <div data-f="F-03-079 F-14-162">
              <ClientTextsCard
                businessId={businessId!}
                rules={businessRulesQ.data}
                config={clientFieldsQ.data}
                onSaved={() => {
                  businessRulesQ.refetch();
                  clientFieldsQ.refetch();
                }}
              />
            </div>
          </>
        )}
      </div>
    </PermissionGate>
  );
}

/**
 * «Пауза» — переключатель наверху экрана, сохраняется мгновенно (ux-r5 №17): владелец не должен искать
 * отдельную кнопку «Сохранить» для того, что и так одно нажатие. Формат (часовой цикл) — рядом, только показ:
 * с Н5 (28.09) он один на бизнес и меняется в «Системных» (ссылка), своего переключателя здесь нет.
 */
function PauseBanner({ businessId, rules, onSaved }: { businessId: Id; rules: Awaited<ReturnType<typeof getBusinessRules>>; onSaved: () => void }) {
  const t = useT('online');
  const toast = useToast();
  const [paused, setPaused] = useState(Boolean(rules.pauseUntil));
  const [pauseUntil, setPauseUntil] = useState(rules.pauseUntil ?? null);
  // Н5: формат времени — один источник («Системные»); здесь только показ и ссылка туда
  const hourCycle = useSystemSettings(businessId).data?.dateTimeFormat;
  const pauseMutation = useApiMutation((patch: Parameters<typeof updateBusinessRules>[1]) => updateBusinessRules(businessId, patch));

  const applyPause = async (next: boolean, until: string | null) => {
    try {
      await pauseMutation.mutate({ pauseUntil: next ? (until ?? today()) : undefined });
      toast.success(next ? t('settings.pause.pausedToast') : t('settings.pause.resumedToast'), {
        action: { label: t('settings.pause.undo'), onClick: () => void applyPause(!next, pauseUntil) },
      });
      onSaved();
    } catch {
      toast.error(t('settings.saveFailed'));
      setPaused(!next);
    }
  };

  return (
    <SectionCard title={t('settings.pause.title')} description={t('settings.pause.description')}>
      <div className="flex flex-col gap-4">
        <Switch
          checked={paused}
          onCheckedChange={(v) => {
            setPaused(v);
            void applyPause(v, pauseUntil);
          }}
          label={t('settings.pause.toggle')}
        />
        {paused && (
          <FormField label={t('settings.pause.until')}>
            <DatePicker
              value={pauseUntil}
              onValueChange={(v) => {
                setPauseUntil(v);
                void applyPause(true, v);
              }}
              min={today()}
            />
          </FormField>
        )}

        <div className="flex flex-col gap-3 border-t border-border pt-4" data-f="F-03-116">
          <p className="text-sm font-medium text-fg">{t('settings.format.title')}</p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-lg bg-surface p-2">
              <p className="text-xs text-muted">{t('settings.format.country')}</p>
              <p className="text-fg">{t('settings.format.countryValue')}</p>
            </div>
            <div className="rounded-lg bg-surface p-2">
              <p className="text-xs text-muted">{t('settings.format.timezone')}</p>
              <p className="text-fg">{MARKET_TIMEZONE_LABEL}</p>
            </div>
          </div>
          <FormField label={t('settings.format.hourCycle')} hint={t('settings.format.hourCycleHint')}>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface px-3 py-2">
              {hourCycle ? (
                <p className="text-sm text-fg">{hourCycle === '12' ? t('settings.format.hourCycle12') : t('settings.format.hourCycle24')}</p>
              ) : (
                <Skeleton className="h-4 w-16" />
              )}
              <Link href="/biz/settings/system" className="inline-flex min-h-10 items-center text-sm font-medium text-primary-text hover:underline">
                {t('settings.format.changeInSystem')}
              </Link>
            </div>
          </FormField>
        </div>
      </div>
    </SectionCard>
  );
}

/**
 * «Отзывы»: бизнес сам решает — только звёздочка (по умолчанию, наше решение 23.09) или оценка 1–5 и текст,
 * 1:1 с Altegio (В-24). Переключатель сохраняется сразу, как «Пауза» выше — это одно решение, а не форма.
 * При «оценка + текст» текст отзыва уходит на модерацию платформы (submitForModeration), рейтинг виден сразу.
 */
function ReviewModeCard({
  businessId,
  rules,
  onSaved,
}: {
  businessId: Id;
  rules: Awaited<ReturnType<typeof getBusinessRules>>;
  onSaved: () => void;
}) {
  const t = useT('online');
  const toast = useToast();
  const [mode, setMode] = useState<ReviewMode>(reviewModeOf(rules));
  const mutation = useApiMutation((patch: Parameters<typeof updateBusinessRules>[1]) => updateBusinessRules(businessId, patch));

  const apply = async (next: ReviewMode) => {
    const prev = mode;
    setMode(next);
    try {
      await mutation.mutate({ reviewMode: next });
      toast.success(t('settings.saved'));
      onSaved();
    } catch {
      toast.error(t('settings.saveFailed'));
      setMode(prev);
    }
  };

  return (
    <SectionCard title={t('settings.reviews.title')} description={t('settings.reviews.hint')}>
      <SegmentedControl
        value={mode}
        onValueChange={(v) => void apply(v as ReviewMode)}
        options={[
          { value: 'star', label: t('settings.reviews.star') },
          { value: 'text', label: t('settings.reviews.text') },
        ]}
      />
      <p className="mt-2 text-sm text-muted">{mode === 'star' ? t('settings.reviews.starHint') : t('settings.reviews.textHint')}</p>
    </SectionCard>
  );
}

/** «Тексты для клиента»: согласие на обработку данных + текст в виджете вместе (ux-r5 №17, F-03-079/075) */
function ClientTextsCard({
  businessId,
  rules,
  config,
  onSaved,
}: {
  businessId: Id;
  rules: Awaited<ReturnType<typeof getBusinessRules>>;
  config: Awaited<ReturnType<typeof getClientFieldsConfig>>;
  onSaved: () => void;
}) {
  const t = useT('online');
  const toast = useToast();
  const [locale, setLocale] = useState<LocaleCode>('ru');
  const [consent, setConsent] = useState(rules.consentText);
  const [widgetText, setWidgetText] = useState(config.widgetText);
  const consentMutation = useApiMutation((patch: Parameters<typeof updateBusinessRules>[1]) => updateBusinessRules(businessId, patch));
  const textMutation = useApiMutation((patch: Parameters<typeof updateClientFieldsConfig>[1]) => updateClientFieldsConfig(businessId, patch));
  const saving = consentMutation.isPending || textMutation.isPending;

  const dirty = JSON.stringify(consent) !== JSON.stringify(rules.consentText) || JSON.stringify(widgetText) !== JSON.stringify(config.widgetText);
  useUnsavedGuard(dirty);

  const save = async () => {
    try {
      await consentMutation.mutate({ consentText: consent });
      await textMutation.mutate({ widgetText });
      toast.success(t('settings.saved'));
      onSaved();
    } catch {
      toast.error(t('settings.saveFailed'));
    }
  };

  return (
    <SectionCard title={t('settings.consent.combinedTitle')} description={t('settings.consent.combinedHint')}>
      <div className="flex flex-col gap-4">
        <Tabs
          variant="pill"
          value={locale}
          onValueChange={(v) => setLocale(v as LocaleCode)}
          items={LOCALES.map((l) => ({ value: l, label: l.toUpperCase() }))}
        />
        <div data-f="F-03-079 F-04-152 F-15-143">
          <p className="mb-2 text-sm font-medium text-fg">{t('settings.consent.title')}</p>
          <Textarea rows={3} value={consent[locale] ?? ''} onChange={(e) => setConsent((prev) => ({ ...prev, [locale]: e.target.value }))} />
        </div>
        <div data-f="F-03-075">
          <p className="mb-2 text-sm font-medium text-fg">{t('settings.clientFields.widgetText')}</p>
          <Textarea rows={3} value={widgetText[locale] ?? ''} onChange={(e) => setWidgetText((prev) => ({ ...prev, [locale]: e.target.value }))} />
        </div>
        {dirty && (
          <div>
            <Button size="sm" onClick={save} loading={saving}>
              {t('settings.save')}
            </Button>
          </div>
        )}
      </div>
    </SectionCard>
  );
}

/** Почему клиенты не видят мастера в онлайн-записи и где это включить (подсказка из полного теста 30.09) */
function HiddenReasons({ staffId, reasons }: { staffId: Id; reasons: StaffHiddenReason[] }) {
  const t = useT('online');
  if (reasons.length === 0) return null;
  const where: Record<StaffHiddenReason, string> = {
    disabled: `/biz/staff/${staffId}`,
    noSchedule: '/biz/schedule',
    noServices: `/biz/staff/${staffId}`,
  };
  return (
    <div className="mx-4 mt-4 flex flex-col gap-1.5 rounded-xl bg-warning-soft p-3 sm:mx-5" data-f="F-00-072">
      <p className="text-sm font-medium text-fg">{t('settings.hidden.title')}</p>
      <ul className="flex flex-col gap-1">
        {reasons.map((r) => (
          <li key={r} className="text-sm text-fg">
            {t(`settings.hidden.${r}`)}{' '}
            <Link href={where[r]} className="font-medium text-primary-text hover:underline">
              {t(`settings.hidden.${r}Action`)}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StaffRulesForm({
  staff,
  rules,
  onSaved,
  isOwnStaff,
}: {
  staff: Staff;
  rules: Awaited<ReturnType<typeof getStaffRules>>;
  onSaved: () => void;
  /** Текущая персона — этот же мастер? Если нет (владелец/админ смотрит чужого мастера), «сразу / с
   *  подтверждением» и «кого принимаю» — только просмотр: каждый мастер решает сам (F-00-066, F-00-067). */
  isOwnStaff: boolean;
}) {
  const t = useT('online');
  const toast = useToast();
  const [confirmMode, setConfirmMode] = useState<ConfirmMode>(staff.confirmMode);
  const [accepts, setAccepts] = useState<AcceptsWhom>(staff.accepts);
  const [cancelWindowHours, setCancelWindowHours] = useState(rules.cancelWindowHours);
  const [rescheduleWindowHours, setRescheduleWindowHours] = useState(rules.rescheduleWindowHours);
  const [onVacation, setOnVacation] = useState(Boolean(rules.vacationUntil));
  const [vacationUntil, setVacationUntil] = useState(rules.vacationUntil ?? null);
  // F-03-095: депозит / гарантия картой — своя политика, отдельная от обязательной 100% предоплаты (F-03-094,
  // настраивается у самой услуги/мастера в другом месте). 'none' — политики нет.
  const [depositKind, setDepositKind] = useState<'none' | 'deposit' | 'cardGuarantee'>(rules.depositPolicyKind ?? 'none');
  const [depositAmount, setDepositAmount] = useState(rules.depositAmount ?? 0);
  const [noShowPenalty, setNoShowPenalty] = useState(rules.noShowPenalty ?? 0);
  const [allowReschedulePrepaid, setAllowReschedulePrepaid] = useState(rules.allowReschedulePrepaid ?? false);
  const [allowCancelPrepaid, setAllowCancelPrepaid] = useState(rules.allowCancelPrepaid ?? true);
  const [keepPrepaidOnLate, setKeepPrepaidOnLate] = useState(rules.keepPrepaymentOnLateCancel ?? true);
  // F-00-107: готовый текст клиента (client, ContactBlock) несёт ссылку «Закрыть окно» только пока включено
  const [addClaimLink, setAddClaimLink] = useState(rules.addClaimLinkToMessage ?? true);
  // ⭐ F-00-097: предоплата процентом — правило самого мастера (Staff.prepayment)
  const savedPrepay = prepaymentDraftOf(staff.prepayment);
  const legacyPrepayAmount = staff.prepayment && !staff.prepayment.percent && staff.prepayment.amount > 0 ? staff.prepayment.amount : undefined;
  const [prepay, setPrepay] = useState(savedPrepay);
  const [prepayError, setPrepayError] = useState<string>();

  const staffMutation = useApiMutation((patch: Partial<Pick<Staff, 'confirmMode' | 'accepts'>>) => coreUpdate('staff', staff.id, patch));
  const prepayMutation = useApiMutation((rule: Staff['prepayment']) => saveStaffPrepayment(staff.id, rule));
  const rulesMutation = useApiMutation((patch: Parameters<typeof updateStaffRules>[1]) => updateStaffRules(staff.id, patch));
  const saving = staffMutation.isPending || rulesMutation.isPending || prepayMutation.isPending;

  const dirty =
    (isOwnStaff && (confirmMode !== staff.confirmMode || accepts !== staff.accepts || !prepaymentDraftEqual(prepay, savedPrepay))) ||
    cancelWindowHours !== rules.cancelWindowHours ||
    rescheduleWindowHours !== rules.rescheduleWindowHours ||
    onVacation !== Boolean(rules.vacationUntil) ||
    (onVacation && vacationUntil !== (rules.vacationUntil ?? null)) ||
    depositKind !== (rules.depositPolicyKind ?? 'none') ||
    depositAmount !== (rules.depositAmount ?? 0) ||
    noShowPenalty !== (rules.noShowPenalty ?? 0) ||
    allowReschedulePrepaid !== (rules.allowReschedulePrepaid ?? false) ||
    allowCancelPrepaid !== (rules.allowCancelPrepaid ?? true) ||
    keepPrepaidOnLate !== (rules.keepPrepaymentOnLateCancel ?? true) ||
    addClaimLink !== (rules.addClaimLinkToMessage ?? true);
  useUnsavedGuard(dirty);

  const save = async () => {
    if (isOwnStaff && prepay.on && !prepay.requisites.trim()) {
      setPrepayError(t('settings.prepay.requisitesRequired'));
      return;
    }
    setPrepayError(undefined);
    try {
      if (isOwnStaff) {
        await staffMutation.mutate({ confirmMode, accepts });
        if (!prepaymentDraftEqual(prepay, savedPrepay)) await prepayMutation.mutate(prepaymentRuleOf(prepay));
      }
      await rulesMutation.mutate({
        cancelWindowHours,
        rescheduleWindowHours,
        allowReschedulePrepaid,
        allowCancelPrepaid,
        keepPrepaymentOnLateCancel: keepPrepaidOnLate,
        vacationUntil: onVacation ? (vacationUntil ?? today()) : undefined,
        depositPolicyKind: depositKind === 'none' ? undefined : depositKind,
        depositAmount: depositKind === 'deposit' ? depositAmount : undefined,
        noShowPenalty: depositKind === 'none' ? undefined : noShowPenalty || undefined,
        addClaimLinkToMessage: addClaimLink,
      });
      toast.success(t('settings.saved'));
      onSaved();
    } catch {
      toast.error(t('settings.saveFailed'));
    }
  };

  return (
    <div className="flex flex-col gap-4 px-4 py-4 sm:px-5" data-f="F-00-066">
      <div data-f="F-00-067">
        <FormField label={t('settings.confirmMode.label')} hint={isOwnStaff ? t('settings.confirmMode.hint') : t('settings.decidesForSelf')}>
          {isOwnStaff ? (
            <SegmentedControl
              value={confirmMode}
              onValueChange={(v) => setConfirmMode(v as ConfirmMode)}
              options={[
                { value: 'instant', label: t('settings.confirmMode.instant') },
                { value: 'manual', label: t('settings.confirmMode.manual') },
              ]}
            />
          ) : (
            <Badge tone={confirmMode === 'manual' ? 'warning' : 'success'} size="sm" variant="soft">
              {confirmMode === 'manual' ? t('settings.confirmMode.manual') : t('settings.confirmMode.instant')}
            </Badge>
          )}
        </FormField>
      </div>

      <div data-f="F-00-069">
        <FormField label={t('settings.accepts.label')} hint={isOwnStaff ? undefined : t('settings.decidesForSelf')}>
          {isOwnStaff ? (
            <Select
              value={accepts}
              onValueChange={(v) => setAccepts(v as AcceptsWhom)}
              options={[
                { value: 'all', label: t('settings.accepts.all') },
                { value: 'women', label: t('settings.accepts.women') },
                { value: 'men', label: t('settings.accepts.men') },
              ]}
            />
          ) : (
            <span className="text-sm text-fg">{t(`settings.accepts.${accepts}` as never)}</span>
          )}
        </FormField>
      </div>

      <PrepaymentFields
        value={prepay}
        onChange={(next) => {
          setPrepay(next);
          setPrepayError(undefined);
        }}
        legacyAmount={legacyPrepayAmount}
        readOnly={!isOwnStaff}
        requisitesError={prepayError}
      />

      {/* ⭐ Отмена и возврат денег — решает сам мастер (владелец видит, но не правит): до какого срока клиент может
          отменить и получить предоплату обратно; позже — неявка, предоплата остаётся мастеру (В-04, F-00-098) */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface-2 p-3" data-f="F-00-098 F-03-067">
        <p className="text-sm font-medium text-fg">{prepay.on ? t('settings.refund.title') : t('settings.refund.titleNoPrepay')}</p>
        {isOwnStaff ? (
          <>
            <FormField
              label={prepay.on ? t('settings.cancelWindow.labelRefund') : t('settings.cancelWindow.label')}
              hint={prepay.on ? t('settings.cancelWindow.hintRefund') : t('settings.cancelWindow.hint')}
            >
              <div className="flex flex-wrap items-center gap-2">
                {CANCEL_WINDOW_PRESETS.map((h) => (
                  <Chip key={h} selected={cancelWindowHours === h} onClick={() => setCancelWindowHours(h)}>
                    {t('settings.cancelWindow.hours', { n: h })}
                  </Chip>
                ))}
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={MAX_WINDOW_HOURS}
                    className="w-20"
                    aria-label={t('settings.cancelWindow.custom')}
                    value={cancelWindowHours}
                    onChange={(e) => setCancelWindowHours(clampWindowHours(e.target.value))}
                  />
                  <span className="text-sm text-muted">{t('settings.cancelWindow.hoursUnit')}</span>
                </div>
              </div>
            </FormField>
            {prepay.on && (
              <>
                <Switch
                  checked={keepPrepaidOnLate}
                  onCheckedChange={setKeepPrepaidOnLate}
                  label={t('settings.cancelWindow.keepPrepaid')}
                  description={t('settings.cancelWindow.keepPrepaidHint')}
                />
                <Switch checked={allowCancelPrepaid} onCheckedChange={setAllowCancelPrepaid} label={t('settings.cancelWindow.allowPrepaid')} />
              </>
            )}
          </>
        ) : (
          <div className="flex flex-col gap-1 text-sm text-fg">
            <p>
              {prepay.on
                ? t('settings.refund.summary', { n: cancelWindowHours })
                : t('settings.refund.summaryFree', { n: cancelWindowHours })}
            </p>
            {prepay.on && <p>{keepPrepaidOnLate ? t('settings.refund.summaryKeep') : t('settings.refund.summaryGive')}</p>}
            {prepay.on && <p>{allowCancelPrepaid ? t('settings.refund.summaryCancelOn') : t('settings.refund.summaryCancelOff')}</p>}
            <p className="text-xs text-muted">{t('settings.decidesForSelf')}</p>
          </div>
        )}
      </div>

      <div data-f="F-03-066" className="flex flex-col gap-2">
        <FormField label={t('settings.rescheduleWindow.label')} hint={t('settings.rescheduleWindow.hint')} className="sm:max-w-[50%]">
          <Input type="number" min={0} max={MAX_WINDOW_HOURS} value={rescheduleWindowHours} onChange={(e) => setRescheduleWindowHours(clampWindowHours(e.target.value))} />
        </FormField>
        <Switch checked={allowReschedulePrepaid} onCheckedChange={setAllowReschedulePrepaid} label={t('settings.rescheduleWindow.allowPrepaid')} />
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface-2 p-3" data-f="F-03-095">
        <FormField label={t('settings.depositPolicy.label')} hint={prepay.on ? t('settings.depositPolicy.prepayOn') : t('settings.depositPolicy.hint')}>
          <Select
            value={depositKind}
            disabled={prepay.on}
            onValueChange={(v) => setDepositKind(v as typeof depositKind)}
            options={[
              { value: 'none', label: t('settings.depositPolicy.none') },
              { value: 'deposit', label: t('settings.depositPolicy.deposit') },
              { value: 'cardGuarantee', label: t('settings.depositPolicy.cardGuarantee') },
            ]}
          />
        </FormField>
        {depositKind === 'deposit' && (
          <FormField label={t('settings.depositPolicy.amount')}>
            <Input type="number" min={0} value={depositAmount} onChange={(e) => setDepositAmount(Number(e.target.value) || 0)} />
          </FormField>
        )}
        {depositKind !== 'none' && (
          <FormField label={t('settings.depositPolicy.noShowPenalty')} optional hint={t('settings.depositPolicy.noShowPenaltyHint')}>
            <Input type="number" min={0} value={noShowPenalty} onChange={(e) => setNoShowPenalty(Number(e.target.value) || 0)} />
          </FormField>
        )}
        {depositKind === 'cardGuarantee' && <p className="text-xs text-muted">{t('settings.depositPolicy.cardGuaranteeHint')}</p>}
      </div>

      <Switch
        checked={addClaimLink}
        onCheckedChange={setAddClaimLink}
        label={t('settings.claimLink.toggle')}
        description={t('settings.claimLink.hint')}
        data-f="F-00-107"
      />

      {staff.workplaces.includes('visit') && (
        <p className="text-sm text-muted" data-f="F-00-079">
          {t('settings.visitAlwaysManual')}
        </p>
      )}

      <div className="border-t border-border pt-4">
        <Switch checked={onVacation} onCheckedChange={setOnVacation} label={t('settings.vacation.toggle')} />
        {onVacation && (
          <FormField label={t('settings.vacation.until')} className="mt-3">
            <DatePicker value={vacationUntil} onValueChange={setVacationUntil} min={today()} />
          </FormField>
        )}
      </div>

      <div>
        <Button size="sm" loading={saving} onClick={save}>
          {t('settings.save')}
        </Button>
      </div>
    </div>
  );
}

/** В-04: срок отмены и переноса — 0…48 ч */
const MAX_WINDOW_HOURS = 48;
const clampWindowHours = (raw: string) => Math.min(MAX_WINDOW_HOURS, Math.max(0, Math.round(Number(raw) || 0)));

/** Готовые сроки отмены с возвратом, ч (своё число — полем рядом) */
const CANCEL_WINDOW_PRESETS = [1, 3, 6, 12, 24, 48];

const NEW_FIELD_TYPES: ClientFieldType[] = ['text', 'number', 'date', 'select'];

/** Экран данных клиента: встроенные и свои поля, текст в виджете (F-03-071…075) */
function ClientFieldsCard({
  businessId,
  config,
  onSaved,
}: {
  businessId: Id;
  config: Awaited<ReturnType<typeof getClientFieldsConfig>>;
  onSaved: () => void;
}) {
  const t = useT('online');
  const toast = useToast();
  const [commentHidden, setCommentHidden] = useState(config.commentHidden);
  const [commentRequired, setCommentRequired] = useState(config.commentRequired);
  const [commentLabel, setCommentLabel] = useState(config.commentLabel);
  const [emailHidden, setEmailHidden] = useState(config.emailHidden);
  const [emailRequired, setEmailRequired] = useState(config.emailRequired);
  const [lastNameEnabled, setLastNameEnabled] = useState(config.lastNameEnabled);
  const [lastNameRequired, setLastNameRequired] = useState(config.lastNameRequired);
  const [patronymicEnabled, setPatronymicEnabled] = useState(config.patronymicEnabled);
  const [patronymicRequired, setPatronymicRequired] = useState(config.patronymicRequired);
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldType, setNewFieldType] = useState<ClientFieldType>('text');
  const [newFieldTarget, setNewFieldTarget] = useState<ClientFieldTarget>('booking');
  const [newFieldRequired, setNewFieldRequired] = useState(false);
  const [newFieldOptions, setNewFieldOptions] = useState('');
  const [addingField, setAddingField] = useState(false);

  const saveMutation = useApiMutation((patch: Parameters<typeof updateClientFieldsConfig>[1]) => updateClientFieldsConfig(businessId, patch));
  const addMutation = useApiMutation((field: Parameters<typeof addCustomClientField>[1]) => addCustomClientField(businessId, field));
  const removeMutation = useApiMutation((fieldId: Id) => removeCustomClientField(businessId, fieldId));
  const moveMutation = useApiMutation((args: { fieldId: Id; dir: -1 | 1 }) => moveCustomClientField(businessId, args.fieldId, args.dir));

  const dirty =
    commentHidden !== config.commentHidden ||
    commentRequired !== config.commentRequired ||
    commentLabel !== config.commentLabel ||
    emailHidden !== config.emailHidden ||
    emailRequired !== config.emailRequired ||
    lastNameEnabled !== config.lastNameEnabled ||
    lastNameRequired !== config.lastNameRequired ||
    patronymicEnabled !== config.patronymicEnabled ||
    patronymicRequired !== config.patronymicRequired;
  useUnsavedGuard(dirty);

  const save = async () => {
    try {
      await saveMutation.mutate({
        commentHidden,
        commentRequired,
        commentLabel: commentLabel.trim().slice(0, 60) || 'Комментарий к записи',
        emailHidden,
        emailRequired,
        lastNameEnabled,
        lastNameRequired: lastNameEnabled && lastNameRequired,
        patronymicEnabled,
        patronymicRequired: patronymicEnabled && patronymicRequired,
      });
      toast.success(t('settings.saved'));
      onSaved();
    } catch {
      toast.error(t('settings.saveFailed'));
    }
  };

  const addField = async () => {
    if (!newFieldLabel.trim()) return;
    try {
      await addMutation.mutate({
        label: newFieldLabel.trim(),
        type: newFieldType,
        target: newFieldTarget,
        required: newFieldRequired,
        options:
          newFieldType === 'select'
            ? newFieldOptions
                .split(',')
                .map((o) => o.trim())
                .filter(Boolean)
            : undefined,
      });
      setNewFieldLabel('');
      setNewFieldOptions('');
      setNewFieldRequired(false);
      setAddingField(false);
      toast.success(t('settings.clientFields.fieldAdded'));
      onSaved();
    } catch {
      toast.error(t('settings.saveFailed'));
    }
  };

  const sortedCustom = [...config.customFields].sort((a, b) => a.order - b.order);

  const [editingCommentLabel, setEditingCommentLabel] = useState(false);

  const fieldRows: {
    key: string;
    label: string;
    locked?: boolean;
    ask: boolean;
    onAsk?: (v: boolean) => void;
    required: boolean;
    onRequired?: (v: boolean) => void;
    extra?: ReactNode;
  }[] = [
    { key: 'name', label: t('settings.clientFields.nameField'), locked: true, ask: true, required: true },
    { key: 'phone', label: t('settings.clientFields.phoneField'), locked: true, ask: true, required: true },
    {
      key: 'email',
      label: t('settings.clientFields.email'),
      ask: !emailHidden,
      onAsk: (v) => setEmailHidden(!v),
      required: emailRequired,
      onRequired: setEmailRequired,
    },
    {
      key: 'comment',
      label: commentLabel || t('settings.clientFields.commentLabel'),
      ask: !commentHidden,
      onAsk: (v) => setCommentHidden(!v),
      required: commentRequired,
      onRequired: setCommentRequired,
      extra: (
        <Button size="sm" variant="ghost" onClick={() => setEditingCommentLabel((v) => !v)}>
          {t('settings.clientFields.editLabel')}
        </Button>
      ),
    },
    {
      key: 'lastName',
      label: t('settings.clientFields.lastName'),
      ask: lastNameEnabled,
      onAsk: setLastNameEnabled,
      required: lastNameRequired,
      onRequired: setLastNameRequired,
    },
    {
      key: 'patronymic',
      label: t('settings.clientFields.patronymic'),
      ask: patronymicEnabled,
      onAsk: setPatronymicEnabled,
      required: patronymicRequired,
      onRequired: setPatronymicRequired,
    },
  ];

  return (
    <SectionCard title={t('settings.clientFields.title')} description={t('settings.clientFields.hint')}>
      <div className="flex flex-col gap-5">
        <div data-f="F-03-071 F-03-072 F-04-108">
          <p className="mb-1 text-sm font-medium text-fg">{t('settings.clientFields.builtIn')}</p>
          <p className="mb-3 text-sm text-muted">{t('settings.clientFields.builtInHint')}</p>
          {/* Таблица-сетка (F-03-071) хороша на широком экране, но три колонки на 390px давят подпись и
              роняют «Изменить подпись» в перенос слов друг на друга — на телефоне (CONVENTIONS §0
              «таблицы → карточки») та же строка становится карточкой: подпись сверху, два переключателя
              подписаны словами снизу, а не квадратиками без слов. */}
          <div className="hidden rounded-xl border border-border bg-surface-2 p-1 sm:grid sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-x-3 sm:gap-y-1">
            <div className="col-span-3 grid grid-cols-[1fr_auto_auto] gap-x-3 px-2 py-1.5 text-xs text-muted">
              <span />
              <span className="text-center">{t('settings.clientFields.colAsk')}</span>
              <span className="text-center">{t('settings.clientFields.colRequired')}</span>
            </div>
            {fieldRows.map((row) => (
              <div
                key={row.key}
                className="col-span-3 grid min-h-12 grid-cols-[1fr_auto_auto] items-center gap-x-3 rounded-lg px-2 py-1.5 odd:bg-surface"
              >
                <span className="flex min-w-0 items-center gap-1.5 text-sm text-fg">
                  {row.locked && (
                    <Tooltip content={t('settings.clientFields.lockedHint')}>
                      <Lock aria-hidden tabIndex={0} className="size-3.5 shrink-0 text-muted" />
                    </Tooltip>
                  )}
                  <span className="truncate">{row.label}</span>
                  {row.extra}
                </span>
                <span className="flex justify-center">
                  {row.locked ? (
                    <Lock aria-hidden className="size-4 text-muted" />
                  ) : (
                    <Checkbox checked={row.ask} onCheckedChange={row.onAsk} aria-label={`${row.label}: ${t('settings.clientFields.colAsk')}`} />
                  )}
                </span>
                <span className="flex justify-center">
                  {row.locked ? (
                    <Lock aria-hidden className="size-4 text-muted" />
                  ) : (
                    <Checkbox
                      checked={row.required}
                      disabled={!row.ask}
                      onCheckedChange={row.onRequired}
                      aria-label={`${row.label}: ${t('settings.clientFields.colRequired')}`}
                    />
                  )}
                </span>
              </div>
            ))}
          </div>

          <ul className="flex flex-col gap-2 sm:hidden">
            {fieldRows.map((row) => (
              <li key={row.key} className="flex flex-col gap-2 rounded-xl border border-border bg-surface-2 px-3 py-2.5">
                <div className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-fg">
                  {row.locked && (
                    <Tooltip content={t('settings.clientFields.lockedHint')}>
                      <Lock aria-hidden tabIndex={0} className="size-3.5 shrink-0 text-muted" />
                    </Tooltip>
                  )}
                  <span className="min-w-0 flex-1 truncate">{row.label}</span>
                  {row.extra}
                </div>
                {row.locked ? (
                  <p className="text-xs text-muted">{t('settings.clientFields.lockedHint')}</p>
                ) : (
                  <div className="flex items-center gap-5">
                    <Checkbox checked={row.ask} onCheckedChange={row.onAsk} label={t('settings.clientFields.colAsk')} />
                    <Checkbox
                      checked={row.required}
                      disabled={!row.ask}
                      onCheckedChange={row.onRequired}
                      label={t('settings.clientFields.colRequired')}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
          {editingCommentLabel && (
            <div className="mt-2">
              <FormField label={t('settings.clientFields.commentLabel')} hint={t('settings.clientFields.commentLabelHint')}>
                <Input value={commentLabel} onChange={(e) => setCommentLabel(e.target.value.slice(0, 60))} maxLength={60} disabled={commentHidden} />
              </FormField>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-border pt-4" data-f="F-03-073 F-04-143">
          <p className="text-sm font-medium text-fg">{t('settings.clientFields.customTitle')}</p>
          {sortedCustom.length === 0 ? (
            <p className="text-sm text-muted">{t('settings.clientFields.noCustom')}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {sortedCustom.map((f, i) => (
                <li key={f.id} className="flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-fg">{f.label}</span>
                    <span className="block text-xs text-muted">
                      {t(`settings.clientFields.type.${f.type}` as 'settings.clientFields.type.text')} ·{' '}
                      {f.target === 'client' ? t('settings.clientFields.targetClient') : t('settings.clientFields.targetBooking')}
                      {f.required ? ` · ${t('settings.clientFields.required')}` : ''}
                    </span>
                  </span>
                  <IconButton
                    icon={<ArrowUp aria-hidden />}
                    label={t('linkSettings.steps.moveUp')}
                    size="sm"
                    variant="ghost"
                    disabled={i === 0}
                    onClick={() => moveMutation.mutate({ fieldId: f.id, dir: -1 }).then(onSaved)}
                  />
                  <IconButton
                    icon={<ArrowDown aria-hidden />}
                    label={t('linkSettings.steps.moveDown')}
                    size="sm"
                    variant="ghost"
                    disabled={i === sortedCustom.length - 1}
                    onClick={() => moveMutation.mutate({ fieldId: f.id, dir: 1 }).then(onSaved)}
                  />
                  <IconButton
                    icon={<Trash2 aria-hidden />}
                    label={t('linkSettings.delete')}
                    size="sm"
                    variant="ghost"
                    className="text-danger"
                    onClick={() => removeMutation.mutate(f.id).then(onSaved)}
                  />
                </li>
              ))}
            </ul>
          )}

          {addingField ? (
            <div className="flex flex-col gap-2 rounded-xl border border-dashed border-border p-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Input
                  value={newFieldLabel}
                  onChange={(e) => setNewFieldLabel(e.target.value)}
                  placeholder={t('settings.clientFields.newFieldLabel')}
                />
                <Select
                  value={newFieldType}
                  onValueChange={(v) => setNewFieldType(v as ClientFieldType)}
                  options={NEW_FIELD_TYPES.map((v) => ({
                    value: v,
                    label: t(`settings.clientFields.type.${v}` as 'settings.clientFields.type.text'),
                  }))}
                />
              </div>
              {newFieldType === 'select' && (
                <Input
                  value={newFieldOptions}
                  onChange={(e) => setNewFieldOptions(e.target.value)}
                  placeholder={t('settings.clientFields.optionsPlaceholder')}
                />
              )}
              <div className="flex flex-wrap items-center gap-4">
                <SegmentedControl
                  value={newFieldTarget}
                  onValueChange={(v) => setNewFieldTarget(v as ClientFieldTarget)}
                  options={[
                    { value: 'booking', label: t('settings.clientFields.targetBooking') },
                    { value: 'client', label: t('settings.clientFields.targetClient') },
                  ]}
                />
                <Checkbox checked={newFieldRequired} onCheckedChange={setNewFieldRequired} label={t('settings.clientFields.required')} />
              </div>
              <div className="flex gap-2">
                <Button size="sm" leftIcon={<Plus aria-hidden />} onClick={addField} loading={addMutation.isPending} disabled={!newFieldLabel.trim()}>
                  {t('settings.clientFields.addField')}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setAddingField(false)}>
                  {t('settings.clientFields.cancelAdd')}
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <Button size="sm" variant="secondary" leftIcon={<Plus aria-hidden />} onClick={() => setAddingField(true)}>
                {t('settings.clientFields.addField')}
              </Button>
            </div>
          )}
        </div>

        {dirty && (
          <div>
            <Button size="sm" onClick={save} loading={saveMutation.isPending}>
              {t('settings.save')}
            </Button>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
