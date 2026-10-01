'use client';

/**
 * Витрина UI-кита «C» (хранитель дизайна, проход 3): панели действия у большого пальца, окна времени, ряды с прокруткой,
 * статусы записи, выбор карточками и днями недели, навигация по периоду, массовые действия, роли карточки таблицы,
 * новые режимы Sheet / Popover / DropdownMenu / Accordion. Dev-страница: подписи по-русски прямо в коде.
 */
import { Archive, Car, Copy, Home, MapPin, MoreHorizontal, Pencil, Plus, Send, Store, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { BookingStatus, ISODate } from '@/domain/core';
import { useFormat } from '@/i18n/useFormat';
import { addDays, today } from '@/lib/date';
import { Accordion } from '@/ui/Accordion';
import { Avatar } from '@/ui/Avatar';
import { Badge } from '@/ui/Badge';
import { BookingStatusBadge } from '@/ui/BookingStatusBadge';
import { BulkActionBar } from '@/ui/BulkActionBar';
import { Button } from '@/ui/Button';
import { Calendar } from '@/ui/Calendar';
import { Card } from '@/ui/Card';
import { Chip } from '@/ui/Chip';
import { ChoiceGroup } from '@/ui/ChoiceGroup';
import { DropdownMenu } from '@/ui/DropdownMenu';
import { Fab } from '@/ui/Fab';
import { FormField } from '@/ui/FormField';
import { IconButton } from '@/ui/IconButton';
import { Input } from '@/ui/Input';
import { PeriodNav } from '@/ui/PeriodNav';
import { Popover } from '@/ui/Popover';
import { ScrollRow } from '@/ui/ScrollRow';
import { SectionCard } from '@/ui/SectionCard';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { Sheet } from '@/ui/Sheet';
import { SlotButton } from '@/ui/SlotButton';
import { SlotRow } from '@/ui/SlotRow';
import { StickyActionBar } from '@/ui/StickyActionBar';
import { Stepper } from '@/ui/Stepper';
import { Table, type TableColumn } from '@/ui/Table';
import { Tabs } from '@/ui/Tabs';
import { useToast } from '@/ui/Toast';
import { WeekdayPicker } from '@/ui/WeekdayPicker';
import { ShowcaseVerify } from '@/dev/showcase/ShowcaseVerify';

function Section({ id, title, hint, children }: { id: string; title: string; hint?: string; children: ReactNode }) {
  return (
    <section id={id} className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4 shadow-xs md:p-6">
      <header>
        <h2 className="text-lg font-semibold text-fg">{title}</h2>
        {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
      </header>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-muted">{label}</p>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

const STATUSES: BookingStatus[] = [
  'awaiting_confirmation',
  'awaiting_prepayment',
  'scheduled',
  'client_confirmed',
  'arrived',
  'no_show',
  'cancelled_by_client',
  'cancelled_by_master',
];

interface DemoVisit {
  id: string;
  client: string;
  service: string;
  time: string;
  price: number;
  status: BookingStatus;
}

const VISITS: DemoVisit[] = [
  {
    id: 'v1',
    client: 'Ани Акопян',
    service: 'Маникюр с покрытием',
    time: '10:00',
    price: 8000,
    status: 'client_confirmed',
  },
  {
    id: 'v2',
    client: 'Мариам Саргсян',
    service: 'Педикюр классический',
    time: '11:30',
    price: 9500,
    status: 'scheduled',
  },
  {
    id: 'v3',
    client: 'Лусине Мартиросян',
    service: 'Наращивание',
    time: '13:00',
    price: 15000,
    status: 'awaiting_confirmation',
  },
  { id: 'v4', client: 'Гаяне Арутюнян', service: 'Снятие покрытия', time: '15:15', price: 3000, status: 'arrived' },
];

const SLOTS = ['10:00', '10:30', '11:15', '12:00', '13:30', '14:00', '15:45', '16:30', '17:00', '18:15'];

export function ShowcaseC() {
  const fmt = useFormat();
  const toast = useToast();
  const now = today();

  const [slot, setSlot] = useState<string | null>('11:15');
  const [where, setWhere] = useState('salon');
  const [places, setPlaces] = useState<string[]>(['salon', 'home']);
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4]);
  const [day, setDay] = useState<ISODate>(now);
  const [week, setWeek] = useState<ISODate>(now);
  const [month, setMonth] = useState<ISODate>(now);
  const [selected, setSelected] = useState<string[]>([]);
  const [bar, setBar] = useState(false);
  const [fab, setFab] = useState(false);
  const [sheet, setSheet] = useState<null | 'xl' | 'side'>(null);
  const [step, setStep] = useState(0);
  const [segment, setSegment] = useState('all');
  const [tab, setTab] = useState('history');

  const columns: TableColumn<DemoVisit>[] = [
    { id: 'avatar', header: '', width: '4.5rem', mobile: 'media', cell: (r) => <Avatar name={r.client} /> },
    { id: 'client', header: 'Клиент', mobile: 'title', cell: (r) => r.client },
    { id: 'service', header: 'Услуга', mobile: 'subtitle', cell: (r) => r.service },
    { id: 'time', header: 'Время', mobile: 'aside', cell: (r) => r.time, align: 'right' },
    { id: 'price', header: 'Сумма', mobile: 'meta', cell: (r) => fmt.money(r.price), align: 'right' },
    {
      id: 'status',
      header: 'Статус',
      mobile: 'badge',
      cell: (r) => <BookingStatusBadge status={r.status} size="sm" />,
    },
  ];

  return (
    <div className="flex flex-col gap-10">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-fg">Панели и выбор</h1>
        <p className="mt-2 text-muted">
          Новые общие компоненты прохода 3 и новые режимы старых. Смотрите и на телефоне.
        </p>
      </header>

      <ShowcaseVerify />

      <Section
        id="sticky"
        title="StickyActionBar · Fab"
        hint="Главное действие у большого пальца. Телефон: панель прижата к низу окна (над вкладками клиента), содержимому оставлено место. Десктоп: inline / sticky / hidden."
      >
        <Row label="Показать на этой странице">
          <Chip selected={bar} onClick={() => setBar(!bar)}>
            Панель с итогом
          </Chip>
          <Chip selected={fab} onClick={() => setFab(!fab)}>
            Плавающая «+»
          </Chip>
        </Row>
        {bar && (
          <StickyActionBar
            desktop="sticky"
            summary={
              <>
                1 услуга · 45 мин · <b>{fmt.money(6000)}</b>
              </>
            }
          >
            <Button onClick={() => toast.success('Запись создана')}>Продолжить</Button>
          </StickyActionBar>
        )}
        {fab && (
          <Fab
            icon={<Plus aria-hidden />}
            label="Новая запись"
            showOnDesktop
            onClick={() => toast.info('Новая запись')}
          />
        )}
      </Section>

      <Section
        id="slots"
        title="SlotButton · SlotRow"
        hint="Окна времени — одинаковые везде. Недоступное окно объясняет причину подсказкой."
      >
        <SlotRow date={now}>
          {SLOTS.map((s, i) => (
            <SlotButton
              key={s}
              selected={slot === s}
              disabled={i === 3}
              disabledReason="Мастер на перерыве"
              onClick={() => setSlot(s)}
            >
              {s}
            </SlotButton>
          ))}
        </SlotRow>
        <SlotRow date={addDays(now, 1)}>
          {SLOTS.slice(0, 4).map((s) => (
            <SlotButton key={s} onClick={() => setSlot(s)}>
              {s}
            </SlotButton>
          ))}
        </SlotRow>
        <SlotRow date={addDays(now, 3)}>
          {SLOTS.slice(4).map((s) => (
            <SlotButton key={s} size="md">
              {s}
            </SlotButton>
          ))}
        </SlotRow>
      </Section>

      <Section
        id="scroll"
        title="ScrollRow"
        hint="Ряд с прокруткой: край затухает, на десктопе — стрелки, ←/→ с клавиатуры."
      >
        <ScrollRow aria-label="Фильтры">
          {[
            'Рядом со мной',
            'Свободно сегодня',
            'Маникюр',
            'Педикюр',
            'Брови',
            'Ресницы',
            'Массаж',
            'Стрижка',
            'Окрашивание',
            'Барбер',
            'Косметология',
          ].map((c, i) => (
            <Chip key={c} selected={i === 1}>
              {c}
            </Chip>
          ))}
        </ScrollRow>
        <ScrollRow gap="md" bleed aria-label="Мастера">
          {[
            'Ани Саргсян',
            'Карен Мелконян',
            'Седа Адамян',
            'Арпи Азарян',
            'Нарек Григорян',
            'Сона Карапетян',
            'Тигран Оганесян',
            'Лилит Аветисян',
          ].map((n, i) => (
            <Card
              key={n}
              href="/dev/ui/c#scroll"
              padding="sm"
              className="flex w-36 flex-col items-center gap-2 text-center"
            >
              <Avatar name={n} colorIndex={(i % 8) + 1} size="lg" />
              <span className="text-sm font-medium">{n}</span>
            </Card>
          ))}
        </ScrollRow>
      </Section>

      <Section
        id="status"
        title="BookingStatusBadge"
        hint="Статус записи: одни тона и иконки во всех разделах; слова — для кабинета и от лица клиента."
      >
        <Row label="Кабинет (common.bookingStatus)">
          {STATUSES.map((s) => (
            <BookingStatusBadge key={s} status={s} />
          ))}
        </Row>
        <Row label="Клиент (audience=client), size=sm">
          {STATUSES.map((s) => (
            <BookingStatusBadge key={s} status={s} audience="client" size="sm" />
          ))}
        </Row>
      </Section>

      <Section
        id="choice"
        title="ChoiceGroup · ChoiceCard"
        hint="Выбор карточками: иконка, заголовок, пояснение. Один или несколько."
      >
        <FormField label="Где оказывается услуга">
          <ChoiceGroup
            value={where}
            onValueChange={setWhere}
            options={[
              { value: 'salon', title: 'В салоне', description: 'Клиент приходит по адресу салона', icon: <Store /> },
              {
                value: 'home',
                title: 'У меня дома',
                description: 'Точный адрес — только после записи',
                icon: <Home />,
              },
              {
                value: 'visit',
                title: 'Выезд к клиенту',
                description: 'По районам, которые вы выберете',
                icon: <Car />,
              },
              {
                value: 'other',
                title: 'Другое место',
                description: 'Коворкинг, студия подруги',
                icon: <MapPin />,
                disabled: true,
              },
            ]}
          />
        </FormField>
        <FormField label="Где принимаю (несколько)">
          <ChoiceGroup
            multiple
            columns={1}
            value={places}
            onValueChange={setPlaces}
            options={[
              { value: 'salon', title: 'Nuri Nail Studio', description: 'Кентрон, Абовяна 12', icon: <Store /> },
              { value: 'home', title: 'Дома', description: 'Арабкир', icon: <Home /> },
            ]}
          />
        </FormField>
      </Section>

      <Section
        id="weekdays"
        title="WeekdayPicker"
        hint="Дни недели: семь переключателей и быстрые «Будни» / «Каждый день»."
      >
        <FormField label="Рабочие дни">
          <WeekdayPicker value={days} onValueChange={setDays} />
        </FormField>
      </Section>

      <Section
        id="period"
        title="PeriodNav"
        hint="‹ · подпись периода (открывает календарь; на телефоне — шторкой) · › · «Сегодня»."
      >
        <Row label="День">
          <PeriodNav unit="day" value={day} onValueChange={setDay} />
        </Row>
        <Row label="Неделя">
          <PeriodNav unit="week" value={week} onValueChange={setWeek} />
        </Row>
        <Row label="Месяц">
          <PeriodNav unit="month" value={month} onValueChange={setMonth} />
        </Row>
      </Section>

      <Section
        id="table"
        title="Table · роли карточки · BulkActionBar"
        hint="Телефон: media (фото слева), badge (статус в строке имени), aside (время справа). Выберите строки — снизу появится панель действий."
      >
        <Table
          columns={columns}
          rows={VISITS}
          rowKey={(r) => r.id}
          selectable
          selected={selected}
          onSelectedChange={setSelected}
          onRowClick={(r) => toast.info(r.client)}
          label="Записи на сегодня"
        />
        <BulkActionBar
          count={selected.length}
          onClear={() => setSelected([])}
          actions={
            <Button size="sm" variant="secondary" leftIcon={<Send aria-hidden />}>
              Напомнить
            </Button>
          }
          moreItems={[
            { id: 'copy', label: 'Скопировать телефоны', icon: <Copy /> },
            { id: 'archive', label: 'В архив', icon: <Archive /> },
            { id: 'sep', separator: true },
            { id: 'del', label: 'Удалить', icon: <Trash2 />, danger: true },
          ]}
        />
        <Row label="Пустая таблица — без шапки и «выбрать всё»">
          <div className="w-full">
            <Table columns={columns} rows={[]} rowKey={(r) => r.id} selectable label="Пусто" />
          </div>
        </Row>
      </Section>

      <Section
        id="overlays"
        title="Sheet · Popover · DropdownMenu"
        hint="Sheet xl, немодальная шторка, «⋯» в шапке шторки; меню и поповер на телефоне — нижней шторкой."
      >
        <Row label="Шторки">
          <Button variant="outline" onClick={() => setSheet('xl')}>
            Sheet size=xl
          </Button>
          <Button variant="outline" onClick={() => setSheet('side')}>
            Немодальная (modal=false)
          </Button>
        </Row>
        <Row label="Меню и поповер">
          <DropdownMenu
            label="Действия с записью"
            items={[
              { id: 'edit', label: 'Изменить', icon: <Pencil /> },
              { id: 'copy', label: 'Скопировать', icon: <Copy /> },
              { id: 's', separator: true },
              { id: 'del', label: 'Удалить', icon: <Trash2 />, danger: true },
            ]}
            trigger={(p) => (
              <IconButton {...p} variant="outline" icon={<MoreHorizontal aria-hidden />} label="Действия" />
            )}
          />
          <Popover
            mobile="sheet"
            label="Статус и оплата"
            trigger={(p) => (
              <Button {...p} variant="outline">
                Статус (шторкой на телефоне)
              </Button>
            )}
          >
            {({ close }) => (
              <div className="flex w-full flex-col gap-2 p-1 md:w-72">
                {STATUSES.slice(2, 6).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={close}
                    className="flex min-h-12 items-center rounded-lg px-2 text-left hover:bg-surface-2"
                  >
                    <BookingStatusBadge status={s} />
                  </button>
                ))}
              </div>
            )}
          </Popover>
        </Row>
      </Section>

      <Section
        id="misc"
        title="Stepper · SegmentedControl · Tabs · Accordion · Calendar"
        hint="Прогресс с первого шага; сегменты не вылезают за экран; вкладки со стрелками; Accordion plain внутри SectionCard."
      >
        <Stepper
          steps={[
            { id: 's1', label: 'Услуга' },
            { id: 's2', label: 'Специалист' },
            { id: 's3', label: 'Дата и время' },
            { id: 's4', label: 'Детали записи' },
          ]}
          current={step}
          onStepClick={setStep}
        />
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={step === 0} onClick={() => setStep(step - 1)}>
            Назад
          </Button>
          <Button size="sm" disabled={step === 3} onClick={() => setStep(step + 1)}>
            Дальше
          </Button>
        </div>
        <SegmentedControl
          value={segment}
          onValueChange={setSegment}
          options={[
            { value: 'all', label: 'Все' },
            { value: 'link', label: 'По ссылке' },
            { value: 'mine', label: 'Только мои клиенты' },
            { value: 'nobody', label: 'Никто' },
          ]}
        />
        <Tabs
          value={tab}
          onValueChange={setTab}
          items={[
            'Записи',
            'История визитов',
            'Лояльность',
            'Баланс и оплаты',
            'Уведомления',
            'Файлы',
            'Заметки',
            'Абонементы',
            'Отзывы',
          ].map((l, i) => ({ value: i === 1 ? 'history' : `t${i}`, label: l }))}
        />
        <SectionCard title="Правила записи">
          <Accordion
            variant="plain"
            items={[
              { id: 'a', title: 'За сколько можно записаться', content: 'От 1 часа до 60 дней.' },
              { id: 'b', title: 'Отмена без штрафа', content: 'Не позже чем за 3 часа до визита.' },
            ]}
          />
        </SectionCard>
        <Row label="Недоступные дни — без точки, выходные в шапке — не красные">
          <Calendar
            defaultMonth={now}
            min={now}
            dayMeta={(d) => ({ dot: true, tone: 'success' as const, disabled: d.endsWith('7') })}
          />
        </Row>
        <Row label="Badge рядом для масштаба">
          <Badge tone="primary">Новое</Badge>
        </Row>
      </Section>

      <Sheet
        open={sheet === 'xl'}
        onOpenChange={(o) => !o && setSheet(null)}
        size="xl"
        title="Новая запись"
        description="Шторка 60rem: внутри раскладка по @container"
        headerActions={
          <DropdownMenu
            items={[{ id: 'del', label: 'Удалить', icon: <Trash2 />, danger: true }]}
            trigger={(p) => (
              <IconButton {...p} icon={<MoreHorizontal aria-hidden />} label="Ещё" className="rounded-full" />
            )}
          />
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setSheet(null)}>
              Отмена
            </Button>
            <Button
              onClick={() => {
                toast.success('Запись создана');
              }}
            >
              Записать
            </Button>
          </>
        }
      >
        <div className="grid gap-4 @2xl:grid-cols-2">
          <FormField label="Клиент">
            <Input placeholder="Имя или телефон" />
          </FormField>
          <FormField label="Комментарий (необязательно)" optional>
            <Input />
          </FormField>
        </div>
      </Sheet>
      <Sheet
        open={sheet === 'side'}
        onOpenChange={(o) => !o && setSheet(null)}
        modal={false}
        size="sm"
        title="Настройка графика"
        description="Страница за шторкой видна и нажимается"
      >
        <WeekdayPicker value={days} onValueChange={setDays} />
      </Sheet>
    </div>
  );
}
