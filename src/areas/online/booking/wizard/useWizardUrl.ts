'use client';

import { useSearchParams } from 'next/navigation';
import type { DistrictId, Workplace } from '@/domain/core';

export type Step = 'services' | 'staff' | 'time' | 'details';
export const ANY_STAFF = 'any';

/**
 * Выбор клиента в адресе (О7): каждый шаг — своя запись истории, поэтому жест/кнопка «назад» телефона ведёт на
 * прошлый шаг, а перезагрузка и пересланная ссылка сохраняют выбор. Как у Altegio (o=m…d…s…), только читаемо:
 *   ?step=time&s=svc1,svc2&m=st_ani&d=2026-09-30&t=2026-09-30T11:45&ta=st_ani
 * Имя, телефон и прочие поля формы в адрес не пишем — это личные данные.
 */
export interface WizardUrlState {
  step?: Step;
  /** Смешанная ссылка: что записываем (F-03-082) */
  type?: 'individual' | 'group';
  services: string[];
  pkg?: string;
  /** Мастер на весь визит: id или 'any' */
  staff?: string;
  /** Разные мастера подряд (О4): услуга → мастер или 'any' */
  legStaff: Record<string, string>;
  date?: string;
  /** Начало выбранного окна (с датой — М1) */
  start?: string;
  /** Кто делает каждую часть визита в выбранное окно (для «любого» — назначенный по времени, О8) */
  assigned: string[];
  workplace?: Workplace;
  district?: DistrictId;
}

const STEPS: Step[] = ['services', 'staff', 'time', 'details'];

export function readWizardUrl(sp: Pick<URLSearchParams, 'get'>): WizardUrlState {
  const list = (v: string | null) => (v ? v.split(',').filter(Boolean) : []);
  const step = sp.get('step');
  const type = sp.get('type');
  const legStaff: Record<string, string> = {};
  for (const pair of list(sp.get('mm'))) {
    const [svc, st] = pair.split(':');
    if (svc && st) legStaff[svc] = st;
  }
  // Старые адреса со страницы салона и из кабинета: ?service=…&staff=…&date=…
  const legacyService = sp.get('service');
  return {
    step: STEPS.includes(step as Step) ? (step as Step) : undefined,
    type: type === 'individual' || type === 'group' ? type : undefined,
    services: list(sp.get('s') ?? legacyService),
    pkg: sp.get('pkg') ?? undefined,
    staff: sp.get('m') ?? sp.get('staff') ?? undefined,
    legStaff,
    date: sp.get('d') ?? sp.get('date') ?? undefined,
    start: sp.get('t') ?? undefined,
    assigned: list(sp.get('ta')),
    workplace: (sp.get('wp') as Workplace | null) ?? undefined,
    district: (sp.get('dist') as DistrictId | null) ?? undefined,
  };
}

function writeParams(state: WizardUrlState): URLSearchParams {
  const p = new URLSearchParams();
  if (state.type) p.set('type', state.type);
  if (state.step) p.set('step', state.step);
  if (state.services.length) p.set('s', state.services.join(','));
  if (state.pkg) p.set('pkg', state.pkg);
  if (state.staff) p.set('m', state.staff);
  const mm = Object.entries(state.legStaff).map(([svc, st]) => `${svc}:${st}`);
  if (mm.length) p.set('mm', mm.join(','));
  if (state.date) p.set('d', state.date);
  if (state.start) p.set('t', state.start);
  if (state.assigned.length) p.set('ta', state.assigned.join(','));
  if (state.workplace) p.set('wp', state.workplace);
  if (state.district) p.set('dist', state.district);
  return p;
}

/** Текущий выбор из адреса + запись: push — новый шаг (новая запись истории), replace — правка внутри шага */
export function useWizardUrl() {
  const sp = useSearchParams();
  const state = readWizardUrl(sp);
  const write = (mode: 'push' | 'replace', patch: Partial<WizardUrlState>) => {
    // Свежий адрес, а не значение из рендера: два вызова подряд в одном обработчике не затирают друг друга
    const current = readWizardUrl(new URLSearchParams(window.location.search));
    const next = { ...current, ...patch };
    const qs = writeParams(next).toString();
    const url = `${window.location.pathname}${qs ? `?${qs}` : ''}`;
    if (mode === 'push') window.history.pushState(null, '', url);
    else window.history.replaceState(null, '', url);
  };
  return {
    state,
    push: (patch: Partial<WizardUrlState>) => write('push', patch),
    replace: (patch: Partial<WizardUrlState>) => write('replace', patch),
  };
}
