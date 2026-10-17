"""Verificação de cor do design system do TMS (pensada para rodar no CI).

Uso:
    python3 -I design/design-system/scripts/check_tokens.py design/design-system/tokens.json [skins/*.json ...]

Confere, nos dois temas:
- texto (role "text"): >= 4.5:1 sobre bg, surface e surface-raised;
- não texto (role "non-text"): >= 3:1 sobre os mesmos fundos;
- "on-*": >= 4.5:1 sobre a cor indicada em "on";
- cada accent-N: fill >= 3:1, text >= 4.5:1, on >= 4.5:1 sobre fill;
- cada accent-N e accent-neutral: dE2000 >= 10 contra action com visão normal, protanopia e
  deuteranopia (simulação de Machado, Oliveira e Fernandes 2009, severidade 1.0);
- overrides de cor das skins passadas como argumento, com as mesmas regras.

Sai com código 1 se alguma regra falhar. Sem dependências além da biblioteca padrão.
"""
import json
import math
import sys
from itertools import combinations

THEMES = ['noite', 'pergaminho']
SURFACES = ['bg', 'surface', 'surface-raised']
MIN_TEXT = 4.5
MIN_NON_TEXT = 3.0
MIN_DE_ACTION = 10.0

# Machado 2009, severidade 1.0 (RGB linear)
PROTAN = [[0.152286, 1.052583, -0.204868],
          [0.114503, 0.786281, 0.099216],
          [-0.003882, -0.048116, 1.051998]]
DEUTAN = [[0.367322, 0.860646, -0.227968],
          [0.280085, 0.672501, 0.047413],
          [-0.011820, 0.042940, 0.968881]]


def hex2rgb(h):
    h = h.lstrip('#')
    if len(h) != 6 or any(c not in '0123456789abcdefABCDEF' for c in h):
        raise ValueError(f'cor inválida: #{h} (use #rrggbb)')
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


def lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def delin(c):
    c = max(0.0, min(1.0, c))
    return 12.92 * c if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055


def lum(h):
    r, g, b = (lin(c) for c in hex2rgb(h))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def ratio(a, b):
    la, lb = lum(a), lum(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def simulate(h, m):
    r, g, b = (lin(c) for c in hex2rgb(h))
    out = [m[i][0] * r + m[i][1] * g + m[i][2] * b for i in range(3)]
    return '#' + ''.join(f'{round(delin(c) * 255):02x}' for c in out)


def rgb2lab(h):
    r, g, b = (lin(c) for c in hex2rgb(h))
    x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047
    y = (0.2126729 * r + 0.7151522 * g + 0.0721750 * b) / 1.0
    z = (0.0193339 * r + 0.1191920 * g + 0.9503041 * b) / 1.08883

    def f(t):
        return t ** (1 / 3) if t > 216 / 24389 else (24389 / 27 * t + 16) / 116
    fx, fy, fz = f(x), f(y), f(z)
    return 116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)


def de2000(h1, h2):
    L1, a1, b1 = rgb2lab(h1)
    L2, a2, b2 = rgb2lab(h2)
    C1, C2 = math.hypot(a1, b1), math.hypot(a2, b2)
    Cb = (C1 + C2) / 2
    G = 0.5 * (1 - math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)))
    a1p, a2p = (1 + G) * a1, (1 + G) * a2
    C1p, C2p = math.hypot(a1p, b1), math.hypot(a2p, b2)
    h1p = math.degrees(math.atan2(b1, a1p)) % 360
    h2p = math.degrees(math.atan2(b2, a2p)) % 360
    dLp, dCp = L2 - L1, C2p - C1p
    if C1p * C2p == 0:
        dhp = 0
    else:
        dhp = h2p - h1p
        if dhp > 180:
            dhp -= 360
        elif dhp < -180:
            dhp += 360
    dHp = 2 * math.sqrt(C1p * C2p) * math.sin(math.radians(dhp / 2))
    Lbp, Cbp = (L1 + L2) / 2, (C1p + C2p) / 2
    if C1p * C2p == 0:
        hbp = h1p + h2p
    elif abs(h1p - h2p) <= 180:
        hbp = (h1p + h2p) / 2
    elif h1p + h2p < 360:
        hbp = (h1p + h2p + 360) / 2
    else:
        hbp = (h1p + h2p - 360) / 2
    T = (1 - 0.17 * math.cos(math.radians(hbp - 30)) + 0.24 * math.cos(math.radians(2 * hbp))
         + 0.32 * math.cos(math.radians(3 * hbp + 6)) - 0.20 * math.cos(math.radians(4 * hbp - 63)))
    dtheta = 30 * math.exp(-((hbp - 275) / 25) ** 2)
    Rc = 2 * math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7))
    Sl = 1 + 0.015 * (Lbp - 50) ** 2 / math.sqrt(20 + (Lbp - 50) ** 2)
    Sc = 1 + 0.045 * Cbp
    Sh = 1 + 0.015 * Cbp * T
    Rt = -math.sin(math.radians(2 * dtheta)) * Rc
    return math.sqrt((dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh))


def de_views(a, b):
    """dE2000 com visão normal, protanopia e deuteranopia."""
    return (de2000(a, b),
            de2000(simulate(a, PROTAN), simulate(b, PROTAN)),
            de2000(simulate(a, DEUTAN), simulate(b, DEUTAN)))


class Report:
    def __init__(self):
        self.failures = []
        self.lines = []

    def check(self, ok, msg):
        self.lines.append(('ok  ' if ok else 'FALHA ') + msg)
        if not ok:
            self.failures.append(msg)


def core_map(tokens, theme):
    return {t['name']: t['value'][theme] for t in tokens['color']['core'] + tokens['color']['accentAlt']}


def apply_overrides(colors, skin, theme):
    for name, value in (skin.get('color') or {}).items():
        if name not in colors:
            raise ValueError(f"skin {skin.get('id')}: override de token inexistente '{name}'")
        colors[name] = value[theme]
    return colors


def check_core(rep, tokens, colors, theme, tag):
    entries = tokens['color']['core'] + tokens['color']['accentAlt']
    for t in entries:
        role, name, value = t['role'], t['name'], colors[t['name']]
        if role in ('text', 'non-text'):
            need = MIN_TEXT if role == 'text' else MIN_NON_TEXT
            worst = min(ratio(value, colors[s]) for s in SURFACES)
            rep.check(worst >= need, f'{tag} {theme:10} {name:18} {value} pior {worst:5.2f}:1 (mín. {need}:1)')
        elif role == 'on':
            r = ratio(value, colors[t['on']])
            rep.check(r >= MIN_TEXT, f'{tag} {theme:10} {name:18} sobre {t["on"]}: {r:5.2f}:1 (mín. {MIN_TEXT}:1)')


def check_accents(rep, tokens, colors, theme):
    action = colors['action']
    for a in tokens['color']['accents']['palette']:
        v = a['value'][theme]
        fill_worst = min(ratio(v['fill'], colors[s]) for s in SURFACES)
        text_worst = min(ratio(v['text'], colors[s]) for s in SURFACES)
        on = ratio(v['on'], v['fill'])
        dn, dp, dd = de_views(v['fill'], action)
        rep.check(fill_worst >= MIN_NON_TEXT, f'acc  {theme:10} {a["name"]:10} fill {v["fill"]} {fill_worst:5.2f}:1')
        rep.check(text_worst >= MIN_TEXT, f'acc  {theme:10} {a["name"]:10} text {v["text"]} {text_worst:5.2f}:1')
        rep.check(on >= MIN_TEXT, f'acc  {theme:10} {a["name"]:10} on {v["on"]} sobre fill {on:5.2f}:1')
        rep.check(min(dn, dp, dd) >= MIN_DE_ACTION,
                  f'acc  {theme:10} {a["name"]:10} dE contra action normal {dn:5.1f} protan {dp:5.1f} deutan {dd:5.1f}')
    dn, dp, dd = de_views(colors['accent-neutral'], action)
    rep.check(min(dn, dp, dd) >= MIN_DE_ACTION,
              f'acc  {theme:10} accent-neutral dE contra action normal {dn:5.1f} protan {dp:5.1f} deutan {dd:5.1f}')


def info_accent_pairs(tokens, theme):
    pal = tokens['color']['accents']['palette']
    close = []
    for a, b in combinations(pal, 2):
        d = min(de_views(a['value'][theme]['fill'], b['value'][theme]['fill']))
        if d < 5:
            close.append(f'{a["name"]} × {b["name"]} ({d:.1f})')
    return close


def main(argv):
    if len(argv) < 2:
        print(__doc__)
        return 2
    with open(argv[1], encoding='utf-8') as fh:
        tokens = json.load(fh)
    skins = []
    for path in argv[2:]:
        with open(path, encoding='utf-8') as fh:
            skins.append(json.load(fh))

    rep = Report()
    for theme in THEMES:
        colors = core_map(tokens, theme)
        check_core(rep, tokens, colors, theme, 'core')
        check_accents(rep, tokens, colors, theme)
        for skin in skins:
            if skin.get('color'):
                skinned = apply_overrides(dict(colors), skin, theme)
                check_core(rep, tokens, skinned, theme, f'skin:{skin["id"]}')

    for line in rep.lines:
        print(line)

    print('\nInformativo: pares de accent com dE < 5 em alguma visão (permitido, porque o nome sempre acompanha a cor):')
    for theme in THEMES:
        pairs = info_accent_pairs(tokens, theme)
        print(f'  {theme}: ' + (', '.join(pairs) if pairs else 'nenhum'))

    print('\nInformativo: separação entre superfícies (por isso surface e surface-raised sempre levam elevação):')
    for theme in THEMES:
        colors = core_map(tokens, theme)
        print(f'  {theme}: bg × surface {ratio(colors["bg"], colors["surface"]):.2f}:1; '
              f'surface × surface-raised {ratio(colors["surface"], colors["surface-raised"]):.2f}:1')

    total = len(rep.lines)
    print(f'\n{total - len(rep.failures)} de {total} verificações passaram.')
    if rep.failures:
        print('Falhas:')
        for f in rep.failures:
            print('  - ' + f)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
