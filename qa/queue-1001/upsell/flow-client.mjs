// node flow-client.mjs <api> <ru|en> <desktop|phone> — приложение клиента с допродажей (сопутствующие уже заданы)
import { open } from './lib.mjs';
import { clientBook } from './steps.mjs';
const [mode = 'api', lang = 'ru', device = 'phone'] = process.argv.slice(2);
const s = await open({ mode, lang, device, role: 'client' });
const r = {};
try { Object.assign(r, await clientBook(s, 'st_nuri_ani')); } catch (e) { r.ERROR = String(e).slice(0, 600); await s.shot('client-error', true); }
r.errors = [...new Set(s.errors)];
await s.close();
console.log(JSON.stringify(r, null, 1));
