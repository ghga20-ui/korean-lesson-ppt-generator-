// Genre types
export type Genre = "poetry" | "novel";

// Input mode types
export type InputMode = "B" | "C" | "A";

// Extracted annotation from Gemini OCR (before matching to slide indices)
export interface ExtractedAnnotation {
  targetText: string;
  content: string;
  markerType: MarkerType;
}

// Annotation marker types
export type MarkerType = "underline" | "circle" | "rectangle" | "triangle" | "bracket" | "summary";

// A single annotation on a text passage
export interface Annotation {
  id: string;
  /** Start character index in the slide's text */
  startIndex: number;
  /** End character index in the slide's text */
  endIndex: number;
  /** The selected text passage */
  targetText: string;
  /** Annotation/commentary content */
  content: string;
  /** Visual marker type */
  markerType: MarkerType;
  /** Display order (also animation order) */
  order: number;
  /** Marker and annotation text color (hex, e.g. "#294C67") */
  color: string;
  /** 주석 출처 — "ai"는 AI 추출, "manual"/부재는 수동 작성으로 간주 */
  source?: "ai" | "manual";
}

// A single slide's data
export interface SlideData {
  id: string;
  /** The main text content for this slide */
  text: string;
  /** Annotations mapped to this slide */
  annotations: Annotation[];
}

// Complete project data
export interface ProjectData {
  genre: Genre;
  /** Original full text input */
  fullText: string;
  /** Slides after splitting */
  slides: SlideData[];
}

// PPT generation settings
export interface PptSettings {
  /** Slide width in inches */
  slideWidth: number;
  /** Slide height in inches */
  slideHeight: number;
  /** Main text font size in points */
  fontSize: number;
  /** Line spacing multiplier (1.5 - 2.0) */
  lineSpacing: number;
  /** Font family */
  fontFamily: string;
  /** Annotation text font size in points */
  annotationFontSize: number;
  /** Proportion of slide height for main text area (rest for annotations) */
  textAreaHeightRatio: number;
}

export const DEFAULT_POETRY_SETTINGS: PptSettings = {
  slideWidth: 13.33,
  slideHeight: 7.5,
  fontSize: 36,
  lineSpacing: 1.8,
  fontFamily: "한컴산뜻돋움",
  annotationFontSize: 28,
  textAreaHeightRatio: 0.65,
};

export const DEFAULT_NOVEL_SETTINGS: PptSettings = {
  slideWidth: 13.33,
  slideHeight: 7.5,
  fontSize: 28,
  lineSpacing: 1.8,
  fontFamily: "한컴산뜻돋움",
  annotationFontSize: 24,
  textAreaHeightRatio: 0.72,
};

export const DEFAULT_ANNOTATION_COLOR = "#294C67";

export const ANNOTATION_COLOR_PALETTE = [
  "#294C67", // 진한 파랑 (기본)
  "#C0392B", // 빨강
  "#27AE60", // 초록
  "#8E44AD", // 보라
  "#D68910", // 주황
  "#2980B9", // 하늘
  "#1ABC9C", // 청록
  "#7F8C8D", // 회색
];
