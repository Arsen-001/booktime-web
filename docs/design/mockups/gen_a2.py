# -*- coding: utf-8 -*-
# «A + складная панель дня» — пользователь выбрал A и спросил, не добавить ли панель справа из B (26.09).
import io, os, json

ROOT = os.path.dirname(os.path.abspath(__file__))
src = io.open(os.path.join(ROOT, 'gen.py'), encoding='utf-8').read()
ns = {'__file__': os.path.join(ROOT, 'gen.py')}
exec(src.split('\nBOARDS = [')[0], ns)
g = type('G', (), ns)
C, ic, btn, seg, avatar, head, tail, sidebar, day_grid, STAFF = (ns[k] for k in ('C', 'ic', 'btn', 'seg', 'avatar', 'head', 'tail', 'sidebar', 'day_grid', 'STAFF'))
P = os.path.join(ROOT, 'project')

def toolbar(W, left=72):
    o = ['<header style="position: absolute; left: %dpx; right: 0; top: 0; height: 72px; box-sizing: border-box; padding: 0 28px; display: flex; align-items: center; gap: 14px; background: #fff; border-bottom: 1px solid %s">' % (left, C['border'])]
    o.append('<div style="display: flex; align-items: center; gap: 4px">%s%s</div>' % (btn('', 'chev_l', ghost=True, aria='Предыдущий день'), btn('', 'chev_r', ghost=True, aria='Следующий день')))
    o.append('<button type="button" style="border: none; background: transparent; display: flex; align-items: baseline; gap: 10px; cursor: pointer; padding: 0"><span style="font-size: 22px; font-weight: 700; color: %s">Пятница, 26 сентября</span><span style="font-size: 14px; color: %s">сегодня</span>%s</button>' % (C['fg'], C['muted'], ic('chev_d', 16, C['muted'])))
    o.append('<div style="flex-grow: 1"></div>')
    o.append(seg(['День', 'Неделя', 'Месяц'], 'День'))
    o.append('<div style="display: flex; align-items: center; padding-left: 6px">')
    for i, s in enumerate(STAFF):
        o.append('<div style="margin-left: %dpx">%s</div>' % (0 if i == 0 else -8, avatar(s[2], s[3], 32)))
    o.append('<span style="font-size: 13px; color: %s; margin-left: 8px">Все мастера</span></div>' % C['muted'])
    o.append(btn('', 'search', aria='Поиск'))
    o.append(btn('Новая запись', 'plus', primary=True))
    o.append('</header>')
    return ''.join(o)

def summary(x, y):
    o = ['<div style="position: absolute; left: %dpx; top: %dpx; display: flex; gap: 24px; font-size: 13px; color: %s">' % (x, y, C['muted'])]
    for k, v in [('записей', '15'), ('выручка', '142 000 ֏'), ('свободных окон', '7'), ('ждут подтверждения', '3')]:
        col = C['warning'] if k.startswith('ждут') else C['fg']
        o.append('<span><b style="color: %s; font-weight: 600">%s</b> %s</span>' % (col, v, k))
    o.append('</div>')
    return ''.join(o)

def panel_open(x, y, w):
    o = ['<aside aria-label="Сводка дня" style="position: absolute; left: %dpx; top: %dpx; width: %dpx; display: flex; flex-direction: column; gap: 14px">' % (x, y, w)]
    o.append('<div style="display: flex; align-items: center; justify-content: space-between"><span style="font-size: 15px; font-weight: 700">Требует внимания</span>%s</div>' % btn('', 'chev_r', ghost=True, h=32, aria='Свернуть панель'))
    # ждут подтверждения — всегда сверху
    o.append('<div style="background: #fff4e0; border: 1px solid #f3d9ad; border-radius: 16px; padding: 14px 16px; display: flex; flex-direction: column; gap: 10px">')
    o.append('<div style="display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 700; color: %s">%s 3 ждут подтверждения</div>' % (C['warning'], ic('clock', 18, C['warning'])))
    for t, cl, who in [('17:00', 'Мари Т.', 'Мариам'), ('16:30', 'Кристине А.', 'Лала'), ('17:30', 'Рузанна Д.', 'Гаяне')]:
        o.append('<div style="display: flex; align-items: center; gap: 8px; font-size: 13px"><b style="width: 40px">%s</b><span style="flex-grow: 1">%s <span style="color: #6e4a12">· %s</span></span><button type="button" aria-label="Подтвердить" style="width: 32px; height: 32px; border-radius: 9px; border: none; background: #fff; color: %s; display: flex; align-items: center; justify-content: center">%s</button></div>' % (t, cl, who, C['success'], ic('check', 16, C['success'], 2.5)))
    o.append('<div style="font-size: 12px; color: #6e4a12">Ответьте до 15:20 — иначе заявки снимутся сами</div>')
    o.append('</div>')
    # лист ожидания — подсказка с деньгами
    o.append('<div style="background: #fff; border: 1px solid %s; border-radius: 16px; padding: 14px 16px; display: flex; flex-direction: column; gap: 8px">' % C['border'])
    o.append('<div style="display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 700">%s Можно заполнить окно</div>' % ic('hourglass', 18, C['primary']))
    o.append('<div style="font-size: 13px; color: %s">Лала свободна <b style="color: %s">14:00–16:30</b>. В листе ожидания 2 клиентки на маникюр сегодня.</div>' % (C['muted'], C['fg']))
    o.append('<button type="button" style="align-self: flex-start; height: 36px; padding: 0 14px; border-radius: 10px; border: none; background: %s; color: %s; font-size: 13px; font-weight: 600">Предложить окно</button>' % (C['primarySoft'], C['primary']))
    o.append('</div>')
    # дальше — когда есть место
    o.append('<div style="background: #fff; border: 1px solid %s; border-radius: 16px; padding: 14px 16px; display: flex; flex-direction: column; gap: 10px">' % C['border'])
    o.append('<div style="font-size: 14px; font-weight: 700">Дальше</div>')
    for (t, cl, sv, who, hx) in [('14:00', 'Анаит М.', 'Снятие + маникюр', 'Гаяне', '#f0b7a4'), ('14:30', 'Нарине К.', 'SPA-педикюр', 'Мариам', '#8fb9a8'), ('15:30', 'Гоар П.', 'Наращивание', 'Гаяне', '#e3a9c1')]:
        o.append('<div style="display: flex; gap: 10px; align-items: center"><span style="font-size: 13px; font-weight: 700; width: 40px">%s</span><span style="width: 12px; height: 12px; border-radius: 99px; background: %s; flex-shrink: 0"></span><div style="display: flex; flex-direction: column; min-width: 0"><span style="font-size: 13px; font-weight: 600">%s</span><span style="font-size: 12px; color: %s">%s · %s</span></div></div>' % (t, hx, cl, C['muted'], sv, who))
    o.append('</div>')
    o.append('</aside>')
    return ''.join(o)

def panel_rail(x, y, h):
    o = ['<aside aria-label="Сводка дня (свёрнута)" style="position: absolute; left: %dpx; top: %dpx; width: 56px; height: %dpx; background: #fff; border: 1px solid %s; border-radius: 16px; display: flex; flex-direction: column; align-items: center; padding-top: 10px; gap: 10px; box-sizing: border-box">' % (x, y, h, C['border'])]
    o.append(btn('', 'chev_l', ghost=True, h=36, aria='Развернуть панель'))
    for name, n, col, bg in [('clock', '3', C['warning'], '#fff4e0'), ('hourglass', '2', C['primary'], C['primarySoft']), ('list', '', C['muted'], 'transparent')]:
        badge = '<span style="position: absolute; right: -4px; top: -4px; min-width: 18px; height: 18px; border-radius: 99px; background: %s; color: #fff; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center">%s</span>' % (col, n) if n else ''
        o.append('<button type="button" aria-label="%s" style="position: relative; width: 40px; height: 40px; border-radius: 12px; border: none; background: %s; color: %s; display: flex; align-items: center; justify-content: center">%s%s</button>' % (name, bg, col, ic(name, 20, col), badge))
    o.append('</aside>')
    return ''.join(o)

def A2_wide():
    W, H = 1600, 900
    o = [head('A + панель — широкий экран')]
    o.append('<div style="position: relative; width: %dpx; height: %dpx; background: %s; overflow: hidden">' % (W, H, C['bg']))
    o.append(sidebar(H)); o.append(toolbar(W)); o.append(summary(100, 88))
    o.append(day_grid(100, 118, 1160, 760, card_style='T'))
    o.append(panel_open(1284, 108, 292))
    o.append('</div>'); o.append(tail(W, H))
    return ''.join(o)

def A2_laptop():
    W, H = 1280, 800
    o = [head('A + панель — ноутбук, панель свёрнута')]
    o.append('<div style="position: relative; width: %dpx; height: %dpx; background: %s; overflow: hidden">' % (W, H, C['bg']))
    o.append(sidebar(H)); o.append(toolbar(W)); o.append(summary(100, 88))
    o.append(day_grid(100, 118, 1076, 664, card_style='T'))
    o.append(panel_rail(1196, 118, 664))
    o.append('</div>'); o.append(tail(W, H))
    return ''.join(o)

def A2_phone():
    W, H = 390, 844
    o = [head('A + панель — телефон: плашка над сеткой')]
    o.append('<div style="position: relative; width: %dpx; height: %dpx; background: %s; overflow: hidden; display: flex; flex-direction: column">' % (W, H, C['bg']))
    o.append(ns['phone_top']('Сентябрь', 'Nuri Nail Studio'))
    o.append(ns['week_strip']())
    o.append('<button type="button" style="margin: 10px 8px 0; height: 44px; border-radius: 14px; border: 1px solid #f3d9ad; background: #fff4e0; color: %s; display: flex; align-items: center; gap: 8px; padding: 0 12px; font-size: 14px; font-weight: 600">%s 3 ждут подтверждения<span style="margin-left: auto; font-size: 12px; font-weight: 500; color: #6e4a12">до 15:20</span>%s</button>' % (C['warning'], ic('clock', 18, C['warning']), ic('chev_r', 16, C['warning'])))
    o.append('<div style="position: relative; flex-grow: 1">')
    o.append(day_grid(8, 8, 374, 560, start='10:00', end='17:00', cols=2, card_style='T', header_h=48, compact=True, col_w=161))
    o.append('</div>')
    o.append(ns['fab']()); o.append(ns['tabbar']())
    o.append('</div>'); o.append(tail(W, H))
    return ''.join(o)

NEW = [('A2-wide.dc.html', 'A + панель — широкий экран (панель открыта)', A2_wide, 1600, 900, 0),
       ('A2-laptop.dc.html', 'A + панель — ноутбук (панель свёрнута)', A2_laptop, 1280, 800, 1680),
       ('A2-phone.dc.html', 'A + панель — телефон (плашка)', A2_phone, 390, 844, 3040)]
d = json.load(io.open(os.path.join(P, 'canvas.json'), encoding='utf-8'))
Y = 6480
for name, title, fn, w, h, x in NEW:
    io.open(os.path.join(P, name), 'w', encoding='utf-8').write(fn())
    d['boards'][name] = {'x': x, 'y': Y, 'w': w, 'h': h, 'title': title}
    if name not in d['order']:
        d['order'].append(name)
d['notes']['hA2'] = {'x': 0, 'y': Y - 260, 'text': 'A + складная панель «Требует внимания»', 'kind': 'title1', 'maxW': 3430}
io.open(os.path.join(P, 'canvas.json'), 'w', encoding='utf-8').write(json.dumps(d, ensure_ascii=False, indent=1))
print('ok')
