import { describe, it, expect } from "vitest";
import { mergeSlides } from "./slide-splitter";
import type { Annotation, SlideData } from "./types";

function ann(order: number, startIndex: number, endIndex: number, targetText: string): Annotation {
  return {
    id: `a${order}`,
    startIndex,
    endIndex,
    targetText,
    content: `주석 ${order}`,
    markerType: "underline",
    order,
    color: "#294C67",
  };
}

describe("mergeSlides", () => {
  it("병합 후 클릭 순서(order)를 1부터 다시 매긴다", () => {
    const slides: SlideData[] = [
      { id: "s1", text: "첫째 줄", annotations: [ann(1, 0, 2, "첫째"), ann(2, 3, 5, "줄")] },
      { id: "s2", text: "둘째 줄", annotations: [ann(1, 0, 2, "둘째"), ann(2, 3, 5, "줄"), ann(3, 0, 1, "둘")] },
    ];

    const merged = mergeSlides(slides, 0);

    expect(merged).toHaveLength(1);
    const orders = merged[0].annotations.map((a) => a.order);
    // 지금은 [1,2,1,2,3] 이 나온다 — 클릭 애니메이션 순서가 중복된다.
    expect(orders).toEqual([1, 2, 3, 4, 5]);
  });

  it("병합해도 각 주석의 order는 서로 달라야 한다", () => {
    const slides: SlideData[] = [
      { id: "s1", text: "가나다", annotations: [ann(1, 0, 1, "가")] },
      { id: "s2", text: "라마바", annotations: [ann(1, 0, 1, "라")] },
    ];
    const merged = mergeSlides(slides, 0);
    const orders = merged[0].annotations.map((a) => a.order);
    expect(new Set(orders).size).toBe(orders.length);
  });

  it("두 번째 슬라이드의 인덱스는 첫 슬라이드 길이 + 구분자만큼 밀린다", () => {
    const slides: SlideData[] = [
      { id: "s1", text: "첫째 줄", annotations: [] },
      { id: "s2", text: "둘째 줄", annotations: [ann(1, 0, 2, "둘째")] },
    ];
    const merged = mergeSlides(slides, 0);
    const a = merged[0].annotations[0];
    const shift = "첫째 줄".length + 1;
    expect(a.startIndex).toBe(0 + shift);
    expect(a.endIndex).toBe(2 + shift);
    expect(merged[0].text.slice(a.startIndex, a.endIndex)).toBe("둘째");
  });

  it("마지막 슬라이드에서는 병합하지 않는다", () => {
    const slides: SlideData[] = [
      { id: "s1", text: "가", annotations: [] },
      { id: "s2", text: "나", annotations: [] },
    ];
    expect(mergeSlides(slides, 1)).toBe(slides);
    expect(mergeSlides(slides, -1)).toBe(slides);
  });
});
