"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { PptSettings, SlideData } from "@/lib/types";
import { useSlideTextMetrics } from "@/lib/use-slide-text-metrics";
import SlideMarkerLayer from "@/components/SlideMarkerLayer";

// ---------------------------------------------------------------------------
// 교정지 palette (chrome only — 마커/요약 색은 annotation.color / 레이어가 담당)
// ---------------------------------------------------------------------------
const INK = "#16202B";
const PENCIL = "#5B6470";
const RULE = "#E4E1DA";

// CSS px per inch (CSS reference pixel).
const PX_PER_IN = 96;

// ---------------------------------------------------------------------------
// Step model
//
// The classroom reveals annotations in `order` sequence (this matches the
// exported .pptx, which pptx-generator builds by iterating annotations sorted
// by `order`). Every annotation → 2 steps (marker/box, then its text) — the
// exporter's animation XML gives each annotation exactly two click groups,
// including summary (box, then ▶ text).
// ---------------------------------------------------------------------------
interface StepModel {
  markerStep: Map<string, number>;
  textStep: Map<string, number>;
  total: number;
}

function buildStepModel(slide: SlideData): StepModel {
  const sortedByOrder = [...slide.annotations].sort((a, b) => a.order - b.order);

  const markerStep = new Map<string, number>();
  const textStep = new Map<string, number>();

  let step = 0;
  for (const ann of sortedByOrder) {
    markerStep.set(ann.id, step++);
    textStep.set(ann.id, step++);
  }

  return { markerStep, textStep, total: step };
}

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
  const { total } = steps;

  // Current step starts at -1: nothing is revealed on mount, matching real
  // PowerPoint — when a slide appears no click-animated element is visible, and
  // the first click reveals the first element. The overlay is keyed on slide.id
  // by its parent, so a new slide remounts it fresh and this initializes back to
  // -1 — no reset effect needed.
  const [currentStep, setCurrentStep] = useState(-1);

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

  // 편집기와 동일한 본문 타이포/여백/첫 baseline 보정(공유 훅).
  const {
    fontSizePx,
    lineHeightPx,
    translateYPx,
    padXPx,
    padYPx,
  } = useSlideTextMetrics(settings, scale);

  const advance = useCallback(() => {
    if (total === 0) return;
    setCurrentStep((s) => Math.min(total - 1, s + 1));
  }, [total]);

  const retreat = useCallback(() => {
    setCurrentStep((s) => Math.max(-1, s - 1));
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

  // 주석별 표시 여부: order 스텝 모델에서 파생.
  const visible = useCallback(
    (id: string) => {
      const mStep = steps.markerStep.get(id);
      const tStep = steps.textStep.get(id);
      return {
        marker: mStep === undefined ? true : currentStep >= mStep,
        text: tStep === undefined ? true : currentStep >= tStep,
      };
    },
    [steps, currentStep],
  );

  const ratio = settings.slideWidth / settings.slideHeight;
  const annFontPx = (settings.annotationFontSize / 72) * PX_PER_IN * scale;

  const pillText =
    total === 0
      ? "Esc로 닫기"
      : currentStep < 0
        ? "리허설 — 클릭하면 첫 주석이 나타납니다"
        : currentStep >= total - 1
          ? "리허설 완료 — Esc로 닫기"
          : `리허설 ${currentStep + 1} / ${total} — 클릭하면 다음`;

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
      {/* White slide surface */}
      <div
        ref={surfaceRef}
        className="relative bg-white"
        style={{
          width: `min(1100px, 92vw, ${85 * ratio}vh)`,
          aspectRatio: `${settings.slideWidth} / ${settings.slideHeight}`,
          padding: `${padYPx}px ${padXPx}px`,
          border: `1px solid ${RULE}`,
          borderRadius: 4,
          boxShadow: "0 24px 64px rgba(22, 32, 43, 0.38)",
          overflow: "hidden",
        }}
      >
        {/* 본문: 실제 도형/주석은 SlideMarkerLayer가 위에 그린다. 여기서는 순수
            본문만 흘려보내고, 첫 baseline·줄 스텝을 모델에 맞춘다. */}
        <div
          className="kor-text"
          style={{
            whiteSpace: "pre-wrap",
            wordBreak: "keep-all",
            overflowWrap: "break-word",
            fontFamily: `"${settings.fontFamily}", '맑은 고딕', sans-serif`,
            fontSize: `${fontSizePx}px`,
            lineHeight: `${lineHeightPx}px`,
            fontWeight: 700,
            color: INK,
            transform: `translateY(${translateYPx}px)`,
          }}
        >
          {slide.text}
        </div>

        {/* 실제 도형 마커/주석/요약 레이어 — order 스텝에 따라 등장(animated). */}
        {scale > 0 && (
          <SlideMarkerLayer
            slide={slide}
            settings={settings}
            pxPerInch={PX_PER_IN * scale}
            animated
            visible={visible}
          />
        )}

        {total === 0 && (
          <p
            className="kor-text"
            style={{
              marginTop: `${Math.max(annFontPx, 12)}px`,
              color: PENCIL,
              fontSize: `${Math.max(annFontPx, 12)}px`,
            }}
          >
            이 슬라이드에는 주석이 없습니다.
          </p>
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
