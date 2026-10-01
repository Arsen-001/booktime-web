/**
 * Подсказки услуг по сфере для шага 1 быстрого старта (F-15-018) — нажатием заполняет форму, можно править
 * дальше. Не «услуги сферы» из ядра (их нет, справочник шаблонов — наш, только для этого экрана). Принадлежит
 * разделу settings.
 */
import type { SphereId } from '@/domain/core';

export interface QuickStartServiceTemplate {
  id: string;
  /** Ключ названия в settings.json → quickStart.template.<sphereId>.<id> */
  nameKey: string;
  priceMin: number;
  durationMin: 30 | 60 | 90;
}

const NAILS: QuickStartServiceTemplate[] = [
  { id: 'manicure', nameKey: 'manicure', priceMin: 6000, durationMin: 60 },
  { id: 'pedicure', nameKey: 'pedicure', priceMin: 8000, durationMin: 90 },
];
const BARBER: QuickStartServiceTemplate[] = [
  { id: 'haircut', nameKey: 'haircut', priceMin: 4000, durationMin: 30 },
  { id: 'beard', nameKey: 'beard', priceMin: 3000, durationMin: 30 },
];
const HAIR: QuickStartServiceTemplate[] = [
  { id: 'haircut', nameKey: 'haircut', priceMin: 5000, durationMin: 60 },
  { id: 'coloring', nameKey: 'coloring', priceMin: 15000, durationMin: 90 },
];
const COSMETOLOGY: QuickStartServiceTemplate[] = [
  { id: 'facial', nameKey: 'facial', priceMin: 12000, durationMin: 60 },
];
const MASSAGE: QuickStartServiceTemplate[] = [
  { id: 'massage', nameKey: 'massage', priceMin: 10000, durationMin: 60 },
];
const DENTAL: QuickStartServiceTemplate[] = [
  { id: 'checkup', nameKey: 'checkup', priceMin: 5000, durationMin: 30 },
];
const FITNESS: QuickStartServiceTemplate[] = [
  { id: 'personal', nameKey: 'personal', priceMin: 8000, durationMin: 60 },
];
const CARWASH: QuickStartServiceTemplate[] = [
  { id: 'wash', nameKey: 'wash', priceMin: 5000, durationMin: 60 },
];
const GENERAL: QuickStartServiceTemplate[] = [
  { id: 'service', nameKey: 'service', priceMin: 5000, durationMin: 60 },
];

export const QUICK_START_TEMPLATES: Record<SphereId, QuickStartServiceTemplate[]> = {
  nails: NAILS,
  barber: BARBER,
  hair: HAIR,
  cosmetology: COSMETOLOGY,
  massage: MASSAGE,
  dental: DENTAL,
  fitness: FITNESS,
  carwash: CARWASH,
  general: GENERAL,
};
