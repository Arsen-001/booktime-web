// Вход в копию сервера (:4023 по умолчанию) кодом разработки и запросы с cookie сессии
import { execSync } from 'node:child_process';
export const API = process.env.API ?? 'http://localhost:4023';
export async function login(phone, app, name) {
  execSync(`docker exec booktime-mysql-1 mysql -ubooktime -pbooktime booktime -e "update otp_requests set sent_at = sent_at - interval 2 day where sent_at > now() - interval 2 day"`, { stdio: 'ignore' });
  const h = { 'content-type': 'application/json', origin: 'http://localhost:3710' };
  await fetch(`${API}/v1/auth/code`, { method: 'POST', headers: h, body: JSON.stringify({ phone }) });
  const r = await fetch(`${API}/v1/auth/verify`, { method: 'POST', headers: h, body: JSON.stringify({ phone, code: '0000', app, consent: true, ...(name ? { name } : {}) }) });
  const body = await r.json().catch(() => ({}));
  const cookie = r.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  const call = async (method, path, data, extra = {}) => {
    const res = await fetch(`${API}${path}`, { method, headers: { ...h, cookie, ...(data && method !== 'GET' ? { 'idempotency-key': crypto.randomUUID() } : {}), ...extra }, body: data ? JSON.stringify(data) : undefined });
    const text = await res.text();
    let json; try { json = JSON.parse(text); } catch { json = text; }
    return { status: res.status, json };
  };
  return { status: r.status, body, call };
}
export const sql = (q) => execSync(`docker exec booktime-mysql-1 mysql -ubooktime -pbooktime booktime -N -e ${JSON.stringify(q)}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
export const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) process.exitCode = 1; };
