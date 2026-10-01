# -*- coding: utf-8 -*-
# Генератор артбордов «BookTime — журнал: варианты дизайна» (3 направления × компьютер/телефон).
import io, json, os, datetime

ROOT = os.path.dirname(os.path.abspath(__file__))
P = os.path.join(ROOT, 'project')
os.makedirs(P, exist_ok=True)

FONT = "https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;600;700&family=Noto+Sans+Armenian:wght@400;600&display=swap"

C = dict(bg='#f7f7fb', surface='#ffffff', border='#e6e6ef', line='#f0f0f5', fg='#17172a', muted='#6b6b80',
         primary='#4f46e5', primarySoft='#eef0ff', danger='#c0322b', success='#1b7440', warning='#a15c07')

# Категории услуг: мягкая заливка + насыщенный текст/полоса (контраст текста ≥ 4.5:1 на заливке)
CAT = {
    'mani': ('#eef0ff', '#3730a3', '#4f46e5'),
    'pedi': ('#e7f6f2', '#0f5e55', '#0f766e'),
    'design': ('#fdeef5', '#9d174d', '#be185d'),
    'gel': ('#fff3df', '#8a4a06', '#b45309'),
}

STAFF = [
    ('Мариам Петросян', 'Мастер педикюра', 'МП', '#0f766e', '72%', 4),
    ('Сона Григорян', 'Нейл-дизайнер', 'СГ', '#be185d', '55%', 3),
    ('Гаяне Оганесян', 'Мастер маникюра', 'ГО', '#4f46e5', '90%', 6),
    ('Лала Амирян', 'Мастер маникюра', 'ЛА', '#b45309', '40%', 2),
]

# (мастер, начало, конец, клиент, услуга, категория, статус)  статус: ok | wait | here | paid
BK = [
    (0, '10:30', '11:30', 'Ани С.', 'Педикюр классический', 'pedi', 'paid'),
    (0, '11:30', '13:00', 'Седа А.', 'Педикюр с гель-лаком', 'pedi', 'here'),
    (0, '14:30', '16:00', 'Нарине К.', 'SPA-педикюр', 'pedi', 'ok'),
    (0, '17:00', '18:00', 'Мари Т.', 'Педикюр аппаратный', 'pedi', 'wait'),
    (1, '11:00', '12:00', 'Лилит Г.', 'Френч + дизайн', 'design', 'paid'),
    (1, '12:30', '14:30', 'Лиана Р.', 'Укрепление гелем', 'gel', 'here'),
    (1, '16:00', '17:30', 'Ева К.', 'Дизайн, 10 ногтей', 'design', 'ok'),
    (2, '10:00', '11:00', 'Мане Б.', 'Маникюр аппаратный', 'mani', 'paid'),
    (2, '11:00', '12:00', 'Сирануш З.', 'Маникюр аппаратный', 'mani', 'paid'),
    (2, '12:00', '13:45', 'Диана А.', 'Маникюр + гель-лак', 'mani', 'here'),
    (2, '14:00', '15:00', 'Анаит М.', 'Снятие + маникюр', 'mani', 'ok'),
    (2, '15:30', '17:00', 'Гоар П.', 'Наращивание', 'gel', 'ok'),
    (2, '17:30', '18:30', 'Рузанна Д.', 'Маникюр классический', 'mani', 'wait'),
    (3, '13:00', '14:00', 'Тамара В.', 'Маникюр классический', 'mani', 'ok'),
    (3, '16:30', '18:00', 'Кристине А.', 'Маникюр + дизайн', 'design', 'wait'),
]
NOW = '13:20'

def m(t):
    h, mi = t.split(':'); return int(h) * 60 + int(mi)

def esc(s):
    return s.replace('&', '&amp;').replace('<', '&lt;')

ICON = {
    'chev_l': '<path d="M15 18l-6-6 6-6"/>', 'chev_r': '<path d="M9 18l6-6-6-6"/>',
    'chev_d': '<path d="M6 9l6 6 6-6"/>', 'plus': '<path d="M12 5v14M5 12h14"/>',
    'search': '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    'bell': '<path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    'cal': '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    'filter': '<path d="M3 6h18M7 12h10M10 18h4"/>', 'check': '<path d="M20 6L9 17l-5-5"/>',
    'clock': '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    'users': '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    'more': '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    'home': '<path d="M3 10l9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
    'list': '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    'wallet': '<path d="M20 7H5a2 2 0 0 1 0-4h13v4M3 5v14a2 2 0 0 0 2 2h15V7"/><path d="M16 14h.01"/>',
    'chart': '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>',
    'hourglass': '<path d="M6 2h12M6 22h12M7 2c0 6 10 6 10 12v8M17 2c0 6-10 6-10 12v8"/>',
    'phone': '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
    'spark': '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/>',
    'menu': '<path d="M4 6h16M4 12h16M4 18h16"/>',
}

def ic(name, size=18, color='currentColor', sw=2):
    return ('<svg width="%d" height="%d" viewBox="0 0 24 24" fill="none" stroke="%s" stroke-width="%s" '
            'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">%s</svg>') % (size, size, color, sw, ICON[name])

def avatar(initials, color, size=32, ring=False):
    r = 'box-shadow: 0 0 0 2px #fff, 0 0 0 4px %s;' % color if ring else ''
    return ('<div style="width: %dpx; height: %dpx; border-radius: 999px; background: %s1f; color: %s; display: flex; '
            'align-items: center; justify-content: center; font-size: %dpx; font-weight: 600; flex-shrink: 0; %s">%s</div>') % (
        size, size, color, color, max(10, size * 0.36), r, initials)

STATUS = {
    'paid': ('Оплачено', C['success'], 'check'),
    'here': ('Пришла', C['primary'], 'check'),
    'ok': ('Подтверждена', C['muted'], None),
    'wait': ('Ждёт подтверждения', C['warning'], 'clock'),
}

def head(title):
    return ('<!doctype html>\n<html lang="ru">\n<head>\n<meta charset="utf-8">\n<title>%s</title>\n'
            '<script src="./support.js"></script>\n</head>\n<body>\n<x-dc>\n<helmet>\n'
            '<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="stylesheet" href="%s">\n<style>\n'
            'body{margin:0;font-family:"Noto Sans","Noto Sans Armenian",system-ui,sans-serif;color:%s;background:%s}\n'
            'a{color:%s}a:hover{color:#4338ca}\nbutton{font-family:inherit}\n</style>\n</helmet>\n') % (title, FONT, C['fg'], C['bg'], C['primary'])

def tail(w, h):
    return ('</x-dc>\n<script type="text/x-dc" data-dc-script data-props=\'{"$preview":{"width":%d,"height":%d}}\'>\n'
            'class Component extends DCLogic {\n  renderVals() { return {}; }\n}\n</script>\n</body>\n</html>\n') % (w, h)

def btn(label, icon=None, primary=False, ghost=False, h=40, aria=None):
    if primary:
        st = 'background: %s; color: #fff; border: none; box-shadow: 0 1px 2px rgba(79,70,229,.3);' % C['primary']
    elif ghost:
        st = 'background: transparent; color: %s; border: none;' % C['fg']
    else:
        st = 'background: #fff; color: %s; border: 1px solid %s;' % (C['fg'], C['border'])
    pad = '0 %dpx' % (12 if label else 0)
    wd = '' if label else 'width: %dpx; justify-content: center;' % h
    a = ' aria-label="%s"' % aria if aria else ''
    return ('<button type="button"%s style="height: %dpx; %s padding: %s; border-radius: 10px; display: flex; align-items: center; gap: 6px; '
            'font-size: 14px; font-weight: 500; cursor: pointer; %s">%s%s</button>') % (
        a, h, wd, pad, st, ic(icon, 18) if icon else '', esc(label) if label else '')

def seg(items, active, h=36):
    out = '<div style="display: flex; padding: 3px; background: #eeeef4; border-radius: 10px; gap: 2px">'
    for it in items:
        on = it == active
        out += ('<button type="button" style="height: %dpx; padding: 0 12px; border: none; border-radius: 8px; font-size: 13px; font-weight: 500; '
                'cursor: pointer; background: %s; color: %s; %s">%s</button>') % (
            h - 6, '#fff' if on else 'transparent', C['fg'] if on else C['muted'], 'box-shadow: 0 1px 2px rgba(20,20,40,.1);' if on else '', it)
    return out + '</div>'

# ───────────────────────── сетка дня (общая для A и B) ─────────────────────────


# ── выбранная карточка «C · Тон» (26.09): вся карточка в светлом тоне лака, время тёмным тоном того же цвета ──
SHADE = {
    'Ани С.': ('#e9c6bd', 'Nude 012', False), 'Седа А.': ('#c2185b', 'Berry 118', True), 'Нарине К.': ('#8fb9a8', 'Sage 330', False),
    'Мари Т.': ('#e3a9c1', 'Rose milk', False), 'Лилит Г.': ('#f4e2c6', 'French', False), 'Лиана Р.': ('#d8c3a5', 'Latte 051', False),
    'Ева К.': ('#6c4ab6', 'Violet 505', True), 'Мане Б.': ('#e9c6bd', 'Nude 012', False), 'Сирануш З.': ('#b3262d', 'Red 101', True),
    'Диана А.': ('#9b1b30', 'Cherry 207', True), 'Анаит М.': ('#f0b7a4', 'Peach 044', False), 'Гоар П.': ('#e3a9c1', 'Rose milk', False),
    'Рузанна Д.': ('#1f3a5f', 'Navy 402', True), 'Тамара В.': ('#c9a0dc', 'Lilac 220', False), 'Кристине А.': ('#2e7d6b', 'Emerald 310', True),
}
ST_WORD = {'paid': ('оплачено', '#1b7440'), 'here': ('пришла', '#4f46e5'), 'ok': ('подтверждена', '#6b6b80'), 'wait': ('ждёт ответа', '#a15c07')}

def _mix(hx, a):
    r, g, b = int(hx[1:3], 16), int(hx[3:5], 16), int(hx[5:7], 16)
    f = lambda c: int(255 - (255 - c) * a)
    return '#%02x%02x%02x' % (f(r), f(g), f(b))

def _dark(hx, k):
    r, g, b = int(hx[1:3], 16), int(hx[3:5], 16), int(hx[5:7], 16)
    return '#%02x%02x%02x' % (int(r * k), int(g * k), int(b * k))

def tone_card(left, top, w, h, a, b, cl, sv, stt, big=30, absolute=True):
    hx, nm, dk = SHADE.get(cl, ('#c7c9f5', '', False))
    ink = hx if dk else _dark(hx, .45)
    sub = _dark(hx, .5) if not dk else '#6b6b80'
    lbl, col = ST_WORD[stt]
    small = h < 70
    tiny = h < 50
    pos = 'position: absolute; left: %dpx; top: %dpx; width: %dpx;' % (left, top, w) if absolute else 'position: relative;'
    wait = 'outline: 1.5px dashed #a15c07; outline-offset: 2px;' if stt == 'wait' else ''
    fs = 18 if tiny else (22 if small else big)
    o = '<div style="%s height: %dpx; box-sizing: border-box; padding: %s; border-radius: 14px; background: %s; display: flex; flex-direction: column; gap: 1px; overflow: hidden; %s">' % (
        pos, h, '5px 10px' if tiny else ('7px 12px' if small else '10px 12px'), _mix(hx, .16), wait)
    o += '<div style="position: absolute; right: 10px; top: %dpx; width: 16px; height: 16px; border-radius: 99px; background: %s; box-shadow: 0 0 0 3px %s"></div>' % (8 if small else 11, hx, _mix(hx, .3))
    o += '<span style="font-size: %dpx; font-weight: 800; letter-spacing: -1px; color: %s; line-height: 1.05">%s</span>' % (fs, ink, a)
    o += '<span style="font-size: 13px; font-weight: 600; color: #17172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">%s</span>' % cl
    if h >= 96:
        o += '<span style="font-size: 12px; color: %s; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">%s · до %s</span>' % (sub, sv, b)
    if h >= 120:
        o += '<span style="margin-top: auto; align-self: flex-start; font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 99px; background: #fff; color: %s; white-space: nowrap">%s · %s</span>' % (col, lbl, nm)
    o += '</div>'
    return o

def day_grid(x0, y0, width, height, start='10:00', end='19:00', cols=4, card_style='A', col_w=None, header_h=64, show_load=True, compact=False):
    s, e = m(start), m(end)
    ppm = (height - header_h) / (e - s)
    gutter = 52
    cw = col_w or (width - gutter) / cols
    out = ['<div style="position: absolute; left: %dpx; top: %dpx; width: %dpx; height: %dpx; background: #fff; border: 1px solid %s; border-radius: 16px; overflow: hidden">' % (x0, y0, width, height, C['border'])]
    # шапка мастеров
    for i in range(cols):
        name, role, ini, col, load, cnt = STAFF[i]
        left = gutter + i * cw
        first = name.split()[0] if compact else name
        out.append('<div style="position: absolute; left: %dpx; top: 0; width: %dpx; height: %dpx; box-sizing: border-box; padding: 0 12px; display: flex; align-items: center; gap: 10px; border-left: 1px solid %s; border-bottom: 1px solid %s">' % (left, cw, header_h, C['line'], C['border']))
        out.append(avatar(ini, col, 32 if not compact else 28))
        out.append('<div style="display: flex; flex-direction: column; gap: 3px; min-width: 0; flex-grow: 1">')
        out.append('<div style="font-size: %dpx; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">%s</div>' % (13 if compact else 14, first))
        if show_load and not compact:
            out.append('<div style="display: flex; align-items: center; gap: 6px"><div style="height: 4px; flex-grow: 1; max-width: 90px; background: #eeeef4; border-radius: 4px; overflow: hidden"><div style="height: 4px; width: %s; background: %s"></div></div><span style="font-size: 12px; color: %s">%d записей</span></div>' % (load, col, C['muted'], cnt))
        elif not compact:
            out.append('<div style="font-size: 12px; color: %s">%s</div>' % (C['muted'], role))
        out.append('</div></div>')
    # часы
    t = s
    while t <= e:
        y = header_h + (t - s) * ppm
        if t < e:
            out.append('<div style="position: absolute; left: 0; top: %dpx; width: %dpx; text-align: right; font-size: 11px; color: %s; transform: translateY(-7px)">%s</div>' % (y, gutter - 10, C['muted'], '%02d:00' % (t // 60) if t != s else ''))
        out.append('<div style="position: absolute; left: %dpx; right: 0; top: %dpx; height: 1px; background: %s"></div>' % (gutter, y, C['line']))
        t += 60
    for i in range(cols):
        out.append('<div style="position: absolute; left: %dpx; top: %dpx; bottom: 0; width: 1px; background: %s"></div>' % (gutter + i * cw, header_h, C['line']))
    # записи
    for (si, a, b, cl, sv, cat, stt) in BK:
        if si >= cols: continue
        top = header_h + (m(a) - s) * ppm + 2
        hh = (m(b) - m(a)) * ppm - 4
        left = gutter + si * cw + 4
        fill, txt, stripe = CAT[cat]
        lbl, scol, sic = STATUS[stt]
        dashed = stt == 'wait'
        if card_style == 'T':
            out.append(tone_card(left, top, cw - 8, hh, a, b, cl, sv, stt, big=26 if compact else 30))
            continue
        if card_style == 'A':
            box = ('background: %s; border-radius: 10px; border-left: 3px solid %s; %s' % (fill, stripe, 'outline: 1.5px dashed %s; outline-offset: -1.5px;' % C['warning'] if dashed else ''))
        else:  # B — белая карточка с цветной точкой и тенью
            box = ('background: #fff; border-radius: 12px; border: 1px solid %s; box-shadow: 0 1px 2px rgba(20,20,40,.06), 0 2px 8px rgba(20,20,40,.04); %s' % (C['border'], 'border-style: dashed; border-color: %s;' % C['warning'] if dashed else ''))
        out.append('<div style="position: absolute; left: %dpx; top: %dpx; width: %dpx; height: %dpx; box-sizing: border-box; padding: 6px 8px; overflow: hidden; display: flex; flex-direction: column; gap: 2px; %s">' % (left, top, cw - 8, hh, box))
        tcol = txt if card_style == 'A' else C['muted']
        badge = ''
        if sic:
            badge = '<span style="display: flex; align-items: center; justify-content: center; width: 16px; height: 16px; border-radius: 999px; background: %s; color: #fff; flex-shrink: 0" title="%s">%s</span>' % (scol, lbl, ic(sic, 11, '#fff', 3))
        dot = '' if card_style == 'A' else '<span style="width: 8px; height: 8px; border-radius: 999px; background: %s; flex-shrink: 0"></span>' % stripe
        out.append('<div style="display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 500; color: %s">%s<span style="flex-grow: 1">%s–%s</span>%s</div>' % (tcol, dot, a, b, badge))
        out.append('<div style="font-size: %dpx; font-weight: 600; color: %s; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">%s</div>' % (13 if not compact else 12, C['fg'], cl))
        if hh > 44:
            out.append('<div style="font-size: 12px; color: %s; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">%s</div>' % (txt if card_style == 'A' else C['muted'], sv))
        out.append('</div>')
    # линия «сейчас»
    yn = header_h + (m(NOW) - s) * ppm
    out.append('<div style="position: absolute; left: %dpx; right: 0; top: %dpx; height: 2px; background: %s"></div>' % (gutter, yn, C['danger']))
    out.append('<div style="position: absolute; left: 4px; top: %dpx; height: 18px; padding: 0 6px; border-radius: 6px; background: %s; color: #fff; font-size: 11px; font-weight: 600; display: flex; align-items: center">%s</div>' % (yn - 9, C['danger'], NOW))
    out.append('</div>')
    return '\n'.join(out)

def sidebar(h):
    items = [('cal', True), ('list', False), ('hourglass', False), ('users', False), ('wallet', False), ('chart', False)]
    out = ['<nav aria-label="Разделы" style="position: absolute; left: 0; top: 0; width: 72px; height: %dpx; background: #fff; border-right: 1px solid %s; display: flex; flex-direction: column; align-items: center; padding-top: 16px; gap: 6px; box-sizing: border-box">' % (h, C['border'])]
    out.append('<div style="width: 40px; height: 40px; border-radius: 12px; background: %s; color: #fff; font-weight: 700; font-size: 18px; display: flex; align-items: center; justify-content: center; margin-bottom: 14px">B</div>' % C['primary'])
    for nm, on in items:
        out.append('<a href="#" aria-label="%s" style="width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: %s; background: %s">%s</a>' % (nm, C['primary'] if on else C['muted'], C['primarySoft'] if on else 'transparent', ic(nm, 20)))
    out.append('</nav>')
    return '\n'.join(out)

# ───────────────────────── A · «Спокойный» — компьютер ─────────────────────────

def A_desk():
    W, H = 1440, 900
    o = [head('A · Спокойный — компьютер')]
    o.append('<div style="position: relative; width: %dpx; height: %dpx; background: %s; overflow: hidden">' % (W, H, C['bg']))
    o.append(sidebar(H))
    # одна строка управления
    o.append('<header style="position: absolute; left: 72px; right: 0; top: 0; height: 72px; box-sizing: border-box; padding: 0 28px; display: flex; align-items: center; gap: 14px; background: #fff; border-bottom: 1px solid %s">' % C['border'])
    o.append('<div style="display: flex; align-items: center; gap: 4px">%s%s</div>' % (btn('', 'chev_l', ghost=True, aria='Предыдущий день'), btn('', 'chev_r', ghost=True, aria='Следующий день')))
    o.append('<button type="button" style="border: none; background: transparent; display: flex; align-items: baseline; gap: 10px; cursor: pointer; padding: 0"><span style="font-size: 22px; font-weight: 700; color: %s">Пятница, 26 сентября</span><span style="font-size: 14px; color: %s">сегодня</span>%s</button>' % (C['fg'], C['muted'], ic('chev_d', 16, C['muted'])))
    o.append('<div style="flex-grow: 1"></div>')
    o.append(seg(['День', 'Неделя', 'Месяц'], 'День'))
    o.append('<div style="display: flex; align-items: center; padding-left: 6px">')
    for i, s in enumerate(STAFF):
        o.append('<div style="margin-left: %dpx">%s</div>' % (0 if i == 0 else -8, avatar(s[2], s[3], 32, ring=False)))
    o.append('<span style="font-size: 13px; color: %s; margin-left: 8px">Все мастера</span></div>' % C['muted'])
    o.append(btn('', 'search', aria='Поиск'))
    o.append(btn('Новая запись', 'plus', primary=True))
    o.append('</header>')
    # итог дня — тонкая строка
    o.append('<div style="position: absolute; left: 100px; top: 88px; display: flex; gap: 24px; font-size: 13px; color: %s">' % C['muted'])
    for k, v in [('записей', '15'), ('выручка', '142 000 ֏'), ('свободных окон', '7'), ('ждут подтверждения', '3')]:
        col = C['warning'] if k.startswith('ждут') else C['fg']
        o.append('<span><b style="color: %s; font-weight: 600">%s</b> %s</span>' % (col, v, k))
    o.append('</div>')
    o.append(day_grid(100, 118, 1312, 760, card_style='T'))
    o.append('</div>')
    o.append(tail(W, H))
    return ''.join(o)

# ───────────────────────── A · телефон ─────────────────────────

def phone_top(title_line, sub):
    o = ['<header style="height: 56px; padding: 0 12px; display: flex; align-items: center; gap: 8px; background: #fff">']
    o.append(btn('', 'menu', ghost=True, h=44, aria='Меню'))
    o.append('<div style="flex-grow: 1; display: flex; flex-direction: column"><span style="font-size: 17px; font-weight: 700">%s</span><span style="font-size: 12px; color: %s">%s</span></div>' % (title_line, C['muted'], sub))
    o.append(btn('', 'search', ghost=True, h=44, aria='Поиск'))
    o.append(btn('', 'bell', ghost=True, h=44, aria='Уведомления'))
    o.append('</header>')
    return ''.join(o)

def week_strip():
    days = [('Пн', 22), ('Вт', 23), ('Ср', 24), ('Чт', 25), ('Пт', 26), ('Сб', 27), ('Вс', 28)]
    o = ['<div style="display: flex; justify-content: space-between; padding: 6px 12px 10px; background: #fff; border-bottom: 1px solid %s">' % C['border']]
    for d, n in days:
        on = n == 26
        o.append('<button type="button" style="width: 46px; height: 58px; border: none; border-radius: 14px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; cursor: pointer; background: %s; color: %s"><span style="font-size: 11px; %s">%s</span><span style="font-size: 17px; font-weight: 700">%d</span><span style="width: 4px; height: 4px; border-radius: 9px; background: %s"></span></button>' % (
            C['primary'] if on else 'transparent', '#fff' if on else C['fg'], 'opacity: .8' if on else 'color: %s' % C['muted'], d, n, '#fff' if on else (C['primary'] if n != 28 else 'transparent')))
    o.append('</div>')
    return ''.join(o)

def fab():
    return ('<button type="button" aria-label="Новая запись" style="position: absolute; right: 16px; bottom: 90px; height: 56px; padding: 0 20px 0 16px; border: none; border-radius: 18px; '
            'background: %s; color: #fff; display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 600; box-shadow: 0 8px 24px rgba(79,70,229,.35)">%s Запись</button>') % (C['primary'], ic('plus', 22, '#fff', 2.5))

def tabbar(active='cal'):
    items = [('cal', 'Журнал'), ('users', 'Клиенты'), ('wallet', 'Касса'), ('more', 'Ещё')]
    o = ['<nav aria-label="Нижнее меню" style="position: absolute; left: 0; right: 0; bottom: 0; height: 74px; background: #fff; border-top: 1px solid %s; display: flex; padding-bottom: 12px; box-sizing: border-box">' % C['border']]
    for nm, lb in items:
        on = nm == active
        o.append('<a href="#" style="flex-grow: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; text-decoration: none; font-size: 11px; font-weight: 500; color: %s">%s%s</a>' % (C['primary'] if on else C['muted'], ic(nm, 22), lb))
    o.append('</nav>')
    return ''.join(o)

def A_phone():
    W, H = 390, 844
    o = [head('A · Спокойный — телефон')]
    o.append('<div style="position: relative; width: %dpx; height: %dpx; background: %s; overflow: hidden; display: flex; flex-direction: column">' % (W, H, C['bg']))
    o.append(phone_top('Сентябрь', 'Nuri Nail Studio'))
    o.append(week_strip())
    o.append('<div style="position: relative; flex-grow: 1">')
    o.append(day_grid(8, 8, 374, 610, start='10:00', end='18:00', cols=2, card_style='T', header_h=48, compact=True, col_w=161))
    o.append('<div style="position: absolute; right: 8px; top: 8px; height: 48px; width: 44px; display: flex; align-items: center; justify-content: center; background: linear-gradient(90deg, rgba(255,255,255,0), #fff 40%%); border-top-right-radius: 16px; color: %s">%s</div>' % (C['muted'], ic('chev_r', 18)))
    o.append('</div>')
    o.append(fab())
    o.append(tabbar())
    o.append('</div>')
    o.append(tail(W, H))
    return ''.join(o)

# ───────────────────────── B · «Панель дня» — компьютер ─────────────────────────

def B_desk():
    W, H = 1440, 900
    o = [head('B · Панель дня — компьютер')]
    o.append('<div style="position: relative; width: %dpx; height: %dpx; background: %s; overflow: hidden">' % (W, H, C['bg']))
    o.append(sidebar(H))
    o.append('<header style="position: absolute; left: 72px; right: 0; top: 0; height: 72px; box-sizing: border-box; padding: 0 28px; display: flex; align-items: center; gap: 12px">')
    o.append('<span style="font-size: 22px; font-weight: 700">Сегодня</span><span style="font-size: 15px; color: %s">пт, 26 сентября</span>' % C['muted'])
    o.append('<div style="display: flex; gap: 2px; margin-left: 6px">%s%s</div>' % (btn('', 'chev_l', ghost=True, aria='Назад'), btn('', 'chev_r', ghost=True, aria='Вперёд')))
    o.append('<div style="flex-grow: 1"></div>')
    o.append(seg(['День', 'Неделя'], 'День'))
    o.append(btn('Мастера: все', 'users'))
    o.append(btn('', 'search', aria='Поиск'))
    o.append(btn('Новая запись', 'plus', primary=True))
    o.append('</header>')
    o.append(day_grid(100, 80, 1000, 796, card_style='T', show_load=False))
    # правая панель дня
    o.append('<aside style="position: absolute; left: 1120px; top: 80px; width: 296px; display: flex; flex-direction: column; gap: 16px">')
    o.append('<div style="background: #fff; border: 1px solid %s; border-radius: 16px; padding: 18px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px">' % C['border'])
    for v, k in [('15', 'записей'), ('142 000 ֏', 'выручка'), ('7', 'свободных окон'), ('86%', 'загрузка')]:
        o.append('<div style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 20px; font-weight: 700">%s</span><span style="font-size: 12px; color: %s">%s</span></div>' % (v, C['muted'], k))
    o.append('</div>')
    o.append('<div style="background: #fff; border: 1px solid %s; border-radius: 16px; padding: 16px; display: flex; flex-direction: column; gap: 12px">' % C['border'])
    o.append('<div style="font-size: 14px; font-weight: 600">Дальше</div>')
    for (t, cl, sv, who, col) in [('14:00', 'Анаит М.', 'Снятие + маникюр', 'Гаяне', '#4f46e5'), ('14:30', 'Нарине К.', 'SPA-педикюр', 'Мариам', '#0f766e'), ('15:30', 'Гоар П.', 'Наращивание', 'Гаяне', '#b45309')]:
        o.append('<div style="display: flex; gap: 12px; align-items: center"><span style="font-size: 13px; font-weight: 600; width: 40px">%s</span><div style="width: 3px; height: 34px; border-radius: 3px; background: %s"></div><div style="display: flex; flex-direction: column; min-width: 0"><span style="font-size: 13px; font-weight: 600">%s</span><span style="font-size: 12px; color: %s">%s · %s</span></div></div>' % (t, col, cl, C['muted'], sv, who))
    o.append('</div>')
    o.append('<div style="background: #fff4e0; border: 1px solid #f3d9ad; border-radius: 16px; padding: 16px; display: flex; flex-direction: column; gap: 8px">')
    o.append('<div style="display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; color: %s">%s 3 ждут подтверждения</div>' % (C['warning'], ic('clock', 18, C['warning'])))
    o.append('<div style="font-size: 12px; color: #6e4a12">Ответьте до 15:20, иначе заявки снимутся</div>')
    o.append('<button type="button" style="align-self: flex-start; height: 36px; padding: 0 14px; border-radius: 10px; border: none; background: %s; color: #fff; font-size: 13px; font-weight: 600">Посмотреть</button>' % C['warning'])
    o.append('</div>')
    o.append('<div style="background: #fff; border: 1px solid %s; border-radius: 16px; padding: 16px; display: flex; flex-direction: column; gap: 8px">' % C['border'])
    o.append('<div style="display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600">%s Лист ожидания · 2</div>' % ic('hourglass', 18, C['muted']))
    o.append('<div style="font-size: 12px; color: %s">Лала свободна 14:00–16:30 — есть кого позвать</div>' % C['muted'])
    o.append('</div>')
    o.append('</aside>')
    o.append('</div>')
    o.append(tail(W, H))
    return ''.join(o)

def B_phone():
    W, H = 390, 844
    o = [head('B · Панель дня — телефон')]
    o.append('<div style="position: relative; width: %dpx; height: %dpx; background: %s; overflow: hidden; display: flex; flex-direction: column">' % (W, H, C['bg']))
    o.append(phone_top('Сегодня, 26 сент', 'Nuri Nail Studio'))
    o.append('<div style="display: flex; gap: 8px; padding: 4px 12px 12px; overflow: hidden">')
    for v, k, col in [('15', 'записей', C['fg']), ('142к ֏', 'выручка', C['fg']), ('7', 'окон', C['fg']), ('3', 'ждут', C['warning'])]:
        o.append('<div style="flex-shrink: 0; min-width: 78px; background: #fff; border: 1px solid %s; border-radius: 14px; padding: 10px 12px; display: flex; flex-direction: column"><span style="font-size: 17px; font-weight: 700; color: %s">%s</span><span style="font-size: 11px; color: %s">%s</span></div>' % (C['border'], col, v, C['muted'], k))
    o.append('</div>')
    o.append('<div style="position: relative; flex-grow: 1">')
    o.append(day_grid(8, 0, 374, 600, start='11:00', end='18:00', cols=2, card_style='T', header_h=48, compact=True, col_w=161))
    o.append('</div>')
    o.append(fab())
    o.append(tabbar())
    o.append('</div>')
    o.append(tail(W, H))
    return ''.join(o)

# ───────────────────────── C · «Лента» — мастера строками (Гант) ─────────────────────────

def C_desk():
    W, H = 1440, 900
    o = [head('C · Лента — компьютер')]
    o.append('<div style="position: relative; width: %dpx; height: %dpx; background: %s; overflow: hidden">' % (W, H, C['bg']))
    o.append(sidebar(H))
    o.append('<header style="position: absolute; left: 72px; right: 0; top: 0; height: 72px; box-sizing: border-box; padding: 0 28px; display: flex; align-items: center; gap: 12px; background: #fff; border-bottom: 1px solid %s">' % C['border'])
    o.append('<div style="display: flex; gap: 2px">%s%s</div>' % (btn('', 'chev_l', ghost=True, aria='Назад'), btn('', 'chev_r', ghost=True, aria='Вперёд')))
    o.append('<span style="font-size: 22px; font-weight: 700">Пятница, 26 сентября</span>')
    o.append('<div style="flex-grow: 1"></div>')
    o.append(seg(['Лента', 'Сетка', 'Неделя'], 'Лента'))
    o.append(btn('', 'filter', aria='Фильтры'))
    o.append(btn('Новая запись', 'plus', primary=True))
    o.append('</header>')
    s, e = m('10:00'), m('20:00')
    X0, X1 = 330, 1410
    ppm = (X1 - X0) / (e - s)
    o.append('<div style="position: absolute; left: 100px; top: 96px; width: 1312px; height: 780px; background: #fff; border: 1px solid %s; border-radius: 16px; overflow: hidden">' % C['border'])
    # шкала времени
    t = s
    while t <= e:
        x = (t - s) * ppm + (X0 - 100)
        o.append('<div style="position: absolute; left: %dpx; top: 14px; font-size: 11px; color: %s; transform: translateX(-50%%)">%02d:00</div>' % (x, C['muted'], t // 60))
        o.append('<div style="position: absolute; left: %dpx; top: 40px; bottom: 0; width: 1px; background: %s"></div>' % (x, C['line']))
        t += 60
    rowh = 150
    for i, (name, role, ini, col, load, cnt) in enumerate(STAFF):
        y = 44 + i * rowh
        o.append('<div style="position: absolute; left: 0; top: %dpx; width: 230px; height: %dpx; box-sizing: border-box; padding: 0 20px; display: flex; align-items: center; gap: 12px; border-top: 1px solid %s">' % (y, rowh, C['line']))
        o.append(avatar(ini, col, 44))
        o.append('<div style="display: flex; flex-direction: column; gap: 4px"><span style="font-size: 15px; font-weight: 600">%s</span><span style="font-size: 12px; color: %s">%s</span><span style="font-size: 12px; color: %s">%d записей · свободно 2 ч 30 мин</span></div>' % (name, C['muted'], role, C['fg'], cnt))
        o.append('</div>')
        o.append('<div style="position: absolute; left: 230px; right: 0; top: %dpx; height: 1px; background: %s"></div>' % (y, C['line']))
        for (si, a, b, cl, sv, cat, stt) in BK:
            if si != i: continue
            x = (m(a) - s) * ppm + (X0 - 100)
            w = (m(b) - m(a)) * ppm - 4
            o.append(tone_card(x + 2, y + 16, w, rowh - 32, a, b, cl, sv, stt, big=28))
            continue
            fill, txt, stripe = CAT[cat]
            w = (m(b) - m(a)) * ppm - 4
            lbl, scol, sic = STATUS[stt]
            dashed = 'outline: 1.5px dashed %s; outline-offset: -1.5px;' % C['warning'] if stt == 'wait' else ''
            o.append('<div style="position: absolute; left: %dpx; top: %dpx; width: %dpx; height: %dpx; box-sizing: border-box; padding: 10px 10px; border-radius: 12px; background: %s; border-top: 3px solid %s; overflow: hidden; display: flex; flex-direction: column; gap: 3px; %s">' % (x + 2, y + 16, w, rowh - 32, fill, stripe, dashed))
            o.append('<span style="font-size: 11px; font-weight: 500; color: %s">%s–%s</span><span style="font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">%s</span><span style="font-size: 12px; color: %s; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">%s</span>' % (txt, a, b, cl, txt, sv))
            if sic:
                o.append('<span style="display: flex; align-items: center; gap: 4px; font-size: 11px; color: %s; margin-top: auto">%s %s</span>' % (scol, ic(sic, 12, scol, 2.5), lbl))
            o.append('</div>')
        # свободное окно — заметно и кликабельно
        if i == 3:
            x = (m('14:00') - s) * ppm + (X0 - 100)
            w = (m('16:30') - m('14:00')) * ppm - 4
            o.append('<button type="button" style="position: absolute; left: %dpx; top: %dpx; width: %dpx; height: %dpx; border: 1.5px dashed #c7c9f5; border-radius: 12px; background: #f7f7ff; color: %s; font-size: 13px; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer">%s Свободно 14:00–16:30</button>' % (x + 2, y + 16, w, rowh - 32, C['primary'], ic('plus', 16, C['primary'])))
    xn = (m(NOW) - s) * ppm + (X0 - 100)
    o.append('<div style="position: absolute; left: %dpx; top: 40px; bottom: 0; width: 2px; background: %s"></div>' % (xn, C['danger']))
    o.append('<div style="position: absolute; left: %dpx; top: 10px; height: 20px; padding: 0 6px; border-radius: 6px; background: %s; color: #fff; font-size: 11px; font-weight: 600; display: flex; align-items: center; transform: translateX(-50%%)">%s</div>' % (xn + 1, C['danger'], NOW))
    o.append('</div></div>')
    o.append(tail(W, H))
    return ''.join(o)

def C_phone():
    W, H = 390, 844
    o = [head('C · Лента — телефон')]
    o.append('<div style="position: relative; width: %dpx; height: %dpx; background: %s; overflow: hidden; display: flex; flex-direction: column">' % (W, H, C['bg']))
    o.append(phone_top('Пт, 26 сентября', 'Nuri Nail Studio · сегодня'))
    # мастера — чипы
    o.append('<div style="display: flex; gap: 8px; padding: 4px 12px 12px; background: #fff; border-bottom: 1px solid %s; overflow: hidden">' % C['border'])
    for i, s in enumerate(STAFF):
        on = i == 2
        o.append('<button type="button" style="flex-shrink: 0; height: 40px; padding: 0 12px 0 4px; border-radius: 999px; border: 1px solid %s; background: %s; display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: %s">%s%s</button>' % (
            C['primary'] if on else C['border'], C['primarySoft'] if on else '#fff', C['primary'] if on else C['fg'], avatar(s[2], s[3], 30), s[0].split()[0]))
    o.append('</div>')
    o.append('<div style="padding: 12px; display: flex; flex-direction: column; gap: 8px">')
    rows = [('10:00', '11:00', 'Мане Б.', 'Маникюр аппаратный', 'mani', 'paid'), ('11:00', '12:00', 'Сирануш З.', 'Маникюр аппаратный', 'mani', 'paid'),
            ('12:00', '13:45', 'Диана А.', 'Маникюр + гель-лак', 'mani', 'here'), ('NOW',), ('13:45', '14:00', None, None, None, None),
            ('14:00', '15:00', 'Анаит М.', 'Снятие + маникюр', 'mani', 'ok'), ('15:00', '15:30', None, None, None, None), ('15:30', '17:00', 'Гоар П.', 'Наращивание', 'gel', 'ok')]
    for r in rows:
        if r[0] == 'NOW':
            o.append('<div style="display: flex; align-items: center; gap: 8px"><span style="font-size: 11px; font-weight: 700; color: #fff; background: %s; border-radius: 6px; padding: 2px 6px">%s</span><div style="flex-grow: 1; height: 2px; background: %s"></div></div>' % (C['danger'], NOW, C['danger']))
            continue
        a, b = r[0], r[1]
        if r[2] is None:
            o.append('<button type="button" style="display: flex; align-items: center; gap: 12px; height: 48px; padding: 0 14px; border-radius: 14px; border: 1.5px dashed #c7c9f5; background: #f7f7ff; color: %s; font-size: 14px; font-weight: 600">%s Свободно %s–%s</button>' % (C['primary'], ic('plus', 18, C['primary']), a, b))
            continue
        cl, sv, cat, stt = r[2], r[3], r[4], r[5]
        o.append(tone_card(0, 0, 0, max(84, int((m(b) - m(a)) * 1.1)), a, b, cl, sv, stt, big=26, absolute=False))
        continue
        fill, txt, stripe = CAT[cat]
        lbl, scol, sic = STATUS[stt]
        o.append('<div style="display: flex; gap: 12px; align-items: stretch; background: #fff; border: 1px solid %s; border-radius: 14px; padding: 12px">' % C['border'])
        o.append('<div style="display: flex; flex-direction: column; width: 44px; font-size: 13px"><b>%s</b><span style="color: %s">%s</span></div>' % (a, C['muted'], b))
        o.append('<div style="width: 3px; border-radius: 3px; background: %s"></div>' % stripe)
        o.append('<div style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1; min-width: 0"><span style="font-size: 15px; font-weight: 600">%s</span><span style="font-size: 13px; color: %s">%s</span></div>' % (cl, C['muted'], sv))
        if sic:
            o.append('<span style="align-self: center; display: flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 500; color: %s; background: %s14; border-radius: 999px; padding: 4px 8px; white-space: nowrap">%s %s</span>' % (scol, scol, ic(sic, 12, scol, 2.5), lbl))
        o.append('</div>')
    o.append('</div>')
    o.append(fab())
    o.append(tabbar())
    o.append('</div>')
    o.append(tail(W, H))
    return ''.join(o)

BOARDS = [
    ('A-desktop.dc.html', 'A · Спокойный — компьютер', A_desk, 1440, 900),
    ('A-phone.dc.html', 'A · Спокойный — телефон', A_phone, 390, 844),
    ('B-desktop.dc.html', 'B · Панель дня — компьютер', B_desk, 1440, 900),
    ('B-phone.dc.html', 'B · Панель дня — телефон', B_phone, 390, 844),
    ('C-desktop.dc.html', 'C · Лента — компьютер', C_desk, 1440, 900),
    ('C-phone.dc.html', 'C · Лента — телефон', C_phone, 390, 844),
]

boards, order = {}, []
y = 0
for idx in range(0, len(BOARDS), 2):
    x = 0
    for name, title, fn, w, h in BOARDS[idx:idx + 2]:
        io.open(os.path.join(P, name), 'w', encoding='utf-8').write(fn())
        boards[name] = {'x': x, 'y': y, 'w': w, 'h': h, 'title': title}
        order.append(name)
        x += w + 80
    y += 900 + 120 + 240

notes = {
    'hA': {'x': 0, 'y': -260, 'text': 'A · Спокойный: одна строка управления, мягкие карточки', 'kind': 'title1', 'maxW': 1910},
    'hB': {'x': 0, 'y': 1260 - 260, 'text': 'B · Панель дня: сетка + сводка и «что дальше» справа', 'kind': 'title1', 'maxW': 1910},
    'hC': {'x': 0, 'y': 2520 - 260, 'text': 'C · Лента: мастера строками, свободное время видно сразу', 'kind': 'title1', 'maxW': 1910},
}
idx = {
    'v': 3,
    'createdOnFiles': {'v': 1, 'at': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')},
    'title': 'BookTime — журнал: варианты дизайна',
    'launch': {'view': 'canvas'},
    'pages': [],
    'boards': boards,
    'order': order,
    'notes': notes,
    'designSystems': [],
}
io.open(os.path.join(P, 'canvas.json'), 'w', encoding='utf-8').write(json.dumps(idx, ensure_ascii=False, indent=1))
print('ok', order)
