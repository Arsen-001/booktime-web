'use client';

/**
 * Витрина UI-кита «B»: оверлеи, даты, таблицы, цвета, фото, фильтры, графики — со всеми состояниями.
 * Dev-страница: подписи секций по-русски прямо в коде.
 */
import { Copy, MoreHorizontal, Pencil, Plus, Trash2, UserRound } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, Tooltip as ChartTooltip, XAxis, YAxis } from 'recharts';
import type { ISODate, TimeHM } from '@/domain/core';
import { useFormat } from '@/i18n/useFormat';
import { dayjs, toISODate, today } from '@/lib/date';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { Calendar, type DateRange } from '@/ui/Calendar';
import { CHART_COLORS, ChartCard, chartTheme } from '@/ui/ChartCard';
import { Chip } from '@/ui/Chip';
import { ColorPicker } from '@/ui/ColorPicker';
import { ColorSwatch } from '@/ui/ColorSwatch';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { DatePicker } from '@/ui/DatePicker';
import { DateRangePicker } from '@/ui/DateRangePicker';
import { DropdownMenu } from '@/ui/DropdownMenu';
import { FilterBar } from '@/ui/FilterBar';
import { IconButton } from '@/ui/IconButton';
import { ImageUpload } from '@/ui/ImageUpload';
import { Modal } from '@/ui/Modal';
import { Pagination } from '@/ui/Pagination';
import { Popover } from '@/ui/Popover';
import { Select } from '@/ui/Select';
import { Sheet, type SheetSide } from '@/ui/Sheet';
import { Table, type TableColumn } from '@/ui/Table';
import { TimePicker } from '@/ui/TimePicker';
import { useConfirm, useToast } from '@/ui/Toast';
import { Tooltip } from '@/ui/Tooltip';

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4 shadow-xs md:p-6">
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

interface DemoClient {
  id: string;
  name: string;
  phone: string;
  visits: number;
  spent: number;
  last: ISODate;
  status: 'regular' | 'new' | 'lost';
}

const NAMES = ['Ани Акопян', 'Мариам Саргсян', 'Лусине Мартиросян', 'Арам Петросян', 'Гаяне Арутюнян', 'Нарек Григорян', 'Сона Карапетян', 'Тигран Оганесян', 'Лилит Аветисян', 'Давид Мкртчян', 'Нуне Варданян', 'Гор Хачатрян'];

const CLIENTS: DemoClient[] = NAMES.map((name, i) => ({
  id: `cl_${i + 1}`,
  name,
  phone: `+3740010${String(1000 + i * 137).slice(-4)}`,
  visits: (i * 7) % 23 + 1,
  spent: ((i * 7919) % 90 + 5) * 1000,
  last: toISODate(dayjs('2026-09-24').subtract((i * 11) % 60, 'day')),
  status: i % 5 === 0 ? 'new' : i % 4 === 0 ? 'lost' : 'regular',
}));

const STATUS_TONE = { regular: 'success', new: 'info', lost: 'warning' } as const;
const STATUS_LABEL = { regular: 'Постоянный', new: 'Новый', lost: 'Давно не был' } as const;

const REVENUE = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'].map((day, i) => ({
  day,
  revenue: [42, 58, 51, 66, 80, 95, 37][i] * 1000,
  visits: [6, 8, 7, 9, 11, 14, 5][i],
}));

const SHADES = [
  { color: '#B3122E', label: 'Рубин 21' }, // tokens-ok: оттенок лака — данные
  { color: '#E8A0A8', label: 'Пудра 04' }, // tokens-ok: оттенок лака — данные
  { color: '#F4D9C6', label: 'Нюд 12' }, // tokens-ok: оттенок лака — данные
  { color: '#3B2A4F', label: 'Слива 33' }, // tokens-ok: оттенок лака — данные
  { color: '#1F1F1F', label: 'Чёрный 01' }, // tokens-ok: оттенок лака — данные
];

export function ShowcaseB() {
  const toast = useToast();
  const confirm = useConfirm();
  const format = useFormat();

  const [modal, setModal] = useState<null | 'sm' | 'md' | 'lg' | 'xl'>(null);
  const [sheet, setSheet] = useState<SheetSide | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [tableState, setTableState] = useState<'data' | 'loading' | 'empty'>('data');
  const [selected, setSelected] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [date, setDate] = useState<ISODate | null>(today());
  const [range, setRange] = useState<DateRange>({});
  const [calRange, setCalRange] = useState<DateRange>({});
  const [time, setTime] = useState<TimeHM | null>('10:30');
  const [time30, setTime30] = useState<TimeHM | null>(null);

  const [colorIndex, setColorIndex] = useState(1);
  const [shade, setShade] = useState(SHADES[0].color);
  const [avatar, setAvatar] = useState<string[]>([]);
  const [works, setWorks] = useState<string[]>([]);

  const [search, setSearch] = useState('');
  const [chips, setChips] = useState<string[]>(['today']);
  const [district, setDistrict] = useState('');

  const columns: TableColumn<DemoClient>[] = [
    { id: 'name', header: 'Клиент', cell: (r) => r.name, sortable: true, mobile: 'title' },
    { id: 'phone', header: 'Телефон', cell: (r) => format.phone(r.phone), mobile: 'subtitle' },
    { id: 'visits', header: 'Визиты', cell: (r) => r.visits, sortable: true, align: 'right' },
    { id: 'spent', header: 'Потратил', cell: (r) => format.money(r.spent), sortValue: (r) => r.spent, sortable: true, align: 'right' },
    { id: 'last', header: 'Последний визит', cell: (r) => format.date(r.last, 'dayMonth'), sortValue: (r) => r.last, sortable: true },
    {
      id: 'status',
      header: 'Статус',
      cell: (r) => (
        <Badge tone={STATUS_TONE[r.status]} dot>
          {STATUS_LABEL[r.status]}
        </Badge>
      ),
      sortValue: (r) => r.status,
    },
  ];

  const busyDays = (d: ISODate) => {
    const n = dayjs(d).date();
    if (dayjs(d).isoWeekday() === 7) return { tone: 'muted' as const, disabled: true, label: 'Выходной' };
    if (n % 5 === 0) return { tone: 'danger' as const, dot: true, label: 'Всё занято' };
    if (n % 3 === 0) return { tone: 'warning' as const, dot: true, label: 'Почти занято' };
    if (n % 2 === 0) return { tone: 'success' as const, dot: true, label: 'Есть окна' };
    return undefined;
  };

  const toggleChip = (id: string) => setChips((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  const activeFilters = chips.length + (district ? 1 : 0);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold text-fg">UI-кит · оверлеи, даты, данные</h1>
        <p className="mt-1 text-muted">Все компоненты «B» со всеми состояниями. Армянский шрифт: «Ժամ, Երևան».</p>
      </header>

      <Section title="Модальные окна и шторки" hint="Esc и клик по затемнению закрывают; фокус остаётся внутри; прокрутка страницы заблокирована.">
        <Row label="Modal — размеры">
          {(['sm', 'md', 'lg', 'xl'] as const).map((s) => (
            <Button key={s} variant="outline" onClick={() => setModal(s)}>
              Modal {s}
            </Button>
          ))}
        </Row>
        <Row label="Sheet — стороны (auto: снизу на телефоне, справа на десктопе)">
          {(['auto', 'bottom', 'right', 'left'] as const).map((s) => (
            <Button key={s} variant="outline" onClick={() => setSheet(s)}>
              Sheet {s}
            </Button>
          ))}
        </Row>
        <Row label="Подтверждение">
          <Button variant="danger" onClick={() => setConfirmOpen(true)}>
            ConfirmDialog (1 с ожидания)
          </Button>
          <Button
            variant="secondary"
            onClick={async () => {
              const ok = await confirm({
                title: 'Отменить запись?',
                description: 'Клиент получит уведомление об отмене.',
                confirmLabel: 'Отменить запись',
                cancelLabel: 'Не отменять',
                tone: 'danger',
              });
              toast.info(ok ? 'Подтвердили' : 'Передумали');
            }}
          >
            useConfirm()
          </Button>
        </Row>
        <Row label="Popover, Tooltip, DropdownMenu">
          <Popover trigger={(p) => <Button {...p} variant="outline">Popover</Button>} label="Пример">
            {({ close }) => (
              <div className="flex w-64 flex-col gap-3 p-2">
                <p className="text-sm text-muted">Любое содержимое. Esc или клик вне — закрыть.</p>
                <Button size="sm" onClick={close}>
                  Понятно
                </Button>
              </div>
            )}
          </Popover>
          <Tooltip content="Подсказка сверху">
            <Button variant="ghost">Tooltip сверху</Button>
          </Tooltip>
          <Tooltip content="Подсказка справа — для свёрнутого меню" side="right">
            <IconButton icon={<UserRound aria-hidden />} label="Профиль" variant="secondary" />
          </Tooltip>
          <DropdownMenu
            label="Действия с записью"
            trigger={(p) => <IconButton {...p} icon={<MoreHorizontal aria-hidden />} label="Ещё" variant="outline" />}
            items={[
              { id: 'g', groupLabel: 'Запись' },
              { id: 'edit', label: 'Изменить', icon: <Pencil />, onSelect: () => toast.info('Изменить') },
              { id: 'copy', label: 'Копировать', icon: <Copy />, hint: '⌘C', onSelect: () => toast.info('Скопировано') },
              { id: 'link', label: 'Открыть UI-кит A', href: '/dev/ui/a' },
              { id: 'dis', label: 'Недоступно', disabled: true },
              { id: 's', separator: true },
              { id: 'del', label: 'Удалить', icon: <Trash2 />, danger: true, onSelect: () => toast.error('Удалено') },
            ]}
          />
        </Row>
      </Section>

      <Section title="Тосты" hint="Телефон — снизу по центру над вкладками, десктоп — справа снизу.">
        <Row label="Тона">
          <Button variant="outline" onClick={() => toast.success('Запись сохранена')}>
            success
          </Button>
          <Button variant="outline" onClick={() => toast.error('Не получилось. Попробуйте ещё раз.')}>
            error
          </Button>
          <Button variant="outline" onClick={() => toast.info('Клиент подтвердил запись')}>
            info
          </Button>
          <Button variant="outline" onClick={() => toast.warning('Окно на 15:00 почти занято')}>
            warning
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              toast.show({
                title: 'Запись отменена',
                description: 'Ани Акопян, маникюр, 15:00',
                tone: 'info',
                action: { label: 'Вернуть', onClick: () => toast.success('Запись возвращена') },
              })
            }
          >
            с описанием и действием
          </Button>
        </Row>
      </Section>

      <Section title="Таблица и страницы" hint="На телефоне строки превращаются в карточки. Сортировка — по заголовку.">
        <div className="flex flex-wrap gap-2">
          {(['data', 'loading', 'empty'] as const).map((s) => (
            <Chip key={s} selected={tableState === s} onClick={() => setTableState(s)}>
              {s === 'data' ? 'Данные' : s === 'loading' ? 'Загрузка' : 'Пусто'}
            </Chip>
          ))}
          {selected.length > 0 && <Badge tone="primary">Выбрано: {selected.length}</Badge>}
        </div>
        <Table
          label="Клиенты"
          columns={columns}
          rows={tableState === 'data' ? CLIENTS : []}
          rowKey={(r) => r.id}
          loading={tableState === 'loading'}
          selectable
          selected={selected}
          onSelectedChange={setSelected}
          defaultSort={{ columnId: 'name', dir: 'asc' }}
          onRowClick={(r) => toast.info(`Открыть карточку: ${r.name}`)}
          empty={<p className="py-10 text-center text-muted">Клиентов пока нет — добавьте первого</p>}
        />
        <Pagination
          page={page}
          pageSize={pageSize}
          total={124}
          onPageChange={setPage}
          onPageSizeChange={(s) => {
            setPageSize(s);
            setPage(1);
          }}
        />
      </Section>

      <Section title="Календарь, даты и время" hint="Неделя с понедельника, 24 часа. Точки — загрузка дня (dayMeta), воскресенье — выходной.">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-muted">Один день + dayMeta</p>
            <Calendar value={date} onValueChange={setDate} dayMeta={busyDays} />
            <p className="text-sm text-muted">Выбрано: {date ? format.date(date, 'weekdayLong') : '—'}</p>
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-muted">Период</p>
            <Calendar mode="range" range={calRange} onRangeChange={setCalRange} min={today()} />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            DatePicker (с очисткой, не раньше сегодня)
            <DatePicker value={date} onValueChange={setDate} clearable min={today()} dayMeta={busyDays} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            DatePicker пустой и с ошибкой
            <DatePicker value={null} onValueChange={() => {}} invalid />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            DateRangePicker с быстрыми периодами
            <DateRangePicker value={range} onValueChange={setRange} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            TimePicker, шаг 15, 09:00–21:00
            <TimePicker value={time} onValueChange={setTime} min="09:00" max="21:00" />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            TimePicker, шаг 30, пустой
            <TimePicker value={time30} onValueChange={setTime30} step={30} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            TimePicker выключен
            <TimePicker value="12:00" onValueChange={() => {}} disabled />
          </label>
        </div>
      </Section>

      <Section title="Цвета" hint="Токены chart-1…8 (цвета мастеров, категорий) и цвета из данных (оттенки лака).">
        <Row label="ColorSwatch — токены, размеры sm / md / lg">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <ColorSwatch key={i} colorIndex={i} label={`Цвет ${i}`} size={i % 3 === 0 ? 'lg' : i % 2 === 0 ? 'md' : 'sm'} />
          ))}
        </Row>
        <Row label="ColorSwatch — оттенки из склада (кнопки)">
          {SHADES.map((s) => (
            <ColorSwatch key={s.color} color={s.color} label={s.label} selected={shade === s.color} onClick={() => setShade(s.color)} />
          ))}
          <span className="text-sm text-muted">{SHADES.find((s) => s.color === shade)?.label}</span>
        </Row>
        <Row label={`ColorPicker — выбран ${colorIndex}`}>
          <ColorPicker value={colorIndex} onValueChange={setColorIndex} label="Цвет мастера в журнале" />
        </Row>
      </Section>

      <Section title="Загрузка фото" hint="Без сервера: картинка уменьшается до 800 px и хранится как data URL.">
        <div className="grid gap-6 md:grid-cols-[16rem_1fr]">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-muted">Одно фото (аватар)</p>
            <ImageUpload value={avatar} onValueChange={setAvatar} label="Фото профиля" />
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-muted">Фото работ — до 6 (F-00-085), 4:3</p>
            <ImageUpload value={works} onValueChange={setWorks} max={6} aspect="4/3" label="Добавить фото" />
          </div>
        </div>
      </Section>

      <Section title="Фильтры над списком" hint="На телефоне фильтры уходят в шторку «Фильтры (n)».">
        <FilterBar
          search={{ value: search, onValueChange: setSearch, placeholder: 'Имя или телефон' }}
          activeCount={activeFilters}
          onReset={() => {
            setChips([]);
            setDistrict('');
          }}
          actions={<Button leftIcon={<Plus aria-hidden />}>Добавить клиента</Button>}
        >
          <Chip selected={chips.includes('today')} onClick={() => toggleChip('today')}>
            Свободно сегодня
          </Chip>
          <Chip selected={chips.includes('home')} onClick={() => toggleChip('home')}>
            Выезд ко мне
          </Chip>
          <Select
            className="w-48"
            value={district}
            onValueChange={setDistrict}
            placeholder="Район"
            options={[
              { value: 'kentron', label: 'Кентрон' },
              { value: 'arabkir', label: 'Арабкир' },
              { value: 'nor-nork', label: 'Нор-Норк' },
            ]}
          />
        </FilterBar>
        <p className="text-sm text-muted">
          Поиск: «{search}» · фильтров: {activeFilters}
        </p>
      </Section>

      <Section title="Графики" hint="ChartCard сам оборачивает график в ResponsiveContainer; цвета — CHART_COLORS и chartTheme.">
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="Выручка за неделю" description="Драмы, по дням">
            <BarChart data={REVENUE} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid {...chartTheme.grid} />
              <XAxis dataKey="day" {...chartTheme.axis} />
              <YAxis {...chartTheme.axis} width={56} tickFormatter={(v: number) => `${v / 1000}k`} />
              <ChartTooltip {...chartTheme.tooltip} formatter={(v) => format.money(Number(v))} />
              <Bar dataKey="revenue" name="Выручка" fill={CHART_COLORS[0]} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ChartCard>
          <ChartCard title="Визиты" description="Линия, вторая серия цвета chart-2">
            <LineChart data={REVENUE} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid {...chartTheme.grid} />
              <XAxis dataKey="day" {...chartTheme.axis} />
              <YAxis {...chartTheme.axis} width={32} allowDecimals={false} />
              <ChartTooltip {...chartTheme.tooltip} />
              <Line type="monotone" dataKey="visits" name="Визиты" stroke={CHART_COLORS[1]} strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ChartCard>
          <ChartCard title="Загрузка" loading height={180}>
            <BarChart data={[]} />
          </ChartCard>
          <ChartCard title="Нет данных" empty height={180}>
            <BarChart data={[]} />
          </ChartCard>
        </div>
      </Section>

      <Modal
        open={modal !== null}
        onOpenChange={(o) => !o && setModal(null)}
        size={modal ?? 'md'}
        title="Новая запись"
        description="Ани Акопян · Маникюр с покрытием · 60 мин"
        footer={
          <>
            <Button variant="outline" onClick={() => setModal(null)}>
              Отмена
            </Button>
            <Button
              onClick={() => {
                setModal(null);
                toast.success('Запись сохранена');
              }}
            >
              Сохранить
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Дата
            <DatePicker value={date} onValueChange={setDate} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Время
            <TimePicker value={time} onValueChange={setTime} min="09:00" max="21:00" />
          </label>
          {Array.from({ length: modal === 'xl' ? 8 : 2 }, (_, i) => (
            <p key={i} className="text-muted">
              Длинный текст, чтобы проверить прокрутку внутри окна. Кнопки внизу остаются на месте.
            </p>
          ))}
        </div>
      </Modal>

      <Sheet
        open={sheet !== null}
        onOpenChange={(o) => !o && setSheet(null)}
        side={sheet ?? 'auto'}
        title="Фильтры"
        description={`side="${sheet}"`}
        footer={
          <>
            <Button variant="outline" onClick={() => setSheet(null)}>
              Сбросить
            </Button>
            <Button onClick={() => setSheet(null)}>Показать 24 мастера</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <Chip selected>Свободно сегодня</Chip>
            <Chip>Выезд ко мне</Chip>
            <Chip>Онлайн</Chip>
          </div>
          <DateRangePicker value={range} onValueChange={setRange} />
          {Array.from({ length: 6 }, (_, i) => (
            <p key={i} className="text-muted">
              Строка {i + 1}: содержимое прокручивается внутри шторки.
            </p>
          ))}
        </div>
      </Sheet>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        tone="danger"
        title="Удалить клиента?"
        description="История визитов останется в отчётах."
        confirmLabel="Удалить"
        onConfirm={async () => {
          await new Promise((r) => setTimeout(r, 1000));
          toast.success('Клиент удалён');
        }}
      />
    </div>
  );
}
