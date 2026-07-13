/**
 * SlideMarkerLayer — 슬라이드 미리보기 위에 "실제 도형"으로 마커/주석을 그리는
 * 절대배치 오버레이. layoutAnnotation이 내는 인치 좌표(= .pptx exporter와
 * 비트 단위로 동일)를 pxPerInch로 곱해 배치하므로, 내보낸 PowerPoint와 최대한
 * 가깝게 보인다.
 *
 * 좌표 원점: 부모(카드/서피스)의 padding-box 좌상단 = 슬라이드 (0,0). 호스트가
 * 좌우 패딩 = TEXT_LEFT_MARGIN·pxPerInch, 상단 패딩 = TEXT_TOP_MARGIN·pxPerInch로
 * 두면 본문 글자와 이 레이어가 같은 모델 좌표계를 공유한다.
 *
 * 이 레이어는 pointer-events-none·aria-hidden이며, 본문 텍스트 DOM은 건드리지
 * 않는다(선택/주석 상호작용은 여전히 아래 텍스트에서 동작).
 */

import type { CSSProperties } from "react";
import type { SlideData, PptSettings } from "@/lib/types";
import { DEFAULT_ANNOTATION_COLOR } from "@/lib/types";
import { layoutAnnotation } from "@/lib/annotation-layout";
import {
  UNDERLINE_LINE_WIDTH,
  SHAPE_LINE_WIDTH,
  SUMMARY_BG_COLOR,
  SUMMARY_BORDER_COLOR,
} from "@/lib/pptx-constants";

export interface SlideMarkerLayerProps {
  slide: SlideData;
  settings: PptSettings;
  /** = 96 · scale, 호스트가 카드/서피스 폭에서 계산해 전달. */
  pxPerInch: number;
  /** 주석별 표시 여부. 미지정 시 항상 표시. */
  visible?: (annotationId: string) => { marker: boolean; text: boolean };
  /** 리허설처럼 등장 전환을 줄지 여부(편집기는 false). */
  animated?: boolean;
}

// 애니메이션 CSS(리허설 전용). reduced-motion 존중 — RehearsalOverlay와 동일 방식.
const LAYER_CSS = `
.sml-fade { transition: opacity 0.3s ease; }
@media (prefers-reduced-motion: reduce) { .sml-fade { transition: none !important; } }
`;

// exporter가 margin을 지정하지 않는 텍스트박스(주석 설명·요약 ▶)에는 PowerPoint
// 기본 내부 여백이 적용된다: lIns/rIns 0.1in, tIns/bIns 0.05in. 여기서 좌우를
// 패딩으로 미러링한다(상단 0.05in은 이미 paddingTop으로 반영).
const PPT_DEFAULT_LINS_IN = 0.1;

// PPT valign bottom/top은 폰트 ascent/descent를 기준으로 줄을 앉히고, CSS 라인박스는
// 하프리딩으로 가운데 정렬한다. 그 차이 = (lineHeight − (ascent+descent))/2 를
// translateY로 보정한다(꺾쇠 글리프 전용). SSR·미지원 브라우저에서는 0.
const halfLeadingCache = new Map<string, number>();
function bracketHalfLeadingPx(family: string, fontPx: number): number {
  if (typeof document === "undefined") return 0;
  const key = `${family}|${fontPx}`;
  const hit = halfLeadingCache.get(key);
  if (hit !== undefined) return hit;
  let v = 0;
  try {
    const ctx = document.createElement("canvas").getContext("2d");
    if (ctx) {
      ctx.font = `700 ${fontPx}px ${family}`;
      const m = ctx.measureText("가");
      const fba = m.fontBoundingBoxAscent;
      const fbd = m.fontBoundingBoxDescent;
      if (typeof fba === "number" && typeof fbd === "number") {
        v = (fontPx - (fba + fbd)) / 2; // lineHeight 1 기준 하프리딩(대개 음수)
      }
    }
  } catch {
    v = 0;
  }
  halfLeadingCache.set(key, v);
  return v;
}

export default function SlideMarkerLayer({
  slide,
  settings,
  pxPerInch,
  visible,
  animated = false,
}: SlideMarkerLayerProps) {
  const P = pxPerInch;
  const fadeClass = animated ? "sml-fade" : undefined;

  // "#RRGGBB" 형태 색상 접두사가 없는 상수(SUMMARY_*)에 '#'를 붙여 CSS 색으로 쓴다.
  const withHash = (c: string) => (c.startsWith("#") ? c : `#${c}`);
  const summaryBg = withHash(SUMMARY_BG_COLOR);
  const summaryBorder = withHash(SUMMARY_BORDER_COLOR);

  // pt(=1/72in) → px. 마커 stroke·요약 텍스트 등 pt 단위 값을 화면 px로.
  const ptToPx = (pt: number) => (pt / 72) * P;

  const bodyFontFamily = `"${settings.fontFamily}", "맑은 고딕", sans-serif`;

  // 마커 좌표는 exporter와 동일한 방식으로 계산(줄 수는 1회만).
  const totalLines = slide.text.split("\n").length;
  const sorted = [...slide.annotations].sort((a, b) => a.order - b.order);

  const nodes: React.ReactNode[] = [];

  for (const ann of sorted) {
    const color = ann.color || DEFAULT_ANNOTATION_COLOR;
    const vis = visible ? visible(ann.id) : { marker: true, text: true };
    const markerOpacity = vis.marker ? 1 : 0;
    const textOpacity = vis.text ? 1 : 0;

    const layout = layoutAnnotation(slide.text, ann, settings, totalLines);
    const marker = layout.marker;

    // ---- 마커 도형 ----
    if (marker.kind === "underline") {
      const strokeIn = UNDERLINE_LINE_WIDTH / 72;
      marker.segments.forEach((seg, si) => {
        nodes.push(
          <div
            key={`${ann.id}-u-${si}`}
            className={fadeClass}
            style={{
              position: "absolute",
              top: (seg.y - strokeIn / 2) * P,
              left: seg.x * P,
              width: seg.w * P,
              height: strokeIn * P,
              background: color,
              borderRadius: 1,
              opacity: markerOpacity,
            }}
          />,
        );
      });
    } else if (marker.kind === "shape") {
      const strokePx = ptToPx(SHAPE_LINE_WIDTH);
      const base: CSSProperties = {
        position: "absolute",
        top: marker.y * P,
        left: marker.x * P,
        width: marker.w * P,
        height: marker.h * P,
        opacity: markerOpacity,
      };
      if (marker.shape === "triangle") {
        nodes.push(
          <svg
            key={`${ann.id}-tri`}
            className={fadeClass}
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            style={{ ...base, overflow: "visible" }}
          >
            <polygon
              points="50,0 0,100 100,100"
              fill="none"
              stroke={color}
              strokeWidth={strokePx}
              vectorEffect="non-scaling-stroke"
            />
          </svg>,
        );
      } else {
        // PPT 도형 스트로크는 경계 중앙에 걸치고 CSS border는 안쪽에 그려진다 —
        // 박스를 스트로크 절반씩 확장해 중앙선 스트로크를 재현한다.
        nodes.push(
          <div
            key={`${ann.id}-${marker.shape}`}
            className={fadeClass}
            style={{
              ...base,
              top: marker.y * P - strokePx / 2,
              left: marker.x * P - strokePx / 2,
              width: marker.w * P + strokePx,
              height: marker.h * P + strokePx,
              border: `${strokePx}px solid ${color}`,
              borderRadius: marker.shape === "circle" ? "50%" : 0,
            }}
          />,
        );
      }
    } else if (marker.kind === "bracket") {
      const glyphFontPx = ptToPx(settings.fontSize);
      const brackets: Array<{
        key: string;
        x: number;
        y: number;
        size: number;
        glyph: string;
        alignItems: "flex-end" | "flex-start";
      }> = [
        {
          key: `${ann.id}-bopen`,
          x: marker.open.x,
          y: marker.open.y,
          size: marker.open.size,
          glyph: "「",
          alignItems: "flex-end", // valign bottom
        },
        {
          key: `${ann.id}-bclose`,
          x: marker.close.x,
          y: marker.close.y,
          size: marker.close.size,
          glyph: "」",
          alignItems: "flex-start", // valign top
        },
      ];
      // valign 보정: PPT는 폰트 ascent/descent 기준으로 앉히고 CSS는 하프리딩
      // 센터링 — open(bottom)은 +하프리딩, close(top)은 −하프리딩만큼 이동.
      const hl = bracketHalfLeadingPx(bodyFontFamily, glyphFontPx);
      for (const b of brackets) {
        const shift = b.alignItems === "flex-end" ? hl : -hl;
        nodes.push(
          <div
            key={b.key}
            className={fadeClass}
            style={{
              position: "absolute",
              top: b.y * P,
              left: b.x * P,
              width: b.size * P,
              height: b.size * P,
              display: "flex",
              justifyContent: "center",
              alignItems: b.alignItems,
              color,
              fontFamily: bodyFontFamily,
              fontWeight: 700,
              fontSize: glyphFontPx,
              lineHeight: 1,
              transform: shift ? `translateY(${shift}px)` : undefined,
              opacity: markerOpacity,
            }}
          >
            {b.glyph}
          </div>,
        );
      }
    } else if (marker.kind === "summary") {
      // 요약: 박스 + 안쪽 ▶ 텍스트. 색은 고정(SUMMARY_BORDER_COLOR).
      // 애니메이션 클릭 그룹과 동일하게 박스는 marker, ▶ 텍스트는 text 채널.
      const sumStrokePx = ptToPx(1.5);
      nodes.push(
        <div
          key={`${ann.id}-sumbox`}
          className={fadeClass}
          style={{
            position: "absolute",
            top: marker.y * P - sumStrokePx / 2,
            left: marker.x * P - sumStrokePx / 2,
            width: marker.w * P + sumStrokePx,
            height: marker.h * P + sumStrokePx,
            background: summaryBg,
            border: `${sumStrokePx}px solid ${summaryBorder}`,
            borderRadius: 0.08 * P,
            opacity: markerOpacity,
          }}
        />,
      );
      nodes.push(
        <div
          key={`${ann.id}-sumtxt`}
          className={fadeClass}
          style={{
            position: "absolute",
            top: (marker.y + 0.05) * P,
            left: (marker.x + 0.15) * P,
            width: (marker.w - 0.3) * P,
            height: (marker.h - 0.1) * P,
            boxSizing: "border-box",
            paddingLeft: PPT_DEFAULT_LINS_IN * P,
            paddingRight: PPT_DEFAULT_LINS_IN * P,
            display: "flex",
            alignItems: "center",
            color: summaryBorder,
            fontFamily: bodyFontFamily,
            fontWeight: 700,
            fontSize: ptToPx(settings.annotationFontSize),
            lineHeight: 1.03,
            overflow: "hidden",
            opacity: textOpacity,
          }}
        >
          {`▶ ${ann.content}`}
        </div>,
      );
    }

    // ---- 주석 설명 텍스트 ----
    if (layout.text && ann.content) {
      const t = layout.text;
      nodes.push(
        <div
          key={`${ann.id}-text`}
          className={fadeClass}
          style={{
            position: "absolute",
            top: t.y * P,
            left: t.x * P,
            width: t.w * P,
            boxSizing: "border-box",
            fontFamily: bodyFontFamily,
            fontWeight: 700,
            fontSize: ptToPx(t.fontSizePt),
            color,
            textAlign: "left",
            lineHeight: 1.03,
            // 실측 텍스트박스 내부 기하: 잉크 top ≈ boxY + tIns(0.05in) + (1.026−cap)·em.
            // paddingTop 0.05in + lineHeight 1.03 조합이 이를 재현한다.
            paddingTop: 0.05 * P,
            // exporter가 margin 미지정 → PPT 기본 lIns/rIns 0.1in이 적용된다.
            paddingLeft: PPT_DEFAULT_LINS_IN * P,
            paddingRight: PPT_DEFAULT_LINS_IN * P,
            // 줄바꿈은 CSS 기본값(word-break: normal) — PPT 주석 텍스트박스와 동일하게
            // 한글은 글자 단위로 꺾인다.
            opacity: textOpacity,
          }}
        >
          {ann.content}
        </div>,
      );
    }
  }

  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: "visible",
        pointerEvents: "none",
      }}
    >
      {animated && <style>{LAYER_CSS}</style>}
      {nodes}
    </div>
  );
}
