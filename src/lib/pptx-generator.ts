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
import {
  TEXT_LEFT_MARGIN,
  TEXT_TOP_MARGIN,
  MAIN_TEXT_COLOR,
  SLIDE_BG_COLOR,
  MARKER_COLOR,
  UNDERLINE_LINE_WIDTH,
  SHAPE_LINE_WIDTH,
  ANNOTATION_TEXT_HEIGHT,
  SUMMARY_BG_COLOR,
  SUMMARY_BORDER_COLOR,
} from "./pptx-constants";
import { layoutAnnotation } from "./annotation-layout";
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
  const totalLines = slideData.text.split("\n").length;

  for (let idx = 0; idx < sortedAnnotations.length; idx++) {
    const annotation = sortedAnnotations[idx];
    const color = (annotation.color ?? MARKER_COLOR).replace(/^#/, "");

    // 모든 인치 좌표 산출은 순수 모듈에 위임한다(HTML 미리보기와 동일한 좌표).
    const layout = layoutAnnotation(
      slideData.text,
      annotation,
      settings,
      totalLines,
    );
    const marker = layout.marker;

    let markerShapeCount = 0;

    // ---- Marker shape(s) ----
    if (marker.kind === "underline") {
      for (const seg of marker.segments) {
        slide.addShape(pptx.ShapeType.line, {
          x: seg.x,
          y: seg.y,
          w: seg.w,
          h: 0,
          line: { color, width: UNDERLINE_LINE_WIDTH },
        });
        markerShapeCount++;
      }
    } else if (marker.kind === "bracket") {
      // 「 — 시작 글자의 잉크 top 좌상단
      slide.addText("「", {
        x: marker.open.x,
        y: marker.open.y,
        w: marker.open.size,
        h: marker.open.size,
        fontSize: settings.fontSize,
        fontFace: settings.fontFamily,
        bold: true,
        color,
        align: "center",
        valign: "bottom",
        isTextBox: true,
        margin: 0,
      });

      // 」 — 끝 글자의 baseline 우하단
      slide.addText("」", {
        x: marker.close.x,
        y: marker.close.y,
        w: marker.close.size,
        h: marker.close.size,
        fontSize: settings.fontSize,
        fontFace: settings.fontFamily,
        bold: true,
        color,
        align: "center",
        valign: "top",
        isTextBox: true,
        margin: 0,
      });

      markerShapeCount = 2;
    } else if (marker.kind === "summary") {
      slide.addShape(pptx.ShapeType.roundRect, {
        x: marker.x,
        y: marker.y,
        w: marker.w,
        h: marker.h,
        fill: { color: SUMMARY_BG_COLOR },
        line: { color: SUMMARY_BORDER_COLOR, width: 1.5 },
        rectRadius: 0.08,
      });
      markerShapeCount = 1;

      // 요약 주석은 박스 안에 ▶ 텍스트를 넣는다(박스 좌표에서 고정 인셋으로 파생).
      slide.addText("▶ " + annotation.content, {
        x: marker.x + 0.15,
        y: marker.y + 0.05,
        w: marker.w - 0.3,
        h: marker.h - 0.1,
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
    } else {
      const shapeType = getShapeType(marker.shape, pptx);
      slide.addShape(shapeType, {
        x: marker.x,
        y: marker.y,
        w: marker.w,
        h: marker.h,
        fill: { type: "none" },
        line: { color, width: SHAPE_LINE_WIDTH },
      });
      markerShapeCount = 1;
    }

    // ---- Annotation text box ----
    if (layout.text) {
      slide.addText(annotation.content, {
        x: layout.text.x,
        y: layout.text.y,
        w: layout.text.w,
        h: ANNOTATION_TEXT_HEIGHT,
        fontSize: layout.text.fontSizePt,
        fontFace: settings.fontFamily,
        bold: true,
        color,
        align: "left",
        valign: "top",
        wrap: true,
        isTextBox: true,
      });
    }

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
  pptx.author = "밑줄쫙";
  pptx.title = genre === "poetry" ? "문학 수업 PPT" : "문학 수업 PPT";

  const slideShapeCounts: number[][] = [];

  for (const slideData of slides) {
    const counts = buildSlide(pptx, slideData, s);
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
