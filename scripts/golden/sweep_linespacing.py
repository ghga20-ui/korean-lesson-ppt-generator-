"""
lineSpacing 대조군.

`getShapeGeometry`의 GLYPH_Y_OFFSET_* 는 `s = fontSize / 36` 으로만 스케일된다.
줄 간격은 스케일에 들어가지 않는다. 그런데 PowerPoint의 글자 세로 위치는
줄 상자 높이(= fontSize x lineStepRatio x lineSpacing)에 딸려 움직인다.

따라서 lineSpacing 을 기본값(1.8)에서 벗어나게 하면 마커가 어긋나야 한다.
이 스크립트가 그 예측을 검증한다.

사용: python sweep_linespacing.py <port> <out.json>
"""
import json
import os
import shutil
import subprocess
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
MEASURE = os.path.join(HERE, "measure.py")
OFFICECLI = shutil.which("officecli")
if not OFFICECLI:
    raise SystemExit("officecli를 PATH에서 찾을 수 없다")

PORT = sys.argv[1] if len(sys.argv) > 1 else "3000"
OUT = sys.argv[2] if len(sys.argv) > 2 else "measurements_ls.json"

LINE = "나 보기가 역겨워"
TARGET = "역겨워"
FS = 36
SPACINGS = [1.2, 1.5, 1.8, 2.2]
MARKERS = ["underline", "circle"]


def deck(text, anns, ls):
    return {
        "genre": "poetry", "fullText": text,
        "slides": [{"id": "s1", "text": text, "annotations": anns}],
        "settings": {"slideWidth": 13.33, "slideHeight": 7.5, "fontSize": FS,
                     "lineSpacing": ls, "fontFamily": "한컴산뜻돋움",
                     "annotationFontSize": 24, "textAreaHeightRatio": 0.65},
    }


def render(payload, base):
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(f"http://localhost:{PORT}/api/generate-pptx",
                                 data=body, headers={"Content-Type": "application/json"},
                                 method="POST")
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


def main():
    col = LINE.index(TARGET)
    out = []
    for ls in SPACINGS:
        pre = render(deck(LINE[:col], [], ls), f"ls_{ls}_pre")
        upto = render(deck(LINE[:col + len(TARGET)], [], ls), f"ls_{ls}_upto")
        tb = measure(upto, "target", pre)["target"]

        for mk in MARKERS:
            ann = {"id": "a1", "startIndex": col, "endIndex": col + len(TARGET),
                   "targetText": TARGET, "content": "", "markerType": mk,
                   "order": 1, "color": "#294C67"}
            png = render(deck(LINE, [ann], ls), f"ls_{ls}_{mk}")
            m = measure(png, "marker")["marker"]
            out.append({"lineSpacing": ls, "fontSize": FS, "markerType": mk,
                        "targetGlyphBox": tb, "shapeBBox": m["bbox"],
                        "shapeBars": m["bars"], "png": png})
            print(f"  ls={ls} {mk:10s} target={tb} shape={m['bbox']}", flush=True)

    json.dump({"pxPerInch": 1280 / 13.33, "cases": out},
              open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"\nwrote {OUT}")


if __name__ == "__main__":
    main()
