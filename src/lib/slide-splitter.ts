import { Genre, SlideData, PptSettings, DEFAULT_POETRY_SETTINGS, DEFAULT_NOVEL_SETTINGS } from "./types";
import { getCharWidthInch, countVisualLines } from "./pptx-generator";
import { getFontMetrics } from "./font-metrics";

/**
 * Estimate max lines per slide given font size, line spacing, and slide dimensions.
 * Reserves ~30% of slide height for annotation text boxes below the main text.
 */
function getMaxLinesPerSlide(settings: PptSettings): number {
  const usableHeightInches = settings.slideHeight * settings.textAreaHeightRatio;
  const lineHeightPt = settings.fontSize * settings.lineSpacing;
  const lineHeightInches = lineHeightPt / 72; // 72 points per inch
  return Math.floor(usableHeightInches / lineHeightInches);
}

/**
 * Split poetry text into slides.
 * Primary split: by stanza (blank lines).
 * Secondary split: if a stanza exceeds visual line capacity (including
 * soft-wraps), accumulate lines until visual count reaches the max.
 */
function splitPoetry(text: string, settings: PptSettings): string[] {
  const maxLines = getMaxLinesPerSlide(settings);
  const textAreaWidth = (settings.slideWidth - 1.0) * 0.97;
  const metrics = getFontMetrics(settings.fontFamily);
  const stanzas = text.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
  const slides: string[] = [];

  for (const stanza of stanzas) {
    const visualLines = countVisualLines(stanza, settings.fontSize, textAreaWidth, metrics);

    if (visualLines <= maxLines) {
      slides.push(stanza);
    } else {
      const lines = stanza.split("\n");
      let chunk: string[] = [];
      let visualCount = 0;

      for (const line of lines) {
        const lineVisual = countVisualLines(line, settings.fontSize, textAreaWidth, metrics);

        if (visualCount + lineVisual > maxLines && chunk.length > 0) {
          slides.push(chunk.join("\n"));
          chunk = [line];
          visualCount = lineVisual;
        } else {
          chunk.push(line);
          visualCount += lineVisual;
        }
      }

      if (chunk.length > 0) {
        slides.push(chunk.join("\n"));
      }
    }
  }

  return slides;
}

/**
 * Find the character index where the text reaches exactly maxLines visual lines.
 */
function findBreakPointByVisualLines(
  text: string,
  maxLines: number,
  fontSize: number,
  textAreaWidthInch: number,
  metrics?: import("./font-metrics").FontMetrics,
): number {
  let line = 1;
  let lineXAccum = 0;

  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\n") {
      line++;
      lineXAccum = 0;
    } else {
      const charW = getCharWidthInch(text[i], fontSize, metrics);
      lineXAccum += charW;
      if (lineXAccum > textAreaWidthInch) {
        line++;
        lineXAccum = charW;
      }
    }

    if (line > maxLines) {
      return i;
    }
  }

  return text.length;
}

/**
 * Split novel text into slides based on visual line capacity.
 * Tries to break at sentence boundaries (period + space or newline).
 */
/**
 * Split text into segments at forced break points, then split each segment normally.
 * Used when summary annotations require paragraph-level slide boundaries.
 */
function splitWithForcedBreaks(
  text: string,
  settings: PptSettings,
  forcedBreaks: number[],
  splitFn: (text: string, settings: PptSettings) => string[],
): string[] {
  if (forcedBreaks.length === 0) return splitFn(text, settings);

  const sorted = [...new Set(forcedBreaks)].sort((a, b) => a - b);
  const segments: string[] = [];
  let lastPos = 0;

  for (const brk of sorted) {
    if (brk > lastPos && brk <= text.length) {
      segments.push(text.slice(lastPos, brk));
      lastPos = brk;
    }
  }
  if (lastPos < text.length) {
    segments.push(text.slice(lastPos));
  }

  const allSlides: string[] = [];
  for (const seg of segments) {
    const trimmed = seg.trim();
    if (trimmed) {
      allSlides.push(...splitFn(trimmed, settings));
    }
  }
  return allSlides;
}

function splitNovel(text: string, settings: PptSettings): string[] {
  const maxLines = getMaxLinesPerSlide(settings);
  const textAreaWidth = (settings.slideWidth - 1.0) * 0.97;
  const metrics = getFontMetrics(settings.fontFamily);

  const slides: string[] = [];
  let remaining = text.trim();

  while (remaining.length > 0) {
    const totalVisual = countVisualLines(remaining, settings.fontSize, textAreaWidth, metrics);
    if (totalVisual <= maxLines) {
      slides.push(remaining);
      break;
    }

    let breakPoint = findBreakPointByVisualLines(
      remaining, maxLines, settings.fontSize, textAreaWidth, metrics,
    );

    // Look for sentence boundary near the break point (within 70-100% range)
    const searchStart = Math.floor(breakPoint * 0.7);
    let bestBreak = -1;

    for (let i = searchStart; i <= breakPoint && i < remaining.length; i++) {
      if (remaining[i] === "." || remaining[i] === "\n") {
        bestBreak = i + 1;
      }
    }

    if (bestBreak > 0) {
      breakPoint = bestBreak;
    }

    slides.push(remaining.slice(0, breakPoint).trim());
    remaining = remaining.slice(breakPoint).trim();
  }

  return slides;
}

let slideIdCounter = 0;

function generateId(): string {
  return `slide-${Date.now()}-${slideIdCounter++}`;
}

/**
 * Split text into slides based on genre.
 * @param summaryBreakIndices - Optional character indices where slides must break
 *   (used when summary annotations require paragraph-level boundaries).
 */
export function splitText(
  text: string,
  genre: Genre,
  settings?: PptSettings,
  summaryBreakIndices?: number[],
): SlideData[] {
  const resolvedSettings = settings ?? (genre === "poetry" ? DEFAULT_POETRY_SETTINGS : DEFAULT_NOVEL_SETTINGS);

  const splitFn = genre === "poetry" ? splitPoetry : splitNovel;
  const textChunks = summaryBreakIndices && summaryBreakIndices.length > 0
    ? splitWithForcedBreaks(text, resolvedSettings, summaryBreakIndices, splitFn)
    : splitFn(text, resolvedSettings);

  return textChunks.map((chunk) => ({
    id: generateId(),
    text: chunk,
    annotations: [],
  }));
}

/**
 * Re-split slides at a specific character position within a slide.
 * Used when the user wants to manually adjust split points.
 */
export function splitSlideAt(
  slides: SlideData[],
  slideIndex: number,
  charIndex: number
): SlideData[] {
  const slide = slides[slideIndex];
  if (!slide || charIndex <= 0 || charIndex >= slide.text.length) return slides;

  const before = slide.text.slice(0, charIndex).trim();
  const after = slide.text.slice(charIndex).trim();

  if (!before || !after) return slides;

  const newSlides = [...slides];
  newSlides.splice(slideIndex, 1, {
    id: slide.id,
    text: before,
    annotations: slide.annotations.filter(
      (a) => a.endIndex <= charIndex
    ),
  }, {
    id: generateId(),
    text: after,
    annotations: slide.annotations
      .filter((a) => a.startIndex >= charIndex)
      .map((a) => ({
        ...a,
        startIndex: a.startIndex - charIndex,
        endIndex: a.endIndex - charIndex,
      })),
  });

  return newSlides;
}

/**
 * Merge two adjacent slides into one.
 */
export function mergeSlides(
  slides: SlideData[],
  slideIndex: number
): SlideData[] {
  if (slideIndex < 0 || slideIndex >= slides.length - 1) return slides;

  const first = slides[slideIndex];
  const second = slides[slideIndex + 1];
  const separator = "\n";
  const firstLen = first.text.length + separator.length;

  const merged: SlideData = {
    id: first.id,
    text: first.text + separator + second.text,
    annotations: [
      ...first.annotations,
      ...second.annotations.map((a) => ({
        ...a,
        startIndex: a.startIndex + firstLen,
        endIndex: a.endIndex + firstLen,
      })),
    ],
  };

  const newSlides = [...slides];
  newSlides.splice(slideIndex, 2, merged);
  return newSlides;
}
