// node ask.mjs <name>  — берёт steps/<name>.mjs, кладёт в cmd/, ждёт out/<name>.json и печатает
import fs from 'node:fs';
import path from 'node:path';
const DIR = '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/clients';
const name = process.argv[2];
const src = path.join(DIR, 'steps', `${name}.mjs`);
const out = path.join(DIR, 'out', `${name}.json`);
fs.rmSync(out, { force: true });
fs.copyFileSync(src, path.join(DIR, 'cmd', `${name}.mjs`));
const start = Date.now();
while (!fs.existsSync(out)) {
  if (Date.now() - start > 40 * 60_000) { console.log('TIMEOUT'); process.exit(1); }
  await new Promise((r) => setTimeout(r, 500));
}
await new Promise((r) => setTimeout(r, 100));
console.log(fs.readFileSync(out, 'utf8'));
