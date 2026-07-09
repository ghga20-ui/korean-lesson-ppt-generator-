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
  /** baseline 위 한글 잉크 높이(em). 미지정 시 pptx-constants의 CAP_HEIGHT_EM(0.90). */
  capHeightEm?: number;
  /** 한컴 기준 baseline 모델에 대한 이 폰트의 상수 보정(em). 미지정 시 0. */
  baselineAdjustEm?: number;
}

export const FONT_METRICS: Record<string, FontMetrics> = {
  "한컴산뜻돋움": {
    name: "한컴산뜻돋움",
    hangul: 0.935, // 실측 2026-07 (calibrate.py, PowerPoint 렌더)
    latinUpper: 0.7,
    latinLower: 0.5,
    digit: 0.6,
    space: 0.264,
    punctuation: 0.297,
    bracket: 0.35,
    fullwidth: 0.932,
    lineStepRatio: 1.2162, // 실측 2026-07 (calibrate.py, PowerPoint 렌더)
    capHeightEm: 0.9, // 기준 폰트: baseline 모델 적합에 쓴 보수적 fitted 값 유지
    baselineAdjustEm: 0, // 기준 폰트 — baseline 모델이 이 폰트에 적합되어 보정 0
  },
  "맑은 고딕": {
    name: "맑은 고딕",
    hangul: 0.997, // 실측 2026-07 (calibrate.py, PowerPoint 렌더)
    latinUpper: 0.65,
    latinLower: 0.48,
    digit: 0.56,
    space: 0.25,
    punctuation: 0.28,
    bracket: 0.33,
    fullwidth: 1.0,
    lineStepRatio: 1.2162, // 실측 2026-07 (calibrate.py, PowerPoint 렌더)
    capHeightEm: 0.896, // 실측 2026-07 (calibrate.py, PowerPoint 렌더)
    baselineAdjustEm: -0.06, // 실측 2026-07 (calibrate.py, PowerPoint 렌더)
  },
  "바탕": {
    name: "바탕",
    hangul: 0.986, // 실측 2026-07 (calibrate.py, PowerPoint 렌더)
    // 라틴계 버킷은 맑은 고딕 근사 — 한글 본문 도구라 줄바꿈에만 영향
    latinUpper: 0.65,
    latinLower: 0.48,
    digit: 0.56,
    space: 0.25,
    punctuation: 0.28,
    bracket: 0.33,
    fullwidth: 1.0,
    lineStepRatio: 1.2162, // 실측 2026-07 (calibrate.py, PowerPoint 렌더)
    capHeightEm: 0.896, // 실측 2026-07 (calibrate.py, PowerPoint 렌더)
    baselineAdjustEm: -0.0392, // 실측 2026-07 (calibrate.py, PowerPoint 렌더)
  },
  "돋움": {
    name: "돋움",
    hangul: 0.9905, // 실측 2026-07 (calibrate.py, PowerPoint 렌더)
    // 라틴계 버킷은 맑은 고딕 근사 — 한글 본문 도구라 줄바꿈에만 영향
    latinUpper: 0.65,
    latinLower: 0.48,
    digit: 0.56,
    space: 0.25,
    punctuation: 0.28,
    bracket: 0.33,
    fullwidth: 1.0,
    lineStepRatio: 1.2124, // 실측 2026-07 (calibrate.py, PowerPoint 렌더)
    capHeightEm: 0.875, // 실측 2026-07 (calibrate.py, PowerPoint 렌더)
    baselineAdjustEm: -0.06, // 실측 2026-07 (calibrate.py, PowerPoint 렌더)
  },
  "나눔고딕": {
    name: "나눔고딕",
    hangul: 0.928, // 실측 2026-07 (calibrate.py, PowerPoint 렌더) — 기존 1.0은 미검증 추정값
    latinUpper: 0.62,
    latinLower: 0.46,
    digit: 0.55,
    space: 0.25,
    punctuation: 0.27,
    bracket: 0.32,
    fullwidth: 1.0,
    lineStepRatio: 1.2162, // 실측 2026-07 (calibrate.py, PowerPoint 렌더)
    capHeightEm: 0.916, // 실측 2026-07 (calibrate.py, PowerPoint 렌더)
    baselineAdjustEm: 0.0233, // 실측 2026-07 (calibrate.py, PowerPoint 렌더)
  },
  "나눔명조": {
    name: "나눔명조",
    hangul: 0.956, // 실측 2026-07 (calibrate.py, PowerPoint 렌더)
    // 라틴계 버킷은 맑은 고딕 근사 — 한글 본문 도구라 줄바꿈에만 영향
    latinUpper: 0.65,
    latinLower: 0.48,
    digit: 0.56,
    space: 0.25,
    punctuation: 0.28,
    bracket: 0.33,
    fullwidth: 1.0,
    lineStepRatio: 1.2162, // 실측 2026-07 (calibrate.py, PowerPoint 렌더)
    capHeightEm: 0.916, // 실측 2026-07 (calibrate.py, PowerPoint 렌더)
    baselineAdjustEm: -0.0183, // 실측 2026-07 (calibrate.py, PowerPoint 렌더)
  },
};

export const SUPPORTED_FONTS = Object.keys(FONT_METRICS);
export const DEFAULT_FONT = "한컴산뜻돋움";

/** 폰트 선택 UI에 노출할 짧은 라벨. */
export const FONT_LABELS: Record<string, string> = {
  "한컴산뜻돋움": "한컴산뜻돋움 (기본 · 옛한글 지원)",
  "맑은 고딕": "맑은 고딕",
  "바탕": "바탕 (세리프)",
  "돋움": "돋움",
  "나눔고딕": "나눔고딕",
  "나눔명조": "나눔명조 (세리프)",
};

/**
 * Get metrics for a font, falling back to default if not found.
 */
export function getFontMetrics(fontFamily: string): FontMetrics {
  return FONT_METRICS[fontFamily] || FONT_METRICS[DEFAULT_FONT];
}
