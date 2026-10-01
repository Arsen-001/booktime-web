// F-06-152 живой прогон целиком: включить витрину (same-tab SPA-навигация, минуя квоту localStorage),
// купить сертификат на витрине, подтвердить заказ на /biz/loyalty/online-sales/orders.
import { chromium } from 'playwright';
import { acquireBrowserSlot } from '../../../../scripts/pw-slots.mjs';

const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });

  // Один-единственный полный goto за весь прогон (первая загрузка вкладки) — дальше только клики по
  // ссылкам (next/link, in-memory zustand не сбрасывается), чтобы квота localStorage не мешала проверке.
  await page.goto('http://localhost:3710/biz/loyalty/certificates/types?demo=owner', { waitUntil: 'networkidle' });
  const firstTypeLink = page.locator('a[href^="/biz/loyalty/certificates/types/"]:not([href$="/new"])').first();
  await firstTypeLink.evaluate((el) => el.removeAttribute('target'));
  await firstTypeLink.click();
  await page.waitForURL('**/certificates/types/**');
  await page.getByLabel('Доступно для продажи онлайн').check({ force: true }).catch(async () => {
    await page.getByText('Доступно для продажи онлайн').click();
  });
  await page.getByLabel(/Название для онлайн-продажи/i).fill('Подарочный сертификат').catch(() => {});
  await page.getByLabel(/Цена в виджете/i).fill('10000').catch(() => {});
  await page.getByRole('button', { name: /Сохранить|Save/i }).click();
  await page.waitForTimeout(500);

  const onlineSalesNavLink = page.locator('nav a[href="/biz/loyalty/online-sales"]').first();
  await onlineSalesNavLink.click();
  await page.waitForURL('**/online-sales');

  await page.getByRole('tab', { name: 'Виджет' }).click();
  await page.waitForTimeout(200);

  // Включить витрину
  const toggle = page.getByRole('switch').first();
  const wasOn = (await toggle.getAttribute('aria-checked')) === 'true';
  console.log('toggle wasOn:', wasOn);
  if (!wasOn) await toggle.click();
  console.log('toggle after click:', await toggle.getAttribute('aria-checked'));
  await page.getByRole('button', { name: /Сохранить|Save/i }).click();
  await page.waitForTimeout(500);
  console.log('toggle after save:', await toggle.getAttribute('aria-checked'));


  // Перейти на предпросмотр той же вкладкой (убрать target=_blank, чтобы не терять in-memory состояние)
  const previewLink = page.locator('a[href="/biz/loyalty/online-sales/preview"]');
  await previewLink.evaluate((el) => el.removeAttribute('target'));
  await previewLink.click();
  await page.waitForURL('**/online-sales/preview**');
  await page.waitForTimeout(500);

  const full = await page.locator('body').innerText();
  console.log('preview body tail:', full.slice(-1500));

  const buyButtons = page.getByRole('button', { name: /Купить|Buy/i });
  const buyCount = await buyButtons.count();
  console.log('buy buttons on preview:', buyCount);
  if (buyCount > 0) {
    await buyButtons.first().click();
    await page.getByLabel(/Имя|Name/i).fill('Тест Тестов');
    await page.getByLabel(/Телефон|Phone/i).fill('+374 55 123456');
    await page.getByRole('button', { name: /Купить|Оформить|Buy|Order/i }).last().click();
    await page.waitForTimeout(700);
    console.log('order submitted, errors so far:', errors);
  }

  // Закрыть модалку успеха покупки (наша, не нативная) перед дальнейшими кликами
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(300);
  const closeBtn = page.getByRole('dialog').getByRole('button', { name: /Закрыть|Готово|Close|Ok/i }).first();
  if (await closeBtn.count()) await closeBtn.click().catch(() => {});
  await page.waitForTimeout(300);

  // Назад в кабинет (виджет-страница в SPA-стеке) и на «Заказы» ссылкой, не goto
  const ordersBackLink = page.locator('a[href="/biz/loyalty/online-sales"]').first();
  if (await ordersBackLink.count()) {
    await ordersBackLink.click();
    await page.waitForURL('**/online-sales');
    await page.getByRole('tab', { name: 'Виджет' }).click();
  }
  const ordersLink = page.locator('a[href="/biz/loyalty/online-sales/orders"]').first();
  await ordersLink.click();
  await page.waitForURL('**/online-sales/orders**');
  await page.waitForTimeout(500);
  const bodyText = await page.locator('body').innerText();
  console.log('orders page has pending row text:', /Ждёт оплаты|pending/i.test(bodyText));

  if (/Ждёт оплаты/i.test(bodyText)) {
    const confirmBtn = page.getByRole('button', { name: /Подтвердить/i }).first();
    await confirmBtn.click();
    // Наша модалка подтверждения (не нативная) — второй клик в диалоге
    const dialogConfirm = page.getByRole('dialog').getByRole('button', { name: /Подтвердить/i });
    if (await dialogConfirm.count()) await dialogConfirm.click();
    await page.waitForTimeout(600);
    const afterText = await page.locator('body').innerText();
    console.log('order confirmed, status text now:', /Подтверждён|confirmed/i.test(afterText));
  }
  console.log('page errors:', errors);
} finally {
  await browser.close();
  release();
}
