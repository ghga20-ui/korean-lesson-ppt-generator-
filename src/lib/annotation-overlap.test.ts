/**
 * annotation-overlap.ts 겹침 검출 테스트 (vitest, node).
 *
 * layoutAnnotation의 인치 좌표를 그대로 소비하므로, 같은 줄의 주석 텍스트
 * 박스는 동일 y에 앉고 폭이 슬라이드 우측까지 뻗어 반드시 교차한다.
 * 서로 다른 줄이면 y 간격(줄 스텝 ≈ 1.08in @ 36pt/1.8)이 박스 높이(0.6in)를
 * 넘어 교차하지 않는다.
 */
import { describe, it, expect } from "vitest";
import { detectTextOverlaps } from "./annotation-overlap";
import type { Annotation, PptSettings, SlideData } from "./types";

const POETRY: PptSettings = {
  slideWidth: 13.33, slideHeight: 7.5, fontSize: 36, lineSpacing: 1.8,
  fontFamily: "한컴산뜻돋움", annotationFontSize: 28, textAreaHeightRatio: 0.65,
};

// 김소월 「진달래꽃」 발췌 — 3줄(줄바꿈 2개).
// 줄0: 0..8 / 줄1: 10..15 / 줄2: 17..31
const POEM = "나 보기가 역겨워\n가실 때에는\n말없이 고이 보내 드리우리다";

function ann(
  id: string,
  markerType: Annotation["markerType"],
  startIndex: number,
  endIndex: number,
): Annotation {
  return {
    id, startIndex, endIndex, targetText: "", content: "주석",
    markerType, order: 1, color: "#294C67",
  };
}

function slide(annotations: Annotation[]): SlideData {
  return { id: "s1", text: POEM, annotations };
}

describe("detectTextOverlaps", () => {
  // (a) 같은 줄(마지막 줄)의 인접 대상 2개 — 텍스트 박스가 같은 y에 앉고
  //     둘 다 우측 끝까지 뻗으므로 1쌍이 겹친다.
  it("같은 줄 인접 대상 2개 주석 → 겹침 1쌍", () => {
    const s = slide([
      ann("a1", "underline", 17, 20), // 말없이
      ann("a2", "underline", 24, 26), // 보내
    ]);
    const pairs = detectTextOverlaps(s, POETRY);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]).toEqual({ a: "a1", b: "a2" });
  });

  // (b) 서로 다른 줄(줄0 vs 줄2) — y 간격이 박스 높이를 넘어 겹치지 않는다.
  it("서로 다른 줄 → 0쌍", () => {
    const s = slide([
      ann("a1", "underline", 2, 5),   // 보기가 (줄0)
      ann("a2", "underline", 24, 26), // 보내 (줄2)
    ]);
    expect(detectTextOverlaps(s, POETRY)).toHaveLength(0);
  });

  // (c) 같은 줄 3개 — 쌍별 검사이므로 최소 2쌍 이상 나온다.
  it("같은 줄 3개 → 최소 2쌍", () => {
    const s = slide([
      ann("a1", "underline", 17, 19), // 말없
      ann("a2", "underline", 21, 23), // 고이
      ann("a3", "underline", 24, 26), // 보내
    ]);
    const pairs = detectTextOverlaps(s, POETRY);
    expect(pairs.length).toBeGreaterThanOrEqual(2);
  });

  // summary는 text 레이아웃이 없으므로 겹침 후보에서 자연 제외된다.
  it("summary 주석은 제외된다", () => {
    const s = slide([
      ann("a1", "underline", 17, 20),
      ann("sum", "summary", 0, POEM.length),
    ]);
    expect(detectTextOverlaps(s, POETRY)).toHaveLength(0);
  });
});
