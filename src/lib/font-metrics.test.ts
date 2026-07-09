/**
 * 폰트 메트릭 테이블 및 per-font 필드가 기하 모델로 전달되는지 검증한다 (vitest, node).
 */
import { describe, it, expect } from "vitest";
import {
  FONT_METRICS,
  SUPPORTED_FONTS,
  FONT_LABELS,
  getFontMetrics,
} from "./font-metrics";
import { estimateTextPosition } from "./pptx-geometry";
import type { PptSettings } from "./types";

const EXPECTED_FONTS = ["한컴산뜻돋움", "맑은 고딕", "바탕", "돋움", "나눔고딕", "나눔명조"];

function settingsFor(fontFamily: string): PptSettings {
  return {
    slideWidth: 13.33,
    slideHeight: 7.5,
    fontSize: 36,
    lineSpacing: 1.8,
    fontFamily,
    annotationFontSize: 24,
    textAreaHeightRatio: 0.65,
  };
}

// ---------------------------------------------------------------------------
// (a) 테이블 구성 · 순서
// ---------------------------------------------------------------------------

describe("FONT_METRICS 테이블 구성", () => {
  it("정확히 6개 폰트를 담는다", () => {
    expect(Object.keys(FONT_METRICS)).toEqual(EXPECTED_FONTS);
    expect(SUPPORTED_FONTS).toHaveLength(6);
  });

  it("한컴산뜻돋움이 SUPPORTED_FONTS의 첫 항목이다", () => {
    expect(SUPPORTED_FONTS[0]).toBe("한컴산뜻돋움");
    expect(SUPPORTED_FONTS).toEqual(EXPECTED_FONTS);
  });
});

// ---------------------------------------------------------------------------
// (b) 값 범위 정합성
// ---------------------------------------------------------------------------

describe("메트릭 값 범위", () => {
  it.each(SUPPORTED_FONTS)("%s: 모든 필드가 물리적으로 타당한 범위에 있다", (font) => {
    const m = FONT_METRICS[font];
    expect(m.lineStepRatio).toBeGreaterThanOrEqual(1.0);
    expect(m.lineStepRatio).toBeLessThanOrEqual(1.5);
    expect(m.hangul).toBeGreaterThanOrEqual(0.5);
    expect(m.hangul).toBeLessThanOrEqual(1.2);
    if (m.capHeightEm !== undefined) {
      expect(m.capHeightEm).toBeGreaterThanOrEqual(0.7);
      expect(m.capHeightEm).toBeLessThanOrEqual(1.0);
    }
    if (m.baselineAdjustEm !== undefined) {
      expect(Math.abs(m.baselineAdjustEm)).toBeLessThanOrEqual(0.1);
    }
  });
});

// ---------------------------------------------------------------------------
// (c) 폴백
// ---------------------------------------------------------------------------

describe("getFontMetrics 폴백", () => {
  it("미등록 폰트명은 한컴산뜻돋움으로 폴백한다", () => {
    expect(getFontMetrics("존재하지 않는 폰트")).toBe(FONT_METRICS["한컴산뜻돋움"]);
    expect(getFontMetrics("")).toBe(FONT_METRICS["한컴산뜻돋움"]);
  });

  it("등록된 폰트명은 해당 메트릭을 반환한다", () => {
    expect(getFontMetrics("맑은 고딕")).toBe(FONT_METRICS["맑은 고딕"]);
  });
});

// ---------------------------------------------------------------------------
// (d) 라벨 커버리지
// ---------------------------------------------------------------------------

describe("FONT_LABELS", () => {
  it("SUPPORTED_FONTS의 모든 폰트에 라벨이 있다", () => {
    for (const font of SUPPORTED_FONTS) {
      expect(typeof FONT_LABELS[font]).toBe("string");
      expect(FONT_LABELS[font].length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// baselineAdjustEm 전달 검증 (기하 스레딩 증명)
// ---------------------------------------------------------------------------

describe("baselineAdjustEm이 baseline으로 전달된다", () => {
  it("동일 설정에서 맑은 고딕 baseline은 한컴 대비 baselineAdjustEm·em 만큼 차이 난다", () => {
    const fontSize = 36;
    const em = fontSize / 72;
    const hancom = estimateTextPosition("가나다", 0, 3, settingsFor("한컴산뜻돋움"));
    const malgun = estimateTextPosition("가나다", 0, 3, settingsFor("맑은 고딕"));

    const expectedDelta = getFontMetrics("맑은 고딕").baselineAdjustEm! * em;
    expect(Math.abs(malgun.baseline - hancom.baseline - expectedDelta)).toBeLessThan(1e-9);
  });
});
