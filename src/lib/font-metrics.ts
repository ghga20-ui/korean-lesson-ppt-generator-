/**
 * Font metrics for supported fonts.
 * Character widths are in em units (multiply by fontSize/72 to get inches).
 * lineStepRatio is empirically calibrated for PowerPoint rendering.
 */

export interface FontMetrics {
  /** Font name as used in PowerPoint */
  name: string;
  /** Korean Hangul syllable advance width (em) */
  hangul: number;
  /** Uppercase Latin advance width (em) */
  latinUpper: number;
  /** Lowercase Latin advance width (em) */
  latinLower: number;
  /** Digit advance width (em) */
  digit: number;
  /** Space advance width (em) */
  space: number;
  /** Punctuation advance width (em) */
  punctuation: number;
  /** Bracket/parenthesis advance width (em) */
  bracket: number;
  /** Fullwidth character advance width (em) */
  fullwidth: number;
  /** PPT line-step ratio (empirical, for line Y positioning) */
  lineStepRatio: number;
}

export const FONT_METRICS: Record<string, FontMetrics> = {
  "한컴산뜻돋움": {
    name: "한컴산뜻돋움",
    hangul: 0.932,
    latinUpper: 0.7,
    latinLower: 0.5,
    digit: 0.6,
    space: 0.264,
    punctuation: 0.297,
    bracket: 0.35,
    fullwidth: 0.932,
    lineStepRatio: 1.22,
  },
  "맑은 고딕": {
    name: "맑은 고딕",
    hangul: 1.0,
    latinUpper: 0.65,
    latinLower: 0.48,
    digit: 0.56,
    space: 0.25,
    punctuation: 0.28,
    bracket: 0.33,
    fullwidth: 1.0,
    // 실측 교정(2026-07): 36pt/ls1.8에서 4줄 렌더의 밑줄-글자 간격이
    // 줄당 +2.7px 벌어짐 → 실제 스텝 역산 1.219. 기존 1.25는 미검증 추정값.
    lineStepRatio: 1.22,
  },
  "나눔고딕": {
    name: "나눔고딕",
    hangul: 1.0,
    latinUpper: 0.62,
    latinLower: 0.46,
    digit: 0.55,
    space: 0.25,
    punctuation: 0.27,
    bracket: 0.32,
    fullwidth: 1.0,
    lineStepRatio: 1.24,
  },
};

export const SUPPORTED_FONTS = Object.keys(FONT_METRICS);
export const DEFAULT_FONT = "한컴산뜻돋움";

/**
 * Get metrics for a font, falling back to default if not found.
 */
export function getFontMetrics(fontFamily: string): FontMetrics {
  return FONT_METRICS[fontFamily] || FONT_METRICS[DEFAULT_FONT];
}
