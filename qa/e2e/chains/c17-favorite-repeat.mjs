// C17 · ❤ Подписка (F-00-113) → «Избранное» → приглушить новости (F-00-115) → «Мои мастера» (F-00-118) →
// «Повторить запись» из прошлого визита → запись в журнале салона.
import { Fail } from '../lib.mjs';
import { bookingById, journalBlockText } from '../helpers.mjs';

const GAYANE = 'st_nuri_gayane';
const PAST = 'bk_0080'; // сид: au_01 у Ани Саргсян, гель-лак, прошедший визит

export default {
  id: 'C17',
  title: '❤ Подписка → «Избранное» → «Повторить запись» → журнал салона',
  personas: ['client', 'admin'],
  fids: ['F-00-113', 'F-00-115', 'F-00-118', 'F-00-092'],
  steps: [
    {
      id: 'S1',
      title: 'Клиент подписывается на мастера ❤',
      persona: 'client',
      area: 'client',
      fids: ['F-00-113'],
      expect: 'Карточка Гаяне → «Подписаться» → кнопка меняется на «Отписаться», мастер в «Избранном → Подписки»',
      run: async (t) => {
        await t.go('client', `/masters/${GAYANE}`);
        const btn = t.page.locator('[data-f~="F-00-113"]').first();
        if (!(await btn.count())) t.fail('на карточке мастера нет ❤ «Подписаться»');
        const label = async () => `${(await btn.innerText()).trim()} ${(await btn.getAttribute('aria-label')) ?? ''} ${(await btn.getAttribute('aria-pressed')) ?? ''}`;
        if (/Отписаться|true/.test(await label())) t.note('Гаяне уже в подписках по сиду');
        else {
          await btn.click();
          await t.settle(900);
          await t.page.waitForFunction(() => /Отписаться/.test(document.querySelector('[data-f~="F-00-113"]')?.textContent ?? '') || document.querySelector('[data-f~="F-00-113"]')?.getAttribute('aria-pressed') === 'true', null, { timeout: 5000 }).catch(() => {});
          t.assert(/Отписаться|true/.test(await label()), `после нажатия кнопка: «${await label()}»`);
        }
        await t.go('client', '/favorites');
        await t.expectText('Гаяне Оганесян', 'мастера нет в «Избранном → Подписки»');
      },
    },
    {
      id: 'S2',
      title: 'Приглушить новости, не отписываясь',
      persona: 'client',
      area: 'client',
      fids: ['F-00-115'],
      expect: 'Переключатель «Новости» у Гаяне выключается, подписка остаётся; после перезагрузки — так же',
      needs: ['S1'],
      run: async (t) => {
        await t.go('client', '/favorites');
        const row = t.page.locator('main a[href="/masters/' + GAYANE + '"]').first().locator('xpath=ancestor::*[.//*[@role="switch"]][1]');
        const sw = row.getByRole('switch').first();
        if (!(await sw.count())) t.fail('у мастера в «Подписках» нет переключателя «Новости»');
        const was = await sw.getAttribute('aria-checked');
        await sw.click();
        await t.settle(500);
        await t.go('client', '/favorites');
        const now = await t.page.locator('main a[href="/masters/' + GAYANE + '"]').first().locator('xpath=ancestor::*[.//*[@role="switch"]][1]').getByRole('switch').first().getAttribute('aria-checked');
        t.assert(now !== was, `переключатель «Новости» не сохранился (${was} → ${now})`);
        await t.expectText('Гаяне Оганесян', 'после «приглушить» мастер пропал из подписок');
      },
    },
    {
      id: 'S3',
      title: '«Мои мастера» — все, к кому клиент уже ходил через приложение',
      persona: 'client',
      area: 'client',
      fids: ['F-00-118'],
      expect: 'Главная и «Избранное → Мои мастера» показывают Ани Саргсян (визит через приложение)',
      run: async (t) => {
        await t.go('client', '/favorites');
        await t.click('role=tab[name=/Мои мастера/]', { after: 400 });
        await t.expectText('Ани Саргсян', 'в «Мои мастера» нет мастера прошлого визита');
      },
    },
    {
      id: 'S4',
      title: '«Повторить запись» ведёт в запись с той же услугой у того же мастера',
      persona: 'client',
      area: 'client',
      fids: ['F-00-118', 'F-00-092'],
      expect: '/bookings/<прошлый визит> → «Повторить запись» → поток записи без выбора услуги, сразу время',
      run: async (t) => {
        const db = await t.db();
        const past = bookingById(db, PAST);
        if (!past) throw new Fail(`в сиде нет прошлого визита ${PAST}`);
        t.state.past = past;
        const known = new Set(db.core.bookings.map((b) => b.id));
        await t.go('client', `/bookings/${PAST}`);
        await t.click('a:has-text("Повторить запись")', { after: 300 });
        await t.page.waitForURL(/\/book\?/, { timeout: 12000 }).catch(() => {});
        await t.settle(500);
        t.assert(t.page.url().includes(`staff=${past.staffId}`) && t.page.url().includes(`service=${past.services[0].serviceId}`), `«Повторить» открыл ${t.page.url()}`);
        await t.expectNoText('Выберите услугу', 'услуга уже известна, а поток снова просит выбрать её');
        const slot = t.page.locator('button.min-h-11').first();
        await slot.waitFor({ state: 'visible', timeout: 12000 }).catch(() => {
          throw new Fail('после «Повторить» нет окон');
        });
        await slot.click();
        await t.settle(300);
        if (await t.has('Оттенок или вариант')) {
          const cont = t.page.getByRole('button', { name: 'Продолжить' });
          if (await cont.first().isDisabled()) {
            t.note('шаг «Оттенок»: написано «выбор желателен, но необязателен», а «Продолжить» не нажимается без выбора — выбираем первый оттенок');
            await t.page.getByRole('radio').first().click();
            await t.settle(200);
          }
          if (await cont.count()) await cont.first().click();
          await t.settle(300);
        }
        await t.click('role=button[name="Подтвердить запись"]', { after: 1200 });
        const after = await t.db();
        const created = after.core.bookings.filter((b) => !known.has(b.id));
        t.assert(created.length, 'повторная запись не создана');
        t.state.booking = created[created.length - 1];
        t.assert(t.state.booking.services[0]?.serviceId === past.services[0].serviceId, 'повторная запись с другой услугой');
      },
    },
    {
      id: 'S5',
      title: 'Повторная запись видна администратору салона',
      persona: 'admin',
      area: 'journal',
      fids: ['F-00-001', 'F-00-093'],
      expect: 'Журнал Nuri на эту дату: блок с «Ани М.» у Ани Саргсян',
      needs: ['S4'],
      run: async (t) => {
        const b = t.state.booking;
        await t.go('admin', `/biz/journal?date=${b.start.slice(0, 10)}`, 'desktop');
        const blocks = await journalBlockText(t, b);
        t.assert(blocks.some((x) => /Ани М/.test(x)), `в журнале: «${blocks.join(' || ').replace(/\n/g, ' · ') || 'блока нет'}»`);
      },
    },
    {
      id: 'S6',
      title: 'Мастер получает уведомление о новой записи',
      persona: 'master',
      area: 'journal',
      fids: ['F-00-001', 'F-00-093'],
      expect: 'Колокольчик кабинета у Ани: «Новая запись · Ани М. · <время>»',
      needs: ['S4'],
      run: async (t) => {
        await t.go('master', '/biz/journal', 'desktop');
        await t.click('header button[aria-label="Уведомления"]', { after: 500 });
        const txt = await t.page.locator('[role="dialog"]').last().innerText().catch(() => '');
        t.assert(!/Новых уведомлений нет/.test(txt), `колокольчик мастера пуст после записи клиента через приложение: «${txt.replace(/\n+/g, ' · ').slice(0, 120)}»`);
      },
    },
  ],
};
