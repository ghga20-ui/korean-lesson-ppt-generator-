/**
 * Tier-1 골든 기하 회귀 테스트 (vitest, PowerPoint 불필요 — npm test에 포함).
 *
 * 지상진리: scripts/golden/data/*.json — 실제 PowerPoint 렌더에서
 * 접두사 프로빙으로 얻은 대상 문자열의 글자 상자(targetGlyphBox).
 *
 * 앱의 기하 함수(estimateTextPosition / getUnderlineSegments / getShapeGeometry)가
 * 그 실측을 재현하는지 단언한다. 상수를 재튜닝하면 여기서 즉시 잡힌다.
 *
 * 허용치 근거: baseline 모델 최대 잔차 2.32px + 힌팅 ~0.7px → 3.0px.
 * 잉크 높이 실측 0.844~0.903em, 측변 베어링 0.06~0.13em.
 */
import { describe, it, expect } from "vitest";
import { estimateTextPosition, getUnderlineSegments, getShapeGeometry } from "../../src/lib/pptx-geometry";
import type { PptSettings } from "../../src/lib/types";
import type { MarkerType } from "../../src/lib/types";

import mainData from "./data/measurements.json";
import lsData from "./data/measurements_ls.json";
import cornerData from "./data/measurements_corners.json";

const PXI = mainData.pxPerInch; // 96.024

interface GlyphBox { x0: number; x1: number; y0: number; y1: number }

function settingsFor(fontSize: number, lineSpacing: number): PptSettings {
  return {
    slideWidth: 13.33,
    slideHeight: 7.5,
    fontSize,
    lineSpacing,
    fontFamily: "한컴산뜻돋움",
    annotationFontSize: 24,
    textAreaHeightRatio: 0.65,
  };
}

// ---------------------------------------------------------------------------
// 스윕 코퍼스 재구성 (sweep.py / sweep_linespacing.py / sweep_corners.py와 동일)
// ---------------------------------------------------------------------------

const MAIN_LINES = ["나 보기가 역겨워", "가실 때에는", "말없이 고이 보내"];
const MAIN_TARGETS: Record<number, string> = { 0: "역겨워", 2: "고이" };
const SINGLE_LINE = "나 보기가 역겨워";
const SINGLE_TARGET = "역겨워";

function mainIndex(line: number): { text: string; start: number; end: number } {
  const text = MAIN_LINES.join("\n");
  const target = MAIN_TARGETS[line];
  const col = MAIN_LINES[line].indexOf(target);
  const start = MAIN_LINES.slice(0, line).reduce((acc, l) => acc + l.length + 1, 0) + col;
  return { text, start, end: start + target.length };
}

function singleIndex(): { text: string; start: number; end: number } {
  const col = SINGLE_LINE.indexOf(SINGLE_TARGET);
  return { text: SINGLE_LINE, start: col, end: col + SINGLE_TARGET.length };
}

/** 13개 distinct (fs, ls, line) 베이스라인 셀 — 파일 간 중복 제거 */
interface BaselineCell {
  fontSize: number;
  lineSpacing: number;
  line: number;
  glyph: GlyphBox;
  text: string;
  start: number;
  end: number;
}

function collectBaselineCells(): BaselineCell[] {
  const seen = new Set<string>();
  const cells: BaselineCell[] = [];

  for (const c of mainData.cases) {
    const key = `${c.fontSize}/${c.lineSpacing}/${c.line}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const { text, start, end } = mainIndex(c.line);
    cells.push({ fontSize: c.fontSize, lineSpacing: c.lineSpacing, line: c.line, glyph: c.targetGlyphBox, text, start, end });
  }
  for (const c of lsData.cases) {
    const key = `${c.fontSize}/${c.lineSpacing}/0`;
    if (seen.has(key)) continue;
    seen.add(key);
    const { text, start, end } = singleIndex();
    cells.push({ fontSize: c.fontSize, lineSpacing: c.lineSpacing, line: 0, glyph: c.targetGlyphBox, text, start, end });
  }
  for (const c of cornerData.cases) {
    const key = `${c.fontSize}/${c.lineSpacing}/0`;
    if (seen.has(key)) continue;
    seen.add(key);
    const { text, start, end } = singleIndex();
    cells.push({ fontSize: c.fontSize, lineSpacing: c.lineSpacing, line: 0, glyph: c.targetGlyphBox, text, start, end });
  }
  return cells;
}

const CELLS = collectBaselineCells();

// ---------------------------------------------------------------------------
// 1. baseline: 예측 baseline ≈ 실측 글자 잉크 바닥
// ---------------------------------------------------------------------------

describe("baseline 모델 vs PowerPoint 실측", () => {
  it("distinct 셀이 13개다 (스윕 커버리지 고정)", () => {
    expect(CELLS.length).toBe(13);
  });

  it.each(CELLS.map((c) => [`fs${c.fontSize}/ls${c.lineSpacing}/line${c.line}`, c] as const))(
    "%s: |baseline − 실측 잉크 바닥| ≤ 3px",
    (_label, cell) => {
      const pos = estimateTextPosition(cell.text, cell.start, cell.end, settingsFor(cell.fontSize, cell.lineSpacing));
      const baselinePx = pos.baseline * PXI;
      expect(Math.abs(baselinePx - cell.glyph.y1)).toBeLessThanOrEqual(3.0);
    },
  );
});

// ---------------------------------------------------------------------------
// 2. 밑줄: 관통 금지 + 간격 균일
// ---------------------------------------------------------------------------

describe("밑줄 위치", () => {
  const gaps: number[] = [];

  it.each(CELLS.map((c) => [`fs${c.fontSize}/ls${c.lineSpacing}/line${c.line}`, c] as const))(
    "%s: 밑줄이 글자 아래 0 < gap ≤ 0.30em",
    (_label, cell) => {
      const segs = getUnderlineSegments(cell.text, cell.start, cell.end, settingsFor(cell.fontSize, cell.lineSpacing));
      expect(segs).toHaveLength(1);
      const emPx = (cell.fontSize / 72) * PXI;
      const gapEm = (segs[0].y * PXI - cell.glyph.y1) / emPx;
      gaps.push(gapEm);
      expect(gapEm).toBeGreaterThan(0);
      expect(gapEm).toBeLessThanOrEqual(0.30);
    },
  );

  it("13셀의 gap 표준편차 ≤ 0.04em (크기·줄간격 무관 균일)", () => {
    expect(gaps.length).toBe(13);
    const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const std = Math.sqrt(gaps.reduce((a, g) => a + (g - mean) ** 2, 0) / gaps.length);
    expect(std).toBeLessThanOrEqual(0.04);
  });
});

// ---------------------------------------------------------------------------
// 3. 감싸기 도형: 글자 상자를 실제로 감싼다
// ---------------------------------------------------------------------------

const ENCLOSURE_MARGINS: Record<string, { top: [number, number]; bottom: [number, number] }> = {
  circle: { top: [0.03, 0.35], bottom: [0.03, 0.35] },
  rectangle: { top: [0.03, 0.35], bottom: [0.03, 0.35] },
  triangle: { top: [0.25, 0.55], bottom: [0.03, 0.35] },
};

describe("감싸기 도형 enclosure", () => {
  const shapeCases = mainData.cases.filter((c) => c.markerType in ENCLOSURE_MARGINS);

  it.each(shapeCases.map((c) => [`${c.markerType}/fs${c.fontSize}/line${c.line}`, c] as const))(
    "%s: 도형이 글자 잉크를 지정 여유로 감싼다",
    (_label, c) => {
      const { text, start, end } = mainIndex(c.line);
      const pos = estimateTextPosition(text, start, end, settingsFor(c.fontSize, c.lineSpacing));
      const geom = getShapeGeometry(c.markerType as MarkerType, pos, c.fontSize);
      const emPx = (c.fontSize / 72) * PXI;
      const topMarginEm = (c.targetGlyphBox.y0 - geom.y * PXI) / emPx;
      const bottomMarginEm = ((geom.y + geom.h) * PXI - c.targetGlyphBox.y1) / emPx;
      const m = ENCLOSURE_MARGINS[c.markerType];
      expect(topMarginEm).toBeGreaterThanOrEqual(m.top[0]);
      expect(topMarginEm).toBeLessThanOrEqual(m.top[1]);
      expect(bottomMarginEm).toBeGreaterThanOrEqual(m.bottom[0]);
      expect(bottomMarginEm).toBeLessThanOrEqual(m.bottom[1]);
    },
  );
});

// ---------------------------------------------------------------------------
// 4. x 커버: 시작 x가 실측 글자 왼쪽에 정렬 (측변 베어링 0.06~0.13em 관측)
// ---------------------------------------------------------------------------

describe("x 정렬", () => {
  it.each(CELLS.map((c) => [`fs${c.fontSize}/ls${c.lineSpacing}/line${c.line}`, c] as const))(
    "%s: pos.x ∈ [glyph.x0 − 0.25em, glyph.x0 + 0.10em]",
    (_label, cell) => {
      const pos = estimateTextPosition(cell.text, cell.start, cell.end, settingsFor(cell.fontSize, cell.lineSpacing));
      const emPx = (cell.fontSize / 72) * PXI;
      const posXpx = pos.x * PXI;
      expect(posXpx).toBeGreaterThanOrEqual(cell.glyph.x0 - 0.25 * emPx);
      expect(posXpx).toBeLessThanOrEqual(cell.glyph.x0 + 0.10 * emPx);
    },
  );
});
