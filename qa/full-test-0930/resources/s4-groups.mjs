// Групповые события (Арман, фитнес): список → событие → добавить участника → места → снять
import { start, stop, ctx, open, goto, shot } from './lib.mjs';
const log = (...a) => console.log(...a);
const step = async (name, fn) => { try { await fn(); log('OK', name); } catch (e) { log('FAIL', name, e.message.split('\n')[0].slice(0, 200)); } };
await start();
try {
  for (const device of ['desktop', 'phone']) {
    const c = await ctx({ device });
    const p = await open(c, '/biz/groups', { persona: 'individual', query: 'sphere=fitness' });
    await shot(p, `s4-01-groups-${device}`);
    log(device, 'groups text:', (await p.locator('main').innerText()).replace(/\s+/g, ' ').slice(0, 500));
    if (device === 'phone') { log('errors', p.errors); await c.close(); continue; }
    await step('open event', async () => {
      await p.locator('main li button').filter({ hasText: '01.10.2026' }).first().click();
      await p.waitForURL(/events\/(?!new)/, { timeout: 90000 });
      await p.waitForTimeout(2500);
      await shot(p, 's4-02-event', true);
      log('event text:', (await p.locator('main').innerText()).replace(/\s+/g, ' ').slice(0, 900));
    });
    await step('add participant', async () => {
      await p.getByRole('button', { name: /Добавить участника|Добавить клиента|Записать клиента/ }).first().click();
      await p.waitForTimeout(800);
      const d = p.locator('[role=dialog]').last();
      await shot(p, 's4-03-add');
      log('add dialog:', (await d.innerText()).replace(/\s+/g, ' ').slice(0, 400));
      await d.locator('input').first().fill('QA Участник');
      await d.locator('input[type=tel], input[inputmode=tel]').first().fill('91000333');
      await d.getByRole('button', { name: /Добавить|Записать|Сохранить/ }).last().click();
      await p.waitForTimeout(500);
      log('toast/dialog after add:', (await p.locator('body').innerText()).match(/(Клиент добавлен|Мест нет|Не получилось[^\n]*|добавлен[^\n]*)/)?.[0]);
      await p.waitForTimeout(2000);
      await shot(p, 's4-04-added', true);
      log('has participant:', await p.getByText('QA Участник').count());
      log('event text after:', (await p.locator('main').innerText()).replace(/\s+/g, ' ').slice(0, 500));
    });
    await step('remove participant', async () => {
      const row = p.locator('li', { hasText: 'QA Участник' }).first();
      await row.getByRole('button').last().click();
      await p.waitForTimeout(800);
      await shot(p, 's4-06-remove-menu');
      const b = p.getByRole('button', { name: /Удалить|Снять|Убрать/ }).last();
      if (await b.isVisible().catch(() => false)) { await b.click(); await p.waitForTimeout(800); const c2 = p.locator('[role=alertdialog],[role=dialog]').last().getByRole('button', { name: /Удалить|Снять|Убрать/ }); if (await c2.count()) await c2.last().click(); await p.waitForTimeout(1500); }
      log('participant left:', await p.getByText('QA Участник').count(), (await p.locator('main').innerText()).match(/\d+ из \d+[^\n]*/)?.[0]);
    });
    await step('journal shows event', async () => {
      await goto(p, '/biz/journal');
      await shot(p, 's4-05-journal');
    });
    log('errors', p.errors);
    await c.close();
  }
} finally { await stop(); }
