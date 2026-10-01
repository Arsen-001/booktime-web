import type { AreaId } from '@/config/areas';
import type { PersonaId } from '@/demo/settings';
import type { Booking, Id, ISODate, Money, SphereId } from '@/domain/core';

/**
 * ТОЧКИ РАСШИРЕНИЯ: экраны, которые собираются из нескольких разделов.
 * Хозяин хоста строит сам экран (окно, карточку) и показывает вклады других разделов вкладками/секциями
 * через useExtensions(host) + <ExtensionSlot>. Раздел-вкладчик пишет ТОЛЬКО свой файл
 * src/areas/<area>/extensions/<Host>.tsx (default export компонента с пропсами хоста).
 */
export type HostId = 'bookingWindow' | 'clientCard' | 'staffCard' | 'serviceCard' | 'settingsHub' | 'clientProfile' | 'journalWaitlist';

/** Хозяева хостов */
export const HOST_OWNERS: Record<HostId, AreaId> = {
  bookingWindow: 'journal',
  clientCard: 'clients',
  staffCard: 'staff',
  serviceCard: 'services',
  settingsHub: 'settings',
  clientProfile: 'client',
  journalWaitlist: 'journal',
};

/** Черновик записи в окне записи — то, что видят вклады (оплата, расходники, лояльность…) */
export type BookingDraft = Partial<
  Pick<
    Booking,
    | 'staffId'
    | 'clientId'
    | 'appUserId'
    | 'start'
    | 'durationMin'
    | 'services'
    | 'resourceIds'
    | 'workplace'
    | 'source'
    | 'status'
    | 'comment'
    | 'prepayment'
    | 'forWhom'
    | 'visitorName'
  >
> & { total?: Money };

export interface BookingWindowExtProps {
  mode: 'create' | 'edit';
  /** Есть у сохранённой записи */
  bookingId?: Id;
  businessId: Id;
  locationId: Id;
  draft: BookingDraft;
  /** Вклад может поправить черновик (скидка, ресурс…) — хозяин решает, принять ли. Хозяин (journal) обязан передавать */
  onDraftChange?: (patch: Partial<BookingDraft>) => void;
  /**
   * Договор сохранения (arch-a1 №9). Вклад регистрирует шаг, хозяин вызывает его при «Сохранить»:
   *  - before — ДО записи хозяина: проверить своё (бросить ошибку = отменить сохранение с тостом хозяина);
   *  - after  — ПОСЛЕ записи хозяина, когда есть bookingId: записать своё своими api (оплата, расходники, карта).
   * Возвращает функцию отписки. Удобно через useBeforeSaveStep()/useAfterSaveStep() из '@/extensions/saveHooks'.
   * Нет у старого хозяина — вклад сохраняет своё сам (только в режиме edit, где есть bookingId).
   */
  registerBeforeSave?: (step: BeforeSaveStep) => () => void;
  registerAfterSave?: (step: AfterSaveStep) => () => void;
}

export type BeforeSaveStep = (draft: BookingDraft) => void | Promise<void>;
export type AfterSaveStep = (bookingId: Id, draft: BookingDraft) => void | Promise<void>;

export interface ClientCardExtProps {
  clientId: Id;
  businessId: Id;
}

export interface StaffCardExtProps {
  staffId: Id;
  businessId: Id;
}

export interface ServiceCardExtProps {
  mode: 'create' | 'edit';
  /** Нет у новой, ещё не сохранённой услуги */
  serviceId?: Id;
  businessId: Id;
  /**
   * Договор сохранения карточки услуги (28.09, как у окна записи): вклад регистрирует шаг «после сохранения»,
   * хозяин (services) вызывает его, когда записал саму услугу, — своё вклад пишет вместе с услугой, а не на
   * каждое изменение. Нет у старого хозяина (/dev/ext) — вклад сохраняет сразу, как раньше.
   * Удобно через useServiceAfterSaveStep() из '@/extensions/saveHooks'.
   */
  registerAfterSave?: (step: ServiceAfterSaveStep) => () => void;
  /** Вклад сообщает хозяину, что у него есть несохранённое, — хозяин показывает «Сохранить» и спрашивает при уходе */
  onDirtyChange?: (dirty: boolean) => void;
}

export type ServiceAfterSaveStep = (serviceId: Id) => void | Promise<void>;

export interface SettingsHubExtProps {
  businessId: Id;
}

export interface ClientProfileExtProps {
  appUserId: Id;
}

/**
 * Панель «Лист ожидания» в журнале (владелец, 30.09.2026: лист ожидания один) — её содержимое рисует хозяин листа
 * (resources), тот же компонент, что экран /biz/waitlist. Журнал даёт день сетки и мастеров, а «Записать» открывает
 * окно записи у себя (onRecord) и после сохранения закрывает заявку.
 */
export interface JournalWaitlistExtProps {
  businessId: Id;
  locationId: Id;
  /** День сетки журнала — фильтр «На день журнала» */
  date: ISODate;
  /** Мастера журнала (без скрытых) — их предлагает форма и среди них ищется свободное окно */
  staffIds: Id[];
  onRecord: (request: WaitlistRecordRequest) => void;
}

/** «Записать» из заявки листа ожидания: всё, чем заполнить окно записи */
export interface WaitlistRecordRequest {
  entryId: Id;
  /** Карточка клиента по телефону заявки; нет — окно заполняется именем и телефоном */
  clientId?: Id;
  clientName: string;
  clientPhone: string;
  serviceIds: Id[];
  comment?: string;
  staffId?: Id;
  date: ISODate;
  /** Ближайшее свободное время, которое ждёт заявка; нет — время выберут в окне */
  time?: string;
}

export interface HostProps {
  bookingWindow: BookingWindowExtProps;
  clientCard: ClientCardExtProps;
  staffCard: StaffCardExtProps;
  serviceCard: ServiceCardExtProps;
  settingsHub: SettingsHubExtProps;
  clientProfile: ClientProfileExtProps;
  journalWaitlist: JournalWaitlistExtProps;
}

export interface ExtensionEntry<H extends HostId = HostId> {
  host: H;
  area: AreaId;
  /** Порядок вкладки/секции внутри хоста */
  order: number;
  /** Полный ключ подписи вкладки: 'common.ext.bookingWindow.finance' */
  labelKey: string;
  /** Скрыть в сферах без функции (например, расходники у фитнес-тренера) */
  hiddenInSpheres?: SphereId[];
  personas?: PersonaId[];
  component: React.LazyExoticComponent<React.ComponentType<HostProps[H]>>;
}
