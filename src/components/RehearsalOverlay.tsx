"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Annotation, PptSettings, SlideData } from "@/lib/types";

// ---------------------------------------------------------------------------
// 교정지 palette (chrome only — marker/summary colors come from annotation.color)
// ---------------------------------------------------------------------------
const INK = "#16202B";
const BLUE = "#294C67";
const PENCIL = "#5B6470";
const RULE = "#E4E1DA";
const TINT = "#E8EFF5";

// CSS px per inch (CSS reference pixel).
const PX_PER_IN = 96;

// Allow CSS custom properties in inline styles without `any`.
type StyleWithVars = React.CSSProperties & Record<`--${string}`, string | number>;

// ---------------------------------------------------------------------------
// Text segmentation
//
// NOTE: This mirrors `segmentText` in `src/lib/html-generator.ts` exactly
// (non-overlapping, sorted by startIndex, `summary` excluded from inline
// segmentation). Kept as a local copy because html-generator is server-ish;
// keep the two conceptually in sync.
// ---------------------------------------------------------------------------
interface TextSegment {
  text: string;
  annotation: Annotation | null;
}

function segmentText(text: string, annotations: Annotation[]): TextSegment[] {
  if (annotations.length === 0) {
    return [{ text, annotation: null }];
  }

  const sorted = [...annotations]
    .filter((a) => a.markerType !== "summary")
    .sort((a, b) => a.startIndex - b.startIndex || a.order - b.order);

  const segments: TextSegment[] = [];
  let cursor = 0;

  for (const ann of sorted) {
    const start = Math.max(ann.startIndex, cursor);
    const end = Math.min(ann.endIndex, text.length);
    if (start >= end) continue;

    if (cursor < start) {
      segments.push({ text: text.slice(cursor, start), annotation: null });
    }
    segments.push({ text: text.slice(start, end), annotation: ann });
    cursor = end;
  }

  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), annotation: null });
  }

  return segments;
}

// ---------------------------------------------------------------------------
// Step model
//
// The classroom reveals annotations in `order` sequence (this matches the
// exported .pptx, which pptx-generator builds by iterating annotations sorted
// by `order`). Each non-summary annotation → 2 steps (marker, then its
// explanation text). Each `summary` → 1 step (its tinted box).
// ---------------------------------------------------------------------------
interface StepModel {
  markerStep: Map<string, number>;
  textStep: Map<string, number>;
  summaryStep: Map<string, number>;
  summaries: Annotation[];
  total: number;
}

function buildStepModel(slide: SlideData): StepModel {
  const sortedByOrder = [...slide.annotations].sort((a, b) => a.order - b.order);

  const markerStep = new Map<string, number>();
  const textStep = new Map<string, number>();
  const summaryStep = new Map<string, number>();
  const summaries: Annotation[] = [];

  let step = 0;
  for (const ann of sortedByOrder) {
    if (ann.markerType === "summary") {
      summaryStep.set(ann.id, step++);
      summaries.push(ann);
    } else {
      markerStep.set(ann.id, step++);
      textStep.set(ann.id, step++);
    }
  }

  return { markerStep, textStep, summaryStep, summaries, total: step };
}

// ---------------------------------------------------------------------------
// Scoped CSS: transitions + reduced-motion. Marker underline paints on every
// wrapped line via box-decoration-break: clone. Hidden steps use opacity/size
// 0 (never display:none) so nothing reflows as items appear.
// ---------------------------------------------------------------------------
const OVERLAY_CSS = `
.rh-underline {
  background-image: linear-gradient(var(--rh-color), var(--rh-color));
  background-repeat: no-repeat;
  background-position: 0 100%;
  background-size: var(--rh-size) 2px;
  -webkit-box-decoration-break: clone;
  box-decoration-break: clone;
  padding-bottom: 2px;
  transition: background-size 0.42s cubic-bezier(0.22, 0.61, 0.36, 1);
}
.rh-fade { transition: opacity 0.3s ease; }
.rh-rect { transition: border-color 0.35s ease; }
@media (prefers-reduced-motion: reduce) {
  .rh-underline, .rh-fade, .rh-rect { transition: none !important; }
}
`;

interface RehearsalOverlayProps {
  slide: SlideData;
  settings: PptSettings;
  onClose: () => void;
}

export default function RehearsalOverlay({
  slide,
  settings,
  onClose,
}: RehearsalOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);

  const steps = useMemo(() => buildStepModel(slide), [slide]);
  const segments = useMemo(
    () => segmentText(slide.text, slide.annotations),
    [slide],
  );

  const { total } = steps;

  // Current step: step 0 is revealed on mount (mirrors the mockup's startRehearsal).
  // The overlay is keyed on slide.id by its parent, so a new slide remounts it
  // fresh and this initializes back to 0 — no reset effect needed.
  const [currentStep, setCurrentStep] = useState(0);

  // --- Scale: make the text look like the real slide. ---
  const [scale, setScale] = useState(0);
  useLayoutEffect(() => {
    const el = surfaceRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      if (w > 0) setScale(w / (settings.slideWidth * PX_PER_IN));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [settings.slideWidth]);

  const advance = useCallback(() => {
    if (total === 0) return;
    setCurrentStep((s) => Math.min(total - 1, s + 1));
  }, [total]);

  const retreat = useCallback(() => {
    setCurrentStep((s) => Math.max(0, s - 1));
  }, []);

  // --- Keyboard: → / Space / Enter advance, ← retreats, Esc closes. ---
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (
        e.key === "ArrowRight" ||
        e.key === " " ||
        e.key === "Spacebar" ||
        e.key === "Enter"
      ) {
        e.preventDefault();
        advance();
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        retreat();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [advance, retreat, onClose]);

  // --- Focus the overlay on mount; restore focus on close. ---
  useEffect(() => {
    const prevFocused = document.activeElement as HTMLElement | null;
    overlayRef.current?.focus();
    return () => {
      prevFocused?.focus?.();
    };
  }, []);

  // Derived px sizes.
  const fontSizePx = settings.fontSize * scale;
  const annFontPx = settings.annotationFontSize * scale;
  const hPad = 0.5 * PX_PER_IN * scale;
  const vPad = 0.35 * PX_PER_IN * scale;
  const ratio = settings.slideWidth / settings.slideHeight;

  const pillText =
    total === 0
      ? "Esc로 닫기"
      : currentStep >= total - 1
        ? "리허설 완료 — Esc로 닫기"
        : `리허설 ${currentStep + 1} / ${total} — 클릭하면 다음`;

  // --- Render a single inline annotation marker (text always visible). ---
  const renderMarker = useCallback(
    (seg: TextSegment, key: number) => {
      const ann = seg.annotation;
      if (!ann) return <span key={key}>{seg.text}</span>;

      const color = ann.color || BLUE;
      const markerShown = currentStep >= (steps.markerStep.get(ann.id) ?? Infinity);
      const textShown = currentStep >= (steps.textStep.get(ann.id) ?? Infinity);

      const explanation = (
        <span
          className="rh-fade"
          aria-hidden={!textShown}
          style={{
            position: "absolute",
            left: 0,
            top: `${settings.fontSize * scale * 1.05}px`,
            color,
            fontSize: `${annFontPx}px`,
            lineHeight: 1.2,
            fontWeight: 600,
            whiteSpace: "nowrap",
            pointerEvents: "none",
            opacity: textShown ? 1 : 0,
            zIndex: 5,
          }}
        >
          {ann.content}
        </span>
      );

      switch (ann.markerType) {
        case "underline": {
          const style: StyleWithVars = {
            position: "relative",
            "--rh-color": color,
            "--rh-size": markerShown ? "100%" : "0%",
          };
          return (
            <span key={key} className="rh-underline" style={style}>
              {seg.text}
              {explanation}
            </span>
          );
        }
        case "rectangle":
          return (
            <span
              key={key}
              className="rh-rect"
              style={{
                position: "relative",
                padding: "0 0.1em",
                borderRadius: 2,
                border: `2px solid ${markerShown ? color : "transparent"}`,
              }}
            >
              {seg.text}
              {explanation}
            </span>
          );
        case "circle":
          return (
            <span key={key} style={{ position: "relative", padding: "0 0.18em" }}>
              {seg.text}
              <span
                aria-hidden
                className="rh-fade"
                style={{
                  position: "absolute",
                  inset: "-0.28em -0.05em",
                  border: `2px solid ${color}`,
                  borderRadius: "50%",
                  pointerEvents: "none",
                  opacity: markerShown ? 1 : 0,
                }}
              />
              {explanation}
            </span>
          );
        case "triangle":
          return (
            <span key={key} style={{ position: "relative", padding: "0 0.12em" }}>
              {seg.text}
              <svg
                aria-hidden
                className="rh-fade"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                style={{
                  position: "absolute",
                  inset: "-0.30em -0.08em",
                  overflow: "visible",
                  pointerEvents: "none",
                  opacity: markerShown ? 1 : 0,
                }}
              >
                <polygon
                  points="50,2 2,98 98,98"
                  fill="none"
                  stroke={color}
                  strokeWidth={2}
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
              {explanation}
            </span>
          );
        case "bracket":
          return (
            <span key={key} style={{ position: "relative" }}>
              <span
                aria-hidden
                className="rh-fade"
                style={{ color, fontWeight: 700, opacity: markerShown ? 1 : 0 }}
              >
                「
              </span>
              {seg.text}
              <span
                aria-hidden
                className="rh-fade"
                style={{ color, fontWeight: 700, opacity: markerShown ? 1 : 0 }}
              >
                」
              </span>
              {explanation}
            </span>
          );
        default:
          return <span key={key}>{seg.text}</span>;
      }
    },
    [currentStep, steps, scale, settings.fontSize, annFontPx],
  );

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label="리허설"
      tabIndex={-1}
      onClick={advance}
      className="fixed inset-0 z-[100] flex select-none items-center justify-center bg-[#16202B]/70 backdrop-blur-sm focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#294C67]"
      style={{ cursor: total > 0 ? "pointer" : "default" }}
    >
      <style>{OVERLAY_CSS}</style>

      {/* White slide surface */}
      <div
        ref={surfaceRef}
        className="relative bg-white"
        style={{
          width: `min(1100px, 92vw, ${85 * ratio}vh)`,
          aspectRatio: `${settings.slideWidth} / ${settings.slideHeight}`,
          padding: `${vPad}px ${hPad}px`,
          border: `1px solid ${RULE}`,
          borderRadius: 4,
          boxShadow: "0 24px 64px rgba(22, 32, 43, 0.38)",
          overflow: "hidden",
        }}
      >
        <div
          className="kor-text"
          style={{
            whiteSpace: "pre-wrap",
            wordBreak: "keep-all",
            overflowWrap: "break-word",
            fontSize: `${fontSizePx}px`,
            lineHeight: settings.lineSpacing,
            fontWeight: 700,
            color: INK,
          }}
        >
          {segments.map(renderMarker)}
        </div>

        {total === 0 && (
          <p
            className="kor-text"
            style={{
              marginTop: `${Math.max(annFontPx, 12)}px`,
              color: PENCIL,
              fontSize: `${annFontPx}px`,
            }}
          >
            이 슬라이드에는 주석이 없습니다.
          </p>
        )}

        {/* Summary boxes anchored at the bottom of the slide */}
        {steps.summaries.length > 0 && (
          <div
            style={{
              position: "absolute",
              left: `${hPad}px`,
              right: `${hPad}px`,
              bottom: `${vPad}px`,
              display: "flex",
              flexDirection: "column",
              gap: `${Math.max(6 * scale, 4)}px`,
            }}
          >
            {steps.summaries.map((sum) => {
              const shown =
                currentStep >= (steps.summaryStep.get(sum.id) ?? Infinity);
              const sColor = sum.color || BLUE;
              return (
                <div
                  key={sum.id}
                  className="kor-text rh-fade"
                  style={{
                    background: TINT,
                    border: `2px solid ${sColor}`,
                    borderRadius: 6,
                    padding: `${0.35 * annFontPx}px ${0.7 * annFontPx}px`,
                    color: sColor,
                    fontSize: `${annFontPx}px`,
                    fontWeight: 700,
                    opacity: shown ? 1 : 0,
                  }}
                >
                  ▶ {sum.content}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Status pill */}
      <div
        className="pointer-events-none fixed left-1/2 bottom-[22px] -translate-x-1/2 rounded-full bg-[#16202B] px-3.5 py-2 font-mono text-xs text-white"
        aria-live="polite"
      >
        {pillText}
      </div>
    </div>
  );
}
