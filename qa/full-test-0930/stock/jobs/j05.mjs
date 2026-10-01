export default async (t, log) => {
  log(await t.page.evaluate(() => [...document.querySelectorAll('main button')].slice(0,8).map(b => b.outerHTML.slice(0,300))));
};
