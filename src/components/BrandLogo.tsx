/**
 * BrandLogo — "밑줄쫙" 워드마크.
 *
 * 명조(font-display) 글자 아래에 손으로 쫙 그은 테이퍼 획을 깐다.
 * 획은 왼쪽에서 두껍게 시작해 오른쪽으로 갈수록 얇아지며 끝을 살짝
 * 치켜올린다 — 교사의 결정적인 밑줄 한 획.
 *
 * tone:
 *  - "chalk": 분필 백 글자 + 노랑 분필 획 (칠판·어두운 배경용)
 *  - "ink":   먹색 글자 + 교과서 파랑 획 (종이·밝은 배경용)
 */

interface BrandLogoProps {
  /** 글자 크기(px). 획 두께·오프셋은 em 비례로 따라온다. */
  size?: number;
  tone?: "chalk" | "ink";
  className?: string;
}

const TONES = {
  chalk: { text: "#F4F1E8", stroke: "#F0DC9E" },
  ink: { text: "#16202B", stroke: "#294C67" },
} as const;

export default function BrandLogo({
  size = 26,
  tone = "chalk",
  className,
}: BrandLogoProps) {
  const c = TONES[tone];
  return (
    <span
      className={className}
      style={{
        position: "relative",
        display: "inline-block",
        fontFamily: "var(--font-display, serif)",
        fontWeight: 800,
        fontSize: size,
        lineHeight: 1.1,
        letterSpacing: "-0.02em",
        color: c.text,
      }}
    >
      밑줄쫙
      <svg
        aria-hidden
        viewBox="0 0 200 26"
        preserveAspectRatio="none"
        style={{
          position: "absolute",
          left: "-2%",
          bottom: "-0.28em",
          width: "104%",
          height: "0.34em",
          overflow: "visible",
        }}
      >
        <path
          fill={c.stroke}
          d="M2 10 C 48 19, 128 20, 186 9 L 198 3 C 194 11, 176 17, 150 20 C 100 26, 38 24, 2 17 Z"
        />
      </svg>
    </span>
  );
}
