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
export const TEXT_TOP_MARGIN = 0.5;

/** Proportion of slide height reserved for the main text area. */
export const TEXT_AREA_HEIGHT_RATIO = 0.65;

// ---------------------------------------------------------------------------
// Text Rendering
// ---------------------------------------------------------------------------

/** Main text colour (near black). */
export const MAIN_TEXT_COLOR = "222222";

/** Slide background colour (white). */
export const SLIDE_BG_COLOR = "FFFFFF";

/** Font family for all text. */
export const FONT_FAMILY = "한컴산뜻돋움";

/** Font size for annotation text (pt). */
export const ANNOTATION_FONT_SIZE = 28;

/**
 * Empirically calibrated line-step ratio for PowerPoint rendering.
 * PowerPoint's actual line-to-line distance is slightly smaller than
 * FONT_LINE_HEIGHT_RATIO predicts, causing cumulative Y drift on later lines.
 * Tuned to eliminate per-line drift across 4+ lines of text.
 */
export const PPT_LINE_STEP_RATIO = 1.22;

/**
 * Font line-height ratio: (usWinAscent + usWinDescent) / unitsPerEm.
 * Read from 한컴산뜻돋움 Bold font file: (1000 + 300) / 1000 = 1.3.
 */
export const FONT_LINE_HEIGHT_RATIO = 1.3;

// ---------------------------------------------------------------------------
// Marker / Annotation Shapes
// ---------------------------------------------------------------------------

/** Default marker color for annotation shapes (dark blue, no '#' prefix). */
export const MARKER_COLOR = "294C67";

/** Line width for underline shapes (pt). */
export const UNDERLINE_LINE_WIDTH = 3;

/** Line width for circle / rectangle / triangle / bracket shapes (pt). */
export const SHAPE_LINE_WIDTH = 3;

/** Padding around circle / rectangle shapes (inches). */
export const SHAPE_PADDING = 0.08;

/**
 * Vertical offset applied to all marker shapes so they align with the
 * actual glyph body instead of the top of the text line box.
 * PowerPoint text rendering places glyphs below pos.y due to internal leading.
 */
export const SHAPE_Y_OFFSET = 0.04;

/** Font size for bracket symbols 「」 (pt). */
export const BRACKET_SYMBOL_FONT_SIZE = 36;

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

// ---------------------------------------------------------------------------
// Per-Font Y-Offset Calibration
// ---------------------------------------------------------------------------

/**
 * Glyph vertical offset for circle/rectangle/triangle markers.
 * This value is calibrated at 36pt font size; scale proportionally
 * for other sizes via: offset * (fontSize / 36).
 */
export const GLYPH_Y_OFFSET_CIRCLE = 0.34;
export const GLYPH_Y_OFFSET_RECTANGLE = 0.34;
export const GLYPH_Y_OFFSET_TRIANGLE = 0.22;
export const GLYPH_Y_OFFSET_BRACKET_TOP = 0.28;
export const GLYPH_Y_OFFSET_BRACKET_BOTTOM = -0.24;

/**
 * Underline Y positioning: base offset from text top (inches).
 * Added to the line step to position the underline below each text line.
 */
export const UNDERLINE_Y_BASE_OFFSET = 0.40;

/**
 * Per-line cumulative Y drift correction.
 * Subtracted as `lineNumber * LINE_DRIFT_CORRECTION` from Y positions
 * to compensate for PowerPoint's line spacing rounding.
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
