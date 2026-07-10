/**
 * 주석(annotation) 레이아웃 순수 계산 모듈.
 *
 * pptx-generator의 buildSlide가 마커/주석 텍스트를 그릴 때 쓰던 인치 좌표
 * 산출식을 pptxgenjs 의존성 없이 그대로 추출한다. HTML 슬라이드 미리보기가
 * exporter와 "완전히 동일한" 인치 좌표를 소비할 수 있도록 하기 위함이며,
 * 값은 buildSlide가 내던 숫자를 한 치도 바꾸지 않는다(순수 lift, 재설계 아님).
 *
 * 클라이언트 안전: pptxgenjs를 import하지 않는다.
 */

import type { Annotation, PptSettings } from "./types";
import { getFontMetrics } from "./font-metrics";
import {
  estimateTextPosition,
  getUnderlineSegments,
  getShapeGeometry,
} from "./pptx-geometry";
import {
  TEXT_LEFT_MARGIN,
  TEXT_TOP_MARGIN,
  ANNOTATION_Y_GAP,
  ANNOTATION_TEXT_HEIGHT,
  MIN_ANNOTATION_WIDTH,
  SUMMARY_BOX_HEIGHT,
  SUMMARY_BOX_BOTTOM_OFFSET,
  LINE_DRIFT_CORRECTION,
  BASELINE_OFFSET_EM,
  BASELINE_LS_COEF,
  CAP_HEIGHT_EM,
  BRACKET_X_INSET_EM,
  BRACKET_OPEN_RISE_EM,
  BRACKET_CLOSE_DROP_EM,
  MULTI_LINE_ANNOTATION_OFFSET,
  GAP_BIAS_FACTOR,
} from "./pptx-constants";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type MarkerLayout =
  | { kind: "underline"; segments: { x: number; y: number; w: number }[] } // y = stroke CENTER (inches)
  | {
      kind: "shape";
      shape: "circle" | "rectangle" | "triangle";
      x: number;
      y: number;
      w: number;
      h: number;
    }
  | {
      kind: "bracket";
      open: { x: number; y: number; size: number };
      close: { x: number; y: number; size: number };
    } // size = box inches; glyph fontSize = settings.fontSize
  | { kind: "summary"; x: number; y: number; w: number; h: number };

export interface AnnotationTextLayout {
  x: number;
  y: number;
  w: number; // inches
  fontSizePt: number; // effAnnotationFontSize (may shrink when cramped)
}

export interface AnnotationLayout {
  marker: MarkerLayout;
  /** absent for summary — its content lives inside the box */
  text?: AnnotationTextLayout;
}

// ---------------------------------------------------------------------------
// Layout calculation
// ---------------------------------------------------------------------------

/**
 * buildSlide가 한 주석에 대해 계산하던 마커 좌표 + 주석 텍스트 좌표를 그대로
 * 반환한다. 반환 좌표는 exporter가 addShape/addText에 넘기던 값과 비트 단위로
 * 동일하다.
 *
 * @param slideTextTotalLines 호출자가 미리 계산한 text.split("\n").length.
 *        생략하면 내부에서 동일하게 계산한다.
 */
export function layoutAnnotation(
  slideText: string,
  annotation: Annotation,
  settings: PptSettings,
  slideTextTotalLines?: number,
): AnnotationLayout {
  const metrics = getFontMetrics(settings.fontFamily);
  const textAreaWidth = settings.slideWidth - TEXT_LEFT_MARGIN * 2;

  const pos = estimateTextPosition(
    slideText,
    annotation.startIndex,
    annotation.endIndex,
    settings,
  );

  let marker: MarkerLayout;
  let shapeBottomY: number;
  let shapeLeftX: number;

  // ---- Marker shape(s) ----
  if (annotation.markerType === "underline") {
    const segments = getUnderlineSegments(
      slideText,
      annotation.startIndex,
      annotation.endIndex,
      settings,
    );

    marker = { kind: "underline", segments };

    // Use first segment for annotation text positioning so annotation
    // appears below the first underline line (not the last).
    shapeBottomY = segments[0].y;
    shapeLeftX = segments[0].x;
  } else if (annotation.markerType === "bracket") {
    const startPos = estimateTextPosition(
      slideText, annotation.startIndex, annotation.startIndex + 1, settings,
    );
    const endPos = estimateTextPosition(
      slideText, annotation.endIndex - 1, annotation.endIndex, settings,
    );
    // 기호는 본문과 같은 크기로 스케일한다. 고정 36pt는 44pt 본문에서
    // 왜소해지고 24pt 본문을 압도했다(실측: 잉크 높이가 본문 크기와 무관하게 ~21px).
    const emInch = settings.fontSize / 72;
    const symbolSize = emInch;

    marker = {
      kind: "bracket",
      // 「 — 시작 글자의 잉크 top 좌상단
      open: {
        x: startPos.x - BRACKET_X_INSET_EM * emInch,
        y: startPos.y - BRACKET_OPEN_RISE_EM * emInch,
        size: symbolSize,
      },
      // 」 — 끝 글자의 baseline 우하단
      close: {
        x: endPos.x + endPos.w - BRACKET_X_INSET_EM * emInch,
        y: endPos.baseline + BRACKET_CLOSE_DROP_EM * emInch - symbolSize,
        size: symbolSize,
      },
    };

    shapeBottomY = endPos.baseline + BRACKET_CLOSE_DROP_EM * emInch;
    shapeLeftX = startPos.x;
  } else if (annotation.markerType === "summary") {
    const summaryBoxW = textAreaWidth;
    const summaryBoxX = TEXT_LEFT_MARGIN;
    const summaryBoxY = settings.slideHeight - SUMMARY_BOX_HEIGHT - SUMMARY_BOX_BOTTOM_OFFSET;

    // 요약 주석은 박스 안에 내용이 들어가므로 별도 주석 텍스트 레이아웃이 없다.
    return {
      marker: {
        kind: "summary",
        x: summaryBoxX,
        y: summaryBoxY,
        w: summaryBoxW,
        h: SUMMARY_BOX_HEIGHT,
      },
    };
  } else {
    const geom = getShapeGeometry(annotation.markerType, pos, settings.fontSize);
    marker = {
      kind: "shape",
      shape: annotation.markerType,
      x: geom.x,
      y: geom.y,
      w: geom.w,
      h: geom.h,
    };
    shapeBottomY = geom.y + geom.h;
    shapeLeftX = geom.x;
  }

  // ---- Annotation text box ----
  // Position annotation text consistently based on the TEXT LINE position,
  // not the shape bottom, so all marker types produce the same text Y.
  const lineStepInch =
    (settings.fontSize * metrics.lineStepRatio * settings.lineSpacing) / 72;
  const emInch = settings.fontSize / 72;
  const totalLines = slideTextTotalLines ?? slideText.split("\n").length;

  // 밑줄은 마지막 줄(끝 세그먼트) 아래, 나머지는 시작 줄 아래에 주석을 단다.
  const annotLine =
    annotation.markerType === "underline" ? pos.endLine : pos.startLine;
  const isMultiLine = pos.endLine > pos.startLine;
  const isLastLine = annotLine >= totalLines - 1;

  // Consistent glyph bottom reference: baseline(annotLine).
  const glyphBottomY =
    TEXT_TOP_MARGIN +
    annotLine * lineStepInch -
    annotLine * LINE_DRIFT_CORRECTION +
    (BASELINE_OFFSET_EM + BASELINE_LS_COEF * settings.lineSpacing) * emInch;

  let annotTextY: number;
  let effAnnotationFontSize = settings.annotationFontSize;
  if (isLastLine) {
    annotTextY = Math.max(shapeBottomY, glyphBottomY) + ANNOTATION_Y_GAP;
  } else {
    const nextLineY = TEXT_TOP_MARGIN + (annotLine + 1) * lineStepInch
      - (annotLine + 1) * LINE_DRIFT_CORRECTION;
    const visibleTextH = settings.annotationFontSize / 72;
    // For underlines, annotLine is already based on the last segment (bottom line),
    // so no extra offset is needed. Only apply MULTI_LINE_ANNOTATION_OFFSET for
    // other marker types where annotLine is based on pos.y (top/first line).
    const anchorY = (isMultiLine && annotation.markerType !== "underline")
      ? glyphBottomY + MULTI_LINE_ANNOTATION_OFFSET
      : Math.max(shapeBottomY, glyphBottomY);
    const gapBias = anchorY + (nextLineY - anchorY) * GAP_BIAS_FACTOR;
    annotTextY = Math.max(
      anchorY + ANNOTATION_Y_GAP,
      gapBias - visibleTextH / 2,
    );

    // 줄 사이 공간이 주석 잉크보다 작으면 주석 폰트를 그 줄에서만 축소한다 —
    // 실측 게이트 anntext-notlast-ls12의 2011px 본문 침범이 근거.
    const nextGlyphTopY =
      TEXT_TOP_MARGIN +
      (annotLine + 1) * lineStepInch -
      (annotLine + 1) * LINE_DRIFT_CORRECTION +
      (BASELINE_OFFSET_EM + BASELINE_LS_COEF * settings.lineSpacing) * emInch +
      (metrics.baselineAdjustEm ?? 0) * emInch -
      (metrics.capHeightEm ?? CAP_HEIGHT_EM) * emInch;
    const gapInch = nextGlyphTopY - annotTextY;
    // 실측(anntext-notlast-ls12 렌더 3회)으로 확정한 텍스트박스 내부 기하:
    //   잉크 top    = boxY + tIns(≈0.05in) + (1.026 − 0.90)·annEm   → boxY + 7px@12pt
    //   잉크 bottom = boxY + tIns + 1.026·annEm
    // (주석 addText는 lineSpacingMultiple 미지정 = 1.0 이므로 baseline 계수 1.026.)
    // 잉크 bottom ≤ nextGlyphTop − 0.03in 이 되도록 역산한다. ls1.2에서는 밑줄과
    // 다음 줄 사이 회랑이 16px뿐이라 12pt도 물리적으로 불가능 — 하한 10pt.
    effAnnotationFontSize = Math.min(
      settings.annotationFontSize,
      Math.max(10, Math.floor(((gapInch - 0.08) * 72) / 1.03)),
    );
  }

  // Start annotation text below target, but ensure minimum width
  let annotTextX = Math.max(TEXT_LEFT_MARGIN, shapeLeftX);
  let annotTextW = settings.slideWidth - annotTextX - 0.3;
  if (annotTextW < MIN_ANNOTATION_WIDTH) {
    annotTextX = Math.max(TEXT_LEFT_MARGIN, settings.slideWidth - MIN_ANNOTATION_WIDTH - 0.3);
    annotTextW = settings.slideWidth - annotTextX - 0.3;
  }

  // Clamp so it doesn't overflow below the slide
  const clampedY = Math.min(
    annotTextY,
    settings.slideHeight - ANNOTATION_TEXT_HEIGHT - 0.1,
  );

  return {
    marker,
    text: {
      x: annotTextX,
      y: clampedY,
      w: annotTextW,
      fontSizePt: effAnnotationFontSize,
    },
  };
}
