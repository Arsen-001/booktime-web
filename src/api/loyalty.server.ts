'use client';

/**
 * Раздел «Лояльность» на настоящем сервере (docs/backend/PLAN.md этап 21, лейн loyalty). Расчётный слой
 * src/api/loyalty.ts (карты, акции, кэшбэк, сертификаты, абонементы, счета, оплата визита лояльностью, онлайн-
 * продажи) исполняется на сервере как есть — booktime-backend/src/modules/loyalty/port (копия этого файла,
 * `node scripts/sync-loyalty-port.mjs` в репозитории сервера после правки loyalty.ts). Поэтому обёртка одна на
 * все функции: имя функции и её аргументы. Первый аргумент — бизнес: сервер берёт его из пути и проверяет права
 * (booktime-backend/src/modules/loyalty/port/ops.ts).
 */
import { ApiError, trackRead } from '@/api/request';
import { http } from '@/api/http';
import { notifyDbChange, type DbTag } from '@/mock/db';

/**
 * Чтения — функции с правом «любой сотрудник» на сервере (`BIZ_READ_OPS` в port/ops.ts): все они начинаются с
 * list/get/has/find/preview (и `financeLinesOf`); всё остальное меняет данные.
 */
const READ_OP = /^(list|get|has|find|preview)[A-Z]|^financeLinesOf$/;
/** Чтения про оплату конкретного визита */
const VISIT_READ_OP = /Payment|financeLinesOf|Booking/;
/** Записи с деньгами: продажа, пополнение, списание, возврат, оплата визита — их видят касса и вкладка «Оплата» */
const MONEY_OP = /^(sell|topup|charge|refund|void|cancelAccountTopup|commit|reverse|deleteMembershipSale|issueCard|openAccount|confirmOnlineOrder|chargeBookingAutoDebit)/;

/**
 * Перечитывание в режиме api (проход 17.11, как finance.server): чтения объявляют метку areas.loyalty, запись будит
 * её (и кассу с оплатой визита, если двигались деньги). Без этого экран не видел свою запись до перезагрузки: новый
 * тип карты, проданный абонемент, пополнение счёта. Сверка кэшбэка (`syncBookingCashback`) зовётся при открытии
 * вкладки оплаты — будит только лояльность, иначе перечитанная оплата звала бы сверку снова.
 */
function tagsOf(op: string): DbTag[] {
  if (op === 'syncBookingCashback') return ['areas.loyalty'];
  return MONEY_OP.test(op) ? ['areas.loyalty', 'areas.finance', 'areas.journal.extras'] : ['areas.loyalty'];
}

/** Кабинет: POST /v1/biz/{businessId}/loyalty/x/{op} */
export function lx<T>(op: string, args: unknown[]): Promise<T> {
  const businessId = args[0];
  if (typeof businessId !== 'string' || !businessId) return Promise.reject(new ApiError('not_found'));
  const path = `/v1/biz/${encodeURIComponent(businessId)}/loyalty/x/${op}`;
  if (READ_OP.test(op)) {
    // Сводки оплаты визита читают и платежи визита: деньги, принятые во вкладке «Оплата», меняют их тоже
    if (VISIT_READ_OP.test(op)) trackRead('areas.loyalty', 'areas.finance', 'areas.journal.extras');
    else trackRead('areas.loyalty');
    return http<T>('POST', path, { args });
  }
  return http<T>('POST', path, { args }).then((res) => {
    notifyDbChange(...tagsOf(op));
    return res;
  });
}

/** Клиент приложения (любой вошедший): POST /v1/me/loyalty/x/{op} — listMyLoyalty, getOnlineSalePayment */
export function lxMe<T>(op: string, args: unknown[]): Promise<T> {
  return http<T>('POST', `/v1/me/loyalty/x/${op}`, { args });
}

/** Страница записи без входа: POST /v1/public/loyalty/{businessId}/x/{op} — «нужен ли абонемент» (F-06-128) */
export function lxPublic<T>(op: string, args: unknown[]): Promise<T> {
  const businessId = args[0];
  if (typeof businessId !== 'string' || !businessId) return Promise.reject(new ApiError('not_found'));
  return http<T>('POST', `/v1/public/loyalty/${encodeURIComponent(businessId)}/x/${op}`, { args });
}
