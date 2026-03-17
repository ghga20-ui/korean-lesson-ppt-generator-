import type { Annotation, ExtractedAnnotation, SlideData } from "./types";
import { DEFAULT_ANNOTATION_COLOR } from "./types";

/**
 * Normalize text for fuzzy matching: collapse whitespace, normalize quotes
 */
function normalize(text: string): string {
  return text
    .replace(/[\u2018\u2019\u201C\u201D]/g, (ch) =>
      ch === "\u2018" || ch === "\u2019" ? "'" : '"'
    )
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Try to find targetText in fullText. Returns start index or -1.
 * First tries exact match, then normalized match.
 */
function findInText(
  fullText: string,
  targetText: string
): { start: number; end: number } | null {
  // Exact match
  const exactIdx = fullText.indexOf(targetText);
  if (exactIdx !== -1) {
    return { start: exactIdx, end: exactIdx + targetText.length };
  }

  // Normalized match: build a mapping from normalized positions back to original
  const normFull = normalize(fullText);
  const normTarget = normalize(targetText);
  if (!normTarget) return null;

  const normIdx = normFull.indexOf(normTarget);
  if (normIdx === -1) return null;

  // Map normalized index back to original index
  let normPos = 0;
  let origStart = -1;
  let origEnd = -1;

  for (let i = 0; i < fullText.length && normPos <= normIdx + normTarget.length; i++) {
    const ch = fullText[i];
    // Skip extra whitespace in original (normalized collapses to single space)
    if (/\s/.test(ch)) {
      // Find end of whitespace run in original
      let j = i + 1;
      while (j < fullText.length && /\s/.test(fullText[j])) j++;
      if (normPos === normIdx) origStart = i;
      normPos++; // one space in normalized
      if (normPos === normIdx + normTarget.length) {
        origEnd = j > i + 1 ? i + 1 : j;
        break;
      }
      i = j - 1;
      continue;
    }

    // Normalize quotes
    let normCh = ch;
    if (ch === "\u2018" || ch === "\u2019") normCh = "'";
    else if (ch === "\u201C" || ch === "\u201D") normCh = '"';

    if (normPos === normIdx) origStart = i;
    normPos++;
    if (normPos === normIdx + normTarget.length) {
      origEnd = i + 1;
      break;
    }
  }

  if (origStart !== -1 && origEnd !== -1) {
    return { start: origStart, end: origEnd };
  }

  return null;
}

export interface MatchResult {
  matched: Annotation[];
  unmatched: ExtractedAnnotation[];
}

/**
 * Match extracted annotations against the full text.
 * Returns matched annotations (with indices) and unmatched ones.
 */
export function matchAnnotationsToText(
  fullText: string,
  extracted: ExtractedAnnotation[]
): MatchResult {
  const matched: Annotation[] = [];
  const unmatched: ExtractedAnnotation[] = [];

  extracted.forEach((ext, idx) => {
    const found = findInText(fullText, ext.targetText);
    if (found) {
      matched.push({
        id: `ext-${idx}-${Date.now()}`,
        startIndex: found.start,
        endIndex: found.end,
        targetText: fullText.slice(found.start, found.end),
        content: ext.content,
        markerType: ext.markerType,
        order: matched.length + 1,
        color: DEFAULT_ANNOTATION_COLOR,
      });
    } else {
      unmatched.push(ext);
    }
  });

  return { matched, unmatched };
}

/**
 * Distribute full-text annotations into per-slide annotations.
 * Converts global text indices to slide-local indices.
 */
export function distributeAnnotationsToSlides(
  fullText: string,
  slides: SlideData[],
  annotations: Annotation[]
): SlideData[] {
  // Build cumulative offset for each slide
  const offsets: { start: number; end: number }[] = [];
  let cursor = 0;
  for (const slide of slides) {
    const start = fullText.indexOf(slide.text, cursor);
    const actualStart = start !== -1 ? start : cursor;
    offsets.push({ start: actualStart, end: actualStart + slide.text.length });
    cursor = actualStart + slide.text.length;
  }

  return slides.map((slide, slideIdx) => {
    const { start: slideStart, end: slideEnd } = offsets[slideIdx];
    const slideAnnotations: Annotation[] = [];

    for (const ann of annotations) {
      // Summary annotations anchor to the end of their target text
      // so they land on the last slide of their paragraph/stanza
      let belongs: boolean;
      if (ann.markerType === "summary") {
        const anchor = ann.endIndex - 1;
        belongs = anchor >= slideStart && anchor < slideEnd;
      } else {
        belongs = ann.startIndex >= slideStart && ann.startIndex < slideEnd;
      }

      if (belongs) {
        slideAnnotations.push({
          ...ann,
          id: `${slide.id}-ann-${slideAnnotations.length}`,
          startIndex: ann.startIndex - slideStart,
          endIndex: Math.min(ann.endIndex, slideEnd) - slideStart,
          targetText: slide.text.slice(
            ann.startIndex - slideStart,
            Math.min(ann.endIndex, slideEnd) - slideStart
          ),
          order: slideAnnotations.length + 1,
        });
      }
    }

    return {
      ...slide,
      annotations: slideAnnotations,
    };
  });
}
