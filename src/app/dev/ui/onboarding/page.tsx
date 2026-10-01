'use client';

/**
 * Витрина src/ui/onboarding: туры, подсказки, чек-лист «Первые шаги», пустые экраны первого входа.
 * Dev-страница: тексты по-русски прямо в коде. Как пользоваться — docs/ONBOARDING.md.
 */
import {
  Bell,
  CalendarCheck,
  CalendarDays,
  CalendarPlus,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Eye,
  House,
  Link2,
  MapPin,
  Plus,
  QrCode,
  Scissors,
  ShieldCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { IconButton } from '@/ui/IconButton';
import { useToast } from '@/ui/Toast';
import { Beacon } from '@/ui/onboarding/Beacon';
import { ChecklistCard } from '@/ui/onboarding/ChecklistCard';
import type { ChecklistItemData } from '@/ui/onboarding/ChecklistItem';
import { ChecklistPill } from '@/ui/onboarding/ChecklistPill';
import { checklistProgress } from '@/ui/onboarding/checklist';
import { Coachmark } from '@/ui/onboarding/Coachmark';
import { EmptyStateHint } from '@/ui/onboarding/EmptyStateHint';
import { HelpTip } from '@/ui/onboarding/HelpTip';
import { HintBanner } from '@/ui/onboarding/HintBanner';
import { InviteCard } from '@/ui/onboarding/InviteCard';
import { OneTimeChoice } from '@/ui/onboarding/OneTimeChoice';
import { PermissionPrimer } from '@/ui/onboarding/PermissionPrimer';
import { ProgressRing } from '@/ui/onboarding/ProgressRing';
import { ReplayHintsButton } from '@/ui/onboarding/ReplayHintsButton';
import { ShareLinkCard } from '@/ui/onboarding/ShareLinkCard';
import { Tour, type TourStep } from '@/ui/onboarding/Tour';
import { TourButton } from '@/ui/onboarding/TourButton';
import { useOnce } from '@/ui/onboarding/onboardingStore';
import { useTour } from '@/ui/onboarding/useTour';
import { VisibilityCard } from '@/ui/onboarding/VisibilityCard';
import { WelcomeDialog } from '@/ui/onboarding/WelcomeDialog';
import { NextStepShowcase } from '@/app/dev/ui/onboarding/NextStepShowcase';

function Section({ title, hint, children }: { title: string; hint?: ReactNode; children: ReactNode }) {
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

const OWNER_STEPS: Omit<ChecklistItemData, 'done'>[] = [
  {
    id: 'services',
    title: 'Добавьте услуги',
    description: 'Готовый список для вашей сферы — отметьте нужные.',
    meta: '1 мин',
    href: '#',
    actionLabel: 'Выбрать услуги',
  },
  {
    id: 'hours',
    title: 'Укажите часы работы',
    description: 'Из них считаются свободные окна.',
    meta: '1 мин',
    href: '#',
    actionLabel: 'Указать часы',
  },
  {
    id: 'masters',
    title: 'Пригласите мастеров',
    description: 'По номеру телефона — мастер подтвердит сам.',
    meta: '2 мин',
    href: '#',
    actionLabel: 'Пригласить',
  },
  {
    id: 'photos',
    title: 'Добавьте фото салона',
    description: 'До 6 фото: вход, зал, работы.',
    meta: '2 мин',
    href: '#',
    actionLabel: 'Добавить фото',
  },
  {
    id: 'place',
    title: 'Отметьте, где вы',
    description: 'Кнопка «Я сейчас на месте работы» — для поиска «рядом».',
    meta: '10 сек',
    href: '#',
    actionLabel: 'Отметить',
  },
  {
    id: 'link',
    title: 'Поделитесь своей ссылкой',
    description: 'По ней клиенты видят только ваш салон.',
    href: '#',
    actionLabel: 'Скопировать ссылку',
  },
  {
    id: 'admin',
    optional: true,
    title: 'Добавьте администратора',
    description: 'Необязательно. Первый администратор — бесплатно.',
    href: '#',
    actionLabel: 'Добавить',
  },
];

const REQUIRED_COUNT = OWNER_STEPS.filter((s) => !s.optional).length;

const TOUR_STEPS: TourStep[] = [
  {
    id: 'add',
    target: '[data-tour="demo-add"]',
    icon: <CalendarPlus aria-hidden />,
    title: 'Записывайте клиента в два нажатия',
    body: 'Нажмите «Новая запись» или просто на свободное время в сетке.',
  },
  {
    id: 'day',
    target: '[data-tour="demo-day"]',
    icon: <CalendarDays aria-hidden />,
    title: 'Листайте дни',
    body: 'Сегодня, завтра и любой день — стрелками или по календарю.',
  },
  {
    id: 'column',
    target: '[data-tour="demo-column"]',
    icon: <Users aria-hidden />,
    title: 'У каждого мастера своя колонка',
    body: 'Серое — нерабочее время. Свободное клиенты видят в приложении и по вашей ссылке.',
    side: 'top',
  },
];

export default function OnboardingShowcasePage() {
  const toast = useToast();
  const tour = useTour('dev.showcase');
  const [doneIds, setDoneIds] = useState<string[]>(['services', 'hours']);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [coachOpen, setCoachOpen] = useState(false);
  const [coachAnchor, setCoachAnchor] = useState<HTMLButtonElement | null>(null);
  const beacon = useOnce('beacon.dev.hot');

  const items: ChecklistItemData[] = OWNER_STEPS.map((s) => ({
    ...s,
    done: doneIds.includes(s.id),
  }));
  const allDone: ChecklistItemData[] = OWNER_STEPS.map((s) => ({
    ...s,
    done: !s.optional,
  }));
  const progress = checklistProgress(items);
  const [geo, setGeo] = useState<'ask' | 'asking' | 'denied'>('ask');
  const [visible, setVisible] = useState(false);
  const [mode, setMode] = useState<'open' | 'closed' | null>('open');
  const [modeKey, setModeKey] = useState(0);
  const toggle = (id: string) => setDoneIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  return (
    <div data-showcase className="mx-auto flex max-w-5xl flex-col gap-10 px-4 py-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-fg">Первый вход и подсказки</h1>
          <p className="mt-2 max-w-2xl text-muted">
            Компоненты <code>src/ui/onboarding</code>: тур по экрану, подсказка у кнопки, баннер, чек-лист «Первые
            шаги», пустой экран первого входа, приветствие. Правила и пути ролей — <code>docs/ONBOARDING.md</code>.
          </p>
        </div>
        <ReplayHintsButton idPrefix="dev." doneMessage="Подсказки витрины появятся снова">
          Показать подсказки снова
        </ReplayHintsButton>
      </header>

      <Section
        title="Тур по экрану — Tour + useTour"
        hint="3 шага, подсветка элемента, «Назад / Далее», крестик и Esc — пропустить. На телефоне карточка внизу у большого пальца. Прохождение запоминается; повтор — кнопкой «Как это работает»."
      >
        <Card padding="none" className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 border-b border-border p-3 sm:p-4">
            <div data-tour="demo-day" className="inline-flex items-center gap-1 rounded-xl bg-surface-2 p-1">
              <IconButton icon={<ChevronLeft aria-hidden />} label="Вчера" size="sm" />
              <span className="px-2 text-sm font-medium text-fg">Сегодня, чт 25 сент</span>
              <IconButton icon={<ChevronRight aria-hidden />} label="Завтра" size="sm" />
            </div>
            <Button data-tour="demo-add" leftIcon={<Plus aria-hidden />} className="ml-auto">
              Новая запись
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-3">
            {['Ани', 'Мариам', 'Лилит'].map((name, i) => (
              <div
                key={name}
                data-tour={i === 0 ? 'demo-column' : undefined}
                className="flex flex-col gap-2 bg-surface p-3 last:hidden sm:last:flex"
              >
                <p className="text-sm font-semibold text-fg">{name}</p>
                <div className="rounded-lg bg-primary-soft px-3 py-2 text-sm text-primary-text">10:00 · Маникюр</div>
                <div className="rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted">
                  11:30 свободно
                </div>
                <div className="rounded-lg bg-surface-2 px-3 py-2 text-sm text-muted">13:00 перерыв</div>
              </div>
            ))}
          </div>
        </Card>
        <div className="flex flex-wrap items-center gap-3">
          <TourButton onClick={tour.start} fresh={!tour.seen}>
            Как это работает
          </TourButton>
          <TourButton onClick={tour.start} fresh={!tour.seen} iconOnly>
            Как это работает
          </TourButton>
          <Badge tone={tour.seen ? 'success' : 'neutral'}>
            {tour.seen ? 'Тур пройден — сам больше не откроется' : 'Тур ещё не видели'}
          </Badge>
        </div>
        <Tour steps={TOUR_STEPS} {...tour.props} />
      </Section>

      <Section
        title="Подсказка у кнопки — Coachmark + Beacon"
        hint="Точка «загляните сюда» на новой функции; по нажатию — одна карточка-подсказка. Точка гаснет навсегда после первого нажатия."
      >
        <div className="flex flex-wrap items-center gap-4">
          <span className="relative inline-flex">
            <Button
              ref={setCoachAnchor}
              variant="outline"
              leftIcon={<Clock aria-hidden />}
              onClick={() => {
                beacon.markSeen();
                setCoachOpen(true);
              }}
            >
              Закончил раньше
            </Button>
            <Beacon id="dev.hot" label="Новое" />
          </span>
          {coachOpen && (
            <Coachmark
              target={coachAnchor}
              icon={<Clock aria-hidden />}
              title="Освободилось время? Отдайте его"
              body="Нажмите, когда закончили раньше, — окно станет «горящим», и его увидят клиенты рядом."
              onClose={() => setCoachOpen(false)}
              labels={{ done: 'Понятно' }}
            />
          )}
        </div>
      </Section>

      <Section
        title="Чек-лист «Первые шаги» — ChecklistCard"
        hint="Галочки считает раздел по данным (есть услуги, есть часы), а не по нажатиям. Нажмите на шаг слева, чтобы отметить его в витрине."
      >
        <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
          <ChecklistCard
            title="Первые шаги салона"
            description={progress.complete ? undefined : `Осталось ${progress.left} — и салон появится в каталоге.`}
            items={items}
            completeTitle="Салон готов принимать записи"
            completeDescription="Вас видно в каталоге, ссылка работает."
            completeAction={<Button leftIcon={<CalendarCheck aria-hidden />}>Открыть журнал</Button>}
            onHide={() => toast.info('В разделе чек-лист скроется навсегда (id)')}
            progressLabel={`Выполнено ${progress.done} из ${progress.total}`}
          />
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium text-muted">Отметить в витрине</p>
            {OWNER_STEPS.map((s) => (
              <Button
                key={s.id}
                variant={doneIds.includes(s.id) ? 'secondary' : 'outline'}
                size="sm"
                aria-pressed={doneIds.includes(s.id)}
                leftIcon={doneIds.includes(s.id) ? <Check aria-hidden /> : undefined}
                onClick={() => toggle(s.id)}
                className="justify-start"
              >
                {s.title}
              </Button>
            ))}
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-muted">compact — верх экрана на телефоне</p>
            <ChecklistCard
              variant="compact"
              title={`Настройка: ещё ${progress.left}`}
              items={items}
              onHide={() => undefined}
              showLessLabel="Свернуть"
              progressLabel={`Выполнено ${progress.done} из ${progress.total}`}
            />
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-muted">всё обязательное сделано — необязательный шаг остаётся</p>
            <ChecklistCard
              title="Первые шаги"
              items={allDone}
              completeTitle="Всё готово"
              completeDescription="Клиенты уже могут записываться по вашей ссылке."
              completeAction={<Button>Открыть журнал</Button>}
              onHide={() => undefined}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <ChecklistPill href="#" done={progress.done} total={REQUIRED_COUNT}>
            Настройка
          </ChecklistPill>
          <ProgressRing done={1} total={3} size="lg" />
          <ProgressRing done={3} total={3} size="lg" />
        </div>
      </Section>

      <Section
        title="Баннер-подсказка — HintBanner"
        hint="Одна на экран. С id закрытый крестиком баннер больше не появится у этой персоны."
      >
        <HintBanner
          id="dev.link"
          icon={<Link2 aria-hidden />}
          title="Ваша ссылка — только ваша"
          action={
            <Button size="sm" leftIcon={<Copy aria-hidden />} onClick={() => toast.success('Ссылка скопирована')}>
              Скопировать
            </Button>
          }
        >
          Кто откроет её, увидит только ваш салон: без рекламы и чужих мастеров.
        </HintBanner>
        <HintBanner
          tone="warning"
          dismissible={false}
          icon={<CalendarDays aria-hidden />}
          title="Окна на следующую неделю не открыты"
          action={
            <Button size="sm" variant="outline">
              Открыть окна
            </Button>
          }
        >
          Клиенты не смогут записаться на эти дни.
        </HintBanner>
        <HintBanner
          tone="info"
          icon={<MapPin aria-hidden />}
          title="Вас пока ищут только по району"
          dismissible={false}
        >
          Отметьте точку кнопкой «Я сейчас на месте работы» — и попадёте в поиск «рядом со мной».
        </HintBanner>
        <HintBanner tone="success" id="dev.visible" title="Профиль виден в каталоге">
          Услуги, окна и фото на месте — клиенты уже видят вас в поиске.
        </HintBanner>
      </Section>

      <Section
        title="Пустой экран первого входа — EmptyStateHint"
        hint="Не «Пока пусто», а что здесь будет, как начать и одна главная кнопка. Для «ничего не найдено по фильтру» — обычный EmptyState."
      >
        <Card padding="none">
          <EmptyStateHint
            icon={<CalendarDays aria-hidden />}
            title="Здесь будут ваши записи"
            description="Записи появятся, когда клиенты запишутся по ссылке или вы добавите их сами."
            steps={['Откройте окна на неделю', 'Поделитесь ссылкой с клиентами', 'Записи придут сюда сами']}
            action={<Button leftIcon={<CalendarPlus aria-hidden />}>Открыть окна</Button>}
            secondaryAction={
              <Button variant="ghost" leftIcon={<Plus aria-hidden />}>
                Записать клиента
              </Button>
            }
            footnote="Займёт 1 минуту"
          />
        </Card>
        <div className="grid gap-6 md:grid-cols-2">
          <Card padding="none">
            <EmptyStateHint
              compact
              icon={<Scissors aria-hidden />}
              title="Добавьте первые услуги"
              description="Без услуг клиенты не смогут записаться, а профиль не покажется в каталоге."
              action={<Button>Выбрать из готового списка</Button>}
            />
          </Card>
          <Card padding="none">
            <EmptyStateHint
              compact
              icon={<UserPlus aria-hidden />}
              title="Пригласите мастеров"
              description="Каждый мастер ведёт свой календарь в приложении."
              steps={['Номер мастера', 'Он подтверждает', 'Колонка в журнале']}
              action={<Button leftIcon={<UserPlus aria-hidden />}>Пригласить мастера</Button>}
            />
          </Card>
        </div>
      </Section>

      <Section
        title="Видно ли вас в каталоге — VisibilityCard"
        hint="F-00-072: пустые профили в каталоге не показываем. Владелец и мастер понимают за 3 секунды, видно ли их, и что поправить. Причины — из правила ядра staffClientVisibility."
      >
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setVisible((v) => !v)}>
            {visible ? 'Показать «не видно»' : 'Показать «видно»'}
          </Button>
        </div>
        <VisibilityCard
          visible={visible}
          title={visible ? 'Вас видно в каталоге' : 'Пока вас не видно в каталоге'}
          description={
            visible
              ? 'Клиенты находят вас в поиске и в «Свободно сегодня рядом».'
              : 'По вашей ссылке записываться можно, а в поиске вас нет. Не хватает:'
          }
          gaps={[
            { id: 'slots', title: 'Нет свободных окон на ближайшую неделю', href: '#', actionLabel: 'Открыть окна' },
            { id: 'photos', title: 'Нет ни одного фото работ', href: '#', actionLabel: 'Добавить фото' },
          ]}
          action={
            <Button variant="link" size="sm" leftIcon={<Eye aria-hidden />}>
              Как видят клиенты
            </Button>
          }
        />
      </Section>

      <Section
        title="Ваша ссылка — только ваша — ShareLinkCard"
        hint="F-00-006: по ссылке — только ваш салон, без соседей и рекламы. Первое на экране ссылок и на экране передачи салона владельцу. Нажатие на саму ссылку тоже копирует; «Поделиться» открывает меню телефона (нет его — копирует)."
      >
        <ShareLinkCard
          url="https://booktime.am/b/nuri-nail-studio"
          title="Ваша ссылка на запись"
          badge={<Badge tone="success">Работает</Badge>}
          description="Только ваш салон — без соседей, рекламы и чужих сторис. Поставьте её в Instagram и отправляйте клиентам в WhatsApp."
          shareText="Записывайтесь онлайн в «Нури»"
          onShared={(how) => how === 'share' && toast.info('Отметили шаг «Поделитесь ссылкой»')}
          extraActions={
            <Button variant="ghost" leftIcon={<QrCode aria-hidden />} onClick={() => toast.info('Открыли QR-код')}>
              QR-код
            </Button>
          }
        />
      </Section>

      <Section
        title="Спросить один раз — OneTimeChoice"
        hint="Разовый выбор (режим календаря F-00-051/052) — окном с карточками один раз, дальше тихая строка «Режим: … · Изменить». Не две огромные кнопки над календарём каждый день."
      >
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setMode(null);
              setModeKey((k) => k + 1);
            }}
          >
            Спросить заново
          </Button>
        </div>
        <Card>
          <h3 className="text-lg font-semibold text-fg">Мой календарь</h3>
          <OneTimeChoice
            key={modeKey}
            value={mode}
            onChange={(next) =>
              new Promise<void>((resolve) =>
                window.setTimeout(() => {
                  setMode(next);
                  toast.success('Режим сохранён');
                  resolve();
                }, 500),
              )
            }
            when={modeKey > 0}
            title="Как вы работаете?"
            description="От этого зависит, какие часы клиенты видят свободными. Поменять можно в любой момент."
            label="Режим"
            emptyText="не выбран"
            laterLabel="Позже"
            options={[
              {
                value: 'open',
                icon: <CalendarCheck aria-hidden />,
                title: 'Всё свободно — отмечаю занятое',
                description: 'Клиенты видят все рабочие часы, пока вы не отметите, что заняты.',
              },
              {
                value: 'closed',
                icon: <Clock aria-hidden />,
                title: 'Всё занято — открываю свободное',
                description: 'Клиенты видят только окна, которые вы открыли сами.',
              },
            ]}
            className="mt-1"
          />
        </Card>
      </Section>

      <Section
        title="Своя карточка перед системным разрешением — PermissionPrimer"
        hint="Браузер спрашивает один раз и «в лоб». Сначала выгода и «Разрешить», всегда путь без разрешения; отказ — спокойный текст, а не ошибка."
      >
        <PermissionPrimer
          state={geo === 'denied' ? 'denied' : 'ask'}
          icon={<MapPin aria-hidden />}
          title="Показать, кто свободен рядом?"
          description="Место нужно только для поиска — мы его не сохраняем."
          allowLabel="Разрешить"
          loading={geo === 'asking'}
          onAllow={() => {
            setGeo('asking');
            window.setTimeout(() => setGeo('denied'), 900);
          }}
          alternativeLabel="Выбрать район"
          onAlternative={() => toast.info('Открыли выбор района')}
          deniedText="Доступ к месту закрыт в настройках браузера. Выберите район — покажем мастеров поблизости от него."
        />
        <PermissionPrimer
          icon={<Bell aria-hidden />}
          title="Напомнить о записи за день?"
          description="Одно уведомление накануне и одно за 2 часа. Без рекламы."
          allowLabel="Включить напоминания"
          onAllow={() => toast.success('Напоминания включены')}
          alternativeLabel="Не сейчас"
          onAlternative={() => toast.info('Спросим позже в профиле')}
        />
      </Section>

      <Section
        title="Приглашение мастера — InviteCard"
        hint="Первый экран мастера салона (F-00-042): кто зовёт, что увидит салон и что останется вашим. Вход в салон — только с согласия."
      >
        <InviteCard
          fromName="Нури"
          title="Салон «Нури» приглашает вас в команду"
          subtitle="Пригласила Анна Саргсян · вчера"
          sharedTitle="Салон увидит"
          shared={[
            { icon: <CalendarDays aria-hidden />, text: 'Ваши записи в часы смены в салоне' },
            { icon: <Scissors aria-hidden />, text: 'Услуги и цены, которые вы делаете в салоне' },
          ]}
          keptTitle="Останется вашим"
          kept={[
            { icon: <House aria-hidden />, text: 'Домашние клиенты и записи вне салона' },
            { icon: <ShieldCheck aria-hidden />, text: 'Ваш номер — салон не передаёт его клиентам' },
          ]}
          actions={
            <>
              <Button variant="ghost" onClick={() => toast.info('Приглашение отклонено')}>
                Отказаться
              </Button>
              <Button onClick={() => toast.success('Вы в команде «Нури»')}>Принять приглашение</Button>
            </>
          }
          footnote="Выйти из салона можно в любой момент."
        />
      </Section>

      <Section
        title="Приветствие и «?» — WelcomeDialog, HelpTip"
        hint="Приветствие роли один раз при первом входе; главная кнопка обычно запускает тур или ведёт к чек-листу."
      >
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => setWelcomeOpen(true)}>Открыть приветствие</Button>
          <span className="inline-flex items-center gap-1 text-base text-fg">
            Горящее окно
            <HelpTip label="Что такое горящее окно?">
              Свободное время в ближайшие часы. Его показываем клиентам рядом наверху поиска — так оно быстрее
              занимается.
            </HelpTip>
          </span>
        </div>
        <WelcomeDialog
          open={welcomeOpen}
          onOpenChange={setWelcomeOpen}
          title="Добро пожаловать, Нури!"
          description="Здесь вы ведёте записи, клиентов и расписание салона."
          points={[
            {
              icon: <Scissors aria-hidden />,
              title: 'Услуги и часы уже заведены',
              text: 'Мы настроили их вместе на визите — поправить можно в любой момент.',
            },
            {
              icon: <UserPlus aria-hidden />,
              title: 'Мастерам ушли приглашения',
              text: 'Как только мастер подтвердит, появится его колонка в журнале.',
            },
            {
              icon: <Camera aria-hidden />,
              title: 'Осталось одно: фото работ',
              text: 'Профили с фото чаще выбирают в каталоге.',
            },
          ]}
          primaryLabel="Показать, что где"
          onPrimary={tour.start}
          laterLabel="Позже"
        />
      </Section>

      <NextStepShowcase />
    </div>
  );
}
