'use client';

/** Раздел «platform»: идеи на настоящем сервере (booktime-backend, PLAN.md §7, этап 19; F-00-009). */
import { http } from '@/api/http';
import { trackRead } from '@/api/request';
import { notifyDbChange } from '@/mock/db';
import type { Id } from '@/domain/core';
import type { Idea, IdeaInput, IdeaStatus } from '@/domain/platform';

export const listIdeas = () => {
  trackRead('areas.platform');
  return http<Idea[]>('GET', '/v1/platform/ideas');
};

export async function createIdea(input: IdeaInput): Promise<Idea> {
  const idea = await http<Idea>('POST', `/v1/biz/${input.businessId}/ideas`, { text: input.text });
  notifyDbChange('areas.platform');
  return idea;
}

export async function voteIdea(id: Id, businessId: Id): Promise<void> {
  await http<Idea>('POST', `/v1/biz/${businessId}/ideas/${id}/vote`);
  notifyDbChange('areas.platform');
}

export async function setIdeaStatus(id: Id, status: IdeaStatus): Promise<Idea> {
  const idea = await http<Idea>('POST', `/v1/platform/ideas/${id}/status`, { status });
  notifyDbChange('areas.platform');
  return idea;
}
