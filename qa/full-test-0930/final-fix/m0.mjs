export default async ({ page, go }) => {
  await go('/biz/journal?demo=owner&date=2026-10-02', 5000);
  const labels = await page.locator('[aria-label]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')).filter((l) => /\d{1,2}:\d{2}/.test(l)).slice(0, 15));
  return { url: page.url(), labels };
};
