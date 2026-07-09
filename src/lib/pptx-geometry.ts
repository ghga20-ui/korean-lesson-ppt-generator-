/**
 * Geometry helpers for PPTX generation.
 * Handles text position estimation, visual line counting, and
 * coordinate calculations for annotation shapes.
 *
 * 좌표 모델: 모든 세로 배치는 baseline(글자 잉크 바닥)에 앵커한다.
 * baseline은 실제 PowerPoint 렌더 42셀을 적합한 모델(pptx-constants.ts의
 * BASELINE_OFFSET_EM / BASELINE_LS_COEF)로 예측하며, fontSize와 lineSpacing
 * 전 구간에서 유효하다. 절대 인치 오프셋은 특정 크기에서만 맞으므로 금지.
 */

import type { PptSettings } from "./types";
import { type FontMetrics, getFontMetrics } from "./font-metrics";
import {
  TEXT_LEFT_MARGIN,
  TEXT_TOP_MARGIN,
  LINE_DRIFT_CORRECTION,
  BASELINE_OFFSET_EM,
  BASELINE_LS_COEF,
  CAP_HEIGHT_EM,
  UNDERLINE_GAP_EM,
  RECT_PAD_EM,
  RECT_PAD_X_EM,
  CIRCLE_PAD_EM,
  TRIANGLE_TOP_PAD_EM,
  TRIANGLE_BOTTOM_PAD_EM,
  TRIANGLE_PAD_X_EM,
} from "./pptx-constants";
import type { MarkerType } from "./types";

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface TextPosition {
  /** x position in inches from slide left edge */
  x: number;
  /** 시작줄 글자 잉크 top (inches) */
  y: number;
  /** width in inches */
  w: number;
  /** 시작줄 잉크 top → 끝줄 baseline (inches) */
  h: number;
  /** height of a single text line (inches) */
  lineH: number;
  /** 시작줄 글자 baseline = 잉크 바닥 (inches) */
  baseline: number;
  /** 대상이 시작하는 시각적 줄 번호 (soft-wrap 포함, 0-기준) */
  startLine: number;
  /** 대상이 끝나는 시각적 줄 번호 */
  endLine: number;
}

/** A single underline segment for one line of text. */
export interface UnderlineSegment {
  x: number;
  y: number;
  w: number;
}

// ---------------------------------------------------------------------------
// Character-level width estimation
// ---------------------------------------------------------------------------

/**
 * Estimate character width in inches based on character type and font size.
 * Korean Hangul syllables fill a full em square (~1.0 × fontSize).
 * Latin letters are proportional (~0.5-0.7 × fontSize).
 */
export function getCharWidthInch(char: string, fontSize: number, metrics?: FontMetrics): number {
  const ptToInch = fontSize / 72;
  const m = metrics || getFontMetrics("한컴산뜻돋움");
  if (/[가-힯一-鿿㐀-䶿＀-￯]/.test(char)) return ptToInch * m.hangul;
  if (/[ㄱ-ㆎ　-〿]/.test(char)) return ptToInch * m.hangul;
  if (/[A-Z]/.test(char)) return ptToInch * m.latinUpper;
  if (/[a-z]/.test(char)) return ptToInch * m.latinLower;
  if (/[0-9]/.test(char)) return ptToInch * m.digit;
  if (char === " ") return ptToInch * m.space;
  if (/[.,;:!?'"]/.test(char)) return ptToInch * m.punctuation;
  if (/[()[\]{}]/.test(char)) return ptToInch * m.bracket;
  if (/[、-〃「-』]/.test(char)) return ptToInch * m.fullwidth;
  return ptToInch * m.latinLower;
}

// ---------------------------------------------------------------------------
// Baseline model
// ---------------------------------------------------------------------------

/** 해당 줄 글자의 baseline(잉크 바닥) y 좌표 (inches). */
function baselineAtLine(line: number, settings: PptSettings, metrics: FontMetrics): number {
  const emInch = settings.fontSize / 72;
  const lineStepInch =
    (settings.fontSize * metrics.lineStepRatio * settings.lineSpacing) / 72;
  return (
    TEXT_TOP_MARGIN +
    line * lineStepInch -
    line * LINE_DRIFT_CORRECTION +
    (BASELINE_OFFSET_EM + BASELINE_LS_COEF * settings.lineSpacing) * emInch
  );
}

// ---------------------------------------------------------------------------
// Visual line counting
// ---------------------------------------------------------------------------

/**
 * Count the number of visual lines a text occupies, including soft-wraps.
 * Used by slide-splitter to accurately determine slide capacity.
 */
export function countVisualLines(
  text: string,
  fontSize: number,
  textAreaWidthInch: number,
  metrics?: FontMetrics,
): number {
  if (text.length === 0) return 0;

  let line = 1;
  let lineXAccum = 0;

  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\n") {
      line++;
      lineXAccum = 0;
      continue;
    }
    const charW = getCharWidthInch(text[i], fontSize, metrics);
    lineXAccum += charW;
    if (lineXAccum > textAreaWidthInch) {
      line++;
      lineXAccum = charW;
    }
  }

  return line;
}


// ---------------------------------------------------------------------------
// Text position estimation
// ---------------------------------------------------------------------------

/**
 * Estimate the bounding rectangle of a substring within the slide's main text.
 *
 * Walks through text character-by-character using per-character width estimation,
 * tracking newlines and soft-wrapping based on accumulated line width.
 *
 * 반환하는 y는 글자 잉크 top(= baseline − CAP_HEIGHT_EM·em),
 * h는 시작줄 잉크 top에서 끝줄 baseline까지다. 줄상자 top이 아니다.
 */
export function estimateTextPosition(
  slideText: string,
  startIndex: number,
  endIndex: number,
  settings: PptSettings,
): TextPosition {
  const metrics = getFontMetrics(settings.fontFamily);
  const emInch = settings.fontSize / 72;
  const lineHeightInch = (settings.fontSize * settings.lineSpacing) / 72;
  const textAreaWidth = settings.slideWidth - TEXT_LEFT_MARGIN * 2;

  let line = 0;
  let lineXAccum = 0;

  let startLine = 0;
  let startX = 0;
  let endLine = 0;
  let endX = 0;

  for (let i = 0; i <= slideText.length && i <= endIndex; i++) {
    if (i === startIndex) {
      startLine = line;
      startX = lineXAccum;
    }
    if (i === endIndex) {
      endLine = line;
      endX = lineXAccum;
    }

    if (i < slideText.length) {
      if (slideText[i] === "\n") {
        line++;
        lineXAccum = 0;
      } else {
        const charW = getCharWidthInch(slideText[i], settings.fontSize, metrics);
        lineXAccum += charW;
        if (lineXAccum > textAreaWidth) {
          line++;
          lineXAccum = charW;
        }
      }
    }
  }

  const startBaseline = baselineAtLine(startLine, settings, metrics);
  const endBaseline = baselineAtLine(endLine, settings, metrics);
  const glyphTop = startBaseline - CAP_HEIGHT_EM * emInch;

  let w: number;
  if (startLine === endLine) {
    w = Math.max(0.1, endX - startX);
  } else {
    // 다중행 대상의 enclosure는 시작줄 x에서 우측 끝까지로 근사한다(알려진 한계).
    w = Math.max(0.1, textAreaWidth - startX);
  }

  return {
    x: TEXT_LEFT_MARGIN + startX,
    y: glyphTop,
    w,
    h: endBaseline - glyphTop,
    lineH: lineHeightInch,
    baseline: startBaseline,
    startLine,
    endLine,
  };
}

/**
 * For underline annotations that span multiple lines, return one segment
 * per text line with the correct x, y, and width for each.
 *
 * y = 해당 줄 baseline + UNDERLINE_GAP_EM·em (stroke 중심).
 */
export function getUnderlineSegments(
  slideText: string,
  startIndex: number,
  endIndex: number,
  settings: PptSettings,
): UnderlineSegment[] {
  const metrics = getFontMetrics(settings.fontFamily);
  const emInch = settings.fontSize / 72;
  const textAreaWidth = settings.slideWidth - TEXT_LEFT_MARGIN * 2;

  let line = 0;
  let lineXAccum = 0;

  const lineMap = new Map<number, { left: number; right: number }>();

  for (let i = 0; i < slideText.length; i++) {
    if (slideText[i] === "\n") {
      line++;
      lineXAccum = 0;
      continue;
    }

    const charW = getCharWidthInch(slideText[i], settings.fontSize, metrics);
    const newAccum = lineXAccum + charW;

    let charLine = line;
    let charLeft: number;

    if (newAccum > textAreaWidth && lineXAccum > 0) {
      line++;
      charLine = line;
      charLeft = 0;
      lineXAccum = charW;
    } else {
      charLeft = lineXAccum;
      lineXAccum = newAccum;
    }

    if (i >= startIndex && i < endIndex) {
      const entry = lineMap.get(charLine);
      if (!entry) {
        lineMap.set(charLine, { left: charLeft, right: charLeft + charW });
      } else {
        entry.left = Math.min(entry.left, charLeft);
        entry.right = Math.max(entry.right, charLeft + charW);
      }
    }
  }

  const underlineY = (ln: number) =>
    baselineAtLine(ln, settings, metrics) + UNDERLINE_GAP_EM * emInch;

  const segments: UnderlineSegment[] = [];
  const sortedLines = [...lineMap.entries()].sort((a, b) => a[0] - b[0]);

  for (const [lineNum, bounds] of sortedLines) {
    segments.push({
      x: TEXT_LEFT_MARGIN + bounds.left,
      y: underlineY(lineNum),
      w: Math.max(0.1, bounds.right - bounds.left),
    });
  }

  if (segments.length === 0) {
    segments.push({
      x: TEXT_LEFT_MARGIN,
      y: underlineY(0),
      w: 0.5,
    });
  }

  return segments;
}

// ---------------------------------------------------------------------------
// Shape geometry
// ---------------------------------------------------------------------------

/**
 * Return shape position and dimensions appropriate for the marker type.
 *
 * pos.y는 글자 잉크 top, pos.y + pos.h는 끝줄 baseline(잉크 바닥)이므로,
 * 감싸기 도형은 글자 상자에 em 비율 패딩만 더하면 된다.
 */
export function getShapeGeometry(
  markerType: MarkerType,
  pos: TextPosition,
  fontSize: number = 36,
): { x: number; y: number; w: number; h: number } {
  const em = fontSize / 72;
  const boxTop = pos.y;
  const boxBottom = pos.y + pos.h;
  switch (markerType) {
    case "underline":
      // 실사용 경로는 getUnderlineSegments. 안전한 폴백만 유지.
      return {
        x: pos.x,
        y: boxBottom + UNDERLINE_GAP_EM * em,
        w: pos.w,
        h: 0,
      };
    case "circle":
      return {
        x: pos.x - CIRCLE_PAD_EM * em,
        y: boxTop - CIRCLE_PAD_EM * em,
        w: pos.w + 2 * CIRCLE_PAD_EM * em,
        h: boxBottom - boxTop + 2 * CIRCLE_PAD_EM * em,
      };
    case "rectangle":
      return {
        x: pos.x - RECT_PAD_X_EM * em,
        y: boxTop - RECT_PAD_EM * em,
        w: pos.w + 2 * RECT_PAD_X_EM * em,
        h: boxBottom - boxTop + 2 * RECT_PAD_EM * em,
      };
    case "triangle":
      return {
        x: pos.x - TRIANGLE_PAD_X_EM * em,
        y: boxTop - TRIANGLE_TOP_PAD_EM * em,
        w: pos.w + 2 * TRIANGLE_PAD_X_EM * em,
        h: boxBottom - boxTop + (TRIANGLE_TOP_PAD_EM + TRIANGLE_BOTTOM_PAD_EM) * em,
      };
    case "bracket":
    case "summary":
      return {
        x: pos.x,
        y: pos.y,
        w: pos.w,
        h: pos.h,
      };
  }
}
