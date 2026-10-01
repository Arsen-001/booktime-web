// Вход в :4010 кодом разработки (0000) → cookie сессии для Playwright. node login.mjs → sessions.json
import { execSync } from 'node:child_process';
import fs from 'node:fs';
const API = 'http://localhost:4010';
const PEOPLE = { owner: '+37400110001', admin: '+37400110002', master: '+37400110004', empty: '+37400150101' };
const shift = () => execSync(`docker exec booktime-mysql-1 mysql -ubooktime -pbooktime booktime -e "update otp_requests set sent_at = sent_at - interval 2 day where sent_at > now() - interval 2 day"`, { stdio: 'ignore' });
const out = {};
for (const [role, phone] of Object.entries(PEOPLE)) {
  shift();
  const r1 = await fetch(`${API}/v1/auth/code`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone }) });
  const t1 = await r1.text();
  const r2 = await fetch(`${API}/v1/auth/verify`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone, code: '0000', app: 'business' }) });
  const t2 = await r2.text();
  const sc = r2.headers.getSetCookie();
  console.log(role, r1.status, t1.slice(0, 80), r2.status, t2.slice(0, 160));
  out[role] = sc.map((c) => { const [nv] = c.split(';'); const i = nv.indexOf('='); return { name: nv.slice(0, i), value: nv.slice(i + 1), domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' }; });
}
fs.writeFileSync(new URL('./sessions.json', import.meta.url), JSON.stringify(out, null, 1));
