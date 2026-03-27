import Link from "next/link";
import { Icon } from "@/components/Icon";

const FEATURES = [
  { icon: "auto_awesome_mosaic" as const, label: "연·문장 단위 자동 분할" },
  { icon: "ink_highlighter" as const, label: "밑줄·원·사각형 주석 도형" },
  { icon: "animation" as const, label: "클릭 애니메이션 자동 적용" },
  { icon: "document_scanner" as const, label: "PDF 주석 OCR 추출" },
];

const STEPS = [
  { label: "텍스트 입력", desc: "시·소설 본문을 붙여넣거나 PDF에서 추출" },
  { label: "주석 달기", desc: "슬라이드별로 밑줄·도형·설명을 추가" },
  { label: "PPT 저장", desc: "클릭 애니메이션이 포함된 .pptx 다운로드" },
];

const MODES = [
  {
    key: "poetry",
    icon: "format_align_left" as const,
    label: "운문 / 짧은 텍스트",
    subtitle: "시 · 시조 · 가사 · 짧은 지문",
    desc: "연·행 단위로 슬라이드를 분할합니다. 빈 줄로 연을 구분합니다.",
    href: "/editor?genre=poetry",
  },
  {
    key: "novel",
    icon: "menu_book" as const,
    label: "산문 / 긴 텍스트",
    subtitle: "소설 · 수필 · 비문학 지문",
    desc: "적정 분량으로 자동 분할합니다. 문장 경계에서 자연스럽게 나눕니다.",
    href: "/editor?genre=novel",
  },
];

export default function Home() {
  return (
    <div
      className="grid h-screen w-screen overflow-hidden bg-gradient-to-br from-white to-[#FFF0E4]"
      style={{ gridTemplateColumns: "2fr 3fr" }}
    >
      {/* LEFT */}
      <div className="flex flex-col justify-center gap-9 border-r border-[#EEDDD0] px-14 py-16">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <span className="flex h-13 w-13 shrink-0 items-center justify-center rounded-xl bg-[#A07050] p-3 text-white">
            <Icon name="draw" size={28} />
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight text-[#6B3F26]">
            국어 수업 슬라이드 제작 도구
          </h1>
        </div>

        {/* Description */}
        <p className="text-lg leading-relaxed text-[#8B6040]">
          교과서 본문 텍스트를 붙여넣고 주석을 달면<br />
          수업용 PPT 초안을 빠르게 만들 수 있습니다.
        </p>

        {/* Features */}
        <ul className="flex flex-col gap-3.5">
          {FEATURES.map((f) => (
            <li key={f.icon} className="flex items-center gap-3 text-base text-[#7A5540]">
              <Icon name={f.icon} size={20} className="shrink-0 text-[#A07050]" />
              {f.label}
            </li>
          ))}
        </ul>

        {/* Steps */}
        <div>
          <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-[#A07050]/60">
            사용 흐름
          </p>
          <ol className="flex flex-col">
            {STEPS.map((step, i) => (
              <li key={i} className="relative flex gap-4">
                {i < STEPS.length - 1 && (
                  <span className="absolute left-[13px] top-7 h-full w-px bg-[#EEDDD0]" />
                )}
                <span className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#A07050] text-xs font-bold text-white">
                  {i + 1}
                </span>
                <div className="pb-5">
                  <p className="text-base font-semibold text-[#6B3F26]">{step.label}</p>
                  <p className="text-sm leading-relaxed text-[#B09070]">{step.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* RIGHT */}
      <div className="flex flex-col justify-center gap-6 bg-white px-16 py-16">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#A07050]/50">
          텍스트 유형 선택
        </p>

        {MODES.map((mode) => (
          <Link
            key={mode.key}
            href={mode.href}
            className="group flex flex-col gap-4 rounded-2xl border border-[#EEDDD0] bg-[#FFFBF8] p-8 transition-all hover:-translate-y-0.5 hover:border-[#A07050]/50 hover:shadow-lg"
          >
            <div className="flex items-center gap-4">
              <span className="flex shrink-0 items-center justify-center rounded-xl bg-[#F5E8DC] p-3 text-[#A07050] transition-colors group-hover:bg-[#A07050] group-hover:text-white">
                <Icon name={mode.icon} size={28} />
              </span>
              <div>
                <h2 className="text-xl font-bold text-[#6B3F26]">{mode.label}</h2>
                <p className="text-sm text-[#C4A898]">{mode.subtitle}</p>
              </div>
            </div>
            <p className="text-base leading-relaxed text-[#9B7060]">{mode.desc}</p>
            <span className="flex items-center gap-1 self-end text-sm font-medium text-[#A07050] opacity-30 transition-all group-hover:translate-x-1 group-hover:opacity-100">
              시작하기 <Icon name="arrow_forward" size={16} />
            </span>
          </Link>
        ))}

        <p className="text-center text-sm text-[#D4B8A8]">
          유형을 선택하면 편집 화면으로 이동합니다.
        </p>

        <p className="rounded-xl border border-[#EEDDD0] bg-[#FFF8F4] px-5 py-3 text-center text-xs leading-relaxed text-[#B09070]">
          생성된 파일은 <strong className="font-semibold text-[#8B6040]">초안</strong>입니다.
          폰트 설치 여부·레이아웃 세부 조정은 PowerPoint에서 직접 확인 후 사용하세요.
        </p>
      </div>
    </div>
  );
}
