export default async (a) => {
  const { page } = a;
  const r = await (await import('./m-list.mjs')).default(a).catch((e) => ({ e: String(e).slice(0, 100) }));
  const dlg = page.locator('[role=dialog]').last();
  r.buttons = await dlg.getByRole('button').evaluateAll((els) => els.map((e) => (e.textContent || e.getAttribute('aria-label') || '').trim()).filter((x) => /пла|Пла|5 000/.test(x)));
  return r;
};
