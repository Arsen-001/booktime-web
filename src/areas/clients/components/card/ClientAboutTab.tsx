'use client';

/**
 * Вкладка «О клиенте»: приложение, посетители, язык, согласие на рекламу, комментарии и журнал изменений
 * (F-04-070, F-04-072, F-04-091, F-04-137, F-04-153, F-04-154, F-04-192, F-04-213, F-04-228).
 * Подписанные строки KeyValueList вместо «Android · последний вход 24 сентября, 02:48» без заголовка (ux-r2 №11).
 */
import { useState } from 'react';
import { Link2 } from 'lucide-react';
import { getAppActivity, getCustomFieldValues, listClientChangeLog, listCustomFieldDefs, listVisitors, recordAdConsent } from '@/api/clients';
import { useApiMutation, useApiQuery } from '@/api/request';
import { ChangeLogCard } from '@/areas/clients/components/ChangeLogCard';
import { ClientCommentsCard } from '@/areas/clients/components/card/ClientCommentsCard';
import type { UseClientsRightsResult } from '@/areas/clients/lib/rights';
import type { ClientRow } from '@/domain/clients';
import type { Id } from '@/domain/core';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { copyText } from '@/lib/clipboard';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { KeyValueList, type KeyValueItem } from '@/ui/KeyValueList';
import { SectionCard } from '@/ui/SectionCard';
import { useToast } from '@/ui/Toast';

export interface ClientAboutTabProps {
  row: ClientRow;
  businessId: Id;
  staffId: Id | undefined;
  authorName: string;
  rights: UseClientsRightsResult;
}

export function ClientAboutTab({ row, businessId, staffId, authorName, rights }: ClientAboutTabProps) {
  const t = useT('clients');
  const fmt = useFormat();
  const toast = useToast();
  const [showMoreFields, setShowMoreFields] = useState(false);
  const appQ = useApiQuery(['clients', 'appActivity', row.id], () => getAppActivity(row.id));
  const visitorsQ = useApiQuery(['clients', 'visitors', businessId, row.id], () => listVisitors(businessId, row.id));
  const changeLogQ = useApiQuery(['clients', 'changeLog', businessId, row.id], () => listClientChangeLog(businessId, row.id));
  const consent = useApiMutation((args: { clientId: Id; given: boolean }) => recordAdConsent(args.clientId, args.given, 'paper', authorName));
  // F-04-141: показ доп. полей клиента прямо в карточке (не только в форме правки)
  const customDefsQ = useApiQuery(['clients', 'customFieldDefs', businessId], () => listCustomFieldDefs(businessId), {
    enabled: rights.viewCustomFields,
  });
  const customValuesQ = useApiQuery(['clients', 'customFieldValues', row.id], () => getCustomFieldValues(row.id), {
    enabled: rights.viewCustomFields,
  });

  const app = appQ.data;
  const items: KeyValueItem[] = [
    {
      label: t('cardView.app'),
      value: app ? t('cardView.appValue', { platform: t(`card.platform.${app.platform}`), when: fmt.ago(app.lastUsedAt) }) : t('cardView.noApp'),
    },
    ...(visitorsQ.data?.length
      ? [{ label: t('card.visitors'), value: visitorsQ.data.map((v) => `${v.name} (${t(`card.visitorFor.${v.forWhom}`)}, ${v.visits})`).join(', ') }]
      : []),
    ...(row.locale
      ? [{ label: t('card.clientLocale'), value: t(`form.locale${row.locale === 'ru' ? 'Ru' : row.locale === 'en' ? 'En' : 'Hy'}`) }]
      : []),
    ...(row.nationalId ? [{ label: t('card.nationalId'), value: row.nationalId }] : []),
    { label: t('form.birthdayGreeting'), value: row.birthdayGreetingOptOut ? t('cardView.no') : t('cardView.yes') },
  ];

  const toggleConsent = async () => {
    try {
      await consent.mutate({ clientId: row.id, given: !(row.consent?.given ?? false) });
      toast.success(t('card.saved'));
    } catch {
      toast.error(t('card.saveFailed'));
    }
  };

  const copyLink = async () => {
    const url = `${window.location.origin}/biz/clients/consent/${row.id}`;
    if (await copyText(url)) toast.success(t('card.consent.linkCopied'));
    else toast.info(url);
  };

  return (
    <div className="flex flex-col gap-6">
      <div data-f="F-04-072 F-04-091 F-04-192 F-04-213 F-04-228 F-14-101 F-14-178 F-14-073">
        <SectionCard title={t('cardView.aboutTitle')}>
          <KeyValueList items={items} />
        </SectionCard>
      </div>

      {rights.viewCustomFields && (customDefsQ.data?.length ?? 0) > 0 && (
        <div data-f="F-04-141">
          <SectionCard title={t('card.customFieldsTitle')}>
            {(() => {
              const defs = customDefsQ.data ?? [];
              const primary = defs.filter((d) => d.alwaysShowInClientCard);
              const rest = defs.filter((d) => !d.alwaysShowInClientCard);
              const toItem = (def: (typeof defs)[number]): KeyValueItem => ({
                label: def.label,
                value: customValuesQ.data?.[def.id]?.trim() || t('cardView.noValue'),
              });
              return (
                <div className="flex flex-col gap-3">
                  <KeyValueList items={primary.length > 0 ? primary.map(toItem) : defs.map(toItem)} />
                  {primary.length > 0 && rest.length > 0 && (
                    <>
                      {showMoreFields ? (
                        <KeyValueList items={rest.map(toItem)} />
                      ) : (
                        <Button size="sm" variant="ghost" className="self-start" onClick={() => setShowMoreFields(true)}>
                          {t('card.customFieldsMore')}
                        </Button>
                      )}
                    </>
                  )}
                </div>
              );
            })()}
          </SectionCard>
        </div>
      )}

      <div data-f="F-04-153 F-04-154 F-04-227">
        <SectionCard
          title={t('card.consent.title')}
          actions={
            row.consent ? (
              <Badge tone={row.consent.given ? 'success' : 'neutral'}>
                {t(row.consent.given ? 'card.consent.given' : 'card.consent.refused', { date: fmt.date(row.consent.at.slice(0, 10), 'long') })}
              </Badge>
            ) : (
              <Badge tone="neutral">{t('card.consent.unknown')}</Badge>
            )
          }
        >
          {rights.editClient ? (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" loading={consent.isPending} onClick={toggleConsent}>
                {row.consent?.given ? t('card.consent.markRefused') : t('card.consent.markGiven')}
              </Button>
              <Button size="sm" variant="ghost" leftIcon={<Link2 aria-hidden />} onClick={copyLink}>
                {t('card.consent.copyLink')}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted">{t('cardView.consentReadOnly')}</p>
          )}
        </SectionCard>
      </div>

      <ClientCommentsCard
        clientId={row.id}
        staffId={staffId}
        authorName={authorName}
        canView={rights.viewComments}
        canAdd={rights.addComments}
        canDeleteOwn={rights.deleteOwnComments}
        canDeleteOthers={rights.deleteOthersComments}
      />

      <ChangeLogCard entries={changeLogQ.data} loading={changeLogQ.isLoading} />
    </div>
  );
}
