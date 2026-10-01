'use client';

/**
 * /biz/settings/contacts — «Контакты» (F-15-104…110): адрес, часы работы текстом, телефоны и сайт, соцсети,
 * мессенджеры. ⭐ Без встроенной карты — ссылка на Яндекс Карты и кнопка «Я сейчас на месте работы».
 */
import { useState } from 'react';
import Link from 'next/link';
import { MapPin, Plus, Trash2 } from 'lucide-react';
import type { SocialLinks } from '@/domain/core';
import {
  isValidTelegramUrl,
  markHereNow,
  saveContacts,
  useContacts,
} from '@/api/settings';
import { useApiMutation } from '@/api/request';
import { useCan, useCurrent } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { FormField } from '@/ui/FormField';
import { IconButton } from '@/ui/IconButton';
import { Input } from '@/ui/Input';
import { PageHeader } from '@/ui/PageHeader';
import { PhoneInput } from '@/ui/PhoneInput';
import { SectionCard } from '@/ui/SectionCard';
import { StickyActionBar } from '@/ui/StickyActionBar';
import { Textarea } from '@/ui/Textarea';
import { useToast } from '@/ui/Toast';
import { useSettingsDraft } from '@/areas/settings/useSettingsDraft';
import { useSkeletonCount } from '@/ui/hooks/useSkeletonCount';
import { useRememberedFlag } from '@/areas/settings/useRememberedFlag';

interface Draft {
  addressRu: string;
  yandexMapsUrl: string;
  hoursText: string;
  phones: string[];
  socials: SocialLinks;
}

export function ContactsScreen() {
  const t = useT('settings');
  const toast = useToast();
  const { businessId, staffId, ready } = useCurrent();
  const canManage = useCan('settings.manage');
  const q = useContacts(businessId, { enabled: ready });

  const form = useSettingsDraft<Draft>(
    q.data
      ? {
          addressRu: q.data.addressRu,
          yandexMapsUrl: q.data.yandexMapsUrl ?? '',
          hoursText: q.data.hoursText ?? '',
          phones: q.data.phones.length ? q.data.phones : [''],
          socials: q.data.socials,
        }
      : undefined,
    ready ? businessId : undefined,
  );
  const { draft, dirty, setDraft } = form;
  const save = useApiMutation(saveContacts);
  const pin = useApiMutation(markHereNow);
  const [telegramError, setTelegramError] = useState(false);
  const loading = !ready || q.isLoading || !draft;
  // Пока нет данных — столько же полей телефона, сколько было в прошлый раз (в демо — один)
  // Отметка «точка на карте есть» — рядом с кнопкой (на телефоне переносится строкой ниже): до ответа — как в прошлый раз
  const showPin = useRememberedFlag('contacts-pin', loading, q.data ? Boolean(q.data.hasPin) : undefined, true);
  const phoneRows = useSkeletonCount('phones', { loading, count: draft?.phones.length, fallback: 1 });
  const d: Draft = draft ?? { addressRu: '', yandexMapsUrl: '', hoursText: '', phones: Array.from({ length: Math.max(1, phoneRows) }, () => ''), socials: {} };

  async function handleSave() {
    if (!draft || !businessId) return;
    if (
      draft.socials.telegramUrl &&
      !isValidTelegramUrl(draft.socials.telegramUrl)
    ) {
      setTelegramError(true);
      return;
    }
    setTelegramError(false);
    try {
      await save.mutate({
        businessId,
        staffId,
        addressRu: draft.addressRu,
        yandexMapsUrl: draft.yandexMapsUrl || undefined,
        hoursText: draft.hoursText || undefined,
        phones: draft.phones.filter(Boolean),
        socials: draft.socials,
      });
      form.markSaved();
      toast.success(t('contacts.saved'));
    } catch {
      toast.error(t('contacts.saveFailed'));
    }
  }

  async function handlePin() {
    if (!q.data?.locationId) return;
    try {
      await pin.mutate(q.data.locationId);
      toast.success(t('contacts.pinSaved'));
      q.refetch();
    } catch {
      toast.error(t('contacts.saveFailed'));
    }
  }

  return (
    <div
      data-f="F-15-104 F-15-105 F-15-106 F-15-107 F-15-108 F-15-109 F-15-110"
      className="mx-auto flex w-full max-w-[760px] flex-col gap-6"
    >
      <PageHeader
        title={t('contacts.title')}
        description={t('contacts.description')}
        back={{ href: '/biz/settings' }}
      />

      {q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : !loading && !canManage ? (
        <EmptyState
          icon={<MapPin aria-hidden />}
          title={t('contacts.accessDenied')}
        />
      ) : (
        // До ответа — та же форма с пустыми выключенными полями (DESIGN.md «The skeleton IS the page»)
        <fieldset disabled={loading} aria-busy={loading || undefined} className="contents">
          <div
            data-f="F-15-183 F-15-184"
            className="flex items-start gap-3 rounded-lg bg-primary-soft px-3.5 py-3 text-sm text-primary-text"
          >
            <MapPin aria-hidden className="mt-0.5 size-4 shrink-0" />
            <p>{t('contacts.oneSourceHint')}</p>
          </div>

          <SectionCard title={t('contacts.addressTitle')}>
            <div className="flex flex-col gap-4">
              <FormField label={t('contacts.countryLabel')}>
                <Input value={t('contacts.countryValue')} disabled />
              </FormField>
              <FormField label={t('contacts.addressLabel')}>
                <Textarea
                  value={d.addressRu}
                  onChange={(e) =>
                    setDraft({ ...d, addressRu: e.target.value })
                  }
                  placeholder={t('contacts.addressPlaceholder')}
                  rows={2}
                />
              </FormField>
              <FormField
                label={t('contacts.yandexLabel')}
                hint={t('contacts.yandexHint')}
                optional
              >
                <Input
                  value={d.yandexMapsUrl}
                  onChange={(e) =>
                    setDraft({ ...d, yandexMapsUrl: e.target.value })
                  }
                  placeholder="https://yandex.com/maps/…"
                />
              </FormField>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="secondary"
                  onClick={handlePin}
                  loading={pin.isPending}
                  disabled={!q.data?.locationId}
                >
                  <MapPin aria-hidden className="size-4" />
                  {t('contacts.pinHereNow')}
                </Button>
                {showPin && (
                  <Badge tone="success">{t('contacts.pinSet')}</Badge>
                )}
              </div>
            </div>
          </SectionCard>

          <div data-f="F-15-105">
            {/* F-02-088: часы работы локации в контактах — только текст для клиентов, график сотрудников не трогает */}
            <span data-f="F-02-088" className="contents" />
            <SectionCard title={t('contacts.hoursTitle')}>
              <FormField label={t('contacts.hoursLabel')}>
                <Input
                  value={d.hoursText}
                  onChange={(e) =>
                    setDraft({ ...d, hoursText: e.target.value })
                  }
                  placeholder={t('contacts.hoursPlaceholder')}
                />
              </FormField>
              <p className="mt-3 text-sm text-muted">
                {t('contacts.hoursScheduleHint')}{' '}
                <Link href="/biz/schedule" className="font-medium text-accent-text hover:underline">
                  {t('contacts.hoursScheduleLink')}
                </Link>
              </p>
            </SectionCard>
          </div>

          <div data-f="F-15-106">
            <SectionCard title={t('contacts.phonesTitle')}>
              <div className="flex flex-col gap-3">
                {d.phones.map((phone, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <PhoneInput
                      value={phone}
                      onValueChange={(v) =>
                        setDraft({
                          ...d,
                          phones: d.phones.map((p, idx) =>
                            idx === i ? v : p,
                          ),
                        })
                      }
                      className="flex-1"
                    />
                    {d.phones.length > 1 && (
                      <IconButton
                        label={t('contacts.removePhone')}
                        icon={<Trash2 aria-hidden />}
                        variant="ghost"
                        onClick={() =>
                          setDraft({
                            ...d,
                            phones: d.phones.filter((_, idx) => idx !== i),
                          })
                        }
                      />
                    )}
                  </div>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setDraft({ ...d, phones: [...d.phones, ''] })
                  }
                  className="self-start"
                >
                  <Plus aria-hidden className="size-4" />
                  {t('contacts.addPhone')}
                </Button>
                {d.phones.filter(Boolean).length > 1 && (
                  <p className="text-sm text-muted">
                    {t('contacts.firstPhoneIsMain')}
                  </p>
                )}
              </div>
              <FormField
                label={t('contacts.websiteLabel')}
                optional
                className="mt-4"
              >
                <Input
                  value={d.socials.website ?? ''}
                  onChange={(e) =>
                    setDraft({
                      ...d,
                      socials: { ...d.socials, website: e.target.value },
                    })
                  }
                  placeholder="www.company.com"
                />
              </FormField>
            </SectionCard>
          </div>

          <div data-f="F-15-107">
            <SectionCard title={t('contacts.socialsTitle')}>
              <div className="flex flex-col gap-4">
                <FormField label="Instagram" optional>
                  <Input
                    value={d.socials.instagram ?? ''}
                    onChange={(e) =>
                      setDraft({
                        ...d,
                        socials: {
                          ...d.socials,
                          instagram: e.target.value,
                        },
                      })
                    }
                    placeholder="username"
                  />
                </FormField>
                <FormField label="Facebook" optional>
                  <Input
                    value={d.socials.facebook ?? ''}
                    onChange={(e) =>
                      setDraft({
                        ...d,
                        socials: { ...d.socials, facebook: e.target.value },
                      })
                    }
                    placeholder="facebook.com/username"
                  />
                </FormField>
              </div>
            </SectionCard>
          </div>

          <div data-f="F-15-108">
            <SectionCard
              title={t('contacts.messengersTitle')}
              description={t('contacts.messengersHint')}
            >
              <div className="flex flex-col gap-4">
                <FormField
                  label="WhatsApp"
                  optional
                  hint={t('contacts.whatsappHint')}
                >
                  <Input
                    value={d.socials.whatsappNumber ?? ''}
                    onChange={(e) =>
                      setDraft({
                        ...d,
                        socials: {
                          ...d.socials,
                          whatsappNumber: e.target.value.replace(/[^0-9]/g, ''),
                        },
                      })
                    }
                    placeholder="37455000000"
                  />
                </FormField>
                <FormField
                  label="Telegram"
                  optional
                  hint={t('contacts.telegramHint')}
                  error={
                    telegramError ? t('contacts.telegramInvalid') : undefined
                  }
                >
                  <Input
                    value={d.socials.telegramUrl ?? ''}
                    onChange={(e) => {
                      setTelegramError(false);
                      setDraft({
                        ...d,
                        socials: {
                          ...d.socials,
                          telegramUrl: e.target.value,
                        },
                      });
                    }}
                    placeholder="https://t.me/username"
                  />
                </FormField>
                <FormField label="Viber" optional>
                  <Input
                    value={d.socials.viberNumber ?? ''}
                    onChange={(e) =>
                      setDraft({
                        ...d,
                        socials: {
                          ...d.socials,
                          viberNumber: e.target.value.replace(/[^0-9+]/g, ''),
                        },
                      })
                    }
                    placeholder="+37455000000"
                  />
                </FormField>
              </div>
            </SectionCard>
          </div>

          <SectionCard
            title={t('contacts.usedWhereTitle')}
            description={t('contacts.usedWhereText')}
          />

          <StickyActionBar>
            <Button
              onClick={handleSave}
              disabled={!dirty}
              loading={save.isPending}
            >
              {t('contacts.save')}
            </Button>
          </StickyActionBar>
        </fieldset>
      )}
    </div>
  );
}
