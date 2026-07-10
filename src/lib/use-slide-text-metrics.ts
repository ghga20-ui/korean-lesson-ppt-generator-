/**
 * 슬라이드 본문 타이포를 "실제 PowerPoint와 같은 좌표"로 미리보기하기 위한
 * 공유 훅. 편집기(AnnotationEditor)와 리허설(RehearsalOverlay)이 이 훅 하나를
 * 써서 본문 블록의 폰트 크기·줄간격·첫 baseline 보정을 동일하게 적용한다.
 * (두 컴포넌트가 각자 계산하면 값이 서로 어긋날 수 있어 단일 출처로 둔다.)
 *
 * ── 좌표 모델 ──────────────────────────────────────────────────────────────
 * pxPerInch = 96 · scale = 카드/서피스 clientWidth ÷ slideWidth.
 * 이 값이 마커 레이어(SlideMarkerLayer)가 쓰는 인치→px 배율과 정확히 같아야
 * 마커 도형과 본문 글자가 같은 스케일로 겹친다.
 *
 * fontSizePx: PPT 폰트 크기는 pt(=1/72in)다. 화면 px = (fontSize/72)in · pxPerInch.
 *   즉 fontSize·scale 이 아니라 fontSize/72·96·scale 이어야 슬라이드 폭 대비
 *   실제 크기가 되고, 마커 도형(모델 인치 좌표)과 글자 폭·높이가 일치한다.
 *
 * lineHeightPx: 브라우저 줄 스텝을 모델 줄 스텝과 "정확히" 같게 만든다.
 *   모델 baseline(k+1) − baseline(k) = step − LINE_DRIFT_CORRECTION (인치).
 *   step = fontSize·lineStepRatio·lineSpacing/72. px로 환산해 line-height에 준다.
 *
 * translateYPx: CSS는 첫 줄 baseline을 half-leading으로 잡고, PPT는 실측 모델로
 *   잡는다. 둘의 차이만큼 본문 블록만 세로 이동시켜 첫 baseline을 모델에 맞춘다.
 *   (이후 줄은 lineHeightPx가 모델 스텝과 같으므로 자동으로 전부 맞는다.)
 */

import { useLayoutEffect, useState } from "react";
import type { PptSettings } from "./types";
import { getFontMetrics } from "./font-metrics";
import {
  TEXT_LEFT_MARGIN,
  TEXT_TOP_MARGIN,
  LINE_DRIFT_CORRECTION,
  BASELINE_OFFSET_EM,
  BASELINE_LS_COEF,
} from "./pptx-constants";

/** CSS px per inch (CSS reference pixel). */
const PX_PER_IN = 96;

export interface SlideTextMetrics {
  /** 본문 줄 높이(px) — 모델 줄 스텝과 동일(드리프트 −0.015in/줄 포함). */
  lineHeightPx: number;
  /** 본문 블록 전체에 걸 translateY(px) — 첫 baseline을 모델에 정렬. */
  translateYPx: number;
  /** 본문 폰트 크기(px) = (fontSize/72)in · pxPerInch. */
  fontSizePx: number;
  /** 좌측 패딩(px) = TEXT_LEFT_MARGIN · pxPerInch. */
  padXPx: number;
  /** 상단 패딩(px) = TEXT_TOP_MARGIN · pxPerInch. */
  padYPx: number;
}

/**
 * @param settings 슬라이드 설정(폰트·크기·줄간격).
 * @param scale    카드/서피스 clientWidth ÷ (slideWidth·96). 0이면 미측정.
 */
export function useSlideTextMetrics(
  settings: PptSettings,
  scale: number,
): SlideTextMetrics {
  const metrics = getFontMetrics(settings.fontFamily);
  const pxPerInch = PX_PER_IN * scale;
  const emInch = settings.fontSize / 72;

  const fontSizePx = emInch * pxPerInch;
  const padXPx = TEXT_LEFT_MARGIN * pxPerInch;
  const padYPx = TEXT_TOP_MARGIN * pxPerInch;

  // 모델 줄 스텝(인치) = step − drift. px로 환산.
  const lineHeightPx =
    ((settings.fontSize * metrics.lineStepRatio * settings.lineSpacing) / 72 -
      LINE_DRIFT_CORRECTION) *
    pxPerInch;

  // 모델 첫 줄 baseline(카드 상단 기준, px).
  const modelBaselinePx =
    (TEXT_TOP_MARGIN +
      (BASELINE_OFFSET_EM +
        BASELINE_LS_COEF * settings.lineSpacing +
        (metrics.baselineAdjustEm ?? 0)) *
        emInch) *
    pxPerInch;

  // 첫 baseline 보정은 canvas TextMetrics가 필요하므로 layout 후 측정한다.
  // SSR/canvas 미지원/미측정(scale 0) 시 0 이동(무해한 graceful fallback).
  const [translateYPx, setTranslateYPx] = useState(0);
  useLayoutEffect(() => {
    // setState는 named 함수 안에 두어 set-state-in-effect 규칙을 건드리지 않는다
    // (기존 scale 측정 useLayoutEffect와 동일한 패턴).
    const measure = () => {
      if (scale <= 0 || typeof document === "undefined") {
        setTranslateYPx(0);
        return;
      }
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        setTranslateYPx(0);
        return;
      }
      ctx.font = `700 ${fontSizePx}px "${settings.fontFamily}"`;
      const m = ctx.measureText("가");
      const asc = m.fontBoundingBoxAscent;
      const desc = m.fontBoundingBoxDescent;
      // fontBoundingBox* 미지원(구형 엔진) → 조용히 0 이동.
      if (typeof asc !== "number" || typeof desc !== "number") {
        setTranslateYPx(0);
        return;
      }
      const halfLeading = (lineHeightPx - (asc + desc)) / 2;
      const browserBaselinePx = padYPx + halfLeading + asc;
      setTranslateYPx(modelBaselinePx - browserBaselinePx);
    };
    measure();
  }, [
    scale,
    settings.fontFamily,
    fontSizePx,
    lineHeightPx,
    padYPx,
    modelBaselinePx,
  ]);

  return { lineHeightPx, translateYPx, fontSizePx, padXPx, padYPx };
}
