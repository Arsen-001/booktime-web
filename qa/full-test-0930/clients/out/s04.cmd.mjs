// Состояния: пусто (owner/individual), ошибка, медленно; роли admin/master/individual/network
export default async ({ page, go, shot, text }) => {
  const r = {};
  await go('/biz/clients?empty=1');
  r.ownerEmpty = (await text()).slice(0, 500); await shot('s04-owner-empty');
  await go('/biz/clients?empty=1', { device: 'phone' }); await shot('s04-owner-empty-phone');
  await go('/biz/clients?empty=1', { persona: 'individual' });
  r.indEmpty = (await text()).slice(0, 400);
  await go('/biz/clients/summary?empty=1'); r.summaryEmpty = (await text()).slice(0, 500); await shot('s04-summary-empty');
  await go('/biz/clients/categories?empty=1'); r.catEmpty = (await text()).slice(0, 400);
  await go('/biz/clients?empty=0', { api: 'error' });
  r.error = (await text()).slice(0, 400); await shot('s04-error');
  const retry = page.getByRole('button', { name: /Повторить/ });
  r.hasRetry = await retry.count();
  // медленно — снимок сразу после загрузки
  await page.goto('http://localhost:3710/biz/clients?demo=owner&api=slow&empty=0', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700); await shot('s04-slow');
  r.slow = (await text()).slice(0, 300);
  await go('/biz/clients', { api: 'normal' });
  for (const persona of ['admin', 'master', 'individual', 'network']) {
    await go('/biz/clients', { persona });
    const t = await text();
    const chip = await page.getByRole('button', { name: /Пора записать/ }).first().innerText().catch(() => 'NO CHIP');
    const phones = (t.match(/\+374[\d\s]{6,}/g) || []).length;
    const masked = (t.match(/•{2,}|\*{2,}/g) || []).length;
    r[persona] = { head: t.slice(0, 350), chip, phones, masked, url: page.url() };
    await shot(`s04-${persona}`);
  }
  return r;
};
