'use client';

/**
 * /biz/settings/help — «Помощь и поддержка» (F-15-001): критерий «из любого экрана кабинета есть вход в
 * помощь и поддержку» реализован как доступный без прав пункт хаба настроек + прямая ссылка (см.
 * SettingsHubScreen «Помощь» — карточка видна ВСЕМ ролям, не только canSettings/canBilling). Полноценная
 * переписка с оператором — пачка b05 (F-15-147…182); здесь рабочий канал: форма обращения + список своих
 * обращений (createHelpRequest/listHelpRequests из '@/api/settings'), плюс статические ссылки на частые
 * вопросы и другие способы связи, пока раздела FAQ ещё нет.
 */
import { useState } from 'react';
import {
  BookOpen,
  Building2,
  CircleCheck,
  Hash,
  LifeBuoy,
  Mail,
  MessageCircleQuestion,
  Newspaper,
  Phone,
  PlayCircle,
  Send,
  ShieldQuestion,
  Smartphone,
  UserRound,
} from 'lucide-react';
import { createHelpRequest, listHelpRequests, type HelpRequestTopic } from '@/api/settings';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import { HelpArticleButton } from '@/areas/settings/HelpArticleButton';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Badge, type BadgeTone } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { FormField } from '@/ui/FormField';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';
import { Select } from '@/ui/Select';
import { SkeletonText } from '@/ui/Skeleton';
import { usePagedList } from '@/ui/Pagination';
import { Textarea } from '@/ui/Textarea';
import { useToast } from '@/ui/Toast';

const TOPICS: HelpRequestTopic[] = ['billing', 'settings', 'staff', 'bug', 'other'];
const STATUS_TONE: Record<string, BadgeTone> = { open: 'warning', answered: 'success', closed: 'neutral' };
const FAQ_KEYS = ['faqSubscription', 'faqSeats', 'faqCoins', 'faqFreeze'] as const;
const GUIDE_KEYS = ['guideServices', 'guideStaff', 'guideOnline', 'guideNotify'] as const;
const ONLY_SUPPORT_KEYS = ['onlySupportSphere', 'onlySupportMerge', 'onlySupportBanner'] as const;

export function HelpScreen() {
  const t = useT('settings');
  const format = useFormat();
  const toast = useToast();
  const { businessId, staffId, ready } = useCurrent();
  const [topic, setTopic] = useState<HelpRequestTopic>('other');
  const [message, setMessage] = useState('');
  const [touched, setTouched] = useState(false);

  const listQ = useApiQuery(['settings', 'helpRequests', businessId], () => listHelpRequests(businessId ?? ''), {
    enabled: ready && Boolean(businessId),
  });
  const create = useApiMutation(createHelpRequest, { invalidates: [['settings', 'helpRequests', businessId]] });
  const requestSetupHelp = useApiMutation(createHelpRequest, { invalidates: [['settings', 'helpRequests', businessId]] });
  // Постранично, как во всех списках (DESIGN.md → Long lists)
  const { pageItems: requestsPage, pager: requestsPager } = usePagedList(listQ.data ?? [], { className: 'px-4 pb-4 sm:px-5' });

  const trimmed = message.trim();
  const invalid = touched && trimmed.length < 10;
  // Location ID (F-15-167): номер бизнеса подставляется в обращение сам — здесь показываем сам businessId
  const locationId = businessId ?? '';

  const submit = async () => {
    setTouched(true);
    if (trimmed.length < 10 || !businessId || !staffId) return;
    try {
      await create.mutate({ businessId, authorStaffId: staffId, topic, message: `[#${businessId}] ${trimmed}` });
      toast.success(t('help.sent'));
      setMessage('');
      setTouched(false);
    } catch {
      toast.error(t('help.sendFailed'));
    }
  };

  const askForSetupHelp = async () => {
    if (!businessId || !staffId) return;
    await requestSetupHelp.mutate({
      businessId,
      authorStaffId: staffId,
      topic: 'settings',
      message: `[#${businessId}] ${t('help.helpWithSetup')}`,
    });
    toast.success(t('help.helpWithSetupSent'));
  };

  return (
    <div data-f="F-15-001 F-15-162 F-15-145" className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
      <PageHeader
        title={t('help.title')}
        description={t('help.description')}
        back={{ href: '/biz/settings' }}
        actions={
          <span data-f="F-15-171">
            <HelpArticleButton label={t('help.helpArticleLabel')} title={t('help.title')}>
              <p>{t('help.helpArticleBody1')}</p>
              <p>{t('help.helpArticleBody2')}</p>
            </HelpArticleButton>
          </span>
        }
      />

      <div className="grid grid-cols-1 gap-4">
        <SectionCard
          title={
            <span className="flex items-center gap-2">
              <LifeBuoy aria-hidden className="size-4 shrink-0 text-muted" />
              {t('help.formTitle')}
            </span>
          }
          description={t('help.chatDescription')}
        >
          <form
            data-f="F-15-164"
            noValidate
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <FormField label={t('help.topicLabel')}>
              <Select
                options={TOPICS.map((id) => ({ value: id, label: t(`help.topic.${id}`) }))}
                value={topic}
                onValueChange={(v) => setTopic(v as HelpRequestTopic)}
              />
            </FormField>
            <FormField
              label={t('help.messageLabel')}
              error={invalid ? t('help.messageTooShort') : undefined}
              required
            >
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onBlur={() => setTouched(true)}
                placeholder={t('help.messagePlaceholder')}
                rows={5}
                invalid={invalid}
              />
            </FormField>
            <Button type="submit" leftIcon={<Send />} loading={create.isPending} disabled={!ready} className="self-start">
              {t('help.send')}
            </Button>
          </form>
        </SectionCard>

        <SectionCard title={t('help.contactTitle')} description={t('help.windowDescription')}>
          <ul data-f="F-15-163 F-15-167" className="flex flex-col gap-3 text-sm text-fg">
            {/* Н15: подсказка «указывайте этот номер» — рядом с самим номером */}
            <li className="flex items-start gap-3">
              <Hash aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
              <span className="flex flex-col gap-0.5">
                <span className="text-muted">
                  {t('help.locationIdLabel')}: <span className="font-medium text-fg">#{locationId || '—'}</span>
                </span>
                <span className="text-xs text-muted">{t('help.locationIdHint')}</span>
              </span>
            </li>
            <li className="flex items-center gap-3">
              <Mail aria-hidden className="size-4 shrink-0 text-muted" />
              <span className="text-muted">{t('help.contactEmail')}</span>
            </li>
            <li className="flex items-center gap-3">
              <Phone aria-hidden className="size-4 shrink-0 text-muted" />
              <span className="text-muted">{t('help.contactPhone')}</span>
            </li>
          </ul>
          <div data-f="F-15-173 F-15-175" className="mt-5 border-t border-border pt-4">
            <h3 className="mb-2 text-sm font-medium text-fg">{t('help.linksTitle')}</h3>
            <ul className="flex flex-col gap-2 text-sm">
              <li>
                <a
                  href="https://support.example.com"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-fg hover:underline"
                >
                  <BookOpen aria-hidden className="size-4 shrink-0 text-muted" />
                  {t('help.knowledgeBase')}
                  <span className="text-xs text-muted">— {t('help.knowledgeBaseHint')}</span>
                </a>
              </li>
              <li>
                <a
                  href="https://www.youtube.com"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-fg hover:underline"
                >
                  <PlayCircle aria-hidden className="size-4 shrink-0 text-muted" />
                  {t('help.videoAcademy')}
                  <span className="text-xs text-muted">— {t('help.videoAcademyHint')}</span>
                </a>
              </li>
            </ul>
          </div>
          <div className="mt-5 border-t border-border pt-4">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-fg">
              <MessageCircleQuestion aria-hidden className="size-4 shrink-0 text-muted" />
              {t('help.faqTitle')}
            </h3>
            <ul className="flex flex-col gap-1.5 text-sm text-muted">
              {FAQ_KEYS.map((key) => (
                <li key={key}>{t(`help.${key}`)}</li>
              ))}
            </ul>
          </div>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <SectionCard title={t('help.newsTitle')}>
          <div data-f="F-15-165">
            <EmptyState
              variant="section"
              compact
              icon={<Newspaper aria-hidden />}
              title={t('help.newsEmptyTitle')}
              description={t('help.newsEmptyDescription')}
            />
            <p className="mt-3 text-xs text-muted">{t('help.newsUnsubscribeHint')}</p>
          </div>
        </SectionCard>

        <SectionCard title={t('help.managerTitle')}>
          <div data-f="F-15-166">
            <EmptyState
              variant="section"
              compact
              icon={<UserRound aria-hidden />}
              title={t('help.managerEmptyTitle')}
              description={t('help.managerEmptyDescription')}
            />
          </div>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <SectionCard title={t('help.channelsTitle')} description={t('help.channelsDescription')}>
          <div data-f="F-15-168" className="flex flex-col gap-3 text-sm text-muted">
            <p>{t('help.mobileAppDescription')}</p>
          </div>
        </SectionCard>

        <SectionCard title={t('help.mobileAppTitle')}>
          <div data-f="F-15-176" className="flex items-center gap-3 text-sm text-muted">
            <Smartphone aria-hidden className="size-4 shrink-0" />
            <span>{t('help.mobileAppDescription')}</span>
          </div>
        </SectionCard>
      </div>

      <SectionCard title={t('help.bankTitle')}>
        <div data-f="F-15-169" className="flex items-start gap-3 text-sm text-muted">
          <Building2 aria-hidden className="mt-0.5 size-4 shrink-0" />
          <div className="flex flex-col gap-1">
            <span className="text-fg">{t('help.bankRecipient')}</span>
            <span>{t('help.bankNote')}</span>
          </div>
        </div>
      </SectionCard>

      <SectionCard title={t('help.onlySupportTitle')} description={t('help.onlySupportDescription')}>
        <ul data-f="F-15-170" className="flex flex-col gap-3">
          {ONLY_SUPPORT_KEYS.map((key) => (
            <li key={key} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-2 text-fg">
                <ShieldQuestion aria-hidden className="size-4 shrink-0 text-muted" />
                {t(`help.${key}`)}
              </span>
              <Button size="sm" variant="outline" disabled={!ready} onClick={() => void askForSetupHelp()}>
                {t('help.onlySupportButton')}
              </Button>
            </li>
          ))}
        </ul>
      </SectionCard>

      {/* F-15-181: продажа лицензий через партнёров-дистрибьюторов — статья «на будущее», добавлено проверкой 1 */}
      <SectionCard title={t('help.partnerTitle')} description={t('help.partnerDescription')}>
        <div data-f="F-15-181" className="flex items-start gap-3 text-sm text-muted">
          <UserRound aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>{t('help.partnerHint')}</span>
        </div>
      </SectionCard>

      <SectionCard title={t('help.statusTitle')}>
        <div data-f="F-15-177" className="flex items-center gap-3 text-sm">
          <CircleCheck aria-hidden className="size-4 shrink-0 text-success" />
          <div className="flex flex-col">
            <span className="text-fg">{t('help.statusAllNormal')}</span>
            <span className="text-xs text-muted">{t('help.statusUptime')}</span>
          </div>
        </div>
      </SectionCard>

      <SectionCard title={t('help.onboardingTitle')} description={t('help.migrationDescription')}>
        <div data-f="F-15-024 F-15-026 F-15-028 F-15-174" className="flex flex-col gap-4">
          <ul className="flex flex-col gap-1.5 text-sm text-muted">
            {GUIDE_KEYS.map((key) => (
              <li key={key}>{t(`help.${key}`)}</li>
            ))}
          </ul>
          <Button
            variant="secondary"
            size="sm"
            className="self-start"
            loading={requestSetupHelp.isPending}
            disabled={!ready}
            onClick={() => void askForSetupHelp()}
          >
            {t('help.helpWithSetup')}
          </Button>
        </div>
      </SectionCard>

      <SectionCard title={t('help.historyTitle')} padding="none">
        {listQ.isLoading || !ready ? (
          // В демо обращений нет — до ответа то же пустое состояние, заголовок полосой
          <EmptyState variant="section" title={<SkeletonText width="20ch" />} description={t('help.emptyDescription')} />
        ) : listQ.isError ? (
          <div className="p-4">
            <ErrorState onRetry={() => listQ.refetch()} compact />
          </div>
        ) : !listQ.data?.length ? (
          <EmptyState variant="section" title={t('help.emptyTitle')} description={t('help.emptyDescription')} />
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {requestsPage.map((req) => (
              <li key={req.id} className="flex flex-col gap-1.5 px-4 py-3.5 sm:px-5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-fg">{t(`help.topic.${req.topic}`)}</span>
                  <div className="flex items-center gap-2">
                    <Badge tone={STATUS_TONE[req.status]} size="sm">
                      {t(`help.status.${req.status}`)}
                    </Badge>
                    <span className="text-xs text-muted">{format.dateTime(req.createdAt)}</span>
                  </div>
                </div>
                <p className="text-sm text-muted">{req.message}</p>
              </li>
            ))}
          </ul>
        )}
        {!listQ.isError && requestsPager}
      </SectionCard>
    </div>
  );
}
