'use client';

/**
 * /platform/pitch — «Презентация для салонов» (владелец 04.10.2026: «слайд сохрани как страница в платформе»).
 * Обзор: все 10 слайдов подряд с номером и заметками для выступающего; «Показать» — на весь экран (PresentMode).
 * Язык слайдов переключается здесь же, независимо от языка панели (по умолчанию — язык панели).
 */
import { useCallback, useState, useSyncExternalStore } from 'react';
import { useLocale } from 'next-intl';
import { ChevronDown, ExternalLink, Play } from 'lucide-react';
import type { PitchDeckTexts } from '@/areas/platform/pitch/decks.server';
import { PresentMode, enterFullscreen } from '@/areas/platform/pitch/PresentMode';
import { SLIDE_IDS, Slide, SlideFrame, slideNotes, type SlideId } from '@/areas/platform/pitch/slides';
import { CLIENT_LOCALES, type Locale } from '@/i18n/config';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { Button, buttonClasses } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Collapse } from '@/ui/Collapse';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { PageHeader } from '@/ui/PageHeader';
import { SegmentedControl } from '@/ui/SegmentedControl';

const SALES_SCRIPTS_URL = 'https://claude.ai/code/artifact/04ea5b66-b414-4d47-bd94-b1403c1c8ddc';
/** Контакт показывающего — удобство одного устройства, не данные: только localStorage */
const CONTACT_KEY = 'booktime.pitch.contact';
const CONTACT_MAX = 40;

function readContact(): string {
  try {
    return window.localStorage.getItem(CONTACT_KEY) ?? '';
  } catch {
    return '';
  }
}

/** Подписчики на смену контакта (в этой вкладке; без localStorage значение живёт в памяти) */
const contactListeners = new Set<() => void>();
let memoryContact: string | null = null;

function writeContact(value: string): void {
  memoryContact = value;
  try {
    if (value.trim()) window.localStorage.setItem(CONTACT_KEY, value);
    else window.localStorage.removeItem(CONTACT_KEY);
  } catch {
    // приватное окно — помним только до перезагрузки
  }
  contactListeners.forEach((l) => l());
}

function subscribeContact(listener: () => void): () => void {
  contactListeners.add(listener);
  return () => contactListeners.delete(listener);
}

const contactSnapshot = () => memoryContact ?? readContact();
const contactServerSnapshot = () => '';

export function PitchScreen({ decks }: { decks: Record<Locale, PitchDeckTexts> }) {
  const t = useT('platform');
  const panelLocale = useLocale() as Locale;
  const [lang, setLang] = useState<Locale>(CLIENT_LOCALES.includes(panelLocale) ? panelLocale : 'ru');
  const contact = useSyncExternalStore(subscribeContact, contactSnapshot, contactServerSnapshot);
  const [presenting, setPresenting] = useState<number | null>(null);
  const deck = decks[lang];
  const total = SLIDE_IDS.length;

  const present = (from: number) => {
    void enterFullscreen();
    setPresenting(from);
  };
  const closePresent = useCallback(() => setPresenting(null), []);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('pitch.title')}
        description={t('pitch.subtitle')}
        actions={
          <Button leftIcon={<Play aria-hidden />} onClick={() => present(0)} className="max-sm:w-full">
            {t('pitch.present')}
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <span id="pitch-lang" className="text-sm font-medium text-fg">
              {t('pitch.deckLanguage')}
            </span>
            <SegmentedControl
              aria-labelledby="pitch-lang"
              size="sm"
              value={lang}
              onValueChange={(v) => setLang(v as Locale)}
              options={CLIENT_LOCALES.map((l) => ({ value: l, label: t(`pitch.lang.${l}`) }))}
              className="self-start"
            />
          </div>
          <FormField label={t('pitch.contactLabel')} hint={t('pitch.contactHint')}>
            <Input
              value={contact}
              maxLength={CONTACT_MAX}
              autoComplete="off"
              placeholder={t('pitch.contactPlaceholder')}
              onChange={(e) => writeContact(e.target.value)}
            />
          </FormField>
        </Card>

        <Card className="flex flex-col items-start gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-semibold text-fg">{t('pitch.scriptsTitle')}</h2>
            <p className="text-sm text-muted">{t('pitch.scriptsText')}</p>
          </div>
          <a
            href={SALES_SCRIPTS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonClasses({ variant: 'secondary' }), 'mt-auto max-sm:w-full')}
          >
            <ExternalLink aria-hidden />
            {t('pitch.scriptsTitle')}
          </a>
        </Card>
      </div>

      <ol className="flex max-w-4xl flex-col gap-8">
        {SLIDE_IDS.map((id, i) => (
          <SlideItem
            key={id}
            id={id}
            index={i}
            total={total}
            deck={deck}
            contact={contact.trim()}
            onPresent={() => present(i)}
          />
        ))}
      </ol>

      {presenting !== null && (
        <PresentMode deck={deck} start={presenting} contact={contact.trim()} onClose={closePresent} />
      )}
    </div>
  );
}

function SlideItem({
  id,
  index,
  total,
  deck,
  contact,
  onPresent,
}: {
  id: SlideId;
  index: number;
  total: number;
  deck: PitchDeckTexts;
  contact: string;
  onPresent: () => void;
}) {
  const t = useT('platform');
  const [notesOpen, setNotesOpen] = useState(false);
  const notes = slideNotes(deck, id);
  const notesId = `pitch-notes-${id}`;
  return (
    <li className="flex flex-col gap-3">
      <div className="flex min-h-11 items-center justify-between gap-3">
        <span className="text-sm font-medium text-muted tabular-nums">{t('pitch.slideOf', { n: index + 1, total })}</span>
        <Button variant="ghost" leftIcon={<Play aria-hidden />} onClick={onPresent} className="-mr-3">
          {t('pitch.presentFrom')}
        </Button>
      </div>
      <div className="overflow-hidden rounded-lg border border-border shadow-sm">
        <SlideFrame>
          <Slide id={id} d={deck} n={index + 1} contact={contact} />
        </SlideFrame>
      </div>
      {notes && (
        <div className="flex flex-col gap-2">
          <Button
            variant="ghost"
            aria-expanded={notesOpen}
            aria-controls={notesId}
            onClick={() => setNotesOpen((o) => !o)}
            rightIcon={<ChevronDown aria-hidden className={cn('transition-transform', notesOpen && 'rotate-180')} />}
            className="-ml-3 self-start"
          >
            {t('pitch.notes')}
          </Button>
          <Collapse open={notesOpen} id={notesId}>
            <p className="rounded-md bg-surface-2 px-4 py-3 text-base leading-relaxed text-fg">{notes}</p>
          </Collapse>
        </div>
      )}
    </li>
  );
}
