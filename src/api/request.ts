'use client';

/**
 * Основа API-фасада (фундамент). Все функции src/api/* — async поверх моковой базы с задержкой
 * 150–400 мс, чтобы потом заменить их настоящим бэкендом, не трогая экраны. Подробно — docs/STATE.md.
 *
 *   request(fn)                        — выполнить fn над базой «как сетевой запрос» (задержка, режим ошибок, копия данных)
 *   useApiQuery(key, fetcher, opts)    — чтение: { data, isLoading, isError, error, refetch, isFetching, isPlaceholderData }
 *   useApiMutation(fn, opts)           — запись: { mutate, isPending, error, reset }; mutate бросает ошибку — ловите
 *   patchInList / removeFromList / optimistic — готовые оптимистичные правки для useApiMutation
 *   prefetchApiQuery(key, fetcher)     — заранее положить в кэш (соседний день, следующий шаг)
 *
 * Под капотом TanStack Query v5: один кэш на приложение, одинаковые ключи из разных мест — один запрос,
 * повторный заход на экран — данные сразу из кэша. Перечитывание — ТОЧЕЧНОЕ: каждый запрос помнит, какие
 * коллекции базы прочитал (core.bookings, areas.loyalty…), запись в базу будит только тех, кто читал
 * изменённое. Новые данные сравниваются со старыми по содержимому (structuralSharing): неизменившиеся
 * объекты сохраняют ссылку, и React не перерисовывает то, что не поменялось.
 * Демо ?api=slow — задержка 1,5–2,5 с (видно скелетоны), ?api=error — все запросы падают (видно ErrorState).
 */
import {
  QueryCache,
  QueryClient,
  hashKey,
  useMutation,
  useQuery,
  type QueryKey,
  type UseQueryResult,
} from '@tanstack/react-query';
import { useCallback, useSyncExternalStore } from 'react';
import { useDemoStore } from '@/demo/store';
import type { Id } from '@/domain/core';
import type { Permission } from '@/config/permissions';
import {
  dbReady,
  markRequest,
  onDbChange,
  restoreDb,
  runTracked,
  setFallbackTracker,
  snapshotDb,
  useDbStatus,
  type DbTag,
  type ReadTracker,
} from '@/mock/db';

export class ApiError extends Error {
  readonly code: string;
  constructor(code: string, message?: string) {
    super(message ?? code);
    this.code = code;
    this.name = 'ApiError';
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomBetween(min: number, max: number): number {
  return Math.round(min + Math.random() * (max - min));
}

// Счётчики для замера перерисовок (scripts/renders.mjs): window.__bpApiStats
interface ApiStats {
  requests: number;
  queries: number;
  inflight: number;
}
const stats: ApiStats | undefined =
  typeof window === 'undefined'
    ? undefined
    : ((window as unknown as { __bpApiStats?: ApiStats }).__bpApiStats ??= { requests: 0, queries: 0, inflight: 0 });

// ─────────────────────────── Контекст: чей это вызов ───────────────────────────
// request() запоминает контекст СИНХРОННО в момент вызова: чтение (useApiQuery) — его прочитанное
// станет зависимостями запроса; запись (useApiMutation) — прочитанное не нужно. Вызов без контекста
// (продолжение после await в функции чтения, прямой вызов api из обработчика) — прочитанное
// засчитывается ВСЕМ идущим сейчас чтениям: лишний раз перечитать можно, пропустить — нельзя.

interface QueryCtx extends ReadTracker {
  kind: 'query';
  hash: string;
  deps: Set<DbTag>;
}
interface MutationCtx extends ReadTracker {
  kind: 'mutation';
}
type Ctx = QueryCtx | MutationCtx;

const MUTATION_CTX: MutationCtx = { kind: 'mutation', add: () => {} };
let currentCtx: Ctx | undefined;
const openQueries = new Set<QueryCtx>();
const orphanTracker: ReadTracker = {
  add: (tag) => {
    for (const ctx of openQueries) ctx.deps.add(tag);
  },
};

function withCtx<T>(ctx: Ctx | undefined, fn: () => T): T {
  const prev = currentCtx;
  currentCtx = ctx;
  try {
    return fn();
  } finally {
    currentCtx = prev;
  }
}

function syncFallback(): void {
  setFallbackTracker(openQueries.size ? orphanTracker : undefined);
}

/**
 * Режим api: чтение с сервера объявляет, от каких меток базы оно зависит (зеркало ядра, срез раздела) — запись
 * по этим меткам (notifyDbChange, зеркало) перечитает его. Звать СИНХРОННО, до первого await функции чтения.
 */
export function trackRead(...tags: DbTag[]): void {
  const ctx = currentCtx;
  if (ctx?.kind !== 'query') return;
  for (const tag of tags) ctx.add(tag);
}

export interface RequestOptions {
  /** Право, без которого «сервер» ответит ApiError('forbidden') (проверка — assertCan ядра) */
  permission?: Permission;
}

function isPromiseLike<T>(value: T | Promise<T>): value is Promise<T> {
  return typeof (value as { then?: unknown } | null)?.then === 'function';
}

/**
 * Выполнить функцию над моковой базой как «сетевой запрос». Результат — глубокая копия.
 * Функция — транзакция: упала посередине (throw) — все её записи откатываются (синхронная функция;
 * в async-функции между await пишут и другие запросы, её откатить нельзя — поэтому одна операция = один
 * синхронный request(), см. docs/ARCHITECTURE.md §4).
 */
export async function request<T>(fn: () => T | Promise<T>, options?: RequestOptions): Promise<T> {
  const ctx = currentCtx; // до первого await — это ещё синхронная часть вызова
  if (stats) {
    stats.requests++;
    stats.inflight++;
  }
  try {
    await dbReady();
    const mode = useDemoStore.getState().api;
    // Обычный режим — как быстрый сервер (owner 29.09.2026: «всё должно работать очень быстро»; было 150–400 мс, а
    // экраны с цепочкой запросов копили задержку до секунды). Медленную сеть проверяют режимом ?api=slow
    await sleep(mode === 'slow' ? randomBetween(1500, 2500) : randomBetween(40, 120));
    if (mode === 'error') throw new ApiError('demo_error', 'Демо-режим: сервер вернул ошибку');
    // Ядро импортирует этот файл — берём проверку прав лениво, без цикла при загрузке модулей
    const assertCan = options?.permission ? (await import('@/api/core')).assertCan : undefined;
    const run = () => {
      if (assertCan && options?.permission) assertCan(options.permission);
      return fn();
    };
    const snapshot = snapshotDb();
    markRequest(1);
    let result: T | Promise<T>;
    try {
      result = withCtx(ctx, () => runTracked(ctx, run));
    } catch (error) {
      markRequest(-1);
      restoreDb(snapshot);
      throw error;
    }
    let value: T;
    if (isPromiseLike(result)) {
      try {
        value = await result;
      } finally {
        markRequest(-1);
      }
    } else {
      markRequest(-1);
      value = result;
    }
    return value === undefined ? value : structuredClone(value);
  } finally {
    if (stats) stats.inflight--;
  }
}

/**
 * Синхронная запись в базу там, где ждать задержку «сети» нельзя: сохранить черновик при закрытии окна (unmount),
 * journal b04-fix2. Как request() — транзакция (упала — откат) и без предупреждения «вне request()», но без задержки,
 * демо-режимов и копии результата. Звать ТОЛЬКО из src/api/<раздел>.ts; обычные операции — request().
 *   export function flushDraftSync(d: Draft) { requestSync(() => mutateArea('journal', (s) => { s.draft = d; })); }
 */
export function requestSync<T>(fn: () => T): T {
  if (!useDbStatus.getState().ready) throw new ApiError('not_ready', 'База ещё не поднята');
  const snapshot = snapshotDb();
  markRequest(1);
  try {
    return withCtx(MUTATION_CTX, () => runTracked(MUTATION_CTX, fn));
  } catch (error) {
    restoreDb(snapshot);
    throw error;
  } finally {
    markRequest(-1);
  }
}

/**
 * Моковая реализация из отдельного куска (ленивый import): публичные страницы в режиме api не тянут код мока и
 * кабинета — лёгкий модуль (`src/api/*-public.ts`) зовёт сервер сам, а в демо догружает полный модуль раздела.
 * Контекст вызова (чьё это чтение) сохраняется — request() внутри мока видит его, как при прямом вызове.
 *   export function getX(id: Id) {
 *     if (isApiMode()) return S.getXServer(id);
 *     return viaMock(() => import('@/api/area'), (m) => m.getXMock(id));
 *   }
 */
export function viaMock<M, T>(load: () => Promise<M>, call: (mod: M) => Promise<T>): Promise<T> {
  const ctx = currentCtx;
  return load().then((mod) => withCtx(ctx, () => call(mod)));
}

// ─────────────────────────── Кэш и точечное перечитывание ───────────────────────────

/** Зависимости по хэшу ключа: последнее удачное чтение ∪ идущее сейчас */
const depsByHash = new Map<string, Set<DbTag>>();
const fetchSeq = new Map<string, number>();
/** Запросы, для которых идёт оптимистичная запись: перечитываем их после её завершения */
const optimisticLocks = new Map<string, number>();
const deferredHashes = new Set<string>();

/**
 * TanStack Query не хранит undefined как данные («Query data cannot be undefined» — запрос падал бы
 * в ошибку), а у нас функция чтения законно отвечает «ничего нет» (loadDraft, findClientByPhone).
 * В кэше такое «ничего» — этот знак; наружу из useApiQuery оно снова выходит как undefined.
 */
const NO_DATA: unique symbol = Symbol('no-data');
type Stored<T> = T | typeof NO_DATA;

function fromStored<T>(value: Stored<T> | undefined): T | undefined {
  return value === NO_DATA ? undefined : value;
}

function runQuery<T>(hash: string, fetcher: () => Promise<T>): Promise<Stored<T>> {
  const ctx: QueryCtx = {
    kind: 'query',
    hash,
    deps: new Set(),
    add(tag) {
      this.deps.add(tag);
    },
  };
  const seq = (fetchSeq.get(hash) ?? 0) + 1;
  fetchSeq.set(hash, seq);
  openQueries.add(ctx);
  syncFallback();
  if (stats) stats.queries++;
  let promise: Promise<T>;
  try {
    promise = withCtx(ctx, () => runTracked(ctx, fetcher));
  } catch (error) {
    promise = Promise.reject(error);
  }
  const settle = (ok: boolean) => {
    openQueries.delete(ctx);
    syncFallback();
    if (fetchSeq.get(hash) !== seq) return; // уже идёт более новое чтение этого ключа
    const prev = depsByHash.get(hash);
    // Удача — зависимости ровно прочитанное; ошибка (например, демо-режим до чтения) — не теряем старые
    depsByHash.set(hash, ok || !prev ? ctx.deps : new Set([...prev, ...ctx.deps]));
  };
  return promise.then(
    (data): Stored<T> => {
      settle(true);
      return data === undefined ? NO_DATA : data;
    },
    (error: unknown) => {
      settle(false);
      throw error;
    },
  );
}

function touches(deps: ReadonlySet<DbTag> | undefined, tags: ReadonlySet<DbTag>): boolean {
  if (!deps) return false;
  for (const tag of tags) if (deps.has(tag)) return true;
  return false;
}

function invalidateHashes(client: QueryClient, hashes: ReadonlySet<string>): void {
  if (!hashes.size) return;
  void client.invalidateQueries({ predicate: (q) => hashes.has(q.queryHash) });
}

function handleDbChange(tags: ReadonlySet<DbTag>): void {
  const client = browserClient;
  if (!client) return;
  const hit = new Set<string>();
  for (const [hash, deps] of depsByHash) if (touches(deps, tags)) hit.add(hash);
  // Идущее чтение уже успело прочитать изменённое — его результат устарел
  for (const ctx of openQueries) if (touches(ctx.deps, tags)) hit.add(ctx.hash);
  for (const hash of hit) {
    if (optimisticLocks.has(hash)) {
      hit.delete(hash);
      deferredHashes.add(hash);
    }
  }
  invalidateHashes(client, hit);
}

const LOG_ERRORS = true;

function makeQueryClient(): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        if (LOG_ERRORS) console.warn('[api] запрос не удался', JSON.stringify(query.queryKey), error);
      },
    }),
    defaultOptions: {
      queries: {
        // Перечитывание по записи — точечное (выше), поэтому данные в кэше свежие; минута — запас
        // для того, что зависит от времени (свободные окна «сейчас»): повторный заход через минуту перечитает.
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        // Моковая база живёт в браузере — от navigator.onLine не зависит
        networkMode: 'always',
        // ApiError — ответ «сервера» (демо-ошибка, not_found…): повтор не поможет, ErrorState сразу
        retry: (failureCount, error) => !(error instanceof ApiError) && useDemoStore.getState().api !== 'error' && failureCount < 1,
      },
      mutations: { networkMode: 'always', retry: false },
    },
  });
}

let browserClient: QueryClient | undefined;

/** Один QueryClient на вкладку браузера (на сервере — новый на каждый рендер). */
export function getQueryClient(): QueryClient {
  if (typeof window === 'undefined') return makeQueryClient();
  if (!browserClient) {
    browserClient = makeQueryClient();
    const client = browserClient;
    client.getQueryCache().subscribe((event) => {
      if (event.type === 'removed') {
        depsByHash.delete(event.query.queryHash);
        fetchSeq.delete(event.query.queryHash);
      }
    });
    onDbChange(handleDbChange);
    // Смена режима ответов в демо-панели (normal/slow/error) — всё заново: видно скелетоны или ErrorState
    let mode = useDemoStore.getState().api;
    let location = useDemoStore.getState().locationId;
    useDemoStore.subscribe((s) => {
      if (s.locationId !== location) {
        location = s.locationId;
        scopeSwitchedAt = Date.now();
      }
      if (s.api === mode) return;
      mode = s.api;
      if (useDbStatus.getState().ready) void client.resetQueries();
    });
  }
  return browserClient;
}

// ─────────────────────────── Чтение ───────────────────────────

const noopSubscribe = () => () => {};

/**
 * false — идёт гидратация (первая отрисовка поверх серверного HTML), true — после неё и при переходах по страницам.
 * На сервере данных нет — там всегда скелетон; если к гидратации кэш уже с данными (соседний блок успел прочитать),
 * показ данных в этом кадре разошёлся бы с HTML сервера («Hydration failed», online b04-fix2). React сам перерисует
 * с true сразу после гидратации.
 */
function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

export interface QueryResult<T> {
  data: T | undefined;
  /** Первая загрузка по этому ключу — показывайте скелетон */
  isLoading: boolean;
  /** Идёт любое чтение (в том числе тихое перечитывание после записи) */
  isFetching: boolean;
  isError: boolean;
  error: unknown;
  /** data — прежние данные другого ключа, новые ещё грузятся (можно приглушить список) */
  isPlaceholderData: boolean;
  refetch: () => void;
}

export interface QueryOptions<T = never> {
  enabled?: boolean;
  /**
   * При смене ключа показывать прежние данные, пока грузятся новые (без скелетона).
   * По умолчанию — да, если в ключе поменялись только параметры вида: дата 'YYYY-MM-DD', число,
   * объект фильтров, текст поиска (с пробелом или не латиницей), true/false. Сменился id или имя
   * ресурса — нет (прежние данные чужой сущности показывать нельзя). Явное значение важнее правила.
   */
  keepPrevious?: boolean;
  /**
   * Данные, известные заранее, того же вида, что вернёт fetcher (строка списка → карточка): экран рисует их сразу,
   * без скелетона, а запрос перечитывает их в фоне. Берутся, только если в кэше по ключу ещё ничего нет.
   * Функция зовётся один раз на ключ. Другой вид данных — положите их под свой ключ через seedApiQuery.
   *   useApiQuery(['staff', 'one', id], () => getStaff(id), { initialData: () => listRow(id) })
   */
  initialData?: T | (() => T | undefined);
}

const DATE_LIKE = /^\d{4}-\d{2}-\d{2}/;
const SEARCH_LIKE = /\s|[^\u0000-\u007f]/;

function isViewParam(value: unknown): boolean {
  if (typeof value === 'number' || typeof value === 'boolean') return true;
  if (typeof value === 'string') return DATE_LIKE.test(value) || value === '' || SEARCH_LIKE.test(value);
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Смена филиала в верхней полосе (Сеть8): ключи экранов меняют id бизнеса/филиала/сотрудников, и по правилу ниже
 * это «чужая сущность» — экран на секунду-две уходил в скелетоны. Сразу после смены филиала тот же ресурс того же
 * экрана (совпадают раздел и имя ресурса) держит прежние данные, пока грузятся новые: это данные своего кабинета,
 * они просто заменятся. Окно короткое — дальше снова действует обычное правило.
 */
const SCOPE_SWITCH_WINDOW_MS = 6000;
let scopeSwitchedAt = 0;

/** Сразу после смены филиала: тот же раздел и тот же ресурс — держим прежние данные (сильнее и явного keepPrevious: false) */
function keepsOnScopeSwitch(prevKey: QueryKey, nextKey: readonly unknown[]): boolean {
  return (
    Date.now() - scopeSwitchedAt < SCOPE_SWITCH_WINDOW_MS &&
    prevKey.length === nextKey.length &&
    prevKey[0] === nextKey[0] &&
    (nextKey.length < 2 || hashKey([prevKey[1]]) === hashKey([nextKey[1]]))
  );
}

function keepsPrevious(prevKey: QueryKey, nextKey: readonly unknown[]): boolean {
  if (prevKey.length !== nextKey.length) return false;
  for (let i = 0; i < nextKey.length; i++) {
    const a = prevKey[i];
    const b = nextKey[i];
    if (a === b || hashKey([a]) === hashKey([b])) continue;
    if (!isViewParam(a) || !isViewParam(b)) return false;
  }
  return true;
}

/**
 * Результат с ленивыми полями: TanStack перерисует компонент только при смене того, что он читал.
 * dbReady=false — база ещё поднимается: даже выключенный запрос (`enabled: ready`) отвечает isLoading=true,
 * иначе экран на первом кадре рисует «пусто» и счётчики «0» (ux-platform U-8).
 */
function lazyResult<T>(q: UseQueryResult<Stored<T>, unknown>, enabled: boolean, dbReady: boolean, refetch: () => void): QueryResult<T> {
  return {
    get data() {
      return enabled ? fromStored(q.data) : undefined;
    },
    get isLoading() {
      return enabled ? q.isPending : !dbReady;
    },
    get isFetching() {
      return enabled && q.isFetching;
    },
    get isError() {
      return enabled && q.isError;
    },
    get error() {
      return enabled ? (q.error ?? undefined) : undefined;
    },
    get isPlaceholderData() {
      return enabled && q.isPlaceholderData;
    },
    refetch,
  };
}

/**
 * Чтение данных. key — массив, от которого зависит результат; первым элементом — имя раздела:
 *   const q = useApiQuery(['journal', 'bookings', businessId, date], () => listBookings({ businessId, from: date, to: date }),
 *                         { enabled: Boolean(businessId) });
 * Один ключ — одни данные во всём приложении (кэш общий): одинаковый ключ из двух мест = одна функция чтения.
 */
export function useApiQuery<T>(key: readonly unknown[], fetcher: () => Promise<T>, options?: QueryOptions<NoInfer<T>>): QueryResult<T> {
  const enabled = options?.enabled ?? true;
  const keep = options?.keepPrevious;
  const initial = options?.initialData;
  const hydrated = useHydrated();
  const dbReady = useDbStatus((s) => s.ready) && hydrated;
  // Клиент передаём явно: хук работает и без QueryClientProvider (он в src/app/providers.tsx — для devtools)
  const q = useQuery<Stored<T>, unknown, Stored<T>, readonly unknown[]>(
    {
      queryKey: key,
      queryFn: ({ queryKey }) => runQuery(hashKey(queryKey), fetcher),
      enabled,
      // Известное заранее — как устаревшее (updatedAt 0): показать сразу и перечитать в фоне
      ...(initial !== undefined && {
        initialData: () => {
          const v = typeof initial === 'function' ? (initial as () => T | undefined)() : initial;
          return v === undefined ? undefined : (v as Stored<T>);
        },
        initialDataUpdatedAt: 0,
      }),
      placeholderData: (previous, previousQuery) =>
        previousQuery && (keepsOnScopeSwitch(previousQuery.queryKey, key) || (keep ?? keepsPrevious(previousQuery.queryKey, key)))
          ? previous
          : undefined,
    },
    getQueryClient(),
  );
  // Одна и та же функция между рендерами (q.refetch у TanStack постоянна): обработчики с `x.refetch()` не меняются
  // на каждый ответ «сети», и React Compiler не перерисовывает из-за них соседние зоны (окно записи журнала).
  // Уже идёт чтение (например, после записи) — присоединяемся к нему, а не начинаем заново.
  const qRefetch = q.refetch;
  const refetch = useCallback(() => {
    void qRefetch({ cancelRefetch: false });
  }, [qRefetch]);
  return lazyResult(q, enabled && hydrated, dbReady, refetch);
}

/**
 * Заранее положить данные в кэш — соседний день журнала, следующий шаг записи: потом экран покажет их
 * сразу, без скелетона. Звать из обработчика или эффекта (не в рендере). Свежие данные не перечитывает.
 *   useEffect(() => { prefetchApiQuery(['journal', 'bookings', businessId, next], () => listBookings({ … })); }, [next]);
 */
export function prefetchApiQuery<T>(key: readonly unknown[], fetcher: () => Promise<T>): void {
  void getQueryClient().prefetchQuery({ queryKey: key, queryFn: ({ queryKey }) => runQuery(hashKey(queryKey), fetcher) });
}

/**
 * Положить в кэш данные, которые уже есть на экране (строка списка → карточка клиента): следующий экран рисует их
 * сразу, без скелетона, и сам перечитывает в фоне (данные помечены устаревшими). Уже есть свои — не трогает.
 *   seedApiQuery(['clients', 'row', …], row); router.push(`/biz/clients/${row.id}`);
 */
export function seedApiQuery<T>(key: readonly unknown[], data: T): void {
  const client = getQueryClient();
  if (client.getQueryData(key) !== undefined) return;
  client.setQueryData(key, data, { updatedAt: 0 });
}

/** Сколько держать курсор на строке, прежде чем подгружать (мышь просто проходит мимо — не грузим), мс */
const HOVER_PREFETCH_DELAY_MS = 120;
const hoverTimers = new Map<string, ReturnType<typeof setTimeout>>();

export interface PrefetchHandlers {
  onPointerEnter: () => void;
  onPointerLeave: () => void;
  onFocus: () => void;
  onTouchStart: () => void;
}

/**
 * Подгрузить карточку, пока человек наводит курсор на строку списка (или ставит на неё палец/фокус): к нажатию
 * данные уже в кэше, и следующий экран без скелетона. Обработчики — на строку или ссылку:
 *   <tr {...prefetchOnHover(['staff', 'one', row.id], () => getStaff(row.id))}>
 * Касание и фокус — сразу, мышь — после короткой задержки. Свежие данные не перечитывает (как prefetchApiQuery).
 * Вместе с seedApiQuery: seed кладёт то, что уже есть в строке, prefetch — остальное.
 */
export function prefetchOnHover<T>(key: readonly unknown[], fetcher: () => Promise<T>, delayMs = HOVER_PREFETCH_DELAY_MS): PrefetchHandlers {
  const hash = hashKey(key);
  const cancel = () => {
    clearTimeout(hoverTimers.get(hash));
    hoverTimers.delete(hash);
  };
  const now = () => {
    cancel();
    prefetchApiQuery(key, fetcher);
  };
  return {
    onPointerEnter: () => {
      cancel();
      hoverTimers.set(hash, setTimeout(now, delayMs));
    },
    onPointerLeave: cancel,
    onFocus: now,
    onTouchStart: now,
  };
}

// ─────────────────────────── Оптимистичные правки ───────────────────────────

type KeyOf<A> = readonly unknown[] | ((args: A) => readonly unknown[]);

/** Оптимистичная правка: все запросы с этим НАЧАЛОМ ключа сразу получают update(старое), до ответа «сервера». */
export interface Optimistic<A> {
  key: KeyOf<A>;
  /** Чистая функция: новые данные запроса из старых. Старых нет — не вызывается. */
  update: (old: unknown, args: A) => unknown;
}

/** Своя оптимистичная правка с типом данных: optimistic<Booking[], Args>(['journal', 'bookings'], (list, a) => …) */
export function optimistic<T, A>(key: KeyOf<A>, update: (old: T, args: A) => T): Optimistic<A> {
  return { key, update: (old, args) => update(old as T, args) };
}

function hasId(value: unknown): value is { id: Id } {
  return typeof value === 'object' && value !== null && 'id' in value;
}

/**
 * Поменять поля элемента по id во всех запросах с этим началом ключа. Данные запроса — массив
 * элементов с id или сам элемент с id; остальное не трогается.
 *   useApiMutation(({ id, status }) => setBookingStatus(id, status), {
 *     optimistic: patchInList(['journal', 'bookings'], ({ id, status }) => ({ id, patch: { status } })),
 *   });
 */
export function patchInList<A, P extends object = Record<string, unknown>>(
  key: KeyOf<A>,
  pick: (args: A) => { id: Id; patch: P },
): Optimistic<A> {
  return {
    key,
    update: (old, args) => {
      const { id, patch } = pick(args);
      if (Array.isArray(old)) {
        let changed = false;
        const next = old.map((item: unknown) => {
          if (!hasId(item) || item.id !== id) return item;
          changed = true;
          return { ...item, ...patch };
        });
        return changed ? next : old;
      }
      return hasId(old) && old.id === id ? { ...old, ...patch } : old;
    },
  };
}

/** Убрать элемент по id из списков во всех запросах с этим началом ключа */
export function removeFromList<A>(key: KeyOf<A>, pickId: (args: A) => Id): Optimistic<A> {
  return {
    key,
    update: (old, args) => {
      if (!Array.isArray(old)) return old;
      const id = pickId(args);
      const next = old.filter((item: unknown) => !hasId(item) || item.id !== id);
      return next.length === old.length ? old : next;
    },
  };
}

// ─────────────────────────── Запись ───────────────────────────

export interface MutationResult<A, R> {
  /** Выполнить. Бросает ошибку — оборачивайте в try/catch и показывайте toast. */
  mutate: (args: A) => Promise<R>;
  isPending: boolean;
  error: unknown;
  reset: () => void;
}

export interface MutationOptions<A> {
  /**
   * Сразу показать результат: правка данных запросов до ответа; ошибка — откат к прежнему.
   * Готовые: patchInList, removeFromList; своя — optimistic(key, update).
   */
  optimistic?: Optimistic<A> | Optimistic<A>[];
  /**
   * Дополнительно перечитать запросы с этими началами ключей после удачной записи. Обычно не нужно:
   * перечитываются сами все запросы, читавшие изменённые коллекции.
   */
  invalidates?: readonly (readonly unknown[])[] | ((args: A) => readonly (readonly unknown[])[]);
}

interface MutationContext {
  snapshots: [QueryKey, unknown][];
  locked: string[];
}

function keyFor<A>(key: KeyOf<A>, args: A): readonly unknown[] {
  return typeof key === 'function' ? key(args) : key;
}

export function useApiMutation<A, R>(fn: (args: A) => Promise<R>, options?: MutationOptions<A>): MutationResult<A, R> {
  const client = getQueryClient();
  const list = options?.optimistic ? (Array.isArray(options.optimistic) ? options.optimistic : [options.optimistic]) : [];
  const invalidates = options?.invalidates;
  const m = useMutation<R, unknown, A, MutationContext | undefined>(
    {
      mutationFn: (args) => withCtx(MUTATION_CTX, () => fn(args)),
      onMutate: async (args) => {
        if (!list.length) return undefined;
        const snapshots: [QueryKey, unknown][] = [];
        const locked: string[] = [];
        for (const o of list) {
          const queryKey = keyFor(o.key, args);
          // Идущее чтение вернуло бы данные ДО записи и затёрло бы правку
          await client.cancelQueries({ queryKey });
          for (const query of client.getQueryCache().findAll({ queryKey })) {
            if (query.state.data === undefined || query.state.data === NO_DATA) continue;
            snapshots.push([query.queryKey, query.state.data]);
            locked.push(query.queryHash);
            optimisticLocks.set(query.queryHash, (optimisticLocks.get(query.queryHash) ?? 0) + 1);
            client.setQueryData(query.queryKey, o.update(query.state.data, args));
          }
        }
        return { snapshots, locked };
      },
      onError: (_error, _args, context) => {
        for (const [queryKey, data] of context?.snapshots ?? []) client.setQueryData(queryKey, data);
      },
      onSuccess: (_data, args) => {
        const keys = typeof invalidates === 'function' ? invalidates(args) : invalidates;
        for (const queryKey of keys ?? []) void client.invalidateQueries({ queryKey });
      },
      onSettled: (_data, _error, _args, context) => {
        if (!context) return;
        const toRefresh = new Set<string>();
        for (const hash of context.locked) {
          const left = (optimisticLocks.get(hash) ?? 1) - 1;
          if (left > 0) optimisticLocks.set(hash, left);
          else optimisticLocks.delete(hash);
          // Сверить правку с тем, что записала база (structuralSharing: совпало — перерисовки не будет)
          if (left <= 0) toRefresh.add(hash);
        }
        for (const hash of deferredHashes) {
          if (optimisticLocks.has(hash)) continue;
          deferredHashes.delete(hash);
          toRefresh.add(hash);
        }
        invalidateHashes(client, toRefresh);
      },
    },
    client,
  );
  return { mutate: m.mutateAsync, isPending: m.isPending, error: m.error ?? undefined, reset: m.reset };
}
