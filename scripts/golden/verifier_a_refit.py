# Verifier A: refit baseline(0) = TEXT_TOP + (a + b*ls)*em from measurements_ls.json ONLY,
# then predict every other baseline cell (measurements.json line 0 & 2, corners) without refitting.
import json, itertools

BASE = 'C:/Users/admin/Desktop/2026_project/project1-ppt-generator/scripts/golden/data/'
ls_data = json.load(open(BASE + 'measurements_ls.json', encoding='utf-8'))
main = json.load(open(BASE + 'measurements.json', encoding='utf-8'))
corners = json.load(open(BASE + 'measurements_corners.json', encoding='utf-8'))

PPI = ls_data['pxPerInch']          # 96.02400600150037
TEXT_TOP = 0.2 * PPI                # 19.2048 px
DRIFT_IN = 0.015                    # in per line index

def em_px(fs): return fs / 72.0 * PPI
def line_step_px(fs, ls): return fs * 1.22 * ls / 72.0 * PPI

# ---- Fit from measurements_ls.json only (fs=36, line 0) ----
# glyph bottom convention: y1 = last ink row -> ink bottom edge ~ y1 (we fit both y1 and y1+1
# and keep the convention consistent through prediction, so 'a' absorbs the half-pixel).
pts = {}
for c in ls_data['cases']:
    pts[c['lineSpacing']] = c['targetGlyphBox']['y1']  # underline & circle share the box
xs = sorted(pts)
em36 = em_px(36)
# least squares on baseline_px = TEXT_TOP + (a + b*ls)*em
# -> (y1 - TEXT_TOP)/em = a + b*ls
import statistics
X = xs
Y = [(pts[ls] - TEXT_TOP) / em36 for ls in xs]
n = len(X)
mx, my = sum(X)/n, sum(Y)/n
b = sum((x-mx)*(y-my) for x, y in zip(X, Y)) / sum((x-mx)**2 for x in X)
a = my - b*mx
print(f'FIT from measurements_ls.json only (fs=36, y1 as ink bottom):')
print(f'  a = {a:.4f}   b = {b:.4f}')
for ls in xs:
    pred = TEXT_TOP + (a + b*ls) * em36
    print(f'  ls={ls}: measured y1={pts[ls]}  fit={pred:.2f}  resid={pts[ls]-pred:+.2f}px')

# ---- Predict everything else, NO refit ----
def predict_bottom(fs, ls, line):
    return TEXT_TOP + (a + b*ls) * em_px(fs) + line * line_step_px(fs, ls) - line * DRIFT_IN * PPI

rows = []
seen = set()
for c in main['cases']:
    fs, ls, line = c['fontSize'], c['lineSpacing'], c['line']
    gb = c['targetGlyphBox']
    key = (fs, ls, line, gb['y0'], gb['y1'])
    tag = f"main fs{fs} ls{ls} line{line} {c['markerType']}"
    pred = predict_bottom(fs, ls, line)
    err = gb['y1'] - pred
    dedup = key not in seen
    seen.add(key)
    rows.append((tag, gb['y0'], gb['y1'], pred, err, dedup))
for c in corners['cases']:
    fs, ls = c['fontSize'], c['lineSpacing']
    gb = c['targetGlyphBox']
    pred = predict_bottom(fs, ls, 0)
    err = gb['y1'] - pred
    rows.append((f"corner fs{fs} ls{ls} line0 {c['markerType']}", gb['y0'], gb['y1'], pred, err, True))

print('\nPREDICTIONS (no refit): case | measured y1 | predicted | error px')
maxerr = 0.0
for tag, y0, y1, pred, err, dedup in rows:
    star = '' if dedup else ' (dup box)'
    print(f'  {tag:44s} y1={y1:4d}  pred={pred:7.2f}  err={err:+6.2f}{star}')
    maxerr = max(maxerr, abs(err))
print(f'\nMAX |error| over all predicted cells: {maxerr:.2f} px')

# distinct baseline cells
cells = {}
for tag, y0, y1, pred, err, dedup in rows:
    k = tag.rsplit(' ', 1)[0]
    cells.setdefault(k, (y1, pred, err))
print(f'\nDistinct baseline cells: {len(cells)}')
mx2 = max(abs(v[2]) for v in cells.values())
print(f'Max |error| over distinct cells: {mx2:.2f} px')

# ---- Ink height per case ----
print('\nINK HEIGHT (y1-y0)/em per distinct glyph box:')
hs = []
boxes = set()
for src, data in (('ls', ls_data), ('main', main), ('corner', corners)):
    for c in data['cases']:
        fs = c['fontSize']; gb = c['targetGlyphBox']
        k = (src, fs, c.get('lineSpacing'), c.get('line', 0), gb['y0'], gb['y1'])
        if k in boxes: continue
        boxes.add(k)
        h = (gb['y1'] - gb['y0']) / em_px(fs)
        hs.append(h)
        print(f"  {src:6s} fs{fs} ls{c.get('lineSpacing')} line{c.get('line',0)}: h={gb['y1']-gb['y0']}px  h/em={h:.4f}")
print(f'\nink height/em: min={min(hs):.4f} max={max(hs):.4f}')

# ---- Marker defect measurements from main file (ls=1.8) ----
print('\nMARKER MEASUREMENTS vs glyph box (main, ls=1.8):')
for c in main['cases']:
    fs, line, mt = c['fontSize'], c['line'], c['markerType']
    gb, sb = c['targetGlyphBox'], c['shapeBBox']
    bars = c.get('shapeBars', [])
    barinfo = ''
    if bars:
        bar = bars[0]
        barinfo = f" bar_y={bar['y0']}-{bar['y1']} (glyph bottom {gb['y1']}, gap={bar['y0']-gb['y1']:+d})"
    print(f"  fs{fs} line{line} {mt:12s} glyph=({gb['x0']},{gb['y0']})-({gb['x1']},{gb['y1']}) shape=({sb['x0']},{sb['y0']})-({sb['x1']},{sb['y1']}) dx0={sb['x0']-gb['x0']:+d} dx1={sb['x1']-gb['x1']:+d} dy0={sb['y0']-gb['y0']:+d} dy1={sb['y1']-gb['y1']:+d}{barinfo}")

print('\nCORNER underline bars vs glyphs:')
for c in corners['cases']:
    gb = c['targetGlyphBox']; bar = c['shapeBars'][0]
    print(f"  fs{c['fontSize']} ls{c['lineSpacing']}: glyph y {gb['y0']}-{gb['y1']}, bar y {bar['y0']}-{bar['y1']}, bar_top - glyph_bottom = {bar['y0']-gb['y1']:+d}px")

print('\nLS file circle/underline vs glyphs:')
for c in ls_data['cases']:
    gb = c['targetGlyphBox']; sb = c['shapeBBox']
    print(f"  ls{c['lineSpacing']} {c['markerType']:9s}: glyph y {gb['y0']}-{gb['y1']}, shape y {sb['y0']}-{sb['y1']}, x {sb['x0']}-{sb['x1']} (glyph x {gb['x0']}-{gb['x1']})")
