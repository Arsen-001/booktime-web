import { Car, CarFront, Dumbbell, Flower2, HandHeart, Scissors, Shapes, Smartphone, Smile, Sparkles, Spool, WashingMachine, Wind, type LucideIcon } from 'lucide-react';
import type { SphereId } from '@/domain/core';

/** Иконки сфер для крупных категорий клиента (F-00-110) — те же, что в конфиге сфер */
export const SPHERE_ICON: Record<SphereId, LucideIcon> = {
  nails: Sparkles,
  barber: Scissors,
  hair: Wind,
  cosmetology: Flower2,
  massage: HandHeart,
  dental: Smile,
  fitness: Dumbbell,
  carwash: Car,
  tailor: Spool,
  repair: Smartphone,
  drycleaning: WashingMachine,
  detailing: CarFront,
  general: Shapes,
};

/**
 * Сферы для выбора клиентом: «Общий» клиенту ничего не говорит (text-q2 №23). Сначала запись по времени (красота,
 * здоровье, мойка), потом сферы «заказов» (04.10.2026: детейлинг, ателье, химчистка, ремонт техники) — их мастерские
 * в поиске карточкой места, без окон. 12 штук: на главной гостя — сетка 4 × 3 (на телефоне 2 × 6).
 */
export const CLIENT_SPHERES: SphereId[] = ['nails', 'barber', 'hair', 'cosmetology', 'massage', 'dental', 'fitness', 'carwash', 'detailing', 'tailor', 'drycleaning', 'repair'];
