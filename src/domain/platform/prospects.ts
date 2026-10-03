/**
 * «Места» (03.10.2026) — чистые правила: ключ дедупликации, разбор строки импорта, районы импорта → DistrictId,
 * статус места из визитов, фильтр/сортировка/счётчики, CSV, предзаполнение визита из места.
 * Та же логика на сервере — booktime-backend src/modules/platform/prospects.logic.ts (держать одинаковыми).
 */
import type { DistrictId, SphereId } from '@/domain/core';
import type {
  BookingSystem,
  Prospect,
  ProspectCategory,
  ProspectDistrict,
  ProspectFilter,
  ProspectReviews,
  ProspectSort,
  ProspectStatus,
  Visit,
  VisitInput,
  VisitStatus,
  VisitTool,
} from '@/domain/platform/types';

/** Порядок систем в счётчиках и фильтре: сначала конкуренты-онлайн, в конце «не знаем» */
export const BOOKING_SYSTEMS: BookingSystem[] = [
  'emly',
  'altegio',
  'fresha',
  'dikidi',
  'booksy',
  'own_site',
  'other_online',
  'medical_platform',
  'phone_whatsapp',
  'instagram',
  'unknown',
];

export const PROSPECT_CATEGORIES: ProspectCategory[] = ['beauty', 'nails', 'barber', 'hair', 'brows_lashes', 'cosmetology', 'massage_spa', 'clinic', 'dental', 'other'];

export const PROSPECT_STATUSES: ProspectStatus[] = ['new', 'thinking', 'connected', 'refused', 'live'];

export const PROSPECT_DISTRICTS: ProspectDistrict[] = [
  'kentron',
  'arabkir',
  'davtashen',
  'malatia-sebastia',
  'nor-nork',
  'achapnyak',
  'shengavit',
  'avan',
  'erebuni',
  'kanaker-zeytun',
  'nork-marash',
  'nubarashen',
  'unknown',
];

type ProspectData = Pick<
  Prospect,
  'name' | 'category' | 'district' | 'address' | 'branches' | 'staffEstimate' | 'staffSource' | 'bookingSystem' | 'bookingUrl' | 'website' | 'instagram' | 'phone' | 'reviews' | 'sourceUrls'
>;

// ─────────────────────────── Ключ дедупликации ───────────────────────────

export function normalizeProspectText(s: string | undefined | null): string {
  return (s ?? '')
    .toLowerCase()
    .normalize('NFKC')
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function prospectDedupKey(name: string, address?: string | null): string {
  return `${normalizeProspectText(name)}|${normalizeProspectText(address)}`.slice(0, 255);
}

// ─────────────────────────── Разбор строки импорта ───────────────────────────

const DISTRICT_ALIASES: Record<string, ProspectDistrict> = {
  kentron: 'kentron',
  center: 'kentron',
  arabkir: 'arabkir',
  ajapnyak: 'achapnyak',
  achapnyak: 'achapnyak',
  avan: 'avan',
  davtashen: 'davtashen',
  erebuni: 'erebuni',
  kanaker_zeytun: 'kanaker-zeytun',
  malatia_sebastia: 'malatia-sebastia',
  nork_marash: 'nork-marash',
  nor_nork: 'nor-nork',
  nubarashen: 'nubarashen',
  shengavit: 'shengavit',
};

/** Район импорта (snake_case, «ajapnyak») → DistrictId; неизвестное → unknown */
export function mapImportDistrict(raw: unknown): ProspectDistrict {
  if (typeof raw !== 'string') return 'unknown';
  return DISTRICT_ALIASES[raw.trim().toLowerCase().replace(/[\s-]+/g, '_')] ?? 'unknown';
}

function pickEnum<T extends string>(list: readonly T[], raw: unknown, fallback: T): T {
  if (typeof raw !== 'string') return fallback;
  const key = raw.trim().toLowerCase().replace(/[\s-]+/g, '_');
  return (list as readonly string[]).includes(key) ? (key as T) : fallback;
}

function str(raw: unknown, max: number): string | undefined {
  const v = typeof raw === 'number' ? String(raw) : typeof raw === 'string' ? raw.trim() : '';
  return v ? v.slice(0, max) : undefined;
}

function int(raw: unknown): number | undefined {
  const n = typeof raw === 'string' ? Number(raw.replace(/[^\d.]/g, '')) : raw;
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) return undefined;
  return Math.min(Math.round(n), 100000);
}

export function parseProspectReviews(raw: unknown): ProspectReviews | undefined {
  if (raw === null || raw === undefined || raw === '') return undefined;
  if (typeof raw === 'number') return Number.isFinite(raw) ? { count: Math.max(0, Math.round(raw)) } : undefined;
  if (typeof raw === 'string') return { text: raw.trim().slice(0, 300) };
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    const out: ProspectReviews = {};
    if (typeof o.rating === 'number' && Number.isFinite(o.rating)) out.rating = Math.round(o.rating * 10) / 10;
    const count = int(o.count ?? o.reviews ?? o.total);
    if (count !== undefined) out.count = count;
    const text = str(o.text ?? o.source ?? o.summary, 300);
    if (text !== undefined) out.text = text;
    return Object.keys(out).length ? out : undefined;
  }
  return undefined;
}

function urls(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(/[\s,]+/) : [];
  const out: string[] = [];
  for (const u of list) {
    const v = str(u, 500);
    if (v && !out.includes(v)) out.push(v);
  }
  return out.slice(0, 30);
}

export type ProspectImportParse = { ok: true; data: ProspectData } | { ok: false; reason: 'not_object' | 'name_required' };

export function parseProspectImportRow(raw: unknown): ProspectImportParse {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, reason: 'not_object' };
  const o = raw as Record<string, unknown>;
  const name = str(o.name, 200);
  if (!name) return { ok: false, reason: 'name_required' };
  const data: ProspectData = {
    name,
    category: pickEnum(PROSPECT_CATEGORIES, o.category, 'other'),
    district: mapImportDistrict(o.district),
    bookingSystem: pickEnum(BOOKING_SYSTEMS, o.booking_system ?? o.bookingSystem, 'unknown'),
    sourceUrls: urls(o.source_urls ?? o.sourceUrls),
  };
  const opt: Partial<ProspectData> = {
    address: str(o.address, 300),
    branches: int(o.branches),
    staffEstimate: int(o.staff_estimate ?? o.staffEstimate),
    staffSource: str(o.staff_source ?? o.staffSource, 300),
    bookingUrl: str(o.booking_url ?? o.bookingUrl, 500),
    website: str(o.website, 500),
    instagram: str(o.instagram, 500),
    phone: str(o.phone, 40),
    reviews: parseProspectReviews(o.reviews),
  };
  for (const [k, v] of Object.entries(opt)) if (v !== undefined) (data as unknown as Record<string, unknown>)[k] = v;
  return { ok: true, data };
}

/** Что импорт меняет у известного места: непустое перекрывает, пустое не стирает, источники объединяются */
export function prospectImportPatch(existing: ProspectData, incoming: ProspectData): Partial<ProspectData> {
  const patch: Partial<ProspectData> = {};
  const keys: (keyof ProspectData)[] = ['address', 'branches', 'staffEstimate', 'staffSource', 'bookingUrl', 'website', 'instagram', 'phone'];
  for (const k of keys) {
    const v = incoming[k];
    if (v !== undefined && v !== existing[k]) (patch as Record<string, unknown>)[k] = v;
  }
  if (incoming.category !== 'other' && incoming.category !== existing.category) patch.category = incoming.category;
  if (incoming.district !== 'unknown' && incoming.district !== existing.district) patch.district = incoming.district;
  if (incoming.bookingSystem !== 'unknown' && incoming.bookingSystem !== existing.bookingSystem) patch.bookingSystem = incoming.bookingSystem;
  if (incoming.reviews && JSON.stringify(incoming.reviews) !== JSON.stringify(existing.reviews ?? null)) patch.reviews = incoming.reviews;
  const merged = [...existing.sourceUrls];
  for (const u of incoming.sourceUrls) if (!merged.includes(u)) merged.push(u);
  if (merged.length !== existing.sourceUrls.length) patch.sourceUrls = merged.slice(0, 30);
  return patch;
}

// ─────────────────────────── Статус из визитов ───────────────────────────

type VisitBrief = Pick<Visit, 'id' | 'status' | 'visitedAt' | 'createdAt' | 'businessId'>;

export function prospectStatusFromVisits(visits: readonly VisitBrief[]): { status: ProspectStatus; lastVisit?: { id: string; visitedAt: string; status: VisitStatus }; visitCount: number } {
  if (!visits.length) return { status: 'new', visitCount: 0 };
  const last = [...visits].sort((a, b) => b.visitedAt.localeCompare(a.visitedAt) || b.createdAt.localeCompare(a.createdAt))[0];
  return {
    status: visits.some((v) => v.businessId) ? 'live' : last.status,
    lastVisit: { id: last.id, visitedAt: last.visitedAt, status: last.status },
    visitCount: visits.length,
  };
}

// ─────────────────────────── Фильтр, сортировка, счётчики ───────────────────────────

interface Filterable {
  name: string;
  category: string;
  district: string;
  staffEstimate?: number | null;
  bookingSystem: BookingSystem;
  status: ProspectStatus;
}

export function matchesProspectExceptSystem(p: Filterable, f: ProspectFilter): boolean {
  if (f.category && p.category !== f.category) return false;
  if (f.district && p.district !== f.district) return false;
  if (f.staffMin !== undefined && (p.staffEstimate ?? -1) < f.staffMin) return false;
  if (f.staffMax !== undefined && (p.staffEstimate === null || p.staffEstimate === undefined || p.staffEstimate > f.staffMax)) return false;
  if (f.status && p.status !== f.status) return false;
  const q = normalizeProspectText(f.q);
  if (q && !normalizeProspectText(p.name).includes(q)) return false;
  return true;
}

export function matchesProspect(p: Filterable, f: ProspectFilter): boolean {
  if (f.systems?.length && !f.systems.includes(p.bookingSystem)) return false;
  return matchesProspectExceptSystem(p, f);
}

/** По мастерам — неизвестное число всегда в конце; при равенстве — по имени */
export function sortProspects<T extends { name: string; staffEstimate?: number | null }>(rows: readonly T[], sort: ProspectSort = 'staff_desc'): T[] {
  const byName = (a: T, b: T) => a.name.localeCompare(b.name, 'ru', { sensitivity: 'base', numeric: true });
  return [...rows].sort((a, b) => {
    if (sort === 'name_asc') return byName(a, b);
    if (sort === 'name_desc') return byName(b, a);
    const sa = a.staffEstimate ?? null;
    const sb = b.staffEstimate ?? null;
    if (sa === null && sb === null) return byName(a, b);
    if (sa === null) return 1;
    if (sb === null) return -1;
    return (sort === 'staff_asc' ? sa - sb : sb - sa) || byName(a, b);
  });
}

export function countProspectsBySystem(rows: readonly { bookingSystem: BookingSystem }[]): Record<BookingSystem, number> {
  const out = Object.fromEntries(BOOKING_SYSTEMS.map((s) => [s, 0])) as Record<BookingSystem, number>;
  for (const r of rows) out[r.bookingSystem] += 1;
  return out;
}

// ─────────────────────────── CSV ───────────────────────────

export const PROSPECT_CSV_HEADERS = [
  'name',
  'category',
  'district',
  'address',
  'branches',
  'staff_estimate',
  'staff_source',
  'booking_system',
  'booking_url',
  'website',
  'instagram',
  'phone',
  'reviews',
  'status',
  'last_visit',
  'note',
  'source_urls',
];

/** Строки CSV в порядке PROSPECT_CSV_HEADERS (поля как в импорте + статус и последний визит) */
export function prospectCsvRow(p: ProspectData & { note?: string; status: ProspectStatus; lastVisit?: { visitedAt: string } }): (string | number | undefined)[] {
  const reviews = p.reviews ? [p.reviews.rating, p.reviews.count, p.reviews.text].filter((x) => x !== undefined).join(' · ') : '';
  return [
    p.name,
    p.category,
    p.district,
    p.address,
    p.branches,
    p.staffEstimate,
    p.staffSource,
    p.bookingSystem,
    p.bookingUrl,
    p.website,
    p.instagram,
    p.phone,
    reviews,
    p.status,
    p.lastVisit?.visitedAt,
    p.note,
    p.sourceUrls.join(' '),
  ];
}

// ─────────────────────────── Визит из места ───────────────────────────

const CATEGORY_SPHERE: Record<ProspectCategory, SphereId | undefined> = {
  beauty: 'general',
  nails: 'nails',
  barber: 'barber',
  hair: 'hair',
  brows_lashes: 'cosmetology',
  cosmetology: 'cosmetology',
  massage_spa: 'massage',
  clinic: 'general',
  dental: 'dental',
  other: undefined,
};

const SYSTEM_TOOL: Record<BookingSystem, VisitTool | undefined> = {
  emly: 'emly',
  altegio: 'altegio',
  fresha: 'fresha',
  dikidi: 'dikidi',
  booksy: 'other',
  own_site: 'other',
  other_online: 'other',
  medical_platform: 'other',
  phone_whatsapp: 'whatsapp',
  instagram: 'other',
  unknown: undefined,
};

export const sphereOfProspectCategory = (c: ProspectCategory): SphereId | undefined => CATEGORY_SPHERE[c];
export const visitToolOfBookingSystem = (s: BookingSystem): VisitTool | undefined => SYSTEM_TOOL[s];

/** «Записать визит» из карточки места: название, адрес, район, сфера и чем ведут запись — уже заполнены */
export function visitPrefillFromProspect(p: Pick<Prospect, 'id' | 'name' | 'address' | 'district' | 'category' | 'bookingSystem' | 'phone'>): Partial<VisitInput> {
  return {
    prospectId: p.id,
    placeName: p.name,
    address: p.address,
    phone: p.phone,
    ...(p.district !== 'unknown' ? { district: p.district as DistrictId } : {}),
    sphereId: sphereOfProspectCategory(p.category),
    currentTool: visitToolOfBookingSystem(p.bookingSystem),
  };
}
