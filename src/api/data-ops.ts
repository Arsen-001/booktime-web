/**
 * Общий журнал «Операции с данными» (F-02-063, F-14-114, F-04-206): загрузки и выгрузки Excel, массовое удаление —
 * кто, когда, что и сколько. В демо — журнал ядра браузера (listDataOperations/logDataOperation из @/api/core),
 * в режиме api — журнал сервера (`GET/POST /v1/biz/:id/data-ops`, audit_events с action 'data_op').
 *
 * Кто пишет в режиме api: сервер сам — там, где операция идёт одним запросом (клиенты: выгрузка и импорт, техперерыв
 * из Excel, импорт визитов, массовая отмена групповых событий, журнал); экран — `logDataOp` для того, что он собирает
 * сам (файл в браузере), и `noteDataOpOnServer` после операции из нескольких запросов (импорт каталога, массовое
 * удаление услуг): в демо такую операцию уже записал мок в своём request(), второй строки не будет.
 */
import { readCore } from '@/api/area';
import { http, isApiMode } from '@/api/http';
import { listDataOperations, logDataOperation, type DataOperationInput } from '@/api/core';
import { request, trackRead } from '@/api/request';
import type { DataOperation, Id } from '@/domain/core';

/** Строка журнала; byName — имя автора на момент операции (сервер) или по сотрудникам ядра (демо) */
export type DataOperationRow = DataOperation & { byName?: string };

export interface DataOpsQuery {
  businessId: Id;
  kinds?: DataOperation['kind'][];
  area?: string;
}

/** Журнал бизнеса, новые → старые (до 500). Право — «Экспорт данных» (clients.export) */
export async function listDataOps(q: DataOpsQuery): Promise<DataOperationRow[]> {
  if (!isApiMode()) {
    // Демо: имя автора — из сотрудников ядра (сервер отдаёт его сам, на момент операции)
    const rows = await listDataOperations(q);
    const names = await request(() => new Map(readCore().staff.map((st) => [st.id, st.name])));
    return rows.map((r) => ({ ...r, byName: names.get(r.by) }));
  }
  trackRead('areas.staff');
  return http<DataOperationRow[]>('GET', `/v1/biz/${q.businessId}/data-ops`, undefined, {
    query: { kinds: q.kinds?.length ? q.kinds.join(',') : undefined, area: q.area },
  });
}

type ServerOpInput = Omit<DataOperationInput, 'by'>;

function postDataOp(input: ServerOpInput): Promise<DataOperationRow> {
  const { businessId, ...body } = input;
  return http<DataOperationRow>('POST', `/v1/biz/${businessId}/data-ops`, body);
}

/** Операция, которую собрал экран (файл выгружен в браузере): в демо — в журнал ядра, в api — на сервер (автор — сессия) */
export function logDataOp(input: ServerOpInput): Promise<DataOperation> {
  return isApiMode() ? postDataOp(input) : logDataOperation(input);
}

/**
 * После операции из нескольких запросов (импорт каталога, массовое удаление): в api — одна строка на сервер; в демо
 * ничего — мок уже записал её внутри своей операции. Журнал — не повод ронять саму операцию: ошибку глотаем.
 */
export async function noteDataOpOnServer(input: ServerOpInput): Promise<void> {
  if (!isApiMode() || !input.businessId) return;
  try {
    await postDataOp(input);
  } catch {
    // операция уже прошла; строка журнала потеряна — не мешаем человеку
  }
}
