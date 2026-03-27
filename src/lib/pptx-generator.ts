import PptxGenJS from "pptxgenjs";
import {
  type Annotation,
  type Genre,
  type SlideData,
  type PptSettings,
  type MarkerType,
  DEFAULT_POETRY_SETTINGS,
  DEFAULT_NOVEL_SETTINGS,
} from "./types";
import { getFontMetrics } from "./font-metrics";
import {
  TEXT_LEFT_MARGIN,
  TEXT_TOP_MARGIN,
  MAIN_TEXT_COLOR,
  SLIDE_BG_COLOR,
  MARKER_COLOR,
  UNDERLINE_LINE_WIDTH,
  SHAPE_LINE_WIDTH,
  SHAPE_Y_OFFSET,
  BRACKET_SYMBOL_FONT_SIZE,
  ANNOTATION_Y_GAP,
  ANNOTATION_TEXT_HEIGHT,
  MIN_ANNOTATION_WIDTH,
  SUMMARY_BG_COLOR,
  SUMMARY_BORDER_COLOR,
  SUMMARY_BOX_HEIGHT,
  SUMMARY_BOX_BOTTOM_OFFSET,
  GLYPH_Y_OFFSET_BRACKET_TOP,
  GLYPH_Y_OFFSET_BRACKET_BOTTOM,
  LINE_DRIFT_CORRECTION,
  MULTI_LINE_ANNOTATION_OFFSET,
  GAP_BIAS_FACTOR,
} from "./pptx-constants";
import {
  estimateTextPosition,
  getUnderlineSegments,
  getShapeGeometry,
} from "./pptx-geometry";
import { injectAnimations } from "./pptx-animation";

// Re-export geometry utilities used by slide-splitter
export { getCharWidthInch, countVisualLines } from "./pptx-geometry";

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
      return pptx.ShapeType.rect;
  }
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

  const metrics = getFontMetrics(settings.fontFamily);
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
      fontFace: settings.fontFamily,
      bold: true,
      color: MAIN_TEXT_COLOR,
      align: "left",
      valign: "top",
      lineSpacingMultiple: settings.lineSpacing,
      wrap: true,
      isTextBox: true,
      margin: 0,
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
    const color = (annotation.color ?? MARKER_COLOR).replace(/^#/, "");

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
      const segments = getUnderlineSegments(
        slideData.text,
        annotation.startIndex,
        annotation.endIndex,
        settings,
        genre,
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
      shapeBottomY = lastSeg.y;
      shapeLeftX = segments[0].x;
      shapeWidth = segments[0].w;
    } else if (annotation.markerType === "bracket") {
      const startPos = estimateTextPosition(
        slideData.text, annotation.startIndex, annotation.startIndex + 1, settings,
      );
      const endPos = estimateTextPosition(
        slideData.text, annotation.endIndex - 1, annotation.endIndex, settings,
      );
      const symbolSize = BRACKET_SYMBOL_FONT_SIZE / 72;
      const brs = settings.fontSize / 36;

      // 「 above-left of the start position
      slide.addText("「", {
        x: startPos.x - 0.22,
        y: startPos.y + SHAPE_Y_OFFSET + GLYPH_Y_OFFSET_BRACKET_TOP * brs,
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
        x: endPos.x + endPos.w - 0.22,
        y: endPos.y + endPos.h + SHAPE_Y_OFFSET + GLYPH_Y_OFFSET_BRACKET_BOTTOM * brs,
        w: symbolSize,
        h: symbolSize,
        fontSize: BRACKET_SYMBOL_FONT_SIZE,
        fontFace: settings.fontFamily,
        bold: true,
        color,
        align: "center",
        valign: "top",
        isTextBox: true,
        margin: 0,
      });

      markerShapeCount = 2;
      shapeBottomY = endPos.y + endPos.h + SHAPE_Y_OFFSET + 0.02 + symbolSize * 0.65;
      shapeLeftX = startPos.x;
      shapeWidth = pos.w;
    } else if (annotation.markerType === "summary") {
      const summaryBoxW = textAreaWidth;
      const summaryBoxX = TEXT_LEFT_MARGIN;
      const summaryBoxY = settings.slideHeight - SUMMARY_BOX_HEIGHT - SUMMARY_BOX_BOTTOM_OFFSET;

      slide.addShape(pptx.ShapeType.roundRect, {
        x: summaryBoxX,
        y: summaryBoxY,
        w: summaryBoxW,
        h: SUMMARY_BOX_HEIGHT,
        fill: { color: SUMMARY_BG_COLOR },
        line: { color: SUMMARY_BORDER_COLOR, width: 1.5 },
        rectRadius: 0.08,
      });
      markerShapeCount = 1;
      shapeBottomY = summaryBoxY;
      shapeLeftX = summaryBoxX;
      shapeWidth = summaryBoxW;
    } else {
      const geom = getShapeGeometry(annotation.markerType, pos, settings.fontSize, genre);
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
      const summaryBoxY = settings.slideHeight - SUMMARY_BOX_HEIGHT - SUMMARY_BOX_BOTTOM_OFFSET;
      slide.addText("▶ " + annotation.content, {
        x: TEXT_LEFT_MARGIN + 0.15,
        y: summaryBoxY + 0.05,
        w: textAreaWidth - 0.3,
        h: SUMMARY_BOX_HEIGHT - 0.1,
        fontSize: settings.annotationFontSize,
        fontFace: settings.fontFamily,
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
      (settings.fontSize * metrics.lineStepRatio * settings.lineSpacing) / 72;
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

    slide.addText(annotation.content, {
      x: annotTextX,
      y: clampedY,
      w: annotTextW,
      h: ANNOTATION_TEXT_HEIGHT,
      fontSize: settings.annotationFontSize,
      fontFace: settings.fontFamily,
      bold: true,
      color,
      align: "left",
      valign: "top",
      wrap: true,
      isTextBox: true,
    });

    shapeCountsPerAnnotation.push(markerShapeCount + 1);
  }

  return shapeCountsPerAnnotation;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a PPTX file as a Node.js Buffer (for server-side use, e.g.
 * Next.js API routes).
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

  pptx.defineLayout({ name: "CUSTOM_WIDE", width: s.slideWidth, height: s.slideHeight });
  pptx.layout = "CUSTOM_WIDE";
  pptx.author = "lit-ppt";
  pptx.title = genre === "poetry" ? "문학 수업 PPT" : "문학 수업 PPT";

  const slideShapeCounts: number[][] = [];

  for (const slideData of slides) {
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
