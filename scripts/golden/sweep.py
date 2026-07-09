"""
마커 기하 스윕: 마커 종류 x 폰트 크기 x 줄 번호 를 실제 PowerPoint로 렌더해 측정한다.

앱의 계산을 앱의 계산으로 검증하면 순환논증이므로, 대상 글자의 위치는
'접두사 프로빙'으로 PowerPoint에게 직접 물어본다:
  - 대상 직전까지 담은 슬라이드
  - 대상까지 담은 슬라이드
두 렌더의 글자 마스크 차분에 남는 픽셀이 곧 대상의 글자 상자다.

산출: measurements.json

주의: OfficeCLI 네이티브 렌더는 옛한글 조합용 자모의 OpenType shaping을
재현하지 못한다. 옛한글 케이스는 이 스윕에 넣지 말 것.
"""
import json
import os
import shutil
import subprocess
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
MEASURE = os.path.join(HERE, "measure.py")

# Windows에서 officecli는 .cmd 래퍼다. shutil.which가 PATHEXT를 존중해 찾아준다.
OFFICECLI = shutil.which("officecli")
if not OFFICECLI:
    raise SystemExit("officecli를 PATH에서 찾을 수 없다: npm i -g @officecli/officecli")

PORT = sys.argv[1] if len(sys.argv) > 1 else "3000"
OUT = sys.argv[2] if len(sys.argv) > 2 else "measurements.json"

LINES = ["나 보기가 역겨워", "가실 때에는", "말없이 고이 보내"]
TARGETS = {0: "역겨워", 2: "고이"}

MARKERS = ["underline", "circle", "rectangle", "triangle", "bracket"]
SIZES = [24, 36, 44]
LINE_SPACING = 1.8


def deck(text, anns, fs):
    return {
        "genre": "poetry",
        "fullText": text,
        "slides": [{"id": "s1", "text": text, "annotations": anns}],
        "settings": {
            "slideWidth": 13.33, "slideHeight": 7.5,
            "fontSize": fs, "lineSpacing": LINE_SPACING,
            "fontFamily": "한컴산뜻돋움", "annotationFontSize": 24,
            "textAreaHeightRatio": 0.65,
        },
    }


def generate_pptx(payload, path):
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        f"http://localhost:{PORT}/api/generate-pptx",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        if r.status != 200:
            raise SystemExit(f"generate-pptx 실패: HTTP {r.status}")
        with open(path, "wb") as f:
            f.write(r.read())


def render(payload, base):
    generate_pptx(payload, f"{base}.pptx")
    subprocess.run(
        [OFFICECLI, "view", f"{base}.pptx", "screenshot",
         "--render", "native", "-o", f"{base}.png"],
        check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    return f"{base}.png"


def measure(png, mode, prefix_png=None):
    cmd = [sys.executable, MEASURE, png, "--mode", mode]
    if prefix_png:
        cmd += ["--prefix-png", prefix_png]
    r = subprocess.run(cmd, capture_output=True, text=True, check=True)
    return json.loads(r.stdout)


def global_index(line_no, col):
    return sum(len(l) + 1 for l in LINES[:line_no]) + col


def main():
    results = []
    targets_cache = {}

    for fs in SIZES:
        for line_no, tgt in TARGETS.items():
            col = LINES[line_no].index(tgt)

            # 접두사 프로빙 — 앞 줄들은 그대로 두고 해당 줄만 잘라낸다
            pre_text = "\n".join(LINES[:line_no] + [LINES[line_no][:col]])
            upto_text = "\n".join(LINES[:line_no] + [LINES[line_no][:col + len(tgt)]])

            pre_png = render(deck(pre_text, [], fs), f"sw_{fs}_{line_no}_pre")
            upto_png = render(deck(upto_text, [], fs), f"sw_{fs}_{line_no}_upto")
            tb = measure(upto_png, "target", pre_png)["target"]
            targets_cache[(fs, line_no)] = tb

            full_text = "\n".join(LINES)
            gi = global_index(line_no, col)

            for mk in MARKERS:
                def ann(content):
                    return {
                        "id": "a1", "startIndex": gi, "endIndex": gi + len(tgt),
                        "targetText": tgt, "content": content, "markerType": mk,
                        "order": 1, "color": "#294C67",
                    }

                # 도형과 주석 텍스트는 같은 색이라 한 렌더에서 분리되지 않는다.
                # content를 비워 도형만 남긴 렌더를 따로 찍는다.
                shape_png = render(deck(full_text, [ann("")], fs), f"sw_{fs}_{line_no}_{mk}_shape")
                shape = measure(shape_png, "marker")["marker"]

                full_png = render(deck(full_text, [ann("주석 텍스트")], fs), f"sw_{fs}_{line_no}_{mk}_full")
                full = measure(full_png, "marker")["marker"]
                glyphs = measure(full_png, "glyphs")["glyphs"]

                results.append({
                    "fontSize": fs, "lineSpacing": LINE_SPACING,
                    "line": line_no, "target": tgt, "markerType": mk,
                    "targetGlyphBox": tb,
                    "shapeBBox": shape["bbox"],
                    "shapeBars": shape["bars"],
                    "shapeBands": shape["lines"],
                    "withTextBBox": full["bbox"],
                    "withTextBands": full["lines"],
                    "bodyGlyphLines": glyphs["lines"],
                    "shapePng": shape_png, "fullPng": full_png,
                })
                print(f"  {fs}pt line{line_no} {mk:10s} target={tb} shape={shape['bbox']}", flush=True)

    with open(OUT, "w", encoding="utf-8") as f:
        json.dump({"pxPerInch": 1280 / 13.33, "cases": results}, f, ensure_ascii=False, indent=1)
    print(f"\nwrote {OUT}: {len(results)} cases")


if __name__ == "__main__":
    main()
