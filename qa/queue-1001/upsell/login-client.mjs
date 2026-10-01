// Сессия клиента приложения (код разработки 0000) → sessions.json.client
import { execSync } from 'node:child_process';
import fs from 'node:fs';
const phone = process.argv[2] ?? '+37400990030';
execSync(`docker exec booktime-mysql-1 mysql -ubooktime -pbooktime booktime -e "update otp_requests set sent_at = sent_at - interval 2 day where sent_at > now() - interval 2 day"`, { stdio: 'ignore' });
await fetch('http://localhost:4010/v1/auth/code', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone }) });
const r = await fetch('http://localhost:4010/v1/auth/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone, code: '0000', app: 'client', consent: true, name: 'Тест Клиент' }) });
console.log(r.status, (await r.text()).slice(0, 200));
const S = JSON.parse(fs.readFileSync('sessions.json'));
S.client = r.headers.getSetCookie().map((c) => { const [nv] = c.split(';'); const i = nv.indexOf('='); return { name: nv.slice(0, i), value: nv.slice(i + 1), domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' }; });
fs.writeFileSync('sessions.json', JSON.stringify(S, null, 1));
