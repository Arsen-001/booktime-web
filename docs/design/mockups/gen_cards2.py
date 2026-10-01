# -*- coding: utf-8 -*-
# Лист «Карточка: смесь 2 (оттенок) + 3 (типографика) — 6 вариантов». Пользователь: «ближе 2 и 3, но пока не то».
import io, os, json

ROOT = os.path.dirname(os.path.abspath(__file__))
P = os.path.join(ROOT, 'project')
FONT = "https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;600;700;800;900&family=Noto+Sans+Armenian:wght@400;600&display=swap"
FG, MUTED, BORDER, BG, PRIMARY = '#17172a', '#6b6b80', '#e6e6ef', '#f7f7fb', '#4f46e5'
OK, WARN = '#1b7440', '#a15c07'

# (начало, конец, мин, клиент, услуга, (hex, название, тёмный?), статус)
S = [
    ('10:00', '10:45', 45, 'Мане Б.', 'Маникюр аппаратный', ('#e9c6bd', 'Nude 012', False), 'paid'),
    ('12:00', '13:45', 105, 'Диана А.', 'Маникюр + гель-лак', ('#9b1b30', 'Cherry 207', True), 'now'),
    ('14:30', '16:30', 120, 'Нарине К.', 'Наращивание', ('#e3a9c1', 'Rose milk', False), 'wait'),
    ('17:00', '18:00', 60, 'Рузанна Д.', 'Педикюр классический', ('#1f3a5f', 'Navy 402', True), 'ok'),
]
PPM = 1.35
ST = {'paid': ('оплачено', OK), 'now': ('идёт сейчас', PRIMARY), 'wait': ('ждёт ответа', WARN), 'ok': ('подтверждена', MUTED)}

def dur(mn):
    h, m = divmod(mn, 60)
    return ('%d ч %02d' % (h, m) if m else '%d ч' % h) if h else '%d мин' % m

def hh(mn):
    return max(66, int(mn * PPM))

def mix(hx, a):
    # смешать цвет с белым: a = доля цвета
    r, g, b = int(hx[1:3], 16), int(hx[3:5], 16), int(hx[5:7], 16)
    f = lambda c: int(255 - (255 - c) * a)
    return '#%02x%02x%02x' % (f(r), f(g), f(b))

def darker(hx, k=0.55):
    r, g, b = int(hx[1:3], 16), int(hx[3:5], 16), int(hx[5:7], 16)
    return '#%02x%02x%02x' % (int(r * k), int(g * k), int(b * k))

def wait_css(st, radius=True):
    return 'outline: 1.5px dashed %s; outline-offset: 2px;' % WARN if st == 'wait' else ''

# A · Мазок: слева вертикальный мазок лака (форма ногтя), крупное время
def a_stroke(s):
    t, e, mn, cl, sv, (hx, nm, dk), st = s
    h = hh(mn); small = h < 90
    lbl, col = ST[st]
    o = '<div style="height: %dpx; display: flex; gap: 12px; padding: 8px 12px 8px 8px; box-sizing: border-box; background: #fff; border-radius: 14px; %s">' % (h, wait_css(st))
    o += '<div style="width: 14px; flex-shrink: 0; border-radius: 10px 10px 7px 7px; background: linear-gradient(90deg, %s 0%%, %s 55%%, %s 100%%)"></div>' % (mix(hx, .8), hx, darker(hx, .8))
    o += '<div style="display: flex; flex-direction: column; gap: 2px; min-width: 0; flex-grow: 1; justify-content: %s">' % ('center' if small else 'flex-start')
    o += '<div style="display: flex; align-items: baseline; gap: 6px"><span style="font-size: %dpx; font-weight: 800; letter-spacing: -1px; line-height: 1.05">%s</span><span style="font-size: 12px; color: %s">— %s</span></div>' % (22 if small else 28, t, MUTED, e)
    o += '<span style="font-size: 14px; font-weight: 600">%s</span>' % cl
    if not small:
        o += '<span style="font-size: 12px; color: %s">%s · %s</span>' % (MUTED, sv, nm)
        o += '<span style="margin-top: auto; font-size: 11px; font-weight: 600; color: %s">● %s</span>' % (col, lbl)
    o += '</div></div>'
    return o

# B · Кончик: сверху цветная «кромка» лака, как кончик ногтя; время крупно, тёмное
def b_tip(s):
    t, e, mn, cl, sv, (hx, nm, dk), st = s
    h = hh(mn); small = h < 90
    lbl, col = ST[st]
    o = '<div style="height: %dpx; box-sizing: border-box; border-radius: 16px; background: #fff; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 1px 2px rgba(20,20,40,.06); %s">' % (h, wait_css(st))
    o += '<div style="height: %dpx; background: %s; flex-shrink: 0"></div>' % (8 if small else 12, hx)
    o += '<div style="padding: %s; display: flex; flex-direction: column; gap: 2px; flex-grow: 1">' % ('6px 12px' if small else '10px 14px')
    o += '<div style="display: flex; align-items: baseline; gap: 8px"><span style="font-size: %dpx; font-weight: 900; letter-spacing: -1.2px; line-height: 1">%s</span><span style="margin-left: auto; font-size: 12px; color: %s">%s</span></div>' % (22 if small else 30, t, MUTED, dur(mn))
    o += '<span style="font-size: 14px; font-weight: 600; margin-top: 4px">%s</span>' % cl
    if not small:
        o += '<span style="font-size: 12px; color: %s">%s</span>' % (MUTED, sv)
        o += '<div style="margin-top: auto; display: flex; justify-content: space-between; font-size: 11px"><span style="color: %s; font-weight: 600">%s</span><span style="color: %s">%s</span></div>' % (col, lbl, MUTED, nm)
    o += '</div></div>'
    return o

# C · Тон: вся карточка в светлом тоне лака, время — в тёмном тоне того же лака
def c_tone(s):
    t, e, mn, cl, sv, (hx, nm, dk), st = s
    h = hh(mn); small = h < 90
    lbl, col = ST[st]
    ink = darker(hx, .45) if not dk else hx
    o = '<div style="height: %dpx; box-sizing: border-box; padding: %s; border-radius: 16px; background: %s; display: flex; flex-direction: column; gap: 2px; position: relative; %s">' % (h, '8px 14px' if small else '12px 14px', mix(hx, .16), wait_css(st))
    o += '<div style="position: absolute; right: 12px; top: 12px; width: 22px; height: 22px; border-radius: 99px; background: %s; box-shadow: 0 0 0 3px %s"></div>' % (hx, mix(hx, .3))
    o += '<span style="font-size: %dpx; font-weight: 800; letter-spacing: -1px; color: %s; line-height: 1.05">%s</span>' % (22 if small else 30, ink, t)
    o += '<span style="font-size: 14px; font-weight: 600; color: %s">%s</span>' % (FG, cl)
    if not small:
        o += '<span style="font-size: 12px; color: %s">%s · %s</span>' % (darker(hx, .5) if not dk else MUTED, sv, dur(mn))
        o += '<span style="margin-top: auto; align-self: flex-start; font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 99px; background: #fff; color: %s">%s · %s</span>' % (col, lbl, nm)
    o += '</div>'
    return o

# D · Тихая: без рамки и заливки, только капля лака, огромное время и линия-разделитель — редакционный стиль
def d_quiet(s):
    t, e, mn, cl, sv, (hx, nm, dk), st = s
    h = hh(mn); small = h < 90
    lbl, col = ST[st]
    o = '<div style="height: %dpx; box-sizing: border-box; padding: 6px 4px 8px; border-top: 2px solid %s; display: flex; gap: 12px; %s">' % (h, FG if st == 'now' else BORDER, wait_css(st))
    o += '<span style="font-size: %dpx; font-weight: 300; letter-spacing: -1.5px; line-height: 1; min-width: 78px">%s</span>' % (26 if small else 34, t)
    o += '<div style="display: flex; flex-direction: column; gap: 3px; min-width: 0; flex-grow: 1; padding-top: 3px">'
    o += '<div style="display: flex; align-items: center; gap: 8px"><span style="width: 12px; height: 12px; border-radius: 99px; background: %s; flex-shrink: 0"></span><span style="font-size: 14px; font-weight: 700">%s</span></div>' % (hx, cl)
    o += '<span style="font-size: 12px; color: %s">%s</span>' % (MUTED, sv if small else '%s · %s' % (sv, dur(mn)))
    if not small:
        o += '<span style="font-size: 11px; font-weight: 600; letter-spacing: .5px; text-transform: uppercase; color: %s; margin-top: 4px">%s</span>' % (col, lbl)
    o += '</div></div>'
    return o

# E · Идёт сейчас = залита самим лаком; остальные — белые с каплей
def e_live(s):
    t, e, mn, cl, sv, (hx, nm, dk), st = s
    h = hh(mn); small = h < 90
    lbl, col = ST[st]
    live = st == 'now'
    bg = hx if live else '#fff'
    fg = '#fff' if (live and dk) else FG
    mu = 'rgba(255,255,255,.78)' if (live and dk) else MUTED
    o = '<div style="height: %dpx; box-sizing: border-box; padding: %s; border-radius: 18px; background: %s; color: %s; display: flex; flex-direction: column; gap: 2px; %s %s">' % (
        h, '8px 14px' if small else '12px 16px', bg, fg, 'box-shadow: 0 10px 24px %s66;' % hx if live else 'border: 1px solid %s;' % BORDER, wait_css(st))
    o += '<div style="display: flex; align-items: center; gap: 8px"><span style="font-size: %dpx; font-weight: 800; letter-spacing: -1px">%s</span>%s<span style="margin-left: auto; font-size: 12px; color: %s">%s</span></div>' % (
        22 if small else 28, t, '' if live else '<span style="width: 14px; height: 14px; border-radius: 99px; background: %s; box-shadow: inset 0 -3px 4px rgba(0,0,0,.2)"></span>' % hx, mu, dur(mn))
    o += '<span style="font-size: 14px; font-weight: 600">%s</span>' % cl
    if not small:
        o += '<span style="font-size: 12px; color: %s">%s · %s</span>' % (mu, sv, nm)
        if live:
            o += '<div style="margin-top: auto; display: flex; flex-direction: column; gap: 5px"><span style="font-size: 12px; font-weight: 600">Осталось 25 мин</span><div style="height: 4px; border-radius: 4px; background: rgba(255,255,255,.3)"><div style="height: 4px; width: 76%; border-radius: 4px; background: #fff"></div></div></div>'
        else:
            o += '<span style="margin-top: auto; font-size: 11px; font-weight: 600; color: %s">%s</span>' % (col, lbl)
    o += '</div>'
    return o

# F · Ноготь: оттенок в форме ногтя справа, время — главное слева; спокойный белый фон
def f_nail(s):
    t, e, mn, cl, sv, (hx, nm, dk), st = s
    h = hh(mn); small = h < 90
    lbl, col = ST[st]
    o = '<div style="height: %dpx; box-sizing: border-box; padding: %s; border-radius: 16px; background: #fff; border: 1px solid %s; display: flex; gap: 10px; align-items: %s; %s">' % (h, '8px 12px' if small else '12px 14px', BORDER, 'center' if small else 'stretch', wait_css(st))
    o += '<div style="display: flex; flex-direction: column; gap: 2px; min-width: 0; flex-grow: 1">'
    o += '<span style="font-size: %dpx; font-weight: 800; letter-spacing: -1px; line-height: 1.05">%s<span style="font-size: 13px; font-weight: 500; color: %s; letter-spacing: 0"> – %s</span></span>' % (22 if small else 28, t, MUTED, e)
    o += '<span style="font-size: 14px; font-weight: 600">%s</span>' % cl
    if not small:
        o += '<span style="font-size: 12px; color: %s">%s</span>' % (MUTED, sv)
        o += '<span style="margin-top: auto; font-size: 11px; font-weight: 600; color: %s">%s</span>' % (col, lbl)
    o += '</div>'
    nh = 34 if small else 52
    o += '<div style="display: flex; flex-direction: column; align-items: center; gap: 4px; flex-shrink: 0"><div style="width: %dpx; height: %dpx; border-radius: %dpx %dpx 8px 8px; background: linear-gradient(100deg, %s, %s 45%%, %s); box-shadow: inset 0 2px 3px rgba(255,255,255,.5)"></div>%s</div>' % (
        int(nh * .66), nh, int(nh * .4), int(nh * .4), mix(hx, .75), hx, darker(hx, .8), '' if small else '<span style="font-size: 10px; color: %s; white-space: nowrap">%s</span>' % (MUTED, nm))
    o += '</div>'
    return o

COLS = [
    ('A · Мазок', 'Слева вертикальный мазок лака, как ноготь. Время крупно — главное.', a_stroke),
    ('B · Кончик', 'Сверху кромка цвета лака. Время очень крупное, чёрное, как табло.', b_tip),
    ('C · Тон', 'Вся карточка в светлом тоне лака, время — тёмным тоном того же лака.', c_tone),
    ('D · Тихая', 'Без рамок и заливок: линия, тонкое крупное время, капля лака. Как журнал-издание.', d_quiet),
    ('E · Живая', 'Спокойные белые карточки, а та, что идёт сейчас, — залита самим лаком.', e_live),
    ('F · Ноготь', 'Оттенок в форме ногтя справа с названием лака. Время главное слева.', f_nail),
]

W, H = 1760, 960
o = ['<!doctype html>\n<html lang="ru">\n<head>\n<meta charset="utf-8">\n<title>Карточка: 2 + 3</title>\n<script src="./support.js"></script>\n</head>\n<body>\n<x-dc>\n<helmet>\n<link rel="stylesheet" href="%s">\n<style>\nbody{margin:0;font-family:"Noto Sans","Noto Sans Armenian",system-ui,sans-serif;color:%s;background:%s}\n</style>\n</helmet>\n' % (FONT, FG, BG)]
o.append('<div style="width: %dpx; height: %dpx; box-sizing: border-box; padding: 40px 40px; background: %s; display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); column-gap: 28px">' % (W, H, BG))
for title, note, fn in COLS:
    o.append('<section style="display: flex; flex-direction: column; gap: 14px">')
    o.append('<h2 style="margin: 0; font-size: 20px; font-weight: 700">%s</h2>' % title)
    o.append('<p style="margin: 0 0 8px; font-size: 13px; line-height: 1.45; color: %s; min-height: 58px">%s</p>' % (MUTED, note))
    for s in S:
        o.append(fn(s))
    o.append('</section>')
o.append('</div>\n</x-dc>\n<script type="text/x-dc" data-dc-script data-props=\'{"$preview":{"width":%d,"height":%d}}\'>\nclass Component extends DCLogic {\n  renderVals() { return {}; }\n}\n</script>\n</body>\n</html>\n' % (W, H))
io.open(os.path.join(P, 'Cards2.dc.html'), 'w', encoding='utf-8').write(''.join(o))

d = json.load(io.open(os.path.join(P, 'canvas.json'), encoding='utf-8'))
d['boards']['Cards2.dc.html'] = {'x': 0, 'y': 5140, 'w': W, 'h': H, 'title': 'Карточка: 2 + 3 — 6 вариантов'}
if 'Cards2.dc.html' not in d['order']:
    d['order'].append('Cards2.dc.html')
d['notes']['hCards2'] = {'x': 0, 'y': 4880, 'text': 'Карточка: смесь «Оттенка» и «Типографики» — 6 вариантов', 'kind': 'title1', 'maxW': W}
io.open(os.path.join(P, 'canvas.json'), 'w', encoding='utf-8').write(json.dumps(d, ensure_ascii=False, indent=1))
print('ok')
