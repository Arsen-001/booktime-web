'use client';

/** Идеи (F-00-009, наша сторона): очередь с голосами и статусом; «сделано» — уведомление автору. */
import { isApiMode } from '@/api/http';
import { ApiError, request } from '@/api/request';
import { mutateArea, readArea } from '@/api/area';
import type { Id } from '@/domain/core';
import type { Idea, IdeaInput, IdeaStatus } from '@/domain/platform';
import { nowDateTime } from '@/lib/date';
import { newId } from '@/lib/id';
import { AREA, PANEL } from '@/api/platform/shared';
import * as S from '@/api/platform/ideas.server';

export function listIdeas(): Promise<Idea[]> {
  if (isApiMode()) return S.listIdeas();
  // Список всех идей с авторами и голосующими бизнесами — только наша панель (сервер: @Platform())
  return request(() => [...readArea(AREA).ideas].sort((a, b) => b.votes - a.votes), PANEL);
}

/** Из кабинета бизнеса: новая идея — «рассматриваем» */
export function createIdea(input: IdeaInput): Promise<Idea> {
  if (isApiMode()) return S.createIdea(input);
  return request(() => {
    if (!input.text.trim()) throw new ApiError('validation');
    const idea: Idea = { id: newId('idea'), ...input, text: input.text.trim(), votes: 0, voterIds: [], status: 'considering', createdAt: nowDateTime() };
    mutateArea(AREA, (s) => {
      s.ideas.unshift(idea);
    });
    return idea;
  });
}

/** Из кабинета бизнеса: голос за идею — один бизнес голосует один раз */
export function voteIdea(id: Id, businessId: Id): Promise<void> {
  if (isApiMode()) return S.voteIdea(id, businessId);
  return request(() => {
    mutateArea(AREA, (s) => {
      const idea = s.ideas.find((i) => i.id === id);
      if (!idea) throw new ApiError('not_found');
      if (idea.voterIds.includes(businessId)) return;
      idea.voterIds.push(businessId);
      idea.votes += 1;
    });
  });
}

/** Смена статуса в панели; «сделано» один раз отмечает уведомление автору */
export function setIdeaStatus(id: Id, status: IdeaStatus): Promise<Idea> {
  if (isApiMode()) return S.setIdeaStatus(id, status);
  return request(() => {
    const now = nowDateTime();
    let updated: Idea | undefined;
    mutateArea(AREA, (s) => {
      const idea = s.ideas.find((i) => i.id === id);
      if (!idea) throw new ApiError('not_found');
      idea.status = status;
      idea.decidedAt = now;
      if (status === 'done' && !idea.notifiedAt) idea.notifiedAt = now;
      updated = idea;
    });
    if (!updated) throw new ApiError('not_found');
    return updated;
  }, PANEL);
}
