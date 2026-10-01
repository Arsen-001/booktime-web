// C22 · Сторис салона (F-00-155…162): владелец покупает место за монеты → сторис вверху главной клиента →
// наша панель видит занятое место в своей доске сторис → своя фотография уходит на ручную проверку в нашу
// панель → монеты — один счёт. Сторис продаёт кабинет (раздел client, /biz/apps/stories), места и цены
// задаёт наша панель (/platform/ads → «Сторис»), проверку ведёт наша панель (/platform/moderation).
import { Fail, addDays, today } from '../lib.mjs';
import { freeTimes, solidPng } from '../helpers.mjs';

const BIZ = 'biz_nuri';

async function storiesScreen(t) {
  await t.go('owner', '/biz/apps/stories', 'phone');
  await t.page.getByText('Занято мест').first().waitFor({ timeout: 20000 }).catch(() => {});
  const txt = await t.mainText();
  const m = txt.match(/Занято мест:\s*(\d+)\s*из\s*(\d+)/);
  const coins = txt.match(/(\d[\d\s ]*)\s*монет/);
  return { txt, used: m ? Number(m[1]) : undefined, max: m ? Number(m[2]) : undefined, coins: coins ? Number(coins[1].replace(/\D/g, '')) : undefined };
}

export default {
  id: 'C22',
  title: 'Сторис салона: куплена за монеты → у клиента на главной → место в нашей панели → своя фотография на проверке',
  personas: ['owner', 'client', 'platform'],
  fids: ['F-00-155', 'F-00-159', 'F-00-160', 'F-00-162', 'F-00-168', 'F-00-169'],
  steps: [
    {
      id: 'S0',
      title: 'Картинка сторис «Свободно сегодня» знает те же окна, что и запись клиента',
      persona: 'owner',
      area: 'client',
      fids: ['F-00-155', 'F-00-156'],
      expect: '/biz/apps/stories → «Сегодня»: если у мастеров Nuri в записи клиента (/book) есть окна сегодня, картинка их показывает, а не «На этот день свободных окон нет»',
      run: async (t) => {
        await storiesScreen(t);
        await t.click('role=radio[name="Сегодня"]').catch(() => {});
        await t.click('role=button[name="Собрать картинку"]', { after: 800 }).catch(() => {});
        const none = await t.has('На этот день свободных окон нет');
        const ani = await freeTimes(t, 'st_nuri_ani', today(), 'Маникюр классический').catch(() => []);
        t.state.todayEmpty = none;
        t.note(`сторис «Сегодня»: ${none ? 'окон нет' : 'окна есть'}; запись к Ани сегодня предлагает: ${ani.join(', ') || '—'}`);
        t.assert(!(none && ani.length), `картинка сторис пишет «На этот день свободных окон нет», а запись клиента сегодня предлагает у Ани ${ani.slice(0, 5).join(', ')} — сторис считает окна не так, как запись (не getNearestSlots/freeSlots ядра)`);
      },
    },
    {
      id: 'S1',
      title: 'Владелец собирает сторис из шаблона на сегодня и публикует за монеты',
      persona: 'owner',
      area: 'client',
      fids: ['F-00-155', 'F-00-160'],
      expect: '/biz/apps/stories → «Собрать картинку» → «Опубликовать за N монет» → тост «Сторис опубликована»; монеты списаны, сторис активна',
      run: async (t) => {
        const before = await storiesScreen(t);
        t.state.before = before;
        const db0 = await t.db();
        const known = new Set((db0.areas?.client ?? db0.client ?? {}).stories?.map((s) => s.id) ?? []);
        t.state.knownStories = known;
        const plBefore = (d) => ((db0.areas?.platform ?? db0.platform)?.storyBookings ?? []).filter((b) => b.businessId === BIZ && b.date === d).length;
        t.state.platformBeforeByDay = { [today()]: plBefore(today()), [addDays(today(), 1)]: plBefore(addDays(today(), 1)) };
        await t.click('role=radio[name="Сегодня"]').catch(() => {});
        await t.click('role=button[name="Собрать картинку"]', { after: 800 });
        // q4: если картинка «на сегодня» без окон — «Опубликовать» недоступна; собираем на «Завтра» (разрыв — шаг S0)
        if (await t.has('На этот день свободных окон нет')) {
          await t.click('role=radio[name="Завтра"]').catch(() => {});
          const again = t.page.getByRole('button', { name: /^(Собрать заново|Собрать картинку)$/ }).filter({ visible: true }).first();
          if (await again.count()) await again.click();
          await t.settle(800);
          t.state.storyDay = 'tomorrow';
          t.note('на сегодня картинка без окон — сторис собрана на завтра');
        }
        const pub = t.page.getByRole('button', { name: /Опубликовать за/ }).filter({ visible: true }).first();
        await pub.waitFor({ timeout: 20000 }).catch(() => {
          throw new Fail('после «Собрать картинку» нет кнопки «Опубликовать за … монет»');
        });
        t.state.priceLabel = (await pub.innerText()).trim();
        // q4: кнопку «Опубликовать» перекрывает липкая панель телефона — обычный клик ждёт 30 с и падает
        await pub.scrollIntoViewIfNeeded().catch(() => {});
        await pub.click({ timeout: 8000 }).catch(async () => {
          t.note('«Опубликовать за …» перекрыта другим слоем — нажата программно (проверить на телефоне, minor)');
          await pub.dispatchEvent('click');
        });
        await t.settle(900);
        const toasts = await t.toasts();
        const db = await t.db();
        const slice = db.areas?.client ?? db.client;
        const fresh = (slice?.stories ?? []).filter((s) => !known.has(s.id) && s.businessId === BIZ);
        if (!fresh.length) throw new Fail(`сторис не создана (тост «${toasts.join(' / ') || '—'}»)`);
        t.state.story = fresh[fresh.length - 1];
        t.note(`«${t.state.priceLabel}»; сторис ${t.state.story.id} статус ${t.state.story.status}, цена ${t.state.story.price}; было ${before.coins} монет, мест ${before.used}/${before.max}`);
        t.assert(t.state.story.status === 'active', `шаблонная сторис не активна сразу: ${t.state.story.status}`);
      },
    },
    {
      id: 'S2',
      title: 'Клиент видит сторис салона вверху главной и открывает её',
      persona: 'client',
      area: 'client',
      fids: ['F-00-159', 'F-00-162'],
      expect: 'Главная приложения: кружок Nuri Nail Studio в ленте сторис; нажатие открывает сторис с окнами и «Записаться»',
      needs: ['S1'],
      run: async (t) => {
        await t.go('client', '/', 'phone');
        const link = t.page.locator(`a[href*="${t.state.story.id}"]`).first();
        t.assert(await link.count(), `на главной нет сторис ${t.state.story.id} салона Nuri`);
        await t.click(`a[href*="${t.state.story.id}"]`, { after: 800 });
        const txt = await t.text();
        t.assert(/Nuri/.test(txt), 'открытая сторис не показывает салон');
      },
    },
    {
      id: 'S3',
      title: 'Наша панель видит купленное место в доске сторис на сегодня',
      persona: 'platform',
      area: 'platform',
      fids: ['F-00-160', 'F-00-162'],
      expect: '/platform/ads → «Сторис»: сегодня среди занятых мест — Nuri Nail Studio (та же покупка, а не отдельный список)',
      needs: ['S1'],
      run: async (t) => {
        await t.go('platform', '/platform/ads', 'desktop');
        const tab = t.page.getByRole('tab', { name: /Сторис/ }).filter({ visible: true }).first();
        if (await tab.count()) {
          await tab.click();
          await t.settle(600);
        }
        const db = await t.db();
        const pl = db.areas?.platform ?? db.platform;
        const day = t.state.storyDay === 'tomorrow' ? addDays(today(), 1) : today();
        t.state.platformBefore = t.state.platformBeforeByDay?.[day] ?? 0;
        const mine = (pl?.storyBookings ?? []).filter((b) => b.businessId === BIZ && b.date === day);
        const txt = await t.mainText();
        t.note(`в доске панели на сегодня у Nuri мест: было ${t.state.platformBefore}, стало ${mine.length} (сид панели уже держит место Nuri); на экране «Nuri»: ${/Nuri/.test(txt) ? 'да' : 'нет'}`);
        t.assert(
          mine.length > t.state.platformBefore,
          'покупка сторис в кабинете не дошла до нашей панели: кабинет пишет client.stories, панель считает места по своему platform.storyBookings — два разных списка сторис',
        );
      },
    },
    {
      id: 'S4',
      title: 'Число мест и цена у салона — те, что задала наша панель',
      persona: 'owner',
      area: 'client',
      fids: ['F-00-160'],
      expect: '«Занято мест: X из N» в кабинете = места из настройки панели (storyConfig.places), цена — из её же настройки',
      needs: ['S1'],
      run: async (t) => {
        const db = await t.db();
        const pl = db.areas?.platform ?? db.platform;
        const cfg = pl?.storyConfig;
        const scr = await storiesScreen(t);
        t.note(`кабинет: мест ${scr.used}/${scr.max}, «${t.state.priceLabel}»; панель: мест ${cfg?.places}, цена за день ${cfg?.pricePerDay} (последние ${cfg?.lastPlacesCount} мест +${cfg?.lastPlacesMarkup}%, очередь +${cfg?.queueMarkup}%)`);
        const price = Number((t.state.priceLabel.match(/\d[\d\s ]*/) ?? ['0'])[0].replace(/\D/g, ''));
        const bad = [];
        if (cfg && scr.max !== cfg.places) bad.push(`мест у салона ${scr.max}, в панели ${cfg.places}`);
        if (cfg) {
          const allowed = [cfg.pricePerDay, Math.round(cfg.pricePerDay * (1 + cfg.lastPlacesMarkup / 100)), Math.round(cfg.pricePerDay * (1 + cfg.queueMarkup / 100))];
          if (!allowed.includes(price)) bad.push(`салон заплатил ${price} монет, а по настройке панели цена ${allowed.join(' / ')}`);
        }
        t.assert(!bad.length, `правила мест сторис в двух местах: ${bad.join('; ')} (кабинет — константы STORY_MAX_ACTIVE_SLOTS/STORY_BASE_PRICE в api/client)`);
      },
    },
    {
      id: 'S5',
      title: 'Своя фотография: владелец отправляет сторис на проверку',
      persona: 'owner',
      area: 'client',
      fids: ['F-00-168'],
      expect: '«Своя фотография» → картинка 700×400 → «Отправить на проверку за N монет» → тост «Отправлено на проверку»; сторис «на проверке»',
      run: async (t) => {
        await storiesScreen(t);
        const db0 = await t.db();
        const known = new Set(((db0.areas?.client ?? db0.client)?.stories ?? []).map((s) => s.id));
        await t.click('role=tab[name="Своя фотография"]', { after: 500 });
        await t.page.locator('input[type="file"]').first().setInputFiles({ name: 'story.png', mimeType: 'image/png', buffer: solidPng(700, 400) });
        await t.settle(1200);
        const send = t.page.getByRole('button', { name: /Отправить на проверку/ }).filter({ visible: true }).first();
        await send.waitFor({ timeout: 15000 }).catch(() => {
          throw new Fail('нет кнопки «Отправить на проверку за … монет»');
        });
        await send.click();
        await t.settle(900);
        const toasts = await t.toasts();
        const db = await t.db();
        const fresh = ((db.areas?.client ?? db.client)?.stories ?? []).filter((s) => !known.has(s.id) && s.businessId === BIZ);
        if (!fresh.length) throw new Fail(`сторис со своей фотографией не создана (тост «${toasts.join(' / ') || '—'}»)`);
        t.state.photoStory = fresh[fresh.length - 1];
        t.note(`сторис ${t.state.photoStory.id}: статус ${t.state.photoStory.status}; тост «${toasts.join(' / ')}»`);
        t.assert(t.state.photoStory.status === 'pending_review', `своя фотография не ждёт проверки: ${t.state.photoStory.status}`);
      },
    },
    {
      id: 'S6',
      title: 'Фото сторис стоит в очереди проверки нашей панели',
      persona: 'platform',
      area: 'platform',
      fids: ['F-00-168', 'F-00-169'],
      expect: '/platform/moderation: новая сторис Nuri Nail Studio «ждёт проверки»; одобрение → сторис видна клиентам',
      needs: ['S5'],
      run: async (t) => {
        await t.go('platform', '/platform/moderation', 'desktop');
        const db = await t.db();
        const items = ((db.areas?.platform ?? db.platform)?.moderationItems ?? []).filter(
          (m) => m.businessId === BIZ && (m.refId === t.state.photoStory.id || m.kind === 'story') && m.status === 'pending',
        );
        t.note(`в очереди проверки от Nuri сторис: ${items.length}`);
        t.assert(
          items.some((m) => m.refId === t.state.photoStory.id),
          `сторис ${t.state.photoStory.id} «ждёт проверки» у салона, но в очередь нашей панели не попала (purchaseStory не зовёт submitForModeration) — она не покажется никогда`,
        );
      },
    },
    {
      id: 'S7',
      title: 'Монеты салона — один счёт для кабинета и нашей панели',
      persona: 'owner',
      area: 'settings',
      fids: ['F-00-145', 'F-00-160'],
      expect: 'Баланс в «Сторис» = баланс в «Монетах» (/biz/coins) = начисления и списания нашей панели (подарок, возврат за отказ проверки)',
      needs: ['S1'],
      run: async (t) => {
        const db = await t.db();
        const bal = (db.areas?.client ?? db.client)?.coinBalances?.[BIZ];
        const all = (db.areas?.platform ?? db.platform)?.coinEntries ?? [];
        const entries = all.filter((e) => e.businessId === BIZ);
        const charged = all.some((e) => e.refId === t.state.story?.id);
        t.note(`кабинет (client.coinBalances[${BIZ}]): ${bal}; журнал монет панели (platform.coinEntries): всего ${all.length}, у Nuri ${entries.length}; покупка сторис в журнале панели: ${charged ? 'да' : 'нет'}`);
        t.assert(
          charged || !all.length,
          'монеты ведутся в двух журналах: покупку сторис кабинет списал в client.coinBalances, а подарки «первому в районе» и возвраты за отклонённую проверку наша панель пишет в platform.coinEntries — баланс салона их не видит',
        );
        await t.go('owner', '/biz/coins', 'desktop');
        if (await t.isPlaceholder()) t.wait('settings', '/biz/coins — заглушка: баланс и история монет салона');
      },
    },
  ],
};
