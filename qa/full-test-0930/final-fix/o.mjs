// Онлайн: «Предложить другое время» — сервер не принимает занятое/вне графика; токен ссылки новой записи не хранится
import { createHash } from 'node:crypto';
import { call, sql, CLIENT, remember } from './lib.mjs';
const out = {};
const c = await call('owner', 'POST', '/v1/biz/biz_nuri/bookings', { staffId: 'st_nuri_ani', clientId: CLIENT, locationId: 'loc_nuri', start: '2026-10-07T20:15', durationMin: 45, status: 'awaiting_confirmation', services: [{ serviceId: 'sv_nuri_classic', qty: 1, price: 5000, staffId: 'st_nuri_ani', durationMin: 45 }], source: 'link' });
const id = c.d.id; out.create = c.s + ' ' + id; remember('booking', id);
const raw = 'qafixhash' + Date.now();
sql(`update bookings set access_hash='${createHash('sha256').update(raw).digest('hex')}', access_hash_expires_at=now() + interval 10 day where id='${id}'`);
out.offerNight = (await call('owner', 'POST', `/v1/biz/biz_nuri/online/requests/${id}/offer-times`, { starts: ['2026-10-08T03:00'] })).s;
out.offerPast = (await call('owner', 'POST', `/v1/biz/biz_nuri/online/requests/${id}/offer-times`, { starts: ['2026-09-29T12:00'] })).s;
const sug = await call('owner', 'GET', `/v1/biz/biz_nuri/online/requests/${id}/suggest-times?limit=3`);
out.suggest = sug.d;
// занятое: начало существующей записи Ани
const busy = sql(`select date_format(convert_tz(start_at,'+00:00','+04:00'),'%Y-%m-%dT%H:%i') from bookings where staff_id='st_nuri_ani' and status in ('scheduled','client_confirmed') and deleted_at is null and start_at > now() order by start_at limit 1`);
out.busy = busy;
out.offerBusy = (await call('owner', 'POST', `/v1/biz/biz_nuri/online/requests/${id}/offer-times`, { starts: [busy] })).s;
const ok = await call('owner', 'POST', `/v1/biz/biz_nuri/online/requests/${id}/offer-times`, { starts: sug.d.slice(0, 2) });
out.offerFree = ok.s + ' ' + JSON.stringify(ok.d);
const alt = await call(null, 'POST', `/v1/public/bookings/${id}/alternative?h=${raw}`, { start: sug.d[0] });
out.alt = alt.s + ' ' + (alt.d.booking?.id ?? JSON.stringify(alt.d).slice(0, 200));
if (alt.d.booking?.id) remember('booking', alt.d.booking.id);
out.storedMeta = sql(`select json_extract(online_meta,'$.replacedBy') from bookings where id='${id}'`);
const view = await call(null, 'GET', `/v1/public/bookings/${id}?h=${raw}`);
const rb = view.d.meta?.replacedBy; out.viewReplacedBy = rb;
out.derivedEqualsReturned = rb?.hash === alt.d.accessHash;
const newView = await call(null, 'GET', `/v1/public/bookings/${rb?.bookingId}?h=${rb?.hash}`);
out.newLinkOpens = newView.s + ' ' + newView.d.booking?.status;
console.log(JSON.stringify(out, null, 1));
