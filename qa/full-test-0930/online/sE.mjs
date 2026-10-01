// E: новый мастер (пусто) → услуги из шаблона → неделя → «Опубликовать» → страница открыта; C2 отдельно; api=error
import { start, log } from './h.mjs';
const h = await start({ device: 'desktop' });
const p = h.page;
const dump = async (tag, n = 900) => log(tag, (await h.text()).slice(0, n).replace(/\n+/g, ' | '));
const main = async (tag, n = 1200) => log(tag, (await p.locator('main').innerText().catch(() => '')).slice(0, n).replace(/\n+/g, ' | '));
const step = async (name, fn) => { try { await fn(); } catch (e) { log('FAIL', name, e.message.split('\n')[0]); await h.shot('E-fail-' + name); } };
await step('publish', async () => {
  await h.go('/biz/online?empty=1', 'individual');
  await h.shot('E1-links-draft'); await main('E1 links:', 700);
  await h.go('/biz/services', 'individual'); await main('E2 services:', 800);
  const tpl = p.getByRole('button', { name: /из шаблона/i }).or(p.getByRole('link', { name: /из шаблона/i })).or(p.getByText('Добавить из шаблона'));
  log('E2 template buttons', await tpl.count());
  if (await tpl.count()) {
    await tpl.first().click(); await h.settle(800);
    await p.getByText('Выбрать все').first().click(); await p.waitForTimeout(400);
    await p.getByRole('button', { name: /Добавить выбранные/ }).click(); await h.settle(2000);
    await main('E2 after template:', 600);
  }
  await h.go('/biz/schedule', 'individual'); await main('E3 schedule:', 700);
  const wk = p.getByRole('button', { name: 'Задать неделю' });
  log('E3 set week buttons', await wk.count());
  if (await wk.count()) {
    await wk.first().click(); await h.settle(1000); await h.shot('E3-week');
    const dlg = p.locator('[role="dialog"]').last();
    if (await dlg.count()) {
      log('E3 dialog:', (await dlg.innerText()).replace(/\n+/g, ' | ').slice(0, 600));
      const save = dlg.getByRole('button', { name: /Сохранить|Готово|Применить/ });
      log('E3 save buttons', (await save.allInnerTexts()).join(' / '));
      if (await save.count()) { await save.last().click(); await h.settle(1500); }
    } else {
      const save = p.getByRole('button', { name: /Сохранить/ });
      if (await save.count()) { await save.first().click(); await h.settle(1500); }
    }
    await main('E3 after:', 500);
  }
  await h.go('/biz/online', 'individual'); await h.shot('E4-links-ready'); await main('E4 links:', 600);
  const pub = p.getByRole('button', { name: 'Опубликовать' });
  log('E4 publish enabled', await pub.count() ? await pub.isEnabled() : 'нет кнопки');
  if (await pub.count() && await pub.isEnabled()) {
    await pub.click(); await h.settle(1200);
    await h.shot('E4-after-publish'); await main('E4 after publish:', 500);
    const slug = (await h.db()).core.businesses.find((b) => b.name && b.status === 'active' && b.id.includes('empty'))?.slug;
    log('E4 slug', slug);
    await h.setDevice('phone');
    await h.go('/b/novyi-master', 'guest'); await h.shot('E5-public-after-publish'); await dump('E5 public:', 500);
  }
  await h.setDevice('desktop');
  await h.go('/biz/online?empty=0', 'owner');
});
await step('en', async () => {
  await h.setDevice('phone');
  await h.go('/b/nuri-nail-studio/book', 'guest');
  await p.getByText('Eng', { exact: true }).first().click(); await h.settle(6000); await p.reload(); await h.settle(3000);
  await h.shot('E8-book-en'); await dump('E8 en:', 400);
  await h.go('/b/nuri-nail-studio', 'guest'); await h.shot('E8-public-en'); await dump('E8 public en:', 400);
  await p.getByText('Рус', { exact: true }).first().click(); await h.settle(800);
});
log('errors', h.errors.slice(0, 10).map((e) => e.slice(0, 200)));
await h.end();
