'use client';

/** Содержимое карточки места: статус и система записи, сведения, ссылки, источники, визиты, заметка. */
import { useState } from 'react';
import { AtSign, CalendarCheck, Globe, Phone } from 'lucide-react';
import { updateProspect } from '@/api/platform';
import { useApiMutation } from '@/api/request';
import { useTeam } from '@/areas/platform/hooks/usePlatformData';
import { BOOKING_SYSTEM_TONE, PROSPECT_TONE, VISIT_TONE } from '@/areas/platform/lib/tones';
import { ProspectLink, prospectHref, shortUrl } from '@/areas/platform/prospects/ProspectLink';
import type { ProspectCard, ProspectPatch } from '@/domain/platform';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { telLink } from '@/lib/phone';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { KeyValueList } from '@/ui/KeyValueList';
import { SectionCard } from '@/ui/SectionCard';
import { SkeletonText } from '@/ui/Skeleton';
import { Textarea } from '@/ui/Textarea';
import { useToast } from '@/ui/Toast';

export function ProspectBody({ prospect: p }: { prospect: ProspectCard }) {
  const t = useT('platform');
  const fmt = useFormat();
  const toast = useToast();
  const teamQ = useTeam();
  const [note, setNote] = useState(p.note ?? '');
  const save = useApiMutation((a: { patch: ProspectPatch; version: number }) => updateProspect(p.id, a.patch, a.version));
  const saveNote = async () => {
    try {
      await save.mutate({ patch: { note }, version: p.version });
      toast.success(t('prospects.saved'));
    } catch {
      toast.error(t('prospects.saveFailed'));
    }
  };

  const reviews = p.reviews
    ? [p.reviews.rating !== undefined ? `★ ${p.reviews.rating}` : undefined, p.reviews.count !== undefined ? t('prospects.reviewsCount', { n: p.reviews.count }) : undefined, p.reviews.text]
        .filter(Boolean)
        .join(' · ')
    : undefined;
  const facts = [
    p.address ? { label: t('prospects.field.address'), value: p.address } : undefined,
    { label: t('prospects.field.staff'), value: p.staffEstimate ?? '—', hint: p.staffSource ? t('prospects.staffFrom', { source: p.staffSource }) : undefined },
    p.branches !== undefined ? { label: t('prospects.field.branches'), value: p.branches } : undefined,
    p.phone
      ? {
          label: t('prospects.field.phone'),
          value: (
            <a href={telLink(p.phone)} className="inline-flex items-center gap-1.5 font-medium text-primary-text hover:underline">
              <Phone aria-hidden className="size-4" />
              {p.phone.startsWith('+374') ? fmt.phone(p.phone) : p.phone}
            </a>
          ),
        }
      : undefined,
    reviews ? { label: t('prospects.field.reviews'), value: reviews } : undefined,
  ].filter((x): x is NonNullable<typeof x> => Boolean(x));

  const links = [
    p.bookingUrl ? { icon: <CalendarCheck aria-hidden />, label: t('prospects.field.bookingUrl'), href: prospectHref('web', p.bookingUrl) } : undefined,
    p.website ? { icon: <Globe aria-hidden />, label: t('prospects.field.website'), href: prospectHref('web', p.website) } : undefined,
    p.instagram ? { icon: <AtSign aria-hidden />, label: t('prospects.field.instagram'), href: prospectHref('instagram', p.instagram) } : undefined,
  ].filter((x): x is NonNullable<typeof x> => Boolean(x));

  const teamName = (rid: string) => teamQ.data?.find((m) => m.id === rid)?.name;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={PROSPECT_TONE[p.status]}>{t(`prospects.status.${p.status}`)}</Badge>
        <Badge tone={BOOKING_SYSTEM_TONE[p.bookingSystem]}>{t('prospects.bookingVia', { system: t(`prospects.system.${p.bookingSystem}`) })}</Badge>
      </div>

      <SectionCard title={t('prospects.aboutTitle')} padding="md">
        <KeyValueList items={facts} />
      </SectionCard>

      <SectionCard title={t('prospects.linksTitle')} padding="md">
        {links.length ? (
          <div className="-mx-2 flex flex-col">
            {links.map((l) => (
              <ProspectLink key={l.label} {...l} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">{t('prospects.noLinks')}</p>
        )}
        {p.sourceUrls.length > 0 && (
          <div className="mt-4 flex flex-col gap-1">
            <span className="text-sm font-medium text-fg">{t('prospects.field.sources')}</span>
            <ul className="flex flex-col gap-1">
              {p.sourceUrls.map((u) => (
                <li key={u} className="min-w-0">
                  <a href={prospectHref('web', u)} target="_blank" rel="noopener noreferrer" className="block min-h-8 truncate py-1 text-sm text-primary-text hover:underline">
                    {shortUrl(u)}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </SectionCard>

      <SectionCard title={t('prospects.visitsTitle')} padding="md">
        {p.visits.length ? (
          <ul className="flex flex-col divide-y divide-border">
            {p.visits.map((v) => (
              <li key={v.id} className="flex min-h-11 items-center gap-3 py-2">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-medium text-fg">{fmt.relativeDay(v.visitedAt)}</span>
                  {(teamName(v.responsibleId) || v.note) && <span className="truncate text-sm text-muted">{[teamName(v.responsibleId), v.note].filter(Boolean).join(' · ')}</span>}
                </span>
                <Badge size="sm" tone={VISIT_TONE[v.status]}>
                  {t(`visits.status.${v.status}`)}
                </Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">{t('prospects.noVisits')}</p>
        )}
      </SectionCard>

      <SectionCard title={t('prospects.field.note')} padding="md">
        <div className="flex flex-col gap-2">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder={t('prospects.notePlaceholder')} aria-label={t('prospects.field.note')} />
          {note !== (p.note ?? '') && (
            <Button variant="outline" size="sm" className="self-end" loading={save.isPending} onClick={saveNote}>
              {t('prospects.saveNote')}
            </Button>
          )}
        </div>
      </SectionCard>
    </div>
  );
}

export function ProspectBodySkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy>
      <div className="flex gap-2">
        <Badge tone="neutral">
          <SkeletonText width="8ch" />
        </Badge>
        <Badge tone="neutral">
          <SkeletonText width="12ch" />
        </Badge>
      </div>
      {[0, 1, 2].map((i) => (
        <SectionCard key={i} title={<SkeletonText width="10ch" />} padding="md">
          <div className="flex flex-col gap-3">
            <SkeletonText width="70%" />
            <SkeletonText width="50%" />
          </div>
        </SectionCard>
      ))}
    </div>
  );
}
