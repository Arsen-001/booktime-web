export default async (t, log) => {
  await t.go('owner', '/biz/stock/goods/new');
  const fields = await t.page.evaluate(() => [...document.querySelectorAll('main input, main textarea, main [role=combobox], main [role=switch], main [role=checkbox]')].filter(e=>e.getClientRects().length).map(e => {
    const id = e.id; const lab = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`)?.innerText : '';
    return `${e.tagName}/${e.getAttribute('type')||e.getAttribute('role')||''} name=${e.getAttribute('name')||''} label=${(lab||e.getAttribute('aria-label')||e.getAttribute('placeholder')||'').trim()}`; }));
  log(fields.join('\n'));
  log('BTN', await t.buttons());
  await t.shot('good-new-desktop', true);
};
