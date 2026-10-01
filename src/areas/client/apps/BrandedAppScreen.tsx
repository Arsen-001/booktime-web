'use client';

/**
 * «Мобильные приложения» → своё (брендированное) приложение (F-14-142…170). ⭐ Решение пользователя не
 * принято (В-29, F-14-142) — центр продукта остаётся общее приложение клиента (F-00-001); этот экран
 * строится по правилу «1:1» как заявка/демо: заявка реальная (уходит в очередь поддержки platform,
 * F-14-145), а материалы, документы и цена — черновик до решения владельца.
 */
import { useMemo, useState } from 'react';
import { AlertTriangle, Apple, Building2, Globe, Rocket, ShieldCheck, User } from 'lucide-react';
import {
  getBrandedAppBlockers,
  getBrandedAppRequest,
  saveBrandedAppLinks,
  saveBrandedAppMaterials,
  setBrandedAppAccessMethod,
  setBrandedAppExtraLocations,
  setBrandedAppOwnerType,
  submitBrandedAppRequest,
  toggleBrandedAppDoc,
} from '@/api/client';
import { ApiError, useApiMutation, useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import { useClientFormat } from '@/areas/client/useClientFormat';
import {
  BRANDED_APP_APPLE_FEE_USD,
  BRANDED_APP_DOCS_EMPTY,
  BRANDED_APP_MATERIALS_EMPTY,
  BRANDED_APP_DEMO_USD_TO_AMD,
  BRANDED_APP_LIMITS,
  BRANDED_APP_PRICE_PER_LOCATION_USD,
  BRANDED_APP_PRICE_USD,
  checkBrandedAppText,
  type BrandedAppAccessMethod,
  type BrandedAppOwnerType,
  type BrandedAppRequest,
} from '@/domain/client';
import { useT } from '@/i18n/useT';
import { Accordion } from '@/ui/Accordion';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Checkbox } from '@/ui/Checkbox';
import { ChoiceGroup } from '@/ui/ChoiceGroup';
import { ErrorState } from '@/ui/ErrorState';
import { FormField } from '@/ui/FormField';
import { ImageUpload } from '@/ui/ImageUpload';
import { Input } from '@/ui/Input';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';
import { StatCard } from '@/ui/StatCard';
import { Stepper } from '@/ui/Stepper';
import { Textarea } from '@/ui/Textarea';
import { useToast } from '@/ui/Toast';

// Списки в словаре — не JSON-массивы, а пронумерованные ключи-соседи (capabilitiesList0, capabilitiesList1…).
// Причина: mergeWithFallback (src/i18n/load.ts, фундамент — правка запрошена в qa/requests/client.md)
// не мёржит ключи-массивы между языками и всегда отдаёт ru, даже когда en переведён (F-14-143, F-14-146,
// F-14-154). Плоские строковые ключи такому не подвержены и вдобавок проверяются компилятором через t(),
// а не t.raw() as string[] — так что и опечатка в ключе теперь ловится tsc.
const BRANDED_APP_CAPABILITIES_KEYS = [
  'apps.branded.capabilitiesList0',
  'apps.branded.capabilitiesList1',
  'apps.branded.capabilitiesList2',
  'apps.branded.capabilitiesList3',
] as const;

const BRANDED_APP_PROCESS_STEP_KEYS = [
  'apps.branded.processSteps0',
  'apps.branded.processSteps1',
  'apps.branded.processSteps2',
  'apps.branded.processSteps3',
  'apps.branded.processSteps4',
] as const;

const BRANDED_APP_OWNER_STEP_KEYS = {
  organization: [
    'apps.branded.owner.organization.steps0',
    'apps.branded.owner.organization.steps1',
    'apps.branded.owner.organization.steps2',
    'apps.branded.owner.organization.steps3',
    'apps.branded.owner.organization.steps4',
  ],
  individual: [
    'apps.branded.owner.individual.steps0',
    'apps.branded.owner.individual.steps1',
    'apps.branded.owner.individual.steps2',
    'apps.branded.owner.individual.steps3',
  ],
} as const satisfies Record<BrandedAppOwnerType, readonly string[]>;

export function BrandedAppScreen() {
  const t = useT('client');
  const { ready, businessId } = useCurrent();
  const q = useApiQuery(['branded-app', businessId], () => getBrandedAppRequest(businessId!), {
    enabled: ready && Boolean(businessId),
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('apps.branded.title')} description={t('apps.branded.subtitle')} />

      <div data-f="F-14-142" className="flex items-start gap-2 rounded-xl border border-border bg-surface-2 p-3 text-sm text-muted">
        <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
        <span>{t('apps.branded.decisionPending')}</span>
      </div>

      {q.isLoading || !ready || !businessId ? (
        // До данных — та же форма в состоянии «черновик» (так у всех, кто ещё не подавал заявку), без ввода; с данными
        // форма пересоздаётся (key) — поля берут свои значения
        <div inert aria-busy="true">
          <BrandedAppForm key="loading" businessId={businessId ?? ''} request={draftRequest(businessId ?? '')} onChanged={() => undefined} />
        </div>
      ) : q.isError ? (
        <ErrorState onRetry={() => void q.refetch()} />
      ) : q.data ? (
        <BrandedAppForm key="data" businessId={businessId} request={q.data} onChanged={() => void q.refetch()} />
      ) : null}
    </div>
  );
}

/** Заявка до данных — отправленная (как у демо-бизнеса): поля ссылок без кнопки «Сохранить», материалы пустые */
function draftRequest(businessId: string): BrandedAppRequest {
  return { businessId, stage: 'submitted', materials: { ...BRANDED_APP_MATERIALS_EMPTY }, docs: { ...BRANDED_APP_DOCS_EMPTY }, extraLocations: 0 };
}

const OWNER_ICON: Record<BrandedAppOwnerType, typeof Building2> = { organization: Building2, individual: User };

function BrandedAppForm({
  businessId,
  request,
  onChanged,
}: {
  businessId: string;
  request: BrandedAppRequest;
  onChanged: () => void;
}) {
  const t = useT('client');
  const toast = useToast();
  const format = useClientFormat();

  const readOnly = request.stage !== 'draft';
  const blockers = useMemo(() => getBrandedAppBlockers(request), [request]);

  const [iosLink, setIosLink] = useState(request.iosLink ?? '');
  const [androidLink, setAndroidLink] = useState(request.androidLink ?? '');
  const links = useApiMutation((input: { iosLink: string; androidLink: string }) => saveBrandedAppLinks(businessId, input));

  const materials = useApiMutation((patch: Partial<BrandedAppRequest['materials']>) => saveBrandedAppMaterials(businessId, patch));
  const ownerType = useApiMutation((v: BrandedAppOwnerType) => setBrandedAppOwnerType(businessId, v));
  const accessMethod = useApiMutation((v: BrandedAppAccessMethod) => setBrandedAppAccessMethod(businessId, v));
  const extraLocations = useApiMutation((n: number) => setBrandedAppExtraLocations(businessId, n));
  const doc = useApiMutation((input: { key: keyof BrandedAppRequest['docs']; value: boolean }) =>
    toggleBrandedAppDoc(businessId, input.key, input.value),
  );
  // Чекбокс — контролируемый компонент, а mutate+refetch вместе идут до ~800мс (два «сетевых» вызова с
  // моковой задержкой) — без локального оверрайда галка на это время визуально «откатывается» к старому
  // значению и выглядит потерянной ещё до перезагрузки страницы (F-14-147, «добавлено проверкой 1, фикс 1»).
  const [docsOverride, setDocsOverride] = useState<Partial<BrandedAppRequest['docs']>>({});
  const toggleDoc = (key: keyof BrandedAppRequest['docs'], value: boolean) => {
    setDocsOverride((o) => ({ ...o, [key]: value }));
    void safeMutate(doc.mutate, { key, value }).finally(() => {
      setDocsOverride((o) => {
        if (!(key in o)) return o;
        const next = { ...o };
        delete next[key];
        return next;
      });
    });
  };
  const submit = useApiMutation((contact: { name: string; phone?: string }) => submitBrandedAppRequest(businessId, contact));

  /** Обёртка над обычными точечными правками (аккаунт, доступ, филиалы, документы) — тост при сбое, перечитка при успехе */
  const safeMutate = async <A,>(mutate: (a: A) => Promise<unknown>, arg: A) => {
    try {
      await mutate(arg);
      onChanged();
    } catch {
      toast.error(t('apps.branded.saveFailed'));
    }
  };

  const saveMaterial = async (patch: Partial<BrandedAppRequest['materials']>) => {
    try {
      await materials.mutate(patch);
      onChanged();
    } catch {
      toast.error(t('apps.branded.saveFailed'));
    }
  };

  const saveLinks = async () => {
    try {
      await links.mutate({ iosLink: iosLink.trim(), androidLink: androidLink.trim() });
      toast.success(t('apps.branded.linksSaved'));
      onChanged();
    } catch {
      toast.error(t('apps.branded.saveFailed'));
    }
  };

  const handleSubmit = async () => {
    try {
      await submit.mutate({ name: t('apps.branded.contactFallbackName'), phone: undefined });
      toast.success(t('apps.branded.submitted'));
      onChanged();
    } catch (e) {
      toast.error(e instanceof ApiError ? t('apps.branded.blockedHint') : t('apps.branded.saveFailed'));
    }
  };

  const priceLocations = 1 + request.extraLocations;
  const priceUsd = BRANDED_APP_PRICE_USD + request.extraLocations * BRANDED_APP_PRICE_PER_LOCATION_USD;
  const priceAmd = priceUsd * BRANDED_APP_DEMO_USD_TO_AMD;
  const appleFeeAmd = BRANDED_APP_APPLE_FEE_USD * BRANDED_APP_DEMO_USD_TO_AMD;

  const stageTone = { draft: 'neutral', submitted: 'info', in_development: 'warning', published: 'success' } as const;

  return (
    <div className="flex flex-col gap-6">
      <SectionCard title={t('apps.branded.statusTitle')}>
        <div data-f="F-14-144 F-14-145" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={stageTone[request.stage]} variant="soft">
              {t(`apps.branded.stage.${request.stage}`)}
            </Badge>
            {request.submittedAt && <span className="text-xs text-muted">{format.date(request.submittedAt, 'dayMonth')}</span>}
          </div>
          <p className="text-sm text-muted">{t('apps.branded.statusHint')}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label={t('apps.branded.iosLink')} optional>
              <Input value={iosLink} onChange={(e) => setIosLink(e.target.value)} placeholder="https://apps.apple.com/…" disabled={readOnly} />
            </FormField>
            <FormField label={t('apps.branded.androidLink')} optional>
              <Input
                value={androidLink}
                onChange={(e) => setAndroidLink(e.target.value)}
                placeholder="https://play.google.com/…"
                disabled={readOnly}
              />
            </FormField>
          </div>
          {!readOnly && (
            <Button size="sm" variant="secondary" className="self-start" onClick={() => void saveLinks()} loading={links.isPending}>
              {t('apps.branded.saveLinks')}
            </Button>
          )}
        </div>
      </SectionCard>

      <div data-f="F-14-143">
        <SectionCard title={t('apps.branded.capabilitiesTitle')}>
          <ul className="flex flex-col gap-1.5 text-sm text-fg">
            {BRANDED_APP_CAPABILITIES_KEYS.map((key, i) => (
              <li key={i} className="flex gap-2">
                <span aria-hidden className="text-primary-text">
                  •
                </span>
                {t(key)}
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <div data-f="F-14-168 F-14-169 F-14-170">
        <SectionCard title={t('apps.branded.priceTitle')} description={t('apps.branded.priceNotApproved')}>
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard label={t('apps.branded.priceBase')} value={format.money(priceAmd)} hint={t('apps.branded.priceBaseHint', { count: priceLocations })} />
            <StatCard label={t('apps.branded.priceApple')} value={format.money(appleFeeAmd)} hint={t('apps.branded.priceAppleHint')} />
            {/* Владелец, 01.10.2026: «Итого за год» включает взнос Apple Developer отдельной строкой выше */}
            <StatCard label={t('apps.branded.priceTotal')} value={format.money(priceAmd + appleFeeAmd)} hint={t('apps.branded.priceTotalHint', { count: priceLocations })} />
          </div>
          <div className="mt-4 flex items-center gap-3">
            <p className="text-sm text-fg">{t('apps.branded.extraLocations')}</p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                aria-label="−"
                disabled={readOnly || request.extraLocations <= 0}
                onClick={() => void safeMutate(extraLocations.mutate, request.extraLocations - 1)}
              >
                −
              </Button>
              <span className="w-6 text-center tabular-nums">{request.extraLocations}</span>
              <Button
                size="sm"
                variant="secondary"
                aria-label="+"
                disabled={readOnly}
                onClick={() => void safeMutate(extraLocations.mutate, request.extraLocations + 1)}
              >
                +
              </Button>
            </div>
          </div>
        </SectionCard>
      </div>

      <div data-f="F-14-146">
        <SectionCard title={t('apps.branded.processTitle')} description={t('apps.branded.processHint')}>
          <Stepper
            current={request.stage === 'draft' ? 0 : request.stage === 'submitted' ? 1 : request.stage === 'in_development' ? 3 : 4}
            steps={BRANDED_APP_PROCESS_STEP_KEYS.map((key, i) => ({ id: String(i), label: t(key) }))}
          />
        </SectionCard>
      </div>

      <div data-f="F-14-147">
        <SectionCard title={t('apps.branded.docsTitle')} description={t('apps.branded.docsHint')}>
          <div className="flex flex-col gap-2">
            {(
              [
                ['appleDeveloperAccess', t('apps.branded.docApple')],
                ['googlePlayAccess', t('apps.branded.docGoogle')],
                ['registrationDoc', t('apps.branded.docRegistration')],
                ['trademarkDoc', t('apps.branded.docTrademark')],
              ] as const
            ).map(([key, label]) => (
              <Checkbox
                key={key}
                checked={docsOverride[key] ?? request.docs[key]}
                disabled={readOnly}
                onCheckedChange={(v) => toggleDoc(key, v)}
                label={label}
              />
            ))}
          </div>
        </SectionCard>
      </div>

      <div data-f="F-14-148 F-14-149 F-14-150 F-14-151 F-14-152">
        <SectionCard title={t('apps.branded.materialsTitle')}>
          <div className="flex flex-col gap-5">
            <MaterialImage
              label={t('apps.branded.splashLabel')}
              hint={t('apps.branded.splashHint')}
              value={request.materials.splashUrl}
              width={2208}
              height={2208}
              disabled={readOnly}
              onSaved={(url) => void saveMaterial({ splashUrl: url })}
            />
            <MaterialImage
              label={t('apps.branded.logoLabel')}
              hint={t('apps.branded.logoHint')}
              value={request.materials.logoUrl}
              width={1024}
              height={1024}
              disabled={readOnly}
              onSaved={(url) => void saveMaterial({ logoUrl: url })}
            />
            <MaterialImage
              label={t('apps.branded.featuredLabel')}
              hint={t('apps.branded.featuredHint')}
              value={request.materials.featuredImageUrl}
              width={1024}
              height={500}
              disabled={readOnly}
              onSaved={(url) => void saveMaterial({ featuredImageUrl: url })}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label={t('apps.branded.fullNameLabel')} hint={`${request.materials.fullName.length}/${BRANDED_APP_LIMITS.fullName}`}>
                <Input
                  value={request.materials.fullName}
                  disabled={readOnly}
                  maxLength={BRANDED_APP_LIMITS.fullName}
                  onChange={(e) => void saveMaterial({ fullName: e.target.value.slice(0, BRANDED_APP_LIMITS.fullName) })}
                />
              </FormField>
              <FormField label={t('apps.branded.shortNameLabel')} hint={`${request.materials.shortName.length}/${BRANDED_APP_LIMITS.shortName}`}>
                <Input
                  value={request.materials.shortName}
                  disabled={readOnly}
                  maxLength={BRANDED_APP_LIMITS.shortName}
                  onChange={(e) => void saveMaterial({ shortName: e.target.value.slice(0, BRANDED_APP_LIMITS.shortName) })}
                />
              </FormField>
            </div>

            <TextMaterialField
              label={t('apps.branded.shortDescLabel')}
              value={request.materials.shortDescription}
              limit={BRANDED_APP_LIMITS.shortDescription}
              disabled={readOnly}
              onSave={(v) => void saveMaterial({ shortDescription: v })}
            />
            <TextMaterialField
              label={t('apps.branded.longDescLabel')}
              value={request.materials.longDescription}
              limit={BRANDED_APP_LIMITS.longDescription}
              multiline
              disabled={readOnly}
              onSave={(v) => void saveMaterial({ longDescription: v })}
            />
            <FormField
              label={t('apps.branded.keywordsLabel')}
              hint={`${request.materials.keywords.length}/${BRANDED_APP_LIMITS.keywords}`}
            >
              <Input
                value={request.materials.keywords}
                disabled={readOnly}
                maxLength={BRANDED_APP_LIMITS.keywords}
                onChange={(e) => void saveMaterial({ keywords: e.target.value.slice(0, BRANDED_APP_LIMITS.keywords) })}
              />
            </FormField>
          </div>
        </SectionCard>
      </div>

      <div data-f="F-14-153 F-14-154 F-14-155 F-14-156 F-14-157">
        <SectionCard title={t('apps.branded.appleTitle')} description={t('apps.branded.appleHint')}>
          <ChoiceGroup
            columns={2}
            value={request.ownerType}
            onValueChange={(v) => void safeMutate(ownerType.mutate, v as BrandedAppOwnerType)}
            options={(['organization', 'individual'] as const).map((v) => {
              const Icon = OWNER_ICON[v];
              return {
                value: v,
                title: t(`apps.branded.owner.${v}.title`),
                description: t(`apps.branded.owner.${v}.description`),
                icon: <Icon aria-hidden className="size-5" />,
                disabled: readOnly,
              };
            })}
          />

          {request.ownerType && (
            <Accordion
              className="mt-4"
              variant="plain"
              items={[
                {
                  id: 'steps',
                  title: t('apps.branded.appleStepsTitle'),
                  content: (
                    <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm text-fg">
                      {BRANDED_APP_OWNER_STEP_KEYS[request.ownerType].map((key, i) => (
                        <li key={i}>{t(key)}</li>
                      ))}
                    </ol>
                  ),
                  defaultOpen: true,
                },
                {
                  id: 'device',
                  title: t('apps.branded.deviceTitle'),
                  content: <p className="text-sm text-muted">{t('apps.branded.deviceHint')}</p>,
                },
              ]}
            />
          )}

          <div className="mt-4">
            <p className="mb-2 text-sm font-medium text-fg">{t('apps.branded.accessMethodTitle')}</p>
            <ChoiceGroup
              value={request.accessMethod}
              onValueChange={(v) => void safeMutate(accessMethod.mutate, v as BrandedAppAccessMethod)}
              options={[
                {
                  value: 'portal_invite',
                  title: t('apps.branded.access.portal_invite.title'),
                  description: t('apps.branded.access.portal_invite.description'),
                  icon: <ShieldCheck aria-hidden className="size-5" />,
                  disabled: readOnly,
                },
                {
                  value: 'password_shared',
                  title: t('apps.branded.access.password_shared.title'),
                  description: t('apps.branded.access.password_shared.description'),
                  icon: <AlertTriangle aria-hidden className="size-5" />,
                  disabled: readOnly,
                },
              ]}
            />
          </div>
        </SectionCard>
      </div>

      <div data-f="F-14-159" className="grid gap-3 sm:grid-cols-2">
        <Card padding="sm" className="flex items-start gap-2 bg-surface-2 text-sm text-muted">
          <Apple aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>{t('apps.branded.pushHint')}</span>
        </Card>
        <Card data-f="F-14-173" padding="sm" className="flex items-start gap-2 bg-surface-2 text-sm text-muted">
          <Globe aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>{t('apps.branded.pushVsSmsHint')}</span>
        </Card>
      </div>

      {!readOnly && (
        <div className="flex flex-col items-end gap-2">
          {blockers.length > 0 && (
            <p className="text-right text-sm text-warning">{t('apps.branded.blockersHint', { count: blockers.length })}</p>
          )}
          <Button
            leftIcon={<Rocket aria-hidden />}
            disabled={blockers.length > 0}
            loading={submit.isPending}
            onClick={() => void handleSubmit()}
          >
            {t('apps.branded.submitCta')}
          </Button>
        </div>
      )}
    </div>
  );
}

function TextMaterialField({
  label,
  value,
  limit,
  multiline,
  disabled,
  onSave,
}: {
  label: string;
  value: string;
  limit: number;
  multiline?: boolean;
  disabled?: boolean;
  onSave: (value: string) => void;
}) {
  const t = useT('client');
  const [draft, setDraft] = useState(value);
  const issues = useMemo(() => checkBrandedAppText(draft), [draft]);

  const commit = () => {
    if (draft !== value) onSave(draft.slice(0, limit));
  };

  return (
    <FormField
      label={label}
      hint={`${draft.length}/${limit}`}
      error={issues.length > 0 ? t(`apps.branded.textIssue.${issues[0]}`) : undefined}
    >
      {multiline ? (
        <Textarea
          value={draft}
          disabled={disabled}
          maxLength={limit}
          rows={5}
          invalid={issues.length > 0}
          onChange={(e) => setDraft(e.target.value.slice(0, limit))}
          onBlur={commit}
        />
      ) : (
        <Input
          value={draft}
          disabled={disabled}
          maxLength={limit}
          aria-invalid={issues.length > 0}
          onChange={(e) => setDraft(e.target.value.slice(0, limit))}
          onBlur={commit}
        />
      )}
    </FormField>
  );
}

function MaterialImage({
  label,
  hint,
  value,
  width,
  height,
  disabled,
  onSaved,
}: {
  label: string;
  hint: string;
  value?: string;
  width: number;
  height: number;
  disabled?: boolean;
  onSaved: (url: string) => void;
}) {
  const aspect = width === height ? 'square' : width / height >= 1.5 ? '16/9' : '4/3';

  const handleChange = (urls: string[]) => {
    const url = urls[0];
    if (!url) return;
    onSaved(url);
  };

  return (
    <div>
      <p className="mb-1 text-sm font-medium text-fg">{label}</p>
      <p className="mb-2 text-xs text-muted">{hint}</p>
      {/* Проверка размера идёт по ИСХОДНОМУ файлу внутри ImageUpload (minWidth/minHeight),
          не по уже сжатому до 800px превью — иначе требование 2208×1024 не проходило никогда. */}
      <ImageUpload
        value={value ? [value] : []}
        onValueChange={handleChange}
        max={1}
        aspect={aspect}
        disabled={disabled}
        label={label}
        minWidth={Math.round(width * 0.9)}
        minHeight={Math.round(height * 0.9)}
      />
    </div>
  );
}
