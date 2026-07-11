/**
 * 주석 텍스트 박스 겹침 검출 — 순수 계산 모듈.
 *
 * layoutAnnotation이 내는 인치 좌표(exporter와 동일)를 소비해 주석 텍스트
 * 박스끼리의 쌍별 교차를 판정한다. exporter는 주석 텍스트를 고정 높이
 * ANNOTATION_TEXT_HEIGHT 박스로 그리므로 여기서도 같은 높이를 쓴다.
 *
 * 부작용 없음, DOM 접근 없음 — vitest(node)에서 바로 실행 가능하다.
 */

import type { SlideData, PptSettings } from "./types";
import { layoutAnnotation } from "./annotation-layout";
import { ANNOTATION_TEXT_HEIGHT } from "./pptx-constants";

/**
 * 가장자리 접촉(x2 === x1 + w 같은 경계 일치)을 겹침으로 오탐하지 않기 위한
 * 여유(인치). 겹침 폭/높이가 이 값을 초과해야 실제 교차로 인정한다.
 */
const OVERLAP_EPSILON = 0.02;

interface Rect {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * 슬라이드의 주석 텍스트 박스들 중 서로 겹치는 쌍을 반환한다.
 *
 * - 각 주석의 layoutAnnotation(...).text가 있으면 사각형
 *   {x, y, w, h: ANNOTATION_TEXT_HEIGHT}로 본다.
 * - summary 주석은 text 레이아웃이 없으므로 자연히 제외된다.
 * - 겹침 판정: 두 사각형의 교차 폭·높이가 모두 OVERLAP_EPSILON을 초과할 때.
 *
 * @returns 겹치는 주석 id 쌍 목록. a는 slide.annotations 순서상 앞의 주석.
 */
export function detectTextOverlaps(
  slide: SlideData,
  settings: PptSettings,
): Array<{ a: string; b: string }> {
  const totalLines = slide.text.split("\n").length;

  const rects: Rect[] = [];
  for (const ann of slide.annotations) {
    const layout = layoutAnnotation(slide.text, ann, settings, totalLines);
    if (layout.text) {
      rects.push({
        id: ann.id,
        x: layout.text.x,
        y: layout.text.y,
        w: layout.text.w,
        h: ANNOTATION_TEXT_HEIGHT,
      });
    }
  }

  const overlaps: Array<{ a: string; b: string }> = [];
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const r1 = rects[i];
      const r2 = rects[j];
      const overlapW =
        Math.min(r1.x + r1.w, r2.x + r2.w) - Math.max(r1.x, r2.x);
      const overlapH =
        Math.min(r1.y + r1.h, r2.y + r2.h) - Math.max(r1.y, r2.y);
      if (overlapW > OVERLAP_EPSILON && overlapH > OVERLAP_EPSILON) {
        overlaps.push({ a: r1.id, b: r2.id });
      }
    }
  }

  return overlaps;
}
