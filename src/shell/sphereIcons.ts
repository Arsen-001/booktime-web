import { Car, CarFront, Dumbbell, Flower2, HandHeart, Scissors, Shapes, Smartphone, Smile, Sparkles, Spool, WashingMachine, Wind, type LucideIcon } from 'lucide-react';
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
  tailor: Spool,
  repair: Smartphone,
  drycleaning: WashingMachine,
  detailing: CarFront,
  general: Shapes,
};
