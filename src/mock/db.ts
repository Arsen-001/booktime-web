'use client';

/**
 * МОКОВАЯ БАЗА (вместо бэкенда). zustand + persist в localStorage.
 * Файл фундамента. Разделы читают и пишут данные ТОЛЬКО через src/api/* (не импортируют этот файл
 * в компоненты). В api раздела для своего среза есть readArea()/mutateArea(), для ядра — функции api/core.
 *
 * Устройство:
 *   core   — коллекции ядра (src/domain/core.ts);
 *   areas  — срезы разделов (src/mock/slices/<area>.ts);
 *   access — права администраторов, выставленные владельцем (F-00-039);
 *   meta   — версия сида, момент сида, версии срезов, rev (счётчик записей; запросы на него НЕ смотрят).
 *
 * Точечное обновление (docs/STATE.md): база знает, КАКИЕ коллекции прочитал запрос и КАКИЕ изменила
 * запись. Метка — DbTag: 'core.bookings' (коллекция ядра), 'areas.clients.rows' (поле среза раздела),
 * 'areas.clients' (набор полей среза), 'access'.
 *   • Чтение: пока идёт runTracked(tracker, fn), useDb.getState() отдаёт «наблюдаемый вид» состояния —
 *     обращение к core.bookings / areas.loyalty / access записывает метку в tracker. Так src/api/request.ts
 *     узнаёт зависимости каждого запроса, ничего не требуя от разделов.
 *   • Запись: после любого set() сравниваем ссылки коллекций до/после и раз в микрозадачу сообщаем
 *     подписчикам onDbChange набор изменённых меток. request.ts перечитывает только запросы, читавшие их.
 *     Запись в срез (mutateArea клонирует срез целиком) проходит через replaceEqualDeep: неизменённые
 *     поля среза сохраняют ссылки — так «переключатель в настройках раздела» не будит список клиентов.
 */
import { replaceEqualDeep } from '@tanstack/react-query';
import { create } from 'zustand';
import { persist, type PersistStorage, type StorageValue } from 'zustand/middleware';
import type { AreaId } from '@/config/areas';
import { AREA_IDS } from '@/config/areas';
import type { Permission } from '@/config/permissions';
import type { CoreCollection, CoreData, Id } from '@/domain/core';
import { SEED_VERSION, seedCore } from '@/mock/seed';
import { SLICES, type AreaStates } from '@/mock/slices';

export interface DbMeta {
  seedVersion: number;
  /** Момент сида (ISO) — от него считались даты демо */
  seededAt: string;
  sliceVersions: Partial<Record<AreaId, number>>;
  rev: number;
}

export interface DbData {
  core: CoreData;
  areas: AreaStates;
  access: { staffPermissions: Record<Id, Permission[]> };
  meta: DbMeta;
}

interface DbActions {
  /** Заменить данные целиком (сид, сброс) */
  replaceAll: (data: DbData) => void;
  setCore: (recipe: (core: CoreData) => CoreData) => void;
  setArea: <A extends AreaId>(area: A, recipe: (state: AreaStates[A]) => AreaStates[A]) => void;
  setAccess: (recipe: (access: DbData['access']) => DbData['access']) => void;
}

export type DbState = DbData & DbActions;

/** Метка части базы: коллекция ядра, поле среза раздела, набор полей среза или права */
export type DbTag = `core.${CoreCollection}` | `areas.${AreaId}` | `areas.${AreaId}.${string}` | 'access';

const STORAGE_KEY = 'bp-mock-db';
const STORE_VERSION = 1;
/** Старый вид хранилища: вся база одним ключом/блобом — источник QuotaExceededError (qa/requests/*.md, «quota»).
 * Читаем один раз при подъёме, переносим настоящие изменения в новые ключи, затем удаляем. */
const LEGACY_STORAGE_KEY = STORAGE_KEY;
const metaStorageKey = () => `${STORAGE_KEY}:meta`;
const accessStorageKey = () => `${STORAGE_KEY}:access`;
const coreStorageKey = (collection: string) => `${STORAGE_KEY}:core:${collection}`;
const areaStorageKey = (area: AreaId) => `${STORAGE_KEY}:area:${area}`;

/** Демо-данные «протухают»: через столько дней после сида пересоздаются, чтобы даты были живыми. */
const STALE_AFTER_DAYS = 7;

function emptyCore(): CoreData {
  return {
    networks: [],
    businesses: [],
    locations: [],
    staff: [],
    serviceCategories: [],
    services: [],
    resources: [],
    clients: [],
    appUsers: [],
    bookings: [],
    groupEvents: [],
    schedules: [],
    calendarMarks: [],
    bookingEvents: [],
    dataOps: [],
    coinLedger: [],
  };
}

/** Список коллекций ядра — по ключам emptyCore(), чтобы не дублировать их отдельным литералом. */
const CORE_COLLECTIONS = Object.keys(emptyCore()) as (keyof CoreData)[];

/**
 * Досыпать недостающее в поднятую из localStorage базу, НЕ трогая данные. Коллекции ядра, появившиеся после
 * сида (например bookingEvents), — пустыми массивами. null — досыпать нечего.
 */
function fillMissingCore(s: DbData): CoreData | null {
  let core: CoreData | undefined;
  const empty = emptyCore();
  for (const key of Object.keys(empty) as (keyof CoreData)[]) {
    if (!Array.isArray(s.core[key])) (core ??= { ...s.core })[key] = empty[key] as never;
  }
  return core ?? null;
}

/**
 * Поля среза, которые раздел добавил в seed(), не подняв version (online.md: срез schedule без prepaymentWaitMin
 * ронял расчёт окон), — из свежего seed() этого среза. Сеять все срезы ~70 мс, поэтому зовётся в простое после
 * подъёма базы; запросы, читавшие досыпанный срез, перечитаются сами. null — досыпать нечего.
 */
function fillMissingAreas(s: DbData, now: Date): AreaStates | null {
  let areas: Record<string, unknown> | undefined;
  const filled: string[] = [];
  for (const id of AREA_IDS) {
    const current = s.areas[id] as unknown;
    if (!isPlainObject(current)) continue;
    let fresh: unknown;
    try {
      fresh = SLICES[id].seed(s.core, now);
    } catch {
      continue;
    }
    if (!isPlainObject(fresh)) continue;
    const missing = Object.keys(fresh).filter((k) => !(k in current));
    if (!missing.length) continue;
    const patched: Record<string, unknown> = { ...current };
    for (const k of missing) patched[k] = fresh[k];
    (areas ??= { ...(s.areas as Record<string, unknown>) })[id] = patched;
    filled.push(`${id}: ${missing.join(', ')}`);
  }
  if (filled.length) console.info(`[mock-db] досыпаны новые поля срезов (раздел добавил поле, не подняв version): ${filled.join('; ')}`);
  return (areas as AreaStates | undefined) ?? null;
}

function whenIdle(fn: () => void): void {
  if (typeof window === 'undefined') return;
  const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  if (ric) ric(fn, { timeout: 2000 });
  else setTimeout(fn, 300);
}

function seedAreas(core: CoreData, now: Date): { areas: AreaStates; versions: Partial<Record<AreaId, number>> } {
  const areas = {} as Record<AreaId, unknown>;
  const versions: Partial<Record<AreaId, number>> = {};
  for (const id of AREA_IDS) {
    const slice = SLICES[id];
    areas[id] = slice.seed(core, now);
    versions[id] = slice.version;
  }
  return { areas: areas as AreaStates, versions };
}

/** Полный свежий набор демо-данных от момента now */
export function createSeedData(now: Date = new Date()): DbData {
  const core: CoreData = { ...emptyCore(), ...seedCore(now) };
  const { areas, versions } = seedAreas(core, now);
  return {
    core,
    areas,
    access: { staffPermissions: {} },
    meta: { seedVersion: SEED_VERSION, seededAt: now.toISOString(), sliceVersions: versions, rev: 1 },
  };
}

function readJSON<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? undefined : (JSON.parse(raw) as T);
  } catch (e) {
    console.warn(`[mock-db] не удалось прочитать ${key} из localStorage`, e);
    return undefined;
  }
}

function writeJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    // Квота бьёт по ОДНОМУ ключу (одна коллекция/один срез), а не по всей базе — остальные уже
    // записанные ключи не откатываются (qa/requests/*.md, «quota»: раньше один общий блоб ронял всё).
    console.warn(`[mock-db] не удалось сохранить ${key} в localStorage`, e);
  }
}

/** Грубое, но достаточное сравнение содержимого (без функций/дат-объектов — тут их нет, только JSON-совместимые данные). */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

/** Ядро: свежий сид от `now` (в памяти, НЕ пишется в хранилище) с точечными переопределениями из localStorage. */
function buildCoreFromSeedAndOverrides(now: Date, overrides: Partial<CoreData>): CoreData {
  const core: CoreData = { ...emptyCore(), ...seedCore(now) };
  for (const key of CORE_COLLECTIONS) {
    if (overrides[key] !== undefined) (core as unknown as Record<string, unknown>)[key] = overrides[key];
  }
  return core;
}

/** Срезы разделов: свежий seed(core, now) каждого раздела (в памяти) с точечными переопределениями. */
function buildAreasFromSeedAndOverrides(core: CoreData, now: Date, overrides: Partial<Record<AreaId, unknown>>): AreaStates {
  const areas = {} as Record<AreaId, unknown>;
  for (const id of AREA_IDS) {
    areas[id] = overrides[id] !== undefined ? overrides[id] : SLICES[id].seed(core, now);
  }
  return areas as AreaStates;
}

/** Часть состояния, уже «учтённая» — либо выводима из сида заново, либо уже физически лежит под своим ключом.
 * Диф на flush() идёт по ссылкам относительно неё, поэтому переписываются только реально изменившиеся коллекции/срезы. */
let baseline: { core: CoreData; areas: AreaStates; access: DbData['access'] } | undefined;
function setBaseline(state: Pick<DbData, 'core' | 'areas' | 'access'>): void {
  baseline = { core: state.core, areas: state.areas, access: state.access };
}

/** Следующая запись — это сид/досев (данные и так выводимы из seed()+meta.seededAt): просто принять её как
 * новую baseline, ничего не писать на диск. Дергается перед bootDb/resetDemoData раскладывают сид в стор. */
let nextFlushIsDerived = false;
/** Что из сохранённого на диске этот сид заменил: 'all' — полный пересев, список — пересеянные срезы. Их старые
 * ключи надо стереть: иначе при следующем подъёме readSplitState положит их поверх нового сида (так версия сида 12
 * не показывала записи новых мастеров — старый bp-mock-db:core:bookings перекрывал свежие записи). */
let nextFlushClears: 'all' | AreaId[] = [];
function markNextFlushAsDerived(clears: 'all' | AreaId[] = []): void {
  nextFlushIsDerived = true;
  nextFlushClears = clears;
}

function removeKey(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* best-effort */
  }
}

function clearOverrideKeys(clears: 'all' | AreaId[]): void {
  if (clears === 'all') {
    for (const key of CORE_COLLECTIONS) removeKey(coreStorageKey(key));
    for (const id of AREA_IDS) removeKey(areaStorageKey(id));
    removeKey(accessStorageKey());
  } else {
    for (const id of clears) removeKey(areaStorageKey(id));
  }
}

/** Однократный перенос старого монолитного ключа: читаем, раскладываем НАСТОЯЩИЕ отличия от чистого сида
 * по новым ключам (не весь блоб — иначе тот же объём просто переедет под другие имена), remove старого ключа. */
function migrateLegacyBlob(raw: string): StorageValue<DbData> | null {
  let parsed: StorageValue<DbData> | undefined;
  try {
    parsed = JSON.parse(raw) as StorageValue<DbData>;
  } catch (e) {
    console.warn('[mock-db] старый bp-mock-db повреждён, читаю как пустой', e);
  }
  try {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch (e) {
    console.warn('[mock-db] не удалось удалить старый bp-mock-db', e);
  }
  const state = parsed?.state;
  if (!state?.meta) return null;
  const now = state.meta.seededAt ? new Date(state.meta.seededAt) : new Date();
  const freshCore = buildCoreFromSeedAndOverrides(now, {});
  for (const key of CORE_COLLECTIONS) {
    if (!deepEqual(state.core?.[key], freshCore[key])) writeJSON(coreStorageKey(key), state.core?.[key]);
  }
  const freshAreas = buildAreasFromSeedAndOverrides(freshCore, now, {});
  for (const id of AREA_IDS) {
    if (!deepEqual(state.areas?.[id], freshAreas[id])) writeJSON(areaStorageKey(id), state.areas?.[id]);
  }
  const freshAccess: DbData['access'] = { staffPermissions: {} };
  if (!deepEqual(state.access, freshAccess)) writeJSON(accessStorageKey(), state.access);
  writeJSON(metaStorageKey(), state.meta);
  setBaseline(state);
  console.info('[mock-db] перенёс старый общий ключ bp-mock-db на отдельные ключи по коллекциям/срезам');
  return { state, version: parsed?.version ?? STORE_VERSION };
}

/** Собрать DbData из отдельных ключей: meta + сид от meta.seededAt, поверх — то, что реально лежит в localStorage. */
function readSplitState(): StorageValue<DbData> | null {
  const meta = readJSON<DbMeta>(metaStorageKey());
  if (!meta) return null;
  const now = meta.seededAt ? new Date(meta.seededAt) : new Date();
  const coreOverrides: Partial<CoreData> = {};
  for (const key of CORE_COLLECTIONS) {
    const value = readJSON<unknown>(coreStorageKey(key));
    if (value !== undefined) (coreOverrides as Record<string, unknown>)[key] = value;
  }
  const core = buildCoreFromSeedAndOverrides(now, coreOverrides);
  const areaOverrides: Partial<Record<AreaId, unknown>> = {};
  for (const id of AREA_IDS) {
    const value = readJSON<unknown>(areaStorageKey(id));
    if (value !== undefined) areaOverrides[id] = value;
  }
  const areas = buildAreasFromSeedAndOverrides(core, now, areaOverrides);
  const access = readJSON<DbData['access']>(accessStorageKey()) ?? { staffPermissions: {} };
  const state: DbData = { core, areas, access, meta };
  setBaseline(state);
  return { state, version: STORE_VERSION };
}

/**
 * Хранилище больше не сериализует всю базу одним блобом под одним ключом (это и было причиной
 * QuotaExceededError, откатывавшего ЛЮБОЕ сохранение в ЛЮБОМ разделе — qa/requests/*.md, «quota»):
 *   • сид НИКОГДА не пишется на диск — он воспроизводим из seed()/meta.seededAt в памяти при подъёме;
 *   • на диск идут только отдельные ключи по коллекциям ядра (`bp-mock-db:core:<collection>`) и срезам
 *     разделов (`bp-mock-db:area:<area>`), и только когда их содержимое реально изменилось (diff по ссылке
 *     относительно baseline). Промах квоты на одном ключе не трогает остальные — раньше падало ВСЁ разом.
 * Запись всё так же не чаще раза в 400 мс (schedule b03-fix2: серия правок не должна платить сериализацию
 * на каждый set()); JSON.stringify тоже только при сбросе, и только по изменившимся ключам, не по всей базе.
 */
function debouncedLocalStorage(): PersistStorage<DbData> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: DbData | undefined;
  /** Снимок сразу после «выводимой» записи (сид/досев). 01.10.2026 (network): раньше baseline брался из pending —
   *  последнего состояния на момент сброса, и правки первых 400 мс после сида (сеть салона из ensureNetwork,
   *  новый клиент) тоже считались «выводимыми» и НЕ попадали на диск; после перезагрузки они пропадали. */
  let derived: DbData | undefined;
  const flush = () => {
    clearTimeout(timer);
    if (!pending) return;
    const value = pending;
    pending = undefined;
    // meta маленькая (seedVersion/seededAt/sliceVersions/rev) — пишем всегда, от неё зависит подъём при перезагрузке
    writeJSON(metaStorageKey(), value.meta);
    if (nextFlushIsDerived) {
      clearOverrideKeys(nextFlushClears);
      nextFlushIsDerived = false;
      nextFlushClears = [];
      setBaseline(derived ?? value);
      derived = undefined;
      // дальше — обычный дифф: правки, сделанные после сида, пишутся как обычно
    } else if (!baseline) {
      setBaseline(value);
      return;
    }
    const base = baseline!;
    for (const key of CORE_COLLECTIONS) {
      if (value.core[key] !== base.core[key]) writeJSON(coreStorageKey(key), value.core[key]);
    }
    for (const id of AREA_IDS) {
      if (value.areas[id] !== base.areas[id]) writeJSON(areaStorageKey(id), value.areas[id]);
    }
    if (value.access !== base.access) writeJSON(accessStorageKey(), value.access);
    setBaseline(value);
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', flush);
    // Вкладку свернули/закрыли на телефоне — beforeunload там не приходит
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush();
    });
  }
  return {
    getItem: () => {
      let legacyRaw: string | null = null;
      try {
        legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
      } catch (e) {
        console.warn('[mock-db] не удалось прочитать старый bp-mock-db', e);
      }
      if (legacyRaw) return migrateLegacyBlob(legacyRaw);
      return readSplitState();
    },
    setItem: (_name, value) => {
      if (nextFlushIsDerived && !derived) derived = value.state;
      pending = value.state;
      clearTimeout(timer);
      timer = setTimeout(flush, 400);
    },
    removeItem: () => {
      pending = undefined;
      baseline = undefined;
      derived = undefined;
      try {
        localStorage.removeItem(metaStorageKey());
        localStorage.removeItem(accessStorageKey());
        localStorage.removeItem(LEGACY_STORAGE_KEY);
      } catch (e) {
        console.warn('[mock-db] не удалось удалить ключи localStorage', e);
      }
      for (const key of CORE_COLLECTIONS) {
        try {
          localStorage.removeItem(coreStorageKey(key));
        } catch {
          /* best-effort */
        }
      }
      for (const id of AREA_IDS) {
        try {
          localStorage.removeItem(areaStorageKey(id));
        } catch {
          /* best-effort */
        }
      }
    },
  };
}

export const useDb = create<DbState>()(
  persist(
    (set) => ({
      core: emptyCore(),
      areas: {} as AreaStates,
      access: { staffPermissions: {} },
      meta: { seedVersion: 0, seededAt: '', sliceVersions: {}, rev: 0 },

      replaceAll: (data) => set({ ...data, meta: { ...data.meta, rev: data.meta.rev + 1 } }),
      setCore: (recipe) => set((s) => ({ core: recipe(s.core), meta: { ...s.meta, rev: s.meta.rev + 1 } })),
      setArea: (area, recipe) =>
        set((s) => ({
          // Неизменённые поля среза — прежние ссылки (точечное перечитывание по полям среза)
          areas: { ...s.areas, [area]: replaceEqualDeep(s.areas[area], recipe(s.areas[area])) },
          meta: { ...s.meta, rev: s.meta.rev + 1 },
        })),
      setAccess: (recipe) => set((s) => ({ access: recipe(s.access), meta: { ...s.meta, rev: s.meta.rev + 1 } })),
    }),
    {
      name: STORAGE_KEY,
      version: STORE_VERSION,
      storage: typeof window === 'undefined' ? undefined : debouncedLocalStorage(),
      skipHydration: true,
      // Сменилась версия хранилища — старые данные выбрасываем, bootDb засеет заново
      migrate: () => ({}) as DbData,
      partialize: (s): DbData => ({ core: s.core, areas: s.areas, access: s.access, meta: s.meta }),
    },
  ),
);

// ─────────────────────────── Кто что прочитал ───────────────────────────

/** Получатель меток прочитанного (запрос в src/api/request.ts) */
export interface ReadTracker {
  add: (tag: DbTag) => void;
}

/** Состояние как есть — для кода самой базы (сид, подъём), без учёта чтений */
const rawGetState = useDb.getState;

let activeTracker: ReadTracker | undefined;
let fallbackTracker: ReadTracker | undefined;

/**
 * Выполнить fn, записывая, какие части базы она прочитала через useDb.getState()
 * (readCore/readArea/функции api/core). tracker undefined — работает запасной (setFallbackTracker).
 * Вид, полученный внутри fn, помнит своего получателя и после await.
 */
export function runTracked<T>(tracker: ReadTracker | undefined, fn: () => T): T {
  const prev = activeTracker;
  activeTracker = tracker;
  try {
    return fn();
  } finally {
    activeTracker = prev;
  }
}

/** Получатель чтений, случившихся вне runTracked (продолжение после await, чтение вне request) */
export function setFallbackTracker(tracker: ReadTracker | undefined): void {
  fallbackTracker = tracker;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

/**
 * Объект с теми же полями, что obj, но каждое чтение поля отмечает метку prefix+ключ.
 * Геттеры, а не Proxy: вид можно отдать в structuredClone/JSON/спред — они читают все поля.
 */
function trackedRecord<T extends object>(obj: T, prefix: string, tracker: ReadTracker, wrap?: (key: string, value: unknown) => unknown): T {
  const view = {} as T;
  for (const key of Object.keys(obj)) {
    Object.defineProperty(view, key, {
      enumerable: true,
      get() {
        tracker.add(`${prefix}${key}` as DbTag);
        const value = obj[key as keyof T];
        return wrap ? wrap(key, value) : value;
      },
    });
  }
  return view;
}

function trackedState(state: DbState, tracker: ReadTracker): DbState {
  let core: CoreData | undefined;
  let areas: AreaStates | undefined;
  return {
    replaceAll: state.replaceAll,
    setCore: state.setCore,
    setArea: state.setArea,
    setAccess: state.setAccess,
    meta: state.meta,
    get core() {
      return (core ??= trackedRecord(state.core, 'core.', tracker));
    },
    get areas() {
      // Срез раздела — тоже вид: чтение areas.clients.rows отмечает 'areas.clients' и 'areas.clients.rows'
      return (areas ??= trackedRecord(state.areas, 'areas.', tracker, (area, slice) =>
        isPlainObject(slice) ? trackedRecord(slice, `areas.${area}.`, tracker) : slice,
      ));
    },
    get access() {
      tracker.add('access');
      return state.access;
    },
  };
}

// Хук zustand (useDb(selector)) читает состояние через свой store api, а не через это свойство, —
// подмена касается только прямых useDb.getState() в src/api/{core,area}.ts и срезах.
useDb.getState = () => {
  const state = rawGetState();
  if (process.env.NODE_ENV !== 'production' && requestDepth === 0) warnOutsideRequest();
  const tracker = activeTracker ?? fallbackTracker;
  return tracker ? trackedState(state, tracker) : state;
};

// ─────────────────────────── Запрос как транзакция ───────────────────────────

/** Сколько функций request() выполняется сейчас (async-функция — до её завершения) */
let requestDepth = 0;

/** request() сообщает, что его функция начала (+1) и закончила (-1) работу с базой */
export function markRequest(delta: 1 | -1): void {
  requestDepth += delta;
}

const warnedSites = new Set<string>();

/**
 * Чтение или запись базы вне request() (docs/STATE.md): до подъёма базы чтение видит пустые данные, запись
 * не откатится при ошибке и идёт без задержки и режима ошибок «сети», у бэкенда такого не будет вовсе.
 * Одно предупреждение на место вызова.
 */
function warnOutsideRequest(): void {
  const stack = new Error().stack ?? '';
  const site = stack.split('\n').slice(2, 5).join('\n');
  if (warnedSites.has(site)) return;
  warnedSites.add(site);
  console.warn('[mock-db] обращение к базе вне request() — оберните в request(() => …) внутри src/api/<раздел>.ts\n' + site);
}

export interface DbSnapshot {
  core: CoreData;
  areas: AreaStates;
  access: DbData['access'];
}

/** Снимок перед функцией request(): записи неизменяемые, поэтому это просто ссылки — O(1) */
export function snapshotDb(): DbSnapshot {
  const { core, areas, access } = rawGetState();
  return { core, areas, access };
}

/** Откат к снимку, если функция request() упала посередине: половина записи не остаётся в базе */
export function restoreDb(snapshot: DbSnapshot): void {
  const s = rawGetState();
  if (s.core === snapshot.core && s.areas === snapshot.areas && s.access === snapshot.access) return;
  useDb.setState({ ...snapshot, meta: { ...s.meta, rev: s.meta.rev + 1 } });
}

// ─────────────────────────── Что изменилось ───────────────────────────

type DbChangeListener = (tags: ReadonlySet<DbTag>) => void;
const changeListeners = new Set<DbChangeListener>();
let pendingTags: Set<DbTag> | undefined;

/** Ключи, у которых сменилась ссылка (или ключ появился/исчез) */
function changedKeys(next: object, prev: object): string[] {
  const a = next as Record<string, unknown>;
  const b = prev as Record<string, unknown>;
  const out: string[] = [];
  for (const key of Object.keys(a)) if (a[key] !== b[key] || !(key in b)) out.push(key);
  for (const key of Object.keys(b)) if (!(key in a)) out.push(key);
  return out;
}

function changedAreaTags(area: string, next: unknown, prev: unknown, out: Set<DbTag>): void {
  if (!isPlainObject(next) || !isPlainObject(prev)) {
    out.add(`areas.${area}` as DbTag);
    return;
  }
  const nextKeys = Object.keys(next);
  const prevKeys = Object.keys(prev);
  // Набор полей среза поменялся — будим и тех, кто смотрел на срез целиком
  if (nextKeys.length !== prevKeys.length || nextKeys.some((k) => !(k in prev))) out.add(`areas.${area}` as DbTag);
  for (const key of changedKeys(next, prev)) out.add(`areas.${area}.${key}` as DbTag);
}

function flushChanges(): void {
  const tags = pendingTags;
  pendingTags = undefined;
  if (!tags?.size) return;
  for (const listener of changeListeners) {
    try {
      listener(tags);
    } catch (e) {
      console.warn('[mock-db] подписчик изменений упал', e);
    }
  }
}

useDb.subscribe((state, prev) => {
  const changed = new Set<DbTag>();
  if (state.core !== prev.core) for (const key of changedKeys(state.core, prev.core)) changed.add(`core.${key}` as DbTag);
  if (state.areas !== prev.areas) {
    const next = state.areas as Record<string, unknown>;
    const old = prev.areas as Record<string, unknown>;
    for (const area of changedKeys(next, old)) changedAreaTags(area, next[area], old[area], changed);
  }
  if (state.access !== prev.access) changed.add('access');
  if (!changed.size) return;
  if (!pendingTags) {
    pendingTags = new Set();
    // Несколько записей подряд (одна функция api) — одно оповещение
    queueMicrotask(flushChanges);
  }
  for (const tag of changed) pendingTags.add(tag);
});

/**
 * Режим api (docs/backend/PLAN.md §7): данные раздела пришли с сервера и в базе не менялись, но запросы, читавшие
 * эти метки, надо перечитать (после записи на сервер) — то же оповещение, что при записи в базу.
 */
export function notifyDbChange(...tags: DbTag[]): void {
  if (!tags.length) return;
  if (!pendingTags) {
    pendingTags = new Set();
    queueMicrotask(flushChanges);
  }
  for (const tag of tags) pendingTags.add(tag);
}

/** Подписка на изменения базы: слушатель получает метки изменённых коллекций. Возвращает отписку. */
export function onDbChange(listener: DbChangeListener): () => void {
  changeListeners.add(listener);
  return () => {
    changeListeners.delete(listener);
  };
}

// ─────────────────────────── Совместная работа между вкладками (F-01-033) ───────────────────────────
// Одна вкладка пишет запись → localStorage меняется → браузер шлёт 'storage' событие ДРУГИМ вкладкам
// (себе — никогда, это не петля). Подхватываем точечно тот же ключ, что дебаунс-запись только что
// обновила (coreStorageKey/areaStorageKey/accessStorageKey) — так журнал, открытый в другой вкладке,
// видит новую/перенесённую/отменённую запись без перезагрузки (useDb.subscribe выше уже будит те
// запросы, что читали изменившуюся коллекцию). markNextFlushAsDerived — значение и так уже на диске,
// повторно писать его же обратно незачем (тот же приём, что при подъёме сида).
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (!e.key || e.newValue == null) return; // очистку ключа (сброс демо-данных) не подхватываем — вкладка со сбросом перезагружается сама
    const prefix = `${STORAGE_KEY}:`;
    if (!e.key.startsWith(prefix)) return;
    const rest = e.key.slice(prefix.length);
    let value: unknown;
    try {
      value = JSON.parse(e.newValue);
    } catch (err) {
      console.warn('[mock-db] чужая вкладка записала невалидный JSON', err);
      return;
    }
    if (rest === 'access') {
      markNextFlushAsDerived();
      useDb.setState({ access: value as DbData['access'] });
    } else if (rest.startsWith('core:')) {
      const collection = rest.slice('core:'.length) as CoreCollection;
      markNextFlushAsDerived();
      useDb.setState((s) => ({ core: { ...s.core, [collection]: value } }));
    } else if (rest.startsWith('area:')) {
      const area = rest.slice('area:'.length) as AreaId;
      markNextFlushAsDerived();
      useDb.setState((s) => ({ areas: { ...s.areas, [area]: value } }));
    }
    // 'meta' сюда не подхватываем: rev — локальный счётчик этой вкладки, seedVersion/seededAt читаются заново только при подъёме
  });
}

// ─────────────────────────── Готовность базы ───────────────────────────

let resolveReady: () => void = () => {};
const readyPromise: Promise<void> = new Promise((resolve) => {
  resolveReady = resolve;
});

interface DbStatus {
  ready: boolean;
}
export const useDbStatus = create<DbStatus>(() => ({ ready: false }));

/** Ждать, пока база поднята из localStorage (или засеяна). Используется api/client.ts. */
export function dbReady(): Promise<void> {
  return readyPromise;
}

let booting = false;

/**
 * Поднять базу: прочитать localStorage, при необходимости засеять ядро или отдельные срезы.
 * Вызывается один раз из DbBootstrap (src/demo/DemoProvider.tsx).
 */
export async function bootDb(): Promise<void> {
  if (booting) return readyPromise;
  booting = true;
  try {
    await useDb.persist.rehydrate();
  } catch (e) {
    console.warn('[mock-db] не удалось прочитать сохранённые данные, сею заново', e);
  }
  const s = rawGetState();
  const now = new Date();
  const seededAt = s.meta.seededAt ? new Date(s.meta.seededAt) : undefined;
  const stale = !seededAt || now.getTime() - seededAt.getTime() > STALE_AFTER_DAYS * 86_400_000;

  if (s.meta.seedVersion !== SEED_VERSION || stale || s.core.businesses.length === 0) {
    if (s.meta.seedVersion && s.meta.seedVersion !== SEED_VERSION) console.info('[mock-db] версия сида изменилась — пересоздаю демо-данные');
    else if (s.meta.seedVersion && stale) console.info('[mock-db] демо-данные старше 7 дней — пересоздаю');
    markNextFlushAsDerived('all'); // сид воспроизводим из seed()/meta.seededAt — на диск не идёт (qa/requests/*.md, «quota»)
    rawGetState().replaceAll(createSeedData(now));
  } else {
    // Срезы, у которых сменилась версия или которых ещё нет, — пересеять по отдельности
    const outdated = AREA_IDS.filter((id) => s.meta.sliceVersions[id] !== SLICES[id].version || s.areas[id] === undefined);
    if (outdated.length) {
      const areas = { ...s.areas } as Record<AreaId, unknown>;
      const versions = { ...s.meta.sliceVersions };
      for (const id of outdated) {
        areas[id] = SLICES[id].seed(s.core, now);
        versions[id] = SLICES[id].version;
      }
      console.info(`[mock-db] пересоздан срез: ${outdated.join(', ')}`);
      markNextFlushAsDerived(outdated); // пересеянные срезы тоже выводимы из seed() — не персистим
      useDb.setState({ areas: areas as AreaStates, meta: { ...s.meta, sliceVersions: versions, rev: s.meta.rev + 1 } });
    }
    const current = rawGetState();
    const core = fillMissingCore(current);
    if (core) {
      markNextFlushAsDerived(); // досеянные пустые коллекции — не персистим
      useDb.setState({ core, meta: { ...current.meta, rev: current.meta.rev + 1 } });
    }
    whenIdle(() => {
      const latest = rawGetState();
      const areas = fillMissingAreas(latest, new Date(latest.meta.seededAt || Date.now()));
      if (areas) {
        markNextFlushAsDerived();
        useDb.setState({ areas, meta: { ...latest.meta, rev: latest.meta.rev + 1 } });
      }
    });
  }
  useDbStatus.setState({ ready: true });
  resolveReady();
}

/** «Сбросить демо-данные»: всё заново от текущего момента */
export function resetDemoData(): void {
  markNextFlushAsDerived('all'); // новый сид тоже выводим из seed()/meta.seededAt — не персистим целиком
  rawGetState().replaceAll(createSeedData(new Date()));
}
