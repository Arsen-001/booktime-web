// Прямая проверка GET /v1/biz/{b}/journal/day-feed (копия API :4011 или :4010 — API=…)
import fs from 'node:fs';
const S = JSON.parse(fs.readFileSync(new URL('./sessions.json', import.meta.url)));
const A = process.env.API ?? 'http://localhost:4011';
const ck = (r) => S[r].map((c) => `${c.name}=${c.value}`).join('; ');
const call = async (r, p) => { const t0 = Date.now(); const res = await fetch(A + p, { headers: { cookie: ck(r), origin: 'http://localhost:3710' } }); const d = await res.json().catch(() => null); return { s: res.status, ms: Date.now() - t0, d }; };
const date = process.argv[2] ?? '2026-10-01';
const out = {};
for (const r of ['owner', 'admin', 'master']) {
  const res = await call(r, `/v1/biz/biz_nuri/journal/day-feed?date=${date}`);
  const items = Array.isArray(res.d) ? res.d : [];
  out[r] = { status: res.s, ms: res.ms, n: items.length, kinds: items.reduce((m, i) => ((m[i.kind] = (m[i.kind] ?? 0) + 1), m), {}), staff: [...new Set(items.map((i) => i.staffName))], sample: items.slice(0, 2) };
}
out.masterAsksOther = (await call('master', `/v1/biz/biz_nuri/journal/day-feed?date=${date}&staffId=st_nuri_mariam`)).d?.every?.((i) => i.staffId === 'st_nuri_ani' || i.prevStaffId === 'st_nuri_ani');
out.badDate = (await call('owner', `/v1/biz/biz_nuri/journal/day-feed?date=bad`)).s;
console.log(JSON.stringify(out, null, 1));
