'use client';

/**
 * Витрина k4: «Готово → что дальше» (NextStepCard) и полоса «Так видят клиенты» (PreviewBanner).
 * Dev-файл: тексты по-русски прямо в коде.
 */
import { ArrowLeft, Settings2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Button } from '@/ui/Button';
import { NextStepCard } from '@/ui/onboarding/NextStepCard';
import { PreviewBanner } from '@/ui/onboarding/PreviewBanner';
import { SegmentedControl } from '@/ui/SegmentedControl';

function Block({ title, hint, children }: { title: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-5 rounded-2xl border border-border bg-surface p-4 shadow-xs md:p-6">
      <header>
        <h2 className="text-lg font-semibold text-fg">{title}</h2>
        {hint && <p className="mt-1 text-sm leading-relaxed text-muted">{hint}</p>}
      </header>
      {children}
    </section>
  );
}

export function NextStepShowcase() {
  const [shown, setShown] = useState(true);
  const [ready, setReady] = useState<'notReady' | 'ready'>('notReady');

  return (
    <>
      <Block
        title="Готово → что дальше — NextStepCard"
        hint="Сразу после шага первой настройки: не тупик «Сохранено», а следующий шаг цепочки одной кнопкой. Тост — «сохранено», карточка — «куда дальше»."
      >
        {shown ? (
          <NextStepCard
            doneTitle="Услуги добавлены — 6 шт."
            doneText="Клиенты уже видят цены и длительность."
            nextTitle="Укажите часы работы"
            nextText="Без часов клиенты не увидят свободное время."
            action={<Button>Указать часы</Button>}
            secondaryAction={<Button variant="ghost">Добавить ещё услугу</Button>}
            onDismiss={() => setShown(false)}
          />
        ) : (
          <Button variant="outline" className="self-start" onClick={() => setShown(true)}>
            Показать снова
          </Button>
        )}
      </Block>

      <Block
        title="Так видят клиенты — PreviewBanner"
        hint="Владелец открыл СВОЮ ссылку /b/<slug>. Черновик бизнеса — не «Страница не найдена, опечатка», а спокойное «пока не могут записаться» и путь закончить. Клиенту полоса не показывается."
      >
        <SegmentedControl
          aria-label="Состояние страницы"
          value={ready}
          onValueChange={(v) => setReady(v === 'ready' ? 'ready' : 'notReady')}
          options={[
            { value: 'notReady', label: 'Ещё настраивается' },
            { value: 'ready', label: 'Готова' },
          ]}
        />
        {ready === 'notReady' ? (
          <PreviewBanner
            sticky={false}
            tone="notReady"
            title="Клиенты пока не могут записаться"
            description="Осталось: услуги и часы работы — 2 шага."
            action={<Button leftIcon={<Settings2 aria-hidden />}>Закончить настройку</Button>}
          />
        ) : (
          <PreviewBanner
            sticky={false}
            tone="ready"
            title="Так вашу страницу видят клиенты"
            description="Только ваш салон — без соседей и рекламы."
            action={
              <Button variant="outline" leftIcon={<ArrowLeft aria-hidden />}>
                В кабинет
              </Button>
            }
          />
        )}
      </Block>
    </>
  );
}
