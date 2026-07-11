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
 * Try to find targetText in fullText at or after `from`. Returns start index or -1.
 * First tries exact match, then normalized match.
 *
 * `from` lets the caller walk successive occurrences: the teacher's edition
 * annotates repeated words (구보, 그) separately, and each annotation must land
 * on its own occurrence rather than all piling onto the first.
 */
function findInText(
  fullText: string,
  targetText: string,
  from: number = 0
): { start: number; end: number } | null {
  // Exact match
  const exactIdx = fullText.indexOf(targetText, from);
  if (exactIdx !== -1) {
    return { start: exactIdx, end: exactIdx + targetText.length };
  }

  // Normalized match: build a mapping from normalized positions back to original
  const normFull = normalize(fullText);
  const normTarget = normalize(targetText);
  if (!normTarget) return null;

  // Walk every normalized occurrence and keep the first one that starts at or
  // after `from` in the ORIGINAL string. Normalized and original indices differ
  // wherever whitespace was collapsed, so the check must happen after mapping.
  for (let normIdx = normFull.indexOf(normTarget); normIdx !== -1; normIdx = normFull.indexOf(normTarget, normIdx + 1)) {
    const span = mapNormSpanToOriginal(fullText, normIdx, normTarget.length);
    if (span && span.start >= from) return span;
  }

  return null;
}

/**
 * Map a span in the normalized string back to indices in the original string.
 */
function mapNormSpanToOriginal(
  fullText: string,
  normIdx: number,
  normTargetLen: number
): { start: number; end: number } | null {
  let normPos = 0;
  let origStart = -1;
  let origEnd = -1;

  for (let i = 0; i < fullText.length && normPos <= normIdx + normTargetLen; i++) {
    const ch = fullText[i];
    // Skip extra whitespace in original (normalized collapses to single space)
    if (/\s/.test(ch)) {
      // Find end of whitespace run in original
      let j = i + 1;
      while (j < fullText.length && /\s/.test(fullText[j])) j++;
      if (normPos === normIdx) origStart = i;
      normPos++; // one space in normalized
      if (normPos === normIdx + normTargetLen) {
        origEnd = j > i + 1 ? i + 1 : j;
        break;
      }
      i = j - 1;
      continue;
    }

    if (normPos === normIdx) origStart = i;
    normPos++;
    if (normPos === normIdx + normTargetLen) {
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

  // Annotations arrive in reading order, so the Nth annotation carrying a given
  // targetText belongs to that word's Nth occurrence. Without this cursor every
  // annotation on a repeated word (구보, 그) collapses onto the first occurrence,
  // and the duplicates are silently dropped at render time.
  const searchFrom = new Map<string, number>();

  extracted.forEach((ext, idx) => {
    const from = searchFrom.get(ext.targetText) ?? 0;
    const found = findInText(fullText, ext.targetText, from);
    if (found) {
      searchFrom.set(ext.targetText, found.start + 1);
      matched.push({
        id: `ext-${idx}-${Date.now()}`,
        startIndex: found.start,
        endIndex: found.end,
        targetText: fullText.slice(found.start, found.end),
        content: ext.content,
        markerType: ext.markerType,
        order: matched.length + 1,
        color: DEFAULT_ANNOTATION_COLOR,
        source: "ai",
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
    // 아래 두 분기 모두 `...ann` 스프레드로 복사하므로 matchAnnotationsToText가
    // 붙인 source: "ai"가 슬라이드별 재매핑 후에도 그대로 유지된다.
    const slideAnnotations: Annotation[] = [];

    for (const ann of annotations) {
      // Summary annotations anchor to the end of their target text
      // so they land on the last slide of their paragraph/stanza
      if (ann.markerType === "summary") {
        const anchor = ann.endIndex - 1;
        if (anchor >= slideStart && anchor < slideEnd) {
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
        continue;
      }

      // A marker may span a slide boundary. Draw its shape on every slide it
      // overlaps, clipped to that slide, but attach the explanation text only
      // to the slide where the annotation begins — otherwise the same sentence
      // is projected twice.
      const from = Math.max(ann.startIndex, slideStart);
      const to = Math.min(ann.endIndex, slideEnd);
      if (from < to) {
        const startsHere = ann.startIndex >= slideStart && ann.startIndex < slideEnd;
        slideAnnotations.push({
          ...ann,
          id: `${slide.id}-ann-${slideAnnotations.length}`,
          startIndex: from - slideStart,
          endIndex: to - slideStart,
          targetText: slide.text.slice(from - slideStart, to - slideStart),
          content: startsHere ? ann.content : "",
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
