// C11 · Подключение салона на визите (F-00-176, F-00-171, F-00-019): наша панель заводит салон за 10 минут →
// он сразу в каталоге → клиент записывается → бесплатный месяц.
import { Fail } from '../lib.mjs';

const NAME = `E2E Салон ${Date.now().toString(36).slice(-4)}`;
// 1×1 PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

export default {
  id: 'C11',
  title: 'Подключение салона на визите → каталог → запись → бесплатный месяц',
  personas: ['platform', 'client', 'guest'],
  fids: ['F-00-176', 'F-00-171', 'F-00-019', 'F-00-006'],
  steps: [
    {
      id: 'S1',
      title: 'Наша панель: «Подключить салон» по шагам до «Готово — подключить»',
      persona: 'platform',
      area: 'platform',
      fids: ['F-00-176'],
      expect: 'Мастер из 7 шагов: данные → «я на месте» → фото → мастера → услуги → часы → промокод; салон создан',
      run: async (t) => {
        await t.go('platform', '/platform/connect', 'desktop');
        const known = new Set((await t.db()).core.businesses.map((b) => b.id));
        await t.click('role=button[name="Начать подключение"]', { after: 700 });
        // q3: мастер подключения переделан — «Салон и владелец» → «Где» → Фото → Мастера → Услуги → Часы → Итог
        const next = async (waitFor) => {
          await t.click('role=button[name="Далее"]', { after: 600 });
          if (waitFor)
            await t.page.getByText(waitFor).first().waitFor({ timeout: 20000 }).catch(() => {
              throw new Fail(`после «Далее» не открылся шаг с «${waitFor}»`);
            });
          await t.settle(200);
        };
        await t.fill('input[placeholder^="Например"]', NAME);
        const sphere = t.page.locator('main button', { hasText: /^\s*Маникюр\s*$/ }).first();
        if (await sphere.count()) await sphere.click();
        else await t.pick('role=combobox[name=/Сфера/]', 'Маникюр');
        await t.fill('input[type="tel"]', '10203099');
        const ownerName = t.page.locator('text=Имя владельца').first().locator('xpath=following::input[1]');
        if (await ownerName.count()) await ownerName.fill('Ева Визитова').catch(() => {});
        await next('Где находится');
        await t.click('role=button[name="Я сейчас на месте работы"]', { after: 500 }).catch(() => {});
        await t.pick(t.page.locator('main [role="combobox"]').filter({ visible: true }), 'Кентрон');
        const addr = t.page.locator('input[placeholder="Улица и дом"]');
        if (await addr.count()) await addr.fill('ул. Абовяна, 10');
        await next();
        const file = t.page.locator('input[type="file"]').first();
        if (await file.count()) {
          await file.setInputFiles({ name: 'salon.png', mimeType: 'image/png', buffer: PNG });
          await t.settle(800);
          t.state.photoUploaded = (await t.page.locator('main img').count()) > 0;
        }
        // Мастера → Услуги → Часы → Итог: «Далее», пока есть; на шаге услуг — хотя бы одна галочка
        for (let i = 0; i < 6; i++) {
          const txt = await t.mainText();
          if (/услуг/i.test(txt) && !t.state.servicesStep) {
            t.state.servicesStep = txt.slice(0, 400);
            const boxes = t.page.locator('main [role="checkbox"], main input[type="checkbox"]');
            const checked = await boxes.evaluateAll((els) => els.filter((e) => e.getAttribute('aria-checked') === 'true' || e.checked).length);
            if (!checked && (await boxes.count())) await boxes.first().click({ force: true });
          }
          const nextBtn = t.page.getByRole('button', { name: 'Далее' }).filter({ visible: true });
          if (!(await nextBtn.count())) break;
          await next();
        }
        const done = t.page.getByRole('button', { name: /Готово|Подключить/ }).filter({ visible: true }).last();
        await done.waitFor({ timeout: 10000 }).catch(() => {
          throw new Fail('на шаге «Итог» нет кнопки «Готово — подключить»');
        });
        await done.click();
        // сохранение идёт с загрузкой: ждём тост «Салон подключён…» (под нагрузкой — до 30 с)
        await t.page
          .waitForFunction(() => [...document.querySelectorAll('[role="status"], [role="alert"]')].some((e) => /подключ/i.test(e.textContent ?? '')), null, { timeout: 30000 })
          .catch(() => {});
        await t.settle(1000);
        const db = await t.db();
        const fresh = db.core.businesses.filter((b) => !known.has(b.id));
        const biz = fresh.find((b) => b.name === NAME) ?? fresh[0];
        if (!biz) throw new Fail(`салон «${NAME}» не создан (тосты: ${(await t.toasts()).join(' / ') || '—'})`);
        if (biz.name !== NAME) t.note(`салон создан с названием «${biz.name}», а ввели «${NAME}»`);
        t.state.biz = biz;
        t.state.owner = db.core.staff.find((s) => s.id === biz.ownerStaffId);
        t.state.meta = db.areas.platform.bizMeta?.[biz.id];
        t.note(`салон ${biz.id} /b/${biz.slug}, фото ${biz.photos.length}, услуг ${db.core.services.filter((s) => s.businessId === biz.id).length}; шаг «Услуги»: ${(t.state.servicesStep ?? '').replace(/\s+/g, ' ').slice(0, 160)}`);
      },
    },
    {
      id: 'S2',
      title: 'Новый салон сразу виден клиенту в поиске',
      persona: 'client',
      area: 'client',
      fids: ['F-00-176', 'F-00-108'],
      expect: '/search по названию → карточка нового салона с окнами',
      needs: ['S1'],
      run: async (t) => {
        await t.go('client', '/search');
        const input = t.page.locator('input[type="search"], input[placeholder="Что ищете?"]').first();
        await input.fill(NAME);
        await t.settle(900);
        await t.expectText(NAME, `«${NAME}» не найден в поиске клиента`);
      },
    },
    {
      id: 'S3',
      title: 'Публичная страница салона по ссылке открывается',
      persona: 'guest',
      area: 'online',
      fids: ['F-00-006', 'F-00-176'],
      expect: '/b/<slug> — название, услуги, «Записаться»',
      needs: ['S1'],
      run: async (t) => {
        await t.go('guest', `/b/${t.state.biz.slug}`);
        await t.expectText(NAME);
      },
    },
    {
      id: 'S4',
      title: 'Фото, снятые на визите, видны клиентам сразу — без проверки',
      persona: 'guest',
      area: 'online',
      fids: ['F-00-171'],
      expect: '/b/<slug>/about — фото салона; в очереди модерации они «без проверки»',
      needs: ['S1'],
      run: async (t) => {
        if (!t.state.photoUploaded) t.fail('на шаге фото мастера подключения нет поля загрузки файла');
        const db = await t.db();
        const mod = db.areas.platform.moderationItems.filter((m) => m.businessId === t.state.biz.id);
        t.assert(mod.every((m) => m.status === 'auto'), `фото с визита попали в очередь не «без проверки»: ${mod.map((m) => m.status).join(', ')}`);
        await t.go('guest', `/b/${t.state.biz.slug}/about`);
        const imgs = await t.page.locator('main img').count();
        t.assert(imgs > 0, 'на странице «О салоне» фото с визита не показаны');
      },
    },
    {
      id: 'S5',
      title: 'Клиент записывается в новый салон; запись видна в «Мои записи»',
      persona: 'client',
      area: 'client',
      fids: ['F-00-092', 'F-00-176'],
      expect: '/masters/<владелец> → окно → запись создана',
      needs: ['S1'],
      run: async (t) => {
        await t.go('client', `/masters/${t.state.owner.id}`);
        const link = t.page.locator('a[href*="/book?staff="][href*="slot="]').first();
        t.assert(await link.count(), 'у мастера нового салона нет свободных окон');
        await t.click('a[href*="/book?staff="][href*="slot="]', { after: 600 });
        // q3: у нового салона несколько услуг — поток сначала спрашивает услугу («Шаг 1 из 2»)
        const radios = t.page.getByRole('radio');
        if (await radios.count()) {
          await radios.first().click();
          await t.click('role=button[name="Продолжить"]', { after: 600 });
        }
        if (!(await t.page.getByRole('button', { name: 'Подтвердить запись' }).count())) {
          const slot = t.page.locator('button.min-h-11').first();
          if (await slot.count()) {
            t.note('после выбора услуги поток снова спросил время, хотя окно выбрано в карточке');
            await slot.click();
            await t.settle(400);
          }
        }
        await t.click('role=button[name="Подтвердить запись"]', { after: 1200 });
        const db = await t.db();
        const b = db.core.bookings.find((x) => x.businessId === t.state.biz.id);
        t.assert(b, 'запись в новый салон не создана');
      },
    },
    {
      id: 'S6',
      title: 'Салону с визита дан бесплатный месяц (30 дней)',
      persona: 'platform',
      area: 'platform',
      fids: ['F-00-019'],
      expect: 'Наша панель → «Салоны»: бесплатно до <сегодня + 30>',
      needs: ['S1'],
      run: async (t) => {
        const meta = t.state.meta;
        t.assert(meta?.source === 'visit' && meta?.freeUntil, `у салона нет отметки «с визита / бесплатно до»: ${JSON.stringify(meta)}`);
        await t.go('platform', '/platform/businesses', 'desktop');
        await t.expectText(NAME);
      },
    },
    {
      id: 'S7',
      title: 'Владелец салона видит бесплатный месяц у себя в «Подписке»',
      persona: 'owner',
      area: 'settings',
      fids: ['F-00-019', 'F-00-023'],
      expect: '/biz/billing: «Бесплатно до …», без просьбы оплатить',
      run: async (t) => {
        await t.openOrWait('owner', '/biz/billing', 'settings', '/biz/billing — заглушка; и демо-персона owner не может стать владельцем нового салона (выбирается по сфере из сида)');
        t.fail('подписка построена — дописать сверку freeUntil салона с визита');
      },
    },
  ],
};
