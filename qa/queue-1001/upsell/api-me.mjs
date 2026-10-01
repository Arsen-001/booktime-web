// Сервер: /v1/me/bookings с сопутствующей услугой — ищем время, где «Снятие покрытия» у Ани помещается
import fs from 'node:fs';
const S = JSON.parse(fs.readFileSync('sessions.json'));
const cookie = S.client.map((c) => `${c.name}=${c.value}`).join('; ');
const API = 'http://localhost:4010';
for (let d = 2; d < 10; d++) {
  const date = new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
  const slots = await (await fetch(`${API}/v1/public/b/nuri-nail-studio/slots?staffId=st_nuri_ani&date=${date}&durationMin=90&durationMax=105&serviceId=sv_nuri_gel`)).json();
  for (const sl of slots.slice(0, 6)) {
    const o = await (await fetch(`${API}/v1/public/upsell-offers?staffId=st_nuri_ani&serviceIds=sv_nuri_gel&start=${sl.start}`)).json();
    if (!o.services.some((x) => x.serviceId === 'sv_nuri_remove')) continue;
    // подделка: попросить и чужую услугу (дизайн — Ани её не делает) → сервер должен отказать
    const bad = await fetch(`${API}/v1/me/bookings`, { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ staffId: 'st_nuri_ani', serviceId: 'sv_nuri_gel', start: sl.start, addOns: { serviceIds: ['sv_nuri_design'] } }) });
    console.log('foreign add-on →', bad.status, (await bad.text()).slice(0, 120));
    const notListed = await fetch(`${API}/v1/me/bookings`, { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ staffId: 'st_nuri_ani', serviceId: 'sv_nuri_gel', start: sl.start, addOns: { serviceIds: ['sv_nuri_kids'] } }) });
    console.log('not in list →', notListed.status, (await notListed.text()).slice(0, 120));
    const ok = await fetch(`${API}/v1/me/bookings`, { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ staffId: 'st_nuri_ani', serviceId: 'sv_nuri_gel', start: sl.start, addOns: { serviceIds: ['sv_nuri_remove'], productIds: ['gd_loc_nuri_0'] } }) });
    const j = await ok.json();
    console.log('ok →', ok.status, sl.start, 'duration', j.booking?.durationMin, 'total', j.booking?.total, JSON.stringify(j.booking?.services));
    process.exit(0);
  }
}
