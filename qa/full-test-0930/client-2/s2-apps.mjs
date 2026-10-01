// «Приложение для бизнеса»: команда, события, услуги, зарплата, аналитика, своё приложение
import { start, newPage, go, shot, text } from './h.mjs';

const { browser, done } = await start();
const log = (...a) => console.log(...a);
const one = (s, n = 600) => (s ?? '').slice(0, n).replace(/\n+/g, ' | ');
const body = (page) => page.locator('body').innerText();
const sect = async (name, fn) => {
  try { await fn(); } catch (e) { log(`!! ${name} FAIL:`, e.message.split('\n')[0]); }
};
try {
  const { page, errors } = await newPage(browser, { device: 'phone' });

  await sect('hub', async () => {
    await go(page, '/biz/apps', 'owner');
    await shot(page, 'a-hub');
    log('HUB:', one(await text(page), 1500));
  });

  // ---- Команда
  await sect('team', async () => {
    await go(page, '/biz/apps/team', 'owner');
    await shot(page, 'a-team');
    log('TEAM:', one(await text(page), 500));
    await page.getByRole('button', { name: 'Добавить сотрудника' }).first().click();
    await page.waitForTimeout(600);
    let dlg = page.getByRole('dialog');
    const createBtn = dlg.getByRole('button', { name: 'Создать' });
    log('create disabled when empty:', await createBtn.isDisabled());
    await dlg.getByLabel('Имя').fill('Гаяне QA');
    await dlg.getByLabel('Телефон').fill('abc');
    log('create disabled with phone "abc":', await createBtn.isDisabled());
    await dlg.getByLabel('Телефон').fill('+37491112233');
    await createBtn.click();
    await page.waitForTimeout(1500);
    log('created toast:', (await body(page)).includes('Сотрудник добавлен'), 'in list:', (await text(page)).includes('Гаяне QA'));
    await page.getByText('Гаяне QA').first().click();
    await page.waitForTimeout(1000);
    dlg = page.getByRole('dialog');
    await shot(page, 'a-team-card');
    await dlg.getByRole('tab', { name: 'Доступ' }).click();
    await page.waitForTimeout(500);
    const sw = dlg.getByRole('switch');
    const before = await sw.evaluateAll((e) => e.map((x) => x.getAttribute('aria-checked')));
    await sw.nth(0).click();
    await page.waitForTimeout(1200);
    const after = await sw.evaluateAll((e) => e.map((x) => x.getAttribute('aria-checked')));
    log('access switches', before, '->', after);
    await dlg.getByRole('tab', { name: 'Пуши' }).click();
    await page.waitForTimeout(500);
    log('PUSH TAB:', one(await dlg.innerText(), 500));
    await shot(page, 'a-team-push');
    await dlg.getByRole('tab', { name: 'Зарплата' }).click();
    await page.waitForTimeout(500);
    log('PAYROLL TAB:', one(await dlg.innerText(), 400));
    await dlg.getByRole('tab', { name: 'Карточка' }).click();
    await dlg.getByRole('button', { name: 'Уволить' }).click();
    await page.waitForTimeout(500);
    await page.getByRole('alertdialog').getByRole('button', { name: 'Уволить' }).click().catch(async () => {
      await page.getByRole('dialog').last().getByRole('button', { name: 'Уволить' }).click();
    });
    await page.waitForTimeout(1500);
    log('after fire list:', one(await text(page), 600));
    // Видно ли в вебе /biz/staff
    await go(page, '/biz/staff', 'owner');
    const st = await text(page);
    log('web staff has Гаяне QA:', st.includes('Гаяне QA'));
    await shot(page, 'a-team-web-staff');
    await go(page, '/biz/apps/team', 'owner');
    await page.getByText('Гаяне QA').first().click();
    await page.waitForTimeout(800);
    dlg = page.getByRole('dialog');
    const rest = dlg.getByRole('button', { name: 'Восстановить' });
    log('restore button:', await rest.count());
    if (await rest.count()) { await rest.click(); await page.waitForTimeout(1200); log('restored:', (await body(page)).includes('Восстановлен')); }
    await dlg.getByRole('button', { name: 'Удалить' }).click();
    await page.waitForTimeout(500);
    await page.getByRole('alertdialog').getByRole('button', { name: 'Удалить' }).click().catch(async () => {
      await page.getByRole('dialog').last().getByRole('button', { name: 'Удалить' }).click();
    });
    await page.waitForTimeout(1500);
    log('after delete in list:', (await text(page)).includes('Гаяне QA'));
  });

  // ---- События
  await sect('events', async () => {
    await go(page, '/biz/apps/events', 'owner');
    await shot(page, 'a-events');
    log('EVENTS:', one(await text(page), 500));
    await page.getByRole('button', { name: 'Новое событие' }).first().click();
    await page.waitForTimeout(800);
    const dlg = page.getByRole('dialog');
    log('EVENT FORM:', one(await dlg.innerText(), 600));
    await shot(page, 'a-events-form');
    // Выбрать услугу и сотрудника через Select (combobox)
    const combos = dlg.getByRole('combobox');
    log('combos:', await combos.count());
    for (let i = 0; i < Math.min(2, await combos.count()); i++) {
      await combos.nth(i).click();
      await page.waitForTimeout(400);
      const opt = page.getByRole('option').first();
      if (await opt.count()) await opt.click();
      await page.waitForTimeout(400);
    }
    const repeat = dlg.getByLabel('Повтор, недель');
    if (await repeat.count()) await repeat.fill('2');
    await shot(page, 'a-events-form-filled');
    const create = dlg.getByRole('button', { name: /Создать|Новое событие/ }).last();
    log('create disabled:', await create.isDisabled());
    await create.click();
    await page.waitForTimeout(2000);
    log('after create:', (await body(page)).includes('Событие создано'), one(await text(page), 600));
    await shot(page, 'a-events-created');
    // Открыть первое событие, записать клиента
    await page.locator('main li').first().click();
    await page.waitForTimeout(1000);
    const d2 = page.getByRole('dialog');
    log('EVENT DETAIL:', one(await d2.innerText(), 600));
    const vn = d2.getByLabel('Имя');
    if (await vn.count()) {
      await vn.last().fill('Участник QA');
      await d2.getByRole('button', { name: 'Записать' }).click();
      await page.waitForTimeout(1500);
      log('signed up:', (await d2.innerText()).includes('Участник QA'));
    }
    await shot(page, 'a-events-participant');
    await page.keyboard.press('Escape');
  });

  // ---- Услуги
  await sect('services', async () => {
    await go(page, '/biz/apps/services', 'owner');
    await shot(page, 'a-services');
    await page.getByRole('button', { name: 'Добавить категорию' }).first().click();
    await page.waitForTimeout(500);
    let dlg = page.getByRole('dialog');
    await dlg.getByLabel('Название категории').fill('Кат QA');
    await dlg.getByRole('button', { name: 'Создать категорию' }).click();
    await page.waitForTimeout(1500);
    log('cat created:', (await text(page)).includes('Кат QA'));
    // Добавить услугу в неё
    const catCard = page.locator('main').getByText('Кат QA').first();
    await catCard.scrollIntoViewIfNeeded();
    const section = page.locator('main section, main [class*="card"]').filter({ hasText: 'Кат QA' }).last();
    await section.getByRole('button', { name: 'Добавить услугу' }).first().click();
    await page.waitForTimeout(600);
    dlg = page.getByRole('dialog');
    log('SERVICE FORM:', one(await dlg.innerText(), 500));
    await dlg.getByLabel('Название услуги').fill('Услуга QA');
    const pf = dlg.getByLabel('Цена от');
    await pf.fill('5000');
    const du = dlg.getByLabel('Длительность, мин');
    if (await du.count()) await du.fill('45');
    await dlg.getByRole('button', { name: 'Создать услугу' }).click();
    await page.waitForTimeout(1500);
    log('service created:', (await text(page)).includes('Услуга QA'));
    await shot(page, 'a-services-created');
    await go(page, '/biz/services', 'owner');
    const ws = await text(page);
    log('web services has Услуга QA:', ws.includes('Услуга QA'), 'Кат QA:', ws.includes('Кат QA'));
    await shot(page, 'a-services-web');
  });

  // ---- Зарплата
  await sect('payroll', async () => {
    await go(page, '/biz/apps/payroll', 'owner');
    await shot(page, 'a-payroll');
    log('PAYROLL:', one(await text(page), 700));
    const combos = page.locator('main').getByRole('combobox');
    if (await combos.count()) {
      await combos.first().click();
      await page.waitForTimeout(400);
      await page.getByRole('option').first().click();
      await page.waitForTimeout(1500);
    }
    log('PAYROLL staff:', one(await text(page), 900));
    const po = page.getByRole('button', { name: 'Отметить выплату' });
    if (await po.count()) {
      await po.click();
      await page.waitForTimeout(600);
      const dlg = page.getByRole('dialog');
      const amt = dlg.getByLabel('Сумма выплаты');
      await amt.fill('1000');
      await dlg.getByRole('button', { name: /Отметить|Сохранить|Выплат/ }).last().click();
      await page.waitForTimeout(1500);
      log('payout toast:', (await body(page)).includes('Выплата зафиксирована'));
      log('PAYROLL after:', one(await text(page), 900));
    }
    await shot(page, 'a-payroll-after');
  });

  // ---- Аналитика
  await sect('reports', async () => {
    await go(page, '/biz/apps/reports', 'owner');
    await shot(page, 'a-reports');
    log('REPORTS:', one(await text(page), 600));
    for (const tab of ['Z-отчёт', 'Период', 'Моя', 'Филиалы']) {
      const t = page.getByRole('tab', { name: tab });
      if (await t.count()) { await t.click(); await page.waitForTimeout(800); log(`TAB ${tab}:`, one(await text(page), 400)); }
    }
    await shot(page, 'a-reports-network');
    await go(page, '/biz/apps/reports', 'master');
    await page.getByRole('tab', { name: 'Моя' }).click().catch(() => {});
    await page.waitForTimeout(800);
    log('MASTER reports:', one(await text(page), 500));
    await shot(page, 'a-reports-master');
  });

  // ---- Своё приложение
  await sect('branded', async () => {
    await go(page, '/biz/apps/branded', 'owner');
    await shot(page, 'a-branded');
    log('BRANDED:', one(await text(page), 1200));
    const cb = page.locator('main [role="checkbox"]');
    log('checkboxes:', await cb.count(), 'disabled:', await cb.evaluateAll((e) => e.map((x) => x.hasAttribute('disabled') || x.getAttribute('aria-disabled'))));
  });
  await sect('branded-en', async () => {
        await page.goto('http://localhost:3710/biz/apps/branded?lang=en');
    await page.waitForTimeout(2500);
    const tx = await text(page);
    log('BRANDED EN cyrillic:', (tx.match(/[А-Яа-яЁё][А-Яа-яЁё .\/]+/g) || []).slice(0, 10));
    await shot(page, 'a-branded-en');
    await page.goto('http://localhost:3710/biz/apps/visit?lang=en');
    await page.waitForTimeout(2500);
    const vx = await text(page);
    log('VISIT EN cyrillic:', (vx.match(/[А-Яа-яЁё][А-Яа-яЁё .\/]+/g) || []).slice(0, 10), one(vx, 300));
    await page.goto('http://localhost:3710/biz/apps?lang=ru');
    await page.waitForTimeout(1500);
  });

  // ---- Пусто и ошибка
  await sect('empty', async () => {
    for (const r of ['/biz/apps/visit', '/biz/apps/team', '/biz/apps/events', '/biz/apps/payroll', '/biz/apps/reports']) {
      await go(page, r + '?empty=1', 'owner');
      log(`EMPTY ${r}:`, one(await text(page), 250));
    }
    await shot(page, 'a-empty-reports');
    for (const r of ['/biz/apps/visit', '/biz/apps/team', '/biz/apps/branded']) {
      await go(page, r + '?api=error&empty=0', 'owner');
      log(`ERROR ${r}:`, one(await text(page), 250));
    }
    await shot(page, 'a-error-branded');
    await go(page, '/biz/apps', 'owner', '&api=normal');
  });

  log('ERRORS:', errors.slice(0, 12));
} catch (e) {
  console.error('FAIL', e);
} finally {
  await done();
}
