"""
PPTX 골든 렌더 측정 유틸.

앱의 기하 계산을 앱의 기하 계산으로 검증하면 순환논증이다.
대신 PowerPoint가 실제로 그린 픽셀을 기준으로 삼는다.

핵심 기법 — 접두사 프로빙(prefix probing):
  대상 문자열의 x 구간을 알아내기 위해, 본문을 대상 직전까지만 담은 슬라이드와
  대상까지 담은 슬라이드를 각각 렌더해 글자의 오른쪽 끝을 잰다.
  그 차이가 PowerPoint 자신이 알려준 대상의 x 구간이다.

주석 텍스트 측정 기법 — 이중 렌더 차분(double-render diff):
  마커 도형과 주석 설명 텍스트는 같은 주석색을 쓰므로 한 렌더로는 둘을 못 나눈다.
  같은 레이아웃을 두 번 렌더한다 — shape 변형(content:"")은 도형만, full 변형은
  도형+텍스트가 유채색이다. 두 렌더는 픽셀 정렬돼 있으므로 유채 마스크의 위치
  집합 차분이 곧 주석 텍스트 픽셀이다.

사용:
  python measure.py <png> --mode glyphs           # 본문 글자 bbox / 줄별 분석
  python measure.py <png> --mode marker           # 마커(비검정 유채색) bbox
  python measure.py <full_png> --mode anntext --shape-png <shape_png>  # 주석 텍스트 배치
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


def anntext(full_png, shape_png):
    """
    주석 설명 텍스트의 배치를 측정한다 (이중 렌더 차분).

    shape 변형(content:"")은 마커 도형만 유채색이고, full 변형은 도형 + 주석 텍스트가
    유채색이다. 두 렌더가 같은 레이아웃이면 픽셀이 정렬되므로, 유채 마스크의 위치
    집합 차분(full − shape)에 남는 픽셀이 곧 주석 텍스트다.

    반환 JSON:
      text          : 텍스트 픽셀의 bbox / 줄별 밴드 / 픽셀 수
      overlapShapePx: 텍스트 픽셀 ∩ 도형 픽셀 수
      overlapBodyPx : 텍스트 픽셀이 본문 줄 밴드 사각형 안에 든 수
      bodyBands     : 본문 글자 줄 밴드
    """
    a = Image.open(shape_png).convert("RGB")   # 도형만
    b = Image.open(full_png).convert("RGB")    # 도형 + 텍스트
    if a.size != b.size:
        raise SystemExit("shape/full 렌더 크기가 다르다 — 같은 레이아웃으로 렌더해야 한다")

    chromA = drop_specks(mask(a, is_marker))
    chromB = drop_specks(mask(b, is_marker))
    setA = set(chromA)

    # 위치 집합 차분: full 에만 있는 유채 픽셀 = 주석 텍스트.
    # drop_specks 로 안티에일리어싱 잔여 얼룩을 죽인다.
    text_px = drop_specks(list(set(chromB) - setA), min_size=25)

    body_px = mask(b, is_body)
    body_bands = line_boxes(body_px)

    # overlapShapePx: 텍스트 픽셀이 도형 픽셀과 겹치는 수.
    # 주의 — text_px 는 setA 를 뺀 차분이라 정의상 setA 와 서로소이고, drop_specks 는
    # 픽셀을 더하지 않으므로 이 값은 구조적으로 0에 수렴한다. 도형과 텍스트가 같은
    # 색이라 텍스트가 도형 위에 얹히면 두 렌더에서 모두 마커색이라 차분에서 상쇄되기
    # 때문이다(측정 트릭의 한계). 따라서 이 지표는 분류가 무너지는 병리적 경우를
    # 잡는 구조적 가드이며, 텍스트가 도형 위에 앉는 실제 사고는 오히려 text.count 가
    # 줄어드는 것으로 드러난다.
    overlap_shape = len(set(text_px) & setA)

    # overlapBodyPx: 텍스트 픽셀이 본문 줄 밴드의 사각형(밴드 y구간 AND x구간) 안에
    # 드는 수를 센다. 각 픽셀은 한쪽 색으로만 분류되므로 텍스트 잉크가 본문 잉크와
    # 좌표를 문자 그대로 공유할 수는 없다 — 사각형 침범이 "주석 텍스트가 본문 줄
    # 위를/속을 지나 그려졌다"의 올바른 프록시다.
    overlap_body = 0
    for (x, y) in text_px:
        for band in body_bands:
            if band["y0"] <= y <= band["y1"] and band["x0"] <= x <= band["x1"]:
                overlap_body += 1
                break

    return {
        "text": {"bbox": bbox(text_px), "bands": line_boxes(text_px), "count": len(text_px)},
        "overlapShapePx": overlap_shape,
        "overlapBodyPx": overlap_body,
        "bodyBands": body_bands,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("png")
    ap.add_argument("--mode", choices=["glyphs", "marker", "both", "target", "anntext"], default="both")
    ap.add_argument("--prefix-png", help="target 모드: 접두사만 담은 렌더")
    ap.add_argument("--shape-png", help="anntext 모드: content:\"\" 로 렌더한 도형만 변형")
    a = ap.parse_args()

    if a.mode == "target":
        if not a.prefix_png:
            raise SystemExit("--prefix-png 필요")
        t = target_bbox(a.prefix_png, a.png)
        # "target"은 bbox (기존 sweep 스크립트 호환), "targetBands"는 줄별 상자
        sys.stdout.write(json.dumps({"target": t["bbox"], "targetBands": t["bands"]}))
        return

    if a.mode == "anntext":
        if not a.shape_png:
            raise SystemExit("--shape-png 필요")
        # png = full 변형, shape-png = 도형만 변형
        sys.stdout.write(json.dumps(anntext(a.png, a.shape_png), ensure_ascii=False))
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
