import PptxGenJS from "pptxgenjs";
import JSZip from "jszip";
import {
  type Annotation,
  type Genre,
  type SlideData,
  type PptSettings,
  type MarkerType,
  DEFAULT_POETRY_SETTINGS,
  DEFAULT_NOVEL_SETTINGS,
} from "./types";
import { type FontMetrics, getFontMetrics } from "./font-metrics";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Left margin for the main text area (inches). */
const TEXT_LEFT_MARGIN = 0.5;

/** Top margin for the main text area (inches). */
const TEXT_TOP_MARGIN = 0.5;

/** Proportion of slide height reserved for the main text area. */
const TEXT_AREA_HEIGHT_RATIO = 0.65;

/** Marker color for annotation shapes (dark blue). */
const MARKER_COLOR = "294C67";

/** Line width for underline shapes (pt). */
const UNDERLINE_LINE_WIDTH = 3;

/** Line width for circle / rectangle / triangle / bracket shapes (pt). */
const SHAPE_LINE_WIDTH = 3;

/** Color for summary annotation box background. */
const SUMMARY_BG_COLOR = "E8EFF5";

/** Color for summary annotation box border. */
const SUMMARY_BORDER_COLOR = "294C67";

/** Font size for bracket symbols 「」 (pt). */
const BRACKET_SYMBOL_FONT_SIZE = 36;

/** Padding around circle / rectangle shapes (inches). */
const SHAPE_PADDING = 0.08;

/** Main text colour (near black). */
const MAIN_TEXT_COLOR = "222222";

/** Slide background colour (white). */
const SLIDE_BG_COLOR = "FFFFFF";

/** Vertical gap between marker shape bottom and annotation text (inches). */
const ANNOTATION_Y_GAP = -0.03;

/**
 * Vertical offset applied to all marker shapes so they align with the
 * actual glyph body instead of the top of the text line box.
 * PowerPoint text rendering places glyphs below pos.y due to internal leading.
 */
const SHAPE_Y_OFFSET = 0.04;

/** Height of an annotation text box (inches). */
const ANNOTATION_TEXT_HEIGHT = 0.6;

/** Font family for all text. */
const FONT_FAMILY = "한컴산뜻돋움";

/** Font size for annotation text (pt). */
const ANNOTATION_FONT_SIZE = 28;

/**
 * Font line-height ratio: (usWinAscent + usWinDescent) / unitsPerEm.
 * Read from 한컴산뜻돋움 Bold font file: (1000 + 300) / 1000 = 1.3.
 * Kept as reference; actual positioning uses PPT_LINE_STEP_RATIO below.
 */
const FONT_LINE_HEIGHT_RATIO = 1.3;

/**
 * Empirically calibrated line-step ratio for PowerPoint rendering.
 * PowerPoint's actual line-to-line distance is slightly smaller than
 * FONT_LINE_HEIGHT_RATIO predicts, causing cumulative Y drift on later lines.
 * Tuned to eliminate per-line drift across 4+ lines of text.
 */
const PPT_LINE_STEP_RATIO = 1.22;

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

interface TextPosition {
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
interface UnderlineSegment {
  x: number;
  y: number;
  w: number;
}

/** Animation group: marker shape IDs + annotation text ID for one annotation. */
interface AnimationGroup {
  markerIds: number[];
  textId: number;
}

/**
 * Estimate character width in inches based on character type and font size.
 * Korean Hangul syllables fill a full em square (~1.0 × fontSize).
 * Latin letters are proportional (~0.5-0.7 × fontSize).
 */
export function getCharWidthInch(char: string, fontSize: number, metrics?: FontMetrics): number {
  const ptToInch = fontSize / 72;
  // Korean Hangul syllables (AC00-D7AF), CJK ideographs, fullwidth forms
  // 한컴산뜻돋움 Bold: advance width = 932/1000 em
  if (/[\uAC00-\uD7AF\u4E00-\u9FFF\u3400-\u4DBF\uFF00-\uFFEF]/.test(char)) {
    return ptToInch * 0.932;
  }
  // Korean Jamo (ㄱ-ㅎ, ㅏ-ㅣ) and CJK symbols
  if (/[\u3131-\u318E\u3000-\u303F]/.test(char)) {
    return ptToInch * 0.932;
  }
  // Uppercase Latin
  if (/[A-Z]/.test(char)) return ptToInch * 0.7;
  // Lowercase Latin
  if (/[a-z]/.test(char)) return ptToInch * 0.5;
  // Digits
  if (/[0-9]/.test(char)) return ptToInch * 0.6;
  // Space — 한컴산뜻돋움 Bold: advance width = 264/1000 em
  if (char === " ") return ptToInch * 0.264;
  // Common punctuation (narrow) — 한컴산뜻돋움 Bold: ~297/1000 em
  if (/[.,;:!?'"]/.test(char)) return ptToInch * 0.297;
  // Brackets and parentheses
  if (/[()[\]{}]/.test(char)) return ptToInch * 0.35;
  // Korean punctuation (。、「」 etc.) — fullwidth
  if (/[\u3001-\u3003\u300C-\u300F]/.test(char)) return ptToInch * 0.932;
  // Default
  return ptToInch * 0.5;
}

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
function getVisualLineForIndex(
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

/**
 * Pre-process slide text to prevent annotations from being split across
 * visual lines. If an annotation would span multiple lines, inserts a \n
 * before the annotation to push it to the next line.
 *
 * Must run BEFORE buildSlide() so both position calculations and
 * PowerPoint's rendering see the same text.
 */
function preprocessAnnotations(
  text: string,
  annotations: Annotation[],
  fontSize: number,
  textAreaWidthInch: number,
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

/**
 * Estimate the bounding rectangle of a substring within the slide's main text.
 *
 * Walks through text character-by-character using per-character width estimation,
 * tracking newlines and soft-wrapping based on accumulated line width.
 */
function estimateTextPosition(
  slideText: string,
  startIndex: number,
  endIndex: number,
  settings: PptSettings,
): TextPosition {
  const lineStepInch =
    (settings.fontSize * PPT_LINE_STEP_RATIO * settings.lineSpacing) / 72;
  const lineHeightInch = (settings.fontSize * settings.lineSpacing) / 72;
  // 3% narrower than actual text box to account for PPT kinsoku (line-break rules)
  const textAreaWidth = (settings.slideWidth - TEXT_LEFT_MARGIN * 2) * 1.0;

  let line = 0;
  let lineXAccum = 0; // accumulated width in current line (inches)

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
        // Soft-wrap: if accumulated width exceeds text area, move to next line
        if (lineXAccum > textAreaWidth) {
          line++;
          lineXAccum = charW; // current char starts the new line
        }
      }
    }
  }

  const x = TEXT_LEFT_MARGIN + startX;
  const y = TEXT_TOP_MARGIN + startLine * lineStepInch - startLine * 0.015;

  // Width: from startX to endX (same line), or to end-of-line if multi-line
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
function getUnderlineSegments(
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

  // Per-line bounds within the target range [startIndex, endIndex)
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
      // Soft-wrap: this char starts a new line
      line++;
      charLine = line;
      charLeft = 0;
      lineXAccum = charW;
    } else {
      charLeft = lineXAccum;
      lineXAccum = newAccum;
    }

    // Record if this char is in the target range
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

  // Convert to segments sorted by line number
  const segments: UnderlineSegment[] = [];
  const sortedLines = [...lineMap.entries()].sort((a, b) => a[0] - b[0]);

  for (const [lineNum, bounds] of sortedLines) {
    segments.push({
      x: TEXT_LEFT_MARGIN + bounds.left,
      y: TEXT_TOP_MARGIN + lineNum * lineStepInch + charHeightInch + SHAPE_Y_OFFSET + 0.31 - lineNum * 0.015,
      w: Math.max(0.1, bounds.right - bounds.left),
    });
  }

  // Fallback (should not happen)
  if (segments.length === 0) {
    segments.push({
      x: TEXT_LEFT_MARGIN,
      y: TEXT_TOP_MARGIN + charHeightInch + SHAPE_Y_OFFSET + 0.31,
      w: 0.5,
    });
  }

  return segments;
}

// ---------------------------------------------------------------------------
// Shape helpers
// ---------------------------------------------------------------------------

/**
 * Map our MarkerType enum to the corresponding pptxgenjs ShapeType value.
 */
function getShapeType(
  markerType: MarkerType,
  pptx: PptxGenJS,
): PptxGenJS.SHAPE_NAME {
  switch (markerType) {
    case "underline":
      return pptx.ShapeType.line;
    case "circle":
      return pptx.ShapeType.ellipse;
    case "rectangle":
    case "summary":
      return pptx.ShapeType.rect;
    case "triangle":
      return pptx.ShapeType.triangle;
    case "bracket":
      return pptx.ShapeType.rect; // placeholder; bracket uses custom line shapes
  }
}

/**
 * Return shape position and dimensions appropriate for the marker type.
 */
function getShapeGeometry(
  markerType: MarkerType,
  pos: TextPosition,
  fontSize: number = 36,
): { x: number; y: number; w: number; h: number } {
  // Scale Y offsets proportionally to font size (calibrated at 36pt)
  const s = fontSize / 36;
  switch (markerType) {
    case "underline":
      // A line drawn under the text (h=0 for a horizontal line in pptxgenjs)
      return {
        x: pos.x,
        y: pos.y + pos.h + SHAPE_Y_OFFSET,
        w: pos.w,
        h: 0,
      };
    case "circle":
      return {
        x: pos.x - SHAPE_PADDING - 0.01,
        y: pos.y - SHAPE_PADDING + SHAPE_Y_OFFSET + 0.34 * s,
        w: pos.w + SHAPE_PADDING * 2,
        h: pos.h + SHAPE_PADDING * 2,
      };
    case "rectangle":
      return {
        x: pos.x - SHAPE_PADDING / 4 - 0.01,
        y: pos.y - 0.01 + SHAPE_Y_OFFSET + 0.34 * s,
        w: pos.w + SHAPE_PADDING / 2,
        h: pos.h + 0.02,
      };
    case "triangle":
      return {
        x: pos.x - SHAPE_PADDING,
        y: pos.y - SHAPE_PADDING + SHAPE_Y_OFFSET + 0.22 * s,
        w: pos.w + SHAPE_PADDING * 2,
        h: pos.h + SHAPE_PADDING * 2,
      };
    case "bracket":
      // Bracket: positions used for 「 at start (above) and 」 at end (below)
      return {
        x: pos.x,
        y: pos.y,
        w: pos.w,
        h: pos.h,
      };
    case "summary":
      // Summary box at the bottom of the slide — doesn't target specific text
      return {
        x: pos.x,
        y: pos.y,
        w: pos.w,
        h: pos.h,
      };
  }
}

/**
 * Return the marker color for annotation shapes.
 */
function getAnnotationColor(_index: number): string {
  return MARKER_COLOR;
}

// ---------------------------------------------------------------------------
// Slide builder
// ---------------------------------------------------------------------------

/**
 * Add all elements for a single slide: main text, marker shapes, and
 * annotation text boxes.
 *
 * Returns an array where each element is the total number of shapes
 * (marker shapes + 1 text box) added for that annotation. Multi-line
 * underlines produce multiple marker shapes per annotation.
 */
function buildSlide(
  pptx: PptxGenJS,
  slideData: SlideData,
  genre: Genre,
  settings: PptSettings,
): number[] {
  const slide = pptx.addSlide();
  slide.background = { color: SLIDE_BG_COLOR };

  const textAreaWidth = settings.slideWidth - TEXT_LEFT_MARGIN * 2;
  const textAreaHeight = settings.slideHeight * settings.textAreaHeightRatio;

  // ---- Main text ----
  if (slideData.text) {
    slide.addText(slideData.text, {
      x: TEXT_LEFT_MARGIN,
      y: TEXT_TOP_MARGIN,
      w: textAreaWidth,
      h: textAreaHeight,
      fontSize: settings.fontSize,
      fontFace: FONT_FAMILY,
      bold: true,
      color: MAIN_TEXT_COLOR,
      align: "left",
      valign: "top",
      lineSpacingMultiple: settings.lineSpacing,
      wrap: true,
      isTextBox: true,
      margin: 0, // eliminate default insets (top 0.05", left 0.1") so shape coordinates match exactly
    });
  }

  // Sort annotations by their declared animation order.
  const sortedAnnotations: Annotation[] = [...slideData.annotations].sort(
    (a, b) => a.order - b.order,
  );

  if (sortedAnnotations.length === 0) {
    return [];
  }

  const shapeCountsPerAnnotation: number[] = [];

  for (let idx = 0; idx < sortedAnnotations.length; idx++) {
    const annotation = sortedAnnotations[idx];
    const color = getAnnotationColor(idx);

    const pos = estimateTextPosition(
      slideData.text,
      annotation.startIndex,
      annotation.endIndex,
      settings,
    );

    let markerShapeCount = 0;
    let shapeBottomY: number;
    let shapeLeftX: number;
    let shapeWidth: number;

    // ---- Marker shape(s) ----
    if (annotation.markerType === "underline") {
      // Multi-line aware: one line shape per text line
      const segments = getUnderlineSegments(
        slideData.text,
        annotation.startIndex,
        annotation.endIndex,
        settings,
      );

      for (const seg of segments) {
        slide.addShape(pptx.ShapeType.line, {
          x: seg.x,
          y: seg.y,
          w: seg.w,
          h: 0,
          line: { color, width: UNDERLINE_LINE_WIDTH },
        });
        markerShapeCount++;
      }

      const lastSeg = segments[segments.length - 1];
      shapeBottomY = lastSeg.y; // line shape has h=0
      shapeLeftX = segments[0].x;
      shapeWidth = segments[0].w;
    } else if (annotation.markerType === "bracket") {
      // Bracket: small 「 above start position, small 」 below end position
      const startPos = estimateTextPosition(
        slideData.text, annotation.startIndex, annotation.startIndex + 1, settings,
      );
      const endPos = estimateTextPosition(
        slideData.text, annotation.endIndex - 1, annotation.endIndex, settings,
      );
      const symbolSize = BRACKET_SYMBOL_FONT_SIZE / 72;

      const brs = settings.fontSize / 36; // bracket scale factor

      // 「 above-left of the start position
      slide.addText("「", {
        x: startPos.x - 0.22,
        y: startPos.y + SHAPE_Y_OFFSET + 0.28 * brs,
        w: symbolSize,
        h: symbolSize,
        fontSize: BRACKET_SYMBOL_FONT_SIZE,
        fontFace: settings.fontFamily,
        bold: true,
        color,
        align: "center",
        valign: "bottom",
        isTextBox: true,
        margin: 0,
      });

      // 」 below-right of the end position
      slide.addText("」", {
        x: endPos.x + endPos.w - 0.30,
        y: endPos.y + endPos.h + SHAPE_Y_OFFSET - 0.24 * brs,
        w: symbolSize,
        h: symbolSize,
        fontSize: BRACKET_SYMBOL_FONT_SIZE,
        fontFace: FONT_FAMILY,
        bold: true,
        color,
        align: "center",
        valign: "top",
        isTextBox: true,
        margin: 0,
      });

      markerShapeCount = 2; // 「 + 」
      shapeBottomY = endPos.y + endPos.h + SHAPE_Y_OFFSET + 0.02 + symbolSize * 0.65;
      shapeLeftX = startPos.x;
      shapeWidth = pos.w;
    } else if (annotation.markerType === "summary") {
      // Summary ▶: colored box at the bottom of the slide (no text-specific marker)
      const summaryBoxH = 0.55;
      const summaryBoxW = textAreaWidth;
      const summaryBoxX = TEXT_LEFT_MARGIN;
      const summaryBoxY = settings.slideHeight - summaryBoxH - 0.2;

      slide.addShape(pptx.ShapeType.roundRect, {
        x: summaryBoxX,
        y: summaryBoxY,
        w: summaryBoxW,
        h: summaryBoxH,
        fill: { color: SUMMARY_BG_COLOR },
        line: { color: SUMMARY_BORDER_COLOR, width: 1.5 },
        rectRadius: 0.08,
      });
      markerShapeCount = 1;
      // For summary, text goes inside the box
      shapeBottomY = summaryBoxY;
      shapeLeftX = summaryBoxX;
      shapeWidth = summaryBoxW;
    } else {
      const geom = getShapeGeometry(annotation.markerType, pos, settings.fontSize);
      const shapeType = getShapeType(annotation.markerType, pptx);
      slide.addShape(shapeType, {
        x: geom.x,
        y: geom.y,
        w: geom.w,
        h: geom.h,
        fill: { type: "none" },
        line: { color, width: SHAPE_LINE_WIDTH },
      });
      markerShapeCount = 1;
      shapeBottomY = geom.y + geom.h;
      shapeLeftX = geom.x;
      shapeWidth = geom.w;
    }

    // ---- Annotation text box ----
    if (annotation.markerType === "summary") {
      // Summary: text goes inside the summary box
      const summaryBoxH = 0.55;
      const summaryBoxY = settings.slideHeight - summaryBoxH - 0.2;
      slide.addText("▶ " + annotation.content, {
        x: TEXT_LEFT_MARGIN + 0.15,
        y: summaryBoxY + 0.05,
        w: textAreaWidth - 0.3,
        h: summaryBoxH - 0.1,
        fontSize: settings.annotationFontSize,
        fontFace: FONT_FAMILY,
        bold: true,
        color: SUMMARY_BORDER_COLOR,
        align: "left",
        valign: "middle",
        wrap: true,
        isTextBox: true,
      });
      shapeCountsPerAnnotation.push(markerShapeCount + 1);
      continue;
    }

    // Position annotation text consistently based on the TEXT LINE position,
    // not the shape bottom, so all marker types produce the same text Y.
    const lineStepInch =
      (settings.fontSize * PPT_LINE_STEP_RATIO * settings.lineSpacing) / 72;
    const lineHeightInch = (settings.fontSize * settings.lineSpacing) / 72;
    const charHeightInch = settings.fontSize / 72;
    const totalLines = slideData.text.split("\n").length;

    // Determine which line the annotation sits on
    let annotLine: number;
    if (annotation.markerType === "underline") {
      annotLine = Math.round(
        (shapeBottomY - lineHeightInch - TEXT_TOP_MARGIN) / lineStepInch,
      );
    } else {
      annotLine = Math.round((pos.y - TEXT_TOP_MARGIN) / lineStepInch);
    }
    const spanLines = Math.max(1, Math.round((pos.h) / charHeightInch));
    const isMultiLine = spanLines > 1;
    const isLastLine = annotLine >= totalLines - 1;

    // Consistent glyph bottom reference (independent of shape padding)
    const glyphBottomY =
      TEXT_TOP_MARGIN + annotLine * lineStepInch + charHeightInch + SHAPE_Y_OFFSET;

    let annotTextY: number;
    if (isLastLine) {
      annotTextY = Math.max(shapeBottomY, glyphBottomY) + ANNOTATION_Y_GAP;
    } else {
      const nextLineY = TEXT_TOP_MARGIN + (annotLine + 1) * lineStepInch
        - (annotLine + 1) * 0.015;
      const visibleTextH = settings.annotationFontSize / 72;
      const anchorY = isMultiLine ? glyphBottomY + 0.27 : Math.max(shapeBottomY, glyphBottomY);
      // Position closer to marker (3% from anchor toward next line)
      const gapBias = anchorY + (nextLineY - anchorY) * 0.03;
      annotTextY = Math.max(
        anchorY + ANNOTATION_Y_GAP,
        gapBias - visibleTextH / 2,
      );
    }

    // Start annotation text below target, but ensure minimum width
    const MIN_ANNOT_WIDTH = 6.0;
    let annotTextX = Math.max(TEXT_LEFT_MARGIN, shapeLeftX);
    let annotTextW = settings.slideWidth - annotTextX - 0.3;
    if (annotTextW < MIN_ANNOT_WIDTH) {
      annotTextX = Math.max(TEXT_LEFT_MARGIN, settings.slideWidth - MIN_ANNOT_WIDTH - 0.3);
      annotTextW = settings.slideWidth - annotTextX - 0.3;
    }

    // Clamp so it doesn't overflow below the slide
    const clampedY = Math.min(
      annotTextY,
      settings.slideHeight - ANNOTATION_TEXT_HEIGHT - 0.1,
    );

    slide.addText(annotation.content, {
      x: annotTextX,
      y: clampedY,
      w: annotTextW,
      h: ANNOTATION_TEXT_HEIGHT,
      fontSize: settings.annotationFontSize,
      fontFace: FONT_FAMILY,
      bold: true,
      color,
      align: "left",
      valign: "top",
      wrap: true,
      isTextBox: true,
    });

    shapeCountsPerAnnotation.push(markerShapeCount + 1); // +1 for text box
  }

  return shapeCountsPerAnnotation;
}

// ---------------------------------------------------------------------------
// Animation XML injection
// ---------------------------------------------------------------------------

/**
 * Extract actual shape IDs from generated slide XML.
 *
 * pptxgenjs adds shapes in the order we call addText/addShape. The XML
 * contains <p:cNvPr id="N" .../> for each shape. We parse these to get
 * the real IDs, skipping the first two (group shape + main text).
 *
 * @param shapeCountsPerAnnotation - Array where each element is the total
 *   number of shapes (marker shape(s) + 1 text box) for that annotation.
 *   Multi-line underlines have >2 shapes per annotation.
 */
function extractShapeIds(
  slideXml: string,
  shapeCountsPerAnnotation: number[],
): AnimationGroup[] {
  const matches = [...slideXml.matchAll(/<p:cNvPr\s+id="(\d+)"/g)];
  const allIds = matches.map((m) => parseInt(m[1], 10));

  // allIds layout:
  //   [0] = nvGrpSpPr group shape (id usually 1)
  //   [1] = main text box
  //   Then for each annotation: N marker shapes + 1 text box

  const groups: AnimationGroup[] = [];
  let idx = 2; // skip nvGrpSpPr and main text

  for (const totalCount of shapeCountsPerAnnotation) {
    const markerCount = totalCount - 1; // last shape is the text box
    const markerIds: number[] = [];

    for (let j = 0; j < markerCount; j++) {
      if (idx < allIds.length) {
        markerIds.push(allIds[idx++]);
      }
    }

    const textId = idx < allIds.length ? allIds[idx++] : 0;
    groups.push({ markerIds, textId });
  }

  return groups;
}

/**
 * Build the OOXML `<p:timing>` element with correct structure that
 * PowerPoint actually recognises.
 *
 * Structure matches real PowerPoint output (verified from 백석_수라.pptx):
 * - Single <p:seq nodeType="mainSeq"> (NOT multiple <p:seq>)
 * - Click groups use <p:cond delay="indefinite"/> (NOT delay="0")
 * - Includes <p:bldLst> section listing all animated shapes
 *
 * Each annotation click group shows all marker shapes + text together.
 * Multi-line underlines have multiple marker shapes in the same click group.
 */
function buildTimingXml(groups: AnimationGroup[]): string {
  if (groups.length === 0) return "";

  let ctnId = 0;

  /** Helper: build a single "appear" <p:par> node for one shape. */
  function appearNode(spid: number, nodeType: string): string {
    return (
      `<p:par>` +
      `<p:cTn id="${++ctnId}" fill="hold">` +
      `<p:stCondLst><p:cond delay="0"/></p:stCondLst>` +
      `<p:childTnLst>` +
      `<p:par>` +
      `<p:cTn id="${++ctnId}" presetID="1" presetClass="entr" presetSubtype="0" fill="hold" grpId="0" nodeType="${nodeType}">` +
      `<p:stCondLst><p:cond delay="0"/></p:stCondLst>` +
      `<p:childTnLst>` +
      `<p:set>` +
      `<p:cBhvr>` +
      `<p:cTn id="${++ctnId}" dur="1" fill="hold">` +
      `<p:stCondLst><p:cond delay="0"/></p:stCondLst>` +
      `</p:cTn>` +
      `<p:tgtEl><p:spTgt spid="${spid}"/></p:tgtEl>` +
      `<p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst>` +
      `</p:cBhvr>` +
      `<p:to><p:strVal val="visible"/></p:to>` +
      `</p:set>` +
      `</p:childTnLst>` +
      `</p:cTn>` +
      `</p:par>` +
      `</p:childTnLst>` +
      `</p:cTn>` +
      `</p:par>`
    );
  }

  // Build click group <p:par> nodes inside the mainSeq.
  // Each annotation produces TWO click groups:
  //   Click 1: marker shape(s) appear
  //   Click 2: annotation text appears
  const clickGroups: string[] = [];

  for (const group of groups) {
    // --- Click group 1: marker shapes ---
    const markerNodes: string[] = [];
    for (let j = 0; j < group.markerIds.length; j++) {
      markerNodes.push(
        appearNode(group.markerIds[j], j === 0 ? "clickEffect" : "withEffect"),
      );
    }

    clickGroups.push(
      `<p:par>` +
      `<p:cTn id="${++ctnId}" fill="hold">` +
      `<p:stCondLst>` +
      `<p:cond delay="indefinite"/>` +
      `</p:stCondLst>` +
      `<p:childTnLst>` +
      markerNodes.join("") +
      `</p:childTnLst>` +
      `</p:cTn>` +
      `</p:par>`,
    );

    // --- Click group 2: annotation text ---
    clickGroups.push(
      `<p:par>` +
      `<p:cTn id="${++ctnId}" fill="hold">` +
      `<p:stCondLst>` +
      `<p:cond delay="indefinite"/>` +
      `</p:stCondLst>` +
      `<p:childTnLst>` +
      appearNode(group.textId, "clickEffect") +
      `</p:childTnLst>` +
      `</p:cTn>` +
      `</p:par>`,
    );
  }

  // Build the <p:bldLst> section — required for PowerPoint to recognise animations
  const bldEntries: string[] = [];
  for (const group of groups) {
    for (const mid of group.markerIds) {
      bldEntries.push(`<p:bldP spid="${mid}" grpId="0" animBg="1"/>`);
    }
    bldEntries.push(`<p:bldP spid="${group.textId}" grpId="0"/>`);
  }

  return (
    `<p:timing>` +
    `<p:tnLst>` +
    `<p:par>` +
    `<p:cTn id="${++ctnId}" dur="indefinite" restart="never" nodeType="tmRoot">` +
    `<p:childTnLst>` +
    `<p:seq concurrent="1" nextAc="seek">` +
    `<p:cTn id="${++ctnId}" dur="indefinite" nodeType="mainSeq">` +
    `<p:childTnLst>` +
    clickGroups.join("") +
    `</p:childTnLst>` +
    `</p:cTn>` +
    `<p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst>` +
    `<p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst>` +
    `</p:seq>` +
    `</p:childTnLst>` +
    `</p:cTn>` +
    `</p:par>` +
    `</p:tnLst>` +
    `<p:bldLst>` +
    bldEntries.join("") +
    `</p:bldLst>` +
    `</p:timing>`
  );
}

/**
 * Post-process a PPTX buffer to inject click-triggered "appear" animations
 * into each slide that has annotations.
 *
 * Extracts actual shape IDs from generated XML instead of guessing them.
 *
 * @param slideShapeCounts - For each slide, an array of shape counts per
 *   annotation (each element = marker shapes + 1 text box).
 */
async function injectAnimations(
  pptxBuffer: Buffer,
  slideShapeCounts: number[][],
): Promise<Buffer> {
  const zip = await JSZip.loadAsync(pptxBuffer);

  for (let i = 0; i < slideShapeCounts.length; i++) {
    const shapeCounts = slideShapeCounts[i];
    if (shapeCounts.length === 0) continue;

    const slideFileName = `ppt/slides/slide${i + 1}.xml`;
    const slideXml = await zip.file(slideFileName)?.async("string");
    if (!slideXml) continue;

    const groups = extractShapeIds(slideXml, shapeCounts);
    if (groups.length === 0) continue;

    const timingXml = buildTimingXml(groups);

    // Inject the <p:timing> block right before the closing </p:sld>.
    const updatedXml = slideXml.replace("</p:sld>", `${timingXml}</p:sld>`);
    zip.file(slideFileName, updatedXml);
  }

  const result = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
  });
  return Buffer.from(result);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a PPTX file as a Node.js Buffer (for server-side use, e.g.
 * Next.js API routes).
 *
 * @param slides   - Array of slide content with annotations.
 * @param genre    - Literary genre controlling layout defaults.
 * @param settings - Optional overrides for slide dimensions, font, spacing.
 * @returns A Buffer containing the `.pptx` file bytes.
 */
export async function generatePptxBuffer(
  slides: SlideData[],
  genre: Genre,
  settings?: PptSettings,
): Promise<Buffer> {
  const s: PptSettings =
    settings ??
    (genre === "poetry" ? DEFAULT_POETRY_SETTINGS : DEFAULT_NOVEL_SETTINGS);

  const pptx = new PptxGenJS();

  // Widescreen 13.33 x 7.5
  pptx.defineLayout({ name: "CUSTOM_WIDE", width: s.slideWidth, height: s.slideHeight });
  pptx.layout = "CUSTOM_WIDE";
  pptx.author = "lit-ppt";
  pptx.title = genre === "poetry" ? "문학 수업 PPT" : "문학 수업 PPT";

  // Pre-process: prevent annotations from being split across visual lines
  const textAreaWidth = s.slideWidth - TEXT_LEFT_MARGIN * 2;
  const processedSlides = slides.map((slideData) => {
    const result = preprocessAnnotations(
      slideData.text,
      slideData.annotations,
      s.fontSize,
      textAreaWidth,
    );
    return { ...slideData, text: result.text, annotations: result.annotations };
  });

  const slideShapeCounts: number[][] = [];

  for (const slideData of processedSlides) {
    const counts = buildSlide(pptx, slideData, genre, s);
    slideShapeCounts.push(counts);
  }

  // Generate the raw PPTX (no animations yet).
  const rawBuffer = (await pptx.write({
    outputType: "nodebuffer",
  })) as Buffer;

  // If any slide has annotations, post-process to inject click-to-appear
  // animation XML.
  const hasAnimations = slideShapeCounts.some((counts) => counts.length > 0);
  if (!hasAnimations) {
    return Buffer.from(rawBuffer);
  }

  return injectAnimations(Buffer.from(rawBuffer), slideShapeCounts);
}

/**
 * Generate a PPTX file as a Blob (for client-side / browser use).
 *
 * @param slides   - Array of slide content with annotations.
 * @param genre    - Literary genre controlling layout defaults.
 * @param settings - Optional overrides for slide dimensions, font, spacing.
 * @returns A Blob containing the `.pptx` file.
 */
export async function generatePptxBlob(
  slides: SlideData[],
  genre: Genre,
  settings?: PptSettings,
): Promise<Blob> {
  const buffer = await generatePptxBuffer(slides, genre, settings);
  return new Blob([new Uint8Array(buffer)], {
    type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  });
}

/**
 * Convenience alias that delegates to `generatePptxBuffer`.
 * Kept for backward compatibility with existing call-sites.
 */
export async function generatePptx(
  slides: SlideData[],
  genre: Genre,
  settings?: PptSettings,
): Promise<Buffer> {
  return generatePptxBuffer(slides, genre, settings);
}
