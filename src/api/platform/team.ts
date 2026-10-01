'use client';

/** Наша команда и справочник бизнесов (только имена) для выбора в формах панели. */
import { http, isApiMode } from '@/api/http';
import { request } from '@/api/request';
import { readArea, readCore } from '@/api/area';
import type { Id } from '@/domain/core';
import type { TeamMember } from '@/domain/platform';
import { AREA, PANEL } from '@/api/platform/shared';
import * as BS from '@/api/platform/businesses.server';

/** Команда платформы: в режиме api — `PlatformMember` сервера (вход Р11), имя из `User.name` */
export function listTeam(): Promise<TeamMember[]> {
  if (isApiMode()) return http<TeamMember[]>('GET', '/v1/platform/team');
  return request(() => readArea(AREA).team, PANEL);
}

export function listAllBusinessesLite(): Promise<{ id: Id; name: string }[]> {
  if (isApiMode())
    return BS.listBusinessesOverview().then((rows) => rows.map((r) => ({ id: r.id, name: r.name })).sort((a, b) => a.name.localeCompare(b.name)));
  return request(() => readCore().businesses.map((b) => ({ id: b.id, name: b.name })).sort((a, b) => a.name.localeCompare(b.name)), PANEL);
}
