"""
PPTX 골든 렌더 측정 유틸.

앱의 기하 계산을 앱의 기하 계산으로 검증하면 순환논증이다.
대신 PowerPoint가 실제로 그린 픽셀을 기준으로 삼는다.

핵심 기법 — 접두사 프로빙(prefix probing):
  대상 문자열의 x 구간을 알아내기 위해, 본문을 대상 직전까지만 담은 슬라이드와
  대상까지 담은 슬라이드를 각각 렌더해 글자의 오른쪽 끝을 잰다.
  그 차이가 PowerPoint 자신이 알려준 대상의 x 구간이다.

사용:
  python measure.py <png> --mode glyphs           # 본문 글자 bbox / 줄별 분석
  python measure.py <png> --mode marker           # 마커(비검정 유채색) bbox
"""
import sys
import json
import argparse

from PIL import Image

# pptx-constants.ts 와 일치해야 한다
BODY_INK = (34, 34, 34)      # MAIN_TEXT_COLOR #222222
WHITE = (255, 255, 255)


def close(c, t, tol):
    return all(abs(c[i] - t[i]) <= tol for i in range(3))


def is_body(c, tol=45):
    return close(c, BODY_INK, tol)


def is_background(c, tol=12):
    return close(c, WHITE, tol)


def chroma(c):
    return max(c) - min(c)


def _dist_to_segment(p, a, b):
    """RGB 공간에서 점 p와 선분 ab 사이 거리."""
    ax, ay, az = a
    bx, by, bz = b
    px, py, pz = p
    dx, dy, dz = bx - ax, by - ay, bz - az
    denom = dx * dx + dy * dy + dz * dz
    if denom == 0:
        t = 0.0
    else:
        t = ((px - ax) * dx + (py - ay) * dy + (pz - az) * dz) / denom
        t = max(0.0, min(1.0, t))
    qx, qy, qz = ax + t * dx, ay + t * dy, az + t * dz
    return ((px - qx) ** 2 + (py - qy) ** 2 + (pz - qz) ** 2) ** 0.5


def make_is_marker(marker_rgb, tol=42, min_chroma=25):
    """
    마커 픽셀 판정.

    채도만으로는 안 된다. Windows의 ClearType 서브픽셀 안티에일리어싱이
    검은 본문 글자의 가장자리에 유채색 프린지를 만들기 때문에, 채도 기준만
    쓰면 본문 글자가 마커로 잡혀 bbox가 텍스트 전체로 번진다.

    마커는 자기 색에서 흰 배경으로 블렌딩되므로, RGB 공간에서 그 선분 위에
    놓인다. 선분과의 거리로 판정하면 프린지가 걸러진다.
    """
    def pred(c):
        if is_background(c):
            return False
        if chroma(c) < min_chroma:
            return False
        return _dist_to_segment(c, marker_rgb, WHITE) <= tol
    return pred


def is_marker(c, min_chroma=28):
    """기본 마커 색(#294C67)에 대한 편의 함수."""
    return make_is_marker((41, 76, 103))(c)


def mask(im, pred):
    w, h = im.size
    px = im.load()
    pts = [(x, y) for y in range(h) for x in range(w) if pred(px[x, y])]
    return pts


def drop_specks(pts, min_size=25):
    """
    연결 성분(4-이웃)으로 묶어 작은 얼룩을 버린다.

    색 거리 판정을 통과한 뒤에도 ClearType 프린지가 몇 픽셀씩 남는다.
    도형은 크고 연결돼 있으므로, 작은 성분을 버리면 도형만 남는다.
    """
    pset = set(pts)
    seen = set()
    keep = []
    for p in pts:
        if p in seen:
            continue
        stack = [p]
        seen.add(p)
        comp = []
        while stack:
            x, y = stack.pop()
            comp.append((x, y))
            for q in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if q in pset and q not in seen:
                    seen.add(q)
                    stack.append(q)
        if len(comp) >= min_size:
            keep.extend(comp)
    return keep


def bbox(pts):
    if not pts:
        return None
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    return {"x0": min(xs), "x1": max(xs), "y0": min(ys), "y1": max(ys)}


def rows(pts):
    """y -> (x0, x1, count)"""
    by = {}
    for x, y in pts:
        if y in by:
            a, b, n = by[y]
            by[y] = (min(a, x), max(b, x), n + 1)
        else:
            by[y] = (x, x, 1)
    return by


def bands(pts, gap=6):
    """연속된 y 구간(=텍스트 줄)으로 묶는다."""
    ys = sorted({y for _, y in pts})
    if not ys:
        return []
    out = []
    start = prev = ys[0]
    for y in ys[1:]:
        if y - prev > gap:
            out.append((start, prev))
            start = y
        prev = y
    out.append((start, prev))
    return out


def line_boxes(pts, gap=6):
    """각 글자 줄의 bbox."""
    res = []
    for y0, y1 in bands(pts, gap):
        sub = [p for p in pts if y0 <= p[1] <= y1]
        b = bbox(sub)
        b["band"] = [y0, y1]
        res.append(b)
    return res


def horizontal_bars(pts, min_width=20, max_height=8):
    """밑줄처럼 가로로 긴, 세로로 얇은 덩어리를 찾는다."""
    out = []
    for y0, y1 in bands(pts, gap=3):
        sub = [p for p in pts if y0 <= p[1] <= y1]
        b = bbox(sub)
        w = b["x1"] - b["x0"] + 1
        h = b["y1"] - b["y0"] + 1
        if w >= min_width and h <= max_height:
            out.append(b)
    return out


def components(pts, min_size=25):
    """연결 성분별 bbox 목록 (x0 순 정렬). 브라켓 「」 분리 검증용."""
    pset = set(pts)
    seen = set()
    out = []
    for p in pts:
        if p in seen:
            continue
        stack = [p]
        seen.add(p)
        comp = []
        while stack:
            x, y = stack.pop()
            comp.append((x, y))
            for q in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if q in pset and q not in seen:
                    seen.add(q)
                    stack.append(q)
        if len(comp) >= min_size:
            out.append(bbox(comp))
    return sorted(out, key=lambda b: b["x0"])


def target_bbox(prefix_png, upto_png):
    """
    접두사만 담은 렌더와 대상까지 담은 렌더의 글자 마스크를 차분해
    대상 문자열의 글자 bbox를 정확히 얻는다.

    접두사가 진짜 접두사이면 앞쪽 글자들의 배치는 두 렌더에서 동일하므로,
    차분에 남는 픽셀은 대상의 글자뿐이다. 공백 폭을 추정할 필요가 없다.
    """
    a = Image.open(prefix_png).convert("RGB")
    b = Image.open(upto_png).convert("RGB")
    if a.size != b.size:
        raise SystemExit("두 렌더의 크기가 다르다 — 같은 설정으로 렌더해야 한다")
    pa, pb = a.load(), b.load()
    w, h = a.size
    pts = []
    for y in range(h):
        for x in range(w):
            if is_body(pb[x, y]) and not is_body(pa[x, y]):
                pts.append((x, y))
    return {"bbox": bbox(pts), "bands": line_boxes(pts)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("png")
    ap.add_argument("--mode", choices=["glyphs", "marker", "both", "target"], default="both")
    ap.add_argument("--prefix-png", help="target 모드: 접두사만 담은 렌더")
    a = ap.parse_args()

    if a.mode == "target":
        if not a.prefix_png:
            raise SystemExit("--prefix-png 필요")
        t = target_bbox(a.prefix_png, a.png)
        # "target"은 bbox (기존 sweep 스크립트 호환), "targetBands"는 줄별 상자
        sys.stdout.write(json.dumps({"target": t["bbox"], "targetBands": t["bands"]}))
        return

    im = Image.open(a.png).convert("RGB")
    out = {"size": list(im.size)}

    if a.mode in ("glyphs", "both"):
        g = mask(im, is_body)
        out["glyphs"] = {"bbox": bbox(g), "lines": line_boxes(g)}

    if a.mode in ("marker", "both"):
        m = drop_specks(mask(im, is_marker))
        out["marker"] = {
            "bbox": bbox(m),
            "lines": line_boxes(m),
            "bars": horizontal_bars(m),
            "components": components(m),
        }

    sys.stdout.write(json.dumps(out, ensure_ascii=False))


if __name__ == "__main__":
    main()
