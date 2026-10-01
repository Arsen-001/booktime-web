import { Car, Dumbbell, Flower2, HandHeart, Scissors, Shapes, Smile, Sparkles, Wind, type LucideIcon } from 'lucide-react';
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
  general: Shapes,
};

/** Сферы для выбора клиентом: «Общий» клиенту ничего не говорит (text-q2 №23) */
export const CLIENT_SPHERES: SphereId[] = ['nails', 'barber', 'hair', 'cosmetology', 'massage', 'dental', 'fitness', 'carwash'];
