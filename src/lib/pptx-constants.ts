/**
 * Centralized constants for PPTX generation.
 * All magic numbers and layout values are collected here
 * for easy tuning and documentation.
 */

// ---------------------------------------------------------------------------
// Slide Layout
// ---------------------------------------------------------------------------

/** Left margin for the main text area (inches). */
export const TEXT_LEFT_MARGIN = 0.5;

/** Top margin for the main text area (inches). */
export const TEXT_TOP_MARGIN = 0.2;

/** Proportion of slide height reserved for the main text area. */
export const TEXT_AREA_HEIGHT_RATIO = 0.65;

// ---------------------------------------------------------------------------
// Text Rendering
// ---------------------------------------------------------------------------

/** Main text colour (near black). */
export const MAIN_TEXT_COLOR = "222222";

/** Slide background colour (white). */
export const SLIDE_BG_COLOR = "FFFFFF";

/** Font size for annotation text (pt). */
export const ANNOTATION_FONT_SIZE = 28;

// ---------------------------------------------------------------------------
// Baseline 모델
//
// 실제 PowerPoint 렌더 42셀(scripts/golden/data/*.json)을 최소제곱 적합한
// 글자 배치 모델. fontSize 24~44pt x lineSpacing 1.2~2.2 전 구간에서
// 최대 잔차 2.3px(px/inch=96.02 기준).
//
//   baseline(line) = TEXT_TOP_MARGIN
//                  + (BASELINE_OFFSET_EM + BASELINE_LS_COEF * lineSpacing) * em
//                  + line * lineStep - line * LINE_DRIFT_CORRECTION
//   em = fontSize / 72 [in],  lineStep = fontSize * metrics.lineStepRatio * lineSpacing / 72
//
// 한글은 받침 아래 디센더가 없어 글자 잉크 바닥 ~= baseline.
// ---------------------------------------------------------------------------

export const BASELINE_OFFSET_EM = 0.130;
export const BASELINE_LS_COEF = 0.896;

/** baseline 위 한글 잉크 높이(보수적 최대). 실측 0.844~0.903em. */
export const CAP_HEIGHT_EM = 0.90;

// ---------------------------------------------------------------------------
// Marker / Annotation Shapes
// ---------------------------------------------------------------------------

/** Default marker color for annotation shapes (dark blue, no '#' prefix). */
export const MARKER_COLOR = "294C67";

/** Line width for underline shapes (pt). */
export const UNDERLINE_LINE_WIDTH = 3;

/** Line width for circle / rectangle / triangle / bracket shapes (pt). */
export const SHAPE_LINE_WIDTH = 3;

// ---------------------------------------------------------------------------
// 마커 오프셋 (전부 em 비율 — 절대 인치는 폰트 크기가 바뀌면 틀어진다)
// ---------------------------------------------------------------------------

/**
 * 밑줄 stroke의 baseline 아래 오프셋(em).
 * 소유자 실물 관측: 기존 0.083em은 "조금 높다" → 0.16em으로 하강.
 * 렌더된 bar 상단이 글자 바닥에서 0.12~0.17em 아래에 균일하게 앉는다.
 */
export const UNDERLINE_GAP_EM = 0.16;

/** 감싸기 도형 패딩(em). */
export const RECT_PAD_EM = 0.12;
export const RECT_PAD_X_EM = 0.08;
export const CIRCLE_PAD_EM = 0.22; // 타원은 모서리 여유 필요(수평=수직)
export const TRIANGLE_TOP_PAD_EM = 0.38; // apex 공간
export const TRIANGLE_BOTTOM_PAD_EM = 0.10;
export const TRIANGLE_PAD_X_EM = 0.10;

/** 브라켓 「」 — 본문 크기로 스케일되는 텍스트 글리프. */
export const BRACKET_X_INSET_EM = 0.44;
export const BRACKET_OPEN_RISE_EM = 0.20;
export const BRACKET_CLOSE_DROP_EM = 0.05;

// ---------------------------------------------------------------------------
// Annotation Text Positioning
// ---------------------------------------------------------------------------

/** Vertical gap between marker shape bottom and annotation text (inches). */
export const ANNOTATION_Y_GAP = -0.03;

/** Height of an annotation text box (inches). */
export const ANNOTATION_TEXT_HEIGHT = 0.6;

/** Minimum width for annotation text boxes (inches). */
export const MIN_ANNOTATION_WIDTH = 6.0;

// ---------------------------------------------------------------------------
// Summary Box
// ---------------------------------------------------------------------------

/** Color for summary annotation box background. */
export const SUMMARY_BG_COLOR = "E8EFF5";

/** Color for summary annotation box border. */
export const SUMMARY_BORDER_COLOR = "294C67";

/** Height of the summary box (inches). */
export const SUMMARY_BOX_HEIGHT = 0.55;

/** Bottom offset of the summary box from slide bottom (inches). */
export const SUMMARY_BOX_BOTTOM_OFFSET = 0.2;

/**
 * Per-line cumulative Y drift correction (inches).
 * Subtracted as `lineNumber * LINE_DRIFT_CORRECTION` from Y positions
 * to compensate for PowerPoint's line spacing rounding.
 * 알려진 잔차: fs44 · 2번째 줄에서 ~2px 과보정 (허용치 0.25em 대비 무해).
 */
export const LINE_DRIFT_CORRECTION = 0.015;

/**
 * Multi-line annotation vertical offset (inches).
 * Applied when an annotation spans multiple text lines.
 */
export const MULTI_LINE_ANNOTATION_OFFSET = 0.27;

/**
 * Gap bias factor: proportion of the gap between anchor and next line
 * used to position annotation text closer to the marker.
 */
export const GAP_BIAS_FACTOR = 0.03;
