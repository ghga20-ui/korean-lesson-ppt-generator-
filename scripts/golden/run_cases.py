"""
Tier-2 골든 렌더 게이트 러너.

cases/gates.json의 각 케이스를 실제 PowerPoint로 렌더해(OfficeCLI)
접두사 프로빙 + 픽셀 측정으로 invariant를 평가한다.

- officecli가 없으면 SKIP(exit 0) — npm test에는 절대 포함하지 말 것.
- 게이트 하나라도 FAIL이면 exit 1.
- 옛한글 케이스 금지: OfficeCLI 네이티브 렌더는 고자모 shaping을 재현하지 못한다.

사용:  python run_cases.py <port> [케이스이름필터]
npm:   npm run golden:render
"""
import io
import json
import os
import shutil
import subprocess
import sys
import tempfile
import urllib.request

# Windows 콘솔(cp949)에서 ∉·「 같은 문자가 출력을 죽이지 않게
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

HERE = os.path.dirname(os.path.abspath(__file__))
MEASURE = os.path.join(HERE, "measure.py")
PXI = 1280 / 13.33

OFFICECLI = shutil.which("officecli")
if not OFFICECLI:
    print("SKIP: officecli가 PATH에 없다 (npm i -g @officecli/officecli)")
    sys.exit(0)

PORT = sys.argv[1] if len(sys.argv) > 1 else "3000"
FILTER = sys.argv[2] if len(sys.argv) > 2 else ""

WORK = tempfile.mkdtemp(prefix="golden-")


def default_settings(overrides):
    s = {
        "slideWidth": 13.33, "slideHeight": 7.5,
        "fontSize": 36, "lineSpacing": 1.8,
        "fontFamily": "한컴산뜻돋움",
        "annotationFontSize": 24, "textAreaHeightRatio": 0.65,
    }
    genre = overrides.pop("genre", "poetry")
    s.update(overrides)
    return s, genre


def render(text, anns, settings, genre, base):
    payload = {
        "genre": genre, "fullText": text,
        "slides": [{"id": "s1", "text": text, "annotations": anns}],
        "settings": settings,
    }
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        f"http://localhost:{PORT}/api/generate-pptx", data=body,
        headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=120) as r:
        open(f"{base}.pptx", "wb").write(r.read())
    subprocess.run([OFFICECLI, "view", f"{base}.pptx", "screenshot", "--render", "native",
                    "-o", f"{base}.png"], check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return f"{base}.png"


def measure(png, mode, prefix_png=None):
    cmd = [sys.executable, MEASURE, png, "--mode", mode]
    if prefix_png:
        cmd += ["--prefix-png", prefix_png]
    return json.loads(subprocess.run(cmd, capture_output=True, text=True, check=True).stdout)


def probe_target(text, start, end, settings, genre, base):
    """접두사 프로빙: 대상 문자열의 실측 글자 상자(전체 bbox + 줄별 밴드)."""
    pre = render(text[:start], [], settings, genre, f"{base}_pre")
    upto = render(text[:end], [], settings, genre, f"{base}_upto")
    return measure(upto, "target", pre)


# ---------------------------------------------------------------------------
# Invariants
# ---------------------------------------------------------------------------

def inv_underline_gap(case, glyph, marker, em, p):
    bars = marker["bars"]
    exp = p.get("expectedBars", 1)
    if len(bars) < exp:
        return False, f"세그먼트 {exp}개 기대, {len(bars)}개 렌더됨"
    gmin = p.get("gapMinEm", 0.0)
    gmax = p.get("gapMaxEm", 0.25)
    bands = glyph["targetBands"]
    # 각 글자 밴드 아래에 자기 bar가 있어야 한다
    msgs = []
    for band in bands[:exp]:
        below = [b for b in bars if b["y0"] >= band["y1"] - 0.15 * em]
        if not below:
            return False, f"밴드 y1={band['y1']} 아래 bar 없음 (bars={[(b['y0'],b['y1']) for b in bars]})"
        bar = min(below, key=lambda b: b["y0"])
        gap = (bar["y0"] - band["y1"]) / em
        msgs.append(f"gap={gap:+.3f}em")
        if not (gmin < gap <= gmax):
            return False, f"gap {gap:+.3f}em ∉ ({gmin}, {gmax}] " + " ".join(msgs)
    return True, " ".join(msgs)


def inv_underline_gap_and_cover(case, glyph, marker, em, p):
    ok, msg = inv_underline_gap(case, glyph, marker, em, p)
    if not ok:
        return ok, msg
    g = glyph["target"]
    bar = min(marker["bars"], key=lambda b: b["y0"])
    c = p.get("coverEm", 0.2)
    if bar["x0"] > g["x0"] + c * em or bar["x1"] < g["x1"] - c * em:
        return False, f"bar x {bar['x0']}..{bar['x1']} 가 글자 {g['x0']}..{g['x1']} 를 못 덮음"
    return True, msg + " cover-ok"


def inv_underline_x_cover(case, glyph, marker, em, p):
    g = glyph["target"]
    if not marker["bars"]:
        return False, "bar 없음"
    bar = min(marker["bars"], key=lambda b: b["y0"])
    short = (g["x1"] - bar["x1"]) / em     # 양수 = 오른쪽이 모자람
    over = (bar["x1"] - g["x1"]) / em
    if short > p["rightShortMaxEm"]:
        return False, f"오른쪽 {short:.3f}em 부족 (한도 {p['rightShortMaxEm']}) — 폭 모델이 자간을 못 따라감"
    if over > p["rightOverMaxEm"]:
        return False, f"오른쪽 {over:.3f}em 초과"
    gap = (bar["y0"] - g["y1"]) / em
    if not (p["gapMinEm"] < gap <= p["gapMaxEm"]):
        return False, f"gap {gap:+.3f}em ∉ ({p['gapMinEm']}, {p['gapMaxEm']}]"
    return True, f"short={short:+.3f}em gap={gap:+.3f}em"


def inv_summary_box(case, glyph, marker, em, p):
    comps = marker["components"]
    slide_h = 7.5 * PXI
    wide = [c for c in comps
            if (c["x1"] - c["x0"]) >= p["minWidthIn"] * PXI and c["y0"] >= p["minYRatio"] * slide_h]
    if not wide:
        return False, f"하단 요약 상자 미검출 (components={[(c['x0'],c['x1'],c['y0']) for c in comps]})"
    return True, f"box y0={wide[0]['y0']} w={wide[0]['x1']-wide[0]['x0']}px"


def inv_bracket_pair(case, glyph, marker, em, p):
    comps = marker["components"]
    if len(comps) < 2:
        return False, f"브라켓 성분 {len(comps)}개 (2개 필요)"

    # 여러 줄 대상이면 「는 첫 밴드(첫 글자 줄), 」는 마지막 밴드에 붙는다.
    # 전체 bbox의 x0는 둘째 줄 왼쪽 여백이라 기준으로 못 쓴다.
    bands = glyph["targetBands"]
    first, last = bands[0], bands[-1]

    def dist(b, x, y):
        cx, cy = (b["x0"] + b["x1"]) / 2, (b["y0"] + b["y1"]) / 2
        return (cx - x) ** 2 + (cy - y) ** 2

    open_b = min(comps, key=lambda b: dist(b, first["x0"], first["y0"]))
    close_b = min(comps, key=lambda b: dist(b, last["x1"], last["y1"]))
    if open_b is close_b:
        return False, "「 」 가 같은 성분으로 잡힘 — 배치 붕괴"

    msgs = []
    # 「 — 첫 글자 좌상단 근방
    if open_b["x0"] > first["x0"] + 0.3 * em:
        return False, f"「 x0={open_b['x0']} 가 첫 글자 x0={first['x0']} 좌측에 있지 않음"
    if open_b["y1"] > first["y1"] + 0.2 * em:
        return False, f"「 가 첫 줄 글자 아래로 처짐 (y1={open_b['y1']} vs {first['y1']})"
    msgs.append(f"「@({open_b['x0']},{open_b['y0']})")
    # 」 — 마지막 글자 우하단 근방, 바닥에서 분리 금지
    if close_b["x1"] < last["x1"] - 0.3 * em:
        return False, f"」 x1={close_b['x1']} 가 끝 글자 x1={last['x1']} 우측에 있지 않음"
    detach = (last["y1"] - close_b["y1"]) / em   # 양수 = 」 바닥이 글자 바닥보다 위 (분리)
    if detach > 0.20:
        return False, f"」 바닥이 글자 바닥보다 {detach:.3f}em 위 — 분리 (기존 fs44 버그)"
    if (close_b["y1"] - last["y1"]) / em > 0.45:
        return False, "」 가 글자 아래로 과도하게 처짐"
    # 기호 크기가 본문을 따라 스케일: 잉크 높이 ≥ 0.35em
    for name, b in (("「", open_b), ("」", close_b)):
        h = (b["y1"] - b["y0"]) / em
        if h < 0.35:
            return False, f"{name} 잉크 높이 {h:.3f}em < 0.35em — 기호가 본문 대비 왜소"
        msgs.append(f"{name}h={h:.2f}em")
    return True, " ".join(msgs)


def inv_enclosure(case, glyph, marker, em, p):
    """원/사각/삼각 도형이 글자 상자를 감싼다 — 상·하 여백을 em 단위로 검증.

    케이스가 content를 생략하므로 마커는 도형만 유채색이다(글자 잉크는 무채색).
    도형 획은 기하 경로 위에 중심 정렬돼 실측 잉크가 경로보다 ~반획 바깥으로 번진다.
    """
    g = glyph["target"]
    box = marker["bbox"]
    if not box:
        return False, "도형 미검출"
    top = (g["y0"] - box["y0"]) / em      # 양수 = 도형이 글자 위로 여백
    bot = (box["y1"] - g["y1"]) / em      # 양수 = 도형이 글자 아래로 여백
    msg = f"top={top:+.3f}em bot={bot:+.3f}em"
    if not (p["topMinEm"] <= top <= p["topMaxEm"]):
        return False, f"상단 여백 {top:+.3f}em ∉ [{p['topMinEm']}, {p['topMaxEm']}] " + msg
    if not (p["botMinEm"] <= bot <= p["botMaxEm"]):
        return False, f"하단 여백 {bot:+.3f}em ∉ [{p['botMinEm']}, {p['botMaxEm']}] " + msg
    return True, msg


INVARIANTS = {
    "underline_gap": inv_underline_gap,
    "underline_gap_and_cover": inv_underline_gap_and_cover,
    "underline_x_cover": inv_underline_x_cover,
    "summary_box": inv_summary_box,
    "bracket_pair": inv_bracket_pair,
    "enclosure": inv_enclosure,
}


def main():
    spec = json.load(open(os.path.join(HERE, "cases", "gates.json"), encoding="utf-8"))
    cases = [c for c in spec["cases"] if FILTER in c["name"]]
    passed, failed = [], []

    for i, case in enumerate(cases):
        name = case["name"]
        text = case["text"]
        target = case["target"]
        start = text.index(target)
        end = start + len(target)
        settings, genre = default_settings(dict(case.get("settings", {})))
        em = settings["fontSize"] / 72 * PXI
        base = os.path.join(WORK, f"g{i}")

        ann = {"id": "a1", "startIndex": start, "endIndex": end,
               "targetText": target, "content": case.get("content", ""),
               "markerType": case["markerType"], "order": 1, "color": "#294C67"}
        try:
            glyph = probe_target(text, start, end, settings, genre, base)
            png = render(text, [ann], settings, genre, f"{base}_full")
            marker = measure(png, "marker")["marker"]
            ok, msg = INVARIANTS[case["invariant"]](case, glyph, marker, em, case.get("params", {}))
        except Exception as e:  # noqa: BLE001 — 게이트 러너는 원인 보고가 우선
            ok, msg = False, f"실행 오류: {e}"
        tag = "PASS" if ok else "FAIL"
        (passed if ok else failed).append(name)
        print(f"[{tag}] {name}: {msg}", flush=True)

    print(f"\n{len(passed)} PASS / {len(failed)} FAIL   (렌더 산출물: {WORK})")
    if failed:
        for f in failed:
            print("  FAIL:", f)
        sys.exit(1)


if __name__ == "__main__":
    main()
