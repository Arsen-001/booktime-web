import { waitReady, dlg, btns, toasts } from '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/journal-2/t/common.mjs';
export default async ({ browser, lib, state }) => {
  const p = state.owner; let o='';
  await lib.goto(p, '/biz/journal'); await waitReady(p);
  o += 'grid has Лиана Г. ' + (await lib.text(p)).includes('Лиана Г.') + '\n';
  await lib.goto(p, '/biz/records'); await waitReady(p);
  const t = await lib.text(p); o += 'records Показано ' + (t.match(/Показано\s+(\d+)/)||[])[1] + ' has Лиана Гаспарян ' + t.includes('Лиана Гаспарян') + ' rows ' + await p.locator('tr').count() + '\n';
  o += 'deleted count ' + (t.match(/Удалено\s+(\d+)/)||[])[1] + '\n';
  return o;
};
