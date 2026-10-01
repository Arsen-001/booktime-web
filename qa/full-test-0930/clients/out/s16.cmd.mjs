export default async ({ page, go, shot }) => {
  await go('/biz/clients/cl_068');
  const strip = await page.locator('[data-f~="F-00-084"]').first().innerText();
  await shot('s16-due-year');
  return { strip };
};
