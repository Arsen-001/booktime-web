// C10 · Модерация фото мастера (F-00-168, F-00-170, F-00-085): мастер загрузил → ждёт проверки →
// наша панель одобрила → фото видно клиенту в карточке мастера; отказ → мастер видит причину.
export default {
  id: 'C10',
  title: 'Фото мастера: загрузка → модерация в нашей панели → фото у клиента',
  personas: ['master', 'platform', 'client'],
  fids: ['F-00-085', 'F-00-168', 'F-00-170'],
  steps: [
    {
      id: 'S1',
      title: 'Мастер загружает фото работы (6 мест), видит «на проверке»',
      persona: 'master',
      area: 'services',
      fids: ['F-00-085', 'F-00-170'],
      expect: 'Карточка сотрудника / услуги: загрузка фото, счётчик мест 1 из 6, статус «на проверке»',
      run: async (t) => {
        await t.openOrWait('master', '/biz/staff/st_nuri_ani', 'staff', 'карточка сотрудника /biz/staff/[id] — заглушка; фото работ — вклад services');
        await t.expectText('Фото');
      },
    },
    {
      id: 'S2',
      title: 'Наша панель: фото мастера в очереди проверки → «Одобрить»',
      persona: 'platform',
      area: 'platform',
      fids: ['F-00-168'],
      expect: '/platform/moderation → «Фото — …» (Фото мастера) → «Одобрить» → статус «Одобрено»',
      run: async (t) => {
        await t.go('platform', '/platform/moderation', 'desktop');
        const db = await t.db();
        const item = db.areas.platform.moderationItems.find((m) => m.kind === 'staffPhoto' && m.status === 'pending' && m.staffId);
        t.assert(item, 'в очереди нет фото мастера на проверке');
        t.state.item = item;
        await t.click(`text=${item.label}`, { after: 500 });
        await t.click('role=button[name="Одобрить"]', { after: 800 });
        const after = await t.db();
        const it = after.areas.platform.moderationItems.find((m) => m.id === item.id);
        t.assert(it.status === 'approved', `статус после «Одобрить»: ${it.status}`);
        t.state.approved = it;
        t.note(`одобрено ${it.id}: мастер ${it.staffId}, refId ${it.refId}, imageUrl ${it.imageUrl ?? '—'}`);
      },
    },
    {
      id: 'S3',
      title: 'Одобренное фото появилось у клиента в карточке мастера',
      persona: 'client',
      area: 'platform',
      fids: ['F-00-168', 'F-00-085'],
      expect: '/masters/<мастер> → «Фото работ» с этим фото',
      needs: ['S2'],
      run: async (t) => {
        const it = t.state.approved;
        const db = await t.db();
        const staff = db.core.staff.find((s) => s.id === it.staffId);
        await t.go('client', `/masters/${it.staffId}`);
        const txt = await t.mainText();
        const linked = staff.photos.includes(it.imageUrl) || staff.photos.includes(it.refId);
        t.assert(linked && txt.includes('Фото работ'), `одобрение не дошло до клиента: у мастера ${staff.name} Staff.photos = ${staff.photos.length} шт., элемент очереди ссылается на «${it.refId}», которого нет ни у мастера, ни у услуги; в карточке «Фото работ» ${txt.includes('Фото работ') ? 'есть' : 'нет'}`);
      },
    },
    {
      id: 'S4',
      title: 'До одобрения фото клиентам не показывается',
      persona: 'client',
      area: 'client',
      fids: ['F-00-168'],
      expect: 'Карточка мастера показывает только одобренные фото (фильтр по статусу проверки)',
      run: async (t) => {
        const db = await t.db();
        const pending = db.areas.platform.moderationItems.find((m) => m.kind === 'staffPhoto' && m.status === 'pending' && m.staffId);
        t.assert(pending, 'нет фото на проверке для сверки');
        const staff = db.core.staff.find((s) => s.id === pending.staffId);
        const linked = staff.photos.filter((p) => db.areas.platform.moderationItems.some((m) => m.imageUrl === p || m.refId === p));
        t.assert(!staff.photos.length || linked.length === staff.photos.length, `у мастера ${staff.name} ${staff.photos.length} фото показываются клиенту без статуса проверки (ни одно не связано с очередью; isVisibleToClients() клиент не вызывает)`);
      },
    },
    {
      id: 'S5',
      title: 'Отказ с причиной → мастер видит статус и причину, место освобождается',
      persona: 'master',
      area: 'services',
      fids: ['F-00-170'],
      expect: 'Панель: «Отклонить» + причина → у мастера у фото «Отклонено: <причина>»',
      run: async (t) => {
        await t.openOrWait('master', '/biz/services', 'services', 'фото работ мастера и их статусы проверки — нет экрана у мастера');
        t.fail('услуги построены — дописать проверку статуса фото у мастера');
      },
    },
  ],
};
