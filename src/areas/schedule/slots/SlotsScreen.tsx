'use client';

/**
 * «Окна для записи» (b02): F-02-041…055. /biz/schedule/slots (правила филиала) и /biz/schedule/slots/[staffId]
 * (персонально). Порядок (ux-r5 L-1): правила сводкой + «Изменить правила» → окна по часам → закрытые дни → запас →
 * «Проверить на реальных данных» → «Как это работает» (свёрнуто). График работы (часы) здесь не правится.
 */
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useLocale } from 'next-intl';
import type { Id, TimeRange } from '@/domain/core';
import type { SlotRule } from '@/domain/schedule';
import { newSlotRule } from '@/domain/schedule';
import { useCoreGet, useCoreList } from '@/api/core';
import { useApiMutation, useApiQuery } from '@/api/request';
import {
  deleteSlotRule,
  getSlotMode,
  getSlotRules,
  getUnavailableDays,
  getWorkRange,
  saveSlotRule,
  setSlotMode,
  toggleRulePart,
  toggleRuleSlot,
} from '@/api/schedule';
import { BufferCard } from '@/areas/schedule/slots/components/BufferCard';
import { EngineRulesCard } from '@/areas/schedule/slots/components/EngineRulesCard';
import { LiveSlotsDemo } from '@/areas/schedule/slots/components/LiveSlotsDemo';
import { SlotRuleCard } from '@/areas/schedule/slots/components/SlotRuleCard';
import { SlotRuleWizard } from '@/areas/schedule/slots/components/SlotRuleWizard';
import { UnavailableDaysCard } from '@/areas/schedule/slots/components/UnavailableDaysCard';
import { useCan, useCurrent } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { pickText } from '@/lib/text';
import { Button } from '@/ui/Button';
import { ErrorState } from '@/ui/ErrorState';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { Select } from '@/ui/Select';
import { Skeleton } from '@/ui/Skeleton';
import { useToast } from '@/ui/Toast';
import { ExitHold } from '@/ui/ExitHold';

export interface SlotsScreenProps {
  /** Есть — персональная страница мастера (F-02-041/043); нет — правила филиала (F-02-042/044) */
  staffId?: Id;
}

/** Скелетон карточки правил: основное правило по умолчанию в типичные часы салона демо */
const SKELETON_RULE = newSlotRule('scr_skeleton', { isBase: true });
const SKELETON_WORK_RANGE: TimeRange = { from: '10:00', to: '21:00' };

export function SlotsScreen({ staffId }: SlotsScreenProps) {
  const t = useT('schedule');
  const locale = useLocale();
  const toast = useToast();
  const { ready, businessId, activeLocationIds, staffId: ownStaffId } = useCurrent();
  // Правила онлайн-записи филиала — право online.manage; мастер правит СВОЮ персональную страницу (⭐ F-00-066)
  const hasOnlineRight = useCan('online.manage');
  const canEditSchedule = useCan('schedule.edit');
  const isOwnPage = Boolean(staffId) && staffId === ownStaffId && canEditSchedule;
  const canEdit = hasOnlineRight || isOwnPage;

  const locationsQuery = useCoreList('locations', { businessId: businessId ?? '' }, { enabled: ready && Boolean(businessId) });
  const staffQuery = useCoreGet('staff', staffId);
  const staff = staffQuery.data;

  const [locationId, setLocationId] = useState<Id | undefined>(undefined);
  const effectiveLocationId = staff ? staff.locationIds[0] : (locationId ?? activeLocationIds[0] ?? '');

  const modeQuery = useApiQuery(['schedule', 'slot-mode', staffId], () => getSlotMode(staffId ?? ''), {
    enabled: ready && Boolean(staffId),
  });
  const mode = staffId ? (modeQuery.data ?? 'location') : 'location';
  // Правила окон следуют переключателю F-02-041; недоступные дни — нет: F-02-042 (филиал) и F-02-043 (сотрудник) независимы
  const scope: { kind: 'location' | 'staff'; id: Id } =
    staffId && mode === 'own' ? { kind: 'staff', id: staffId } : { kind: 'location', id: effectiveLocationId };
  const unavailableScope: { kind: 'location' | 'staff'; id: Id } = staffId
    ? { kind: 'staff', id: staffId }
    : { kind: 'location', id: effectiveLocationId };

  const rulesQuery = useApiQuery(['schedule', 'slot-rules', scope.kind, scope.id], () => getSlotRules(scope.kind, scope.id), {
    enabled: ready && Boolean(scope.id),
  });
  const unavailableQuery = useApiQuery(
    ['schedule', 'unavailable', unavailableScope.kind, unavailableScope.id],
    () => getUnavailableDays(unavailableScope.kind, unavailableScope.id),
    {
      enabled: ready && Boolean(unavailableScope.id),
    },
  );
  const workRangeQuery = useApiQuery(
    ['schedule', 'work-range', unavailableScope.kind, unavailableScope.id],
    () => getWorkRange(unavailableScope.kind, unavailableScope.id),
    {
      enabled: ready && Boolean(unavailableScope.id),
    },
  );

  const saveRule = useApiMutation((rule: SlotRule) => saveSlotRule(scope.kind, scope.id, rule));
  const removeRule = useApiMutation((rule: SlotRule) => deleteSlotRule(scope.kind, scope.id, rule.id));
  const toggleSlot = useApiMutation((a: { ruleId: Id; time: string }) => toggleRuleSlot(scope.kind, scope.id, a.ruleId, a.time));
  const togglePart = useApiMutation((a: { ruleId: Id; times: string[]; enable: boolean }) =>
    toggleRulePart(scope.kind, scope.id, a.ruleId, a.times, a.enable),
  );
  const changeMode = useApiMutation((v: 'location' | 'own') => setSlotMode(staffId ?? '', effectiveLocationId, v));

  const [wizard, setWizard] = useState<{
    rule: SlotRule | null;
    isException: boolean;
  } | null>(null);

  const editable = staffId ? mode === 'own' && canEdit : canEdit;
  const rules = rulesQuery.data ?? [];
  const baseRule = rules.find((r) => r.isBase) ?? newSlotRule('scr_default', { isBase: true });
  const exceptions = rules.filter((r) => !r.isBase);
  const workRange = workRangeQuery.data ?? null;

  const failed = () => toast.error(t('panel.saveFailed'));

  const onSaveRule = async (rule: SlotRule) => {
    try {
      await saveRule.mutate(rule);
      toast.success(t('slots.rules.saved'));
    } catch {
      failed();
    }
  };

  const onDeleteRule = async (rule: SlotRule) => {
    try {
      await removeRule.mutate(rule);
      toast.show({
        title: t('slots.rules.deleted'),
        tone: 'success',
        durationMs: 5000,
        action: {
          label: t('panel.undo'),
          onClick: () => void saveRule.mutate(rule).then(() => toast.info(t('panel.undone')), failed),
        },
      });
    } catch {
      failed();
    }
  };

  const onToggleMode = async (v: 'location' | 'own') => {
    if (!staffId || !effectiveLocationId || !canEdit) return;
    try {
      await changeMode.mutate(v);
      toast.success(v === 'own' ? t('slots.mode.switchedToOwn') : t('slots.mode.switchedToLocation'));
    } catch {
      failed();
    }
  };

  const loading =
    !ready ||
    rulesQuery.isLoading ||
    unavailableQuery.isLoading ||
    workRangeQuery.isLoading ||
    (Boolean(staffId) && (staffQuery.isLoading || modeQuery.isLoading));
  const isError = rulesQuery.isError || unavailableQuery.isError;
  const locationOptions = (locationsQuery.data ?? []).map((l) => ({
    value: l.id,
    label: pickText(l.name, locale),
  }));

  return (
    // Г15: страница настроек — одна ширина с остальными формами (DESIGN.md → Page width): 760 по центру
    <div data-f="F-02-041 F-02-044 F-02-097 F-03-053" className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
      <PageHeader
        title={staff ? t('slots.titleFor', { name: staff.name }) : t('slots.title')}
        description={t('slots.subtitle')}
        actions={
          !staffId &&
          locationOptions.length > 1 && (
            <Select
              aria-label={t('slots.location')}
              options={locationOptions}
              value={effectiveLocationId}
              onValueChange={(v) => setLocationId(v)}
              className="w-auto min-w-44"
            />
          )
        }
      />

      {isError ? (
        <ErrorState
          onRetry={() => {
            rulesQuery.refetch();
            unavailableQuery.refetch();
          }}
        />
      ) : loading ? (
        <>
          {/* Первая загрузка — та же карточка «Окна для записи» с основным правилом (DESIGN.md → «The skeleton IS the
              page»): значения и окна полосами, часы — типичные 10:00–21:00. */}
          <SectionCard
            key="slot-rules"
           
            title={t('slots.rules.title')}
            description={t('slots.rules.hint')}
            actions={
              canEdit && (
                <Button size="sm" variant="secondary" leftIcon={<Plus aria-hidden />} disabled>
                  {t('slots.rules.addException')}
                </Button>
              )
            }
          >
            <div className="flex flex-col gap-4">
              <SlotRuleCard
                loading
                rule={SKELETON_RULE}
                editable={canEdit}
                workRange={SKELETON_WORK_RANGE}
                onEdit={() => {}}
                onDelete={() => {}}
                onToggleSlot={() => {}}
                onTogglePart={() => {}}
              />
            </div>
          </SectionCard>
          {/* Следующая карточка — «Закрытые дни»: её шапка на месте, страница не растёт у нижнего края экрана */}
          <SectionCard key="unavailable" title={t('slots.unavailable.title')} description={t('slots.unavailable.hint')}>
            <Skeleton lines={2} />
          </SectionCard>
        </>
      ) : (
        <>
          {staffId && (
            <SectionCard title={t('slots.mode.title')} padding="sm">
              <div className="flex flex-col gap-2">
                <SegmentedControl
                  aria-label={t('slots.mode.title')}
                  options={[
                    {
                      value: 'location',
                      label: t('slots.mode.location'),
                      disabled: !canEdit,
                    },
                    {
                      value: 'own',
                      label: t('slots.mode.own'),
                      disabled: !canEdit,
                    },
                  ]}
                  value={mode}
                  onValueChange={(v) => void onToggleMode(v as 'location' | 'own')}
                  fullWidth
                />
                <p className="text-sm text-muted">{mode === 'own' ? t('slots.mode.ownHint') : t('slots.mode.locationHint')}</p>
              </div>
            </SectionCard>
          )}

          {/* key — та же карточка, что в скелетоне: React не переделывает в неё «Закрытые дни» скелетона (прыжок снизу) */}
          <SectionCard
            key="slot-rules"
            id="slot-rules"
            title={t('slots.rules.title')}
            description={t('slots.rules.hint')}
            actions={
              editable && (
                <Button size="sm" variant="secondary" leftIcon={<Plus aria-hidden />} onClick={() => setWizard({ rule: null, isException: true })}>
                  {t('slots.rules.addException')}
                </Button>
              )
            }
          >
            <div
              data-f="F-02-045 F-02-046 F-02-047 F-02-048 F-02-049 F-02-050 F-02-051 F-02-052 F-02-053 F-02-054 F-02-055 F-03-055 F-03-064"
              className="flex flex-col gap-4"
            >
              {[baseRule, ...exceptions].map((rule) => (
                <SlotRuleCard
                  key={rule.id}
                  rule={rule}
                  editable={editable}
                  workRange={workRange}
                  onEdit={() => setWizard({ rule, isException: !rule.isBase })}
                  onDelete={() => void onDeleteRule(rule)}
                  onToggleSlot={(time) => void toggleSlot.mutate({ ruleId: rule.id, time }).catch(failed)}
                  onTogglePart={(times, enable) => void togglePart.mutate({ ruleId: rule.id, times, enable }).catch(failed)}
                />
              ))}
            </div>
          </SectionCard>

          <div key="unavailable" data-f="F-02-042 F-02-043 F-02-103 F-03-054">
            <UnavailableDaysCard
              scopeKind={unavailableScope.kind}
              scopeId={unavailableScope.id}
              ranges={unavailableQuery.data ?? []}
              editable={canEdit}
            />
          </div>

          <BufferCard scopeKind={staffId ? 'staff' : 'location'} scopeId={staffId ?? effectiveLocationId} editable={canEdit} />

          {!staffId && <LiveSlotsDemo />}
          <EngineRulesCard />
        </>
      )}

      <ExitHold value={wizard}>
        {(wizard) => (
          <SlotRuleWizard
            open
            onOpenChange={(v) => !v && setWizard(null)}
            initial={wizard.rule}
            isException={wizard.isException}
            onSave={onSaveRule}
            previewHours={workRange ? [workRange] : undefined}
          />
        )}
      </ExitHold>
    </div>
  );
}
