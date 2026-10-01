import { rowHrefs } from '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/clients/steps/rowhref.mjs';
// Карточки клиентов из подборки «Пора записать»: полоса, история (последний визит, услуга)
export default async ({ page, go, shot, text }) => {
  await go('/biz/clients');
  await page.getByRole('button', { name: /Пора записать/ }).first().click();
  await page.waitForTimeout(1500);
  const links = await rowHrefs(page, 4);
  const out = [];
  for (const href of links.slice(0, 4)) {
    await go(href);
    const strip = await page.locator('[data-f~="F-00-084"]').first().innerText().catch(() => null);
    const bookHref = await page.locator('[data-f~="F-00-084"] a').first().getAttribute('href').catch(() => null);
    const head = (await text()).slice(0, 700);
    await page.getByRole('tab', { name: /История визитов/ }).first().click().catch(() => {});
    await page.waitForTimeout(1200);
    const hist = (await text()).slice(0, 1500);
    out.push({ href, strip, bookHref, head, hist });
  }
  if (links[0]) { await go(links[0]); await shot('s02-due-card-desktop'); }
  return { n: links.length, out };
};
