import * as L from './lib.mjs';
await L.withBrowser(async (browser) => {
  for (const persona of ['individual', 'owner']) {
    const { page } = await L.newPage(browser, { persona, empty: true });
    const pub = () => page.getByRole('button', { name: /^Опубликовать$/ }).first();
    // 1) график
    await L.go(page, '/biz/schedule'); await page.waitForTimeout(2500);
    await page.getByRole('button', { name: 'Задать неделю' }).click(); await page.waitForTimeout(1200);
    const d = page.locator('[role=dialog]').filter({ hasText: 'Рабочее время' }).last();
    await d.getByRole('button', { name: 'Сохранить', exact: true }).click(); await page.waitForTimeout(1500);
    await L.go(page, '/biz/online'); await page.waitForTimeout(2500);
    console.log(persona, 'schedule only → publish enabled:', await pub().isEnabled());
    // 2) шаблон
    await L.go(page, '/biz/services/templates'); await page.waitForTimeout(2000);
    for (const n of ['Снятие покрытия', 'Детский маникюр']) await page.getByRole('checkbox', { name: n }).click();
    await page.waitForTimeout(400);
    await L.shot(page, 'services', `tpl2-${persona}-picked`);
    await page.getByRole('button', { name: 'Добавить выбранные' }).click(); await page.waitForTimeout(2500);
    await L.go(page, '/biz/online'); await page.waitForTimeout(2500);
    console.log(persona, 'schedule + template → publish enabled:', await pub().isEnabled());
    await L.shot(page, 'services', `tpl2-${persona}-online`);
    await pub().click(); await page.waitForTimeout(1500);
    console.log(persona, 'after click:', (await page.innerText('main')).match(/Страница[^\n]*открыт[^\n]*|Опубликовано|Не опубликовано/g)?.slice(0, 3));
    await page.context().close();
  }
});
