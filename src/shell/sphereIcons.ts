import { Car, Dumbbell, Flower2, HandHeart, Scissors, Shapes, Smile, Sparkles, Wind, type LucideIcon } from 'lucide-react';
import type { SphereId } from '@/domain/core';

/** Иконки сфер (в конфиге сфер — только имена, чтобы конфиг не тянул React на сервер) */
export const SPHERE_ICONS: Record<SphereId, LucideIcon> = {
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
