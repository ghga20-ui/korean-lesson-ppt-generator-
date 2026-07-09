import { describe, it, expect } from "vitest";
import { matchAnnotationsToText, distributeAnnotationsToSlides } from "./annotation-matcher";
import type { ExtractedAnnotation, SlideData } from "./types";

function ext(targetText: string, content: string, markerType: ExtractedAnnotation["markerType"] = "underline"): ExtractedAnnotation {
  return { targetText, content, markerType };
}

function slide(id: string, text: string): SlideData {
  return { id, text, annotations: [] };
}

describe("matchAnnotationsToText — 출현 위치", () => {
  it("같은 targetText가 여러 번 나오면 주석마다 서로 다른 출현에 붙는다", () => {
    const fullText = "구보는 다시 걷기로 한다.\n밤이 되어 구보는 집으로 돌아왔다.";
    const first = fullText.indexOf("구보");
    const second = fullText.indexOf("구보", first + 1);

    const { matched, unmatched } = matchAnnotationsToText(fullText, [
      ext("구보", "첫 등장 — 산책의 시작", "circle"),
      ext("구보", "귀가 — 하루의 끝", "rectangle"),
    ]);

    expect(unmatched).toHaveLength(0);
    expect(matched).toHaveLength(2);
    expect(matched[0].startIndex).toBe(first);
    expect(matched[1].startIndex).toBe(second);
    expect(matched[0].startIndex).not.toBe(matched[1].startIndex);
  });

  it("출현 횟수보다 주석이 많으면 남는 주석은 unmatched로 떨어진다", () => {
    const fullText = "구보는 걷는다.";
    const { matched, unmatched } = matchAnnotationsToText(fullText, [
      ext("구보", "첫 번째"),
      ext("구보", "두 번째 — 원문에 두 번째 구보가 없다"),
    ]);

    expect(matched).toHaveLength(1);
    expect(unmatched).toHaveLength(1);
    expect(unmatched[0].content).toContain("두 번째");
  });

  it("서로 다른 targetText는 각자 첫 출현을 가져간다", () => {
    const fullText = "나 보기가 역겨워 가실 때에는";
    const { matched, unmatched } = matchAnnotationsToText(fullText, [
      ext("역겨워", "반어"),
      ext("때에는", "가정"),
    ]);
    expect(unmatched).toHaveLength(0);
    expect(matched[0].targetText).toBe("역겨워");
    expect(matched[1].targetText).toBe("때에는");
    expect(matched[1].startIndex).toBeGreaterThan(matched[0].endIndex);
  });

  it("곡선 따옴표만 다른 targetText도 정규화 경로로 매칭된다", () => {
    const fullText = "그는 ‘사랑’이라 말했다.";
    const { matched, unmatched } = matchAnnotationsToText(fullText, [ext("'사랑'", "작은따옴표 강조")]);
    expect(unmatched).toHaveLength(0);
    expect(matched).toHaveLength(1);
  });

  it("원문에 없는 targetText는 unmatched로 떨어진다", () => {
    const { matched, unmatched } = matchAnnotationsToText("가나다라", [ext("마바사", "없는 말")]);
    expect(matched).toHaveLength(0);
    expect(unmatched).toHaveLength(1);
  });

  it("matched의 targetText는 원문에서 잘라낸 실제 문자열이다", () => {
    const fullText = "나 보기가 역겨워";
    const { matched } = matchAnnotationsToText(fullText, [ext("역겨워", "반어")]);
    const a = matched[0];
    expect(fullText.slice(a.startIndex, a.endIndex)).toBe(a.targetText);
  });
});

describe("distributeAnnotationsToSlides — 슬라이드 경계", () => {
  it("경계를 걸치는 주석이 양쪽 슬라이드에 모두 나타난다", () => {
    const fullText = "첫째 줄입니다\n둘째 줄입니다";
    const slides = [slide("s1", "첫째 줄입니다"), slide("s2", "둘째 줄입니다")];

    const start = fullText.indexOf("줄입니다");
    const end = fullText.indexOf("둘째") + 2;
    const anns = [{
      id: "a1", startIndex: start, endIndex: end,
      targetText: fullText.slice(start, end),
      content: "경계를 넘는 주석", markerType: "underline" as const,
      order: 1, color: "#294C67",
    }];

    const out = distributeAnnotationsToSlides(fullText, slides, anns);

    expect(out[0].annotations).toHaveLength(1);
    expect(out[1].annotations).toHaveLength(1);
    // 앞쪽 조각은 슬라이드1의 끝까지, 뒤쪽 조각은 슬라이드2의 처음부터
    expect(out[0].annotations[0].targetText).toBe("줄입니다");
    expect(out[1].annotations[0].targetText).toBe("둘째");
  });

  it("경계를 걸치는 주석의 설명 텍스트는 시작 슬라이드에만 붙는다", () => {
    const fullText = "첫째 줄입니다\n둘째 줄입니다";
    const slides = [slide("s1", "첫째 줄입니다"), slide("s2", "둘째 줄입니다")];
    const start = fullText.indexOf("줄입니다");
    const end = fullText.indexOf("둘째") + 2;
    const anns = [{
      id: "a1", startIndex: start, endIndex: end,
      targetText: fullText.slice(start, end),
      content: "경계를 넘는 주석", markerType: "underline" as const,
      order: 1, color: "#294C67",
    }];

    const out = distributeAnnotationsToSlides(fullText, slides, anns);
    expect(out[0].annotations[0].content).toBe("경계를 넘는 주석");
    expect(out[1].annotations[0].content).toBe("");
  });

  it("경계를 걸치지 않는 주석은 자기 슬라이드에만 한 번 나타난다", () => {
    const fullText = "첫째 줄입니다\n둘째 줄입니다";
    const slides = [slide("s1", "첫째 줄입니다"), slide("s2", "둘째 줄입니다")];
    const start = fullText.indexOf("둘째");
    const anns = [{
      id: "a1", startIndex: start, endIndex: start + 2,
      targetText: "둘째", content: "두 번째", markerType: "circle" as const,
      order: 1, color: "#294C67",
    }];

    const out = distributeAnnotationsToSlides(fullText, slides, anns);
    expect(out[0].annotations).toHaveLength(0);
    expect(out[1].annotations).toHaveLength(1);
    expect(out[1].annotations[0].startIndex).toBe(0);
  });

  it("슬라이드 안의 인덱스는 그 슬라이드 텍스트를 정확히 가리킨다", () => {
    const fullText = "가나다\n라마바";
    const slides = [slide("s1", "가나다"), slide("s2", "라마바")];
    const anns = [{
      id: "a1", startIndex: 4, endIndex: 6, targetText: "라마",
      content: "c", markerType: "underline" as const, order: 1, color: "#294C67",
    }];

    const out = distributeAnnotationsToSlides(fullText, slides, anns);
    const a = out[1].annotations[0];
    expect(out[1].text.slice(a.startIndex, a.endIndex)).toBe(a.targetText);
  });
});
