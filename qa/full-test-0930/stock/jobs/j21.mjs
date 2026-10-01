const norm = (s) => s.replace(/[  ]/g, ' ');
export default async (t, log) => {
  const p = t.page;
  await t.go('owner', '/biz/stock/order');
  log('order:', norm(await t.text()).replace(/\n+/g,' | ').slice(0, 800));
  const wa = p.getByRole('button', { name: /Отправить в WhatsApp/ });
  log('disabled w/o phone:', await wa.isDisabled());
  log('without phone:', norm(await t.text()).match(/(Введите|Укажите|номер)[^\n]{0,80}/gi)?.slice(0,3));
  await p.getByLabel(/Номер поставщика/).fill('91 234567');
  const [popup] = await Promise.all([p.context().waitForEvent('page', { timeout: 8000 }).catch(() => null), wa.click()]);
  log('popup url:', popup ? decodeURIComponent(popup.url()) : 'none (maybe location change) ' + p.url());
  if (popup) await popup.close();
  await t.shot('order-filled');
  // уведомление владельцу
  await t.go('owner', '/biz/notifications');
  const nt = norm(await t.text()); 
  log('notifications mention stock:', nt.match(/[^\n]*(заканч|критич|остат|Мало|склад)[^\n]*/gi)?.slice(0,5));
  // колокольчик
  await t.go('owner', '/biz/stock');
  const bell = p.getByRole('button', { name: /Уведомлен/ }).first();
  if (await bell.count()) { await bell.click(); await p.waitForTimeout(1200); log('bell:', norm(await p.locator('[role=dialog]:visible, [role=menu]:visible, [data-popover]:visible').last().innerText().catch(()=>'?')).replace(/\n+/g,' | ').slice(0,700)); await t.shot('bell'); }
  else log('no bell button');
};
