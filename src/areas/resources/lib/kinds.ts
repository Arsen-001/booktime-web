import { Armchair, Box, DoorClosed, Speaker, Users, Zap, type LucideIcon } from 'lucide-react';
import type { ResourceKind } from '@/domain/core';

/** Иконка вида ресурса (F-16-001…003) — ключи подписей в messages/<lang>/resources.json → kind.* */
export const RESOURCE_KIND_ICON: Record<ResourceKind, LucideIcon> = {
  chair: Armchair,
  room: DoorClosed,
  device: Zap,
  box: Box,
  hall: Users,
  other: Speaker,
};

export const RESOURCE_KINDS: ResourceKind[] = ['chair', 'room', 'device', 'box', 'hall', 'other'];
