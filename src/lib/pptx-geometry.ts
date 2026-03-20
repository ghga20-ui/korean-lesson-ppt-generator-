/**
 * Geometry helpers for PPTX generation.
 * Handles text position estimation, visual line counting, and
 * coordinate calculations for annotation shapes.
 */

import type { PptSettings, Annotation } from "./types";
import { type FontMetrics, getFontMetrics } from "./font-metrics";
import {
  TEXT_LEFT_MARGIN,
  TEXT_TOP_MARGIN,
  PPT_LINE_STEP_RATIO,
  SHAPE_Y_OFFSET,
  LINE_DRIFT_CORRECTION,
  UNDERLINE_Y_BASE_OFFSET,
  SHAPE_PADDING,
  GLYPH_Y_OFFSET_CIRCLE,
  GLYPH_Y_OFFSET_RECTANGLE,
  GLYPH_Y_OFFSET_TRIANGLE,
} from "./pptx-constants";
import type { MarkerType } from "./types";

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface TextPosition {
  /** x position in inches from slide left edge */
  x: number;
  /** y position in inches from slide top edge (top of the first line) */
  y: number;
  /** width in inches */
  w: number;
  /** total height spanning all lines of the target text (inches) */
  h: number;
  /** height of a single text line (inches) */
  lineH: number;
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
  if (/[\uAC00-\uD7AF\u4E00-\u9FFF\u3400-\u4DBF\uFF00-\uFFEF]/.test(char)) return ptToInch * m.hangul;
  if (/[\u3131-\u318E\u3000-\u303F]/.test(char)) return ptToInch * m.hangul;
  if (/[A-Z]/.test(char)) return ptToInch * m.latinUpper;
  if (/[a-z]/.test(char)) return ptToInch * m.latinLower;
  if (/[0-9]/.test(char)) return ptToInch * m.digit;
  if (char === " ") return ptToInch * m.space;
  if (/[.,;:!?'"]/.test(char)) return ptToInch * m.punctuation;
  if (/[()[\]{}]/.test(char)) return ptToInch * m.bracket;
  if (/[\u3001-\u3003\u300C-\u300F]/.test(char)) return ptToInch * m.fullwidth;
  return ptToInch * m.latinLower;
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
    const charW = getCharWidthInch(text[i], fontSize);
    lineXAccum += charW;
    if (lineXAccum > textAreaWidthInch) {
      line++;
      lineXAccum = charW;
    }
  }

  return line;
}

/**
 * Determine which visual line (0-based) a character index falls on.
 * Uses the same soft-wrap logic as estimateTextPosition().
 */
export function getVisualLineForIndex(
  text: string,
  charIndex: number,
  fontSize: number,
  textAreaWidthInch: number,
): number {
  let line = 0;
  let lineXAccum = 0;

  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\n") {
      if (i === charIndex) return line;
      line++;
      lineXAccum = 0;
      continue;
    }
    const charW = getCharWidthInch(text[i], fontSize);
    lineXAccum += charW;
    if (lineXAccum > textAreaWidthInch && lineXAccum > charW) {
      line++;
      lineXAccum = charW;
    }
    if (i === charIndex) return line;
  }

  return line;
}

// ---------------------------------------------------------------------------
// Annotation pre-processing
// ---------------------------------------------------------------------------

/**
 * Pre-process slide text to prevent annotations from being split across
 * visual lines. If an annotation would span multiple lines, inserts a \n
 * before the annotation to push it to the next line.
 *
 * Must run BEFORE buildSlide() so both position calculations and
 * PowerPoint's rendering see the same text.
 */
export function preprocessAnnotations(
  text: string,
  annotations: Annotation[],
  fontSize: number,
  textAreaWidthInch: number,
  metrics?: FontMetrics,
): { text: string; annotations: Annotation[] } {
  if (annotations.length === 0) return { text, annotations };

  let currentText = text;
  let currentAnnotations = annotations.map((a) => ({ ...a }));
  const MAX_ITERATIONS = 10;

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    const sorted = [...currentAnnotations].sort(
      (a, b) => a.startIndex - b.startIndex,
    );
    let needsInsertion: Annotation | null = null;

    for (const ann of sorted) {
      if (ann.startIndex >= currentText.length || ann.endIndex > currentText.length) continue;

      const startLine = getVisualLineForIndex(
        currentText, ann.startIndex, fontSize, textAreaWidthInch,
      );
      const endLine = getVisualLineForIndex(
        currentText, ann.endIndex - 1, fontSize, textAreaWidthInch,
      );

      if (startLine !== endLine) {
        // Check if annotation text can physically fit on one line
        let annWidth = 0;
        for (let i = ann.startIndex; i < ann.endIndex; i++) {
          annWidth += getCharWidthInch(currentText[i], fontSize);
        }
        if (annWidth <= textAreaWidthInch) {
          needsInsertion = ann;
          break;
        }
      }
    }

    if (!needsInsertion) break;

    const insertAt = needsInsertion.startIndex;
    currentText =
      currentText.slice(0, insertAt) + "\n" + currentText.slice(insertAt);

    currentAnnotations = currentAnnotations.map((a) => ({
      ...a,
      startIndex: a.startIndex >= insertAt ? a.startIndex + 1 : a.startIndex,
      endIndex: a.endIndex > insertAt ? a.endIndex + 1 : a.endIndex,
    }));
  }

  return { text: currentText, annotations: currentAnnotations };
}

// ---------------------------------------------------------------------------
// Text position estimation
// ---------------------------------------------------------------------------

/**
 * Estimate the bounding rectangle of a substring within the slide's main text.
 *
 * Walks through text character-by-character using per-character width estimation,
 * tracking newlines and soft-wrapping based on accumulated line width.
 */
export function estimateTextPosition(
  slideText: string,
  startIndex: number,
  endIndex: number,
  settings: PptSettings,
): TextPosition {
  const lineStepInch =
    (settings.fontSize * PPT_LINE_STEP_RATIO * settings.lineSpacing) / 72;
  const lineHeightInch = (settings.fontSize * settings.lineSpacing) / 72;
  const textAreaWidth = (settings.slideWidth - TEXT_LEFT_MARGIN * 2) * 1.0;

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
        const charW = getCharWidthInch(slideText[i], settings.fontSize);
        lineXAccum += charW;
        if (lineXAccum > textAreaWidth) {
          line++;
          lineXAccum = charW;
        }
      }
    }
  }

  const x = TEXT_LEFT_MARGIN + startX;
  const y = TEXT_TOP_MARGIN + startLine * lineStepInch - startLine * LINE_DRIFT_CORRECTION;

  let w: number;
  if (startLine === endLine) {
    w = Math.max(0.1, endX - startX);
  } else {
    w = Math.max(0.1, textAreaWidth - startX);
  }

  const spanLines = endLine - startLine + 1;
  const charHeightInch = settings.fontSize / 72;
  const h = charHeightInch * spanLines;

  return { x, y, w, h, lineH: lineHeightInch };
}

/**
 * For underline annotations that span multiple lines, return one segment
 * per text line with the correct x, y, and width for each.
 */
export function getUnderlineSegments(
  slideText: string,
  startIndex: number,
  endIndex: number,
  settings: PptSettings,
): UnderlineSegment[] {
  const lineStepInch =
    (settings.fontSize * PPT_LINE_STEP_RATIO * settings.lineSpacing) / 72;
  const charHeightInch = settings.fontSize / 72;
  const textAreaWidth = (settings.slideWidth - TEXT_LEFT_MARGIN * 2) * 1.0;

  let line = 0;
  let lineXAccum = 0;

  const lineMap = new Map<number, { left: number; right: number }>();

  for (let i = 0; i < slideText.length; i++) {
    if (slideText[i] === "\n") {
      line++;
      lineXAccum = 0;
      continue;
    }

    const charW = getCharWidthInch(slideText[i], settings.fontSize);
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

  const segments: UnderlineSegment[] = [];
  const sortedLines = [...lineMap.entries()].sort((a, b) => a[0] - b[0]);

  for (const [lineNum, bounds] of sortedLines) {
    segments.push({
      x: TEXT_LEFT_MARGIN + bounds.left,
      y: TEXT_TOP_MARGIN + lineNum * lineStepInch + charHeightInch + SHAPE_Y_OFFSET + UNDERLINE_Y_BASE_OFFSET - lineNum * LINE_DRIFT_CORRECTION,
      w: Math.max(0.1, bounds.right - bounds.left),
    });
  }

  if (segments.length === 0) {
    segments.push({
      x: TEXT_LEFT_MARGIN,
      y: TEXT_TOP_MARGIN + charHeightInch + SHAPE_Y_OFFSET + UNDERLINE_Y_BASE_OFFSET,
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
 */
export function getShapeGeometry(
  markerType: MarkerType,
  pos: TextPosition,
  fontSize: number = 36,
): { x: number; y: number; w: number; h: number } {
  const s = fontSize / 36;
  switch (markerType) {
    case "underline":
      return {
        x: pos.x,
        y: pos.y + pos.h + SHAPE_Y_OFFSET,
        w: pos.w,
        h: 0,
      };
    case "circle":
      return {
        x: pos.x - SHAPE_PADDING - 0.01,
        y: pos.y - SHAPE_PADDING + SHAPE_Y_OFFSET + GLYPH_Y_OFFSET_CIRCLE * s,
        w: pos.w + SHAPE_PADDING * 2,
        h: pos.h + SHAPE_PADDING * 2,
      };
    case "rectangle":
      return {
        x: pos.x - SHAPE_PADDING / 4 - 0.01,
        y: pos.y - 0.01 + SHAPE_Y_OFFSET + GLYPH_Y_OFFSET_RECTANGLE * s,
        w: pos.w + SHAPE_PADDING / 2,
        h: pos.h + 0.02,
      };
    case "triangle":
      return {
        x: pos.x - SHAPE_PADDING,
        y: pos.y - SHAPE_PADDING + SHAPE_Y_OFFSET + GLYPH_Y_OFFSET_TRIANGLE * s,
        w: pos.w + SHAPE_PADDING * 2,
        h: pos.h + SHAPE_PADDING * 2,
      };
    case "bracket":
      return {
        x: pos.x,
        y: pos.y,
        w: pos.w,
        h: pos.h,
      };
    case "summary":
      return {
        x: pos.x,
        y: pos.y,
        w: pos.w,
        h: pos.h,
      };
  }
}
