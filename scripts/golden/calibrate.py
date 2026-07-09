"""
폰트별 기하 상수 보정기.

앱의 기하 모델(pptx-geometry.ts)은 새 폰트에 대해 네 개의 숫자를 필요로 한다:
한글 자간(advance), 잉크(cap) 높이, 한컴 기준선 대비 미세 오프셋, 그리고
줄 스텝 비율(lineStepRatio). 이 스크립트는 그 넷을 실제 PowerPoint 렌더에서
직접 잰다. 앱의 계산을 앱의 계산으로 검증하지 않는다 — PowerPoint에게 묻는다.

방법 — 접두사 프로빙(prefix probing):
  대상 직전까지 담은 렌더와 대상까지 담은 렌더를 차분하면, 남는 픽셀이
  PowerPoint 자신이 알려준 대상 글자 상자다. 공백/자간을 추정할 필요가 없다.

한계(다른 하네스 스크립트와 동일한 상시 경고):
  **OfficeCLI 네이티브 렌더는 옛한글 조합용 자모(U+1100 블록)의 OpenType
  shaping을 재현하지 못한다.** 옛한글의 조합 결과는 이 렌더로 판정할 수 없다.
  이 보정기는 현대 한글의 자간/높이/기준선 측정에만 쓴다.

사용:  python calibrate.py <port> "<폰트 이름>"
"""
import io
import json
import os
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime

# Windows 콘솔(cp949)에서 한글/특수문자가 출력을 죽이지 않게
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

HERE = os.path.dirname(os.path.abspath(__file__))
MEASURE = os.path.join(HERE, "measure.py")
OUT_JSON = os.path.join(HERE, "data", "font-calibration.json")

# --- 기하 상수 (pptx-constants.ts / pptx-geometry.ts 와 일치해야 한다) --------
PXI = 1280 / 13.33            # px per inch (1280px 슬라이드 폭 / 13.33in)
TEXT_TOP_MARGIN = 0.2         # 본문 상단 인셋(in)
BASELINE_OFFSET_EM = 0.130    # 한컴산뜻돋움에 적합한 기준선 상수항(em)
BASELINE_LS_COEF = 0.896      # 기준선의 lineSpacing 계수(em)
LINE_DRIFT = 0.015            # 줄당 누적 드리프트 보정(in)

# --- 이 보정의 고정 측정 조건 -------------------------------------------------
FONT_SIZE = 36
LINE_SPACING = 1.8
GENRE = "poetry"
EM_PX = FONT_SIZE / 72 * PXI          # = 48.012
DRIFT_PX = LINE_DRIFT * PXI

# --- 코퍼스 ------------------------------------------------------------------
H10 = "가나다라마바사아자차"                      # 단일 줄, 한글 10자
LINES3 = ["가나다라마바사아자차", "나나나나나", "다다다다다"]
# TEXT4: 대상 "대상"은 줄 인덱스 3에 있다.
PRE_L3 = "\n".join(LINES3) + "\n라라라 "          # 대상 직전까지
UPTO_L3 = "\n".join(LINES3) + "\n라라라 대상"      # 대상까지 (= TEXT4)

OFFICECLI = shutil.which("officecli")
if not OFFICECLI:
    raise SystemExit("officecli가 PATH에 없다 (npm i -g @officecli/officecli)")

if len(sys.argv) < 3:
    raise SystemExit('사용: python calibrate.py <port> "<폰트 이름>"')

PORT = sys.argv[1]
FONT = sys.argv[2]

WORK = tempfile.mkdtemp(prefix="calib-")

# urllib은 여기서 임포트 — officecli/인자 가드를 먼저 통과하도록
import urllib.request  # noqa: E402


def settings():
    """이 보정의 고정 슬라이드 설정. fontFamily만 대상 폰트로 바뀐다."""
    return {
        "slideWidth": 13.33, "slideHeight": 7.5,
        "fontSize": FONT_SIZE, "lineSpacing": LINE_SPACING,
        "fontFamily": FONT,
        "annotationFontSize": 24, "textAreaHeightRatio": 0.65,
    }


def render(text, base):
    """text를 담은 슬라이드를 렌더하고 PNG 경로를 반환한다(마커 없음)."""
    payload = {
        "genre": GENRE, "fullText": text,
        "slides": [{"id": "s1", "text": text, "annotations": []}],
        "settings": settings(),
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


def diff(pre_png, upto_png):
    """pre(대상 직전)와 upto(대상까지) 렌더를 차분해 대상 글자 bbox를 얻는다."""
    return measure(upto_png, "target", pre_png)["target"]


def need(box, label):
    """프로빙 상자가 None이면(글자가 안 잡힘) 보정 불가 — exit 2."""
    if box is None:
        print(f"ERROR: '{label}' 프로빙 상자가 비었다 — 폰트 '{FONT}' 렌더에서 "
              f"글자 잉크를 못 찾았다(설치 안 됨/이름 오타/렌더 실패?).", flush=True)
        sys.exit(2)
    return box


def main():
    # --- 렌더 6장(순차) -------------------------------------------------------
    #  1) empty  2) upto1  3) pre9  4) upto10  5) pre_l3  6) upto_l3
    empty = render("", os.path.join(WORK, "empty"))
    upto1 = render(H10[:1], os.path.join(WORK, "upto1"))
    pre9 = render(H10[:9], os.path.join(WORK, "pre9"))
    upto10 = render(H10, os.path.join(WORK, "upto10"))
    pre_l3 = render(PRE_L3, os.path.join(WORK, "pre_l3"))
    upto_l3 = render(UPTO_L3, os.path.join(WORK, "upto_l3"))

    # --- 픽셀 측정(접두사 차분) ----------------------------------------------
    first = need(diff(empty, upto1), "first")      # 첫 글자 상자
    tenth = need(diff(pre9, upto10), "tenth")      # 10번째 글자 상자
    line0 = need(diff(empty, upto10), "line0")     # 줄 전체 잉크 상자
    l3 = need(diff(pre_l3, upto_l3), "l3")         # 줄3의 '대상' 상자

    # --- 파생 숫자 ------------------------------------------------------------
    # 한글 advance: 첫 글자와 10번째 글자의 x0 두 점 차 / 9 (좌측 베어링 상쇄).
    hangul_advance_em = (tenth["x0"] - first["x0"]) / 9 / EM_PX

    # 잉크(cap) 높이: 줄0 잉크 상자의 세로 높이.
    cap_height_em = (line0["y1"] - line0["y0"]) / EM_PX

    # 기준선 미세 오프셋: 한컴에 적합한 공식이 line=0에서 예측한 기준선 대비
    # 실측 기준선(줄0 잉크 바닥 y1)의 차. 한글은 디센더가 없어 y1 ~= baseline.
    hancom_baseline_px = (
        TEXT_TOP_MARGIN
        + (BASELINE_OFFSET_EM + BASELINE_LS_COEF * LINE_SPACING) * (FONT_SIZE / 72)
    ) * PXI
    baseline_adjust_em = (line0["y1"] - hancom_baseline_px) / EM_PX

    # 줄 스텝 비율: 줄3 기준선 − 줄0 기준선 = 3*stepPx − 3*driftPx 를 역산.
    line_step_ratio = ((l3["y1"] - line0["y1"]) + 3 * DRIFT_PX) / (
        3 * FONT_SIZE * LINE_SPACING / 72 * PXI)

    record = {
        "hangulAdvanceEm": round(hangul_advance_em, 4),
        "capHeightEm": round(cap_height_em, 4),
        "baselineAdjustEm": round(baseline_adjust_em, 4),
        "lineStepRatio": round(line_step_ratio, 4),
        "fontSize": FONT_SIZE,
        "lineSpacing": LINE_SPACING,
        "measuredAt": datetime.now().astimezone().isoformat(timespec="seconds"),
        # 감사용 원시 픽셀값 — 파생식을 다시 검산할 수 있게 그대로 보관.
        "points": {
            "first": first,
            "tenth": tenth,
            "line0": line0,
            "l3": l3,
            "emPx": round(EM_PX, 4),
            "driftPx": round(DRIFT_PX, 4),
            "hancomBaselinePx": round(hancom_baseline_px, 4),
        },
    }

    # --- read-modify-write ----------------------------------------------------
    data = {}
    if os.path.exists(OUT_JSON):
        with open(OUT_JSON, encoding="utf-8") as f:
            data = json.load(f)
    data[FONT] = record
    os.makedirs(os.path.dirname(OUT_JSON), exist_ok=True)
    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    # --- 사람용 한 줄 요약 ----------------------------------------------------
    print(
        f"[{FONT}] hangulAdvanceEm={record['hangulAdvanceEm']:.4f}  "
        f"capHeightEm={record['capHeightEm']:.4f}  "
        f"baselineAdjustEm={record['baselineAdjustEm']:+.4f}  "
        f"lineStepRatio={record['lineStepRatio']:.4f}  "
        f"→ {OUT_JSON}  (렌더: {WORK})", flush=True)

    # --- 상식 가드(컨트롤러가 최종 판정 — 벗어나도 기록은 한다) ----------------
    if not (0.4 <= hangul_advance_em <= 1.3):
        print(f"WARNING: hangulAdvanceEm={hangul_advance_em:.4f} ∉ [0.4, 1.3] "
              "— 자간 측정이 의심스럽다(컨트롤러 판정 필요).", flush=True)
    if not (1.0 <= line_step_ratio <= 1.5):
        print(f"WARNING: lineStepRatio={line_step_ratio:.4f} ∉ [1.0, 1.5] "
              "— 줄 스텝 측정이 의심스럽다(컨트롤러 판정 필요).", flush=True)


if __name__ == "__main__":
    main()
