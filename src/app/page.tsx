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

const PAIN_POINTS = [
  {
    icon: "schedule" as const,
    stat: "30분~1시간",
    desc: "시 한 편을 슬라이드로 옮기는 데 걸리는 시간",
  },
  {
    icon: "refresh" as const,
    stat: "매번 처음부터",
    desc: "작품이 바뀔 때마다 반복되는 레이아웃 작업",
  },
  {
    icon: "school" as const,
    stat: "정작 써야 할 곳",
    desc: "작품 해석 · 발문 구성 · 학생 피드백",
  },
];

const CORE_FEATURES = [
  {
    icon: "format_align_left" as const,
    title: "시 · 운문 자동 분할",
    desc: "빈 줄로 구분된 연(stanza)을 인식해 슬라이드별 4~5행을 자동 배치합니다. 40pt 글자 크기와 줄 간격도 계산해 주석 공간을 확보합니다.",
  },
  {
    icon: "menu_book" as const,
    title: "소설 · 산문 자동 분할",
    desc: "문단이 아닌 글자 수·줄 수 기준으로 슬라이드를 나눕니다. 긴 인용문도 문장 경계에서 자연스럽게 넘겨 잘림이 없습니다.",
  },
  {
    icon: "animation" as const,
    title: "클릭 주석 애니메이션",
    desc: "밑줄·원·사각형 도형과 텍스트 상자가 클릭할 때마다 순서대로 등장합니다. 학생의 시선을 단계적으로 유도하는 수업 흐름을 설계할 수 있습니다.",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen w-screen overflow-x-hidden bg-gradient-to-br from-white to-[#FFF0E4]">
      {/* Hero section */}
      <div
        className="grid h-screen w-full border-b border-[#E4E1DA]"
        style={{ gridTemplateColumns: "2fr 3fr" }}
      >
        {/* LEFT */}
        <div className="flex flex-col justify-center gap-9 border-r border-[#E4E1DA] px-14 py-16">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <span className="flex h-13 w-13 shrink-0 items-center justify-center rounded-xl bg-[#A07050] p-3 text-white">
              <Icon name="draw" size={28} />
            </span>
            <h1 className="text-4xl font-extrabold tracking-tight text-[#16202B]">
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
                    <span className="absolute left-[13px] top-7 h-full w-px bg-[#E4E1DA]" />
                  )}
                  <span className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#A07050] text-xs font-bold text-white">
                    {i + 1}
                  </span>
                  <div className="pb-5">
                    <p className="text-base font-semibold text-[#16202B]">{step.label}</p>
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
              className="group flex flex-col gap-4 rounded-2xl border border-[#E4E1DA] bg-[#FFFBF8] p-8 transition-all hover:-translate-y-0.5 hover:border-[#A07050]/50 hover:shadow-lg"
            >
              <div className="flex items-center gap-4">
                <span className="flex shrink-0 items-center justify-center rounded-xl bg-[#F5E8DC] p-3 text-[#A07050] transition-colors group-hover:bg-[#A07050] group-hover:text-white">
                  <Icon name={mode.icon} size={28} />
                </span>
                <div>
                  <h2 className="text-xl font-bold text-[#16202B]">{mode.label}</h2>
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

          <p className="rounded-xl border border-[#E4E1DA] bg-[#FFF8F4] px-5 py-3 text-center text-xs leading-relaxed text-[#B09070]">
            생성된 파일은 <strong className="font-semibold text-[#8B6040]">초안</strong>입니다.
            폰트 설치 여부·레이아웃 세부 조정은 PowerPoint에서 직접 확인 후 사용하세요.
          </p>
        </div>
      </div>

      {/* ── 서비스 상세 섹션 ── */}
      <section className="w-full bg-white px-4 py-20 sm:px-10 lg:px-24">

        {/* 1. 공감: 문제 제기 */}
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#A07050]/60">
            많은 국어 선생님이 공감하는 이야기
          </p>
          <h2 className="mb-4 text-3xl font-extrabold tracking-tight text-[#16202B]">
            시 한 편을 슬라이드로 옮기는 데<br />얼마나 걸리세요?
          </h2>
          <p className="text-base leading-relaxed text-[#8B6040]">
            연 구분, 글자 크기, 줄 간격, 밑줄·동그라미 주석까지—<br />
            수업 준비의 상당 시간이 PPT 레이아웃 작업에 사라집니다.
          </p>
        </div>

        <div className="mx-auto mb-24 grid max-w-4xl grid-cols-1 gap-5 sm:grid-cols-3">
          {PAIN_POINTS.map((p) => (
            <div
              key={p.stat}
              className="flex flex-col items-center gap-3 rounded-2xl border border-[#E4E1DA] bg-[#FFFBF8] p-7 text-center"
            >
              <Icon name={p.icon} size={28} className="text-[#A07050]" />
              <p className="text-lg font-extrabold text-[#16202B]">{p.stat}</p>
              <p className="text-sm leading-relaxed text-[#9B7060]">{p.desc}</p>
            </div>
          ))}
        </div>

        {/* 2. 핵심 기능 3가지 */}
        <div className="mx-auto mb-24 max-w-5xl">
          <div className="mb-10 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#A07050]/60">
              핵심 기능
            </p>
            <h2 className="text-2xl font-extrabold tracking-tight text-[#16202B]">
              수업 준비를 바꾸는 세 가지
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {CORE_FEATURES.map((f) => (
              <div
                key={f.title}
                className="flex flex-col gap-4 rounded-2xl border border-[#E4E1DA] bg-[#FFFBF8] p-7"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F5E8DC] text-[#A07050]">
                  <Icon name={f.icon} size={24} />
                </span>
                <h3 className="text-base font-bold text-[#16202B]">{f.title}</h3>
                <p className="text-sm leading-relaxed text-[#9B7060]">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
