// Ограничитель одновременных браузеров Playwright на весь компьютер (25.09.2026: 20 помощников
// запускали браузеры одновременно, своп 12,5 ГБ из 13). Слот = папка /tmp/booking-pw-slots/<n> с pid внутри.
//   import { acquireBrowserSlot } from './pw-slots.mjs'; const release = await acquireBrowserSlot(); … release();
import fs from 'node:fs';
import path from 'node:path';

const DIR = '/tmp/booking-pw-slots';
const MAX = Number(process.env.PW_SLOTS || 4);

function alive(pid) {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

export async function acquireBrowserSlot({ timeoutMs = 30 * 60_000 } = {}) {
  fs.mkdirSync(DIR, { recursive: true });
  const start = Date.now();
  let warned = false;
  for (;;) {
    for (let n = 0; n < MAX; n++) {
      const slot = path.join(DIR, String(n));
      try {
        fs.mkdirSync(slot);
        fs.writeFileSync(path.join(slot, 'pid'), String(process.pid));
        const release = () => { try { fs.rmSync(slot, { recursive: true, force: true }); } catch {} };
        process.once('exit', release);
        for (const sig of ['SIGINT', 'SIGTERM']) process.once(sig, () => { release(); process.exit(130); });
        return release;
      } catch {
        // занят — освободить, если хозяин умер
        try {
          const pid = Number(fs.readFileSync(path.join(slot, 'pid'), 'utf8'));
          if (pid && !alive(pid)) fs.rmSync(slot, { recursive: true, force: true });
        } catch {
          try { if (Date.now() - fs.statSync(slot).mtimeMs > 60_000) fs.rmSync(slot, { recursive: true, force: true }); } catch {}
        }
      }
    }
    if (!warned) { console.error(`[pw-slots] все ${MAX} слотов браузера заняты — жду очереди`); warned = true; }
    if (Date.now() - start > timeoutMs) throw new Error('[pw-slots] не дождался слота браузера');
    await new Promise((r) => setTimeout(r, 1500));
  }
}
