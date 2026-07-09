"""
코너 셀 스윕: fontSize x lineSpacing 을 동시에 기본값에서 벗어나게 한다.

1차 스윕은 십자 설계였다 — fs 스윕은 ls=1.8 고정, ls 스윕은 fs=36 고정.
그 설계로는 (1) fs와 무관한 상수항(프레임 상단 인셋 tIns)이 a*em에 흡수돼도
보이지 않고, (2) fs x ls 상호작용항도 보이지 않는다.

코너 셀 4개(24/44 x 1.2/2.2)가 두 가설을 동시에 판별한다:
  - 상수항 C가 있다면: em이 다른 두 fs에서 순수 em-비례 모델의 잔차가 갈라진다.
  - 상호작용이 있다면: (fs-36)*(ls-1.8) 부호에 따라 잔차가 갈라진다.

사용: python sweep_corners.py <port> <out.json>
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
    raise SystemExit("officecli not on PATH")

PORT = sys.argv[1] if len(sys.argv) > 1 else "3000"
OUT = sys.argv[2] if len(sys.argv) > 2 else "measurements_corners.json"

LINE = "나 보기가 역겨워"
TARGET = "역겨워"
CELLS = [(24, 1.2), (24, 2.2), (44, 1.2), (44, 2.2)]


def deck(text, anns, fs, ls):
    return {
        "genre": "poetry", "fullText": text,
        "slides": [{"id": "s1", "text": text, "annotations": anns}],
        "settings": {"slideWidth": 13.33, "slideHeight": 7.5, "fontSize": fs,
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
    for fs, ls in CELLS:
        tag = f"c{fs}_{str(ls).replace('.', '')}"
        pre = render(deck(LINE[:col], [], fs, ls), f"{tag}_pre")
        upto = render(deck(LINE[:col + len(TARGET)], [], fs, ls), f"{tag}_upto")
        tb = measure(upto, "target", pre)["target"]

        ann = {"id": "a1", "startIndex": col, "endIndex": col + len(TARGET),
               "targetText": TARGET, "content": "", "markerType": "underline",
               "order": 1, "color": "#294C67"}
        png = render(deck(LINE, [ann], fs, ls), f"{tag}_ul")
        m = measure(png, "marker")["marker"]
        out.append({"fontSize": fs, "lineSpacing": ls, "markerType": "underline",
                    "targetGlyphBox": tb, "shapeBBox": m["bbox"], "shapeBars": m["bars"]})
        print(f"  fs={fs} ls={ls} glyph={tb} bar={m['bars']}", flush=True)

    json.dump({"pxPerInch": 1280 / 13.33, "cases": out},
              open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
