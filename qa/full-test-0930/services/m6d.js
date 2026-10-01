const page = state.e;
await page.getByRole('button', { name: 'Добавить выбранные' }).click(); await page.waitForTimeout(2500);
await L.go(page, '/biz/services'); await page.waitForTimeout(1500);
const t = await page.innerText('main');
log('Услуг', t.match(/Услуг\n+(\d+)/)?.[1], 'Категорий', t.match(/Категорий\n+(\d+)/)?.[1], ['Детский маникюр','Снятие покрытия','Классический педикюр'].map(n=>t.includes(n)));
