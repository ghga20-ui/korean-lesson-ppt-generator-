/**
 * annotation-layout.ts 등가성 핀 테스트 (vitest, node).
 *
 * 기대값은 리팩터 전 buildSlide가 내던 인치 좌표를 그대로 고정한 것이다.
 * layoutAnnotation은 buildSlide의 수식을 순수 추출한 것이므로 값이 한 치도
 * 달라지면 안 된다. 아래 숫자는 리팩터 전 코드 경로(구 buildSlide 수식을
 * 독립 재현한 스크래치 하니스)로 산출해 하드코딩한 등가성 핀이다.
 *   // 리팩터 전 buildSlide 산출값을 고정한 등가성 핀
 */
import { describe, it, expect } from "vitest";
import { layoutAnnotation } from "./annotation-layout";
import type { Annotation, PptSettings } from "./types";

const POETRY: PptSettings = {
  slideWidth: 13.33, slideHeight: 7.5, fontSize: 36, lineSpacing: 1.8,
  fontFamily: "한컴산뜻돋움", annotationFontSize: 28, textAreaHeightRatio: 0.65,
};
const POETRY_LS12: PptSettings = { ...POETRY, lineSpacing: 1.2 };
const NOVEL: PptSettings = {
  slideWidth: 13.33, slideHeight: 7.5, fontSize: 28, lineSpacing: 1.8,
  fontFamily: "한컴산뜻돋움", annotationFontSize: 24, textAreaHeightRatio: 0.72,
};
const POETRY_FS44: PptSettings = { ...POETRY, fontSize: 44 };
const MALGUN: PptSettings = { ...POETRY, fontFamily: "맑은 고딕" };

// 김소월 「진달래꽃」 발췌 — 3줄(줄바꿈 2개).
const POEM = "나 보기가 역겨워\n가실 때에는\n말없이 고이 보내 드리우리다";
const LINE = "봄이 온다"; // 단일 줄

function ann(
  markerType: Annotation["markerType"],
  startIndex: number,
  endIndex: number,
): Annotation {
  return {
    id: "x", startIndex, endIndex, targetText: "", content: "주석",
    markerType, order: 1, color: "#294C67",
  };
}

const P = 6; // toBeCloseTo 소수 6자리

describe("layoutAnnotation 등가성 핀", () => {
  // (1) 시(poetry) 36/1.8 밑줄 — 마지막 줄 target.
  it("poetry 36/1.8 underline lastline", () => {
    const l = layoutAnnotation(POEM, ann("underline", 24, 32), POETRY);
    expect(l.marker.kind).toBe("underline");
    if (l.marker.kind !== "underline") throw new Error("kind");
    expect(l.marker.segments).toHaveLength(1);
    expect(l.marker.segments[0].x).toBeCloseTo(3.1015, P);
    expect(l.marker.segments[0].y).toBeCloseTo(3.31056, P);
    expect(l.marker.segments[0].w).toBeCloseTo(3.404500000000001, P);
    expect(l.text!.x).toBeCloseTo(3.1015, P);
    expect(l.text!.y).toBeCloseTo(3.2805600000000004, P);
    expect(l.text!.w).toBeCloseTo(9.9285, P);
    expect(l.text!.fontSizePt).toBe(28);
  });

  // (2) 시 36/1.8 밑줄 — 마지막 줄이 아닌 target(둘째 줄).
  it("poetry 36/1.8 underline notlast", () => {
    const l = layoutAnnotation(POEM, ann("underline", 10, 12), POETRY);
    expect(l.marker.kind).toBe("underline");
    if (l.marker.kind !== "underline") throw new Error("kind");
    expect(l.marker.segments).toHaveLength(1);
    expect(l.marker.segments[0].x).toBeCloseTo(0.5, P);
    expect(l.marker.segments[0].y).toBeCloseTo(2.2309799999999997, P);
    expect(l.marker.segments[0].w).toBeCloseTo(0.935, P);
    expect(l.text!.x).toBeCloseTo(0.5, P);
    expect(l.text!.y).toBeCloseTo(2.20098, P);
    expect(l.text!.w).toBeCloseTo(12.53, P);
    expect(l.text!.fontSizePt).toBe(28);
  });

  // (3) ls1.2 축소 케이스 — 회랑이 좁아 주석 폰트가 하한 10pt로 클램프된다.
  it("ls1.2 shrink → fontSizePt === 10", () => {
    const l = layoutAnnotation(POEM, ann("underline", 10, 12), POETRY_LS12);
    expect(l.marker.kind).toBe("underline");
    if (l.marker.kind !== "underline") throw new Error("kind");
    expect(l.marker.segments[0].x).toBeCloseTo(0.5, P);
    expect(l.marker.segments[0].y).toBeCloseTo(1.5973199999999999, P);
    expect(l.marker.segments[0].w).toBeCloseTo(0.935, P);
    expect(l.text!.x).toBeCloseTo(0.5, P);
    expect(l.text!.y).toBeCloseTo(1.5673199999999998, P);
    expect(l.text!.w).toBeCloseTo(12.53, P);
    expect(l.text!.fontSizePt).toBe(10);
  });

  // (4) 소설(novel) 28pt 원(circle).
  it("novel 28 circle", () => {
    const l = layoutAnnotation(POEM, ann("circle", 2, 5), NOVEL);
    expect(l.marker.kind).toBe("shape");
    if (l.marker.kind !== "shape") throw new Error("kind");
    expect(l.marker.shape).toBe("circle");
    expect(l.marker.x).toBeCloseTo(0.8807222222222222, P);
    expect(l.marker.y).toBeCloseTo(0.4422, P);
    expect(l.marker.w).toBeCloseTo(1.2619444444444445, P);
    expect(l.marker.h).toBeCloseTo(0.5211111111111112, P);
    expect(l.text!.x).toBeCloseTo(0.8807222222222222, P);
    expect(l.text!.y).toBeCloseTo(0.9333111111111112, P);
    expect(l.text!.w).toBeCloseTo(12.149277777777778, P);
    expect(l.text!.fontSizePt).toBe(24);
  });

  // (5) 브라켓 44pt 단일 글자(단일 줄).
  it("bracket 44 single char", () => {
    const l = layoutAnnotation(LINE, ann("bracket", 0, 1), POETRY_FS44);
    expect(l.marker.kind).toBe("bracket");
    if (l.marker.kind !== "bracket") throw new Error("kind");
    expect(l.marker.open.x).toBeCloseTo(0.2311111111111111, P);
    expect(l.marker.open.y).toBeCloseTo(0.5928222222222221, P);
    expect(l.marker.open.size).toBeCloseTo(0.6111111111111112, P);
    expect(l.marker.close.x).toBeCloseTo(0.8025, P);
    expect(l.marker.close.y).toBeCloseTo(0.6844888888888887, P);
    expect(l.marker.close.size).toBeCloseTo(0.6111111111111112, P);
    expect(l.text!.x).toBeCloseTo(0.5, P);
    expect(l.text!.y).toBeCloseTo(1.2655999999999998, P);
    expect(l.text!.w).toBeCloseTo(12.53, P);
    expect(l.text!.fontSizePt).toBe(28);
  });

  // (6) 브라켓 — 줄바꿈을 가로지르는 target(첫 줄 → 둘째 줄).
  it("bracket spanning newline", () => {
    const l = layoutAnnotation(POEM, ann("bracket", 6, 12), POETRY);
    expect(l.marker.kind).toBe("bracket");
    if (l.marker.kind !== "bracket") throw new Error("kind");
    expect(l.marker.open.x).toBeCloseTo(2.414, P);
    expect(l.marker.open.y).toBeCloseTo(0.5214, P);
    expect(l.marker.open.size).toBeCloseTo(0.5, P);
    expect(l.marker.close.x).toBeCloseTo(1.215, P);
    expect(l.marker.close.y).toBeCloseTo(1.6759799999999996, P);
    expect(l.marker.close.size).toBeCloseTo(0.5, P);
    expect(l.text!.x).toBeCloseTo(2.6340000000000003, P);
    expect(l.text!.y).toBeCloseTo(1.3114, P);
    expect(l.text!.w).toBeCloseTo(10.395999999999999, P);
    expect(l.text!.fontSizePt).toBe(21);
  });

  // (7) 요약(summary) — 박스만 반환하고 주석 텍스트 레이아웃은 없다.
  it("summary", () => {
    const l = layoutAnnotation(POEM, ann("summary", 0, 5), POETRY);
    expect(l.marker.kind).toBe("summary");
    if (l.marker.kind !== "summary") throw new Error("kind");
    expect(l.marker.x).toBeCloseTo(0.5, P);
    expect(l.marker.y).toBeCloseTo(6.75, P);
    expect(l.marker.w).toBeCloseTo(12.33, P);
    expect(l.marker.h).toBeCloseTo(0.55, P);
    expect(l.text).toBeUndefined();
  });

  // (8) 맑은 고딕 폰트 — baselineAdjustEm/capHeightEm 경로를 탄다(밑줄 notlast).
  it("malgun font case", () => {
    const l = layoutAnnotation(POEM, ann("underline", 10, 12), MALGUN);
    expect(l.marker.kind).toBe("underline");
    if (l.marker.kind !== "underline") throw new Error("kind");
    expect(l.marker.segments[0].x).toBeCloseTo(0.5, P);
    expect(l.marker.segments[0].y).toBeCloseTo(2.20098, P);
    expect(l.marker.segments[0].w).toBeCloseTo(0.997, P);
    expect(l.text!.x).toBeCloseTo(0.5, P);
    expect(l.text!.y).toBeCloseTo(2.17098, P);
    expect(l.text!.w).toBeCloseTo(12.53, P);
    expect(l.text!.fontSizePt).toBe(28);
  });
});
