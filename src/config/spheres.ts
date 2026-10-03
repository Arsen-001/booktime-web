import type { SphereId } from '@/domain/core';

/**
 * Сферы и их функции (F-00-145…F-00-148). У каждой сферы только свои функции:
 * раздел проверяет useSphere().has('palette') и т. п., меню скрывает пункты по hiddenInSpheres.
 */
export type SphereFeature =
  /** Выбор оттенка/варианта при записи, палитра клиента (F-00-094, F-00-143) */
  | 'palette'
  /** План лечения из нескольких визитов (F-00-150) */
  | 'treatmentPlan'
  /** Медкарта, медицинские документы в визите */
  | 'medicalRecords'
  /** Групповые занятия и события */
  | 'groups'
  /** Онлайн-занятия (ссылка на звонок) */
  | 'onlineSessions'
  /** Выезд к клиенту (F-00-078) */
  | 'homeVisit'
  /** Приём дома (F-00-077) */
  | 'atHome'
  /** Стерилизация инструментов (F-00-090) */
  | 'sterilization'
  /** Склад, расходники, техкарты */
  | 'stock'
  /** Ресурсы: кресла, кабинеты, аппараты, боксы (F-00-149) */
  | 'resources'
  /** Авто клиента: марка, номер (мойка) */
  | 'vehicle'
  /** Запись ребёнка или питомца (F-00-125) */
  | 'dependents'
  /** ⭐ Заказы: приём вещи/техники, статусы, «Готово» клиенту и публичная ссылка (03.10.2026) — включены по умолчанию */
  | 'orders';

export interface SphereConfig {
  id: SphereId;
  /** Иконка lucide (имя компонента) — см. src/shell/icons.ts */
  icon: string;
  features: SphereFeature[];
  /** Ключ набора слов в common.terms.<terms> (F-00-148) */
  terms: 'default' | 'medical' | 'fitness' | 'carwash' | 'barber';
}

export const SPHERE_IDS: SphereId[] = [
  'nails',
  'barber',
  'hair',
  'cosmetology',
  'massage',
  'dental',
  'fitness',
  'carwash',
  'tailor',
  'repair',
  'drycleaning',
  'detailing',
  'general',
];

export const SPHERES: Record<SphereId, SphereConfig> = {
  nails: {
    id: 'nails',
    icon: 'Sparkles',
    features: ['palette', 'homeVisit', 'atHome', 'sterilization', 'stock', 'resources', 'dependents'],
    terms: 'default',
  },
  barber: {
    id: 'barber',
    icon: 'Scissors',
    features: ['sterilization', 'stock', 'resources', 'dependents'],
    terms: 'barber',
  },
  hair: {
    id: 'hair',
    icon: 'Wind',
    features: ['palette', 'homeVisit', 'atHome', 'stock', 'resources', 'dependents'],
    terms: 'default',
  },
  cosmetology: {
    id: 'cosmetology',
    icon: 'Flower2',
    features: ['palette', 'medicalRecords', 'atHome', 'sterilization', 'stock', 'resources'],
    terms: 'default',
  },
  massage: {
    id: 'massage',
    icon: 'HandHeart',
    features: ['homeVisit', 'atHome', 'groups', 'stock', 'resources'],
    terms: 'default',
  },
  dental: {
    id: 'dental',
    icon: 'Smile',
    features: ['treatmentPlan', 'medicalRecords', 'sterilization', 'stock', 'resources', 'dependents'],
    terms: 'medical',
  },
  fitness: {
    id: 'fitness',
    icon: 'Dumbbell',
    features: ['groups', 'onlineSessions', 'homeVisit'],
    terms: 'fitness',
  },
  carwash: {
    id: 'carwash',
    icon: 'Car',
    features: ['vehicle', 'homeVisit', 'stock', 'resources'],
    terms: 'carwash',
  },
  // ⭐ Сферы «заказов» (владелец, 03.10.2026): клиент сдаёт вещь или технику, бизнес ведёт заказ по статусам,
  // «Готово» уходит клиенту само. Записи по времени тоже доступны (примерка, диагностика, детейлинг по слоту).
  tailor: {
    id: 'tailor',
    icon: 'Spool',
    features: ['orders', 'homeVisit', 'stock'],
    terms: 'default',
  },
  repair: {
    id: 'repair',
    icon: 'Smartphone',
    features: ['orders', 'stock'],
    terms: 'default',
  },
  drycleaning: {
    id: 'drycleaning',
    icon: 'WashingMachine',
    features: ['orders', 'homeVisit', 'stock'],
    terms: 'default',
  },
  detailing: {
    id: 'detailing',
    icon: 'CarFront',
    features: ['orders', 'vehicle', 'stock', 'resources'],
    terms: 'carwash',
  },
  general: {
    id: 'general',
    icon: 'Shapes',
    features: ['groups', 'onlineSessions', 'homeVisit', 'atHome', 'stock', 'resources', 'dependents'],
    terms: 'default',
  },
};

export function sphereHas(sphere: SphereId, feature: SphereFeature): boolean {
  return SPHERES[sphere].features.includes(feature);
}
